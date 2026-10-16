---
layout: post
title: "04. GraphQL Resolver의 구조와 실행 원리"
description: "GraphQL Schema의 필드가 Resolver와 연결되는 원리를 알아봅니다. Root Resolver와 Field Resolver, 네 가지 인자, Default Resolver와 중첩 쿼리의 실행 흐름을 살펴봅니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 4
ai_assisted: true
toc:
  - id: session-01
    title: "1. Resolver 개념과 Schema 필드 매핑"
  - id: session-02
    title: "2. Root Resolver와 Field Resolver의 차이"
  - id: session-03
    title: "3. Resolver 인자: parent, args, context, info"
  - id: session-04
    title: "4. Default Resolver와 사용자·게시글 중첩 쿼리 실습"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

3편에서는 Query와 Mutation을 정의하고 실행했습니다. 이번 편에서는 클라이언트가 요청한 필드의 값을 Resolver가 어떻게 찾아 반환하는지 살펴봅니다.  

## 1. Resolver 개념과 Schema 필드 매핑 {#session-01}

Resolver는 GraphQL의 각 필드에 필요한 작업을 실행하고 결과를 반환하는 함수입니다.  
Resolver 객체의 타입 이름과 필드 이름은 SDL에 선언한 타입과 필드에 각각 연결됩니다.  

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

input UserFilter {
  status: UserStatus
  role: UserRole
}

type User {
  id: ID!
  email: String!
  displayName: String
  status: UserStatus!
  role: UserRole!
  createdAt: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String
  published: Boolean!
  authorId: ID!
  author: User
}

type Query {
  user(id: ID!): User
  users(filter: UserFilter): [User!]!
}
```

```typescript
const resolvers = {
  // SDL의 Query 타입에 선언한 필드와 같은 이름으로 Resolver를 작성합니다.
  Query: {
    // args.id로 전달받은 ID에 해당하는 사용자 한 명을 찾습니다.
    user: (_parent: unknown, args: { id: string }) => findUser(args.id),
    // args.filter로 전달받은 조건에 맞는 사용자를 반환합니다.
    users: (_parent: unknown, args: { filter?: UserFilter | null }) =>
      findUsers(args.filter ?? {}),
  },
};
```

예를 들어 `Query.user` Resolver는 SDL의 `Query` 타입에 선언된 `user` 필드를 처리합니다.  
다음 쿼리는 ID가 `1`인 사용자의 `displayName`만 요청합니다.  

```graphql
query GetUser {
  user(id: "1") {
    displayName
  }
}
```

`Query.user` Resolver가 여러 필드가 들어 있는 사용자 객체를 반환하더라도, GraphQL은 클라이언트가 선택한 `displayName`만 응답에 담습니다.  

```json
{
  "data": {
    "user": {
      "displayName": "김개발"
    }
  }
}
```

## 2. Root Resolver와 Field Resolver의 차이 {#session-02}

Root Resolver와 Field Resolver의 차이는 실행되는 위치에 있습니다. 다음 쿼리는 사용자 한 명의 생성 시각과 게시글, 각 게시글의 작성자를 차례로 요청합니다.  

```graphql
query GetUserWithPosts {
  user(id: "1") {
    displayName
    createdAt
    posts {
      title
      author {
        displayName
      }
    }
  }
}
```

GraphQL은 상위 필드의 Resolver가 반환한 값을 바탕으로 하위 필드를 처리합니다. 같은 단계에 있는 필드들의 실행 순서는 정해져 있지 않습니다.  

```text
Query.user                         ← Root Resolver
└─ 사용자 객체 반환
   ├─ User.displayName            ← Default Resolver
   ├─ User.createdAt              ← Field Resolver
   └─ User.posts                  ← Field Resolver
      └─ 게시글 목록 반환
         ├─ Post.title            ← Default Resolver
         └─ Post.author           ← Field Resolver
            └─ 작성자 객체 반환
               └─ User.displayName ← Default Resolver
```

`Query.user`처럼 요청이 시작되는 필드를 처리하면 Root Resolver이고, `User.createdAt`, `User.posts`, `Post.author`처럼 반환된 객체 안의 필드를 처리하면 Field Resolver입니다. `displayName`과 `title`은 객체에 같은 이름의 속성이 있으므로 Default Resolver가 처리합니다. Default Resolver의 자세한 동작은 4절에서 살펴봅니다.  

### 🟦 Root Resolver

Root Resolver는 `Query`, `Mutation`, `Subscription`과 같은 루트 작업 타입(Root Operation Type)의 필드를 처리합니다. 즉, GraphQL 요청을 처음 처리하는 시작점입니다.  
위 스키마에서는 `Query.user`와 `Query.users`가 Root Resolver에 해당합니다.  

```typescript
Query: {
  // 사용자 조회 요청의 시작점입니다.
  user: (_parent: unknown, args: { id: string }) => findUser(args.id),
  // 전달받은 조건에 맞는 사용자를 조회하는 시작점입니다.
  users: (_parent: unknown, args: { filter?: UserFilter | null }) =>
    findUsers(args.filter ?? {}),
},
```

위 쿼리를 실행하면 GraphQL은 먼저 `Query.user` Resolver에 `id: "1"`을 전달합니다. `findUser("1")`은 해당 사용자를 찾아 다음 객체를 반환합니다.  

```typescript
{
  id: '1',
  email: 'dev1@example.com',
  displayName: '김개발',
  status: 'ACTIVE',
  role: 'ADMIN',
  createdAt: new Date('2026-10-13T09:00:00.000Z'),
}
```

이 객체에는 사용자의 기본 정보가 있지만 `posts`는 없습니다.  

### 🟦 Field Resolver

Field Resolver는 객체 안의 특정 필드 값을 어떻게 구해 반환할지 정의하는 함수입니다.  
`Query.user`가 반환한 사용자 객체에서 `id`, `email`, `displayName`처럼 이름이 같은 속성은 Default Resolver가 그대로 반환합니다.  
반면 `createdAt`은 JavaScript의 `Date` 객체를 SDL에 선언한 `String` 형식으로 변환해야 합니다. `posts`는 사용자 객체에 값이 없으므로 해당 사용자가 작성한 게시글을 별도로 찾아야 합니다. 이러한 작업은 각각 `User.createdAt`과 `User.posts` Field Resolver가 처리합니다.  
같은 이유로 게시글 객체에 없는 `author` 값은 `Post.author` Field Resolver에서 찾아 반환합니다.  

```typescript
User: {
  // Date 객체를 SDL의 String 필드에 맞는 ISO 8601 문자열로 바꿉니다.
  createdAt: (parent: User) => parent.createdAt.toISOString(),
  // 현재 사용자(parent)가 작성한 게시글만 골라 반환합니다.
  posts: (parent: User) =>
    posts.filter((post) => post.authorId === parent.id),
},
Post: {
  // 현재 게시글(parent)의 authorId와 일치하는 사용자를 찾습니다.
  author: (parent: Post) =>
    users.find((user) => user.id === parent.authorId) ?? null,
},
```

`User.createdAt`은 데이터의 의미는 그대로 유지하면서 GraphQL Schema가 요구하는 출력 형식으로 값을 변환합니다. 이처럼 Field Resolver는 관계 데이터를 조회할 때뿐 아니라 필드 값을 가공할 때도 사용할 수 있습니다.  

`User.posts`가 없다면 GraphQL은 Default Resolver를 사용하여 사용자 객체에서 `posts` 속성을 찾습니다.  
해당 속성이 없으면 Default Resolver는 `undefined`를 반환하고, GraphQL은 이를 값이 없는 상태로 처리합니다. 스키마의 `posts: [Post!]!`는 `null`을 허용하지 않기 때문에 최종 응답에는 오류가 발생합니다.  

`Query.user`에서 게시글까지 미리 조회하여 `posts` 속성을 넣을 수도 있습니다.  
하지만 이렇게 작성하면 클라이언트가 `posts`를 요청하지 않아도 게시글을 불필요하게 조회할 수 있습니다.  
또한 `Query.users`나 `Post.author`처럼 사용자를 반환하는 다른 Resolver에서도 `posts`를 매번 넣어야 합니다.  

게시글 조회 로직을 `User.posts`로 분리하면 사용자 객체가 어느 Resolver에서 반환되든 같은 방법으로 게시글을 찾을 수 있습니다. `User.posts`는 클라이언트가 `posts`를 요청할 때만 실행되고, `Post.author`도 `author`를 요청할 때만 실행됩니다.  

## 3. Resolver 인자: parent, args, context, info {#session-03}

Resolver는 다음 네 가지 인자를 정해진 순서로 받습니다. 뒤쪽 인자가 필요 없다면 생략할 수 있습니다.  

```typescript
(parent, args, context, info) => result
```

| 인자 | 의미 | 현재 코드의 예 |
| --- | --- | --- |
| `parent` | 상위 Resolver가 반환한 값 | `User.posts`가 받은 사용자 객체 |
| `args` | 현재 필드에 전달된 Argument | `user(id: $id)`의 `id` |
| `context` | 한 요청에서 모든 Resolver가 공유하는 값 | 로그인한 사용자 정보, 데이터베이스 연결 |
| `info` | 현재 필드와 실행 중인 작업의 정보 | 필드 이름, 반환 타입, 실행 경로 |

### 🟦 parent와 args

Root Resolver에서는 상위 객체를 일반적으로 사용하지 않으므로 첫 번째 인자를 보통 `_parent`로 표시합니다.  
앞에 `_`를 붙이면 이 값을 사용하지 않는다는 뜻을 쉽게 알아볼 수 있습니다.  
반면 Field Resolver는 `parent`에서 상위 객체의 값을 읽고, 그 값으로 연결된 데이터를 찾습니다.  
이때 `parent`에는 상위 Resolver 함수 자체가 아니라 그 함수가 반환한 데이터가 전달됩니다.  
예를 들어 `User.posts`의 `parent`는 `Query.user`가 반환한 사용자 객체입니다.  

```typescript
// Query.user는 args.id로 조회할 사용자를 찾습니다.
user: (_parent: unknown, args: { id: string }) => findUser(args.id),
// User.posts는 Query.user가 반환한 사용자(parent)의 id로 게시글을 찾습니다.
posts: (parent: User) => posts.filter((post) => post.authorId === parent.id),
```

### 🟦 context

Context는 하나의 GraphQL 요청에서 실행되는 모든 Resolver가 함께 사용하는 객체입니다.  
로그인한 사용자 정보나 데이터베이스 연결처럼 여러 Resolver에서 필요한 값을 담을 수 있습니다.  

```typescript
interface GraphQLContext {
  // 현재 요청을 보낸 사용자의 ID입니다.
  userId?: string;
  // 여러 Resolver가 함께 사용할 데이터베이스 연결입니다.
  db: Database;
}
```

Resolver는 세 번째 인자로 Context를 받아 필요한 값을 사용할 수 있습니다.  

### 🟦 info

`info`에는 현재 실행 중인 필드 이름, 반환 타입, 실행 경로, GraphQL 문서 정보가 들어 있습니다.  
주로 로그를 남기거나 실행 과정을 분석할 때 사용합니다.  
일반적인 비즈니스 로직에서는 자주 직접 사용하지 않으므로 여기서는 어떤 정보를 담는지만 알아둡니다.  

## 4. Default Resolver와 사용자·게시글 중첩 쿼리 실습 {#session-04}

### 🟦 Default Resolver

모든 필드에 Resolver를 직접 작성할 필요는 없습니다.  
별도의 Field Resolver가 없으면 GraphQL.js의 Default Resolver가 동작합니다.  
Default Resolver는 `parent` 객체에서 요청한 필드와 이름이 같은 속성을 찾아 그 값을 반환합니다.  

```typescript
{
  // id와 displayName은 GraphQL의 User 타입 필드와 이름이 같습니다.
  id: '1',
  displayName: '김개발',
}
```

따라서 `User.id`와 `User.displayName` Resolver를 직접 작성하지 않아도 같은 이름의 속성값이 반환됩니다.  
하지만 사용자 객체에 `posts` 속성이 없다면, 게시글을 따로 찾아 반환하는 `User.posts` Resolver가 필요합니다.  

### 🟦 중첩 쿼리 실행

다음 쿼리는 사용자 한 명과 그 사용자가 작성한 게시글, 각 게시글의 작성자를 함께 요청합니다.  

```graphql
# 사용자와 그 사용자가 작성한 게시글, 각 게시글의 작성자 정보를 함께 조회합니다.
query UserWithPosts($id: ID!) {
  user(id: $id) {
    id
    displayName
    # User.posts Field Resolver가 현재 사용자의 게시글을 반환합니다.
    posts {
      id
      title
      # Post.author Field Resolver가 각 게시글의 작성자를 반환합니다.
      author {
        id
        displayName
      }
    }
  }
}
```

Variables에는 조회할 사용자 ID를 입력합니다.  

```json
{
  "id": "1"
}
```

Variables의 `id` 값은 `Query.user` Resolver의 `args.id`로 전달됩니다. 이후 Resolver들은 2절에서 살펴본 흐름에 따라 사용자의 게시글과 각 게시글의 작성자를 찾습니다.  

예를 들어 ID가 `1`인 사용자와 그 사용자가 작성한 게시글이 있다면 다음과 같은 응답을 받을 수 있습니다.  

```json
{
  "data": {
    "user": {
      "id": "1",
      "displayName": "김개발",
      "posts": [
        {
          "id": "101",
          "title": "GraphQL 시작하기",
          "author": {
            "id": "1",
            "displayName": "김개발"
          }
        }
      ]
    }
  }
}
```

GraphQL은 게시글 목록의 각 원소에서 클라이언트가 선택한 `id`, `title`, `author`를 처리합니다. 이처럼 중첩된 필드를 따라 Resolver가 연결되면서 하나의 응답 객체가 완성됩니다.  

여기서는 Resolver의 실행 흐름만 확인합니다. 실제 데이터베이스를 사용할 때 Field Resolver가 목록의 원소마다 조회를 반복하면 N+1 문제가 발생할 수 있습니다. 이 문제를 줄이는 방법은 9편에서 DataLoader와 함께 다룹니다.  

이번 편에서는 Resolver가 Schema의 필드와 연결되는 방식과 중첩된 쿼리를 따라 실행되는 순서를 살펴봤습니다. 다음 편에서는 메모리 저장소를 Prisma와 SQLite로 바꾸어 데이터를 영구적으로 저장합니다.  
