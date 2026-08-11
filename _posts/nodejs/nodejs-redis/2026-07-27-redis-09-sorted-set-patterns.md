---
layout: post
title: "09. Redis Sorted Set 실습: 랭킹과 우선순위 처리"
description: "Redis Sorted Set을 활용해 인기 게시글, 검색어와 사용자 포인트 랭킹을 만들고 우선순위에 따라 작업을 처리하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 9
ai_assisted: true
toc:
  - id: session-01
    title: "1. 인기 게시글 랭킹 만들기"
  - id: session-02
    title: "2. 인기 검색어 순위 만들기"
  - id: session-03
    title: "3. 사용자 포인트 랭킹 만들기"
  - id: session-04
    title: "4. 우선순위 큐 구현하기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/redis-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 인기 게시글 랭킹 만들기 {#session-01}

![Redis 인기 점수 누적부터 게시글 TOP N과 DB 상세 정보를 결합하는 흐름](/assets/images/nodejs/nodejs-redis/redis-sorted-set-post-ranking-flow.png)

게시글 서비스에서는 인기 게시글 기능이 자주 필요합니다.  
예를 들어 다음 기준으로 인기글을 만들 수 있습니다.  

```text
- 조회수
- 좋아요 수
- 댓글 수
- 공유 수
- 가중치를 합산한 인기 점수
```

Sorted Set에서는 다음과 같이 저장합니다.  

```text
key    → zset:post-ranking
member → postId
score  → 인기 점수
```

예를 들어 게시글 1번이 10회 조회되고 게시글 2번이 3회 조회되면 Redis에는 개념적으로 다음과 같이 저장됩니다.  

```text
zset:post-ranking

member: "1", score: 10
member: "2", score: 3
```

score가 높은 게시글을 조회하면 인기 게시글 TOP N을 만들 수 있습니다.  

키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.zset.postRanking();
// zset:post-ranking
```

### 🟦 인기 점수 증가

```typescript
// src/ch09/post-zset.service.ts

/**
 * 게시글의 인기 점수를 증가시킵니다.
 *
 * 1. 인기 게시글 랭킹에 사용할 Sorted Set 키를 가져옵니다.
 * 2. postId를 member로 사용합니다.
 * 3. ZINCRBY로 score를 증가시킵니다.
 *
 * Sorted Set은 같은 member를 중복 저장하지 않습니다.
 * 같은 postId에 ZINCRBY를 여러 번 실행하면 member가 늘어나지 않고 score만 증가합니다.
 */
async increasePostRankingScore(postId: number, score = 1): Promise<number> {
  // NaN이나 Infinity가 Redis score로 전달되지 않도록 먼저 검증합니다.
  assertFiniteScore(score, '게시글 랭킹 점수');

  const key = RedisKey.zset.postRanking();
  const member = String(postId);

  // 게시글이 없으면 추가하고, 있으면 점수를 누적한 뒤 최종 점수를 반환합니다.
  const newScore = await redis.zIncrBy(key, score, member);

  return newScore;
}
```

인기 점수 증가는 `ZINCRBY`를 사용합니다.  

Redis 명령을 실행하기 전에 `NaN`이나 `Infinity`처럼 랭킹 점수로 사용할 수 없는 값을 차단합니다.  

여기서 key, member와 score는 다음 의미입니다.  

```text
key    → zset:post-ranking
member → 게시글 ID
score  → 인기 점수
```

예를 들어 다음 코드가 실행된다고 가정합니다.  

```typescript
await service.increasePostRankingScore(1);
await service.increasePostRankingScore(1);
await service.increasePostRankingScore(2);
```

Redis에는 개념적으로 다음과 같이 저장됩니다.  

```text
zset:post-ranking

member: "1", score: 2
member: "2", score: 1
```

중요한 점은 member가 중복 저장되지 않는다는 것입니다.  
`postId = 1`의 점수를 여러 번 증가시켜도 member `"1"`이 여러 개 생기지 않고 score만 증가합니다.  

### 🟦 TOP N 조회

```typescript
/**
 * 인기 게시글 TOP N을 조회합니다.
 *
 * 1. Redis Sorted Set에서 score가 높은 게시글 ID를 가져옵니다.
 * 2. Redis에는 postId와 score만 있으므로 게시글 상세 정보는 DB에서 조회합니다.
 * 3. Redis의 랭킹 순서를 유지해 결과를 반환합니다.
 *
 * Redis Sorted Set은 랭킹 인덱스 역할에 집중시키고,
 * 게시글 제목과 본문 같은 원본 데이터는 DB에서 가져옵니다.
 */
async getPopularPosts(limit = 10): Promise<PopularPostOutput[]> {
  // limit이 0이면 stop이 -1이 되어 전체 범위를 뜻하므로 명령 실행 전에 차단합니다.
  if (!isValidLimit(limit)) {
    return [];
  }

  const key = RedisKey.zset.postRanking();

  // REV 옵션으로 점수가 높은 순서의 지정 범위를 조회합니다.
  const rankingItems = await redis.zRangeWithScores(key, 0, limit - 1, {
    REV: true,
  });

  if (rankingItems.length === 0) {
    return [];
  }

  // Redis의 문자열 member를 Prisma의 Int ID로 조회할 수 있도록 변환합니다.
  const postIds = rankingItems.map((item) => Number(item.value));

  // Redis에서 가져온 게시글 ID에 해당하는 상세 정보만 DB에서 조회합니다.
  const posts = await prisma.post.findMany({
    where: {
      id: {
        in: postIds,
      },
    },
    select: PopularPostSelect,
  });

  // findMany는 요청한 ID 순서를 보장하지 않으므로 Map으로 재배열을 준비합니다.
  const postMap = new Map(posts.map((post) => [post.id, post]));

  return rankingItems
    .map((item, index) => {
      const postId = Number(item.value);
      const post = postMap.get(postId);

      // DB에서 삭제된 게시글의 오래된 Redis member는 응답에서 제외합니다.
      if (!post) {
        return null;
      }

      return toPopularPostOutput(post, item.score, index + 1);
    })
    .filter((post): post is PopularPostOutput => post !== null);
}
```

인기 게시글 조회에서는 다음 코드가 핵심입니다.  

```typescript
const rankingItems = await redis.zRangeWithScores(key, 0, limit - 1, {
  REV: true,
});
```

`REV: true`를 사용하면 score가 높은 순서로 조회합니다.  

`isValidLimit`은 limit이 양의 정수인지 확인합니다.  
limit이 0이면 `limit - 1`이 -1이 되어 전체 범위를 조회할 수 있으므로 미리 빈 배열을 반환합니다.  

Redis에는 게시글 ID와 score만 저장되어 있으므로 게시글 상세 정보는 DB에서 다시 조회합니다.  

이 구조는 실무에서도 자주 사용하는 방식입니다.  

```text
Redis → 빠른 랭킹 인덱스
DB    → 원본 게시글 데이터
```

## 2. 인기 검색어 순위 만들기 {#session-02}

![검색어 정규화와 점수 누적을 거쳐 인기 검색어 순위를 만드는 흐름](/assets/images/nodejs/nodejs-redis/redis-sorted-set-search-ranking-flow.png)

인기 검색어 기능도 Sorted Set으로 구현하기 좋습니다.  
검색어가 입력될 때마다 해당 검색어의 score를 증가시키면 됩니다.  

```text
key    → zset:search-ranking
member → 검색어
score  → 검색 횟수
```

예를 들어 사용자가 다음과 같이 검색했다고 가정합니다.  

```text
redis
redis
postgresql
redis
nodejs
```

Redis에는 다음과 같이 저장됩니다.  

```text
zset:search-ranking

member: "redis", score: 3
member: "postgresql", score: 1
member: "nodejs", score: 1
```

키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.zset.searchRanking();
// zset:search-ranking
```

### 🟦 키워드 점수 증가

```typescript
// src/ch09/search-zset.service.ts

/**
 * 검색어를 집계에 사용할 형식으로 정규화합니다.
 *
 * 1. 검색어 앞뒤의 공백을 제거합니다.
 * 2. 모든 문자를 소문자로 변환합니다.
 *
 * "Redis", "redis", " redis "처럼 표현만 다른 검색어가
 * 하나의 member로 집계되도록 합니다.
 */
private normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

/**
 * 검색된 키워드의 누적 점수를 증가시킵니다.
 *
 * 1. 검색어를 정규화하고 빈 값인지 확인합니다.
 * 2. 정규화한 검색어를 Sorted Set의 member로 사용합니다.
 * 3. ZINCRBY로 score를 지정한 값만큼 증가시킵니다.
 *
 * ZINCRBY는 member가 없으면 새로 추가하고,
 * 있으면 기존 score에 값을 더합니다.
 */
async increaseSearchKeywordScore(keyword: string, score = 1): Promise<number> {
  // 잘못된 score가 Redis에 전달되기 전에 입력 단계에서 거부합니다.
  assertFiniteScore(score, '검색어 랭킹 점수');

  const normalizedKeyword = this.normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    throw new Error('검색어가 비어 있습니다.');
  }

  const key = RedisKey.zset.searchRanking();

  // 검색어가 없으면 추가하고, 있으면 점수를 누적한 뒤 최종 점수를 반환합니다.
  return redis.zIncrBy(key, score, normalizedKeyword);
}
```

검색어 랭킹에서 가장 중요한 부분은 정규화입니다.  

```typescript
private normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}
```

정규화하지 않으면 다음 검색어가 모두 다른 member로 저장됩니다.  

```text
"Redis"
"redis"
" redis "
"REDIS"
```

정규화한 후에는 모두 `"redis"`로 저장됩니다.  

검색어 점수 증가는 다음 코드로 처리합니다.  

```typescript
return redis.zIncrBy(key, score, normalizedKeyword);
```

검색어가 들어올 때마다 score가 증가합니다.  

```text
검색어: redis

1회 검색 → score 1
2회 검색 → score 2
3회 검색 → score 3
```

### 🟦 인기 검색어 TOP N 조회

점수를 누적한 후에는 `getPopularKeywords`로 인기 검색어를 높은 점수순으로 조회합니다.  

```typescript
/**
 * 누적 점수가 높은 인기 검색어를 지정한 개수만큼 조회합니다.
 *
 * 1. ZRANGE의 REV 옵션으로 score가 높은 member부터 조회합니다.
 * 2. 조회한 검색어와 score를 응답 데이터로 변환합니다.
 * 3. 배열 index에 1을 더해 사용자에게 표시할 순위를 계산합니다.
 */
async getPopularKeywords(limit = 10): Promise<PopularKeywordOutput[]> {
  // limit 0을 ZRANGE의 전체 범위인 0, -1로 잘못 변환하지 않도록 검사합니다.
  if (!isValidLimit(limit)) {
    return [];
  }

  const key = RedisKey.zset.searchRanking();

  // REV 옵션으로 점수가 높은 순서의 지정 범위를 조회합니다.
  const items = await redis.zRangeWithScores(key, 0, limit - 1, {
    REV: true,
  });

  return items.map((item, index) => ({
    keyword: item.value,
    score: item.score,
    rank: index + 1,
  }));
}
```

Redis가 반환하는 배열의 index는 0부터 시작합니다.  
화면에 표시할 순위는 1위부터 시작하므로 `index + 1`을 사용합니다.  

## 3. 사용자 포인트 랭킹 만들기 {#session-03}

![DB 포인트를 Redis 사용자 랭킹에 반영하고 임시 키로 안전하게 복구하는 흐름](/assets/images/nodejs/nodejs-redis/redis-sorted-set-user-ranking-sync-flow.png)

커뮤니티, 학습 서비스와 리워드 서비스에서는 사용자 포인트 랭킹이 자주 필요합니다.  
예를 들어 다음 행위에 따라 포인트를 줄 수 있습니다.  

```text
- 게시글 작성 +10점
- 댓글 작성 +3점
- 좋아요 받음 +1점
- 출석 체크 +5점
```

사용자 포인트 랭킹은 Sorted Set으로 구현하기 좋습니다.  

```text
key    → zset:user-point-ranking
member → userId
score  → 포인트
```

다만 포인트는 정확성이 중요한 데이터입니다.  
따라서 이번 실습에서는 DB의 `User.point`를 원본 데이터로 두고 Redis Sorted Set은 랭킹 조회용 인덱스로 사용합니다.  

키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.zset.userPointRanking();
// zset:user-point-ranking
```

### 🟦 사용자 포인트 저장

```typescript
// src/ch09/user-zset.service.ts

/**
 * 사용자의 현재 포인트를 Redis 랭킹 점수로 저장합니다.
 *
 * 1. userId를 문자열로 변환해 Sorted Set의 member로 사용합니다.
 * 2. 현재 point를 member의 score로 저장합니다.
 * 3. 같은 member가 이미 있으면 최신 score로 갱신합니다.
 *
 * ZADD를 사용하면 신규 사용자의 랭킹 등록과
 * 기존 사용자의 점수 갱신을 같은 흐름으로 처리할 수 있습니다.
 */
async setUserPointRankingScore(userId: number, point: number): Promise<void> {
  // Redis에 기록하기 전에 NaN과 Infinity를 차단합니다.
  assertFiniteScore(point, '사용자 랭킹 점수');

  const key = RedisKey.zset.userPointRanking();

  // ZADD key score member
  // member가 없으면 추가하고, 이미 있으면 전달한 값으로 score를 갱신합니다.
  await redis.zAdd(key, {
    value: String(userId),
    score: point,
  });
}

/**
 * DB의 사용자 포인트를 증가시키고 Redis 랭킹에 반영합니다.
 *
 * 1. DB의 User.point를 증가시킵니다.
 * 2. 증가된 최신 point 값을 Redis Sorted Set에 반영합니다.
 *
 * 포인트의 원본은 DB이며,
 * Redis는 빠른 랭킹 조회를 위한 보조 인덱스로 사용합니다.
 */
async increaseUserPoint(userId: number, point: number) {
  // 잘못된 값으로 DB와 Redis 갱신을 시작하지 않도록 가장 먼저 검증합니다.
  assertFiniteScore(point, '증가할 사용자 포인트');

  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      point: {
        increment: point,
      },
    },
    select: UserRankingSelect,
  });

  // DB가 반환한 최신 point를 Redis 랭킹에 저장합니다.
  await this.setUserPointRankingScore(user.id, user.point);

  return user;
}
```

`ZADD`는 같은 member가 이미 있으면 새로 추가하지 않고 score를 갱신합니다.  

```text
초기:
member "1", score 10

ZADD member "1", score 30

결과:
member "1", score 30
```

이 구조는 다음과 같이 역할이 명확하게 나뉩니다.  

```text
DB User.point
→ 원본 포인트 데이터

Redis zset:user-point-ranking
→ 빠른 랭킹 조회용 인덱스
```

### 🟦 사용자 포인트 TOP N 조회

사용자 포인트 랭킹도 인기 게시글과 마찬가지로 Redis의 정렬 결과를 기준으로 DB 상세 정보를 결합합니다.  

```typescript
/**
 * 포인트가 높은 사용자 TOP N을 상세 정보와 함께 조회합니다.
 *
 * 1. Redis에서 score가 높은 순서로 사용자 ID와 점수를 조회합니다.
 * 2. 사용자 ID에 해당하는 상세 정보를 DB에서 가져옵니다.
 * 3. Redis의 랭킹 순서를 유지해 사용자 정보, 점수와 순위를 반환합니다.
 */
async getTopUserPointRanking(limit = 10): Promise<UserRankingOutput[]> {
  // limit이 양의 정수가 아니면 Redis를 조회하지 않습니다.
  if (!isValidLimit(limit)) {
    return [];
  }

  const key = RedisKey.zset.userPointRanking();
  const rankingItems = await redis.zRangeWithScores(key, 0, limit - 1, {
    REV: true,
  });

  if (rankingItems.length === 0) {
    return [];
  }

  // Redis 문자열 member를 Prisma Int ID로 조회할 수 있도록 변환합니다.
  const userIds = rankingItems.map((item) => Number(item.value));

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: UserRankingSelect,
  });

  // DB 조회 순서와 관계없이 Redis 랭킹 순서로 결과를 조립합니다.
  const userMap = new Map(users.map((user) => [user.id, user]));

  return rankingItems
    .map((item, index) => {
      const userId = Number(item.value);
      const user = userMap.get(userId);

      // DB에서 삭제된 사용자의 오래된 Redis member는 제외합니다.
      if (!user) {
        return null;
      }

      return toUserRankingOutput(user, item.score, index + 1);
    })
    .filter((user): user is UserRankingOutput => user !== null);
}
```

Prisma의 `findMany`는 Redis에서 전달한 ID 순서를 그대로 보장하지 않습니다.  
따라서 사용자 정보를 ID 기반 Map으로 만든 뒤 Redis 랭킹 순서에 맞춰 결과를 다시 조립합니다.  

### 🟦 DB 기준 랭킹 복구

Redis는 메모리를 중심으로 사용하는 저장소이므로 운영 방식에 따라 데이터가 유실될 수 있습니다.  
또한 캐시나 랭킹 인덱스는 언제든 DB를 기준으로 다시 만들 수 있어야 합니다.  

```typescript
// 파일 상단에서 임시 키에 사용할 UUID 생성 함수를 가져옵니다.
import { randomUUID } from 'node:crypto';

/**
 * DB의 현재 포인트를 기준으로 Redis 사용자 랭킹을 재구성합니다.
 *
 * 1. DB에서 모든 사용자의 id와 point를 조회합니다.
 * 2. 임시 Redis Sorted Set에 DB point 기준 랭킹을 구성합니다.
 * 3. 완성된 임시 키를 기존 랭킹 키로 원자적으로 교체합니다.
 *
 * Redis 랭킹이 유실되거나 오래되었을 때 DB를 기준으로 복구할 수 있습니다.
 */
async syncUserPointRankingFromDatabase(): Promise<void> {
  const key = RedisKey.zset.userPointRanking();
  // 동시에 실행된 동기화 작업이 같은 임시 키를 공유하지 않도록 UUID를 붙입니다.
  const temporaryKey = `${key}:sync:${randomUUID()}`;

  // Redis 랭킹을 복구할 기준 데이터인 모든 사용자 ID와 포인트를 조회합니다.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      point: true,
    },
  });

  if (users.length === 0) {
    // DB가 비어 있으면 기존 랭킹도 삭제해 두 저장소의 상태를 맞춥니다.
    await redis.del(key);
    return;
  }

  try {
    // 기존 랭킹은 유지한 채 임시 Sorted Set을 먼저 완성합니다.
    await redis.zAdd(
      temporaryKey,
      users.map((user) => ({
        value: String(user.id),
        score: user.point,
      })),
    );

    // RENAME으로 완성된 임시 키를 기존 키와 한 번에 교체합니다.
    await redis.rename(temporaryKey, key);
  } catch (error) {
    // 실패하면 남아 있을 수 있는 임시 키를 정리하고 원래 오류를 다시 전달합니다.
    await redis.del(temporaryKey);
    throw error;
  }
}
```

이 메서드는 기존 랭킹을 먼저 삭제하지 않고 임시 키에 새 랭킹을 완성합니다.  
이후 `RENAME`으로 키를 교체하므로 동기화 중에 빈 랭킹이 노출되는 시간을 없앨 수 있습니다.  

```text
Redis 랭킹 유실
→ DB에서 user point 조회
→ 임시 Redis Sorted Set 생성
→ RENAME으로 기존 랭킹 교체
→ 랭킹 기능 복구
```

## 4. 우선순위 큐 구현하기 {#session-04}

![MULTI와 EXEC로 작업을 저장하고 ZPOPMIN으로 우선순위 작업을 처리하는 흐름](/assets/images/nodejs/nodejs-redis/redis-sorted-set-priority-queue-flow.png)

Sorted Set은 우선순위 큐로도 사용할 수 있습니다.  
작업 ID를 member로 저장하고 우선순위를 score로 저장합니다.  

```text
key    → zset:priority-queue
member → jobId
score  → priority
```

예를 들어 score가 낮을수록 먼저 처리한다고 정하면 다음과 같습니다.  

```text
member: "job:email:1", score: 10
member: "job:payment:1", score: 1
member: "job:report:1", score: 50
```

처리 순서는 다음과 같습니다.  

```text
1. job:payment:1
2. job:email:1
3. job:report:1
```

키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.zset.priorityQueue();
// zset:priority-queue
```

### 🟦 작업을 우선순위 큐에 추가

```typescript
// src/ch09/priority-queue.service.ts

/**
 * 작업을 우선순위 큐에 추가하고 선택적인 payload를 별도로 저장합니다.
 *
 * 1. jobId를 Sorted Set의 member로 사용합니다.
 * 2. priority를 score로 저장하며 낮은 값일수록 먼저 처리합니다.
 * 3. payload가 있으면 JSON 문자열로 변환해 1시간 동안 별도 키에 저장합니다.
 *
 * Sorted Set은 score 기준 정렬을 제공하므로
 * 우선순위 큐를 간단하게 만들 수 있습니다.
 */
async addJob(input: PriorityJobInput): Promise<void> {
  // Redis 명령을 실행하기 전에 유효하지 않은 우선순위를 차단합니다.
  assertFiniteScore(input.priority, '작업 우선순위');

  const key = RedisKey.zset.priorityQueue();
  const payloadKey = this.getPayloadKey(input.jobId);

  // 큐 member와 payload가 서로 다른 상태로 남지 않도록 Transaction을 시작합니다.
  const transaction = redis.multi().zAdd(key, {
    value: input.jobId,
    score: input.priority,
  });

  if (input.payload !== undefined) {
    // payload를 JSON으로 저장하고 1시간 뒤 자동 만료되도록 설정합니다.
    transaction.set(payloadKey, JSON.stringify(input.payload), {
      EX: 60 * 60,
    });
  } else {
    // 같은 jobId를 payload 없이 다시 등록하면 과거 payload를 삭제합니다.
    transaction.del(payloadKey);
  }

  // 큐 등록과 payload 처리를 MULTI/EXEC로 함께 실행합니다.
  await transaction.exec();
}
```

우선순위 큐에 작업을 추가할 때는 `ZADD`를 사용합니다.  
실습 소스는 큐 등록과 payload 처리를 `MULTI/EXEC` 트랜잭션으로 묶어 중간 상태가 노출되지 않게 합니다.  

```typescript
const transaction = redis.multi().zAdd(key, {
  value: input.jobId,
  score: input.priority,
});

// payload 저장 또는 삭제 명령을 추가한 뒤 한 번에 실행합니다.
await transaction.exec();
```

여기서는 score가 낮을수록 먼저 처리한다고 정했습니다.  

```text
job:payment:1 → priority 1
job:email:1   → priority 10
job:report:1  → priority 50
```

### 🟦 payload를 별도 키로 저장하는 이유

Sorted Set의 member에는 보통 단순한 문자열을 저장하는 것이 좋습니다.  
예를 들어 다음과 같이 작업 ID만 저장합니다.  

```text
member → job:email:1
score  → 10
```

작업 payload 전체를 member에 JSON 문자열로 넣을 수도 있지만 권장하지 않습니다.  

```text
비추천:
member → {"type":"email","to":"test@example.com","title":"hello"}
score  → 10
```

이렇게 하면 다음 문제가 생깁니다.  

```text
1. member가 너무 길어집니다.
2. 같은 작업인지 비교하기 어렵습니다.
3. payload를 수정하기 어렵습니다.
4. 랭킹 또는 큐 구조와 데이터 본문이 섞입니다.
```

따라서 이번 실습에서는 Sorted Set에 jobId만 저장하고 payload는 별도 String 키에 저장합니다.  
같은 jobId를 payload 없이 다시 등록하면 이전 payload가 남지 않도록 해당 키를 삭제합니다.  

```typescript
if (input.payload !== undefined) {
  transaction.set(payloadKey, JSON.stringify(input.payload), {
    EX: 60 * 60,
  });
} else {
  transaction.del(payloadKey);
}
```

저장 구조는 다음과 같습니다.  

```text
zset:priority-queue
  member: "job:email:1", score: 10

zset:priority-queue:payload:job:email:1
  value: {"type":"email","to":"test@example.com"}
```

작업을 꺼낸 뒤에는 `getJobPayload`로 payload를 조회합니다.  
작업 처리가 끝나면 `completeJob`을 호출해 별도 payload 키를 정리합니다.  

```typescript
async getJobPayload<T>(jobId: string): Promise<T | null> {
  const payload = await redis.get(this.getPayloadKey(jobId));

  if (!payload) {
    return null;
  }

  // 제네릭 T는 컴파일 시점의 타입이며 실제 JSON 구조를 검증하지는 않습니다.
  return JSON.parse(payload) as T;
}

async completeJob(jobId: string): Promise<void> {
  await redis.del(this.getPayloadKey(jobId));
}
```

### 🟦 다음 작업 조회

```typescript
/**
 * 큐에서 가장 우선순위가 높은 작업을 조회한 뒤 제거합니다.
 *
 * 1. score가 가장 낮은 작업 1개를 조회합니다.
 * 2. 조회와 제거를 원자적으로 실행합니다.
 * 3. 큐가 비어 있으면 null을 반환합니다.
 *
 * ZPOPMIN을 사용하면 여러 worker가 동시에 접근해도
 * 각 작업을 한 번만 꺼낼 수 있습니다.
 */
async popNextJob(): Promise<PriorityJobOutput | null> {
  const key = RedisKey.zset.priorityQueue();

  // 가장 낮은 점수의 작업을 조회하고 제거하는 과정을 원자적으로 수행합니다.
  const job = await redis.zPopMin(key);

  if (job === null) {
    return null;
  }

  return {
    jobId: job.value,
    priority: job.score,
  };
}
```

다음 작업을 꺼낼 때는 score가 가장 낮은 작업을 조회와 동시에 제거합니다.  

```text
1. ZPOPMIN으로 가장 낮은 score의 작업 선택
2. 같은 명령 안에서 해당 작업 제거
3. 제거한 작업 반환
```

### 🟦 동시 처리에서 ZPOPMIN이 필요한 이유

`ZRANGE`로 조회한 뒤 `ZREM`으로 제거하면 두 명령 사이에 다른 worker가 같은 작업을 조회할 수 있습니다.  

```text
Worker A가 같은 작업 조회
Worker B가 같은 작업 조회
Worker A가 제거 성공
Worker B는 제거 실패
```

예시 소스의 `ZPOPMIN`은 조회와 제거를 하나의 원자적 명령으로 처리합니다.  
따라서 여러 worker가 동시에 접근해도 같은 작업을 중복으로 꺼내는 문제를 방지할 수 있습니다.  
