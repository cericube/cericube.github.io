---
layout: post
title: "05. GraphQL과 Prisma 연동 및 프로젝트 구조"
description: "GraphQL과 Prisma가 맡는 역할을 구분하고 Prisma 7과 SQLite 환경을 구성합니다. Prisma Client를 GraphQL Context에 연결하고 Schema, Resolver, Service, Repository 계층으로 요청을 처리하는 구조를 살펴봅니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 5
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL과 Prisma의 역할 및 요청 처리 흐름"
  - id: session-02
    title: "2. Prisma와 SQLite 환경 구성 및 데이터 모델 정의"
  - id: session-03
    title: "3. Prisma Client 등록과 GraphQL Context 구성"
  - id: session-04
    title: "4. 도메인 중심 프로젝트 구조와 계층별 역할"
  - id: session-05
    title: "5. 계층별 구현과 전체 요청 처리 흐름"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. GraphQL과 Prisma의 역할 및 요청 처리 흐름 {#session-01}

GraphQL과 Prisma는 모두 데이터를 다루지만 담당하는 역할은 다릅니다.  
GraphQL은 클라이언트와 서버 사이의 API 규칙을 정의하고, Prisma는 애플리케이션이 데이터베이스를 읽고 변경할 수 있도록 연결합니다.  

| 구분 | GraphQL | Prisma |
| --- | --- | --- |
| 연결 대상 | 클라이언트와 API 서버 | API 서버와 데이터베이스 |
| 주요 정의 | Schema, Query, Mutation | Model, Relation, Index |
| 주요 실행 코드 | Resolver | Prisma Client 쿼리 |
| 검증 대상 | 요청 필드와 입력값 | 데이터베이스에 전달할 조건과 데이터 |
| 반환 결과 | 클라이언트가 선택한 응답 형태 | 데이터베이스에서 조회하거나 변경한 레코드 |

GraphQL이 데이터베이스에 직접 접근하거나 Prisma가 GraphQL 요청을 해석하는 것은 아닙니다.  
두 도구 사이에는 요청을 애플리케이션 코드로 연결하는 Resolver가 있습니다.  
이 프로젝트에서는 Resolver와 Prisma 사이에 Service와 Repository 계층도 둡니다.  
![GraphQL과Prisma연동구조](/assets/images/nodejs/nodejs-graphql/image-2026-10-14.png)

```text
클라이언트
   │ GraphQL Query 또는 Mutation
   ▼
GraphQL Schema
   │ 요청 구조 검증
   ▼
Resolver
   │ Context에서 Service 사용
   ▼
Service
   │ 입력값 검증과 비즈니스 규칙 처리
   ▼
Repository
   │ Prisma Client 쿼리 실행
   ▼
Prisma Client ── SQLite
```

예를 들어 클라이언트가 `user(id: "1")`을 요청하면 다음 순서로 처리됩니다.  

1. GraphQL은 `user` 필드와 `id` 인자가 Schema에 맞는지 검사합니다.  
2. `Query.user` Resolver가 Context에서 `UserService`를 가져와 호출합니다.  
3. Service는 문자열로 전달된 GraphQL ID를 데이터베이스에서 사용할 정수로 변환하고 검증합니다.  
4. Repository는 Prisma Client의 `findUnique()`를 실행합니다.  
5. 조회 결과가 Resolver를 거쳐 GraphQL 응답으로 반환됩니다.  

```typescript
// Resolver는 요청을 애플리케이션의 비즈니스 로직으로 연결합니다.
user: (_parent: unknown, args: { id: string }, context: GraphQLContext) =>
  context.services.users.find(args.id)
```

```typescript
// Repository는 Prisma 쿼리를 이용해 실제 데이터를 조회합니다.
findById(id: number) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

이처럼 GraphQL은 클라이언트가 사용할 API의 형태에 집중하고, Prisma는 데이터를 저장하고 조회하는 방법에 집중합니다.  
두 역할을 분리하면 데이터베이스가 바뀌거나 비즈니스 규칙이 늘어나도 GraphQL API 코드를 비교적 명확하게 관리할 수 있습니다.  

## 2. Prisma와 SQLite 환경 구성 및 데이터 모델 정의 {#session-02}

SQLite는 별도의 데이터베이스 서버를 설치하지 않고 하나의 파일에 데이터를 저장합니다.  
이 프로젝트에서는 Prisma 7과 `better-sqlite3` 어댑터를 사용합니다.  

### 🟦 패키지와 실행 명령 구성

Prisma CLI, Prisma Client, SQLite 어댑터를 설치합니다. 현재 실습 프로젝트에는 다음 패키지가 포함되어 있습니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics

npm install fastify-plugin@6.0.0 \
  @prisma/client@7.10.0 \
  @prisma/adapter-better-sqlite3@7.10.0 \
  better-sqlite3@13.0.3
npm install -D prisma@7.10.0 @types/better-sqlite3@9.6.0
```

`fastify-plugin`으로 Prisma 플러그인을 감싸면 상위 Fastify 인스턴스에서도 `app.prisma` 속성을 사용할 수 있고, 애플리케이션이 종료될 때 종료 훅도 함께 실행됩니다.  

### 🟦 SQLite 연결 정보 설정

프로젝트 루트의 `.env`에 SQLite 파일의 위치를 지정합니다.  

```dotenv
DATABASE_URL="file:./prisma/graphql-basics.db"
```

`prisma7.config.ts`는 Prisma CLI가 사용할 Schema와 마이그레이션 경로, 데이터베이스 연결 주소를 정의합니다.  

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Prisma Schema 파일과 마이그레이션 기록의 위치를 지정합니다.
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // .env의 DATABASE_URL을 Prisma CLI에 전달합니다.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

`import 'dotenv/config'`가 먼저 실행되므로 Prisma 설정에서 `.env`의 값을 읽을 수 있습니다.  
`schema.prisma`에는 데이터베이스 종류를 선언하고, 실제 파일 경로는 설정 파일에서 전달합니다.  

### 🟦 User와 Post 데이터 모델 정의

`prisma/schema.prisma`에는 Prisma Client 생성 방법과 데이터베이스 Model을 정의합니다.  

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  WITHDRAWN
}

enum UserRole {
  USER
  ADMIN
}

model User {
  id          Int        @id @default(autoincrement())
  email       String     @unique
  displayName String?    @map("display_name")
  status      UserStatus @default(ACTIVE)
  role        UserRole   @default(USER)
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")
  posts       Post[]

  @@index([status])
  @@index([role])
  @@map("users")
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  authorId  Int      @map("author_id")
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@index([createdAt, id])
  @@map("posts")
}
```

`User.posts`와 `Post.author`는 한 명의 사용자가 여러 게시글을 작성하는 일대다 관계를 나타냅니다. 실제 `posts` 테이블에는 `author_id` 외래 키가 만들어지고, `User.posts`는 Prisma에서 관계를 조회할 때 사용하는 필드입니다.  
사용자를 삭제하면 `onDelete: Cascade` 설정에 따라 그 사용자의 게시글도 함께 삭제됩니다.  

`@@map`은 Prisma Model과 실제 테이블 이름을 연결합니다.  

> 📌 Prisma Model과 GraphQL Object Type은 목적이 다릅니다. Prisma Model은 데이터베이스 구조를 정의하고, GraphQL Object Type은 클라이언트에 공개할 API 구조를 정의합니다. 필드 이름이 비슷해도 두 정의가 자동으로 연결되는 것은 아닙니다.  

### 🟦 Prisma Client 생성, 마이그레이션, 초기 데이터 저장

Schema를 작성한 뒤 다음 명령을 차례로 실행합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics

# SQLite 테이블과 마이그레이션 파일을 생성합니다.
npx prisma migrate dev --name init

# schema.prisma를 기준으로 Prisma Client를 생성합니다.
npx prisma generate

# 사용자와 게시글 실습 데이터를 저장합니다.
npx tsx prisma/seed.ts
```

## 3. Prisma Client 등록과 GraphQL Context 구성 {#session-03}

Resolver마다 Prisma Client를 새로 만들면 요청이 들어올 때마다 불필요한 인스턴스가 반복해서 생성되고 연결 자원이 낭비될 수 있습니다.  
이 프로젝트에서는 애플리케이션을 시작할 때 Prisma Client를 한 번 생성하고 Fastify 인스턴스에 등록합니다.  
GraphQL 라우트를 등록할 때는 이 Client로 Service를 한 번 구성합니다.  
각 요청에서는 미리 만든 Service와 요청별 `req`, `reply`를 GraphQL Context에 넣습니다.  

![GraphQL 서버 구동과 Prisma·Service 의존성 구성](/assets/images/nodejs/nodejs-graphql/graphql-05-server-query-flow.png)  

위 그림은 각 소스 코드의 역할과 서버가 구동되는 흐름을 보여 줍니다. 준비된 Service가 요청마다 새로 생성되는 GraphQL Context에 주입되어 재사용되는 구조도 함께 나타냅니다.  

> 📌 Prisma Client, Repository, Service는 서버를 구동할 때 한 번 생성하고 애플리케이션이 실행되는 동안 재사용합니다. GraphQL Context 객체는 요청마다 새로 만들며, 그 안의 `req`와 `reply`도 현재 HTTP 요청에 맞게 달라집니다.  

### 🟦 Prisma Client를 Fastify 플러그인으로 등록

`src/plugins/prisma.plugin.ts`는 SQLite 어댑터와 Prisma Client를 생성합니다.  
아래 예시는 Client의 생성·등록·종료 흐름에 집중하기 위해 Prisma 로그 처리 코드를 생략했습니다.  

```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

// 선언 병합을 사용해 Fastify 인스턴스에 prisma 속성이 있다는 사실을 TypeScript에 알려 줍니다.
declare module 'fastify' {
  interface FastifyInstance {
    // 플러그인 등록 후 라우트에서 app.prisma를 사용할 수 있습니다.
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Prisma 7이 better-sqlite3를 통해 SQLite에 접근하도록 구성합니다.
  const adapter = new PrismaBetterSqlite3({
    url: env.DATABASE_URL,
    // 다른 쓰기 작업이 DB 잠금을 해제할 때까지 최대 5초간 기다립니다.
    timeout: 5_000,
  });
  const prisma = new PrismaClient({ adapter });

  // 플러그인 등록 단계에서 연결 가능 여부를 먼저 확인합니다.
  await prisma.$connect();
  // 연결을 확인한 Prisma Client만 Fastify 인스턴스에 추가합니다.
  fastify.decorate('prisma', prisma);

  // Fastify가 종료될 때 Prisma가 사용한 자원도 함께 정리합니다.
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, { name: 'prisma-plugin' });
```

`declare module 'fastify'`는 Fastify 타입에 `prisma` 속성을 추가합니다.  
덕분에 TypeScript가 `app.prisma`를 `PrismaClient`로 인식합니다.  
`decorate()`는 실제 Fastify 인스턴스에 같은 속성을 등록합니다.  
타입 선언과 런타임 등록이 모두 있어야 안전하게 사용할 수 있습니다.  

`src/app.ts`에서는 GraphQL 라우트보다 Prisma 플러그인을 먼저 등록합니다.  
등록 순서가 바뀌면 라우트가 아직 준비되지 않은 `app.prisma`를 참조할 수 있습니다.  
아래 예시는 관련된 등록 순서만 나타냅니다.  

```typescript
export function createApp() {
  const app = Fastify({ logger: loggerOptions });

  // 라우트가 app.prisma를 사용할 수 있도록 먼저 등록합니다.
  app.register(prismaPlugin);
  app.register(routes, { prefix: '/api' });

  return app;
}
```

### 🟦 Context에는 Service를 전달

Prisma Client는 Fastify가 관리하지만 Resolver가 Client를 직접 사용하지는 않습니다.  
`createServices()`는 Prisma Client를 각 Repository에 전달하고, Repository가 주입된 Service 객체를 반환합니다.  

```typescript
// src/context.ts
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Services } from './services';

export interface GraphQLContext {
  req: FastifyRequest;  // req는 Resolver에서 현재 HTTP 요청 정보를 읽을 때 사용
  reply: FastifyReply;  // reply는 Resolver에서 HTTP 응답을 직접 제어해야 할 때 사용
  services: Services;   // Resolver가 데이터 조회와 업무 로직을 실행할 때 사용하는 Service 모음
}
```

```typescript
// src/services.ts
export function createServices(prisma: PrismaClient): Services {
  // 하나의 Prisma Client를 도메인별 Repository에 주입합니다.
  const userRepository = new UserRepository(prisma);
  const postRepository = new PostRepository(prisma);

  return {
    users: new UserService(userRepository),
    posts: new PostService(postRepository),
  };
}
```

`src/graphql/route.ts`는 라우트를 등록할 때 Service를 한 번 생성합니다.  
Service와 Repository는 요청별 상태를 보관하지 않으므로 여러 요청에서 같은 인스턴스를 재사용합니다. 요청이 들어오면 공통 Service와 요청별 `req`, `reply`로 Context를 만듭니다.  

```typescript
// /src/graphql/route.ts
export const graphqlRoute: FastifyPluginAsync = async (app) => {
  // 라우트 등록 시 한 번만 만들고 모든 GraphQL 요청에서 재사용합니다.
  const services = createServices(app.prisma);

  app.route({
    url: yoga.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    // Fastify가 받은 요청을 Yoga에 전달하고, Yoga가 만든 응답을 Fastify 응답으로 옮겨 클라이언트에 보냅니다.
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, {
        req,
        reply,
        services,
      });

      // Yoga가 만든 웹 표준 Response의 헤더와 상태 코드를 Fastify 응답에 옮깁니다.
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.status(response.status);
      // Yoga가 만든 응답 본문을 Fastify를 통해 클라이언트에 보냅니다.
      return reply.send(response.body);
    },
  });
};
```

Context는 같은 GraphQL 작업에서 실행되는 모든 Resolver가 공유합니다.  
따라서 Resolver는 전역 변수나 Fastify 인스턴스를 직접 참조하지 않고 `context.services`를 통해 필요한 기능을 호출할 수 있습니다.  
테스트할 때는 실제 Service 대신 테스트용 객체를 Context에 전달할 수도 있습니다.  

다음은 하나의 GraphQL 요청에서 두 개의 Resolver를 동시에 호출하여 GraphQL 서버와 데이터베이스 연동이 정상적으로 동작하는지 확인하는 테스트입니다.  

```graphql
query CheckGraphQLContext {
  hello(name: "Prisma")
  users {
    id
    email
  }
}
```

```json
{
  "data": {
    "hello": "Hello, Prisma!",
    "users": [
      {
        "id": "1",
        "email": "admin@example.com"
      },
      {
        "id": "2",
        "email": "developer@example.com"
      }
    ]
  }
}
```

## 4. 도메인 중심 프로젝트 구조와 계층별 역할 {#session-04}

이 프로젝트는 서버 구동과 GraphQL 연결에 필요한 공통 코드를 `src` 아래에 두고, 사용자와 게시글 기능은 `src/modules`에서 도메인별로 관리합니다.  

```text
src/
├── app.ts
├── context.ts
├── route.ts
├── server.ts
├── services.ts
├── graphql/
│   ├── route.ts
│   ├── schema.ts
│   └── yoga.ts
├── modules/
│   ├── user/
│   └── post/
├── plugins/
│   └── prisma.plugin.ts
└── generated/
    └── prisma/
```

### 🟦 도메인 계층의 역할

`src/modules/user`와 `src/modules/post`는 같은 계층 구조를 사용합니다. 파일 이름은 도메인마다 다르지만 각 계층이 맡는 책임은 같습니다.  

| 계층 | 주요 책임 | 의존 대상 |
| --- | --- | --- |
| Schema | 클라이언트에 공개할 타입과 작업 정의 | 다른 GraphQL 타입 |
| Resolver | GraphQL 인자와 Context를 받아 Service 호출 | Service |
| Service | 입력값 검증, 비즈니스 규칙, 오류 처리 | Repository |
| Repository | Prisma 쿼리 작성과 데이터 접근 | Prisma Client |
| Types | 계층 사이에서 공유하는 입력 타입 정의 | 생성된 Prisma 타입 |

의존성은 `Resolver → Service → Repository → Prisma Client` 방향으로 흐릅니다.  
Repository가 Service를 호출하거나 Service가 Resolver를 참조하는 역방향 의존성은 만들지 않습니다.  

## 5. 계층별 구현과 전체 요청 처리 흐름 {#session-05}

앞에서 살펴본 각 계층이 실제 코드에서 어떻게 구현되고 연결되는지 사용자 조회와 생성 기능을 중심으로 살펴봅니다.  

### 🟦 Schema: API에서 사용할 타입과 작업 정의

Schema는 클라이언트가 요청할 수 있는 필드와 입력값을 정의합니다.  
데이터베이스의 모든 열을 공개할 필요는 없으며, GraphQL API에 필요한 형태만 선언합니다.  
아래 코드는 사용자 타입과 주요 작업만 발췌한 예시입니다.  

```graphql
type User {
  id: ID!
  email: String!
  displayName: String
  status: UserStatus!
  role: UserRole!
  createdAt: String!
  updatedAt: String!
  posts: [Post!]!
}

extend type Query {
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
```

### 🟦 Resolver: GraphQL 요청을 Service로 전달

Resolver는 `args`에서 GraphQL 인자를 꺼내고 Context의 Service를 호출합니다.  
데이터베이스 조회 방법이나 이메일 중복 검사 같은 규칙은 Resolver에 작성하지 않습니다.  
아래 코드는 사용자 조회와 생성 흐름에 필요한 부분만 보여 줍니다.  

```typescript
// /src/modules/user/user.resolver.ts
export const userResolvers = {
  Query: {
    // 최상위 Resolver에서는 요청을 Service로 전달하고, 입력 검증과 업무 규칙은 Service에 맡깁니다.
    // 최상위 Query에는 상위 객체가 없으므로 첫 번째 인자를 사용하지 않습니다.
    // filter를 생략하거나 null로 전달하면 빈 조건을 사용해 모든 사용자를 조회합니다.
    users: (_parent: unknown, args: { filter?: UserFilter | null }, context: GraphQLContext) =>
      context.services.users.list(args.filter ?? {}),
    // ID에 해당하는 사용자를 조회하며, 사용자가 없으면 null을 반환합니다.  
    user: (_parent: unknown, args: { id: string }, context: GraphQLContext) =>
      context.services.users.find(args.id),
  },

  // 사용자 생성·수정·삭제에 필요한 검증과 업무 규칙은 Service에서 처리합니다.
  // 이메일 중복을 확인한 뒤 사용자를 생성하고, 생성된 사용자 정보를 반환합니다.
  Mutation: {
    createUser: (_parent: unknown, args: { input: CreateUserInput }, context: GraphQLContext) =>
      context.services.users.create(args.input),
  },

  User: {
    // 데이터베이스의 Date 객체를 SDL의 String 필드에 맞는 ISO 8601 문자열로 바꿉니다.
    createdAt: (parent: UserParent) => parent.createdAt.toISOString(),
    updatedAt: (parent: UserParent) => parent.updatedAt.toISOString(),
    // parent는 상위 필드가 반환한 사용자이며, 조회 방식에 따라 게시글이 이미 들어 있을 수 있습니다.
    posts: (parent: UserParent, _args: unknown, context: GraphQLContext) => {
      // 미리 가져온 관계가 있으면 재사용하고, 없을 때만 지연 조회해 불필요한 쿼리를 피합니다.
      if (Object.hasOwn(parent, 'posts')) return parent.posts ?? [];
      return context.services.users.posts(parent.id);
    },
  },
};
```

Resolver가 얇게 유지되면 GraphQL 필드와 애플리케이션 기능이 어떻게 연결되는지 쉽게 파악할 수 있습니다.  

### 🟦 Service: 입력값과 비즈니스 규칙 처리

Service는 GraphQL의 `ID` 문자열을 정수로 변환하고, 이메일 중복처럼 애플리케이션이 지켜야 할 규칙을 처리합니다. 아래 코드는 단건 조회와 생성 로직만 발췌한 예시입니다.  

```typescript
// /src/modules/user/user.service.ts
// GraphQL ID를 데이터베이스에서 사용하는 숫자 키로 변환하고 값이 올바른지 확인합니다.
function toId(value: string | number): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      'ID는 양의 정수여야 합니다.',
    );
  }

  return id;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  /** GraphQL ID를 숫자 키로 변환해 사용자를 조회하며, 대상이 없으면 null을 반환합니다. */
  find(idValue: string | number) {
    return this.users.findById(toId(idValue));
  }

  /** 이메일 중복을 확인한 뒤 새 사용자를 생성합니다. */
  async create(input: CreateUserInput) {
    // 데이터베이스 오류가 발생하기 전에 업무 의미가 분명한 오류를 반환합니다.
    if (await this.users.findByEmail(input.email)) {
      throw new BusinessError(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        '이미 사용 중인 이메일입니다.',
        409,
      );
    }

    return this.users.create(input);
  }
}
```

### 🟦 Repository: Prisma를 이용한 데이터 접근

Repository에는 Prisma 쿼리만 모아 둡니다. 어떤 GraphQL 필드가 이 메서드를 호출했는지는 알 필요가 없습니다. 아래 코드는 사용자 단건 조회와 생성에 사용하는 메서드만 보여 줍니다.  

```typescript
// /src/modules/user/user.repository.ts
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}
  /** 고유한 ID로 사용자를 조회하며, 대상이 없으면 null을 반환합니다. */
  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  /** 고유한 이메일로 사용자를 조회하며, 중복 검사에도 사용합니다. */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
  /** 입력값과 기본 역할을 사용해 새 사용자를 저장합니다. */
  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName ?? null,
        role: input.role ?? 'USER',
      },
    });
  }
}
```

### 🟦 기능별 Schema와 Resolver 결합

`src/graphql/schema.ts`는 각 도메인에 나뉜 Schema와 Resolver를 하나의 실행 가능한 GraphQL Schema로 결합합니다.  

```typescript
export const schema = createSchema<GraphQLContext>({
  typeDefs: [helloTypeDefs, userTypeDefs, postTypeDefs],
  resolvers: [helloResolvers, userResolvers, postResolvers],
});
```

새 도메인을 추가할 때 해당 모듈의 Schema와 Resolver를 배열에 연결하면 같은 `/api/graphql` 엔드포인트에서 사용할 수 있습니다.  
기능별 파일은 나뉘어 있지만 클라이언트에는 하나의 GraphQL Schema로 제공됩니다.  

### 🟦 전체 요청 흐름 정리

`user(id: "1")` 요청이 들어왔을 때 실제 코드의 호출 흐름은 다음과 같습니다.  

```text
Query.user Resolver
  └─ context.services.users.find("1")
       └─ UserService.find("1")
            ├─ "1"을 숫자 1로 변환하고 검증
            └─ UserRepository.findById(1)
                 └─ prisma.user.findUnique({ where: { id: 1 } })
                      └─ SQLite users 테이블 조회
```

이 구조에서 Resolver는 GraphQL 요청 처리에, Service는 비즈니스 규칙에, Repository는 데이터베이스 접근에 집중합니다. 코드의 양은 단순한 Resolver 하나보다 늘어나지만 기능이 확장될수록 변경 위치가 분명해지고 각 계층을 독립적으로 테스트하기 쉬워집니다.  
