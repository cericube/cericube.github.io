---
layout: post
title: "01. GraphQL 개념과 Fastify + Yoga 환경 구성"
description: "REST API와 비교하며 GraphQL의 동작 방식과 Schema, Query, Mutation, Resolver의 역할을 알아봅니다. npm workspace에 Fastify와 GraphQL Yoga 환경을 구성하고 GraphiQL에서 첫 Query를 실행합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 1
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL 개념과 REST API 비교"
  - id: session-02
    title: "2. GraphQL 핵심 구성 요소: Schema, Query, Mutation, Resolver"
  - id: session-03
    title: "3. Fastify + GraphQL Yoga 연동 및 프로젝트 구조"
  - id: session-04
    title: "4. GraphiQL을 이용한 첫 번째 Query 실습"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. GraphQL 개념과 REST API 비교 {#session-01}

웹 화면에 필요한 데이터를 서버에서 가져올 때, REST API는 데이터마다 주소(URL)를 따로 두고 요청합니다.  
반면 GraphQL API는 일반적으로 하나의 주소로 요청하며, 클라이언트가 원하는 데이터 항목만 골라 담아 가져오는 통신 규칙이자 쿼리 언어입니다.  

### 🟦 REST API의 데이터 조회 방식과 한계

REST API는 일반적으로 리소스 단위의 고유 URL로 데이터를 조회합니다.  
예를 들어 한 화면에서 특정 사용자의 프로필과 작성한 게시글을 함께 보여주려면, 다음과 같이 API를 각각 호출해야 합니다.  

```text
GET /users/1        # 사용자 정보 조회
GET /users/1/posts  # 게시글 목록 조회
```

이러한 구조는 화면에 필요한 데이터를 가져오는 과정에서 크게 두 가지 비효율을 초래합니다.  

- **과소 조회 (Under-fetching):** 한 번의 요청으로 필요한 데이터를 전부 가져오지 못해 여러 엔드포인트를 연달아 호출해야 합니다. 이로 인해 네트워크 요청 횟수와 대기 시간이 함께 늘어납니다.  
- **과다 조회 (Over-fetching):** 화면 표시에 필요 없는 필드(주소, 수정일, 내부 메타데이터 등)까지 함께 전달받아 불필요한 네트워크 트래픽이 발생합니다.  

화면 전용 API(BFF 패턴 등)를 따로 만들어 해결할 수도 있지만, UI 요구사항이 바뀔 때마다 서버 API를 매번 새로 작성하거나 수정해야 하므로 개발과 유지보수의 부담이 커집니다.  

### 🟦 GraphQL의 데이터 조회 방식

GraphQL은 일반적으로 `/graphql`이라는 단일 엔드포인트로 다음과 같은 쿼리(Query)를 요청합니다.  

```graphql
query GetUser {
  user(id: "1") {
    id
    name
    posts {
      id
      title
    }
  }
}
```

중괄호 안에 나열한 필드 목록을 **선택 집합(Selection Set)**이라고 부릅니다.  
클라이언트가 실제로 응답받고자 하는 필드를 직접 지정하는 영역입니다.  
위 쿼리에서는 사용자와 게시글의 `id`, `name`, `title`만 지정했습니다. 서버는 요청받은 구조 그대로 데이터를 감싸 응답합니다.  

```json
{
  "data": {
    "user": {
      "id": "1",
      "name": "김개발",
      "posts": [
        {
          "id": "101",
          "title": "GraphQL 시작하기"
        }
      ]
    }
  }
}
```

### 🟦 REST API와 GraphQL 비교

| 구분 | REST API | GraphQL |
| --- | --- | --- |
| 엔드포인트 | 자원과 작업에 따라 여러 URL을 사용합니다. | 보통 하나의 `/graphql` URL을 사용합니다. |
| 응답 형태 | 서버가 정한 형태로 반환합니다. | 클라이언트가 요청한 필드 형태로 반환합니다. |
| API 명세 | OpenAPI 같은 별도 명세를 사용할 수 있습니다. | Schema 자체가 타입이 있는 API 명세 역할을 합니다. |
| 데이터 조회 | 여러 엔드포인트를 호출할 수 있습니다. | 관계가 연결된 데이터를 한 Query로 표현할 수 있습니다. |
| HTTP 메서드 | `GET`, `POST`, `PATCH`, `DELETE` 등으로 의미를 구분합니다. | 주로 `POST`를 사용하고 Query와 Mutation으로 작업을 구분합니다. |
| 캐싱 | URL과 HTTP 캐시를 활용하기 쉽습니다. | Query와 응답을 고려한 별도 캐싱 전략이 필요합니다. |

GraphQL이 언제나 REST보다 더 좋은 것은 아닙니다.  
주고받는 데이터의 형태가 단순하고 HTTP 캐시를 적극적으로 사용해야 한다면 REST가 더 알맞을 수 있습니다.  
반면 화면마다 필요한 데이터 조합이 다르거나 서로 연결된 데이터를 유연하게 조회해야 한다면 GraphQL이 유용합니다.  

> 📌 GraphQL은 필요한 필드만 선택할 수 있게 해 주지만, 데이터베이스 조회가 자동으로 최적화된다는 뜻은 아닙니다. Resolver 구현에 따라 N+1 문제나 비효율적인 쿼리가 생길 수 있으며, 이 내용은 이후 편에서 다룹니다.  

## 2. GraphQL 핵심 구성 요소: Schema, Query, Mutation, Resolver {#session-02}

GraphQL 서버를 구축할 때는 먼저 클라이언트가 어떤 데이터를 요청할 수 있는지 정의해야 합니다.  
데이터의 구조와 요청 규칙은 **Schema**에 선언하고, 실제 데이터를 조회하거나 변경하는 비즈니스 로직은 **Resolver**에 작성합니다.  
클라이언트는 Schema에 정의된 필드를 바탕으로 **Query**나 **Mutation** 요청을 보냅니다.  

이 관계는 다음과 같이 세 부분으로 나누어 이해할 수 있습니다.  

```text
Schema
├── 데이터 타입: type User
├── 조회 타입: type Query
└── 변경 타입: type Mutation

클라이언트 작업(Operation)
├── 조회 요청: query GetUser
└── 변경 요청: mutation CreateUser

Resolver
└── Schema에 정의된 필드를 실제로 처리하는 함수
```

여기서 `Query`와 `Mutation`이라는 용어는 두 가지 맥락에서 쓰입니다.  
대문자로 시작하는 `type Query`, `type Mutation`은 **Schema를 구성하는 루트(Root) 타입 정의**이고, 소문자로 시작하는 `query`, `mutation`은 **클라이언트가 서버로 보내는 실제 요청 작업(Operation)**을 의미합니다.  

### 🟦 Schema

Schema는 GraphQL API에서 사용할 데이터의 구조와 클라이언트가 수행할 수 있는 작업을 정의합니다.  
즉, **클라이언트가 어떤 데이터를 조회하거나 변경할 수 있는지 정해 놓은 API 명세**입니다.  
GraphQL에서는 Schema Definition Language(SDL)라는 문법으로 여러 타입을 작성해 Schema를 구성합니다.  
`type User`, `type Query`, `type Mutation`은 모두 Schema 안에 작성하는 타입 정의입니다.  
세 타입은 작성 방법은 같지만 담당하는 역할이 다릅니다.  
`User`는 사용자 데이터의 구조를 나타내고, `Query`와 `Mutation`은 클라이언트가 요청할 수 있는 작업을 정의합니다.  

먼저 사용자 데이터의 구조를 정의해 보겠습니다.  

```graphql
# 사용자 정보를 나타내는 타입
type User {
  id: ID!
  name: String!
  email: String!
}
```

`type User`는 사용자 정보가 `id`, `name`, `email` 필드로 구성된다는 것을 나타내는 객체 타입입니다.  
`String`과 `ID`는 문자열이나 식별자처럼 하나의 값을 표현하는 Scalar 타입입니다.  
타입 뒤에 붙은 `!`는 `null`을 허용하지 않는다는 뜻입니다. 따라서 `User` 객체의 `id`, `name`, `email`에는 반드시 값이 있어야 합니다.  

GraphQL 서버는 `User` 같은 데이터 모델 타입과 `Query`, `Mutation` 같은 루트 작업 타입을 모아 전체 Schema를 구성합니다.  
그리고 들어오는 클라이언트 요청이 이 Schema 규칙에 부합하는지 엄격히 검증합니다.  
GraphiQL 같은 개발 도구 역시 Schema 정보를 읽어 자동 완성과 대화형 API 문서를 제공합니다.  

### 🟦 Query: Schema 정의와 조회 요청

Query는 서버의 데이터를 조회하는 작업입니다. REST API의 `GET` 요청과 유사한 역할을 합니다.  
서버에서는 클라이언트가 요청할 수 있는 조회 필드 목록을 Schema의 `type Query`에 정의합니다.  

```graphql
# 클라이언트가 요청할 수 있는 조회 작업
type Query {
  hello: String!
  user(id: ID!): User
}
```

`type Query`는 모든 조회 작업의 진입점이 되는 최상위 루트 타입입니다.  

- `hello`는 필수 문자열(`String!`)을 반환합니다.  
- `user`는 식별자 값인 `id: ID!`를 필수로 받아, 해당 사용자의 `User` 객체나 `null`(존재하지 않을 경우)을 반환합니다.  

클라이언트는 Schema에 정의된 `user` 필드를 활용해 다음과 같이 `query` 요청을 작성합니다.  

```graphql
query GetUser {
  user(id: "1") {
    id
    name
  }
}
```

`query GetUser { ... }`는 GraphQL 서버로 전송하는 조회 요청입니다.  
`GetUser`는 해당 요청을 식별하기 위해 클라이언트가 붙인 작업 이름(Operation Name)입니다.  
이 요청은 `user` 필드에 인자값으로 `id: "1"`을 전달하고, 결과 데이터 중 필요한 `id`와 `name` 필드만 선택해 받아옵니다.  

- **`type Query`**: 서버가 클라이언트에 제공할 조회 필드 명세를 Schema에 선언합니다.  
- **`query GetUser`**: 클라이언트가 Schema에 선언된 규칙에 맞춰 실제 데이터 조회를 요청합니다.  

### 🟦 Mutation: Schema 정의와 변경 요청

Mutation은 서버의 데이터를 생성, 수정, 삭제하는 작업입니다.  
REST API에서는 이러한 동작을 `POST`, `PUT/PATCH`, `DELETE` 같은 HTTP 메서드로 구분하지만, GraphQL에서는 모든 변경 작업을 Schema의 `type Mutation`에 선언합니다.  
*(실제 네트워크 통신은 일반 Query와 마찬가지로 주로 단일 HTTP POST 엔드포인트를 통해 이루어집니다.)*

```graphql
type Mutation {
  createUser(name: String!, email: String!): User!
}
```

`type Mutation`은 데이터 변경 작업의 진입점 역할을 하는 루트 타입입니다.  
`createUser`는 `name`과 `email`을 필수 인자로 받아 새 사용자를 생성하고, 생성된 `User` 객체를 반환합니다.  

클라이언트는 Schema에 정의된 `createUser` 필드를 바탕으로 다음과 같이 `mutation` 요청을 보냅니다.  

```graphql
mutation CreateUser {
  createUser(name: "김개발", email: "dev@example.com") {
    id
    name
  }
}
```

`mutation CreateUser { ... }`는 서버로 보내는 사용자 생성 요청입니다.  
`createUser` 필드에 생성할 사용자의 정보를 전달하고, 작업 완료 후 생성된 데이터의 `id`와 `name`만 결과로 돌려받도록 지정했습니다.  

- **`type Mutation`**: 서버가 수행 가능한 데이터 변경 필드 명세를 Schema에 선언합니다.  
- **`mutation CreateUser`**: 클라이언트가 Schema 규칙에 맞춰 데이터 변경을 요청합니다.  

Query와 마찬가지로 Mutation 역시 작업 처리 후 반환받을 필드를 클라이언트가 직접 선택할 수 있습니다.  

### 🟦 Resolver

Schema가 데이터의 형태와 API 명세를 정의한다면, Resolver는 요청받은 필드의 실제 데이터를 조회하거나 계산하는 함수입니다.  
클라이언트 요청이 서버에 도달하면 GraphQL 엔진은 요청한 각 필드의 Resolver를 실행해 결과값을 만듭니다. 명시적인 Resolver가 없는 필드는 기본 Resolver가 상위 객체에서 같은 이름의 속성을 읽어 처리합니다.  

```typescript
const resolvers = {
  Query: {
    // 1. 인자가 없는 단순 필드
    hello: () => 'Hello, GraphQL!',

    // 2. 클라이언트가 전달한 args(id)를 받아 데이터를 반환하는 필드
    user: (parent, args, context, info) => {
      return findUserById(args.id);
    },
  },
};
```

Resolver 함수는 필요에 따라 다음 네 가지 값을 인자로 받을 수 있습니다.  

```typescript
(parent, args, context, info) => result
```

- `parent`는 상위 필드 Resolver가 반환한 값입니다. 사용자 안의 게시글처럼 서로 연결된 데이터를 조회할 때 사용합니다.  
- `args`는 Query나 Mutation에서 전달한 `id` 같은 입력값입니다.  
- `context`는 현재 요청에서 Resolver들이 공유할 인증 정보나 데이터베이스 클라이언트를 담습니다.  
- `info`는 현재 처리 중인 필드와 전체 GraphQL 요청에 관한 정보를 담습니다.  

GraphQL 서버가 요청을 받아 응답을 반환하기까지의 전체 흐름은 다음과 같습니다.  

```text
클라이언트 Query 요청 (GetUser)
      ↓
Schema를 기준으로 문법 및 타입 검증
      ↓
Query.user Resolver 실행 (args.id를 전달받아 데이터 조회)
      ↓
요청한 필드(id, name) 형태에 맞춰 응답 반환 ({ data: { user: { ... } } })
```

## 3. Fastify + GraphQL Yoga 연동 및 프로젝트 구조 {#session-03}

이 글에서는 Fastify와 GraphQL Yoga를 함께 사용합니다. Fastify는 HTTP 서버를 실행하고 요청받을 주소를 관리합니다.  
GraphQL Yoga는 GraphQL 요청을 해석하고, Schema에 맞는 요청인지 확인한 뒤 Resolver를 실행합니다. 브라우저에서 API를 시험할 수 있는 GraphiQL도 기본으로 제공합니다.  

### 🟦 npm workspace 프로젝트 생성

먼저 workspace 루트에서 `graphql-basics` 디렉터리를 만들고 기본 `package.json`을 생성합니다.  
소스 코드를 저장할 `src` 디렉터리도 함께 만듭니다.  

```bash
# npm workspace 루트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook

# GraphQL 실습용 하위 프로젝트를 생성합니다.
mkdir graphql-basics
cd graphql-basics
npm init -y
mkdir src
```

그다음 루트 `package.json`의 `workspaces` 목록에 `graphql-basics`를 추가합니다.  
이렇게 등록하면 `graphql-basics`에서도 루트에 설치된 공통 개발 도구를 사용할 수 있습니다.  
패키지의 실제 설치 버전을 기록하는 `package-lock.json`도 루트에서 함께 관리합니다.  

```jsonc
{
  "name": "nodejs-workbook",
  "private": true,
  "type": "module",
  "workspaces": [
    "prisma-basics",
    "redis-basics",
    "vitest-basics",
    "fastify-basics",
    "observability-basics",
    "graphql-basics"
  ]
}
```

### 🟦 Fastify와 GraphQL Yoga 설치

```bash
# Fastify, Yoga와 GraphQL.js를 하위 프로젝트에 설치합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm install fastify@5.6.2 graphql-yoga@5.24.1 graphql@17.0.2
npm install pino-pretty@13.1.3
```

각 패키지의 역할은 다음과 같습니다.  

- `fastify`는 HTTP 서버를 실행하고 `/graphql` 요청을 받을 경로를 등록합니다.  
- `graphql-yoga`는 GraphQL 요청을 처리하고 GraphiQL 화면을 제공합니다.  
- `graphql`은 Schema와 Query를 해석하고 검증한 뒤 실행하는 핵심 기능을 제공합니다.  
- `pino-pretty`는 개발 환경의 Fastify 로그를 읽기 쉬운 형식으로 출력합니다.  
- `tsx`와 `typescript`는 workspace 루트에 이미 있으므로 다시 설치하지 않습니다.  

설치를 마치면 `graphql-basics/package.json`의 주요 의존성은 다음과 같습니다.  

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.6.2",
    "graphql": "^17.0.2",
    "graphql-yoga": "^5.24.1",
    "pino-pretty": "^13.1.3"
  }
}
```

### 🟦 TypeScript 설정

`graphql-basics/tsconfig.json`은 루트의 TypeScript 설정을 그대로 가져와 사용합니다. 하위 프로젝트에서는 검사할 소스 경로와 캐시 파일의 위치만 따로 지정합니다.  

```jsonc
{
  // Node.js, ESM과 엄격한 타입 검사 옵션을 루트에서 상속합니다.
  "extends": "../tsconfig.json",
  "compilerOptions": {
    // 다른 workspace용 경로 별칭을 이 프로젝트에서는 사용하지 않습니다.
    "paths": {},
    // 증분 검사 캐시는 소스 디렉터리 밖에 저장합니다.
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts"
  ],
  "exclude": ["node_modules", "dist", "coverage", "generated"]
}
```

### 🟦 프로젝트 구조

GraphQL의 HTTP 연결 코드는 `src/graphql`에 두고, 기능별 Schema와 Resolver는 `src/modules`에 나눕니다. 1편에서는 첫 Query를 실행하는 데 필요한 공통 서버 코드와 `hello` 모듈만 살펴봅니다.  

아래 구조는 1편에서 사용하는 파일만 나타냅니다. GitHub의 완성된 실습 소스에는 이후 편에서 추가하는 Prisma, 사용자, 게시글 관련 파일도 포함되어 있습니다.  

```text
nodejs-workbook/
├── package.json
├── package-lock.json
├── tsconfig.json
└── graphql-basics/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── app.ts
        ├── context.ts
        ├── route.ts
        ├── server.ts
        ├── config/
        │   └── env.ts
        ├── graphql/
        │   ├── route.ts
        │   ├── schema.ts
        │   └── yoga.ts
        ├── modules/
        │   └── hello/
        │       ├── hello.resolver.ts
        │       └── hello.schema.ts

```

- `src/app.ts`는 공통 Fastify 애플리케이션을 생성하고 전체 라우트를 등록합니다.  
- `src/route.ts`는 GraphQL HTTP 라우트를 애플리케이션에 등록합니다.  
- `src/server.ts`는 환경 변수의 호스트와 포트로 애플리케이션을 실행합니다.  
- `src/context.ts`는 Resolver가 한 요청 안에서 공유할 요청 정보의 타입을 정의합니다.  
- `src/config/env.ts`는 환경 변수를 읽고 검증합니다.  
- `src/graphql/schema.ts`는 기능별 Schema와 Resolver를 하나로 결합합니다.  
- `src/graphql/yoga.ts`는 결합된 Schema로 Yoga 인스턴스를 생성합니다.  
- `src/graphql/route.ts`는 Yoga를 Fastify 라우트와 연결합니다.  
- `src/modules/hello/`는 1편의 `hello` Schema와 Resolver를 정의합니다.  

### 🟦 GraphQL Context 작성

먼저 `src/context.ts`에 Resolver가 공유할 요청별 Context 타입을 작성합니다.  

```typescript
// src/context.ts
import type { FastifyRequest, FastifyReply } from 'fastify';

// Context는 한 GraphQL 요청에서 실행되는 모든 Resolver가 공유하는 객체입니다.
export interface GraphQLContext {
  req: FastifyRequest; // 현재 HTTP 요청에 대한 정보를 담고 있습니다.
  reply: FastifyReply; // 현재 요청에 대한 Fastify 응답 객체입니다.
}
```

Context는 하나의 GraphQL 요청에서 실행되는 모든 Resolver가 공유하는 객체입니다.  
1편에서는 HTTP 요청과 응답 정보를 나타내는 `req`, `reply`만 담습니다. 이후 Prisma를 연동하는 5편에서는 Resolver가 비즈니스 로직을 호출할 수 있도록 Service를 Context에 추가합니다.  

### 🟦 Schema와 Resolver 작성

먼저 `hello` 기능의 SDL과 Resolver를 각각 작성합니다.  

```typescript
// src/modules/hello/hello.schema.ts
export const helloTypeDefs = /* GraphQL */ `
  type Query {
    "1편: 가장 단순한 Root Query 실습"
    hello(name: String = "GraphQL"): String!
  }
`;
```

```typescript
// src/modules/hello/hello.resolver.ts
export const helloResolvers = {
  Query: {
    // name을 생략하면 SDL의 기본값인 "GraphQL"이 args에 들어옵니다.
    hello: (_parent: unknown, args: { name?: string | null }) =>
      `Hello, ${args.name ?? 'GraphQL'}!`,
  },
};
```

`src/graphql/schema.ts`는 기능별 정의를 하나의 실행 가능한 Schema로 결합합니다. 1편에서는 `hello` Schema와 Resolver만 연결합니다.  

```typescript
// src/graphql/schema.ts 중 Schema 생성 부분
export const schema = createSchema<GraphQLContext>({
  typeDefs: [helloTypeDefs],
  resolvers: [helloResolvers],
});
```

### 🟦 GraphQL Yoga 생성

다음으로 `src/graphql/yoga.ts`에서 앞서 만든 Schema와 Context 타입을 이용해 Yoga 인스턴스를 생성합니다.  

```typescript
// src/graphql/yoga.ts
import { createYoga } from 'graphql-yoga';

import type { GraphQLContext } from '../context';
import { schema } from './schema';

// Yoga는 HTTP 요청에서 GraphQL 문서와 Variables를 읽고 Schema를 실행한 뒤
// GraphQL 응답 형식인 { data, errors } 객체를 생성합니다.
export const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql',
  graphiql: true,
});
```

`graphqlEndpoint`에는 Fastify 라우트에 등록할 `/graphql` 경로를 지정합니다.  
`graphiql: true`로 설정하면 해당 경로에 브라우저로 접속했을 때 GraphiQL 화면을 제공합니다.  

### 🟦 Fastify와 Yoga 연결

`src/graphql/route.ts`에서는 `/graphql` 요청을 Yoga에 전달하는 Fastify 플러그인을 만듭니다.  

```typescript
// src/graphql/route.ts

/* eslint-disable @typescript-eslint/require-await */

import type { FastifyPluginAsync } from 'fastify';

import { yoga } from './yoga';

export const graphqlRoute: FastifyPluginAsync = async (app) => {
  app.route({
    url: yoga.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      // 첫 번째 req는 Fastify가 받은 HTTP 요청이고,
      // 두 번째 reply는 Fastify가 클라이언트에 보낼 응답 객체입니다.
      // 세 번째 인자는 한 요청 안에서 모든 Resolver가 공유할 Context입니다.
      const response = await yoga.handleNodeRequestAndResponse(req, reply, {
        req,
        reply,
      });

      // 반환된 response는 Yoga가 GraphQL 작업을 처리해 만든 표준 Web Response입니다.
      // 이 객체의 상태 코드, 헤더, 본문을 Fastify 응답에 옮깁니다.
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);
      return reply.send(response.body);
    },
  });
};
```

이 라우트는 `GET`, `POST`, `OPTIONS` 요청을 받습니다. 각 HTTP 메서드는 다음 역할을 합니다.  

- `GET`은 브라우저에서 GraphiQL 화면을 열거나, 서버가 허용하는 Query 작업을 전송할 때 사용합니다. Mutation 작업에는 사용하지 않습니다.  
- `POST`는 JSON으로 전달한 GraphQL 요청을 처리합니다.  
- `OPTIONS`는 브라우저가 실제 요청을 보내기 전에 서버에서 허용하는 요청인지 확인할 때 사용합니다.  

`handleNodeRequestAndResponse()`의 앞쪽 `req`와 `reply`는 Yoga가 HTTP 요청을 처리하는 데 사용합니다.  
세 번째 인자로 전달한 객체는 GraphQL Context가 되어 한 요청에서 실행되는 모든 Resolver가 공유합니다.  
Yoga가 반환한 `response`에는 클라이언트에 보낼 상태 코드, 헤더, 본문이 들어 있습니다.  
코드에서는 이 값을 Fastify의 `reply`에 차례로 옮겨 최종 응답을 보냅니다.  

### 🟦 GraphQL 라우트를 공통 애플리케이션에 등록

`src/route.ts`는 GraphQL 라우트를 애플리케이션에 등록합니다. 기능별 Schema와 Resolver는 앞에서 하나로 결합했으므로 하나의 엔드포인트로 제공할 수 있습니다.  

```typescript
// src/route.ts
import type { FastifyInstance } from 'fastify';

import { graphqlRoute } from './graphql/route';

export function routes(fastify: FastifyInstance) {
  fastify.register(graphqlRoute);
}
```

공통 `src/app.ts`는 Fastify 애플리케이션을 생성하고 전체 라우트에 `/api` 접두사를 붙여 등록합니다. 아래 코드는 연결 순서를 보여 주기 위해 핵심 부분만 나타낸 것입니다.  

```typescript
// src/app.ts 중 라우트 등록 부분
import Fastify from 'fastify';

import { routes } from './route';

export function createApp() {
  const app = Fastify({
    // 로깅, 타임아웃과 같은 공통 서버 옵션을 설정합니다.
  });

  // GraphQL API 앞에 /api 접두사를 붙입니다.
  app.register(routes, { prefix: '/api' });

  return app;
}
```

따라서 `app.ts`의 `/api`와 Yoga의 `/graphql`이 결합되어 최종 GraphQL 주소는 `/api/graphql`이 됩니다.  

공통 `src/server.ts`는 `createApp()`으로 애플리케이션을 만들고 `env.HOST`와 `env.PORT` 값을 사용해 서버를 실행합니다. `.env`에서 별도로 지정하지 않으면 기본 포트는 3000번입니다.  

파일 작성을 마쳤다면 먼저 TypeScript 타입 오류가 없는지 확인한 뒤 개발 서버를 실행합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics

# TypeScript 오류가 없는지 검사합니다.
npm run typecheck

# 파일 변경을 감지하는 개발 서버를 실행합니다.
npm run dev
```

## 4. GraphiQL을 이용한 첫 번째 Query 실습 {#session-04}

GraphiQL은 브라우저에서 GraphQL 요청을 작성하고 바로 실행해 볼 수 있는 개발 도구입니다.  
별도의 프로그램을 설치하지 않아도 Schema 문서와 자동 완성 기능을 사용할 수 있으며, 요청의 실행 결과도 한 화면에서 확인할 수 있습니다.  

### 🟦 GraphiQL 열기

개발 서버를 실행한 상태에서 브라우저를 열고 다음 주소로 접속합니다.  

```text
http://localhost:3000/api/graphql
```

![GraphQL 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-08.png)  
GraphiQL에서 Query를 실행하면 서버는 다음 순서로 요청을 처리합니다.  

```text
GraphiQL에서 FirstQuery 실행
        ↓
POST /api/graphql 요청
        ↓
Yoga가 Query를 읽고 Schema에 맞는지 검사
        ↓
Query.hello Resolver 실행
        ↓
Fastify가 JSON 응답 반환
```

### 🟦 Schema 문서와 자동 완성 확인

GraphiQL의 Schema 문서에서 `Query`를 선택하면 `hello(name: String = "GraphQL"): String!` 정의를 확인할 수 있습니다.  
Query 편집기의 중괄호 안에서 자동 완성을 실행하면 Schema에 정의된 `hello` 필드가 나타납니다.  

이번에는 Schema에 없는 `unknown` 필드를 요청해 보겠습니다.  

```graphql
query InvalidQuery {
  unknown
}
```

![GraphQL 오류 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-08-1.png)
`unknown`은 Schema에 정의되지 않았으므로 Resolver를 실행하지 않고 오류를 반환합니다. 응답의 `errors`에는 `Query` 타입에 해당 필드가 없다는 내용이 담깁니다.  

이처럼 Schema는 API의 구조를 알려 주는 문서이면서, 클라이언트의 요청이 올바른지 확인하는 기준이기도 합니다.  

### 🟦 curl로 같은 Query 호출하기

GraphiQL도 내부적으로는 `/api/graphql` 주소로 HTTP 요청을 보냅니다.  
터미널에서 같은 요청을 직접 보내 보면 GraphQL 요청이 어떤 형태로 서버에 전달되는지 확인할 수 있습니다.  

```bash
# GraphQL 작업 문자열을 JSON의 query 속성에 담아 전송합니다.
curl http://localhost:3000/api/graphql \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"query":"query FirstQuery { hello(name: \"Fastify\") }"}'
```

서버가 요청을 정상적으로 처리하면 다음 JSON을 반환합니다.  

```json
{"data":{"hello":"Hello, Fastify!"}}
```
