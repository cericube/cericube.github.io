---
layout: post
title: "04. Redis 실습 프로젝트 구성하기: Prisma, SQLite, Redis, Vitest"
description: "Prisma 7과 SQLite, Redis, Vitest를 사용하는 Redis 실습 프로젝트의 구조를 설계하고 공통 연결 코드와 테스트 환경을 구성합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis 실습 프로젝트 목표와 전체 구조 설계하기"
  - id: session-02
    title: "2. Prisma 7과 SQLite로 스키마 구성하기"
  - id: session-03
    title: "3. Redis 연결 코드와 공통 라이브러리 구성하기"
  - id: session-04
    title: "4. Vitest 기반 테스트 환경 구성하기"
---


## 1. Redis 실습 프로젝트 목표와 전체 구조 설계하기 {#session-01}

Redis의 여러 자료 구조를 단순한 명령어 수준에서만 확인하지 않고, 실제 백엔드 서비스 코드에서 어떻게 활용할 수 있는지 살펴보겠습니다.  

```text
String      → 사용자 조회 캐싱, 인증 코드, 조회수 카운터, Rate Limiting
Hash        → 사용자 프로필, 세션, 상품 재고, 사용자 설정
List        → 최근 본 게시글, 최근 검색어, 간단한 작업 큐, 로그 버퍼
Set         → 좋아요, 일일 방문자, 온라인 사용자, 중복 요청 방지
Sorted Set  → 인기 게시글, 검색어 순위, 사용자 포인트, 우선순위 큐
Stream      → 주문 이벤트, 알림 이벤트 큐, 이메일 작업 큐, 감사 로그
Pub/Sub     → 실시간 알림, 캐시 무효화, 채팅 브로드캐스트, 관리자 공지
```

### 🟦 루트 프로젝트 안에 독립 하위 프로젝트로 구성하기

기존 루트 프로젝트 안에 `redis-basics`를 별도 하위 프로젝트로 구성합니다.  

```text
nodejs-workbook/
├─ prisma-basics/
├─ redis-basics/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ prisma.config.ts
│  ├─ vitest.config.ts
│  ├─ src/
│  └─ tests/
├─ .prettierrc
├─ .gitignore
├─ eslint.config.mjs
├─ package.json
└─ tsconfig.json
```

`redis-basics`는 루트 프로젝트 안에 있지만, 자체 `package.json`, `tsconfig.json`, `prisma.config.ts`, `vitest.config.ts`를 가지는 독립 실습 프로젝트로 관리합니다. 루트에 설치된 공통 개발 도구는 함께 사용하고, Redis와 Prisma처럼 실행에 필요한 패키지는 `redis-basics/package.json`에 직접 등록합니다.  

### 🟦 workspace에 redis-basics 등록하기

루트 `package.json`에는 `redis-basics`를 workspace로 등록합니다. 다음 코드는 workspace 등록에 필요한 부분을 중심으로 줄인 예시입니다. 실제 파일에 이미 있는 `engines`와 `devDependencies` 등의 설정은 그대로 유지합니다.  

```json
{
  "name": "nodejs-workbook",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "prisma-basics",
    "redis-basics"
  ]
}
```

이렇게 하면 루트 프로젝트에서 여러 하위 Node.js 프로젝트를 함께 관리할 수 있습니다.  

## 2. Prisma 7과 SQLite로 스키마 구성하기 {#session-02}

### 🟦 실습용 패키지 설치하기

`redis-basics` 하위 프로젝트에서 필요한 패키지를 설치합니다.  

```bash
pwd
/home/ubuntu/blog-workspaces/nodejs-workbook/redis-basics

# Prisma 기본 패키지를 설치합니다.
npm install @prisma/client@7
npm install -D prisma@7

# SQLite Adapter 패키지를 설치합니다.
npm install @prisma/adapter-better-sqlite3@7 better-sqlite3
npm install -D @types/better-sqlite3

# Redis Client를 설치합니다.
npm install redis@6

# 환경 변수 패키지를 설치합니다.
# dotenv 는 nodejs-workbook 루트의 dependencies에 설치되어 있습니다.

# Vitest는 nodejs-workbook 루트의 devDependencies에 설치되어 있으므로
# redis-basics에서 별도로 설치하지 않고 공통으로 사용합니다.
```

`@prisma/client`는 다른 workspace에 설치되어 있으면 루트 `node_modules`를 통해 우연히 참조될 수도 있습니다. 하지만 `redis-basics`만 따로 설치해도 정상적으로 실행되어야 하므로, 반드시 `redis-basics/package.json`의 직접 의존성으로 등록합니다.  

설치가 끝나면 다음과 같은 패키지 목록을 확인할 수 있습니다.  

```console
npm list
nodejs-workbook@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook
└─┬ redis-basics@1.0.0 -> ./redis-basics
  ├── @prisma/adapter-better-sqlite3@7.9.1
  ├── @prisma/client@7.9.1
  ├── @types/better-sqlite3@9.6.0
  ├── better-sqlite3@13.0.3
  ├── prisma@7.9.1
  └── redis@6.2.0
```

### 🟦 Prisma 초기화(npx prisma init)

```bash
cd ~/blog-workspaces/nodejs-workbook/redis-basics
npx prisma init
```

실행 후 일반적으로 다음 파일이 생성됩니다.  

- `prisma/schema.prisma`: 모델, 데이터 소스와 Prisma Client 생성 설정을 관리합니다.  
- `.env`: 프로젝트의 데이터베이스 접속 정보를 보관합니다.  
- `prisma.config.ts`: 프로젝트 단위 Prisma CLI 설정을 관리합니다.  

### 🟦 .env 설정하기

```dotenv
REDIS_URL=redis://:mypassword@127.0.0.1:6379

# prisma.config.ts가 프로젝트 루트에 있으므로 prisma/redis-basics.db를 명시합니다.
DATABASE_URL="file:./prisma/redis-basics.db"
```

`mypassword`에는 앞에서 Docker Compose로 Redis를 구성할 때 지정한 비밀번호를 입력합니다. 실제 비밀번호는 Git에 커밋하지 않고 `.env`에서만 관리합니다.  

### 🟦 prisma.config.ts 작성하기

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Prisma CLI가 사용할 스키마 파일의 경로입니다.
  schema: 'prisma/schema.prisma',

  // 마이그레이션 파일들이 저장될 경로를 지정합니다.
  // migrate dev 실행 시 생성되는 SQL/메타 파일들이 이 폴더에 쌓입니다.
  migrations: {
    path: 'prisma/migrations',
  },
  // Prisma CLI가 DB에 연결할 때 사용할 연결 문자열을 어디서 가져올지입니다.

  // exactOptionalPropertyTypes: true에서는 다음 두 상태를 구분합니다.
  // {}                      url을 전달하지 않음: 허용
  // { url: 'postgres...' }  string 전달: 허용
  // { url: undefined }      undefined를 명시적으로 전달: 오류
  // exactOptionalPropertyTypes를 끄기보다는 Prisma의 env()를 사용하는 것이 가장 적절합니다.

  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### 🟦 Prisma Schema 작성하기: prisma/schema.prisma

```prisma
// Prisma Client 생성 설정입니다.
// Prisma 7부터 provider로 "prisma-client"를 사용합니다.
// Prisma 7에서는 output 경로를 반드시 지정해야 합니다.
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// 사용자 정보 모델입니다.
// Redis String은 사용자 조회 캐싱에 사용합니다.
// Redis Hash는 사용자 프로필, 세션, 사용자 설정에 사용합니다.
// Redis Sorted Set은 사용자 포인트 랭킹 실습에 사용합니다.
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  point     Int      @default(0)
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 사용자가 작성한 게시글 목록입니다.
  posts Post[]

  // 사용자의 주문 목록입니다.
  orders Order[]
}

// 게시글 모델입니다.
// Redis String은 조회수 카운터에 사용합니다.
// Redis List는 최근 본 게시글에 사용합니다.
// Redis Set은 좋아요 사용자 목록에 사용합니다.
// Redis Sorted Set은 인기 게시글 랭킹 실습에 사용합니다.
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  authorId  Int
  status    String   @default("DRAFT")
  viewCount Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 게시글 작성자와의 관계를 설정합니다.
  author User @relation(fields: [authorId], references: [id])
}

// 상품 모델입니다.
// Redis Hash를 상품 재고 상태 캐싱 실습에 사용합니다.
model Product {
  id        Int      @id @default(autoincrement())
  name      String
  stock     Int      @default(0)
  status    String   @default("ON_SALE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 주문 모델입니다.
// Redis Stream을 주문 생성 이벤트 실습에 사용합니다.
model Order {
  id         Int      @id @default(autoincrement())
  userId     Int
  status     String   @default("CREATED")
  totalPrice Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // 주문한 사용자와의 관계를 설정합니다.
  user User @relation(fields: [userId], references: [id])
}

// 감사 로그 모델입니다.
// Redis Stream을 감사 로그 이벤트 실습에 사용합니다.
// 데이터베이스 저장 방식과 Redis Stream 저장 방식을 비교할 때 사용합니다.
model AuditLog {
  id        Int      @id @default(autoincrement())
  action    String
  target    String
  message   String
  createdAt DateTime @default(now())
}
```

### 🟦 데이터베이스와 Prisma Client 생성하기

```bash
# schema.prisma의 내용대로 데이터베이스 테이블을 생성합니다.
npx prisma migrate dev --name init
```

```console
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
Datasource "db": SQLite database "redis-basics.db" at "file:./prisma/redis-basics.db"
```

```bash
# Prisma Client 코드를 생성합니다.
npx prisma generate

# 실행 후 src/generated/prisma/ 경로에 Prisma Client 코드가 생성됩니다.
```

## 3. Redis 연결 코드와 공통 라이브러리 구성하기 {#session-03}

### 🟦 Prisma Client 공통 파일 작성하기: src/shared/prisma.ts

```typescript
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// .env 파일에 정의된 DATABASE_URL 값을 읽어옵니다.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env file');
}

// Prisma에 전달할 Better SQLite3 어댑터 인스턴스를 생성합니다.
const adapter = new PrismaBetterSqlite3({
  url: connectionString,
});

// Prisma Client를 생성하여 애플리케이션에서 재사용할 수 있도록 내보냅니다.
// 사용하는 파일의 위치에 맞는 상대 경로로 prisma를 가져와 재사용합니다.
export const prisma = new PrismaClient({
  adapter,
});
```

이 파일은 모든 Service에서 공통으로 사용하는 Prisma Client입니다.  

### 🟦 Redis Client 공통 파일 작성하기: src/shared/redis.ts

```typescript
import 'dotenv/config';
import { createClient } from 'redis';

// 환경 변수에서 Redis 연결 URL을 읽어옵니다.
const redisUrl = process.env.REDIS_URL;

// REDIS_URL이 정의되어 있지 않으면 애플리케이션 실행을 중단합니다.
if (!redisUrl) {
  throw new Error('REDIS_URL is not defined');
}

// URL을 사용하여 Redis 서버에 연결할 Client를 생성합니다.
export const redis = createClient({
  url: redisUrl,
});

// Redis Client에서 발생하는 오류를 콘솔에 출력합니다.
redis.on('error', (error) => {
  console.error('[Redis Error]', error);
});

// 연결되어 있지 않을 때만 Redis 서버에 연결합니다.
export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

// 연결이 열려 있으면 quit()을 호출하여 안전하게 연결을 종료합니다.
export async function disconnectRedis() {
  if (redis.isOpen) {
    await redis.quit();
  }
}
```

### 🟦 RedisKey 유틸리티 파일 만들기: src/shared/redis-key.ts

```typescript
/**
 * Redis Key 규칙을 한 곳에서 관리하는 유틸리티입니다.
 *
 * 기본 규칙은 다음과 같습니다.
 * - cache:*   : JSON 캐시입니다.
 * - string:*  : Redis String 실습입니다.
 * - hash:*    : Redis Hash 실습입니다.
 * - list:*    : Redis List 실습입니다.
 * - set:*     : Redis Set 실습입니다.
 * - zset:*    : Redis Sorted Set 실습입니다.
 * - stream:*  : Redis Stream 실습입니다.
 * - channel:* : Redis Pub/Sub 실습입니다.
 */
export const RedisKey = {
  cache: {
    user: (userId: number) => `cache:user:${userId}`, // 사용자 단건 조회 캐시입니다.
  },

  string: {
    authCode: (email: string) => `string:auth-code:${email}`, // 이메일 인증 코드입니다.
    rateLimit: (key: string) => `string:rate-limit:${key}`, // 요청 횟수 제한입니다.
    postViewCount: (postId: number) => `string:post-view-count:${postId}`, // 게시글 조회수입니다.
  },

  hash: {
    userProfile: (userId: number) => `hash:user-profile:${userId}`, // 사용자 프로필입니다.
    userSession: (sessionId: string) => `hash:session:${sessionId}`, // 로그인 세션입니다.
    userSetting: (userId: number) => `hash:user-setting:${userId}`, // 사용자 설정입니다.
    productStock: (productId: number) => `hash:product-stock:${productId}`, // 상품 재고입니다.
  },

  list: {
    postRecentViews: (userId: number) => `list:user:${userId}:recent-posts`, // 최근 본 게시글입니다.
    searchRecent: (userId: number) => `list:user:${userId}:recent-searches`, // 최근 검색어입니다.
    simpleJobQueue: () => `list:simple-job-queue`, // 간단한 작업 큐입니다.
    logBuffer: () => `list:log-buffer`, // 최근 로그 버퍼입니다.
  },

  set: {
    postLikes: (postId: number) => `set:post-likes:${postId}`, // 좋아요 사용자 목록입니다.
    dailyVisitors: (date: string) => `set:daily-visitors:${date}`, // 일일 방문자 목록입니다.
    onlineUsers: () => `set:online-users`, // 현재 온라인 사용자 목록입니다.
    duplicateRequest: (requestId: string) => `set:duplicate-request:${requestId}`, // 중복 요청 방지용입니다.
  },

  zset: {
    postRanking: () => `zset:post-ranking`, // 인기 게시글 순위입니다.
    searchRanking: () => `zset:search-ranking`, // 인기 검색어 순위입니다.
    userPointRanking: () => `zset:user-point-ranking`, // 사용자 포인트 순위입니다.
    priorityQueue: () => `zset:priority-queue`, // 우선순위 큐입니다.
  },

  stream: {
    orders: () => `stream:orders`, // 주문 이벤트 Stream입니다.
    notifications: () => `stream:notifications`, // 알림 이벤트 큐입니다.
    emails: () => `stream:emails`, // 이메일 작업 큐입니다.
    auditLogs: () => `stream:audit-logs`, // 감사 로그 Stream입니다.
  },

  channel: {
    notification: () => `channel:notification`, // 실시간 알림 채널입니다.
    cacheInvalidation: () => `channel:cache-invalidation`, // 캐시 무효화 채널입니다.
    chat: (roomId: string) => `channel:chat:${roomId}`, // 채팅방 메시지 채널입니다.
    adminNotice: () => `channel:admin-notice`, // 관리자 공지 채널입니다.
  },
} as const;
```

### 🟦 CacheService 기본 구조 만들기: src/ch04/cache.service.ts

```typescript
import { redis } from '../shared/redis.js';

/**
 * Redis String 기반 JSON 캐시를 다루는 공통 Service입니다.
 *
 * Redis의 String 자료 구조는 문자열만 저장할 수 있으므로,
 * 객체 데이터는 JSON.stringify()로 문자열로 변환한 뒤 저장하고
 * 조회할 때는 JSON.parse()로 다시 객체로 변환합니다.
 *
 * 사용자 조회 결과, 게시글 상세 조회 결과, 상품 상세 정보 등을
 * 캐싱할 때 사용할 수 있습니다.
 */
export class CacheService {
  /**
   * Redis에서 JSON 문자열을 조회한 뒤 객체로 변환합니다.
   *
   * @param key 조회할 Redis Key입니다.
   * @returns 캐시가 있으면 객체를 반환하고, 없으면 null을 반환합니다.
   */
  async getJson<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as T;
    } catch {
      // JSON 형식이 잘못된 캐시는 삭제하고 캐시가 없는 것으로 처리합니다.
      await this.deleteCache(key);
      return null;
    }
  }

  /**
   * 객체 데이터를 JSON 문자열로 변환하여 Redis에 저장합니다.
   * TTL을 함께 설정하여 캐시가 일정 시간이 지나면 자동으로 만료되게 합니다.
   *
   * @param key 저장할 Redis Key입니다.
   * @param value 저장할 객체 데이터입니다.
   * @param ttlSeconds 캐시 만료 시간이며 초 단위입니다.
   */
  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be a positive integer');
    }

    const serializedValue = JSON.stringify(value);

    // EX 옵션은 만료 시간을 초 단위로 설정합니다.
    await redis.set(key, serializedValue, {
      EX: ttlSeconds,
    });
  }

  /**
   * Redis Key를 삭제합니다.
   * 데이터베이스의 값이 수정되거나 삭제되었을 때 기존 캐시를 무효화하는 데 사용합니다.
   *
   * @param key 삭제할 Redis Key입니다.
   */
  async deleteCache(key: string): Promise<void> {
    await redis.del(key);
  }

  /**
   * Redis Key가 존재하는지 확인합니다.
   *
   * @param key 확인할 Redis Key입니다.
   * @returns Key가 존재하면 true를 반환하고, 없으면 false를 반환합니다.
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  }
}
```

## 4. Vitest 기반 테스트 환경 구성하기 {#session-04}

### 🟦 vitest.config.ts 작성하기

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 모든 테스트가 같은 SQLite 데이터베이스와 Redis DB를 공유하므로
    // 테스트 파일을 순차적으로 실행해 초기화 작업 간 충돌을 방지합니다.
    fileParallelism: false,
    // 각 테스트 파일을 실행하기 전에 DB 초기화 및 연결 종료 훅을 등록합니다.
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});
```

### 🟦 테스트 공통 setup 작성하기: tests/setup.ts

```typescript
import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/shared/prisma';
import { connectRedis, disconnectRedis } from '../src/shared/redis';

// 각 테스트 전에 데이터베이스와 Redis 데이터를 초기화합니다.
beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.post.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const redis = await connectRedis();
  await redis.flushDb();
});

// 모든 테스트가 끝나면 데이터베이스와 Redis 연결을 종료합니다.
afterAll(async () => {
  await prisma.$disconnect();
  await disconnectRedis();
});
```

### 🟦 기본 Service 테스트 작성하기: tests/ch04/redis-connections.test.ts

```typescript
import { describe, expect, it } from 'vitest';
import { redis } from '../../src/shared/redis.js';

describe('Redis Connection', () => {
  it('Redis에 값을 저장하고 조회할 수 있다', async () => {
    // Redis에 문자열을 저장한 뒤 같은 Key로 조회합니다.
    await redis.set('greeting', 'Hello, Redis!');

    const value = await redis.get('greeting');

    expect(value).toBe('Hello, Redis!');
  });
});
```

### 🟦 테스트 실행하기

```bash
npx vitest run ./tests/ch04/redis-connections.test.ts
```

```console
 RUN  v4.1.10 /home/ubuntu/blog-workspaces/nodejs-workbook/redis-basics

 ✓ tests/ch04/redis-connections.test.ts (1 test) 143ms
   ✓ Redis Connection (1)
     ✓ Redis에 값을 저장하고 조회할 수 있다 138ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:28:08
   Duration  665ms (transform 111ms, setup 369ms, import 11ms, tests 143ms, environment 0ms)
```
