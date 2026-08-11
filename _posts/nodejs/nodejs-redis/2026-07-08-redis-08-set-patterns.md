---
layout: post
title: "08. Redis Set 실습: 중복 제거와 상태 관리"
description: "Redis Set을 활용해 게시글 좋아요, 일일 방문자, 온라인 사용자와 중복 요청 상태를 중복 없이 관리하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. 게시글 좋아요 사용자 목록 관리하기"
  - id: session-02
    title: "2. 일일 방문자 중복 제거하기"
  - id: session-03
    title: "3. 온라인 사용자 관리하기"
  - id: session-04
    title: "4. 중복 요청 방지 처리하기"
  - id: session-05
    title: "5. 실습에서 사용한 Redis Set 명령어 정리"
---

![Redis Set을 활용한 좋아요, 방문자, 온라인 사용자와 중복 요청 관리 구조](/assets/images/nodejs/nodejs-redis/redis-set-use-cases.png)

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/redis-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 게시글 좋아요 사용자 목록 관리하기 {#session-01}

게시글 좋아요는 Redis Set을 설명하기 좋은 대표적인 예입니다.  
좋아요 기능에는 다음 요구사항이 있습니다.  

![Redis Set으로 게시글 좋아요 사용자를 추가하고 취소하며 상태와 개수를 조회하는 흐름](/assets/images/nodejs/nodejs-redis/redis-set-post-likes-flow.png)

```text
1. 한 사용자는 같은 게시글에 좋아요를 한 번만 누를 수 있습니다.
2. 좋아요 취소가 가능해야 합니다.
3. 특정 사용자가 좋아요를 눌렀는지 확인할 수 있어야 합니다.
4. 게시글의 좋아요 수를 빠르게 조회할 수 있어야 합니다.
```

이 요구사항은 Redis Set의 특성과 잘 맞습니다.  

```text
key    → set:post-likes:{postId}
member → userId
```

예를 들어 게시글 1번에 사용자 10, 20, 30이 좋아요를 눌렀다면 Redis에는 다음과 같이 저장됩니다.  

```text
set:post-likes:1
  ├─ "10"
  ├─ "20"
  └─ "30"
```

Set은 중복을 허용하지 않으므로 사용자 10이 여러 번 좋아요를 눌러도 한 번만 저장됩니다.  

키는 RedisKey 유틸리티를 그대로 사용합니다.

```text
RedisKey.set.postLikes(postId);

set:post-likes:1
set:post-likes:2
```

### 🟦 게시글 좋아요 추가 및 취소

게시글 1번에 사용자 10이 좋아요를 누르면 다음과 같이 저장됩니다.  

```redis
SADD set:post-likes:1 10
```

같은 사용자가 다시 좋아요를 눌러도 Redis Set에는 한 번만 저장됩니다.  

```text
SADD set:post-likes:1 10 → 추가됨
SADD set:post-likes:1 10 → 이미 있음
SADD set:post-likes:1 10 → 이미 있음

결과:
set:post-likes:1
  └─ "10"
```

```typescript
// src/ch08/post-set.service.ts

/**
 * 게시글에 사용자 좋아요를 추가합니다.
 *
 * 1. 게시글과 사용자가 실제로 존재하는지 확인합니다.
 * 2. 게시글별 좋아요 Redis Set key를 만듭니다.
 * 3. userId를 문자열로 바꿔 Set member로 추가합니다.
 * 4. Set member 개수를 조회해 현재 좋아요 수를 계산합니다.
 * 5. 좋아요 상태와 좋아요 수를 반환합니다.
 *
 * 실습 포인트:
 * Redis Set은 중복 member를 허용하지 않으므로 좋아요 중복 방지에 적합합니다.
 */
async likePost(postId: number, userId: number): Promise<PostLikeStatusOutput> {
  await this.ensurePostExists(postId);
  await this.ensureUserExists(userId);

  const key = RedisKey.set.postLikes(postId);
  const member = String(userId);

  // SADD는 같은 member가 있으면 중복으로 저장하지 않습니다.
  await redis.sAdd(key, member);

  // SCARD 결과를 현재 좋아요 수로 사용합니다.
  const likeCount = await redis.sCard(key);

  return {
    postId,
    userId,
    liked: true,
    likeCount,
  };
}

/**
 * 게시글에서 사용자 좋아요를 취소합니다.
 *
 * 1. 게시글별 좋아요 Redis Set key를 만듭니다.
 * 2. userId를 문자열로 바꿔 Set에서 제거합니다.
 * 3. 취소 후 Set member 개수를 조회합니다.
 * 4. 좋아요 취소 상태와 좋아요 수를 반환합니다.
 *
 * 실습 포인트:
 * SREM은 Set에서 특정 member를 제거할 때 사용합니다.
 */
async unlikePost(postId: number, userId: number): Promise<PostLikeStatusOutput> {
  const key = RedisKey.set.postLikes(postId);
  const member = String(userId);

  // member가 없어도 에러가 발생하지 않고 제거 건수 0을 반환합니다.
  await redis.sRem(key, member);

  const likeCount = await redis.sCard(key);

  return {
    postId,
    userId,
    liked: false,
    likeCount,
  };
}
```

### 🟦 특정 사용자의 게시글 좋아요 여부 확인

```typescript
/**
 * 특정 사용자가 게시글에 좋아요를 눌렀는지 확인합니다.
 *
 * 1. 게시글별 좋아요 Redis Set key를 만듭니다.
 * 2. userId를 문자열로 바꿔 Set member 존재 여부를 조회합니다.
 * 3. Redis의 1 또는 0 응답을 boolean 값으로 변환합니다.
 *
 * 실습 포인트:
 * SISMEMBER는 Set 안에 특정 member가 있는지 확인할 때 사용합니다.
 */
async isPostLikedByUser(postId: number, userId: number): Promise<boolean> {
  const key = RedisKey.set.postLikes(postId);
  const member = String(userId);

  // member가 있으면 1, 없으면 0을 반환합니다.
  const result = await redis.sIsMember(key, member);

  return result === 1;
}
```

### 🟦 게시글 좋아요 수와 사용자 목록 조회

```typescript
/**
 * 게시글 좋아요 수와 좋아요를 누른 사용자 목록을 조회합니다.
 *
 * 1. 게시글별 좋아요 Redis Set key를 만듭니다.
 * 2. Set의 모든 member를 문자열 배열로 조회합니다.
 * 3. 문자열 userId를 number로 변환합니다.
 * 4. 좋아요 수와 사용자 ID 목록을 함께 반환합니다.
 *
 * 실습 포인트:
 * SMEMBERS는 Set에 들어 있는 모든 member를 한 번에 조회합니다.
 *
 * 참고:
 * Redis Set은 순서를 보장하지 않습니다. 응답 순서가 중요하면 별도로 정렬하거나 Sorted Set을 고려해야 합니다.
 */
async getPostLikeSummary(postId: number): Promise<PostLikeSummaryOutput> {
  const key = RedisKey.set.postLikes(postId);

  // Set의 모든 member를 반환하며, 반환 순서는 보장되지 않습니다.
  const members = await redis.sMembers(key);
  const likedUserIds = members.map(Number);

  return {
    postId,
    likeCount: likedUserIds.length,
    likedUserIds,
  };
}
```

## 2. 일일 방문자 중복 제거하기 {#session-02}

일일 방문자 수를 계산할 때 중요한 것은 중복 제거입니다.  
같은 사용자가 하루에 여러 번 방문해도 방문자 수는 1명으로 계산해야 합니다.  

![Redis Set으로 같은 날의 중복 방문자를 제거하고 만료 시간과 고유 방문자 수를 관리하는 흐름](/assets/images/nodejs/nodejs-redis/redis-set-daily-visitors-flow.png)

```text
사용자 1번이 하루에 10번 방문
→ 페이지뷰는 10
→ 일일 방문자 수는 1
```

Redis Set을 사용하면 로그인 사용자 기준의 일일 방문자 수를 간단하게 계산할 수 있습니다.  

```text
Redis key  = set:daily-visitors:{date}
Set member = userId
```

예를 들어 2026년 6월 23일에 사용자 1, 2, 3이 방문했다면 Redis에는 다음과 같이 저장됩니다.  

```text
set:daily-visitors:20260623
  ├─ "1"
  ├─ "2"
  └─ "3"
```

키는 RedisKey 유틸리티를 그대로 사용합니다.

```text
RedisKey.set.dailyVisitors(date);

set:daily-visitors:20260623
set:daily-visitors:20260624
```

### 🟦 사용자의 일일 방문 기록

```text
1. 날짜별 Set에 사용자 ID를 추가합니다.
2. EXPIRE의 NX 옵션으로 TTL이 없을 때만 2일의 만료 시간을 설정합니다.
3. 기존 Set의 TTL은 이후 방문 기록으로 연장하지 않습니다.
4. 현재까지 저장된 고유 방문자 수를 조회합니다.
```

일일 방문자 데이터는 실습 데이터나 단기 통계 용도이므로 2일 뒤 자동으로 삭제되도록 설정합니다.  

```typescript
// src/ch08/visitor-set.service.ts

/**
 * 로그인 사용자의 일일 방문을 날짜별 Redis Set에 기록합니다.
 *
 * 1. 날짜 기준 Redis Set key를 만듭니다.
 * 2. userId를 Set member 문자열로 변환합니다.
 * 3. SADD로 사용자 ID를 추가하고 신규 방문자인지 판단합니다.
 * 4. EXPIRE NX로 TTL이 없는 Set에만 만료 시간을 설정합니다.
 * 5. SCARD로 현재 방문자 수를 조회합니다.
 *
 * 실습 포인트:
 * SADD, EXPIRE NX, SCARD를 MULTI/EXEC으로 묶어 연속해서 실행합니다.
 * EXPIRE NX는 기존 만료 시간이 방문 기록마다 연장되는 것을 막습니다.
 */
async addDailyVisitor(date: string, userId: number): Promise<DailyVisitorOutput> {
  const key = RedisKey.set.dailyVisitors(date);
  const member = createVisitorMember(userId);

  // 방문자 추가, 최초 TTL 설정, 방문자 수 조회를 하나의 Transaction으로 실행합니다.
  const transactionResult = await redis
    .multi()
    .sAdd(key, member)
    .expire(key, 60 * 60 * 24 * 2, 'NX')
    .sCard(key)
    .exec();

  // Transaction 결과에서 SADD와 SCARD의 숫자 응답을 확인합니다.
  const addedCount = transactionResult[0];
  const visitorCount = transactionResult[2];

  if (typeof addedCount !== 'number' || typeof visitorCount !== 'number') {
    throw new Error('Unexpected Redis transaction result');
  }

  return {
    date,
    userId,
    isNewVisitor: addedCount === 1,
    visitorCount,
  };
}
```

### 🟦 날짜별 방문자 수와 사용자 목록 조회

```typescript
/**
 * 날짜별 방문자 수와 방문 사용자 목록을 함께 조회합니다.
 *
 * 1. 날짜 기준 Redis Set key를 만듭니다.
 * 2. SMEMBERS로 Set의 모든 userId member를 조회합니다.
 * 3. 문자열 userId를 number로 변환합니다.
 * 4. 응답 순서가 안정적이도록 오름차순 정렬합니다.
 * 5. 방문자 수와 사용자 ID 목록을 함께 반환합니다.
 *
 * 실습 포인트:
 * SMEMBERS로 Set의 중복 제거 결과를 확인할 수 있습니다.
 */
async getDailyVisitorSummary(date: string): Promise<DailyVisitorSummaryOutput> {
  const key = RedisKey.set.dailyVisitors(date);

  // Set은 순서를 보장하지 않으므로 응답 확인이 쉽도록 정렬합니다.
  const userIds = (await redis.sMembers(key)).map(Number).sort((a, b) => a - b);

  return {
    date,
    visitorCount: userIds.length,
    userIds,
  };
}
```

## 3. 온라인 사용자 관리하기 {#session-03}

온라인 사용자 상태에는 다음과 같은 요구사항이 있습니다.  

![Redis Set으로 사용자의 접속과 로그아웃을 반영하고 온라인 상태와 사용자 수를 조회하는 흐름](/assets/images/nodejs/nodejs-redis/redis-set-online-users-flow.png)

```text
1. 사용자가 접속하면 온라인 사용자 Set에 추가합니다.
2. 사용자가 로그아웃하거나 연결이 끊기면 Set에서 제거합니다.
3. 특정 사용자가 현재 온라인인지 확인합니다.
4. 현재 온라인 사용자 수를 조회합니다.
```

Redis 저장 구조는 다음과 같습니다.  

```text
Redis key  = set:online-users
Set member = userId
```

예를 들어 사용자 1, 2, 3이 접속 중이라면 Redis에는 다음과 같이 저장됩니다.  

```text
set:online-users
  ├─ "1"
  ├─ "2"
  └─ "3"
```

같은 사용자가 여러 번 접속 이벤트를 보내도 Set에는 한 번만 저장됩니다.  

키는 RedisKey 유틸리티를 그대로 사용합니다.

```text
RedisKey.set.onlineUsers();

set:online-users
```

### 🟦 온라인 사용자 추가 및 제거

```typescript
// src/ch08/online-user-set.service.ts

/**
 * 온라인 사용자 Set에 사용자 ID를 추가합니다.
 *
 * 1. 사용자가 DB에 존재하는지 확인합니다.
 * 2. 온라인 사용자 Set key를 만듭니다.
 * 3. SADD로 userId를 Set member로 추가합니다.
 * 4. SCARD로 전체 온라인 사용자 수를 조회합니다.
 * 5. 온라인 상태와 사용자 수를 반환합니다.
 */
async markUserOnline(userId: number): Promise<OnlineUserStatusOutput> {
  await this.ensureUserExists(userId);

  const key = RedisKey.set.onlineUsers();

  // 같은 사용자의 접속 이벤트가 반복되어도 한 번만 저장됩니다.
  await redis.sAdd(key, String(userId));

  const onlineUserCount = await redis.sCard(key);

  return {
    userId,
    online: true,
    onlineUserCount,
  };
}

/**
 * 온라인 사용자 Set에서 사용자 ID를 제거합니다.
 *
 * 1. 온라인 사용자 Set key를 만듭니다.
 * 2. SREM으로 userId member를 제거합니다.
 * 3. SCARD로 제거 후 온라인 사용자 수를 조회합니다.
 * 4. 오프라인 상태와 사용자 수를 반환합니다.
 */
async markUserOffline(userId: number): Promise<OnlineUserStatusOutput> {
  const key = RedisKey.set.onlineUsers();

  // member가 없어도 에러가 발생하지 않고 제거 건수 0을 반환합니다.
  await redis.sRem(key, String(userId));

  const onlineUserCount = await redis.sCard(key);

  return {
    userId,
    online: false,
    onlineUserCount,
  };
}
```

### 🟦 온라인 사용자 조회

```typescript
/**
 * 특정 사용자가 온라인 사용자 Set에 포함되어 있는지 확인합니다.
 *
 * 1. 온라인 사용자 Set key를 만듭니다.
 * 2. SISMEMBER로 userId가 Set에 포함되어 있는지 확인합니다.
 * 3. Redis의 응답을 boolean 값으로 변환합니다.
 */
async isUserOnline(userId: number): Promise<boolean> {
  const key = RedisKey.set.onlineUsers();

  // 포함되어 있으면 1, 포함되어 있지 않으면 0을 반환합니다.
  const result = await redis.sIsMember(key, String(userId));
  return result === 1;
}

/**
 * 현재 온라인 사용자 수와 사용자 ID 목록을 함께 조회합니다.
 *
 * 1. 온라인 사용자 Set key를 만듭니다.
 * 2. SMEMBERS로 Set의 모든 userId member를 조회합니다.
 * 3. 문자열 userId를 number로 변환합니다.
 * 4. 온라인 사용자 수와 사용자 ID 목록을 반환합니다.
 *
 * 참고:
 * Redis Set은 순서를 보장하지 않습니다.
 */
async getOnlineUserSummary(): Promise<OnlineUserSummaryOutput> {
  const key = RedisKey.set.onlineUsers();

  const members = await redis.sMembers(key);
  const onlineUserIds = members.map(Number);

  return {
    onlineUserCount: onlineUserIds.length,
    onlineUserIds,
  };
}
```

## 4. 중복 요청 방지 처리하기 {#session-04}

중복 요청 방지는 주문 생성, 쿠폰 사용, 이메일 발송, 포인트 지급, 결제 승인처럼 같은 요청이 여러 번 처리되면 문제가 되는 기능에서 중요합니다.  

예를 들어 사용자가 주문 생성 버튼을 여러 번 클릭하거나 네트워크 재시도로 같은 요청이 다시 전송될 수 있습니다.  
이때 서버는 `requestId`를 기준으로 이미 처리한 요청인지 확인할 수 있습니다.  

![Redis Set에 요청 ID를 저장하고 만료 시간을 설정한 뒤 최초 요청과 중복 요청을 구분하는 흐름](/assets/images/nodejs/nodejs-redis/redis-set-duplicate-request-flow.png)

```text
requestId    = 개별 요청을 식별하는 고유 ID
requestGroup = 중복 요청을 검사할 업무 단위
```

예를 들어 업무별 `requestGroup`은 다음과 같이 나눌 수 있습니다.  

```text
order:create → 주문 생성
coupon:use   → 쿠폰 사용
email:send   → 이메일 발송
```

Redis에는 `requestGroup`별로 Set을 만들고, 그 안에 `requestId`를 member로 저장합니다.  

```text
Redis key = set:duplicate-request:{requestGroup}
Set member = requestId
```

예를 들어 주문 생성 요청은 다음과 같이 저장됩니다.  

```text
set:duplicate-request:order:create
  ├─ "req-001"
  ├─ "req-002"
  └─ "req-003"
```

쿠폰 사용 요청은 별도 Set에 저장됩니다.  

```text
set:duplicate-request:coupon:use
  ├─ "req-001"
  └─ "req-004"
```

따라서 같은 `req-001`이라도 `order:create`와 `coupon:use`는 서로 다른 업무로 판단됩니다.  

### 🟦 requestGroup과 requestId의 차이

이 코드에서 가장 중요한 개념은 `requestGroup`과 `requestId`입니다.  

```text
requestGroup
→ 중복 요청을 검사할 업무 단위

requestId
→ 개별 요청을 식별하는 고유 ID
```

예시는 다음과 같습니다.  

```text
주문 생성 요청
requestGroup = order:create
requestId    = req-001

쿠폰 사용 요청
requestGroup = coupon:use
requestId    = req-001

이메일 발송 요청
requestGroup = email:send
requestId    = req-001
```

같은 `req-001`이라도 업무가 다르면 서로 다른 Set에 저장됩니다.  

```text
set:duplicate-request:order:create
  └─ "req-001"

set:duplicate-request:coupon:use
  └─ "req-001"

set:duplicate-request:email:send
  └─ "req-001"
```

### 🟦 requestId 생성 예시

보통 다음 중 하나를 사용합니다.  

```text
UUID
ULID
NanoID
클라이언트에서 생성한 idempotency key
서버에서 발급한 요청 토큰
주문 임시 ID
결제 요청 ID
```

예시는 다음과 같습니다.  

```text
req_01J0ZK8V9QZ2Y5M3K7P9A1B2C3
order_req_7f3a9c2e
coupon_req_20260707_001
email_req_a8f21b
```

키는 RedisKey 유틸리티를 그대로 사용합니다.

```text
RedisKey.set.duplicateRequest(requestGroup);

set:duplicate-request:order:create
set:duplicate-request:coupon:use
set:duplicate-request:email:send
```

### 🟦 요청 ID 저장과 중복 여부 판단

```typescript
// src/ch08/request-set.service.ts

/**
 * 요청 ID를 Redis Set에 저장하고 중복 여부를 판단합니다.
 *
 * 1. 업무 단위별 중복 요청 Redis Set key를 만듭니다.
 * 2. requestId를 Set member로 추가합니다.
 * 3. Set에 TTL을 설정해 일정 시간이 지나면 중복 기록을 자동 삭제합니다.
 * 4. 저장된 requestId 개수와 남은 TTL을 조회합니다.
 * 5. SADD 결과를 기준으로 최초 요청 여부와 중복 여부를 반환합니다.
 *
 * 참고:
 * 요청이 들어올 때마다 EXPIRE를 다시 설정하므로 TTL이 최근 요청 기준으로 연장됩니다.
 */
async checkAndStoreRequest(
  requestGroup: string,
  requestId: string,
  ttlSeconds = 300,
): Promise<DuplicateRequestResult> {
  const key = RedisKey.set.duplicateRequest(requestGroup);

  // SADD 결과가 1이면 최초 요청, 0이면 이미 기록된 중복 요청입니다.
  const addedCount = await redis.sAdd(key, requestId);

  // 중복 요청 기록은 ttlSeconds 동안 유지합니다.
  await redis.expire(key, ttlSeconds);

  const storedRequestCount = await redis.sCard(key);
  const ttl = await redis.ttl(key);

  return {
    requestGroup,
    requestId,
    firstRequest: addedCount === 1,
    duplicate: addedCount === 0,
    storedRequestCount,
    ttl,
  };
}
```

첫 번째 주문 생성 요청 결과는 다음과 같습니다.  

```json
{
  "requestGroup": "order:create",
  "requestId": "req-001",
  "firstRequest": true,
  "duplicate": false,
  "storedRequestCount": 1,
  "ttl": 300
}
```

같은 `requestId`로 다시 요청하면 다음과 같습니다.  

```json
{
  "requestGroup": "order:create",
  "requestId": "req-001",
  "firstRequest": false,
  "duplicate": true,
  "storedRequestCount": 1,
  "ttl": 298
}
```

### 🟦 중복 여부 판단 예시

```typescript
/**
 * 주문 생성 요청의 중복 여부를 5분 기준으로 확인하고 기록합니다.
 */
async checkOrderCreateRequest(requestId: string): Promise<DuplicateRequestResult> {
  return this.checkAndStoreRequest('order:create', requestId, 300);
}

/**
 * 쿠폰 사용 요청의 중복 여부를 5분 기준으로 확인하고 기록합니다.
 */
async checkCouponUseRequest(requestId: string): Promise<DuplicateRequestResult> {
  return this.checkAndStoreRequest('coupon:use', requestId, 300);
}

/**
 * 이메일 발송 요청의 중복 여부를 3분 기준으로 확인하고 기록합니다.
 */
async checkEmailSendRequest(requestId: string): Promise<DuplicateRequestResult> {
  return this.checkAndStoreRequest('email:send', requestId, 180);
}
```

## 5. 실습에서 사용한 Redis Set 명령어 정리 {#session-05}

| 명령어 | 사용 위치 | 의미 |
| --- | --- | --- |
| `SADD` | 좋아요 추가, 방문자 추가, 온라인 추가, requestId 저장 | Set에 member 추가 |
| `SREM` | 좋아요 취소, 온라인 해제 | Set에서 member 제거 |
| `SISMEMBER` | 좋아요 여부, 방문 여부, 온라인 여부, 중복 요청 여부 | member 포함 여부 확인 |
| `SCARD` | 좋아요 수, 방문자 수, 온라인 사용자 수, 요청 수 | Set member 개수 조회 |
| `SMEMBERS` | 좋아요 사용자 목록, 방문자 목록, 온라인 사용자 목록 | Set 전체 member 조회 |
| `DEL` | 테스트 초기화, 데이터 삭제 | Set key 삭제 |
| `EXPIRE` | 방문자 기록, 중복 요청 기록 | Set key 만료 시간 설정 |
