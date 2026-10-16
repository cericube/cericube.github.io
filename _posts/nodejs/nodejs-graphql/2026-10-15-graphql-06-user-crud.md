---
layout: post
title: "06. Prisma 기반 User CRUD API 구현"
description: "GraphQL Schema와 Input Type으로 User CRUD API의 계약을 정의합니다. Query와 Mutation이 Resolver, Service, Prisma Repository로 이어지는 흐름을 이해하고 사용자 조회·생성·수정·삭제 API를 실습합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 6
ai_assisted: true
toc:
  - id: session-01
    title: "1. User GraphQL Schema와 Input Type 정의"
  - id: session-02
    title: "2. 사용자 조회 API 구현: Query와 Resolver"
  - id: session-03
    title: "3. 사용자 생성·수정·삭제 API 구현: Mutation과 Resolver"
  - id: session-04
    title: "4. Service 계층을 활용한 CRUD 처리 및 API 실습"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

GraphQL에서는 하나의 고정된 응답 형식을 서버가 정하지 않습니다.  
Schema가 사용할 수 있는 필드와 입력 규칙을 정의하면, 클라이언트가 필요한 필드를 선택하고 Resolver가 해당 요청을 실제 애플리케이션 기능으로 연결합니다.  

## 1. User GraphQL Schema와 Input Type 정의 {#session-01}

GraphQL Schema는 클라이언트와 서버가 함께 지켜야 하는 API 계약입니다.  
사용자 CRUD를 구현하려면 먼저 반환할 `User` 타입, 입력에 사용할 Input Type, 요청의 시작점인 Query와 Mutation을 정의해야 합니다.  
![Schema 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-15.png)

### 🟦 User 타입과 Enum 정의

`User`는 사용자 API가 반환할 수 있는 필드를 나타냅니다. 데이터베이스에 열이 있다고 해서 모두 GraphQL에 공개할 필요는 없습니다. 클라이언트에 필요한 필드만 선택해 선언합니다.  

```graphql
enum UserStatus {
  ACTIVE
  SUSPENDED
  WITHDRAWN
}

enum UserRole {
  USER
  ADMIN
}

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
```

`ID`는 객체를 식별하는 값임을 나타내는 GraphQL Scalar입니다.  
응답에서는 문자열로 표현되지만, 서버 내부에서는 Prisma가 사용하는 숫자 ID로 변환할 수 있습니다.  
`UserStatus`와 `UserRole`을 Enum으로 선언하면 정해진 값 이외의 문자열은 Resolver가 실행되기 전에 거부됩니다.  

필드 뒤의 `!`는 `null`을 허용하지 않는다는 뜻입니다.  
`displayName`은 `String`이므로 값이 없을 수 있지만, `email: String!`은 항상 문자열을 반환해야 합니다.  

### 🟦 목적에 따라 Input Type 나누기

GraphQL의 `type`은 주로 응답에 사용하고, `input`은 Query나 Mutation에 전달할 입력 객체를 정의할 때 사용합니다.  
목록 필터, 생성, 수정은 필요한 값과 선택 규칙이 서로 다르므로 하나의 Input Type을 공유하지 않고 목적별로 나눕니다.  

```graphql
input UserFilter {
  status: UserStatus
  role: UserRole
}

input CreateUserInput {
  email: String!
  displayName: String
  role: UserRole = USER
}

input UpdateUserInput {
  email: String
  displayName: String
  status: UserStatus
  role: UserRole
}
```

각 Input Type의 역할은 다음과 같습니다.  

| Input Type | 용도 | 핵심 규칙 |
| --- | --- | --- |
| `UserFilter` | 사용자 목록 필터링 | 모든 조건을 생략할 수 있습니다. |
| `CreateUserInput` | 사용자 생성 | `email`은 필수이고 `role`의 기본값은 `USER`입니다. |
| `UpdateUserInput` | 사용자 부분 수정 | 전달한 필드만 변경합니다. |

수정 입력에서는 필드를 생략하는 것과 `null`을 명시하는 것을 구분할 수 있습니다.  
예를 들어 `displayName`을 생략하면 기존 값을 유지하고, `displayName: null`을 전달하면 표시 이름을 지웁니다.  

> 📌 GraphQL의 `!`는 TypeScript의 선택 속성과 별도로 동작합니다. GraphQL Schema는 클라이언트 요청을 검사하고, TypeScript 타입은 서버 코드를 작성할 때 값의 형태를 검사합니다.  

### 🟦 Query와 Mutation 필드 정의

사용자 목록과 단건 조회는 `Query`, 데이터 변경은 `Mutation`에 선언합니다.  

```graphql
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

반환 타입을 읽으면 API의 결과를 예상할 수 있습니다.  

- `users`는 목록 자체와 목록 안의 사용자 모두 `null`을 허용하지 않습니다.  
- `user`는 요청한 사용자가 없으면 `null`을 반환할 수 있습니다.  
- `createUser`와 `updateUser`는 처리된 사용자 객체를 반환합니다.  
- `deleteUser`는 삭제 성공 여부를 `Boolean`으로 반환합니다.  

Schema는 API가 허용하는 요청과 응답의 모양을 정할 뿐, 데이터를 어디서 어떻게 가져올지는 알지 못합니다. 실제 동작은 같은 이름의 Resolver가 연결합니다.  

## 2. 사용자 조회 API 구현: Query와 Resolver {#session-02}

Query는 서버의 데이터를 조회하는 GraphQL 작업입니다. 이 절에서는 사용자 목록을 가져오는 `users`와 ID로 사용자 한 명을 찾는 `user`가 Resolver를 거쳐 Service에 연결되는 흐름을 살펴봅니다.  

### 🟦 목록 조회와 선택 필드

![목록 조회 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-1.png)
클라이언트는 `users`가 반환하는 모든 필드 중 필요한 항목만 선택합니다.  
변수에는 Schema의 `UserFilter`와 같은 형태의 값을 전달합니다.  

`filter`를 생략하면 모든 사용자를 조회하고, 값을 전달하면 입력한 조건을 모두 만족하는 사용자만 조회합니다. 응답 필드에 `createdAt`이나 `posts`를 선택하지 않았으므로 해당 값은 결과에 포함되지 않습니다.  

이처럼 GraphQL에서는 같은 `users` 필드라도 Selection Set에 따라 응답 모양이 달라집니다.  

### 🟦 Query Resolver 연결

Resolver 객체의 `Query.users`와 `Query.user`는 Schema에 선언한 필드 이름과 대응합니다.  
Resolver는 GraphQL 인자를 꺼내 Context의 Service로 전달하는 역할만 맡습니다.  

```typescript
// /src/modules/user/user.resolver.ts
Query: {
  // 최상위 Resolver에서는 요청을 Service로 전달하고, 입력 검증과 업무 규칙은 Service에 맡깁니다.
  // 최상위 Query에는 상위 객체가 없으므로 첫 번째 인자를 사용하지 않습니다.
  // filter를 생략하거나 null로 전달하면 빈 조건을 사용해 모든 사용자를 조회합니다.
  users: (_parent: unknown, args: { filter?: UserFilter | null }, context: GraphQLContext) =>
    context.services.users.list(args.filter ?? {}),

  // ID에 해당하는 사용자를 조회하며, 사용자가 없으면 null을 반환합니다.
  user: (_parent: unknown, args: { id: string }, context: GraphQLContext) =>
    context.services.users.find(args.id),
}
```

Resolver에서 Prisma 쿼리나 ID 검증을 직접 처리하지 않기 때문에 GraphQL 필드와 애플리케이션 기능의 연결이 분명하게 보입니다.  

### 🟦 사용자 한 명 조회

단건 조회에서는 `ID!` 타입의 변수를 반드시 전달해야 합니다.  

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    displayName
  }
}
```

```json
{
  "id": "1"
}
```

GraphQL은 `id`가 빠졌는지 먼저 검사한 뒤 Resolver를 실행합니다.  
ID 형식이 Schema에는 맞지만 `"abc"`처럼 데이터베이스의 숫자 키로 바꿀 수 없는 값이라면 Service가 애플리케이션 규칙에 따라 오류로 처리합니다. 
![사용자 조회 오류예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-2.png) 

존재하지 않는 ID를 요청하면 `user`의 반환 타입이 `User`이므로 정상 응답 안에서 `null`을 반환할 수 있습니다.  

```json
{
  "data": {
    "user": null
  }
}
```

## 3. 사용자 생성·수정·삭제 API 구현: Mutation과 Resolver {#session-03}

Mutation은 서버의 데이터를 변경하는 작업입니다.  
GraphQL에서 Query와 Mutation의 Resolver 작성 방식은 비슷하지만, Mutation에는 생성·수정·삭제처럼 상태를 바꾸는 의미가 있습니다.  

### 🟦 사용자 생성

생성할 값을 여러 개의 개별 인자로 나열하지 않고 `CreateUserInput` 하나로 묶어 전달합니다.  
필드가 추가되어도 Mutation의 인자 구조를 안정적으로 유지할 수 있습니다.  

![사용자 생성 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-3.png)

`role`을 생략하면 Schema에 선언한 기본값 `USER`가 Resolver의 `args.input`에 들어옵니다.  
생성된 사용자 중 클라이언트가 선택한 필드가 Mutation 응답으로 반환됩니다.  

```typescript
// /src/modules/user/user.resolver.ts
Mutation: {
  // 사용자 생성·수정·삭제에 필요한 검증과 업무 규칙은 Service에서 처리합니다.
  // 이메일 중복을 확인한 뒤 사용자를 생성하고, 생성된 사용자 정보를 반환합니다.
  createUser: (_parent: unknown, args: { input: CreateUserInput }, context: GraphQLContext) =>
    context.services.users.create(args.input),
}
```

### 🟦 사용자 부분 수정

`UpdateUserInput`의 모든 필드는 선택 사항입니다. 따라서 클라이언트는 변경할 필드만 보낼 수 있습니다.  

```graphql
mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    id
    email
    displayName
    status
    role
  }
}
```

```json
{
  "id": "1",
  "input": {
    "displayName": "GraphQL 관리자",
    "status": "ACTIVE"
  }
}
```

Mutation 실행 결과로 변경된 사용자 객체를 받기 때문에 별도의 조회 없이 반영된 값을 확인할 수 있습니다.  

표시 이름을 지우려면 다음처럼 `null`을 명시합니다.  

```json
{
  "id": "1",
  "input": {
    "displayName": null
  }
}
```

```typescript
// /src/modules/user/user.resolver.ts
// 대상의 존재 여부와 변경할 이메일의 중복을 확인한 뒤 전달된 필드만 수정합니다.
updateUser: (
  _parent: unknown,
  args: { id: string; input: UpdateUserInput },
  context: GraphQLContext,
) => context.services.users.update(args.id, args.input),
```

Resolver는 생략한 필드를 유지할지, 같은 이메일을 다른 사용자가 이미 쓰는지 판단하지 않습니다. 이러한 규칙은 Service가 처리합니다.  

### 🟦 사용자 삭제

삭제 Mutation은 사용자 ID를 받고 성공하면 `true`를 반환합니다.  
반환할 사용자 필드가 없는 Scalar 결과이므로 Selection Set을 작성하지 않습니다.  

```graphql
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id)
}
```

```json
{
  "id": "1",
}
```

```typescript
// /src/modules/user/user.resolver.ts
// 사용자를 삭제하면 true를 반환하며, 작성한 게시글도 연쇄 삭제 설정에 따라 함께 삭제됩니다.
deleteUser: (_parent: unknown, args: { id: string }, context: GraphQLContext) =>
  context.services.users.delete(args.id),
```  

```json
{
  "data": {
    "deleteUser": true
  }
}
```

Prisma Schema의 `onDelete: Cascade` 설정에 따라 사용자를 삭제하면 그 사용자가 작성한 게시글도 함께 삭제됩니다.  
따라서 실제 서비스에서는 삭제 권한과 연관 데이터에 미치는 영향을 확인한 뒤 Mutation을 실행해야 합니다.  

## 4. Service 계층을 활용한 CRUD 처리 및 API 실습 {#session-04}

Resolver는 GraphQL 요청을 Service로 전달하고, Service는 입력값 변환과 비즈니스 규칙을 처리합니다. Repository는 Service가 요청한 데이터베이스 작업을 Prisma Client로 실행합니다.  

```text
GraphQL 요청
  └─ Query 또는 Mutation Resolver
       └─ UserService
            └─ UserRepository
                 └─ Prisma Client
                      └─ SQLite
```

### 🟦 GraphQL ID 변환과 조회 처리

GraphQL의 `ID`는 Resolver에 문자열로 전달될 수 있지만 현재 Prisma Model의 기본 키는 `Int`입니다. Service는 두 계층의 타입 차이를 연결하고 유효한 양의 정수인지 확인합니다.  

```typescript
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

find(idValue: string | number) {
  return this.users.findById(toId(idValue));
}
```

Schema는 `ID!`인지 검사하고, Service는 이 애플리케이션에서 ID로 사용할 수 있는 값인지 검사합니다. 두 검증은 목적이 다릅니다.  

목록 조회에서는 전달된 필터만 Prisma의 `where` 조건에 넣습니다.  

```typescript
findMany(filter: UserFilter = {}) {
  return this.prisma.user.findMany({
    // 값이 있는 조건만 where에 포함합니다.
    where: {
      ...(filter.status != null ? { status: filter.status } : {}),
      ...(filter.role != null ? { role: filter.role } : {}),
    },
    orderBy: { id: 'asc' },
  });
}
```

### 🟦 생성·수정·삭제의 비즈니스 규칙

생성할 때는 데이터베이스의 고유 제약 오류를 그대로 노출하지 않고, 먼저 이메일 중복을 확인해 의미가 분명한 애플리케이션 오류를 만듭니다.  

```typescript
async create(input: CreateUserInput) {
  if (await this.users.findByEmail(input.email)) {
    throw new BusinessError(
      ErrorCode.EMAIL_ALREADY_EXISTS,
      '이미 사용 중인 이메일입니다.',
      409,
    );
  }

  return this.users.create(input);
}
```

수정과 삭제는 대상을 먼저 조회합니다.  
사용자가 없으면 `USER_NOT_FOUND` 오류를 발생시키고, 수정할 이메일이 다른 사용자의 이메일과 겹치는지도 확인합니다.  

```typescript
async update(idValue: string | number, input: UpdateUserInput) {
  const id = toId(idValue);

  await this.get(id); // 수정할 사용자가 있는지 확인합니다.
  if (input.email != null) {
    const owner = await this.users.findByEmail(input.email);
    if (owner && owner.id !== id) {
      throw new BusinessError(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        '이미 사용 중인 이메일입니다.',
        409,
      );
    }
  }

  return this.users.update(id, input);
}
```

Repository의 수정 쿼리는 입력 객체에 포함된 필드만 `data`에 추가합니다.  `displayName`은 `null`도 의미가 있는 값이므로 속성의 존재 여부를 따로 확인합니다.  

```typescript
data: {
  ...(input.email != null ? { email: input.email } : {}),
  ...('displayName' in input
    ? { displayName: input.displayName ?? null }
    : {}),
  ...(input.status != null ? { status: input.status } : {}),
  ...(input.role != null ? { role: input.role } : {}),
}
```

> 📌 Resolver는 GraphQL 필드와 Service를 연결하고, Service는 여러 Resolver에서 동일하게 지켜야 할 규칙을 처리합니다. Repository는 비즈니스 규칙을 판단하지 않고 Prisma 쿼리에 집중합니다.  

### 🟦 GraphiQL에서 CRUD 흐름 확인

프로젝트를 실행한 뒤 `http://127.0.0.1:3000/api/graphql`의 GraphiQL에서 요청과 변수를 각각 입력합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm run dev
```
