---
layout: post
title: "07. Redis List 실습: 최근 기록과 간단한 버퍼 처리"
description: "Redis List를 활용해 최근 본 게시글과 검색어를 관리하고, 간단한 작업 큐와 로그 버퍼를 구현하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 07
ai_assisted: true
toc:
  - id: session-01
    title: "1. 최근 본 게시글 목록 만들기"
  - id: session-02
    title: "2. 최근 검색어 저장하기"
  - id: session-03
    title: "3. 간단한 작업 큐 구현하기"
  - id: session-04
    title: "4. 로그 버퍼 만들기"
---

Redis List는 순서가 있는 문자열 목록을 저장하는 자료구조입니다.  
List의 왼쪽과 오른쪽 양쪽에서 데이터를 넣고 뺄 수 있습니다.  

```text
왼쪽 <---- Redis List ----> 오른쪽

LPUSH                    RPUSH
LPOP                     RPOP
```

Redis List는 다음과 같은 기능에 활용할 수 있습니다.  

- 최근 본 게시글
- 최근 검색어
- 간단한 작업 큐
- 최근 로그 버퍼

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/redis-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 최근 본 게시글 목록 만들기 {#session-01}

최근 본 게시글은 Redis List를 사용하기 좋은 대표적인 예입니다.  
사용자가 게시글을 볼 때마다 게시글 ID를 List의 앞쪽에 추가하면 됩니다.  

![최근 본 게시글의 중복 제거, 최신순 저장과 DB 상세 조회 흐름](/assets/images/nodejs/nodejs-redis/redis-list-recent-posts-flow-labeled.png)

그림의 흐름은 다음과 같습니다.  

1. 사용자가 게시글을 조회하면 기록할 게시글 ID를 준비합니다.
2. `LREM`으로 같은 게시글 ID를 모두 제거해 중복을 없앱니다.
3. `LPUSH`로 방금 조회한 게시글 ID를 List 맨 앞에 추가합니다.
4. `LTRIM`으로 앞에서부터 최근 N개의 ID만 유지합니다.
5. 목록을 보여 줄 때는 Redis의 ID 순서에 맞춰 DB 게시글 정보를 다시 배치합니다.

```text
사용자 1번이 게시글을 조회

LPUSH list:user:1:recent-posts 10
LPUSH list:user:1:recent-posts 15
LPUSH list:user:1:recent-posts 20

결과:
[20, 15, 10]
```

최근 본 게시글 목록에서는 보통 다음 조건이 필요합니다.  

1. 최신 게시글이 앞에 와야 합니다.
2. 같은 게시글이 중복으로 쌓이면 안 됩니다.
3. 최근 N개까지만 유지해야 합니다.
4. 실제 게시글 정보는 DB에서 조회해야 합니다.

Redis List는 순서를 유지할 수 있고, `LTRIM`으로 최대 개수를 제한할 수 있기 때문에 이 요구사항에 잘 맞습니다.  

최근 본 게시글 List 키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.list.postRecentViews(userId);
```

실제 키는 다음과 같습니다.  

```text
list:user:1:recent-posts
list:user:2:recent-posts
```

### 🟦 최근 본 게시글 추가

```typescript
// 중복 제거부터 개수 제한까지 하나의 Transaction으로 실행합니다.
await redis
  .multi()
  .lRem(key, 0, value)
  .lPush(key, value)
  .lTrim(key, 0, limit - 1)
  .exec();
```

`MULTI/EXEC`으로 세 명령을 묶으면 다른 요청의 명령이 그 사이에 끼어들지 않습니다.  
따라서 같은 게시글을 동시에 기록하더라도 중복 제거, 최신 위치 추가, 개수 제한을 한 작업처럼 처리할 수 있습니다.  

```typescript
// src/ch07/post-list.service.ts

/**
 * 사용자가 최근 본 게시글을 Redis List에 기록합니다.
 *
 * 1. 사용자별 최근 본 게시글 List key를 만듭니다.
 * 2. 같은 게시글 ID가 이미 있으면 먼저 제거해서 중복을 방지합니다.
 * 3. 새로 본 게시글 ID를 List 앞쪽에 넣어 최신순을 유지합니다.
 * 4. 지정한 개수만 남기고 오래된 기록은 잘라냅니다.
 *
 * 실습 포인트:
 * Redis List는 입력 순서를 유지하므로 최근 본 글, 최근 검색어처럼 순서가 중요한 기록에 적합합니다.
 *
 * 참고:
 * 게시글 상세 데이터 전체를 Redis에 저장하지 않고 ID만 저장하면 캐시 무효화 부담을 줄일 수 있습니다.
 * LREM, LPUSH, LTRIM은 MULTI/EXEC으로 묶어 중복 제거부터 개수 제한까지 연속 실행합니다.
 */
async addRecentViewedPost(userId: number, postId: number, limit = 10): Promise<void> {
  const key = RedisKey.list.postRecentViews(userId);
  const value = String(postId);

  // 중복 제거, 최신 위치 추가, 개수 제한을 하나의 Transaction으로 실행합니다.
  // 다른 요청이 세 명령 사이에 끼어들 수 없으므로 동일 게시글의 중복과 순서 변경을 방지합니다.
  await redis
    .multi()
    .lRem(key, 0, value)
    .lPush(key, value)
    .lTrim(key, 0, limit - 1)
    .exec();
}
```

### 🟦 최근 본 게시글 ID 목록 조회

```typescript
// src/ch07/post-list.service.ts

/**
 * Redis List에서 최근 본 게시글 ID 목록을 조회합니다.
 *
 * 1. 사용자별 최근 본 게시글 List key를 만듭니다.
 * 2. Redis List의 앞쪽부터 limit개만 읽습니다.
 * 3. Redis에 문자열로 저장된 게시글 ID를 number로 변환합니다.
 *
 * 실습 포인트:
 * LRANGE는 List의 일부 구간을 조회할 때 사용합니다.
 */
async getRecentViewedPostIds(userId: number, limit = 10): Promise<number[]> {
  const key = RedisKey.list.postRecentViews(userId);

  // 사용자의 최근 본 게시글 목록에서 필요한 범위의 항목을 조회합니다.
  // 지정한 범위의 값을 순서대로 반환하며, 저장된 항목이 없으면 빈 배열을 반환합니다.
  const values = await redis.lRange(key, 0, limit - 1);

  return values.map(Number);
}
```

### 🟦 최근 본 게시글 상세 정보 조회

Redis List에는 게시글 ID만 저장하므로 실제 게시글 정보는 DB에서 조회합니다.  
Prisma의 `findMany`에 사용한 `in` 조건은 Redis List의 순서를 보장하지 않습니다.  
따라서 조회 결과를 `Map`으로 만든 뒤 Redis에 저장된 ID 순서대로 다시 배치합니다.  

`RecentPostSelect`는 조회할 DB 필드를 정의하고, `toRecentPostOutput`은 날짜를 ISO 문자열로 변환하는 이 파일의 보조 함수입니다.  

```typescript
/**
 * 최근 본 게시글 ID 목록을 기준으로 DB에서 상세 정보를 조회합니다.
 *
 * 1. Redis List에서 최근 본 게시글 ID 목록을 가져옵니다.
 * 2. DB에서 해당 ID에 해당하는 게시글들을 조회합니다.
 * 3. DB 조회 결과를 Map으로 바꿔 ID로 빠르게 찾을 수 있게 합니다.
 * 4. Redis List의 순서대로 게시글을 다시 배치해 최신순 응답을 만듭니다.
 *
 * 실습 포인트:
 * Redis는 최근 본 순서를 기억하는 보조 저장소로 사용하고, 게시글 원본은 DB를 기준으로 조회합니다.
 *
 * 참고:
 * findMany의 in 조건은 Redis List 순서를 보장하지 않으므로, 조회 후 postIds 순서대로 다시 정렬합니다.
 */
async getRecentViewedPosts(userId: number, limit = 10): Promise<RecentPostOutput[]> {
  const postIds = await this.getRecentViewedPostIds(userId, limit);

  if (postIds.length === 0) {
    return [];
  }

  const posts = await prisma.post.findMany({
    where: {
      id: {
        in: postIds,
      },
    },
    select: RecentPostSelect,
  });

  const postMap = new Map(posts.map((post) => [post.id, post]));

  // Redis에 남아 있지만 DB에서 삭제된 게시글은 제외하고 응답 형태로 변환합니다.
  return postIds
    .map((postId) => postMap.get(postId))
    .filter((post): post is NonNullable<typeof post> => post !== undefined)
    .map(toRecentPostOutput);
}
```

## 2. 최근 검색어 저장하기 {#session-02}

요구사항은 최근 본 게시글과 비슷합니다.  

1. 최신 검색어가 앞에 와야 합니다.
2. 같은 검색어는 중복 저장하지 않습니다.
3. 사용자별로 최근 N개까지만 유지합니다.
4. 검색어 삭제 기능을 제공할 수 있습니다.

![최근 검색어의 정규화, 중복 제거, 최신순 저장과 삭제 흐름](/assets/images/nodejs/nodejs-redis/redis-list-recent-searches-flow-labeled.png)

그림의 흐름은 다음과 같습니다.  

1. 사용자가 입력한 검색어를 받습니다.
2. `trim()`으로 검색어 앞뒤의 불필요한 공백을 제거합니다.
3. `LREM`으로 기존의 같은 검색어를 제거합니다.
4. `LPUSH`로 새 검색어를 List 맨 앞에 추가합니다.
5. `LTRIM`으로 최근 N개의 검색어만 유지합니다.

특정 검색어를 선택해 삭제할 때는 `LREM`만 별도로 실행합니다.  

최근 검색어 List 키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.list.searchRecent(userId);
```

실제 키는 다음과 같습니다.  

```text
list:user:1:recent-searches
list:user:2:recent-searches
```

### 🟦 최근 검색어를 Redis List에 기록

```typescript
// 중복 제거부터 개수 제한까지 하나의 Transaction으로 실행합니다.
await redis
  .multi()
  .lRem(key, 0, normalizedKeyword)
  .lPush(key, normalizedKeyword)
  .lTrim(key, 0, limit - 1)
  .exec();
```

이렇게 하면 같은 검색어를 다시 검색했을 때 중복 저장하지 않고 맨 앞으로 이동시킬 수 있습니다.  
세 명령을 `MULTI/EXEC`으로 묶기 때문에 동시에 같은 검색어가 들어와도 명령 묶음이 서로 끼어들지 않습니다.  
`normalizeKeyword`는 같은 파일에 정의된 보조 함수이며, `trim()`으로 검색어 앞뒤 공백을 제거합니다.  

```typescript
// src/ch07/search-list.service.ts

/**
 * 사용자의 최근 검색어를 Redis List에 기록합니다.
 *
 * 1. 검색어 앞뒤 공백을 제거합니다.
 * 2. 빈 검색어는 저장하지 않습니다.
 * 3. 같은 검색어가 이미 있으면 먼저 제거해서 중복을 방지합니다.
 * 4. 새 검색어를 List 앞쪽에 넣어 최신순을 유지합니다.
 * 5. 지정한 개수만 남기고 오래된 검색어는 잘라냅니다.
 *
 * 실습 포인트:
 * Redis List는 입력 순서를 유지하므로 최근 검색어처럼 순서가 중요한 기록에 적합합니다.
 *
 * 참고:
 * 같은 검색어를 다시 검색하면 기존 위치의 값을 제거한 뒤 맨 앞으로 옮기는 방식으로 최신 기록을 갱신합니다.
 * LREM, LPUSH, LTRIM은 MULTI/EXEC으로 묶어 동시 요청에도 하나의 작업처럼 실행합니다.
 */
async addRecentSearchKeyword(userId: number, keyword: string, limit = 10): Promise<void> {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return;
  }

  const key = RedisKey.list.searchRecent(userId);

  // 중복 제거, 최신 위치 추가, 개수 제한을 하나의 Transaction으로 실행합니다.
  // 다른 요청이 세 명령 사이에 끼어들 수 없으므로 동일 검색어의 중복과 순서 변경을 방지합니다.
  await redis
    .multi()
    .lRem(key, 0, normalizedKeyword)
    .lPush(key, normalizedKeyword)
    .lTrim(key, 0, limit - 1)
    .exec();
}
```

### 🟦 최근 검색어 목록을 최신순으로 조회

```typescript
// src/ch07/search-list.service.ts

/**
 * Redis List에서 최근 검색어 목록을 최신순으로 조회합니다.
 *
 * 1. 사용자별 최근 검색어 List key를 만듭니다.
 * 2. Redis List의 앞쪽부터 limit개만 읽습니다.
 * 3. 조회한 문자열 목록을 응답 객체 배열로 변환합니다.
 *
 * 실습 포인트:
 * LRANGE는 List의 일부 구간을 조회할 때 사용합니다.
 *
 * 참고:
 * Redis List가 이미 순서를 보장하므로 order 같은 별도 순번 필드는 만들지 않습니다.
 */
async getRecentSearchKeywords(userId: number, limit = 10): Promise<RecentSearchKeywordOutput[]> {
  const key = RedisKey.list.searchRecent(userId);

  // 사용자의 최근 검색어 목록에서 필요한 범위의 항목을 조회합니다.
  // 지정한 범위의 값을 순서대로 반환하며, 저장된 항목이 없으면 빈 배열을 반환합니다.
  const keywords = await redis.lRange(key, 0, limit - 1);

  return keywords.map((keyword) => ({
    keyword,
  }));
}
```

### 🟦 최근 검색어 삭제

특정 검색어를 삭제할 때도 저장할 때와 마찬가지로 앞뒤 공백을 먼저 제거합니다.  
빈 문자열이면 Redis 명령을 실행하지 않고, 값이 있으면 `LREM`의 `count`를 `0`으로 지정해 일치하는 값을 모두 제거합니다.  

```typescript
// src/ch07/search-list.service.ts

/**
 * 사용자의 최근 검색어 목록에서 특정 검색어를 삭제합니다.
 *
 * 1. 검색어 앞뒤 공백을 제거합니다.
 * 2. 빈 검색어이면 Redis 명령을 실행하지 않습니다.
 * 3. 사용자별 최근 검색어 List에서 해당 검색어를 제거합니다.
 *
 * 실습 포인트:
 * LREM은 List에 들어 있는 특정 값을 삭제할 때 사용합니다.
 */
async deleteRecentSearchKeyword(userId: number, keyword: string): Promise<void> {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return;
  }

  const key = RedisKey.list.searchRecent(userId);

  // 사용자의 최근 검색어 목록에서 중복되거나 삭제할 항목을 제거합니다.
  // 조건에 맞는 값을 제거하고 제거한 항목 수를 반환하며, 일치하는 값이 없으면 0을 반환합니다.
  await redis.lRem(key, 0, normalizedKeyword);
}
```

## 3. 간단한 작업 큐 구현하기 {#session-03}

Redis List는 간단한 Queue 용도로도 사용할 수 있습니다.  
예를 들어 다음과 같은 작업을 임시로 쌓아둘 수 있습니다.  

- 이메일 발송 작업
- 알림 발송 작업
- 이미지 리사이즈 요청
- 간단한 비동기 처리 요청

![Redis List에 작업을 넣고 오래된 작업부터 꺼내는 FIFO 큐 흐름](/assets/images/nodejs/nodejs-redis/redis-list-job-queue-flow-labeled.png)

그림의 흐름은 다음과 같습니다.  

1. Producer가 이메일, 알림, 이미지 처리 같은 작업을 만듭니다.
2. `LPUSH`가 새 작업을 Redis List의 왼쪽에 추가합니다.
3. 새 작업이 들어올수록 먼저 들어온 작업은 List 오른쪽으로 이동합니다.
4. `RPOP`이 오른쪽 끝의 가장 오래된 작업을 꺼냅니다.
5. Consumer가 꺼낸 작업을 실제로 처리합니다.

따라서 먼저 들어온 작업을 먼저 처리하는 FIFO 흐름이 만들어집니다.  

List를 Queue처럼 사용할 때는 보통 한쪽에서 넣고 반대쪽에서 꺼냅니다.  

```text
Producer
  ↓ LPUSH
Redis List
  ↓ RPOP
Consumer
```

즉, `LPUSH`로 작업을 넣고 `RPOP`으로 오래된 작업부터 꺼내면 FIFO Queue처럼 동작합니다.  

다만 실무에서 안정적인 작업 큐가 필요하다면 Redis List만으로는 부족할 수 있습니다.  
재시도, 실패 처리, 처리 중 상태 추적이 필요하다면 Redis Stream 또는 BullMQ를 사용하는 것이 더 적합합니다.  

작업 큐 List 키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.list.simpleJobQueue();
```

실제 키는 다음과 같습니다.  

```text
list:simple-job-queue
```

### 🟦 새 작업을 Redis List 큐에 추가

다음 코드는 큐 추가와 직접 관련된 메서드를 발췌한 것입니다.  
`createJobId`는 작업 ID를 만들고, `SimpleJob`은 Redis에 JSON 문자열로 저장할 작업의 타입을 정의합니다.  

```typescript
// src/ch07/job-list.service.ts

/**
 * 새 작업을 Redis List 큐에 추가합니다.
 *
 * 1. 작업 큐에 사용할 Redis key를 만듭니다.
 * 2. 작업 ID와 생성 시각을 포함한 SimpleJob 객체를 만듭니다.
 * 3. 작업 객체를 JSON 문자열로 변환합니다.
 * 4. Redis List 왼쪽에 작업을 넣습니다.
 *
 * 실습 포인트:
 * Redis List는 문자열 목록이므로 객체를 저장하려면 JSON.stringify()로 직렬화해야 합니다.
 *
 * 참고:
 * 이 서비스는 LPUSH로 왼쪽에 넣고 RPOP으로 오른쪽에서 꺼내 FIFO 큐처럼 사용합니다.
 */
async enqueueJob(input: EnqueueJobInput): Promise<SimpleJob> {
  const key = RedisKey.list.simpleJobQueue();

  const job: SimpleJob = {
    id: createJobId(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };

  // 비동기 작업 큐의 최신 위치에 새 항목을 추가합니다.
  // 목록 왼쪽에 값을 추가하고 추가 후 전체 항목 수를 반환합니다.
  await redis.lPush(key, JSON.stringify(job));

  return job;
}
```

Redis List는 문자열 목록입니다.  
따라서 객체 형태의 작업 데이터는 JSON 문자열로 변환해 저장합니다.  
저장되는 값은 다음과 비슷합니다.  

```json
{
  "id": "job_1780000000000_x1a2b3c4",
  "type": "SEND_EMAIL",
  "payload": {
    "email": "kim@example.com",
    "message": "회원가입을 환영합니다."
  },
  "createdAt": "2026-06-22T00:00:00.000Z"
}
```

### 🟦 큐에서 처리할 작업을 하나 꺼내기

`dequeueJob`은 List 오른쪽 끝의 가장 오래된 작업을 제거하면서 반환합니다.  
`parseSimpleJob`은 이 파일에 정의된 보조 함수로, JSON 파싱에 실패하면 `null`을 반환합니다.  

```typescript
// src/ch07/job-list.service.ts

/**
 * 큐에서 처리할 작업을 하나 꺼냅니다.
 *
 * 1. 작업 큐에 사용할 Redis key를 만듭니다.
 * 2. Redis List 오른쪽에서 작업 문자열을 하나 제거하면서 가져옵니다.
 * 3. 큐가 비어 있으면 null을 반환합니다.
 * 4. JSON 문자열을 SimpleJob 객체로 변환해 반환합니다.
 *
 * 실습 포인트:
 * LPUSH로 넣은 작업을 RPOP으로 꺼내면 먼저 들어온 작업이 오른쪽 끝에 있으므로 먼저 처리됩니다.
 *
 * 참고:
 * RPOP은 값을 조회만 하는 명령이 아니라 List에서 제거까지 함께 수행합니다.
 */
async dequeueJob(): Promise<SimpleJob | null> {
  const key = RedisKey.list.simpleJobQueue();

  // 비동기 작업 큐에서 가장 오래된 작업을 꺼냅니다.
  // 목록 오른쪽 끝 값을 제거해 반환하며, 대기 작업이 없으면 null을 반환합니다.
  const value = await redis.rPop(key);

  if (!value) {
    return null;
  }

  return parseSimpleJob(value);
}
```

## 4. 로그 버퍼 만들기 {#session-04}

로그 버퍼는 최근 로그 몇 개만 Redis에 보관하는 구조입니다.  

예를 들어 개발 환경이나 관리자 화면에서 최근 에러 로그와 최근 요청 로그를 빠르게 확인하고 싶을 때 사용할 수 있습니다.  

```text
최근 요청 로그 100개
최근 에러 로그 100개
최근 작업 처리 로그 100개
```

![Redis List에 최신 로그를 추가하고 오래된 로그를 제거하는 버퍼 흐름](/assets/images/nodejs/nodejs-redis/redis-list-log-buffer-flow-labeled.png)

그림의 흐름은 다음과 같습니다.  

1. 애플리케이션에서 발생한 로그를 JSON 문자열로 준비합니다.
2. `LPUSH`로 새 로그를 List 맨 앞에 추가합니다.
3. `LTRIM`으로 최근 N개만 남기고 범위를 벗어난 오래된 로그를 제거합니다.
4. `LRANGE`로 List를 변경하지 않고 최근 로그를 최신순으로 조회합니다.

ERROR 로그만 필요하면 `LRANGE`로 조회한 결과를 애플리케이션 코드에서 필터링합니다.  

Redis List와 `LTRIM`을 사용하면 최근 N개 로그만 유지하는 버퍼를 쉽게 만들 수 있습니다.  

```typescript
// 로그 추가와 개수 제한을 하나의 Transaction으로 실행합니다.
await redis
  .multi()
  .lPush(key, JSON.stringify(entry))
  .lTrim(key, 0, limit - 1)
  .exec();
```

예시 소스는 `LPUSH`와 `LTRIM`을 `MULTI/EXEC`으로 묶습니다.  
로그 추가와 개수 제한 사이에 다른 명령이 끼어들지 않으므로 제한을 초과한 중간 상태가 노출되지 않습니다.  

`LPUSH`는 새 로그를 List 앞쪽에 추가합니다.  

```text
새 로그 추가 전:
[log3, log2, log1]

새 로그 log4 추가:
[log4, log3, log2, log1]
```

`LTRIM`은 최근 N개만 남깁니다.  

```text
limit = 3

LTRIM 0 2 실행 후:
[log4, log3, log2]
```

따라서 오래된 로그는 자동으로 제거됩니다.  

다만 Redis List 로그 버퍼는 정식 로그 저장소를 대체하지 않습니다.  

운영 환경에서는 로그를 파일, Elasticsearch, OpenSearch 같은 별도 저장소로 보내는 것이 일반적입니다.  
Redis List 로그 버퍼는 최근 상태를 빠르게 확인하기 위한 보조 도구로 보는 것이 좋습니다.  

로그 버퍼 List 키는 RedisKey 유틸리티를 그대로 사용합니다.

```typescript
RedisKey.list.logBuffer();
```

실제 키는 다음과 같습니다.  

```text
list:log-buffer
```

### 🟦 새 로그를 Redis List 버퍼에 추가

```typescript
// src/ch07/log-list.service.ts

/**
 * 새 로그를 Redis List 버퍼에 추가합니다.
 *
 * 1. 로그 버퍼에 사용할 Redis key를 만듭니다.
 * 2. 로그 레벨, 메시지, context, 생성 시각을 포함한 로그 객체를 만듭니다.
 * 3. 로그 객체를 JSON 문자열로 변환합니다.
 * 4. Redis List 왼쪽에 로그를 넣어 최신 로그가 앞쪽에 오게 합니다.
 * 5. LTRIM으로 최근 limit개만 남기고 오래된 로그를 제거합니다.
 *
 * 실습 포인트:
 * Redis List는 최근 N개의 로그만 유지하는 버퍼로 활용할 수 있습니다.
 *
 * 참고:
 * 이 예제는 로그 원본 저장소가 아니라 최근 로그 확인용 짧은 버퍼를 Redis에 두는 방식입니다.
 * LPUSH와 LTRIM은 MULTI/EXEC으로 묶어 로그 추가와 개수 제한을 연속 실행합니다.
 */
async addLog(input: AddLogInput, limit = 100): Promise<LogBufferEntry> {
  const key = RedisKey.list.logBuffer();

  const entry: LogBufferEntry = {
    level: input.level,
    message: input.message,
    context: input.context,
    createdAt: new Date().toISOString(),
  };

  // 로그 추가와 개수 제한을 하나의 Transaction으로 실행합니다.
  // 다른 명령이 LPUSH와 LTRIM 사이에 끼어들지 않아 제한을 초과한 중간 상태가 노출되지 않습니다.
  await redis
    .multi()
    .lPush(key, JSON.stringify(entry))
    .lTrim(key, 0, limit - 1)
    .exec();

  return entry;
}
```

### 🟦 최근 로그 목록 조회

```typescript
// src/ch07/log-list.service.ts

/**
 * Redis List에서 최근 로그 목록을 최신순으로 조회합니다.
 *
 * 1. 로그 버퍼에 사용할 Redis key를 만듭니다.
 * 2. Redis List의 앞쪽부터 limit개만 읽습니다.
 * 3. JSON 문자열 목록을 로그 객체 목록으로 변환합니다.
 * 4. JSON 파싱에 실패한 값은 결과에서 제외합니다.
 *
 * 실습 포인트:
 * LRANGE는 List 데이터를 삭제하지 않고 지정한 구간만 조회합니다.
 *
 * 참고:
 * LPUSH로 최신 로그를 왼쪽에 넣었으므로 0번 인덱스부터 읽으면 최신 로그부터 조회됩니다.
 */
async getRecentLogs(limit = 100): Promise<LogBufferEntry[]> {
  const key = RedisKey.list.logBuffer();

  // 최근 로그 버퍼에서 필요한 범위의 항목을 조회합니다.
  // 지정한 범위의 값을 순서대로 반환하며, 저장된 항목이 없으면 빈 배열을 반환합니다.
  const values = await redis.lRange(key, 0, limit - 1);

  return values.map(parseLogEntry).filter((entry): entry is LogBufferEntry => entry !== null);
}

/**
 * 최근 로그 중 ERROR 레벨 로그만 조회합니다.
 *
 * 1. getRecentLogs로 최근 로그 목록을 가져옵니다.
 * 2. level 값이 ERROR인 로그만 남깁니다.
 *
 * 실습 포인트:
 * Redis List에서는 최근 로그 순서를 관리하고, 레벨 필터링은 애플리케이션 코드에서 처리합니다.
 */
async getRecentErrorLogs(limit = 100): Promise<LogBufferEntry[]> {
  const logs = await this.getRecentLogs(limit);

  return logs.filter((log) => log.level === 'ERROR');
}
```
