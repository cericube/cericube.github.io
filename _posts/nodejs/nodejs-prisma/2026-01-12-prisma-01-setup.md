---
layout: post
title: "01. Prisma 개발 환경 구축과 프로젝트 초기화"
description: "기존 nodejs-workbook은 변경하지 않고 독립된 prisma-basics 하위 프로젝트에서 Prisma 7과 PostgreSQL을 설정하여 첫 데이터를 생성하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. 개발 환경 구축 및 프로젝트 초기화"
  - id: session-02
    title: "2. DB 연동 및 스키마 설계(PostgreSQL)"
  - id: session-03
    title: "3. DB 스키마 반영 및 Prisma Client 구현"
  - id: session-04
    title: "4. Prisma CLI 주요 명령어 정리"
---

## 1. 개발 환경 구축 및 프로젝트 초기화 {#session-01}

Prisma는 Node.js에서 데이터베이스를 다룰 때 SQL을 직접 작성하는 방식 대신 타입 안전한 데이터 접근 API를 제공하는 ORM 도구입니다.  

### 🟦 개발 환경 구축하기

Node.js와 TypeScript 개발 환경을 먼저 준비합니다.  

- [Node.js 기본 참조](/archives/nodejs/nodejs-environment/nodejs-3-typescript/){: target="_blank" rel="noopener noreferrer" }

### 🟦 실습 폴더 구조

실습의 효율성을 위해 Prisma 전용 설정을 한곳에 모으고, 각 장에서 이를 참조하는 구조를 사용합니다.  

```text
nodejs-workbook/                  # 상위 프로젝트
├── prisma-basics/
│   ├── prisma/
│   │   ├── schema.prisma     # DB 설계도입니다.
│   │   └── migrations/       # DB 스키마 변경 이력입니다.
│   ├── generated/
│   │   └── prisma/           # Prisma Client 생성물의 출력 경로입니다.
│   ├── src/
│   │   ├── shared/
│   │   │   └── database.ts   # generated/prisma/client를 불러옵니다.
│   │   └── ch01/
│   ├── .env                  # 환경 변수를 관리합니다.
│   ├── package-lock.json     # 설치한 의존성 버전을 고정합니다.
│   ├── prisma.config.ts      # 프로젝트 단위 Prisma CLI 설정입니다.
│   ├── package.json          # 서브 프로젝트 의존성을 관리합니다.
│   └── tsconfig.json         # 서브 프로젝트 컴파일 설정을 관리합니다.
├── src/                          # 기존 Node.js 실습 코드입니다.
├── tests/                        # 기존 테스트 코드입니다.
├── package.json                  # 기존 상위 프로젝트 설정입니다.
├── tsconfig.json                 # 기존 상위 프로젝트 설정입니다.
├── eslint.config.mjs             # 기존 상위 프로젝트 설정입니다.
└── .prettierrc                   # 기존 상위 프로젝트 설정입니다.
```

### 🟦 의존성 설치 및 초기화

```bash
# nodejs-workbook 프로젝트로 이동합니다.
cd ~/blog-workspaces/nodejs-workbook

# 독립된 Prisma 하위 프로젝트를 생성하고 이동합니다.
mkdir prisma-basics
cd prisma-basics

# Prisma 하위 프로젝트의 package.json을 생성합니다.
npm init -y

# TypeScript 실행 환경과 Prisma CLI를 설치합니다.
npm install --save-dev typescript tsx @types/node prisma@7 @types/pg

# Prisma Client, PostgreSQL 드라이버와 어댑터를 설치합니다.
npm install @prisma/client@7 pg @prisma/adapter-pg dotenv

# TypeScript 설정 파일을 생성합니다.
npx tsc --init

# 문서의 실행 명령어와 연결할 npm 스크립트를 추가(package.json)합니다.
#
# npm pkg set scripts.typecheck="tsc --noEmit"
# npm pkg set scripts.start="tsx src/ch01/index.ts"
```

- `@prisma/client`: 실제 애플리케이션 코드에서 불러와 사용하는 ORM 라이브러리입니다.  
- `pg`(node-postgres): Node.js에서 PostgreSQL과 통신할 때 사용하는 드라이버입니다.  
- `@prisma/adapter-pg`: Prisma Client와 `pg`를 연결하는 드라이버 어댑터입니다.  
- `@types/pg`: `pg`의 TypeScript 타입 정의입니다.  
- `dotenv`: `.env` 파일의 환경 변수를 불러오는 라이브러리입니다.  

`prisma-basics`는 자체 `package.json`과 `package-lock.json`으로 의존성을 독립적으로 관리하는 하위 프로젝트입니다.  
Prisma CLI 실행과 타입 검사도 `prisma-basics` 디렉터리에서 수행합니다.  

TypeScript 공통 설정은 상위 프로젝트의 `tsconfig.json`을 상속하고, 하위 프로젝트에 필요한 항목만 `prisma-basics/tsconfig.json`에서 재정의합니다.  
상위 프로젝트의 경로 별칭은 사용하지 않으므로 `paths`를 초기화하고, 증분 빌드 정보는 하위 프로젝트의 `node_modules/.cache`에 별도로 저장합니다.  
`npx tsc --init`으로 생성한 파일의 내용을 다음 설정으로 교체합니다.  

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "paths": {},
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts", "prisma/**/*.ts", "prisma.config.ts"],
  "exclude": ["node_modules", "dist", "coverage", "generated"]
}
```

설치된 패키지는 다음과 같이 확인할 수 있습니다.  

```text
prisma-basics@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook/prisma-basics
├── @prisma/adapter-pg@7.9.1
├── @prisma/client@7.9.1
├── @types/node@26.1.2
├── @types/pg@8.20.3
├── dotenv@17.4.2
├── pg@8.22.0
├── prisma@7.9.1
├── tsx@4.23.1
└── typescript@7.0.2
```

`generated` 디렉터리는 Prisma가 자동으로 생성하는 Client 코드이므로 하위 프로젝트의 TypeScript 검사 대상에서 제외합니다.  

### 🟦 Prisma 초기화(`npx prisma init`)

```bash
cd ~/blog-workspaces/nodejs-workbook/prisma-basics
npx prisma init
```

실행 후 일반적으로 다음 파일이 생성됩니다.  

- `prisma/schema.prisma`: 모델, 데이터 소스와 Prisma Client 생성 설정을 관리합니다.  
- `.env`: 프로젝트의 데이터베이스 접속 정보를 보관합니다.  
- `prisma.config.ts`: 프로젝트 단위 Prisma CLI 설정을 관리합니다.  

## 2. DB 연동 및 스키마 설계(PostgreSQL) {#session-02}

### 🟦 `.env`에 PostgreSQL 연결 문자열 설정

`prisma-basics/.env`에 `DATABASE_URL`을 설정합니다.  

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/prisma_basics?schema=study"
```

- `USER`와 `PASSWORD`는 로컬 PostgreSQL 계정에 맞게 변경합니다.  

### 🟦 `prisma.config.ts` 설정 이해

`prisma.config.ts`는 Prisma CLI 설정을 코드로 관리하는 파일입니다.  

```typescript
// .env 파일의 값을 process.env에 불러옵니다.
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

  // exactOptionalPropertyTypes: true에서는 다음 세 가지 상태를 구분합니다.
  // {}                      url을 전달하지 않음: 허용
  // { url: 'postgres...' }  string 전달: 허용
  // { url: undefined }      undefined를 명시적으로 전달: 오류
  // exactOptionalPropertyTypes를 끄기보다는 Prisma의 env()를 사용하는 것이 가장 적절합니다.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### 🟦 `schema.prisma`의 핵심 블록 이해

`schema.prisma`는 크게 세 가지 블록으로 구성됩니다.  

#### 🔷 1. `generator client`: Prisma Client 생성 설정

애플리케이션 코드에서 사용할 타입 안전한 데이터베이스 접근 코드를 어떤 방식으로, 어디에 생성할지 정합니다.  
Prisma는 `schema.prisma`를 읽고 `prisma.user.findMany()`와 같은 API를 자동으로 만들어 Prisma Client로 제공합니다.  

```prisma
generator client {
  // Prisma 7에서 사용하는 생성기를 지정합니다.
  provider = "prisma-client"

  // Prisma Client를 생성할 경로를 지정합니다.
  output   = "../generated/prisma"
}
```

Prisma 7의 `prisma-client` 생성기는 `output` 경로를 명시해야 하며, 생성된 경로에서 `PrismaClient`를 불러옵니다.  
또한 데이터베이스 드라이버 어댑터를 전달하여 `PrismaClient`를 생성합니다.  

#### 🔷 2. `datasource db`: DB 종류와 연결 정보

Prisma가 PostgreSQL, MySQL, SQLite 등 어떤 데이터베이스를 사용할지 정의합니다.  
Prisma 7에서는 연결 URL을 앞에서 작성한 `prisma.config.ts`에 설정합니다.  

```prisma
datasource db {
  provider = "postgresql"
}
```

#### 🔷 3. `model`: 테이블, 관계와 인덱스 정의

데이터베이스의 테이블 구조를 Prisma Schema Language로 선언하는 부분입니다.  
다음 코드는 `model` 블록의 구성을 보여 주는 축약 예시이며, 전체 `Post` 모델은 아래 실습용 스키마에서 정의합니다.  

```prisma
model User {
  id          Int      @id @default(autoincrement())
  email       String   @unique
  displayName String?
  posts       Post[]
}
```

### 🟦 실습용 스키마 적용

트랜잭션과 조인 실습에 필요한 관계만 남겨 `User`, `Post`, `PostLike` 세 모델로 구성합니다.  
`User`와 `Post`는 일대다 관계이며, `PostLike`는 사용자와 게시글의 다대다 관계를 표현하는 명시적 조인 테이블입니다.  
트랜잭션은 스키마에 별도로 정의하지 않으며, 이후 nested write나 `$transaction`을 사용할 때 여러 작업을 원자적으로 처리합니다.  

```prisma
model User {
  id          Int      @id @default(autoincrement())
  email       String   @unique
  displayName String?  @map("display_name")
  createdAt   DateTime @default(now()) @map("created_at")

  // User가 작성한 게시글과 좋아요 관계를 정의합니다.
  posts Post[]
  likes PostLike[]

  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 여러 Post가 한 User를 참조하는 다대일 관계를 정의합니다.
  authorId Int  @map("author_id")
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  likes PostLike[]

  @@index([authorId])
  @@map("posts")
}

model PostLike {
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  // User와 Post를 연결하는 명시적 다대다 관계를 정의합니다.
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@id([userId, postId])
  @@index([postId])
  @@map("post_likes")
}
```

`PostLike`의 `@@id([userId, postId])`는 같은 사용자가 같은 게시글에 좋아요를 중복으로 등록하지 못하게 합니다.  
`@@index([postId])`는 특정 게시글을 기준으로 좋아요 목록을 조회할 때 사용할 인덱스입니다.  

![alt text](/assets/images/nodejs/nodejs-prisma/image-2026-01-12.png)

## 3. DB 스키마 반영 및 Prisma Client 구현 {#session-03}

### 🟦 DB 스키마 반영: `npx prisma migrate dev`

마이그레이션 파일을 생성하여 데이터베이스 변경 이력을 남기고 개발 데이터베이스에 적용합니다.  

```bash
cd ~/blog-workspaces/nodejs-workbook/prisma-basics

# Prisma 스키마의 변경 내용을 SQL 마이그레이션 파일로 만들고, 개발용 데이터베이스에 적용합니다.
npx prisma migrate dev --name init

# 스키마 경로를 직접 지정할 수도 있습니다.
npx prisma migrate dev --name init --schema ./prisma/schema.prisma

# schema.prisma를 읽어서 애플리케이션에서 사용할 Prisma Client 코드를 생성합니다.
npx prisma generate
```

PostgreSQL 데이터베이스와 사용할 스키마는 명령을 실행하기 전에 준비하는 것이 안전합니다.  
Prisma 7에서는 `migrate dev`가 Prisma Client를 자동 생성하지 않으므로, 마이그레이션 후 `npx prisma generate`를 별도로 실행합니다.  

### 🟦 `npx prisma db push`

마이그레이션 이력을 남기지 않고 현재 Prisma 스키마를 데이터베이스에 즉시 동기화합니다.  
빠르게 실습하거나 프로토타입을 만들 때 유용하지만, 변경 이력을 관리해야 하는 운영 환경이나 팀 협업에는 적합하지 않습니다.  

```bash
cd ~/blog-workspaces/nodejs-workbook/prisma-basics
npx prisma db push

# 스키마 경로를 직접 지정할 수도 있습니다.
npx prisma db push --schema ./prisma/schema.prisma
```

Prisma 7에서는 `db push`도 Prisma Client를 자동 생성하지 않으므로 필요한 경우 `npx prisma generate`를 별도로 실행합니다.  

### 🟦 Prisma Client 생성: `npx prisma generate`

Prisma Client는 `schema.prisma`를 기반으로 타입이 포함된 클라이언트 코드를 생성합니다.  

```bash
cd ~/blog-workspaces/nodejs-workbook/prisma-basics
npx prisma generate

# 스키마 경로를 직접 지정할 수도 있습니다.
npx prisma generate --schema ./prisma/schema.prisma
```

### 🟦 싱글톤 Prisma Client 예시: `src/shared/database.ts`

장별로 실습 파일이 나뉘어도 데이터베이스 연결은 하나의 공통 유틸리티로 관리하는 편이 안정적입니다.  
다음 싱글톤 구조는 일회성 스크립트뿐만 아니라, 후속 실습에서 개발 서버가 모듈을 다시 불러와도 기존 Client를 재사용하도록 구성한 예시입니다.  
아래는 `prisma-basics/src/shared/database.ts` 예시입니다.  

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { PrismaClient } from '../../generated/prisma/client';

import * as path from 'path';

// 지정한 .env 파일을 이 공통 모듈에서 한 번만 읽어 process.env에 반영합니다.
// dotenv는 기본적으로 이미 설정된 환경 변수의 값을 덮어쓰지 않습니다.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Vitest가 NODE_ENV를 'test'로 설정하더라도, 애플리케이션 환경을 나타내는
// APP_ENV는 영향을 받지 않고 .env에 지정한 값을 사용합니다.

// APP_ENV 값이 'development'이면 개발 환경으로 판단합니다.
// 개발 환경에서는 Prisma Client를 전역 객체에 저장해 다시 사용합니다.
const isDev = process.env.APP_ENV === 'development';

// 실행 환경과 관계없이 PRISMA_QUERY_LOG가 'true'일 때 상세 쿼리 로그를 활성화합니다.
// 테스트에서도 실행 환경 값을 변경하지 않고 SQL 실행 내용을 확인할 수 있습니다.
const enableQueryLog = process.env.PRISMA_QUERY_LOG === 'true';

// globalThis 객체에 prisma라는 값을 저장할 수 있도록
// TypeScript에 전역 변수의 타입을 알려 줍니다.
//
// 개발 중 파일이 다시 로드될 때마다 PrismaClient가 새로 생성되는 것을
// 방지하기 위해 기존 Client를 전역 객체에 저장합니다.
declare global {
  var prisma: PrismaClient | undefined;
}

// PostgreSQL에 연결된 새로운 Prisma Client를 생성하는 함수입니다.
function getPrismaClient(): PrismaClient {
  // .env 파일에서 DATABASE_URL 값을 읽습니다.
  const connectionString = process.env.DATABASE_URL;

  // 데이터베이스 주소가 없으면 연결할 수 없으므로
  // 프로그램 실행을 중단하고 원인을 알 수 있는 오류를 발생시킵니다.
  if (!connectionString) {
    throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  }

  // Prisma가 PostgreSQL에 연결할 때 사용할 어댑터를 생성합니다.
  // schema 옵션을 'study'로 설정했으므로 study 스키마를 사용합니다.
  const adapter = new PrismaPg({ connectionString }, { schema: 'study' });

  // PostgreSQL 어댑터를 전달하여 Prisma Client를 생성합니다.
  return new PrismaClient({
    adapter,

    // 상세 로그가 활성화되면 실행된 SQL과 각종 정보를 출력합니다.
    // 활성화하지 않으면 오류 메시지만 출력합니다.
    log: enableQueryLog ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}

// globalThis에 기존 Prisma Client가 저장되어 있으면 그것을 재사용합니다.
// 저장된 Client가 없으면 getPrismaClient()를 호출해 새로 생성합니다.
export const prisma = globalThis.prisma ?? getPrismaClient();

// 개발 환경에서는 새로 만든 Prisma Client를 전역 객체에 저장합니다.
// 이렇게 하면 개발 서버가 코드를 다시 불러와도 동일한 Client를 재사용할 수 있습니다.
if (isDev) {
  globalThis.prisma = prisma;
}

// shutdown 함수가 중복 실행되는 것을 막기 위한 상태값입니다.
let shuttingDown = false;

// 프로그램이 종료될 때 데이터베이스 연결을 안전하게 정리하는 함수입니다.
const shutdown = async (): Promise<void> => {
  // 이미 종료 처리가 시작되었다면 다시 실행하지 않습니다.
  if (shuttingDown) {
    console.log('이미 종료 처리가 진행 중입니다. 추가 종료 요청은 무시됩니다.');
    return;
  }
  // 종료 처리가 시작되었음을 기록합니다.
  shuttingDown = true;

  try {
    // Prisma가 사용 중인 데이터베이스 연결을 종료합니다.
    await prisma.$disconnect();

    console.log('데이터베이스 연결이 안전하게 종료되었습니다.');
    // 정상적으로 연결을 종료했으므로 성공 코드 0으로 프로세스를 끝냅니다.
    process.exit(0);
  } catch (error) {
    // 연결 종료 중 문제가 발생하면 오류 내용을 출력합니다.
    console.error('데이터베이스 연결 종료에 실패했습니다.', error);

    // 오류가 발생했음을 나타내는 코드 1로 프로세스를 끝냅니다.
    process.exit(1);
  }
};

// Ctrl+C를 누르면 SIGINT 신호가 발생합니다.
// 이 신호를 한 번만 처리하고 shutdown 함수를 실행합니다.
process.once('SIGINT', () => {
  // shutdown은 Promise를 반환하지만 이벤트 콜백에서는 기다릴 수 없으므로
  // void를 사용해 의도적으로 반환값을 사용하지 않음을 표시합니다.
  void shutdown();
});

// 운영체제나 컨테이너가 프로그램 종료를 요청하면 SIGTERM 신호가 발생합니다.
// 이 신호를 한 번만 처리하고 shutdown 함수를 실행합니다.
process.once('SIGTERM', () => {
  void shutdown();
});
```

`dotenv.config()`에 경로를 지정하지 않으면 기본적으로 현재 작업 디렉터리의 `.env`를 찾습니다.  
위 예제는 `import.meta.url`을 기준으로 `.env`의 위치를 지정하므로 명령을 실행한 디렉터리와 관계없이 `prisma-basics/.env`를 불러옵니다.  
Prisma CLI는 `prisma.config.ts`의 `import 'dotenv/config'`를 통해 같은 환경 변수를 불러옵니다.  

### 🟦 Connection Pool 설정: Prisma ORM v6와 v7

Connection Pool은 데이터베이스 연결을 재사용하여 연결 생성 비용을 줄이고, 동시에 사용할 연결 수를 제어합니다.  
앞의 싱글톤 구조는 하나의 Node.js 프로세스에서 `PrismaClient`와 연결 풀을 재사용하도록 돕습니다.  

#### Prisma ORM v6 이전

Prisma ORM v6 이전에서는 Prisma Query Engine이 Connection Pool을 관리했습니다.  
풀의 최대 연결 수와 대기 시간은 주로 `DATABASE_URL`의 쿼리 파라미터로 설정했습니다.  

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/database?connection_limit=10&pool_timeout=10"
```

`connection_limit=10`은 최대 연결 수를 10개로 제한하고, `pool_timeout=10`은 사용 가능한 연결을 최대 10초까지 기다립니다.  
두 값을 생략하면 풀 크기는 `물리 CPU 코어 수 × 2 + 1`, `pool_timeout`은 10초로 설정됩니다.  

#### Prisma ORM v7

Prisma ORM v7에서는 `pg` 드라이버가 Connection Pool을 관리하며, 풀 옵션은 `PrismaPg` 생성자의 첫 번째 인자에 전달합니다.  

```typescript
// pg 드라이버가 관리할 Connection Pool의 옵션을 설정합니다.
const adapter = new PrismaPg(
  {
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 0,
  },
  {
    // PostgreSQL의 study 스키마를 사용합니다.
    schema: 'study',
  },
);
```

| 옵션 | 예시 값 | 기본값 | 설명 |
| --- | ---: | ---: | --- |
| `max` | `10` | `10` | 풀이 유지할 최대 연결 수 |
| `connectionTimeoutMillis` | `5_000` | `0` | 연결을 얻을 때까지 기다리는 최대 시간(밀리초) |
| `idleTimeoutMillis` | `10_000` | `10_000` | 사용하지 않는 연결을 유지하는 시간(밀리초) |
| `maxLifetimeSeconds` | `0` | `0` | 각 연결의 최대 유지 시간(초) |

`0`으로 설정한 시간 옵션은 제한이 없다는 뜻입니다.  
앞의 싱글톤 예제처럼 풀 옵션을 생략해도 `PrismaPg`가 기본값으로 풀을 관리하므로 `Pool`을 따로 생성할 필요가 없습니다.  
v6에서 v7로 옮길 때는 기본 풀 크기와 대기 시간이 달라지므로, 배포 환경의 동시 요청 수와 데이터베이스의 최대 연결 수를 기준으로 설정을 다시 확인합니다.  

### 🟦 첫 실행 스크립트: `prisma-basics/src/ch01/index.ts`

`prisma-basics/src/ch01/index.ts`를 만들고 다음 코드를 입력합니다.  
이 예제는 User와 Post를 nested write로 함께 생성하며, 둘 중 하나의 생성이 실패하면 전체 작업을 롤백합니다.  
`include`를 사용하여 생성된 User와 관계를 맺은 Post도 함께 조회합니다.  

```typescript
import { prisma } from '../shared/database';

async function main(): Promise<void> {
  console.log('데이터 생성을 시작합니다...');

  // 고유한 이메일을 사용하여 User 데이터를 생성합니다.
  const created = await prisma.user.create({
    data: {
      email: `dev${Date.now()}@example.com`,
      displayName: 'Prisma Dev',

      // User와 Post를 하나의 nested write로 함께 생성합니다.
      posts: {
        create: {
          title: 'Prisma 첫 게시글',
          content: 'nested write로 생성한 게시글입니다.',
          published: true,
        },
      },
    },
    // 반환 결과에 연결된 Post 데이터도 포함합니다.
    include: { posts: true },
  });

  console.log('1) Created user:', created);
}

main()
  .catch((error: unknown) => {
    // 실행 중 발생한 오류를 출력합니다.
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // 프로세스가 끝나기 전에 데이터베이스 연결을 정리합니다.
    await prisma.$disconnect();
  });
```

`prisma-basics` 하위 프로젝트의 최상위 디렉터리에서 타입을 검사한 후 실행합니다.  

```bash
cd ~/blog-workspaces/nodejs-workbook/prisma-basics
npx tsx ./src/ch01/index.ts
```

## 4. Prisma CLI 주요 명령어 정리 {#session-04}

| 명령어 | 역할 | 사용 시점 |
| --- | --- | --- |
| `prisma init` | 프로젝트 구조 생성 | Prisma 최초 도입 시 |
| `prisma format` / `prisma validate` | 스키마 정렬 및 검증 | 저장 전 또는 CI 단계 |
| `prisma migrate dev` | 마이그레이션 생성 및 개발 DB 반영 | 모델 수정 후 |
| `prisma migrate deploy` | 기존 마이그레이션을 운영 DB에 반영 | CD 파이프라인 |
| `prisma db push` | 마이그레이션 없이 스키마 즉시 반영 | 프로토타입 또는 MongoDB 사용 시 |
| `prisma generate` | Prisma Client 생성 | 스키마 변경 후 |
| `prisma studio` | 데이터 관리 GUI 실행 | 데이터 확인 시 |
| `prisma db pull` | DB 구조를 Prisma 스키마로 반영 | 기존 DB 연동 시 |
| `prisma db seed` | 초기 데이터 스크립트 실행 | 개발·테스트 데이터 준비 시 |

### 🟦 프로젝트 초기 설정(Setup)

Prisma를 프로젝트에 처음 도입할 때 사용하는 단계입니다.  

#### 🔷 `npx prisma init`

Prisma 사용을 시작하기 위한 최초 명령어입니다.  
`prisma/schema.prisma`, `.env`, `prisma.config.ts` 등의 초기 파일을 생성합니다.  

```bash
npx prisma init
npx prisma init --datasource-provider postgresql
```

### 🟦 스키마 관리 및 검증(Schema & Validation)

모델을 설계하면서 스키마의 형식과 유효성을 확인하는 단계입니다.  

#### 🔷 `npx prisma format`

`schema.prisma` 파일의 형식을 자동으로 정리합니다.  
관계 정의에 필요한 반대쪽 관계 필드가 없으면 일부 필드를 자동으로 추가할 수 있으므로, 실행 후 변경 내용을 확인합니다.  

#### 🔷 `npx prisma validate`

스키마 문법 오류와 관계 설정의 참조 불일치 등을 검사하며, CI/CD 파이프라인에서도 활용할 수 있습니다.  

### 🟦 데이터베이스 동기화(Migration & Sync)

Prisma 스키마와 실제 데이터베이스 상태를 맞추는 단계입니다.  

#### 🔷 `npx prisma migrate dev`(개발용)

스키마 변경 사항을 기반으로 SQL 마이그레이션 파일을 생성하고 개발 데이터베이스에 적용합니다.  
Prisma 7에서는 Prisma Client를 자동으로 다시 생성하지 않으므로 `npx prisma generate`를 별도로 실행합니다.  

```bash
npx prisma migrate dev
npx prisma migrate dev --name add_user_table
npx prisma generate
```

#### 🔷 `npx prisma migrate deploy`(운영 및 배포용)

이미 생성된 마이그레이션 파일을 운영 데이터베이스에 순서대로 적용하며, 일반적으로 CI/CD 환경에서 사용합니다.  

#### 🔷 `npx prisma db push`

마이그레이션 파일을 남기지 않고 스키마를 데이터베이스에 즉시 반영합니다.  
빠른 프로토타이핑에 사용하며, Prisma Migrate를 지원하지 않는 MongoDB에서도 사용합니다.  

#### 🔷 `npx prisma db pull`

이미 존재하는 데이터베이스 구조를 읽어 `schema.prisma`에 반영합니다.  
기존 데이터베이스를 Prisma 프로젝트에 도입할 때 유용합니다.  

### 🟦 클라이언트 및 데이터 조작(Client & Data)

애플리케이션 코드에서 Prisma를 사용하기 위한 준비 및 관리 단계입니다.  

#### 🔷 `npx prisma generate`

TypeScript 타입 정의가 포함된 Prisma Client를 생성합니다.  
Prisma 7에서는 스키마를 변경하거나 마이그레이션을 실행한 뒤 필요할 때 직접 실행합니다.  

#### 🔷 `npx prisma studio`

데이터를 조회, 수정, 삭제할 수 있는 브라우저 기반 GUI 도구를 실행합니다.  
기본 접속 주소는 `http://localhost:5555`입니다.  

#### 🔷 `npx prisma db seed`

초기 데이터(Seed) 스크립트를 실행합니다.  
Prisma 7에서는 seed 명령을 `package.json`이 아니라 `prisma.config.ts`의 `migrations.seed`에 설정합니다.  

```text
prisma-basics/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── prisma.config.ts
```

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // npx prisma db seed를 실행할 때 사용할 명령입니다.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

```bash
npx prisma db seed
```
