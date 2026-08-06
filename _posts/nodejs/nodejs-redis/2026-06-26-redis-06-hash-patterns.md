---
layout: post
title: "06. Redis Hash 실습: 프로필, 세션, 재고와 사용자 설정"
description: "Redis Hash를 활용해 사용자 프로필 캐시, 로그인 세션, 상품 재고 상태와 사용자 설정 정보를 필드 단위로 저장하고 갱신하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. 사용자 프로필 캐시 저장하기"
  - id: session-02
    title: "2. 로그인 세션 저장하기"
  - id: session-03
    title: "3. 상품 재고 상태 캐싱하기"
  - id: session-04
    title: "4. 사용자 설정 정보 관리하기"
---

Redis Hash는 하나의 Redis 키 안에 여러 개의 필드와 값을 저장하는 자료구조입니다.  
String이 하나의 키에 하나의 문자열 값을 저장한다면, Hash는 하나의 키 안에 객체처럼 여러 필드를 저장할 수 있습니다.  

```text
String 예시

cache:user:1
→ '{"id":1,"email":"kim@example.com","name":"Kim","point":100}'
```

```text
Hash 예시

hash:user-profile:1
→ id        = "1"
→ email     = "kim@example.com"
→ name      = "Kim"
→ point     = "100"
→ status    = "ACTIVE"
→ createdAt = "2026-06-17T00:00:00.000Z"
→ updatedAt = "2026-06-17T00:00:00.000Z"
```

Hash를 사용하면 객체 전체를 JSON 문자열로 다시 저장하지 않고 필요한 필드만 읽거나 수정할 수 있습니다.  

## 1. 사용자 프로필 캐시 저장하기 {#session-01}

사용자 프로필은 여러 API에서 자주 조회되는 데이터입니다.  

예를 들어 다음과 같은 화면이나 기능에서 반복해서 조회할 수 있습니다.  

- 마이페이지
- 게시글 작성자 정보
- 댓글 작성자 정보
- 사용자 포인트 표시
- 사용자 상태 확인

Redis Hash는 사용자 프로필을 필드 단위로 저장합니다.  

```text
hash:user-profile:1
  id        → "1"
  email     → "kim@example.com"
  name      → "Kim"
  point     → "100"
  status    → "ACTIVE"
  createdAt → "..."
  updatedAt → "..."
```

이렇게 저장하면 `name`, `status`, `point` 같은 특정 필드를 다루기 쉬워집니다.  

사용자 프로필 Hash 키는 기존 `RedisKey` 유틸리티를 그대로 사용합니다.  

```typescript
RedisKey.hash.userProfile(userId);
```

실제 키는 다음과 같습니다.  

```text
hash:user-profile:1
hash:user-profile:2
```

사용자 프로필 Hash 캐시의 전체 동작 흐름은 다음과 같습니다.  

![Redis Hash 사용자 프로필 캐시 조회·저장·갱신 흐름](/assets/images/nodejs/nodejs-redis/redis-hash-user-profile-cache-flow-v3.png)

### 🟦 Hash 캐시 조회

```typescript
// src/ch06/user-hash.service.ts

/**
 * 사용자 프로필 조회
 *
 * 1. Redis Hash를 조회합니다.
 * 2. 캐시가 있으면 Redis 데이터를 반환합니다.
 * 3. 캐시가 없으면 DB를 조회합니다.
 * 4. DB 조회 결과를 Redis Hash에 저장합니다.
 *
 * Redis Hash는 필요한 필드만 따로 읽거나 갱신할 수 있습니다.
 */
async getUserProfile(userId: number): Promise<UserProfileOutput> {
  // Cache Hit: Redis Hash에 데이터가 있으면 DB를 조회하지 않습니다.
  const cachedProfile = await this.getUserProfileFromHash(userId);

  if (cachedProfile) {
    return cachedProfile;
  }

  // Cache Miss: Redis Hash에 없을 때만 DB를 조회합니다.
  const dbProfile = await this.getUserProfileFromDatabase(userId);

  // DB 조회 결과를 다음 요청에서 재사용할 수 있도록 저장합니다.
  await this.saveUserProfileToHash(dbProfile);

  return dbProfile;
}
```

String 캐시와 Hash 캐시의 차이는 다음과 같습니다.  

```text
String 캐시
→ 객체 전체를 JSON 문자열 하나로 저장

Hash 캐시
→ 객체를 필드와 값 단위로 나누어 저장
```

### 🟦 Hash 캐시 저장

```typescript
/**
 * 사용자 프로필을 Redis Hash에 저장합니다.
 *
 * 1. userId로 Redis Hash 키를 만듭니다.
 * 2. UserProfileOutput의 값을 Redis Hash 필드로 저장합니다.
 * 3. TTL을 설정해 오래된 캐시가 무기한 남지 않게 합니다.
 */
async saveUserProfileToHash(
  user: UserProfileOutput,
  ttlSeconds = 300,
): Promise<void> {
  // 0 이하의 TTL은 캐시를 즉시 삭제하므로 저장 전에 차단합니다.
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('ttlSeconds must be a positive integer');
  }

  // 예: hash:user-profile:1
  const key = RedisKey.hash.userProfile(user.id);

  // HSET과 EXPIRE를 Transaction으로 묶어 Hash와 TTL을 함께 저장합니다.
  // Redis Hash의 필드 값은 문자열로 저장합니다.
  await redis
    .multi()
    .hSet(key, {
      id: String(user.id),
      email: user.email,
      name: user.name,
      point: String(user.point),
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .expire(key, ttlSeconds)
    .exec();
}
```

`HSET`과 `EXPIRE`를 따로 실행하면 두 명령 사이에 오류가 발생했을 때 TTL이 없는 Hash만 남을 수 있습니다.  
예시 코드에서는 두 명령을 Redis Transaction으로 묶어 프로필 저장과 TTL 설정 사이에 다른 명령이 끼어들지 않게 합니다.  

### 🟦 사용자 수정 후 Hash 갱신

사용자 프로필을 수정할 때는 DB를 먼저 수정합니다.  
그다음 수정된 DB 결과를 Redis Hash에 다시 저장합니다.  

이 방식은 Redis Hash를 최신 상태로 바로 맞추는 방식입니다.  

```text
DB 수정
  ↓
DB 결과를 UserProfileOutput으로 변환
  ↓
Redis Hash 갱신
```

```typescript
/**
 * 사용자 프로필을 수정합니다.
 *
 * 1. userId에 해당하는 사용자의 name 또는 status를 수정합니다.
 * 2. undefined가 아닌 필드만 수정 데이터에 포함합니다.
 * 3. 수정 결과를 UserProfileOutput 형태로 변환합니다.
 * 4. Redis Hash를 최신 데이터로 다시 저장합니다.
 *
 * DB를 먼저 수정한 뒤 Redis Hash를 갱신하는 흐름입니다.
 */
async updateUserProfile(
  userId: number,
  input: UpdateUserProfileInput,
): Promise<UserProfileOutput> {
  // 대상 사용자가 없으면 Prisma는 P2025 예외를 던집니다.
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      // undefined인 필드는 수정하지 않습니다.
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
    },
    select: UserProfileSelect,
  });

  const output = toUserProfileOutput(user);

  // DB 수정 후 Redis Hash도 같은 값으로 갱신합니다.
  await this.saveUserProfileToHash(output);

  return output;
}
```

일반적으로 다음 두 가지 방식 중 하나를 선택합니다.  

```text
방식 1. DB 수정 후 Redis Hash 갱신
- 장점: 다음 조회부터 바로 Redis를 사용할 수 있습니다.
- 단점: 캐시 갱신 코드가 복잡해질 수 있습니다.

방식 2. DB 수정 후 Redis Hash 삭제
- 장점: 단순하고 안전합니다.
- 단점: 다음 조회에서 DB를 다시 조회해야 합니다.
```

## 2. 로그인 세션 저장하기 {#session-02}

로그인 세션은 Redis Hash와 잘 어울리는 대표적인 데이터입니다.  
세션에는 보통 다음과 같은 필드가 들어갑니다.  

- `sessionId`
- `userId`
- `email`
- `role`
- `issuedAt`
- `expiresAt`
- `lastAccessedAt`
- `userAgent`
- `ip`

이 데이터는 하나의 객체이지만 필드 단위로 조회하거나 갱신할 일이 있습니다.  

예를 들어 다음과 같이 처리할 수 있습니다.  

- 세션의 `userId`만 조회
- 세션 만료 시간 확인
- 마지막 접근 시간 갱신
- 세션 전체 삭제

로그인 세션 정보 Hash 키는 기존 `RedisKey` 유틸리티를 그대로 사용합니다.  

```typescript
RedisKey.hash.userSession(sessionId);
```

실제 키는 다음과 같습니다.  

```text
hash:session:session-abc-123
```

로그인 세션 Hash의 생성·인증·접근 시간 갱신 흐름은 다음과 같습니다.  

![Redis Hash 로그인 세션 생성·인증·접근 시간 갱신 흐름](/assets/images/nodejs/nodejs-redis/redis-hash-login-session-flow.png)

### 🟦 세션 생성

```typescript
// src/ch06/session-hash.service.ts

/**
 * 로그인 세션을 생성합니다.
 *
 * 1. sessionId로 Redis Hash 키를 만듭니다.
 * 2. 현재 시간을 기준으로 발급 시간과 만료 시간을 계산합니다.
 * 3. 세션 정보를 Redis Hash 필드로 저장합니다.
 * 4. TTL을 설정해 만료 시간이 지나면 자동으로 삭제되게 합니다.
 */
async createSession(
  input: CreateSessionInput,
  ttlSeconds = 60 * 60,
): Promise<SessionOutput> {
  // 0 이하의 TTL은 세션을 즉시 만료시키므로 저장 전에 차단합니다.
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('ttlSeconds must be a positive integer');
  }

  // 예: hash:session:abc123
  const key = RedisKey.hash.userSession(input.sessionId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const session: SessionOutput = {
    sessionId: input.sessionId,
    userId: input.userId,
    email: input.email,
    role: input.role,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastAccessedAt: now.toISOString(),
    userAgent: input.userAgent ?? '',
    ip: input.ip ?? '',
  };

  // HSET과 EXPIRE는 각각 별도의 Redis 명령이므로 두 작업은 원자적이지 않습니다.
  // HSET 성공 후 EXPIRE 실행 전에 연결 오류나 프로세스 종료가 발생하면
  // TTL이 없는 세션 Hash가 남아 자동으로 만료되지 않을 수 있습니다.
  // 이를 방지하려면 MULTI/EXEC 또는 Lua Script로 두 명령을 하나의 작업으로 묶어야 합니다.

  await redis
    .multi()
    .hSet(key, {
      sessionId: session.sessionId,
      userId: String(session.userId),
      email: session.email,
      role: session.role,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt,
      lastAccessedAt: session.lastAccessedAt,
      userAgent: session.userAgent,
      ip: session.ip,
    })
    .expire(key, ttlSeconds)
    .exec();

  return session;
}
```

저장 결과는 다음과 같습니다.  

```text
hash:session:session-abc-123
sessionId      = "session-abc-123"
userId         = "1"
email          = "kim@example.com"
role           = "USER"
issuedAt       = "2026-06-17T00:00:00.000Z"
expiresAt      = "2026-06-17T01:00:00.000Z"
lastAccessedAt = "2026-06-17T00:00:00.000Z"
userAgent      = "Chrome"
ip             = "127.0.0.1"
```

세션은 영구 데이터가 아니므로 Hash를 저장할 때 `.expire(key, ttlSeconds)`로 TTL도 함께 설정합니다.  
예시 코드에서는 `HSET`과 `EXPIRE`를 같은 Transaction 안에서 실행합니다.  

### 🟦 특정 필드만 조회하기

Hash의 장점은 특정 필드만 조회할 수 있다는 것입니다.  

```typescript
/** 세션의 사용자 ID만 조회합니다. */
async getSessionUserId(sessionId: string): Promise<number | null> {
  const key = RedisKey.hash.userSession(sessionId);
  const userId = await redis.hGet(key, 'userId');

  if (userId === null) {
    return null;
  }

  const parsedUserId = Number(userId);

  // 올바른 정수로 변환할 수 없는 값은 유효하지 않은 세션으로 처리합니다.
  return Number.isInteger(parsedUserId) ? parsedUserId : null;
}
```

세션 전체를 가져오지 않고 `userId` 필드만 조회합니다.  

```text
HGET hash:session:session-abc-123 userId
→ "1"
```

이 방식은 인증 미들웨어에서 유용합니다.  

```text
요청 쿠키에서 sessionId 확인
  ↓
Redis Hash에서 userId만 조회
  ↓
userId가 있으면 인증된 사용자로 처리
```

### 🟦 특정 필드만 갱신하기

Hash를 사용하면 세션 전체를 다시 저장하지 않고 마지막 접근 시간만 갱신할 수 있습니다.  

```typescript
// 세션이 존재할 때만 마지막 접근 시간을 수정합니다.
// EXISTS와 HSET을 한 스크립트로 묶어 경쟁 조건도 방지합니다.
const TOUCH_SESSION_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 0 then
    return 0
  end

  redis.call('HSET', KEYS[1], 'lastAccessedAt', ARGV[1])
  return 1
`;

/**
 * 마지막 접근 시간을 갱신합니다.
 *
 * 1. sessionId로 Redis Hash 키를 만듭니다.
 * 2. 현재 시간을 ISO 문자열로 만듭니다.
 * 3. 세션이 존재하면 lastAccessedAt 필드만 갱신합니다.
 */
async touchSession(sessionId: string): Promise<void> {
  const key = RedisKey.hash.userSession(sessionId);

  // 일반 HSET은 키가 없으면 새 Hash를 만들기 때문에 Lua 스크립트에서
  // 존재 여부 확인과 필드 수정을 원자적으로 처리합니다.
  await redis.eval(TOUCH_SESSION_SCRIPT, {
    keys: [key],
    arguments: [new Date().toISOString()],
  });
}
```

`HSET`은 키가 없으면 새로운 Hash를 만듭니다.  
예시 코드에서는 Lua 스크립트의 `EXISTS`와 `HSET`을 한 번에 실행해 만료된 세션이 불완전한 Hash로 다시 생성되지 않도록 처리합니다.  
`HSET`은 기존 키의 TTL을 연장하지 않으므로 이 메서드는 `lastAccessedAt`만 바꾸고, 세션을 만들 때 정한 만료 시각은 그대로 유지합니다.  

## 3. 상품 재고 상태 캐싱하기 {#session-03}

상품 상세 페이지에서는 다음 정보를 반복해서 조회할 수 있습니다.  

- 현재 재고 수량
- 판매 상태
- 예약 재고
- 마지막 갱신 시간

이 데이터는 필드 단위로 갱신될 가능성이 높습니다.  

```text
stock만 변경
status만 변경
reservedStock만 변경
```

따라서 Redis Hash로 저장하면 필드 단위 수정 흐름을 자연스럽게 만들 수 있습니다.  

상품 재고 상태 Hash 키는 기존 `RedisKey` 유틸리티를 그대로 사용합니다.  

```typescript
RedisKey.hash.productStock(productId);
```

실제 키는 다음과 같습니다.  

```text
hash:product-stock:1
hash:product-stock:2
```

상품 재고 Hash 캐시의 생성과 예약 재고 증감 흐름은 다음과 같습니다.  

![Redis Hash 상품 재고 캐시 생성·예약 재고 증감 흐름](/assets/images/nodejs/nodejs-redis/redis-hash-product-stock-flow.png)

### 🟦 재고 상태 생성

```typescript
// src/ch06/product-hash.service.ts

/** 재고 값이 0 이상의 정수인지 검증합니다. */
private validateStock(
  stock: number,
  fieldName: 'stock' | 'reservedStock',
): void {
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
}

/** 예약 재고 증감에 사용할 수량이 0보다 큰 정수인지 검증합니다. */
private validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive integer');
  }
}

/** 상품을 생성하고 재고 상태를 Redis Hash에 저장합니다. */
async createProduct(input: CreateProductInput): Promise<ProductStockOutput> {
  // 잘못된 재고가 DB에 저장되기 전에 서비스 경계에서 차단합니다.
  this.validateStock(input.stock, 'stock');

  const product = await prisma.product.create({
    data: {
      name: input.name,
      stock: input.stock,
      status: input.status ?? 'ON_SALE',
    },
    select: ProductStockSelect,
  });

  const output = toProductStockOutput(product);

  // DB 생성 결과를 기준으로 Redis Hash를 저장합니다.
  await this.saveProductStockToHash(output);

  return output;
}

/** 상품 재고 상태를 Redis Hash에 저장합니다. */
async saveProductStockToHash(
  product: ProductStockOutput,
  ttlSeconds = 300,
): Promise<void> {
  // 0 이하의 TTL은 캐시를 즉시 삭제하므로 저장 전에 차단합니다.
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('ttlSeconds must be a positive integer');
  }

  // 예: hash:product-stock:1
  const key = RedisKey.hash.productStock(product.productId);

  // HSET과 EXPIRE를 Transaction으로 묶어 Hash와 TTL을 함께 저장합니다.
  await redis
    .multi()
    .hSet(key, {
      productId: String(product.productId),
      name: product.name,
      stock: String(product.stock),
      reservedStock: String(product.reservedStock),
      availableStock: String(product.availableStock),
      status: product.status,
      updatedAt: product.updatedAt,
    })
    .expire(key, ttlSeconds)
    .exec();
}
```

Redis에는 다음과 같이 저장됩니다.  

```text
hash:product-stock:1
productId      = "1"
name           = "기계식 키보드"
stock          = "100"
reservedStock  = "3"
availableStock = "97"
status         = "ON_SALE"
updatedAt      = "2026-06-17T00:00:00.000Z"
```

### 🟦 예약 재고를 Hash에서 관리하기

예약 재고는 동시에 여러 요청이 변경할 수 있습니다.  
단순히 Hash를 읽은 뒤 계산해 다시 저장하면, 두 요청이 같은 값을 읽고 갱신하면서 한쪽의 변경이 사라질 수 있습니다.  
에시 코드는 `WATCH`로 Hash의 변경을 감시하고, 충돌하면 최신 값을 다시 읽어 계산합니다.  

```typescript
// 파일 위쪽에서 WATCH 충돌을 구분할 오류 타입을 가져옵니다.
import { WatchError } from 'redis';

// 아래 코드는 ProductHashService 클래스 내부입니다.
// WATCH 충돌이 계속될 때 무한히 반복하지 않도록 재시도 횟수를 제한합니다.
private readonly reservationTransactionMaxRetries = 10;

/** WATCH Transaction을 사용해 예약 재고를 증가시킵니다. */
async increaseReservedStock(
  productId: number,
  quantity: number,
): Promise<ProductStockOutput> {
  this.validateQuantity(quantity);

  return this.updateReservedStockWithTransaction(
    productId,
    quantity,
    'increase',
  );
}

/** WATCH Transaction을 사용해 예약 재고를 감소시킵니다. */
async decreaseReservedStock(
  productId: number,
  quantity: number,
): Promise<ProductStockOutput> {
  this.validateQuantity(quantity);

  return this.updateReservedStockWithTransaction(
    productId,
    quantity,
    'decrease',
  );
}

/** 예약 재고를 낙관적 잠금으로 증감시킵니다. */
private async updateReservedStockWithTransaction(
  productId: number,
  quantity: number,
  operation: 'increase' | 'decrease',
): Promise<ProductStockOutput> {
  const key = RedisKey.hash.productStock(productId);

  // WATCH할 대상이 완전한 Hash가 되도록 캐시가 없으면 DB 값으로 생성합니다.
  await this.getProductStock(productId);

  // WATCH는 연결 단위로 동작하므로 공유 Client와 분리한 전용 연결을 만듭니다.
  const transactionClient = redis.duplicate();
  transactionClient.on('error', (error) => {
    console.error('[Redis Transaction Error]', error);
  });
  await transactionClient.connect();

  try {
    for (
      let attempt = 1;
      attempt <= this.reservationTransactionMaxRetries;
      attempt += 1
    ) {
      // WATCH 이후 EXEC 전에 다른 요청이 key를 바꾸면 Transaction이 중단됩니다.
      await transactionClient.watch(key);

      // WATCH한 뒤 읽은 값을 기준으로 다음 예약 재고를 계산합니다.
      const hash = await transactionClient.hGetAll(key);
      const current = parseProductStockHash(hash);

      // 감시 직후 캐시가 사라졌거나 손상됐다면 복구한 뒤 다시 시도합니다.
      if (!current) {
        await transactionClient.unwatch();
        await this.getProductStock(productId);
        continue;
      }

      const nextReservedStock =
        operation === 'increase'
          ? current.reservedStock + quantity
          : Math.max(current.reservedStock - quantity, 0);

      const updated: ProductStockOutput = {
        ...current,
        reservedStock: nextReservedStock,
        availableStock: current.stock - nextReservedStock,
        updatedAt: new Date().toISOString(),
      };

      try {
        // 감시한 값이 그대로일 때만 Hash 갱신과 TTL 설정을 함께 실행합니다.
        await transactionClient
          .multi()
          .hSet(key, {
            productId: String(updated.productId),
            name: updated.name,
            stock: String(updated.stock),
            reservedStock: String(updated.reservedStock),
            availableStock: String(updated.availableStock),
            status: updated.status,
            updatedAt: updated.updatedAt,
          })
          .expire(key, 300)
          .exec();

        return updated;
      } catch (error) {
        // 다른 요청이 key를 먼저 바꾸면 최신 값을 읽도록 반복문으로 돌아갑니다.
        if (error instanceof WatchError) {
          continue;
        }

        throw error;
      }
    }
  } finally {
    // 성공과 실패에 관계없이 전용 연결을 반드시 닫습니다.
    await transactionClient.close();
  }

  throw new Error(
    'Failed to update reserved stock due to concurrent modifications',
  );
}
```

`parseProductStockHash()`는 `hGetAll()` 결과를 `ProductStockOutput`으로 변환하고, 필수 필드가 빠지거나 숫자가 손상된 Hash는 `null`로 판단하는 실습 코드의 보조 함수입니다.  

흐름은 다음과 같습니다.  

```text
상품 재고 Hash가 없으면 DB 값으로 캐시 생성
  ↓
전용 Redis 연결에서 Hash WATCH
  ↓
WATCH 이후 현재 Hash 조회·검증
  ↓
reservedStock 증감과 availableStock 재계산
  ↓
MULTI/EXEC으로 Hash·TTL 갱신
  ↓
충돌하면 최신 값으로 재시도
```

예시 코드는 `WATCH` 충돌을 최대 10번까지 재시도해 동시 요청에서 갱신이 사라지 않게 합니다.  
다만 실제 주문 시스템에서는 재고 정확성이 매우 중요하므로 초과 예약 검증, DB 트랜잭션, 락과 재고 차감 정책이 함께 필요합니다.  

## 4. 사용자 설정 정보 관리하기 {#session-04}

사용자마다 다음과 같은 설정값을 저장할 수 있습니다.  

- `theme`
- `language`
- `emailNotification`
- `smsNotification`
- `marketingAgreed`

이 데이터는 필드 단위로 자주 수정됩니다.  

```text
테마만 변경
언어만 변경
이메일 알림 여부만 변경
```

따라서 JSON 문자열 전체를 다시 저장하는 것보다 Hash로 관리하는 것이 자연스럽습니다.  

사용자 설정 정보 Hash 키는 기존 `RedisKey` 유틸리티를 그대로 사용합니다.  

```typescript
RedisKey.hash.userSetting(userId);
```

실제 키는 다음과 같습니다.  

```text
hash:user-setting:1
hash:user-setting:2
```

사용자 설정 Hash의 조회·복구·부분 수정 흐름은 다음과 같습니다.  

![Redis Hash 사용자 설정 조회·복구·부분 수정 흐름](/assets/images/nodejs/nodejs-redis/redis-hash-user-setting-flow.png)

### 🟦 사용자 설정 저장

```typescript
// src/ch06/user-setting-hash.service.ts

/** 사용자 설정 전체를 Redis Hash에 저장합니다. */
async saveUserSettingToHash(setting: UserSettingOutput): Promise<void> {
  const key = RedisKey.hash.userSetting(setting.userId);

  await redis.hSet(key, {
    theme: setting.theme,
    language: setting.language,
    emailNotification: String(setting.emailNotification),
    smsNotification: String(setting.smsNotification),
    marketingAgreed: String(setting.marketingAgreed),
    updatedAt: setting.updatedAt,
  });
}
```

사용자 설정은 Redis Hash에 다음과 같이 저장됩니다.  

```text
hash:user-setting:1
theme             = "light"
language          = "ko"
emailNotification = "true"
smsNotification   = "false"
marketingAgreed   = "false"
updatedAt         = "2026-06-17T00:00:00.000Z"
```

Boolean 값은 Redis에 문자열로 저장합니다.  

```typescript
emailNotification: String(setting.emailNotification),
smsNotification: String(setting.smsNotification),
marketingAgreed: String(setting.marketingAgreed),
```

조회할 때는 다시 `boolean`으로 변환합니다.  
예시 코드에서는 일부 필드가 누락된 Hash를 읽을 때 기존 기본값이 잘못된 `false`로 바뀌지 않도록 기본값도 함께 처리합니다.  

```typescript
function parseBoolean(value: string | undefined): boolean {
  return value === 'true';
}

function parseBooleanWithDefault(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return parseBoolean(value);
}
```

설정 Hash가 아예 없으면 기본 설정을 새로 저장합니다.  
일부 필드만 남아 있으면 기본값을 병합한 뒤, 누락된 필드가 있을 때만 완성된 설정을 다시 저장합니다.  

```typescript
// userId는 Redis 키에 포함되므로 Hash에는 아래 필드가 모두 있어야 합니다.
const USER_SETTING_HASH_FIELDS = [
  'theme',
  'language',
  'emailNotification',
  'smsNotification',
  'marketingAgreed',
  'updatedAt',
] as const;

/** 사용자 설정을 조회하고 누락된 기본값을 보완합니다. */
async getUserSetting(userId: number): Promise<UserSettingOutput> {
  const key = RedisKey.hash.userSetting(userId);
  const hash = await redis.hGetAll(key);
  const setting = parseUserSettingHash(userId, hash);

  if (setting) {
    const hasMissingField = USER_SETTING_HASH_FIELDS.some(
      (field) => hash[field] === undefined,
    );

    if (hasMissingField) {
      // 기본값을 병합한 결과를 저장해 다음 조회부터 완전한 Hash를 사용합니다.
      await this.saveUserSettingToHash(setting);
    }

    return setting;
  }

  const defaultSetting = defaultUserSetting(userId);

  await this.saveUserSettingToHash(defaultSetting);

  return defaultSetting;
}
```

`parseUserSettingHash()`는 저장된 필드를 기본 설정과 병합하고, Hash가 비어 있으면 `null`을 반환합니다.  
`defaultUserSetting()`은 `light` 테마, `ko` 언어와 기본 알림 동의 값을 포함한 새 설정을 만듭니다.  

### 🟦 일부 필드만 수정하기

```typescript
/** 사용자 설정 일부를 수정합니다. */
async updateUserSetting(
  userId: number,
  input: UpdateUserSettingInput,
): Promise<UserSettingOutput> {
  // Hash가 없거나 불완전할 수 있으므로 기본 설정 전체를 먼저 보장합니다.
  await this.getUserSetting(userId);

  const key = RedisKey.hash.userSetting(userId);
  const fieldsToUpdate: Record<string, string> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.theme !== undefined) {
    fieldsToUpdate.theme = input.theme;
  }

  if (input.language !== undefined) {
    fieldsToUpdate.language = input.language;
  }

  if (input.emailNotification !== undefined) {
    fieldsToUpdate.emailNotification = String(input.emailNotification);
  }

  if (input.smsNotification !== undefined) {
    fieldsToUpdate.smsNotification = String(input.smsNotification);
  }

  if (input.marketingAgreed !== undefined) {
    fieldsToUpdate.marketingAgreed = String(input.marketingAgreed);
  }

  await redis.hSet(key, fieldsToUpdate);

  return this.getUserSetting(userId);
}
```

전달된 필드만 `fieldsToUpdate`에 담습니다.  
그다음 `hSet()`으로 해당 필드만 갱신합니다.  

예를 들어 테마만 변경하면 다음과 같이 동작합니다.  

```text
변경 요청:
{
  "theme": "dark"
}

Redis 반영:
HSET hash:user-setting:1 theme "dark" updatedAt "..."
```
