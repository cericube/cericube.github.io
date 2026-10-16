---
layout: post
title: "03. GraphQL Query와 Mutation"
description: "GraphQL Query와 Mutation의 역할과 차이를 알아봅니다. Arguments, Variables, Input Object로 사용자 조회·생성·수정·삭제 작업을 작성하고 GraphiQL에서 실행합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 3
ai_assisted: true
toc:
  - id: session-01
    title: "1. Query와 Mutation의 개념 및 차이"
  - id: session-02
    title: "2. Query 작성과 Arguments·Variables 활용"
  - id: session-03
    title: "3. Mutation 작성과 Input Object 활용"
  - id: session-04
    title: "4. GraphiQL을 이용한 Query·Mutation 실행 예시"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

이번 편에서는 Root Operation Type인 `Query`와 `Mutation`을 비교하고, Arguments·Variables와 Input Object를 사용해 사용자 데이터를 조회하고 변경합니다.  

> 1~4편은 동작 원리를 확인하기 위해 메모리 배열을 사용합니다. 서버를 다시 시작하면 Mutation으로 변경한 데이터가 초기 상태로 돌아갑니다.  

## 1. Query와 Mutation의 개념 및 차이 {#session-01}

Query는 데이터를 읽는 작업이고 Mutation은 데이터를 변경하는 작업입니다.  
Schema에서는 각각 `Query`와 `Mutation` Root Operation Type의 필드로 정의합니다.  

```graphql
type Query {
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean!
}
```

| 구분 | Query | Mutation |
| --- | --- | --- |
| 목적 | 데이터 조회 | 데이터 생성·수정·삭제 |
| 클라이언트 키워드 | `query` | `mutation` |
| Schema 시작점 | `type Query` | `type Mutation` |
| 최상위 필드 실행 | 병렬 실행할 수 있음 | 문서에 작성한 순서대로 실행 |

Query와 Mutation 모두 Argument와 Variables를 사용할 수 있고, 작업이 끝난 뒤 반환받을 필드를 클라이언트가 선택합니다.  

## 2. Query 작성과 Arguments·Variables 활용 {#session-02}

사용자 조회에는 `users`와 `user` 필드를 사용합니다.  
`users`는 조건에 맞는 사용자 목록을 반환하고, `user`는 ID가 일치하는 사용자 한 명을 반환합니다.  

```graphql
input UserFilter {
  status: UserStatus
  role: UserRole
}

type Query {
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
}
```

`UserFilter`의 두 필드는 선택 사항입니다.  
조건을 생략하면 전체 사용자를 조회하고, 두 조건을 모두 전달하면 `status`와 `role`을 모두 만족하는 사용자만 조회합니다.  

### 🟦 Arguments로 조회 조건 전달

클라이언트가 GraphQL 필드를 요청할 때, Argument를 사용해 해당 필드에 필요한 입력값을 전달합니다.  
다음 Query는 `user` 필드의 `id` Argument에 문자열 `"1"`을 직접 전달합니다.  

```graphql
query GetUser {
  user(id: "1") {
    id
    email
    displayName
  }
}
```

고정된 값을 직접 작성하는 방식은 간단하지만 조회 조건이 바뀔 때마다 Query 문자열을 수정해야 합니다.  

### 🟦 Variables로 Query와 값 분리

Variables를 사용하면 Query 문서는 그대로 두고, 클라이언트가 요청할 때 입력값만 별도로 바꿔 전달할 수 있습니다.  
Query의 작업 이름 뒤에 변수 이름과 타입을 선언하고, 필드의 Argument에는 `$`가 붙은 변수를 사용합니다.  

```graphql
query GetUsers($status: UserStatus, $role: UserRole) {
  users(filter: { status: $status, role: $role }) {
    id
    email
    displayName
    status
    role
  }
}
```

실제 값은 Query와 분리된 JSON 객체로 전달합니다.  

```json
{
  "status": "ACTIVE",
  "role": "ADMIN"
}
```

`$status`와 `$role`은 Non-Null이 아니므로 필요한 조건만 전달하거나 모두 생략할 수 있습니다.  
GraphQL은 작업을 실행하기 전에 변수의 타입과 실제 값이 맞는지 검사합니다.  
Arguments가 Resolver의 `args`에 전달되는 과정은 4편에서 자세히 살펴봅니다.  

## 3. Mutation 작성과 Input Object 활용 {#session-03}

Mutation에 여러 입력값을 전달할 때는 Input Object Type으로 묶을 수 있습니다.  
사용자를 생성할 때 필요한 값과 수정할 때 필요한 값이 다르므로 입력 타입을 각각 정의합니다.  

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

`CreateUserInput.email`은 필수입니다. `role`을 생략하면 GraphQL이 기본값 `USER`를 전달합니다. `UpdateUserInput`은 변경할 필드만 보낼 수 있도록 모든 필드가 선택 사항입니다.  

```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean!
}
```

- `createUser`는 새 사용자를 만들고 생성된 `User`를 반환합니다.  
- `updateUser`는 사용자를 수정하며 대상이 없으면 `null`을 반환합니다.  
- `deleteUser`는 삭제 성공 여부를 Boolean으로 반환합니다.  

클라이언트가 GraphQL 서버에 Mutation을 요청할 때도 Variables로 입력값을 전달할 수 있습니다.  
Input Object 전체를 하나의 변수로 선언하면 입력 필드가 늘어나더라도 Mutation 문서는 그대로 유지할 수 있습니다.  

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    status
    role
  }
}
```

`$input`은 `CreateUserInput!` 타입이므로 Variables에서 반드시 전달해야 합니다. `createUser`가 반환한 `User` 객체에서도 필요한 필드만 선택합니다.  

> **참고:** `CreateUserInput`은 서버의 GraphQL Schema에 정의된 타입입니다.  
> GraphQL에는 서버에 정의된 타입 정보를 조회하는 기능이 있습니다. 이를 Introspection이라고 합니다.  
> 클라이언트는 Schema 문서나 Introspection을 통해 타입 정보를 확인하고, 해당 타입 이름을 사용해 Mutation을 작성합니다.  
> 클라이언트에 타입을 별도로 정의할 필요는 없으며, 서버는 전달받은 데이터를 Schema 기준으로 검증한 후 Resolver를 실행합니다.  

## 4. GraphiQL을 이용한 Query·Mutation 실행 예시 {#session-04}

서버를 실행한 뒤 브라우저에서 `http://localhost:3000/api/graphql`에 접속하여 GraphiQL을 엽니다.  

### 🟦 사용자 조회

```graphql
query GetUsers($status: UserStatus, $role: UserRole) {
  users(filter: { status: $status, role: $role }) {
    id
    email
    displayName
    status
    role
  }
}
```

Variables에는 조회 조건으로 사용할 `status`와 `role`을 입력합니다.  

```json
{
  "status": "ACTIVE",
  "role": "ADMIN"
}
```

![GetUser 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-13.png)

### 🟦 사용자 생성

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    displayName
    status
    role
  }
}
```

Variables에는 `CreateUserInput` 형태의 `input` 객체를 입력합니다.  

```json
{
  "input": {
    "email": "new@example.com",
    "displayName": "새 사용자"
  }
}
```

![CreateUser 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-13-1.png)

### 🟦 사용자 수정과 삭제

```graphql
mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    id
    email
    displayName
    status
  }
}
```

Variables에는 수정할 사용자의 ID와 변경할 값을 입력합니다.  

```json
{
  "id": "2",
  "input": {
    "displayName": "수정된 사용자",
    "status": "SUSPENDED"
  }
}
```

![UpdateUser 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-13-2.png)

```graphql
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id)
}
```

Variables에는 삭제할 사용자의 ID를 입력합니다.  

```json
{
  "id": "2"
}
```

각 Mutation을 실행한 뒤 `GetUsers` Query를 다시 실행하면 변경된 메모리 데이터를 확인할 수 있습니다. GraphQL 응답은 작업 종류와 관계없이 `data`에 결과를 담고, 실행 중 오류가 발생하면 `errors`를 함께 반환합니다.  

### 🟦 Alias와 Fragment 기본 문법

Alias(별칭)는 같은 필드를 여러 번 요청할 때 각 결과를 쉽게 구분할 수 있도록 붙이는 이름입니다.  
다음 Query는 `user` 필드를 서로 다른 ID로 두 번 요청하고, 각 결과를 `admin`과 `member`라는 이름으로 받습니다.  

```graphql
# 사용자 두 명을 한 번의 요청으로 조회합니다.
query CompareUsers {
  # ID가 "1"인 사용자의 조회 결과를 admin이라는 이름으로 받습니다.
  admin: user(id: "1") {
    id
    email
  }
  # ID가 "2"인 사용자의 조회 결과를 member라는 이름으로 받습니다.
  member: user(id: "2") {
    id
    email
  }
}
```

실행 결과는 다음과 같습니다.  

```json
{
  "data": {
    "admin": {
      "id": "1",
      "email": "admin@example.com"
    },
    "member": {
      "id": "2",
      "email": "member@example.com"
    }
  }
}
```

응답의 `data`에는 원래 필드 이름인 `user` 대신 Alias로 지정한 `admin`과 `member`가 표시됩니다. 따라서 같은 필드를 여러 번 요청해도 어떤 사용자에 대한 결과인지 쉽게 구분할 수 있습니다.  

Fragment(조각)는 여러 곳에서 반복해서 선택하는 필드를 한곳에 모아 재사용하는 문법입니다.  
다음 Query는 `UserFields` Fragment에 `id`, `email`, `displayName`을 정의하고, 두 사용자 조회에 똑같이 적용합니다.  

```graphql
# 두 사용자에게 같은 필드 목록을 적용해 조회합니다.
query CompareUsers {
  admin: user(id: "1") {
    # UserFields에 정의한 필드를 이 위치에 펼쳐서 적용합니다.
    ...UserFields
  }
  member: user(id: "2") {
    ...UserFields
  }
}

# User 타입에서 반복해서 조회할 필드를 한곳에 정의합니다.
fragment UserFields on User {
  id
  email
  displayName
}
```

실행 결과는 다음과 같습니다.  

```json
{
  "data": {
    "admin": {
      "id": "1",
      "email": "admin@example.com",
      "displayName": "관리자"
    },
    "member": {
      "id": "2",
      "email": "member@example.com",
      "displayName": "일반 사용자"
    }
  }
}
```

`...UserFields`가 있는 자리에는 Fragment에 정의한 `id`, `email`, `displayName`이 각각 적용됩니다. 공통 필드를 한곳에서 관리하므로 같은 필드 목록을 여러 번 작성하지 않아도 됩니다.  

Alias와 Fragment는 서버의 Schema를 바꾸지 않습니다. 클라이언트에서 응답 이름을 구분하고 반복되는 필드를 편리하게 관리하도록 돕는 문법입니다.  

이번 편에서는 Query와 Mutation을 정의하고 실행했습니다. 4편에서는 요청한 필드가 Resolver와 어떻게 연결되고 어떤 순서로 실행되는지 살펴봅니다.  
