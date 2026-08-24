---
layout: post
title: "[Fastify] 04. prisma.plugin.ts로 Prisma 연동하기"
description: "Fastify에서 Prisma를 사용하기 위해 사용자, 게시글, 첨부파일 데이터 모델과 Prisma Client를 준비합니다. prisma.plugin.ts에서 SQLite 어댑터, 로깅, 의존성 주입과 종료 훅을 설정하고 애플리케이션에 등록합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. ER 모델링"
  - id: session-02
    title: "2. Prisma 초기화와 prisma.config.ts"
  - id: session-03
    title: "3. Prisma 스키마 및 인덱스 설계"
  - id: session-04
    title: "4. prisma.plugin.ts 생성 및 등록"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**  

Fastify에서 Prisma를 통해 SQLite 데이터베이스에 연결하고 사용할 수 있도록 필요한 설정을 구성합니다.  

먼저 사용자, 게시글과 첨부파일의 관계를 모델링하고 Prisma Client를 생성할 준비를 합니다.  
그다음 `prisma.plugin.ts`를 만들어 Prisma Client를 Fastify 인스턴스에 등록하고, 서버가 종료될 때 데이터베이스 연결을 정리하도록 설정합니다.  

## 1. ER 모델링 {#session-01}

ER 모델링은 서비스에서 관리할 데이터를 엔터티로 나누고, 각 엔터티가 어떤 관계를 맺는지 정리하는 과정입니다.  
실습에서는 `User`, `Session`, `Post`, `PostAttachment`, `PostLike` 다섯 개의 엔터티를 사용합니다.  

![사용자, 세션, 게시글, 첨부파일과 좋아요 관계를 나타낸 ER 다이어그램](/assets/images/nodejs/nodejs-fastify/image-2026-08-21.png)

### 🟦 사용자와 세션

`User`는 로그인과 사용자 식별에 필요한 계정 정보를 저장합니다.  
이메일에는 고유 제약 조건을 두어 같은 이메일로 여러 계정을 만들 수 없게 합니다.  
비밀번호 원문은 저장하지 않고 안전한 단방향 해시 함수로 만든 `passwordHash`만 저장합니다.  

계정 상태는 `UserStatus` 열거형으로 관리합니다.  
정상 계정은 `ACTIVE`, 이용이 정지된 계정은 `SUSPENDED`, 탈퇴한 계정은 `WITHDRAWN`으로 구분합니다.  
탈퇴 처리 시각은 `withdrawnAt`에 기록하므로 계정 상태와 처리 시점을 함께 확인할 수 있습니다.  
`SUSPENDED`나 `WITHDRAWN`으로 상태를 변경하는 것은 사용자 레코드를 남겨 두는 논리적 처리이므로 `onDelete: Cascade`가 실행되지 않습니다.  
계정을 정지하거나 탈퇴시킬 때 기존 로그인을 무효화하려면, 서비스 로직에서 상태 변경과 해당 사용자의 세션 삭제를 하나의 트랜잭션으로 처리해야 합니다.  
정지된 계정의 게시글, 좋아요와 첨부파일 메타데이터는 그대로 유지합니다.  
탈퇴한 계정의 관련 데이터도 서비스 정책에 따라 유지하거나 별도로 삭제합니다.  

`Session`은 로그인 상태를 유지하는 데 필요한 정보를 저장합니다.  
한 사용자는 여러 기기에서 로그인할 수 있으므로 `User`와 `Session`은 일대다 관계입니다.  
세션 토큰도 원문 대신 해시값을 저장합니다.  
사용자 레코드를 물리적으로 삭제하면 `onDelete: Cascade`에 의해 해당 사용자의 세션도 함께 삭제됩니다.  

### 🟦 게시글, 좋아요와 첨부파일

한 사용자는 여러 게시글을 작성할 수 있으므로 `User`와 `Post`도 일대다 관계입니다.  
`Post.authorId`가 작성자를 가리키며, 사용자 레코드를 물리적으로 삭제하면 그 사용자가 작성한 게시글도 함께 삭제됩니다.  

사용자와 게시글의 좋아요는 다대다 관계입니다.  
이 관계를 `PostLike` 연결 모델로 명시하면 좋아요를 누른 시각을 함께 저장할 수 있습니다.  
또한 `userId`와 `postId`를 복합 기본 키로 사용하여 한 사용자가 같은 게시글에 중복으로 좋아요를 누르지 못하게 합니다.  

`PostAttachment`는 게시글에 첨부한 파일의 원본 이름, 저장소 키, MIME 타입과 크기를 저장합니다.  
한 게시글에는 여러 첨부파일이 연결될 수 있으므로 `Post`와 `PostAttachment`는 일대다 관계입니다.  
게시글을 삭제하면 `onDelete: Cascade`에 의해 연결된 첨부파일 메타데이터도 함께 삭제됩니다.  
다만 데이터베이스의 Cascade는 로컬 디스크나 객체 스토리지의 실제 파일까지 삭제하지 않으므로, 실제 파일 정리는 서비스 로직에서 별도로 처리해야 합니다.  

## 2. Prisma 초기화와 prisma.config.ts {#session-02}

실습 프로젝트로 이동한 뒤 Prisma CLI와 SQLite 드라이버 어댑터를 설치합니다.  
현재 프로젝트처럼 패키지가 이미 설치되어 있고 `prisma` 디렉터리가 있다면 초기화 명령은 다시 실행하지 않아도 됩니다.  

```bash
# Fastify 실습 프로젝트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/fastify-basics

# Prisma CLI와 better-sqlite3 타입을 개발 의존성으로 설치합니다.
npm install --save-dev prisma@7 @types/better-sqlite3

# Prisma Client와 SQLite 드라이버 어댑터를 설치합니다.
npm install @prisma/client@7 @prisma/adapter-better-sqlite3@7 better-sqlite3

# SQLite용 스키마와 설정 파일을 초기화합니다.
npx prisma init
```

초기화하면 프로젝트 루트의 `prisma.config.ts`, `prisma/schema.prisma`, `.env`가 준비됩니다.  
`.env`에는 로컬 SQLite 파일의 연결 URL을 작성합니다.  

```dotenv
# 로컬 실습용 SQLite 데이터베이스 파일을 사용합니다.
DATABASE_URL="file:./prisma/fastify-basics.db"
```

`prisma.config.ts`는 Prisma CLI가 스키마와 마이그레이션을 어디에서 찾고, 어떤 데이터베이스에 연결할지 알려 주는 설정 파일입니다.  
스키마의 `datasource` 블록에는 데이터베이스 종류만 두고, 실제 URL은 이 설정에서 환경 변수로 읽습니다.  

```typescript
// prisma.config.ts
// .env의 값을 process.env에 자동으로 불러옵니다.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Prisma CLI가 사용할 스키마 파일의 경로입니다.
  schema: 'prisma/schema.prisma',

  // migrate dev가 만든 마이그레이션 파일을 저장할 경로입니다.
  migrations: {
    path: 'prisma/migrations',
  },

  // DATABASE_URL이 없으면 즉시 오류를 내도록 Prisma의 env()를 사용합니다.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

## 3. Prisma 스키마 및 인덱스 설계 {#session-03}

ER 모델을 `prisma/schema.prisma`에 다음과 같이 작성합니다.  
Prisma 모델에서는 애플리케이션이 사용할 필드 이름을 camelCase로 유지하고, `@map`과 `@@map`으로 SQLite의 snake_case 열과 테이블 이름에 연결합니다.  

```prisma
// Prisma Client 생성 설정입니다.
// Prisma 7부터 provider로 "prisma-client"를 사용합니다.
// Prisma 7에서는 output 경로를 반드시 지정해야 합니다.
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  // 연결할 데이터베이스 종류입니다. 실제 연결 URL은 prisma.config.ts에서 설정합니다.
  provider = "sqlite"
}

// 사용자의 현재 계정 상태를 나타냅니다.
enum UserStatus {
  ACTIVE
  SUSPENDED
  WITHDRAWN
}

// 사용자가 서비스에서 행사할 수 있는 권한 범위를 나타냅니다.
enum UserRole {
  USER
  ADMIN
}

// 서비스 사용자 정보를 저장합니다.
model User {
  // 자동으로 증가하는 정수형 기본 키입니다.
  id           Int        @id @default(autoincrement())
  // 로그인에 사용하므로 중복 이메일을 허용하지 않습니다.
  email        String     @unique
  // 비밀번호 원문 대신 해시값을 저장합니다.
  passwordHash String     @map("password_hash")
  // 표시 이름은 선택 입력값입니다.
  displayName  String?    @map("display_name")
  // 새 계정은 기본적으로 활성 상태로 생성됩니다.
  status       UserStatus @default(ACTIVE)
  // 회원가입으로 생성되는 일반 사용자는 관리자 권한을 갖지 않습니다.
  role         UserRole   @default(USER)
  // 탈퇴하지 않은 사용자는 null이며, 탈퇴 시 처리 시각을 기록합니다.
  withdrawnAt  DateTime?  @map("withdrawn_at")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  // 사용자가 작성한 게시글, 누른 좋아요, 로그인 세션의 역방향 관계입니다.
  posts    Post[]
  likes    PostLike[]
  sessions Session[]

  // 계정 상태와 역할별 사용자 조회를 빠르게 하기 위한 인덱스입니다.
  @@index([status])
  @@index([role])
  // 데이터베이스에서는 users 테이블에 매핑합니다.
  @@map("users")
}

// 로그인 상태를 유지하기 위한 세션을 저장합니다.
model Session {
  id        String   @id @default(cuid())
  // 탈취 위험을 줄이기 위해 세션 토큰 자체가 아닌 해시값을 저장합니다.
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  // 세션 소유자를 가리키며, 사용자가 삭제되면 세션도 함께 삭제됩니다.
  userId Int  @map("user_id")
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 사용자별 세션 조회와 만료 세션 조회를 빠르게 하기 위한 인덱스입니다.
  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

// 사용자가 작성한 게시글을 저장합니다.
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  // 본문 없이 제목만 있는 게시글도 허용합니다.
  content   String?
  // 새 게시글은 기본적으로 비공개 상태입니다.
  published Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 작성자를 가리키며, 사용자가 삭제되면 작성한 게시글도 함께 삭제됩니다.
  authorId Int  @map("author_id")
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // 이 게시글에 연결된 좋아요와 첨부파일 목록입니다.
  likes       PostLike[]
  attachments PostAttachment[]

  @@index([authorId])
  @@map("posts")
}

// 게시글에 첨부한 파일의 저장 위치와 메타데이터를 저장합니다.
model PostAttachment {
  id           Int      @id @default(autoincrement())
  // 사용자에게 표시할 업로드 당시의 원본 파일명입니다.
  originalName String   @map("original_name")
  // 실제 파일을 찾을 수 있는 로컬 상대 경로나 객체 스토리지 키입니다.
  storageKey   String   @unique @map("storage_key")
  // 다운로드 응답과 파일 형식 검증에 사용할 MIME 타입입니다.
  mimeType     String   @map("mime_type")
  // 업로드 제한과 응답 표시에 사용할 파일 크기이며 단위는 byte입니다.
  size         Int
  createdAt    DateTime @default(now()) @map("created_at")

  // 첨부 대상 게시글이 삭제되면 파일 메타데이터도 함께 삭제됩니다.
  postId Int  @map("post_id")
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_attachments")
}

// 사용자와 게시글의 다대다 좋아요 관계를 나타내는 연결 모델입니다.
model PostLike {
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  // 사용자나 게시글이 삭제되면 관련 좋아요도 함께 삭제됩니다.
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  // 사용자 한 명이 같은 게시글에 좋아요를 한 번만 누를 수 있도록 복합 기본 키를 사용합니다.
  @@id([userId, postId])
  @@index([postId])
  @@map("post_likes")
}
```

### 🟦 조회 기준에 맞춘 인덱스

인덱스는 모든 필드에 추가하는 것이 아니라 실제 조회 조건을 기준으로 설계합니다.  
`User.status` 인덱스는 계정 상태별 사용자 조회에 사용하고, `Session.expiresAt` 인덱스는 만료된 세션을 찾을 때 사용합니다.  
`Post.authorId`와 `Session.userId` 인덱스는 특정 사용자의 게시글이나 세션을 조회할 때 도움이 됩니다.  
`PostAttachment.postId` 인덱스는 특정 게시글의 첨부파일을 조회할 때 사용합니다.  
`PostAttachment.storageKey`에는 `@unique`를 지정하여 같은 저장소 키가 중복되지 않게 하고, 고유 인덱스로 파일 메타데이터를 빠르게 찾을 수 있게 합니다.  

`PostLike`의 복합 기본 키는 `(userId, postId)` 순서로 구성됩니다.  
따라서 특정 사용자가 누른 좋아요를 찾는 조회에는 사용할 수 있지만, 특정 게시글의 좋아요를 찾는 조회를 위해서는 `postId` 인덱스를 별도로 둡니다.  

인덱스는 읽기 성능을 높이는 대신 데이터를 추가하거나 수정할 때 관리 비용이 발생합니다.  
현재 실습에 필요한 조회 기준만 먼저 반영하고, 새로운 조회 패턴이 생길 때 실행 계획을 확인한 뒤 보완하는 편이 좋습니다.  

설정을 마치면 스키마를 검사하고 최초 마이그레이션과 Prisma Client 생성을 진행합니다.  
`migrate dev`는 개발용 데이터베이스에 스키마를 반영하고 마이그레이션 이력을 남깁니다.  

```bash
# schema.prisma의 문법과 관계 설정을 검사합니다.
npx prisma validate

# 새 데이터베이스라면 현재 전체 스키마를 최초 마이그레이션으로 반영합니다.
npx prisma migrate dev --name init

# 기존 실습 데이터베이스에 PostAttachment를 추가할 때는 다음 이름을 사용합니다.
# npx prisma migrate dev --name add_postattachment

# output에 지정한 경로에 타입 안전한 Prisma Client를 생성합니다.
npx prisma generate
```

여기까지 진행하면 데이터베이스와 생성된 Prisma Client를 사용할 준비가 끝납니다.  
이제 이 클라이언트를 Fastify의 플러그인 구조 안에서 생성하고 공유하도록 설정합니다.  

## 4. prisma.plugin.ts 생성 및 등록 {#session-04}

prisma.config.ts는 Prisma CLI에서 사용하는 설정 파일이고, prisma.plugin.ts는 실행 중인 Fastify 애플리케이션에서 Prisma Client를 공통으로 사용하기 위한 파일입니다.  

Fastify 플러그인으로 분리하면 Prisma Client를 한곳에서 관리하고, 모든 라우트에서 fastify.prisma로 같은 클라이언트를 사용할 수 있습니다.  

`prisma.plugin.ts`에서는 다음 다섯 가지를 설정합니다.  

1. `PrismaBetterSqlite3` 어댑터로 SQLite 연결을 준비합니다.  
2. `PrismaClient`를 생성하고 쿼리·상태 로그를 Fastify 로거로 전달합니다.  
3. 데이터베이스 연결을 확인하고 SQLite를 WAL 모드로 설정합니다.  
4. `decorate()`로 Prisma Client를 Fastify 인스턴스에 추가합니다.  
5. `onClose` 훅에서 Prisma 연결을 정리합니다.  

### 🟦 플러그인 파일 만들기

먼저 플러그인을 저장할 디렉터리와 파일을 준비합니다.  

```bash
# Fastify 실습 프로젝트에서 Prisma 플러그인 파일을 만듭니다.
cd ~/blog-workspaces/nodejs-workbook/fastify-basics
mkdir -p src/plugins
touch src/plugins/prisma.plugin.ts
```

### 🟦 Fastify 타입에 Prisma Client 추가하기

`fastify.decorate('prisma', prisma)`는 실행 중인 Fastify 인스턴스에 실제 속성을 추가합니다.  
하지만 TypeScript는 이 코드만으로 `fastify.prisma`의 타입을 알 수 없습니다.  
따라서 선언 병합을 사용하여 `FastifyInstance`에 `prisma` 속성이 있다는 사실을 타입 시스템에도 알려 줍니다.  

```typescript
import type { PrismaClient } from '../generated/prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    // 라우트에서 fastify.prisma로 접근할 수 있도록 타입을 확장합니다.
    prisma: PrismaClient;
  }
}
```

선언 병합은 타입 정보만 추가합니다.  
실제 `prisma` 속성은 플러그인 함수 안에서 `decorate()`를 호출해야 생성됩니다.  

### 🟦 SQLite 어댑터와 Prisma Client 설정하기

Prisma 7에서는 데이터베이스 드라이버 어댑터를 Prisma Client에 전달합니다.  
이 실습에서는 `@prisma/adapter-better-sqlite3`의 `PrismaBetterSqlite3`를 사용합니다.  
어댑터가 사용할 연결 URL은 앞에서 만든 `env.DATABASE_URL`에서 가져옵니다.  
`timeout`은 다른 쓰기 작업이 SQLite 잠금을 해제할 때까지 기다릴 최대 시간을 밀리초 단위로 지정합니다.  

플러그인 함수 안에서 어댑터와 Prisma Client를 만들면 각 Fastify 애플리케이션 인스턴스가 자신의 데이터베이스 연결 생명주기를 관리할 수 있습니다.  
Prisma Client의 이벤트 로그를 Fastify 로거로 전달하면 애플리케이션 로그 형식과 출력 위치를 일관되게 유지할 수 있습니다.  

### 🟦 SQLite와 커넥션 풀

PostgreSQL이나 MySQL처럼 별도의 데이터베이스 서버에 접속하는 경우에는 여러 요청이 데이터베이스 연결을 나누어 사용할 수 있도록 커넥션 풀이 필요합니다.  
Prisma 7의 드라이버 어댑터는 `pg`나 `mariadb` 같은 Node.js 드라이버가 제공하는 커넥션 풀을 사용합니다.  

각각 새로 생성한 드라이버 어댑터와 Prisma Client는 독립된 커넥션 풀을 만들 수 있습니다.  
따라서 서버 애플리케이션에서는 요청이나 라우트마다 Prisma Client를 생성하지 않고, 하나의 Fastify 애플리케이션에서 하나의 인스턴스를 만들어 공유하는 것이 중요합니다.  

`better-sqlite3`의 `Database` 객체 하나가 하나의 SQLite 연결을 나타내며 별도의 커넥션 풀을 제공하지 않습니다.  
따라서 `prisma.plugin.ts`에서는 풀을 따로 만들거나 크기를 설정하지 않고, `PrismaBetterSqlite3` 어댑터와 Prisma Client만 생성합니다.  
이 인스턴스를 `fastify.prisma`로 공유하고 `onClose` 훅에서 연결을 닫으면 SQLite 연결의 생명주기를 Fastify와 함께 관리할 수 있습니다.  

### 🟦 전체 prisma.plugin.ts 작성하기

앞에서 살펴본 설정을 `src/plugins/prisma.plugin.ts`에 하나로 작성합니다.  

```typescript
// src/plugins/prisma.plugin.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

// Fastify의 기본 타입에 prisma 속성을 선언 병합으로 추가합니다.
declare module 'fastify' {
  interface FastifyInstance {
    // 라우트에서 fastify.prisma로 접근할 수 있도록 타입을 확장합니다.
    prisma: PrismaClient;
  }
}

// Fastify가 등록 과정에서 기다릴 수 있는 비동기 플러그인으로 정의합니다.
const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Prisma 7이 better-sqlite3를 통해 SQLite에 접근하도록 어댑터를 만듭니다.
  const adapter = new PrismaBetterSqlite3({
    url: env.DATABASE_URL,
    // 다른 쓰기 작업이 DB 잠금을 해제할 때까지 최대 5초간 기다립니다.
    timeout: 5_000,
  });

  // 현재 Fastify 애플리케이션에서 공유할 Prisma Client를 생성합니다.
  const prisma = new PrismaClient({
    adapter,
    // Prisma Client가 발생시키는 로그를 이벤트로 받아 Fastify 로거에 전달합니다.
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

  // 쿼리와 실행 시간을 debug 레벨로 기록합니다.
  prisma.$on('query', (event) => {
    fastify.log.debug(
      {
        query: event.query,
        durationMs: event.duration,
        target: event.target,
      },
      'Prisma query',
    );
  });

  // Prisma의 정보·경고·오류 이벤트를 같은 수준의 Fastify 로그로 전달합니다.
  prisma.$on('info', (event) => {
    fastify.log.info({ target: event.target }, event.message);
  });

  prisma.$on('warn', (event) => {
    fastify.log.warn({ target: event.target }, event.message);
  });

  prisma.$on('error', (event) => {
    fastify.log.error({ target: event.target }, event.message);
  });

  // 플러그인 등록 단계에서 연결 가능 여부를 먼저 확인합니다.
  await prisma.$connect();

  // WAL 모드로 읽기와 쓰기가 서로를 막는 상황을 줄여 동시 처리 성능을 높입니다.
  // 이 설정은 SQLite 데이터베이스 파일에 저장되므로 최초 실행 이후에도 유지됩니다.
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');

  // Fastify 인스턴스에 공유 Prisma Client를 `prisma` 속성으로 추가하여,
  // 이후 등록되는 라우트와 플러그인에서 `fastify.prisma`로 사용할 수 있게 합니다.
  fastify.decorate('prisma', prisma);

  // app.close()가 호출되면 Prisma의 데이터베이스 연결을 정리합니다.
  // Fastify 서버가 종료될 때(fastify.close() 호출 시) 실행됩니다.
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Prisma connection...');
    await prisma.$disconnect();
  });
};

// 캡슐화 경계를 없애 다른 라우트와 플러그인에서도 준비된 Prisma를 공유합니다.
export default fp(prismaPlugin, {
  // Fastify가 이 플러그인을 구분할 수 있도록 이름을 붙입니다.
  name: 'prisma-plugin',
});
```

`$connect()`에서 연결에 실패하면 플러그인 등록도 실패하므로, 서버가 데이터베이스를 사용할 수 없는 상태로 시작되는 일을 막을 수 있습니다.  
`PRAGMA journal_mode = WAL`은 읽기와 쓰기가 서로를 막는 상황을 줄이며, 설정 결과는 SQLite 데이터베이스 파일에 유지됩니다.  
Prisma의 쿼리 이벤트는 `debug` 수준으로 기록되므로 실제 쿼리 로그를 보려면 `LOG_LEVEL`을 `debug` 또는 `trace`로 설정해야 합니다.  
`onClose` 훅은 03편에서 작성한 `app.close()`가 호출될 때 실행되며, 해당 Fastify 인스턴스가 사용한 Prisma 연결을 정리합니다.  

마지막의 `fp()`는 플러그인을 `fastify-plugin`으로 감쌉니다.  
이 설정이 있어야 `decorate()`로 추가한 `prisma`가 플러그인 내부에만 갇히지 않고 이후에 등록되는 라우트에서도 보입니다.  

### 🟦 app.ts에 Prisma 플러그인 등록하기

플러그인 파일을 만드는 것만으로는 실행되지 않습니다.  
`app.ts`에서 가져온 뒤 Prisma를 사용하는 라우트보다 먼저 등록해야 합니다.  

```typescript
// src/app.ts 중 플러그인 등록 부분입니다.
import { routes } from './route';
import prismaPlugin from './plugins/prisma.plugin';

export function createApp() {
  const app = Fastify({ logger: loggerOptions });

  // Prisma를 사용하는 라우트보다 먼저 등록합니다.
  app.register(prismaPlugin);

  // prisma가 준비된 다음 비즈니스 API 라우트를 등록합니다.
  app.register(routes, { prefix: '/api' });

  return app;
}
```

Fastify는 플러그인을 등록한 순서대로 준비합니다.  
따라서 Prisma 플러그인 다음에 등록한 라우트에서는 별도의 Prisma Client를 만들지 않고 `fastify.prisma`를 사용할 수 있습니다.  

```typescript
// src/modules/user/user.routes.ts 중 의존성 조립 부분입니다.

// prisma.plugin.ts가 Fastify에 추가한 공유 Prisma Client를 Repository에 전달합니다.
const userRepository = new UserRepository(fastify.prisma);
const userService = new UserService(userRepository);
const userController = new UserController(userService);
```

이 구조에서는 Repository가 공유 Prisma Client로 데이터베이스에 접근하고, Service와 Controller는 Prisma Client를 직접 생성하지 않습니다.  
