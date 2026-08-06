---
layout: post
title: "05. Redis String 실습: 캐시, 인증 코드, 카운터와 Rate Limiting"
description: "Redis String을 활용해 사용자 조회 캐시, 이메일 인증 코드, 게시글 조회수 카운터와 고정 윈도우 방식 Rate Limiting을 구현합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. 사용자 조회 결과 캐싱하기"
  - id: session-02
    title: "2. 이메일 인증 코드 저장하기"
  - id: session-03
    title: "3. 게시글 조회수 카운터 구현하기"
  - id: session-04
    title: "4. Rate Limiting 구현하기"
---

## 1. 사용자 조회 결과 캐싱하기 {#session-01}

![Redis 사용자 조회 캐시 처리 흐름](/assets/images/nodejs/nodejs-redis/redis-user-cache-flow.png)

사용자 정보는 서비스에서 자주 조회되는 데이터입니다.  
예를 들어 다음과 같은 API에서는 사용자 정보를 반복해서 조회할 수 있습니다.  

- 마이페이지 조회
- 게시글 작성자 정보 조회
- 댓글 작성자 정보 조회
- 로그인 사용자 기본 정보 조회

이때 요청마다 데이터베이스를 조회하면 불필요한 부하가 발생할 수 있습니다.  
사용자 단건 조회 결과를 Redis에 잠시 저장해 두면 같은 사용자를 다시 조회할 때 데이터베이스 대신 Redis에서 가져올 수 있습니다.  

전체 흐름은 다음과 같습니다.  

```text
사용자 조회 요청
  ↓
Redis cache:user:{userId} 조회
  ↓
캐시 있음 → Redis 데이터 반환
  ↓
캐시 없음 → DB 조회
  ↓
DB 조회 결과를 Redis에 60초 동안 저장
  ↓
사용자 데이터 반환
```

### 🟦 사용하는 Redis 키

사용자 캐시 키는 `RedisKey` 유틸리티에서 관리합니다.  

```typescript
RedisKey.cache.user(userId);

// src/shared/redis-key.ts
export const RedisKey = {
  cache: {
    user: (userId: number) => `cache:user:${userId}`,
  },
} as const;
```

실제로 생성되는 키는 다음과 같습니다.  

```text
cache:user:1
cache:user:2
cache:user:3
```

`cache:*` 접두사를 사용하면 Redis 안에서 캐시 용도의 키를 쉽게 구분할 수 있습니다.  

### 🟦 Redis 캐시 조회 흐름

```text
Cache Hit  → Redis 데이터 반환
Cache Miss → DB 조회 후 Redis 저장
```

실제 `UserService`는 4장에서 만든 `CacheService`를 `../ch04/cache.service`에서 가져와 사용합니다.  
다음 코드는 `src/ch05/user.service.ts`에서 캐시 처리와 직접 관련된 메서드만 발췌한 것입니다.  
`UserOutput`, `UserSelect`, `UpdateUserInput`과 `toUserOutput()`은 같은 파일에 정의되어 있습니다.  

```typescript
// src/ch05/user.service.ts

/**
 * Redis 캐시를 사용하는 사용자 단건 조회입니다.
 *
 * 1. userId로 Redis 캐시 키를 만듭니다.
 * 2. Redis에서 사용자 JSON 데이터를 먼저 조회합니다.
 * 3. 캐시에 값이 있으면 데이터베이스를 조회하지 않고 바로 반환합니다.
 * 4. 캐시에 값이 없으면 데이터베이스에서 조회합니다.
 * 5. 조회 결과를 Redis에 60초 동안 저장합니다.
 */
async getUserByIdWithCache(userId: number): Promise<UserOutput> {
  // 예: cache:user:1
  const cacheKey = RedisKey.cache.user(userId);

  // Cache Hit이면 데이터베이스를 조회하지 않습니다.
  const cachedUser = await this.cacheService.getJson<UserOutput>(cacheKey);

  if (cachedUser) {
    return cachedUser;
  }

  // Cache Miss일 때만 데이터베이스에서 조회합니다.
  const user = await this.getUserById(userId);

  // 60초가 지나면 Redis가 키를 자동으로 삭제합니다.
  await this.cacheService.setJson(cacheKey, user, 60);

  return user;
}
```

### 🟦 사용자 수정 시 캐시 무효화

캐시를 사용할 때는 캐시 무효화가 중요합니다.  
사용자 정보가 수정되었는데 Redis에 이전 데이터가 남아 있으면 이후 조회에서 오래된 사용자 정보가 반환될 수 있습니다.  
따라서 `updateUser()`에서는 데이터베이스를 수정한 후 Redis 캐시를 삭제합니다.  

```typescript
// src/ch05/user.service.ts

/**
 * 사용자 정보를 수정하고 기존 Redis 캐시를 삭제합니다.
 *
 * 1. userId에 해당하는 사용자의 name과 status를 수정합니다.
 * 2. undefined가 아닌 필드만 update data에 포함합니다.
 * 3. 데이터베이스 수정이 끝나면 기존 Redis 캐시를 삭제합니다.
 * 4. 수정된 사용자 정보를 UserOutput 형태로 변환해 반환합니다.
 */
async updateUser(userId: number, input: UpdateUserInput) {
  // prisma.user.update()는 대상 사용자가 없으면 P2025 예외를 던집니다.
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      // 값이 undefined인 필드는 기존 값을 유지합니다.
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
    },
    select: UserSelect,
  });

  // 다음 조회에서 최신 데이터를 다시 캐싱하도록 기존 캐시를 삭제합니다.
  const cacheKey = RedisKey.cache.user(userId);
  await this.cacheService.deleteCache(cacheKey);

  return toUserOutput(user);
}
```

## 2. 이메일 인증 코드 저장하기 {#session-02}

![Redis 이메일 인증 코드 저장 및 검증 흐름](/assets/images/nodejs/nodejs-redis/redis-email-auth-code-flow.png)

이메일 인증 코드는 일정 시간 동안만 유효해야 합니다.  
예를 들어 회원가입 이메일 인증에서는 다음 요구사항이 자주 등장합니다.  

1. 사용자 이메일로 6자리 인증 코드를 발급합니다.
2. 인증 코드는 3분 동안만 유효합니다.
3. 사용자가 입력한 코드와 Redis에 저장된 코드를 비교합니다.
4. 인증 성공 후 같은 코드를 다시 사용할 수 없도록 삭제합니다.

이처럼 유효 시간이 짧은 데이터는 Redis String에 TTL과 함께 저장하기 좋습니다.  

### 🟦 사용하는 Redis 키

```typescript
RedisKey.string.authCode(email);

// 생성되는 키의 예입니다.
// string:auth-code:kim@example.com
```

### 🟦 인증 코드 생성 및 저장

실습 코드에서는 6자리 숫자 문자열을 생성할 때 `Math.random()`을 사용합니다.  
보안이 중요한 실제 서비스에서는 `crypto` 기반 난수 생성을 권장합니다.  

```typescript
// src/ch05/auth.service.ts

/**
 * 100000부터 999999 사이의 6자리 숫자 문자열을 생성합니다.
 */
generateAuthCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 이메일 인증 코드를 생성하여 Redis에 저장합니다.
 *
 * 1. 6자리 인증 코드를 생성합니다.
 * 2. 이메일을 포함한 Redis 키를 만듭니다.
 * 3. Redis String에 인증 코드를 저장하고 TTL 180초를 설정합니다.
 *
 * 반환한 authCode는 실제 서비스에서는 이메일이나 SMS로 발송하며,
 * API 응답으로 직접 노출하지 않는 것이 일반적입니다.
 */
async saveEmailAuthCode(email: string): Promise<string> {
  const authCode = this.generateAuthCode();

  // 이메일마다 인증 코드를 따로 저장합니다.
  // 예: string:auth-code:test@example.com
  const key = RedisKey.string.authCode(email);

  // EX: 180은 키를 180초 후 자동으로 삭제하는 옵션입니다.
  await redis.set(key, authCode, {
    EX: 180,
  });

  return authCode;
}
```

### 🟦 인증 코드 검증

Redis에 값이 없으면 인증 코드가 발급되지 않았거나 TTL이 지나 만료된 상태입니다.  

```typescript
/**
 * 이메일 인증 코드를 검증합니다.
 *
 * 1. 이메일에 해당하는 인증 코드를 Redis에서 조회합니다.
 * 2. 값이 없으면 만료되었거나 발급되지 않은 코드이므로 false를 반환합니다.
 * 3. 저장된 코드와 사용자가 입력한 코드를 비교합니다.
 * 4. 인증에 성공하면 Redis 키를 삭제합니다.
 */
async verifyEmailAuthCode(email: string, inputCode: string): Promise<boolean> {
  const key = RedisKey.string.authCode(email);

  // TTL 180초가 지나면 Redis가 키를 삭제하므로 null이 반환됩니다.
  const savedCode = await redis.get(key);
  if (!savedCode) {
    return false;
  }

  const isValid = savedCode === inputCode;
  if (isValid) {
    // 인증에 성공한 코드는 이후 요청에서 사용할 수 없도록 삭제합니다.
    await redis.del(key);
  }

  return isValid;
}
```

조회와 삭제는 별도 명령으로 실행됩니다.  
동시에 여러 검증 요청을 엄격하게 한 번만 허용해야 하는 환경에서는 원자적인 검증 방식을 별도로 고려해야 합니다.  

### 🟦 인증 코드 남은 시간 조회

`TTL` 명령을 사용하면 인증 코드가 만료되기까지 남은 시간을 초 단위로 확인할 수 있습니다.  
양수는 남은 시간, `-2`는 키가 없음, `-1`은 키는 있지만 만료 시간이 없음을 의미합니다.  

```typescript
// src/ch05/auth.service.ts

async getAuthCodeTtl(email: string): Promise<number> {
  const key = RedisKey.string.authCode(email);

  return redis.ttl(key);
}
```

## 3. 게시글 조회수 카운터 구현하기 {#session-03}

![Redis 게시글 조회수 누적 및 DB 동기화 흐름](/assets/images/nodejs/nodejs-redis/redis-post-view-count-flow.png)

게시글 조회수는 자주 증가하는 값입니다.  
사용자가 게시글을 볼 때마다 데이터베이스에서 `UPDATE`를 실행하면 트래픽이 많을수록 쓰기 부하가 커집니다.  

```text
게시글 조회 1회     → DB UPDATE 1회
게시글 조회 1,000회 → DB UPDATE 1,000회
게시글 조회 10,000회 → DB UPDATE 10,000회
```

이와 같은 단순 증가 값은 Redis String의 `INCR` 명령으로 처리하기 좋습니다.  
Redis String 값이 숫자 문자열이면 `INCR`, `DECR`, `INCRBY` 같은 명령어로 값을 증가하거나 감소시킬 수 있습니다.  

### 🟦 사용하는 Redis 키

```typescript
RedisKey.string.postViewCount(postId);

// 생성되는 키의 예입니다.
// string:post-view-count:1
// string:post-view-count:2
```

### 🟦 조회수 증가와 조회

```typescript
// src/ch05/post.service.ts

/**
 * Redis String에 저장된 조회수를 1 증가시킵니다.
 * INCR은 Redis에서 원자적으로 처리되므로 여러 요청이 동시에 들어와도
 * 증가 값이 서로 덮어쓰이지 않습니다.
 */
async increaseViewCount(postId: number): Promise<number> {
  // 예: string:post-view-count:1
  const key = RedisKey.string.postViewCount(postId);

  return redis.incr(key);
}

/**
 * Redis에 임시로 누적된 조회수를 반환합니다.
 * 아직 값이 없으면 조회수가 증가하지 않은 상태로 보고 0을 반환합니다.
 */
async getRedisViewCount(postId: number): Promise<number> {
  const key = RedisKey.string.postViewCount(postId);
  const value = await redis.get(key);

  // GET 결과는 문자열 또는 null이므로 숫자로 변환합니다.
  return value ? Number(value) : 0;
}
```

### 🟦 게시글 조회와 조회수 증가를 함께 처리하기

```typescript
// src/ch05/post.service.ts

/**
 * 데이터베이스에서 게시글 한 건을 조회합니다.
 * 게시글이 없으면 null을 반환합니다.
 */
async getPostById(postId: number) {
  return prisma.post.findUnique({
    where: {
      id: postId,
    },
  });
}

/**
 * 게시글을 조회하고 Redis 조회수를 증가시킵니다.
 *
 * 상세 조회 요청마다 DB의 viewCount를 바로 수정하지 않고,
 * Redis에 먼저 누적한 뒤 나중에 데이터베이스에 반영합니다.
 */
async getPostDetailAndIncreaseViewCount(postId: number) {
  const post = await this.getPostById(postId);
  if (!post) {
    return null;
  }

  const redisViewCount = await this.increaseViewCount(postId);

  // redisViewCount는 데이터베이스 값이 아니라 Redis에 임시로 쌓인 값입니다.
  return {
    ...post,
    redisViewCount,
  };
}
```

### 🟦 Redis 조회수를 데이터베이스에 반영하기

```typescript
// src/ch05/post.service.ts

/**
 * Redis 조회수를 데이터베이스에 반영합니다.
 *
 * 1. Redis 값을 가져오면서 키를 삭제합니다.
 * 2. 누적된 조회수가 없으면 데이터베이스를 수정하지 않습니다.
 * 3. Redis 조회수를 DB의 viewCount에 더합니다.
 * 4. DB 수정에 실패하면 Redis에 조회수를 복구합니다.
 */
async syncViewCountToDatabase(postId: number) {
  const key = RedisKey.string.postViewCount(postId);

  // GETDEL은 값을 가져오고 키를 삭제하는 작업을 한 번에 수행합니다.
  const value = await redis.getDel(key);
  const redisViewCount = value ? Number(value) : 0;

  if (redisViewCount <= 0) {
    return null;
  }

  try {
    return await prisma.post.update({
      where: { id: postId },
      data: {
        viewCount: { increment: redisViewCount },
      },
    });
  } catch (error) {
    // DB 수정에 실패하면 삭제했던 조회수 증가분을 Redis에 다시 더합니다.
    await redis.incrBy(key, redisViewCount);
    throw error;
  }
}
```

## 4. Rate Limiting 구현하기 {#session-04}

![Redis 고정 윈도우 Rate Limiting 처리 흐름](/assets/images/nodejs/nodejs-redis/redis-rate-limiting-flow.png)

Rate Limiting은 일정 시간 동안 허용할 요청 수를 제한하는 기능입니다.  

```text
같은 IP에서 60초 동안 최대 5회 로그인 요청 허용
같은 사용자에게 10초 동안 최대 20회 API 요청 허용
```

### 🟦 사용하는 Redis 키

```typescript
RedisKey.string.rateLimit(key);

// 생성되는 키의 예입니다.
// string:rate-limit:login:ip:127.0.0.1
// string:rate-limit:api:user:1
```

### 🟦 요청 횟수 증가

Rate Limiting의 핵심은 요청이 들어올 때마다 Redis 값을 증가시키는 것입니다.  
제한 횟수가 5회라면 결과는 다음과 같습니다.  

```text
1번째 요청 → 허용
2번째 요청 → 허용
3번째 요청 → 허용
4번째 요청 → 허용
5번째 요청 → 허용
6번째 요청 → 차단
```

```typescript
// src/ch05/rate-limit.service.ts

export type RateLimitResult = {
  // 현재 요청을 허용할 수 있는지 나타냅니다.
  allowed: boolean;
  // 현재 윈도우에서 집계된 요청 횟수입니다.
  count: number;
  // 현재 윈도우에서 허용하는 최대 요청 횟수입니다.
  limit: number;
  // 카운터가 초기화될 때까지 남은 시간입니다.
  ttl: number;
};

/**
 * 고정 윈도우 방식으로 요청 횟수를 제한합니다.
 *
 * 1. 요청을 구분할 Redis 키를 만듭니다.
 * 2. INCR로 요청 횟수를 1 증가시킵니다.
 * 3. 현재 키의 TTL을 조회합니다.
 * 4. 첫 요청이거나 TTL이 없으면 windowSeconds만큼 TTL을 설정합니다.
 * 5. count가 limit 이하이면 요청을 허용합니다.
 */
async checkLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  // 예: string:rate-limit:login:ip:127.0.0.1
  const redisKey = RedisKey.string.rateLimit(key);

  // INCR은 원자적으로 실행되므로 동시에 들어온 요청도 정확히 증가합니다.
  const count = await redis.incr(redisKey);

  // TTL은 남은 시간을 초 단위로 반환합니다.
  // -1은 만료 시간이 없는 키, -2는 존재하지 않는 키를 의미합니다.
  let ttl = await redis.ttl(redisKey);

  if (count === 1 || ttl === -1) {
    // 첫 요청에는 제한 시간의 시작점이 되도록 TTL을 설정합니다.
    // TTL이 없는 기존 키를 발견한 경우에도 만료 시간을 복구합니다.
    await redis.expire(redisKey, windowSeconds);
    ttl = await redis.ttl(redisKey);
  }

  return {
    allowed: count <= limit,
    count,
    limit,
    ttl,
  };
}
```

이 예제는 이해하기 쉬운 고정 윈도우 방식입니다.  
`INCR`와 `EXPIRE`가 각각 실행되므로 첫 요청 처리 중 프로세스가 중단되면 TTL 없는 키가 남을 수 있지만, 다음 요청에서 `ttl === -1`을 확인해 만료 시간을 다시 설정합니다.  

### 🟦 로그인 요청 제한과 사용자 API 제한

같은 IP에서는 60초 동안 최대 5회의 로그인 요청을 허용합니다.  

```typescript
async checkLoginLimitByIp(ip: string): Promise<RateLimitResult> {
  return this.checkLimit(`login:ip:${ip}`, 5, 60);
}
```

같은 사용자에게는 10초 동안 최대 20회의 API 요청을 허용합니다.  

```typescript
async checkApiLimitByUser(userId: number): Promise<RateLimitResult> {
  return this.checkLimit(`api:user:${userId}`, 20, 10);
}
```

### 🟦 현재 요청 횟수 조회와 제한 초기화

현재 요청 횟수를 확인할 때는 Redis String 값을 숫자로 변환합니다.  
관리자 조치나 테스트에서 제한 상태를 초기화할 때는 키를 삭제하여 요청 횟수와 TTL을 함께 제거합니다.  

```typescript
// src/ch05/rate-limit.service.ts

async getCurrentCount(key: string): Promise<number> {
  const redisKey = RedisKey.string.rateLimit(key);
  const value = await redis.get(redisKey);

  return value ? Number(value) : 0;
}

async resetLimit(key: string): Promise<void> {
  const redisKey = RedisKey.string.rateLimit(key);
  await redis.del(redisKey);
}
```
