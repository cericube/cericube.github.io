---
layout: post
title: "07. Prisma 관계 조회와 GraphQL Field Resolver"
description: "User와 Post의 관계를 GraphQL 중첩 필드로 연결합니다. parent와 Field Resolver의 동작을 이해하고 Prisma select·include를 이용한 관계 조회 방식을 비교합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 7
ai_assisted: true
toc:
  - id: session-01
    title: "1. User–Post 관계 모델과 GraphQL 타입"
  - id: session-02
    title: "2. parent와 Field Resolver를 이용한 관계 조회"
  - id: session-03
    title: "3. Prisma select·include를 활용한 관계 미리 조회"
  - id: session-04
    title: "4. 사용자·게시글 중첩 조회와 실행 흐름"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

GraphQL에서는 객체의 필드 안에 다른 객체나 목록을 선택할 수 있습니다.  
`User.posts`로 사용자의 게시글을 조회하고, `Post.author`로 게시글의 작성자를 조회하는 방식입니다.  
이때 GraphQL은 상위 필드의 결과를 하위 Field Resolver에 `parent`로 전달합니다.  

## 1. User–Post 관계 모델과 GraphQL 타입 {#session-01}

한 명의 사용자는 여러 게시글을 작성할 수 있고, 하나의 게시글에는 한 명의 작성자가 있습니다. 데이터베이스에서는 이를 User와 Post의 일대다 관계로 표현합니다.  

아래 그림은 같은 User–Post 관계가 Prisma Model, 실제 데이터베이스 테이블, GraphQL 타입과 중첩 Query에서 각각 어떻게 표현되는지 보여 줍니다.  

![Prisma와 GraphQL의 User–Post 관계 및 중첩 조회 구조](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-4.png)  

### 🟦 Prisma에서 정의한 User–Post 관계

Prisma Schema에서 `Post.authorId`는 작성자의 ID를 저장하는 외래 키입니다. `User.posts`와 `Post.author`는 Prisma Client가 관계 데이터를 탐색할 때 사용하는 관계 필드입니다.  

```prisma
// /prisma/schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]

  @@map("users")
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int    @map("author_id")
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("posts")
}
```

실제 `users` 테이블에 `posts` 열이 만들어지는 것은 아닙니다.  
`posts` 테이블의 `author_id`가 두 테이블을 연결합니다.  

| Prisma 필드 | 역할 | 데이터베이스 열 |
| --- | --- | --- |
| `Post.authorId` | 작성자의 기본 키를 저장하는 외래 키 | 있음 |
| `Post.author` | 게시글에서 작성자를 찾는 관계 필드 | 없음 |
| `User.posts` | 사용자에서 게시글 목록을 찾는 관계 필드 | 없음 |

`onDelete: Cascade`는 사용자를 삭제할 때 그 사용자가 작성한 게시글도 함께 삭제합니다. `@@index([authorId])`는 작성자 ID를 기준으로 게시글을 조회할 때 사용할 인덱스를 만듭니다.  

### 🟦 GraphQL Schema에 관계 필드 선언

Prisma에 관계를 정의했다고 해서 클라이언트가 GraphQL에서 바로 사용할 수 있는 것은 아닙니다. 중첩 조회에 사용할 관계 필드를 GraphQL Schema에도 선언해야 합니다.  

`src/modules/user/user.schema.ts`의 `User.posts`는 해당 사용자가 작성한 게시글 목록을 나타냅니다.  

```graphql
type User {
  id: ID!
  email: String!
  displayName: String
  posts: [Post!]!
}
```

`src/modules/post/post.schema.ts`에는 작성자 ID를 반환하는 `authorId`와 작성자 객체를 반환하는 `author`가 정의되어 있습니다.  

```graphql
type Post {
  id: ID!
  title: String!
  authorId: ID!
  author: User!
}
```

`posts: [Post!]!`는 항상 게시글 배열을 반환한다는 뜻입니다.  
게시글이 없다면 `null`이 아니라 빈 배열 `[]`을 반환합니다.  
`author: User!`는 모든 게시글에 작성자가 있어야 한다는 API 계약입니다.  

Prisma Model은 데이터베이스의 관계를 정의하고, GraphQL Object Type은 클라이언트가 선택할 수 있는 관계를 정의합니다.  
이름이 같아도 두 계층이 자동으로 연결되지는 않으며 Field Resolver가 그 사이를 연결합니다.  

## 2. parent와 Field Resolver를 이용한 관계 조회 {#session-02}

Field Resolver는 객체 타입에 속한 특정 필드의 값을 구하는 함수입니다.  
GraphQL은 상위 Resolver가 반환한 객체를 첫 번째 인자인 `parent`에 넣어 하위 Field Resolver를 호출합니다.  

### 🟦 parent가 전달되는 흐름

다음 요청은 Schema에 선언된 `Query.user`와 `User.posts`를 중첩해서 선택합니다.  
![parent 전달 흐름](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-5.png)

GraphQL은 바깥쪽 필드부터 처리하고, 반환된 객체를 다음 단계로 전달합니다.  

`Query.user`가 반환한 사용자 객체가 `User.posts`의 `parent`입니다.  
`id`와 `email`은 객체에 같은 이름의 속성이 있어 Default Resolver가 처리합니다.  
기본 사용자 조회 결과에는 `posts`가 없으므로 `User.posts` Field Resolver가 관계 데이터를 조회합니다.  

### 🟦 User.posts Field Resolver

`User.posts` Field Resolver가 실행되기 전에 상위 Query가 `posts` 관계 데이터를 이미 조회했을 수도 있습니다.  
대표적으로 Prisma의 `include`나 `select`를 사용하면 사용자 객체에 `posts` 배열이 함께 들어옵니다.  
실제 `user.resolver.ts`는 두 경우를 모두 처리할 수 있도록 `parent`에 `posts`가 있는지 먼저 확인합니다.  
Prisma로 관계 데이터를 미리 조회하는 방법은 3절에서 자세히 살펴봅니다.  

```typescript
// /src/modules/user/user.resolver.ts
// select나 include로 조회하면 posts가 함께 들어올 수 있으므로 기본 User 타입을 확장합니다.
type UserParent = User & { posts?: Post[] };

User: {
  // parent는 상위 필드가 반환한 사용자이며, 조회 방식에 따라 게시글이 이미 들어 있을 수 있습니다.
  posts: (parent: UserParent, _args: unknown, context: GraphQLContext) => {
    // 미리 가져온 관계가 있으면 재사용하고, 없을 때만 지연 조회합니다.
    if (Object.hasOwn(parent, 'posts')) return parent.posts ?? [];
    return context.services.users.posts(parent.id);
  },
}
```

`parent`에 `posts` 속성이 있으면 Field Resolver는 이미 조회한 배열을 그대로 반환합니다. 덕분에 같은 관계를 다시 조회하는 불필요한 Prisma 쿼리를 피할 수 있습니다.  
`posts` 속성이 없을 때만 Context의 `UserService`를 호출해 관계 데이터를 지연 조회합니다. `posts` 필드 자체에는 인자가 없으므로 두 번째 인자는 `_args`로 표시합니다.  

Service는 GraphQL에서 전달된 ID를 숫자로 변환한 뒤 Repository로 넘깁니다.  

```typescript
// src/modules/user/user.service.ts
posts(idValue: string | number) {
  return this.users.findPosts(toId(idValue));
}
```

Repository는 Prisma의 `posts()` 관계 접근자로 현재 사용자의 게시글을 조회합니다.  

```typescript
// src/modules/user/user.repository.ts
findPosts(id: number) {
  return this.prisma.user.findUnique({ where: { id } }).posts({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}
```

클라이언트가 `posts`를 선택하지 않으면 이 Field Resolver도 실행되지 않습니다.  

### 🟦 Post.author Field Resolver

게시글에서 작성자를 조회할 때는 `Post.author` Field Resolver가 실행됩니다.  
이때 `parent`는 현재 게시글 객체입니다.  

```typescript
// src/modules/post/post.resolver.ts
Post: {
  // parent는 현재 필드의 게시글이며, author를 요청했을 때만 작성자를 따로 조회합니다.
  // Prisma의 select나 include로 author를 미리 가져오지 않으므로 항상 지연 조회합니다.
  author: (parent: Post, _args: unknown, context: GraphQLContext) =>
    context.services.posts.author(parent.id),
}
```

`PostService`는 게시글 ID를 검증하고 Repository를 호출합니다.  

```typescript
// src/modules/post/post.service.ts
author(idValue: string | number) {
  return this.posts.findAuthor(toId(idValue));
}
```

Repository는 게시글을 기준으로 Prisma의 `author()` 관계 접근자를 호출합니다.  

```typescript
// src/modules/post/post.repository.ts
findAuthor(id: number) {
  return this.prisma.post.findUnique({ where: { id } }).author();
}
```

`User.posts`와 `Post.author`를 각 타입의 Field Resolver로 분리하면 사용자나 게시글이 어떤 Query에서 반환되더라도 동일한 관계 조회 방식을 사용할 수 있습니다.  

## 3. Prisma select·include를 활용한 관계 미리 조회 {#session-03}

기본 `Query.user`는 사용자 정보만 조회하고 `posts`가 선택될 때 Field Resolver로 관계를 조회합니다.  
실습 프로젝트에는 Prisma의 `select`와 `include`로 게시글까지 미리 가져오는 Query도 있습니다.  

### 🟦 관계 조회용 Query와 Resolver

`user.schema.ts`는 두 조회 방식의 결과를 비교할 필드를 실제 Query 타입에 선언합니다.  

```graphql
extend type Query {
  userWithPostsBySelect(id: ID!): User
  userWithPostsByInclude(id: ID!): User
}
```

`user.resolver.ts`는 각 GraphQL 필드를 같은 이름의 Service 메서드로 연결합니다.  

```typescript
Query: {
  // Prisma의 select로 필요한 사용자 필드와 게시글을 지정해 함께 조회하는 예제입니다.
  userWithPostsBySelect: (_parent, args, context) =>
    context.services.users.findWithPostsBySelect(args.id),
  // Prisma의 include로 사용자 기본 정보와 게시글을 함께 조회하는 예제입니다.
  userWithPostsByInclude: (_parent, args, context) =>
    context.services.users.findWithPostsByInclude(args.id),
}
```

Service는 GraphQL의 문자열 ID를 Prisma에서 사용하는 숫자 ID로 바꿉니다.  
실제 조회 방식의 차이는 Repository에 있습니다.  

### 🟦 select로 필요한 필드 지정

`select`는 Prisma가 반환할 필드를 하나씩 지정합니다.  
실제 Repository는 GraphQL `User` 타입을 처리하는 데 필요한 Scalar 필드와 `posts` 관계를 함께 선택합니다.  

```typescript
// src/modules/user/user.repository.ts
return this.prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    displayName: true,
    status: true,
    role: true,
    createdAt: true,
    updatedAt: true,
    posts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
  },
});
```

반환 객체에는 `select`에 적은 필드만 들어 있습니다.  
조회 범위를 코드에서 명확히 제한할 수 있지만, GraphQL 요청에서 사용할 필드를 빠뜨리지 않도록 주의해야 합니다.  

### 🟦 include로 관계 필드 추가

`include`는 User의 기본 Scalar 필드를 유지하면서 지정한 관계를 결과에 추가합니다.  

```typescript
// src/modules/user/user.repository.ts
return this.prisma.user.findUnique({
  where: { id },
  include: {
    posts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
  },
});
```

| 구분 | `select` | `include` |
| --- | --- | --- |
| Scalar 필드 | 명시한 필드만 반환 | 기본 필드를 유지 |
| 관계 필드 | 선택한 관계를 반환 | 기본 결과에 관계를 추가 |
| 현재 메서드의 결과 | User 필드와 `posts` | User 기본 필드와 `posts` |

두 메서드 모두 `posts`가 포함된 사용자 객체를 반환합니다.  
따라서 앞에서 본 `User.posts` Field Resolver는 `Object.hasOwn(parent, 'posts')` 조건에서 이미 조회한 게시글을 반환하고 같은 관계를 다시 조회하지 않습니다.  

> 📌 GraphQL Selection Set과 Prisma `select`는 서로 다른 기능입니다. Selection Set은 클라이언트가 응답에서 받을 필드를 정하고, Prisma `select`는 서버가 데이터베이스에서 가져올 필드를 정합니다. 현재 프로젝트에서는 Resolver와 Repository가 두 단계를 연결합니다.  

### 🟦 관계 조회 방식 선택

이 글의 프로젝트는 Field Resolver를 중심으로 관계 필드를 처리합니다.  
실무에서는 API의 조회 패턴과 성능 요구사항에 따라 Prisma의 중첩 `select`나 `include`, Field Resolver, DataLoader 중 적합한 방식을 선택하거나 함께 사용합니다.  
이 기능들은 서로 대체하는 기술이 아니라 서로 다른 단계의 문제를 해결합니다.  

- **Field Resolver:** GraphQL에서 관계 필드를 요청했을 때 해당 필드를 어떻게 조회하고 처리할지 결정합니다.  
- **Prisma `select`:** 데이터베이스에서 조회할 필드를 지정합니다. 관계 필드를 중첩 선택하면 해당 관계 데이터도 함께 조회할 수 있습니다.  
- **Prisma `include`:** 상위 데이터를 조회할 때 필요한 관계 데이터를 결과에 포함합니다.  
- **DataLoader:** 여러 Field Resolver에서 발생한 개별 조회를 모아 배치 처리하고 일반적으로 요청 범위에서 결과를 캐시합니다.  

Prisma의 `select`와 `include`는 관계 데이터를 미리 준비할 때 사용할 수 있지만, 같은 쿼리 단계에서 둘을 함께 사용할 수는 없습니다.  
또한 `include`는 관계 데이터가 결과에 포함된다는 뜻이며, 항상 하나의 SQL로 실행된다는 뜻은 아닙니다.  

관계 조회 방식은 API의 사용 형태와 성능 요구사항에 맞춰 선택합니다.  

| 방식 | 장점 | 주의할 점 | 적합한 경우 |
| --- | --- | --- | --- |
| Prisma 중첩 `select` 또는 `include`로 미리 조회 | 필요한 관계 데이터를 상위 조회에서 함께 준비할 수 있습니다. | GraphQL 요청에서 관계 필드를 선택하지 않아도 미리 조회할 수 있습니다. | 반환 구조가 정해진 상세 조회 |
| Field Resolver에서 개별 조회 | 관계 필드가 요청되었을 때만 조회하며 구현이 단순합니다. | 목록의 각 객체에서 개별 조회하면 N+1 문제가 발생할 수 있습니다. | 단건 조회, 학습용 또는 단순한 API |
| Field Resolver와 DataLoader 사용 | 관계 필드의 유연성을 유지하면서 여러 조회를 배치 처리할 수 있습니다. | 요청별 Loader와 캐시를 구성해야 하므로 구현 복잡도가 높아집니다. | 목록 기반 중첩 조회가 많은 API |

사용자 목록을 조회한 뒤 각 사용자의 `posts`를 Field Resolver에서 따로 가져오면, 최초의 목록 조회 외에 사용자 수만큼 게시글 조회가 추가될 수 있습니다. 이를 N+1 문제라고 합니다. DataLoader는 여러 조회 요청을 모아 배치로 처리하여 데이터베이스 조회 횟수를 줄입니다.  

현재 프로젝트의 `User.posts` Field Resolver는 상위 Resolver에서 `posts`까지 미리 조회한 경우 해당 데이터를 그대로 사용합니다.  
미리 조회한 `posts`가 없을 때만 Service를 통해 게시글을 가져옵니다. 따라서 Prisma의 `select` 또는 `include`로 관계 데이터를 미리 가져오는 방식과 Field Resolver에서 필요할 때 가져오는 방식을 모두 지원합니다.  

> 📌 현재 프로젝트는 Prisma Client의 내장 Dataloader를 활용할 수 있지만, 애플리케이션 수준의 별도 DataLoader는 아직 적용하지 않았습니다.  

## 4. 사용자·게시글 중첩 조회와 실행 흐름 {#session-04}

중첩 조회는 별도의 중첩 조회용 서버 필드를 만드는 방식이 아닙니다. Schema에 이미 있는 `user`, `posts`, `author` 필드를 클라이언트가 중첩해서 선택하는 방식입니다.  

### 🟦 user에서 posts와 author까지 조회

다음 요청은 `Query.user`에서 시작해 `User.posts`, `Post.author`까지 선택합니다. 작업 이름을 생략한 익명 Query이며, 서버에 별도의 같은 이름 Resolver가 필요한 것은 아닙니다.  

```graphql
query ($id: ID!) {
  user(id: $id) {
    id
    email
    posts {
      id
      title
      author {
        id
        displayName
      }
    }
  }
}
```

```json
{
  "id": "2"
}
```

이 요청은 실제 `src`의 세 Resolver를 차례로 사용합니다.  

```text
Query.user
  └─ context.services.users.find(args.id)
       └─ 사용자 객체 반환
            └─ User.posts
                 └─ context.services.users.posts(parent.id)
                      └─ 게시글 배열 반환
                           └─ 각 Post.author
                                └─ context.services.posts.author(parent.id)
```

GraphQL은 각 Resolver의 반환값을 요청의 Selection Set과 같은 중첩 구조로 조립합니다. 클라이언트는 Repository나 Prisma 관계 접근자를 알 필요 없이 Schema의 필드를 선택하면 됩니다.  

### 🟦 select와 include 결과를 한 요청에서 비교

`userWithPostsBySelect`와 `userWithPostsByInclude`는 실제 Schema에 선언된 서로 다른 Query 필드입니다. Alias를 사용하면 두 결과를 한 요청에서 구분할 수 있습니다.  

```graphql
query ($id: ID!) {
  selected: userWithPostsBySelect(id: $id) {
    id
    email
    posts {
      id
      title
    }
  }

  included: userWithPostsByInclude(id: $id) {
    id
    email
    posts {
      id
      title
    }
  }
}
```

`selected`와 `included`는 같은 Selection Set을 사용하므로 응답 모양도 같습니다.  
하지만 서버 내부에서 `selected`는 Prisma `select`, `included`는 Prisma `include`를 사용합니다.   GraphQL 응답의 모양과 데이터베이스 조회 방식이 반드시 일대일로 대응하는 것은 아닙니다.  

### 🟦 실행 예시

프로젝트를 실행하고 `http://127.0.0.1:3000/api/graphql`의 GraphiQL에서 위 요청을 입력합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm run dev
```

![실행 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-15-6.png)