---
layout: post
title: "02. GraphQL 기본 문법과 타입 시스템"
description: "GraphQL의 Scalar, Object, Enum, Input Object와 List·Non-Null을 알아봅니다. SDL의 주요 문법으로 User·Post 타입과 Query·Mutation 루트 타입을 정의합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 2
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL 타입 시스템: Scalar, Object, Enum, Input Object"
  - id: session-02
    title: "2. List, Non-Null 및 필드·Arguments 타입 선언"
  - id: session-03
    title: "3. Schema Definition Language(SDL) 작성 문법"
  - id: session-04
    title: "4. Query·Mutation 루트 타입 정의 및 SDL 작성 예시"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. GraphQL 타입 시스템: Scalar, Object, Enum, Input Object {#session-01}

GraphQL Schema는 필드가 받을 입력값과 반환할 값의 타입을 선언합니다. 서버는 이 타입을 기준으로 요청을 검사하고 응답값을 알맞은 형태로 변환합니다.  

### 🟦 Scalar

Scalar는 하위 필드로 나누지 않는 하나의 값을 표현합니다. GraphQL은 다섯 가지 Scalar를 기본으로 제공합니다.  

| 타입 | 의미 | 예시 |
| --- | --- | --- |
| `Int` | 32비트 부호 있는 정수 | `10` |
| `Float` | 부동소수점 수 | `3.14` |
| `String` | 문자열 | `"김개발"` |
| `Boolean` | 참 또는 거짓 | `true` |
| `ID` | 고유 식별자 | `"1"` |

`ID`는 식별자를 나타내며 GraphQL 응답에서는 문자열 형태로 전달됩니다.  
날짜나 큰 정수처럼 기본 Scalar로 표현하기 어려운 값에는 Custom Scalar를 정의할 수 있습니다.  
이 글에서는 기본 타입에 집중하고 Custom Scalar는 이름과 용도만 알아둡니다.  

### 🟦 Object

Object는 관련된 여러 필드를 하나로 묶은 출력 타입입니다. 사용자 정보를 나타내는 `User`는 다음과 같이 정의할 수 있습니다.  

```graphql
type User {
  id: ID!
  email: String!
  displayName: String
  status: UserStatus!
  role: UserRole!
}
```

`User` 객체는 `id`, `email`, `displayName`, `status`, `role` 필드로 구성됩니다.  
클라이언트가 Object 필드를 요청할 때는 중괄호 안에 응답으로 받을 필드를 직접 작성해야 합니다.  

```graphql
query GetUser {
  user(id: "1") {
    id
    email
    displayName
  }
}
```

이 요청은 ID가 `"1"`인 사용자를 조회하고, `User`의 여러 필드 중 `id`, `email`, `displayName`만 응답으로 받겠다는 뜻입니다.  

### 🟦 Enum

Enum은 사용할 수 있는 값을 미리 정해 둔 타입입니다. 정해진 값만 사용할 수 있어 문자열 오타를 줄이고 GraphiQL의 자동 완성을 활용할 수 있습니다.  

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
```

GraphQL 문서에서 Enum 값은 문자열과 달리 따옴표로 감싸지 않습니다.  

### 🟦 Input Object

Input Object는 Query나 Mutation의 Argument로 전달할 여러 값을 하나의 객체로 묶습니다.  
응답에 사용하는 Object Type과 달리 클라이언트가 서버에 보낼 값에만 사용합니다.  

```graphql
input UserFilter {
  status: UserStatus
  role: UserRole
}
```

`UserFilter`를 사용하면 사용자 상태와 권한을 하나의 조회 조건으로 전달할 수 있습니다.  
사용자 생성과 수정에 사용하는 Input Object는 다음과 같습니다.  

```graphql
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

`Interface`와 `Union`은 여러 Object Type을 하나의 반환 타입으로 다루는 문법입니다. 현재 실습 Schema에는 포함하지 않지만, 두 문법의 차이를 간단한 예제로 살펴보겠습니다.  

### 🟦 Interface 사용 예시

Interface는 여러 Object Type이 공통으로 가져야 할 필드를 정의합니다. `User`와 `Post`가 `Node`를 구현하면 두 타입 모두 `id` 필드를 가져야 합니다.  

```graphql
interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  email: String!
}

type Post implements Node {
  id: ID!
  title: String!
}

type Query {
  nodes: [Node!]!
}
```

Interface를 반환하는 필드에서는 공통 필드를 바로 선택하고, 타입별 필드는 Inline Fragment로 선택합니다.  

```graphql
query GetNodes {
  # Node Interface를 구현한 객체 목록을 조회합니다.
  nodes {
    # id는 Node에 정의된 공통 필드이므로 바로 선택할 수 있습니다.
    id
    # 현재 객체가 User일 때만 email을 응답에 포함합니다.
    ... on User {
      email
    }
    # 현재 객체가 Post일 때만 title을 응답에 포함합니다.
    ... on Post {
      title
    }
  }
}
```

### 🟦 Union 사용 예시

Union은 공통 필드를 강제하지 않고 반환 가능한 Object Type만 묶습니다. 다음 `SearchResult`는 검색 결과가 `User` 또는 `Post`일 수 있다는 뜻입니다.  

```graphql
union SearchResult = User | Post

type Query {
  search(keyword: String!): [SearchResult!]!
}
```

Union에는 공통으로 선언된 필드가 없으므로 `__typename`으로 실제 타입을 확인하고, 각 타입의 필드는 Inline Fragment로 선택합니다.  

```graphql
query Search {
  # "GraphQL"을 검색하고 User 또는 Post 객체 목록을 받습니다.
  search(keyword: "GraphQL") {
    # 각 결과의 실제 타입 이름인 User 또는 Post를 반환합니다.
    __typename
    # 현재 결과가 User일 때 사용자 필드를 선택합니다.
    ... on User {
      id
      email
    }
    # 현재 결과가 Post일 때 게시글 필드를 선택합니다.
    ... on Post {
      id
      title
    }
  }
}
```

실제 서버에서 Interface나 Union을 반환하려면 Resolver가 결과 객체의 구체적인 타입이 `User`인지 `Post`인지 판별해야 합니다. 여기서는 Interface와 Union을 요청하는 문법에 집중합니다.  

## 2. List, Non-Null 및 필드·Arguments 타입 선언 {#session-02}

GraphQL 필드는 반환 타입을 가지며, 필요한 경우 Arguments도 받습니다.  
List와 Non-Null을 조합하면 값의 개수와 `null` 허용 여부를 구체적으로 표현할 수 있습니다.  

### 🟦 List와 Non-Null

대괄호는 목록을 나타내고 느낌표는 `null`을 허용하지 않는다는 뜻입니다.  
느낌표가 붙은 위치에 따라 목록과 원소의 `null` 허용 여부가 달라집니다.  

| 타입 | 목록 자체가 `null` | 목록 원소가 `null` | 빈 배열 |
| --- | --- | --- | --- |
| `[User]` | 허용 | 허용 | 허용 |
| `[User!]` | 허용 | 허용하지 않음 | 허용 |
| `[User]!` | 허용하지 않음 | 허용 | 허용 |
| `[User!]!` | 허용하지 않음 | 허용하지 않음 | 허용 |

프로젝트의 `users` 필드는 `[User!]!`을 반환합니다.  
조회 결과가 없을 때 빈 배열 `[]`은 허용되지만, 목록 자체나 목록의 원소로 `null`을 반환하면 실행 오류가 발생합니다.  

### 🟦 필드의 반환 타입

필드 이름 뒤의 콜론 다음에는 반환 타입을 작성합니다.  

```graphql
type User {
  id: ID!
  displayName: String
  posts: [Post!]!
}
```

- `id: ID!`은 반드시 식별자를 반환합니다.  
- `displayName: String`은 문자열이나 `null`을 반환할 수 있습니다.  
- `posts: [Post!]!`은 `null`이 아닌 게시글 목록을 반환하며 각 원소도 `null`일 수 없습니다.  

### 🟦 Arguments의 타입

Arguments는 필드 이름 뒤의 괄호 안에 `이름: 타입` 형태로 선언합니다.  

```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter): [User!]!
  posts(published: Boolean): [Post!]!
}
```

- `user`의 `id`는 `ID!`이므로 반드시 전달해야 합니다.  
- `users`의 `filter`와 `posts`의 `published`는 선택 사항이므로 생략할 수 있습니다.  
- `user`는 일치하는 사용자가 없으면 `null`을 반환할 수 있습니다.  

## 3. Schema Definition Language(SDL) 작성 문법 {#session-03}

SDL(Schema Definition Language)은 GraphQL API의 타입, 필드, Arguments와 반환 타입을 정의하는 문법입니다. Resolver는 SDL에 선언된 필드를 요청받으면 필요한 작업을 수행하고 결과값을 반환합니다.  

### 🟦 주요 SDL 선언

| 선언 | 역할 |
| --- | --- |
| `type` | Object Type 정의 |
| `input` | Input Object Type 정의 |
| `enum` | Enum Type 정의 |
| `schema` | Root Operation Type을 명시적으로 연결 |
| `extend type` | 기존 Object Type에 필드 추가 |

`scalar`, `interface`, `union`, `directive`도 SDL에 존재하지만 현재 실습에서 사용하지 않으므로 자세한 작성법은 다루지 않습니다. Custom Directive는 기본 Directive로 해결하기 어려운 공통 동작이 필요할 때 별도로 정의합니다.  

### 🟦 schema 선언과 기본 루트 타입 이름

Root Operation Type의 이름으로 `Query`, `Mutation`, `Subscription`을 사용하면 `schema` 선언을 생략할 수 있습니다. 이후 예시도 이 규칙을 사용합니다.  

```graphql
type Query {
  hello: String!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}
```

다른 타입 이름을 루트로 사용하려면 `schema`에 연결 관계를 명시합니다.  

```graphql
schema {
  query: RootQuery
  mutation: RootMutation
}

type RootQuery {
  hello: String!
}

type RootMutation {
  createUser(input: CreateUserInput!): User!
}
```

### 🟦 기본값

Argument나 Input Object의 필드에는 등호로 기본값을 지정할 수 있습니다.  
값을 생략하면 GraphQL이 기본값을 Resolver에 전달합니다.  

```graphql
type Query {
  hello(name: String = "GraphQL"): String!
}

input CreateUserInput {
  email: String!
  role: UserRole = USER
}
```

### 🟦 Description

큰따옴표 문자열이나 삼중 큰따옴표 문자열을 타입과 필드 앞에 작성하면 Description이 됩니다.  
GraphiQL 같은 도구는 이 설명을 Schema 문서에 표시합니다.  

```graphql
"사용자 정보를 나타냅니다."
type User {
  "사용자의 고유 식별자입니다."
  id: ID!

  "로그인에 사용하는 이메일입니다."
  email: String!
}
```

### 🟦 @deprecated

더 이상 사용하지 않기를 권하는 필드나 Enum 값에는 기본 Directive인 `@deprecated`를 붙입니다.  
기존 클라이언트와의 호환성을 유지하면서 새 필드로 이동하도록 안내할 때 사용합니다.  

```graphql
type User {
  displayName: String
  name: String @deprecated(reason: "displayName을 사용하세요.")
}
```

`@deprecated`는 필드를 즉시 삭제하지 않습니다. GraphiQL과 코드 생성 도구가 사용 중단 대상과 `reason`을 표시할 수 있게 합니다.  

### 🟦 extend type

`extend type`은 이미 정의된 Object Type에 필드를 추가합니다.  
기능별로 SDL을 나누어 작성할 때 사용할 수 있습니다.  

```graphql
type Query {
  hello(name: String = "GraphQL"): String!
}

extend type Query {
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
}
```

`type Query`는 `Query` 타입을 처음 정의하고, `extend type Query`는 기존 타입에 사용자 조회 필드를 추가합니다.  

## 4. Query·Mutation 루트 타입 정의 및 SDL 작성 예시 {#session-04}

### 🟦 일반 Object Type과 Root Operation Type

`User`, `Post`, `Query`, `Mutation`은 모두 Object Type이지만 역할이 다릅니다.  

- `User`와 `Post`는 API가 반환할 데이터의 구조를 나타냅니다.  
- `Query`는 데이터 조회가 시작되는 Root Operation Type입니다.  
- `Mutation`은 데이터 변경이 시작되는 Root Operation Type입니다.  

Root Operation Type의 각 필드가 클라이언트가 실행할 수 있는 작업의 시작점이 됩니다.  

### 🟦 User와 Post 타입 작성

이후 예시에서 사용할 사용자와 게시글 타입을 필요한 부분만 모으면 다음과 같습니다.  

```graphql
type User {
  id: ID!
  email: String!
  displayName: String
  status: UserStatus!
  role: UserRole!
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
```

`User.posts`와 `Post.author`는 두 Object Type의 관계를 나타냅니다. 실제 관계 값을 구하는 방법은 4편의 Field Resolver에서 살펴봅니다.  

### 🟦 Query와 Mutation 타입 작성

사용자와 게시글을 조회하는 필드는 `Query`에, 사용자를 변경하는 필드는 `Mutation`에 선언합니다.  

```graphql
type Query {
  hello(name: String = "GraphQL"): String!
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
  posts(published: Boolean): [Post!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean!
}
```

Schema가 커지면 기능별로 SDL을 나누어 작성할 수 있습니다. 이 경우 한 곳에서 `type Query`를 정의하고, 다른 곳에서는 `extend type Query`로 필드를 추가한 뒤 하나의 Schema로 결합합니다.  
