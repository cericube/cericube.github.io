---
layout: post
title: "09. GraphQL N+1 문제와 쿼리 최적화"
description: "GraphQL 중첩 조회에서 발생하는 N+1 문제를 Prisma 쿼리 로그로 확인합니다. select·include, Prisma의 자동 배칭, 요청별 DataLoader로 관계 조회 쿼리를 최적화하는 방법을 알아봅니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 9
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL N+1 문제의 발생 원리와 분석"
  - id: session-02
    title: "2. Prisma include·select를 활용한 관계 조회 최적화"
  - id: session-03
    title: "3. Prisma 내부 DataLoader를 활용한 자동 배칭"
  - id: session-04
    title: "4. 외부 DataLoader를 활용한 Batch Loading과 Caching"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

GraphQL에서는 클라이언트가 필요한 관계 필드를 자유롭게 중첩해서 조회할 수 있습니다.  
하지만 각 Field Resolver가 데이터베이스를 따로 조회하면 요청 한 번에도 SQL이 여러 번 실행될 수 있습니다.  

```text
개별 findMany()        → 사용자 수만큼 게시글을 반복 조회합니다.
select 또는 include    → 사용자와 관계 데이터를 함께 조회합니다.
Prisma 내부 DataLoader → findUnique().posts() 호출을 자동으로 묶습니다(예: IN 조건).
외부 DataLoader        → 여러 사용자 ID를 하나의 IN 조건으로 직접 묶습니다.
```

## 1. GraphQL N+1 문제의 발생 원리와 분석 {#session-01}

N+1 문제는 목록을 조회하는 SQL을 한 번 실행한 뒤, 각 항목의 관계 데이터를 조회하는 SQL을 N번 더 실행하는 현상입니다.  
사용자 10명을 조회한 뒤 사용자마다 게시글을 따로 조회하면 총 11번의 SQL이 실행됩니다.  

```text
사용자 목록 조회 1회
  ├─ 사용자 1의 게시글 조회 1회
  ├─ 사용자 2의 게시글 조회 1회
  ├─ 사용자 3의 게시글 조회 1회
  └─ ... 사용자 10까지 반복

총 실행 횟수 = 1 + N
```

### 🟦 N+1 문제와 GraphQL Field Resolver 실행 구조

GraphQL은 요청에서 선택한 필드 모음인 Selection Set을 따라 Field Resolver를 실행합니다.  
먼저 `Query.users`가 사용자 목록을 반환합니다. 그다음 목록의 각 사용자에 대해 `User.postsNPlusOne` Resolver를 실행하여 게시글을 조회합니다.  

```graphql
query UsersWithPostsNPlusOne {
  users {
    id
    email
    postsNPlusOne {
      id
      title
    }
  }
}
```

실행 흐름은 다음과 같습니다.  
![N+1문제 개념도](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-4.png)

### 🟦 User–Post 중첩 Query로 N+1 문제 재현

`postsNPlusOne`은 의도적으로 사용자마다 `findMany()`를 호출해 N+1 문제를 재현합니다.  

```graphql
# /src/modules/user/user.schema.ts
type User {
  id: ID!
  email: String!

  # 사용자마다 Post.findMany()를 실행하는 비교 기준입니다.
  postsNPlusOne: [Post!]!
}
```

`User.postsNPlusOne` Resolver는 현재 사용자 ID를 Service에 전달합니다.  
GraphQL은 사용자 배열의 각 항목에 이 Resolver를 적용하므로 사용자 수만큼 호출됩니다.  

```typescript
// /src/modules/user/user.resolver.ts
User: {
  // parent는 현재 처리 중인 사용자 객체입니다.
  postsNPlusOne: (parent: UserParent, _args: unknown, context: GraphQLContext) =>
    context.services.users.postsIndividually(parent.id),
}
```

`postsNPlusOne` Resolver가 실행될 때마다 Repository의 `findPostsIndividually()`가 사용자 ID를 하나씩 전달받습니다.  
이때 사용자마다 `findMany()`를 따로 호출합니다. Prisma는 사용자 수만큼 게시글 조회 SQL이 실행됩니다.  

```typescript
// /src/modules/user/user.repository.ts
findPostsIndividually(id: number) {
  return this.prisma.post.findMany({
    // 전달받은 사용자가 작성한 게시글만 선택합니다.
    where: { authorId: id },
    // 최신 게시글부터 보여 주고, 작성 시간이 같으면 id가 큰 글을 먼저 정렬합니다.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}
```

### 🟦 Prisma 쿼리 로그 설정과 SQL 실행 횟수 분석

실행된 SQL을 확인하려면 Prisma Client의 Query Event를 활성화해야 합니다.  

```typescript
// /src/plugins/prisma.plugin.ts
const prisma = new PrismaClient({
  adapter,
  log: [
    // 실행된 SQL을 $on('query')에서 받을 수 있도록 설정합니다.
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (event) => {
  fastify.log.info(
    {
      query: event.query,
      params: event.params,
      durationMs: event.duration,
      target: event.target,
    },
    'Prisma query',
  );
});
```

서버를 실행한 뒤 GraphiQL에서 앞의 `UsersWithPostsNPlusOne` 요청을 보냅니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm run dev
```

사용자가 10명이라면 로그에서 다음과 같은 SQL 실행 흐름을 확인할 수 있습니다.  

```sql
-- 1. 사용자 목록을 한 번 조회합니다.
SELECT ... FROM users ORDER BY id ASC;

-- 2. 사용자마다 게시글을 개별 조회합니다.
SELECT ... FROM posts WHERE author_id = 1 ORDER BY created_at DESC, id DESC;
SELECT ... FROM posts WHERE author_id = 2 ORDER BY created_at DESC, id DESC;
SELECT ... FROM posts WHERE author_id = 3 ORDER BY created_at DESC, id DESC;
-- 같은 형태의 SQL이 사용자 10까지 반복됩니다.
```

N+1 문제는 데이터가 적은 개발 환경에서는 눈에 잘 띄지 않을 수 있습니다.  
하지만 목록이 커질수록 애플리케이션과 데이터베이스 사이의 통신 횟수와 연결 사용량이 함께 늘어납니다.  

따라서 GraphQL 응답 시간뿐만 아니라 요청 하나에서 SQL이 몇 번 실행되는지도 함께 확인해야 합니다.  

## 2. Prisma include·select를 활용한 관계 조회 최적화 {#session-02}

사용자 목록과 게시글이 함께 필요하다면 Prisma의 중첩 `include` 또는 `select`로 관계 데이터를 미리 가져올 수 있습니다.  
이 방식을 사용하면 사용자마다 게시글을 따로 요청할 필요가 없습니다. Prisma가 사용자 목록과 필요한 관계 데이터를 함께 처리합니다.  

![Prisma include-select구조](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-5.png)

### 🟦 Prisma include와 select를 이용한 관계 데이터 조회

`include`는 User의 기본 필드를 유지하면서 `posts` 관계를 결과에 추가합니다.  

```typescript
// /src/modules/user/user.repository.ts
findManyWithPostsByInclude(filter: UserFilter = {}) {
  return this.prisma.user.findMany({
    // 전달받은 상태와 역할 조건을 만족하는 사용자만 조회합니다.
    where: {
      ...(filter.status != null ? { status: filter.status } : {}),
      ...(filter.role != null ? { role: filter.role } : {}),
    },
    orderBy: { id: 'asc' }, // 사용자 ID가 작은 순서로 정렬합니다.
    // 사용자와 각 사용자가 작성한 게시글을 함께 조회합니다.
    include: {
      posts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  });
}
```

`select`는 반환할 User 필드와 관계를 직접 지정합니다.  
필요한 열만 선택할 수 있지만, GraphQL 응답에 필요한 필드를 빠뜨리지 않도록 주의해야 합니다.  

```typescript
// /src/modules/user/user.repository.ts
findManyWithPostsBySelect(filter: UserFilter = {}) {
  return this.prisma.user.findMany({
    // 전달받은 상태와 역할 조건을 만족하는 사용자만 조회합니다.
    where: {
      ...(filter.status != null ? { status: filter.status } : {}),
      ...(filter.role != null ? { role: filter.role } : {}),
    },
    orderBy: { id: 'asc' }, // 사용자 ID가 작은 순서로 정렬합니다.
    // GraphQL 응답에 필요한 사용자 필드와 posts 관계만 선택합니다.
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      createdAt: true,
      posts: {
        select: {
          id: true,
          title: true,
          authorId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    },
  });
}
```

| 구분 | `include` | `select` |
| --- | --- | --- |
| User 기본 필드 | 기본 필드를 유지합니다. | `true`로 지정한 필드만 반환합니다. |
| 관계 필드 | 지정한 관계를 추가합니다. | 지정한 관계와 필드만 반환합니다. |
| 적합한 상황 | 기본 모델과 관계를 함께 사용할 때 | 반환 데이터를 명시적으로 제한할 때 |

### 🟦 관계 데이터 사전 조회와 Field Resolver 활용

최상위 Query는 게시글이 포함된 사용자 배열을 반환합니다.  

```typescript
// /src/modules/user/user.resolver.ts
Query: {
  // select로 여러 사용자의 게시글을 미리 가져와 Field Resolver에서 재사용합니다.
  usersWithPostsBySelect: (
    _parent: unknown,
    args: { filter?: UserFilter | null },
    context: GraphQLContext,
  ) => context.services.users.listWithPostsBySelect(args.filter ?? {}),

  // include로 여러 사용자의 게시글을 미리 가져와 Field Resolver에서 재사용합니다.
  usersWithPostsByInclude: (
    _parent: unknown,
    args: { filter?: UserFilter | null },
    context: GraphQLContext,
  ) => context.services.users.listWithPostsByInclude(args.filter ?? {}),
}
```

두 Query가 반환하는 사용자 객체에는 이미 `posts` 속성이 있습니다.  
`User.posts` Field Resolver는 사용자 객체에 `posts` 속성이 있는지 확인합니다.  
이미 조회한 게시글이 있으면 데이터베이스를 다시 조회하지 않고 그 값을 반환합니다.  

```typescript
// /src/modules/user/user.resolver.ts
type UserParent = User & { posts?: Post[] };

User: {
  posts: (parent: UserParent, _args: unknown, context: GraphQLContext) => {
    // include 또는 select로 미리 가져온 posts를 그대로 재사용합니다.
    if (Object.hasOwn(parent, 'posts')) return parent.posts ?? [];

    // 미리 조회한 posts가 없을 때만 Field Resolver에서 조회합니다.
    return context.services.users.posts(parent.id);
  },
}
```

다음 요청으로 `select` 방식을 확인할 수 있습니다.  

```graphql
query UsersWithPostsBySelect {
  usersWithPostsBySelect {
    id
    email
    posts {
      id
      title
    }
  }
}
```

`include` 방식을 확인할 때는 최상위 필드만 바꿉니다.  

```graphql
query UsersWithPostsByInclude {
  usersWithPostsByInclude {
    id
    email
    posts {
      id
      title
    }
  }
}
```

### 🟦 관계 조회 방식에 따른 SQL 실행 구조 비교

Prisma가 관계 데이터를 가져오는 방법을 Relation Load Strategy라고 합니다. 어떤 데이터베이스와 전략을 사용하는지에 따라 실행되는 SQL 수가 달라질 수 있습니다.  
이 예제의 Query 방식은 먼저 사용자 목록을 조회합니다. 그다음 조회한 사용자 ID를 모아 게시글을 한 번에 가져오므로 SQL이 일반적으로 두 번 실행됩니다.  

```sql
-- 사용자 목록
SELECT ... FROM users ORDER BY id ASC;

-- 조회한 모든 사용자 ID의 게시글
SELECT ...
FROM posts
WHERE author_id IN (1, 2, 3, ..., 10)
ORDER BY created_at DESC, id DESC;
```

`include`는 관계 데이터를 결과에 포함한다는 뜻입니다. 항상 하나의 SQL로 Join한다는 뜻은 아닙니다.  
중요한 점은 사용자마다 같은 SQL을 반복하지 않고, Prisma가 관계 데이터를 묶어 조회한다는 것입니다.  

### 🟦 최적화 전후 SQL 실행 횟수 비교

사용자 10명을 기준으로 실행 구조를 비교하면 다음과 같습니다.  

| 방식 | 사용자 조회 | 게시글 조회 | 예상 합계 |
| --- | ---: | ---: | ---: |
| 사용자별 `findMany()` | 1회 | 10회 | 11회 |
| 중첩 `select` | 1회 | 1회 | 2회 |
| 중첩 `include` | 1회 | 1회 | 2회 |

SQL 실행 횟수가 줄면 애플리케이션과 데이터베이스 사이의 통신 비용도 줄어듭니다.  
다만 전용 Query는 GraphQL 요청에서 `posts`를 선택하지 않아도 관계 데이터를 미리 가져옵니다. 따라서 게시글이 필요하지 않은 요청에서는 불필요한 조회가 발생할 수 있습니다.  

## 3. Prisma 내부 DataLoader를 활용한 자동 배칭 {#session-03}

Prisma Client에는 같은 실행 주기에 들어온 `findUnique()` 호출을 자동으로 묶는 내부 DataLoader가 있습니다. 단, 각 호출의 조회 형태가 같아야 합니다.  
이 기능을 사용하면 사용자마다 Field Resolver를 실행하는 구조를 유지하면서도 관계 조회는 하나의 배치로 처리할 수 있습니다.  
![Prisma 내부 DataLoader](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-6.png)  

### 🟦 Prisma Client 내부 DataLoader의 개념과 동작 원리

클라이언트가 `users`의 하위 필드로 `postsByPrismaLoader`를 요청했다고 가정해 보겠습니다.  
먼저 `users` Resolver가 사용자 목록을 반환합니다.  
GraphQL은 목록의 각 사용자에 대해 `postsByPrismaLoader` Field Resolver를 실행합니다.  
각 Resolver는 현재 사용자의 ID로 게시글을 요청합니다.  

이때 `postsByPrismaLoader` Resolver가 직접 자동 배칭을 수행하는 것은 아닙니다.  
각 Resolver가 만든 `findUnique().posts()` 호출을 Prisma Client의 내부 DataLoader가 모아서 한꺼번에 처리합니다.  

```text
1. users Resolver가 사용자 목록을 조회합니다.
2. GraphQL이 사용자마다 postsByPrismaLoader Field Resolver를 실행합니다.
3. 각 Field Resolver가 현재 사용자 ID로 findUnique().posts()를 호출합니다.
4. Prisma 내부 DataLoader가 조회 형태가 같은 호출을 자동으로 묶습니다.
5. Prisma가 여러 사용자의 관계 데이터를 묶어서 조회합니다.
```

예를 들어 사용자 세 명을 조회하면 `postsByPrismaLoader` Resolver도 세 번 실행되고, 다음과 같은 Prisma 호출이 만들어집니다.  

```text
사용자 1 → findUnique({ id: 1 }).posts()
사용자 2 → findUnique({ id: 2 }).posts()
사용자 3 → findUnique({ id: 3 }).posts()
                         │
                         ▼
Prisma 내부 DataLoader가 같은 실행 주기의 호출을 묶습니다.
                         │
                         ▼
여러 사용자와 관계 게시글을 묶어서 조회합니다.
```

Field Resolver는 세 번 실행되지만 게시글 SQL까지 세 번 실행되는 것은 아닙니다. Prisma가 세 호출을 묶어서 처리하기 때문입니다.  
이 DataLoader는 Prisma Client의 내부 기능이며, 애플리케이션에서 `dataloader` 패키지로 직접 만드는 DataLoader와는 다릅니다.  

### 🟦 findUnique() 자동 배칭의 적용 조건

Prisma 내부 배칭을 기대하려면 다음 조건을 확인해야 합니다.  

- 같은 실행 주기에 호출된 `findUnique()` Query여야 합니다.  
- `where`는 ID처럼 고유한 스칼라 필드에 `equals` 조건을 사용해야 합니다.  
- `select`와 관계 조회 조건을 비롯한 Query 형태가 서로 같아야 합니다.  
- 일반적인 개별 `findMany()` 호출은 이 자동 배칭 대상이 아닙니다.  

> 같은 실행 주기(Same Tick)는 여러 호출이 개별 결과를 기다리지 않고 이어서 들어오는 짧은 처리 구간입니다. Prisma는 이 구간에 들어온 호출을 하나의 배치로 모을 수 있습니다.  

조건이 달라지면 호출이 서로 다른 배치로 나뉘거나 개별 실행될 수 있습니다.  
따라서 쿼리 로그에서 실제로 실행된 SQL을 확인해야 합니다.  

### 🟦 findUnique().posts()를 활용한 관계 데이터 조회

다음 요청으로 앞에서 살펴본 흐름을 확인해 보겠습니다. Selection Set에 `postsByPrismaLoader`가 있으므로 GraphQL은 각 사용자에 대해 같은 이름의 Field Resolver를 실행합니다.  

```graphql
query UsersWithPrismaLoader {
  users {
    id
    email
    postsByPrismaLoader {
      id
      title
    }
  }
}
```

`postsByPrismaLoader` Field Resolver는 현재 처리 중인 사용자의 ID인 `parent.id`를 User Service의 `posts()` 메서드에 전달합니다.  

```typescript
// /src/modules/user/user.resolver.ts
User: {
  // 사용자마다 실행되며, 현재 사용자의 게시글 조회를 Service에 요청합니다.
  postsByPrismaLoader: (
    parent: UserParent,
    _args: unknown,
    context: GraphQLContext,
  ) => context.services.users.posts(parent.id),
}
```

Service가 Repository의 `findPosts()`를 호출하면 `findUnique()`가 사용자를 지정합니다. 이어지는 관계 조회 API인 `.posts()`는 해당 사용자의 게시글을 요청합니다.  

```typescript
// /src/modules/user/user.repository.ts
findPosts(id: number) {
  return this.prisma.user
    // 현재 Field Resolver가 처리하는 사용자를 지정합니다.
    .findUnique({ where: { id } })
    // 해당 사용자와 연결된 게시글을 조회합니다.
    .posts({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
}
```

각 Field Resolver는 게시글 조회를 따로 요청합니다. 하지만 조건과 조회 형태가 같으면 Prisma Client의 내부 DataLoader가 같은 실행 주기의 `findUnique()` 호출을 자동으로 묶습니다.  
그 결과 Prisma는 사용자별 SQL을 반복하지 않고 여러 사용자와 게시글을 배치로 조회합니다.  
현재 실습 구조에서는 일반적으로 SQL이 약 3회 실행됩니다. 정확한 횟수와 형태는 Prisma 버전과 데이터베이스에 따라 달라질 수 있습니다.  

### 🟦 findMany() 개별 호출과 자동 배칭 방식 비교

| 비교 항목 | 개별 `post.findMany()` | `user.findUnique().posts()` |
| --- | --- | --- |
| Resolver 호출 | 사용자마다 한 번 | 사용자마다 한 번 |
| Prisma 자동 배칭 | 적용되지 않습니다. | 조건이 맞으면 적용됩니다. |
| 게시글 SQL | 사용자마다 반복됩니다. | 여러 사용자 관계를 묶습니다. |
| 코드 변경 범위 | 단순하지만 N+1 문제가 발생합니다. | Prisma의 관계 조회 API를 사용합니다. |

두 방식 모두 GraphQL Field Resolver는 사용자마다 실행됩니다.  
두 방식의 차이는 Resolver 실행 횟수가 아닙니다. Resolver에서 발생한 데이터베이스 작업을 하나로 묶을 수 있는지가 핵심입니다.  

## 4. 외부 DataLoader를 활용한 Batch Loading과 Caching {#session-04}

외부 `DataLoader`를 사용하면 여러 조회 요청을 어떤 기준으로 모으고, 어떤 Query로 처리할지 애플리케이션에서 직접 정할 수 있습니다.  
실습에서는 사용자 ID를 조회 기준인 Key로 사용합니다. 여러 사용자 ID를 모은 뒤 `authorId IN (...)` 조건으로 게시글을 한 번에 조회합니다.  
![외부 DataLoader](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-7.png)

외부 DataLoader는 Prisma의 내부 기능과 달리 별도 패키지를 사용합니다. 실습을 시작하기 전에 `graphql-basics` 프로젝트에서 `dataloader` 패키지를 설치합니다.  

```bash
npm install dataloader@2.2.3
```

이 패키지는 여러 `load()` 호출을 하나의 Batch Function 실행으로 묶고, 같은 요청 안에서 동일한 Key의 결과를 재사용하는 기능을 제공합니다.  

### 🟦 DataLoader 동작 원리: Batch Loading, Caching, load()

각 Field Resolver는 현재 사용자의 ID를 `load()`에 Key로 전달합니다. 여기서 Key는 어떤 사용자의 게시글을 가져올지 구분하는 값입니다.  
DataLoader는 같은 실행 주기에 전달된 Key를 모아 배치 함수(Batch Function)를 한 번만 실행합니다.  
배치 함수가 여러 사용자의 게시글을 한꺼번에 조회하면, DataLoader가 결과를 사용자별로 나누어 각 Resolver에 돌려줍니다.  

```text
load(1) ─┐
load(2) ─┼─→ Batch Function([1, 2, 3]) → 게시글 SQL 1회
load(3) ─┘                                  │
       사용자 1 결과 ← 입력 순서에 맞게 매핑 ┤
       사용자 2 결과 ← 입력 순서에 맞게 매핑 ┤
       사용자 3 결과 ← 입력 순서에 맞게 매핑 ┘
```

같은 DataLoader에서 동일한 Key를 다시 `load()`하면 앞서 저장한 Promise를 재사용합니다. 따라서 같은 요청 안에서는 동일한 데이터를 반복해서 조회하지 않습니다.  
이 캐시는 Redis처럼 여러 요청이 함께 사용하는 공용 캐시가 아닙니다. 현재 GraphQL 요청 안에서 중복 조회를 줄이는 임시 캐시입니다.  

### 🟦 Prisma findMany()와 in 조건을 이용한 Batch Function 구현

실습의 배치 함수는 DataLoader가 모은 사용자 ID를 한꺼번에 받습니다. 그런 다음 Prisma의 `findMany()`와 `in` 조건으로 해당 사용자들의 게시글을 한 번에 조회합니다.  

```typescript
// /src/modules/post/post.loader.ts
import DataLoader from 'dataloader';

export function createPostsByAuthorIdLoader(prisma: PrismaClient) {
  return new DataLoader<number, Post[]>(async (authorIds) => {
    const posts = await prisma.post.findMany({
      // 여러 사용자의 게시글을 하나의 IN 조건으로 조회합니다.
      where: { authorId: { in: [...authorIds] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    // 조회 결과를 작성자 ID별 배열로 묶습니다.
    const postsByAuthorId = new Map<number, Post[]>();
    for (const post of posts) {
      const authorPosts = postsByAuthorId.get(post.authorId) ?? [];
      authorPosts.push(post);
      postsByAuthorId.set(post.authorId, authorPosts);
    }

    // 입력 Key와 같은 길이와 순서로 결과를 반환합니다.
    // 게시글이 없는 사용자는 빈 배열을 받습니다.
    return authorIds.map((authorId) => postsByAuthorId.get(authorId) ?? []);
  });
}
```

배치 함수가 반환하는 배열은 입력으로 받은 Key 배열과 길이와 순서가 같아야 합니다. 첫 번째 Key의 결과는 반환 배열의 첫 번째 위치에 있어야 합니다.  
데이터베이스에서 조회된 게시글의 순서를 그대로 반환하면 사용자와 결과가 서로 어긋날 수 있습니다. 따라서 게시글을 작성자 ID별로 묶은 뒤, 입력 Key 순서에 맞춰 배열을 다시 만들어야 합니다.  

```text
입력 Key: [2, 1, 10]
반환값:   [사용자 2의 게시글, 사용자 1의 게시글, []]
```

### 🟦 GraphQL Context에 요청별 DataLoader 생성

하나의 DataLoader를 여러 HTTP 요청에서 함께 사용하면 이전 요청의 데이터가 캐시에 남을 수 있습니다. 접근 권한이 서로 다른 사용자의 데이터가 섞일 위험도 있습니다.  
이 문제를 막기 위해 DataLoader는 애플리케이션 전체에서 하나만 만들지 않고, GraphQL 요청이 들어올 때마다 새로 만듭니다.  

```typescript
// /src/loaders.ts
export interface Loaders {
  postsByAuthorId: ReturnType<typeof createPostsByAuthorIdLoader>;
}

export function createLoaders(prisma: PrismaClient): Loaders {
  return {
    // 이 인스턴스의 배치와 캐시는 현재 요청 안에서만 공유됩니다.
    postsByAuthorId: createPostsByAuthorIdLoader(prisma),
  };
}
```

GraphQL Route의 Handler는 요청이 들어올 때 Loader를 만들고 Context에 넣습니다.  
Service와 Prisma Client는 기존 인스턴스를 계속 사용하지만, Loader는 요청마다 새로운 인스턴스를 사용합니다. 따라서 배치와 캐시의 범위도 현재 요청으로 제한됩니다.  

```typescript
// /src/graphql/route.ts
handler: async (req, reply) => {
  // HTTP 요청이 시작될 때 새로운 Loader 모음을 만듭니다.
  const loaders = createLoaders(app.prisma);

  const response = await yoga.handleNodeRequestAndResponse(req, reply, {
    req,
    reply,
    services,
    loaders,
  });

  return reply.send(response.body);
},
```

Field Resolver는 Prisma를 직접 호출하지 않습니다. 대신 Context에 있는 Loader의 `load()`를 호출하고 현재 사용자 ID를 전달합니다.  

```typescript
// /src/modules/user/user.resolver.ts
User: {
  postsByDataLoader: (
    parent: UserParent,
    _args: unknown,
    context: GraphQLContext,
  ) => context.loaders.postsByAuthorId.load(parent.id),
}
```

다음 Query는 먼저 `users`로 사용자 목록을 조회합니다. GraphQL은 각 사용자에 대해 `postsByDataLoader` Field Resolver를 실행하고, 각 Resolver는 `load(parent.id)`를 호출합니다.  

```graphql
query UsersWithDataLoader {
  users {
    id
    email
    postsByDataLoader {
      id
      title
    }
  }
}
```

DataLoader는 여러 `load()` 호출에서 받은 사용자 ID를 모아 배치 함수를 한 번 실행합니다.  
따라서 로그에서는 사용자 목록 SQL이 한 번, 모든 사용자의 게시글을 가져오는 SQL이 한 번 실행됩니다.  

```sql
SELECT ... FROM users ORDER BY id ASC;

SELECT ...
FROM posts
WHERE author_id IN (1, 2, 3, ..., 10)
ORDER BY created_at DESC, id DESC;
```

### 🟦 요청별 캐싱과 캐시 무효화

같은 요청 안에서 `load(1)`을 여러 번 호출하면 첫 번째 호출에서 저장한 결과를 재사용합니다. 같은 사용자 ID 때문에 배치 함수를 다시 실행하지 않습니다.  
요청 처리가 끝나면 Loader와 캐시도 함께 사라집니다. 다음 요청에서는 새 Loader를 사용하므로 데이터베이스에서 다시 조회합니다.  

한 GraphQL 요청 안에서 게시글을 변경한 뒤 같은 작성자의 게시글을 다시 조회할 수도 있습니다. 이때는 변경 전 결과가 남지 않도록 해당 캐시를 비워야 합니다.  

```typescript
// 게시글을 생성·수정·삭제한 뒤 해당 작성자의 캐시만 제거합니다.
context.loaders.postsByAuthorId.clear(authorId);

// 여러 사용자의 결과가 한꺼번에 바뀌었다면 전체 캐시를 제거할 수 있습니다.
context.loaders.postsByAuthorId.clearAll();
```

현재 실습에는 게시글을 변경하는 Mutation이 없으므로 캐시를 비우는 코드는 아직 필요하지 않습니다.  
나중에 게시글 Mutation을 추가한다면 변경된 작성자의 Key를 `clear()`로 지우도록 확장할 수 있습니다.  

### 🟦 Prisma 내부 최적화 방식과 외부 DataLoader 비교

| 비교 항목 | Prisma 내부 DataLoader | 외부 DataLoader |
| --- | --- | --- |
| 생성 및 관리 | Prisma Client가 내부에서 처리합니다. | 애플리케이션이 요청마다 생성합니다. |
| 대표 호출 | `findUnique().posts()` | `loader.load(authorId)` |
| 배치 Query | Prisma가 결정합니다. | 배치 함수에서 직접 정의합니다. |
| 요청 내 캐시 제어 | 내부 구현에 맡깁니다. | `clear()`, `clearAll()`, `prime()`을 사용할 수 있습니다. |
| 적용 대상 | Prisma가 배칭할 수 있는 Query 형태 | DB, REST API 등 다양한 데이터 소스 |
| 구현 복잡도 | 비교적 낮습니다. | Loader 생성과 결과 매핑이 필요합니다. |

Prisma가 자동으로 묶을 수 있는 단순한 관계 조회라면 내부 DataLoader만으로 충분할 수 있습니다.  
반면 배치 Query와 캐시를 직접 제어하거나 데이터베이스 외의 API까지 함께 조회해야 한다면 외부 DataLoader가 더 알맞습니다.  

최종 쿼리 실행 구조를 비교하면 다음과 같습니다.  

| 관계 조회 방식 | 사용자 10명 기준 예상 SQL | 특징 |
| --- | ---: | --- |
| 사용자별 `findMany()` | 11회 | N+1 비교 기준입니다. |
| 중첩 `select` 또는 `include` | 2회 | 관계 데이터를 미리 조회합니다. |
| Prisma `findUnique().posts()` | 약 3회 | 내부 DataLoader가 자동 배칭합니다. |
| 외부 DataLoader와 `in` 조건 | 2회 | Batch와 요청별 캐시를 직접 제어합니다. |

SQL 실행 횟수는 Prisma 버전, 데이터베이스 Provider, 관계 로드 전략에 따라 달라질 수 있습니다.  
따라서 표의 숫자만 보고 방식을 선택해서는 안 됩니다. 실제 요청의 쿼리 로그와 응답 시간을 함께 측정해야 합니다.  

관계 데이터가 항상 필요하다면 `include`나 `select`로 미리 조회하는 방식이 단순합니다.  
Field Resolver 구조를 유지하고 싶다면 Prisma 내부 DataLoader를 활용할 수 있습니다.  
배치 Query와 요청별 캐시를 직접 관리해야 한다면 외부 DataLoader를 선택할 수 있습니다.  
