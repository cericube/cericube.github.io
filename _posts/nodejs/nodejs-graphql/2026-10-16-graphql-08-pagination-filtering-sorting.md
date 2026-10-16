---
layout: post
title: "08. GraphQL Pagination, Filtering, Sorting"
description: "GraphQL Input Type으로 게시글 필터·정렬·페이지 조건을 정의하고, Prisma의 skip·take와 Cursor를 이용해 Offset 및 Cursor 기반 목록 조회 API를 구현합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. Offset 기반 Pagination 구현"
  - id: session-02
    title: "2. Cursor 기반 Pagination 개념과 활용"
  - id: session-03
    title: "3. Input Type을 활용한 Filtering 및 Sorting"
  - id: session-04
    title: "4. Prisma 기반 게시글 목록 조회 API 구현"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

게시글이 늘어나면 모든 데이터를 한 번에 반환하기보다 일정한 크기로 나누어 조회해야 합니다.  
Pagination은 목록을 여러 페이지로 나누고, Filtering은 필요한 게시글만 남기며, Sorting은 결과의 순서를 정합니다.  
이번 글에서는 GraphQL Input Type으로 조회 조건을 정의하고 Prisma를 이용해 Offset과 Cursor 기반 게시글 목록 API를 구현합니다.  

## 1. Offset 기반 Pagination 구현 {#session-01}

Offset 기반 Pagination은 앞에서 몇 건을 건너뛸지와 몇 건을 가져올지를 숫자로 지정하는 방식입니다.  
예를 들어 `offset: 10`, `limit: 5`를 전달하면 앞의 10건을 건너뛰고 그다음 5건을 조회합니다.  

Prisma에서는 각각 `skip`과 `take`로 표현합니다.  

```typescript
return prisma.post.findMany({
  skip: 10,
  take: 5,
  orderBy: { createdAt: 'desc' },
});
```

페이지 번호를 사용한다면 Offset은 다음 식으로 계산할 수 있습니다.  

```text
offset = (page - 1) × limit
```

한 페이지에 10개씩 보여 줄 때 1페이지는 `offset: 0`, 2페이지는 `offset: 10`, 3페이지는 `offset: 20`이 됩니다. 원하는 페이지로 바로 이동하기 쉽다는 것이 Offset 방식의 장점입니다.  

### 🟦 Offset 페이지 Schema 정의

실습 프로젝트는 Pagination 조건과 응답 정보를 별도의 타입으로 정의합니다.  

```graphql
# /src/modules/post/post.schema.ts
input OffsetPaginationInput {
  offset: Int = 0
  limit: Int = 10
}

type OffsetPageInfo {
  offset: Int!
  limit: Int!
  hasNextPage: Boolean!
}

type OffsetPostPage {
  items: [Post!]!
  totalCount: Int!
  pageInfo: OffsetPageInfo!
}
```

`OffsetPaginationInput`을 생략하면 첫 번째 게시글부터 10개를 가져옵니다. 응답에는 게시글 배열뿐 아니라 필터를 만족하는 전체 개수와 다음 페이지 존재 여부도 포함합니다.  

| 필드 | 의미 |
| --- | --- |
| `items` | 현재 페이지에 포함된 게시글 목록 |
| `totalCount` | 필터를 만족하는 전체 게시글 수 |
| `pageInfo.offset` | 이번 요청에서 건너뛴 게시글 수 |
| `pageInfo.limit` | 요청한 페이지 크기 |
| `pageInfo.hasNextPage` | 다음 페이지 존재 여부 |

Query에는 Pagination과 함께 Filter, Sort 입력을 받을 수 있는 `postsByOffset` 필드를 선언합니다.  

```graphql
extend type Query {
  postsByOffset(
    pagination: OffsetPaginationInput
    filter: PostFilterInput
    sort: PostSortInput
  ): OffsetPostPage!
}
```

### 🟦 Prisma의 skip과 take

Repository는 Service에서 검증한 조건을 Prisma 쿼리로 옮깁니다.  

```typescript
// /src/modules/post/post.repository.ts
findByOffset(
  filter: PostFilterInput,
  offset: number,
  take: number,
  orderBy: Prisma.PostOrderByWithRelationInput[],
) {
  return this.prisma.post.findMany({
    where: this.where(filter),
    skip: offset,
    take,
    orderBy,
  });
}
```

Offset이 커질수록 데이터베이스가 앞의 행을 많이 건너뛰어야 하므로 뒤쪽 페이지의 조회 비용이 커질 수 있습니다. 또한 사용자가 페이지를 이동하는 사이에 새 게시글이 추가되면 기존 데이터의 위치가 밀려 같은 게시글이 다시 나오거나 일부 게시글이 빠질 수 있습니다.  

관리자 화면처럼 전체 페이지 수가 필요하거나 특정 페이지로 바로 이동해야 하는 목록에는 Offset 방식이 잘 어울립니다. 반면 계속 아래로 내리는 피드나 데이터가 자주 바뀌는 목록에는 Cursor 방식을 고려할 수 있습니다.  

## 2. Cursor 기반 Pagination 개념과 활용 {#session-02}

Cursor 기반 Pagination은 건너뛸 개수 대신 이전 페이지의 마지막 항목을 기준점으로 사용합니다. 첫 요청에서는 Cursor를 생략하고, 다음 요청부터 직전 응답의 `endCursor`를 `after`로 전달합니다.  

```text
첫 요청: after 없음 → 게시글 3개와 endCursor 반환
다음 요청: after = 이전 endCursor → 그 게시글 다음부터 3개 반환
```

Cursor는 클라이언트가 내부 구조에 의존하지 않도록 불투명한 문자열로 전달하는 것이 좋습니다. 실습 프로젝트는 게시글 ID에 종류를 나타내는 접두어를 붙이고 Base64URL 문자열로 변환합니다.  

```typescript
// /src/common/pagination/cursor.ts
export function encodeCursor(id: number): string {
  return Buffer.from(`post:${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): number {
  const [kind, rawId] = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
  const id = Number(rawId);

  if (kind !== 'post' || !Number.isInteger(id) || id < 1) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      '올바르지 않은 게시글 cursor입니다.',
    );
  }

  return id;
}
```

Base64URL은 값을 암호화하지 않습니다. 단지 `post:4`와 같은 내부 표현을 API에서 직접 사용하지 않도록 문자열 형태를 바꾸는 역할입니다. Cursor에 민감한 정보를 넣어서는 안 됩니다.  

### 🟦 Cursor 페이지 Schema 정의

요청에는 기준 위치인 `after`와 가져올 개수인 `first`를 사용합니다.  

```graphql
input CursorPaginationInput {
  after: String
  first: Int = 10
}

type CursorPageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type PostConnection {
  items: [Post!]!
  totalCount: Int!
  pageInfo: CursorPageInfo!
}

extend type Query {
  postsByCursor(
    pagination: CursorPaginationInput
    filter: PostFilterInput
  ): PostConnection!
}
```

Relay Cursor Connections 사양에서는 보통 `edges` 안에 `node`와 `cursor`를 넣습니다. 이 예제는 개념에 집중하기 위해 `items` 배열과 `pageInfo`만 반환하는 단순한 구조를 사용합니다.  

### 🟦 한 건 더 조회해 다음 페이지 확인

Cursor 방식에서는 요청한 개수보다 한 건을 더 조회하면 별도의 목록 조회 없이 다음 페이지가 있는지 확인할 수 있습니다.  

```typescript
const rows = await this.posts.findByCursor(filter, cursorId, first + 1);
const hasNextPage = rows.length > first;
const items = rows.slice(0, first);
```

클라이언트가 3건을 요청했다면 Repository에는 4건을 요청합니다. 4건이 반환되면 네 번째 게시글은 응답에서 제외하고 `hasNextPage`를 `true`로 설정합니다. 3건 이하라면 마지막 페이지입니다.  

Repository는 Cursor가 가리키는 게시글 다음부터 조회합니다.  

```typescript
// /src/modules/post/post.repository.ts
findByCursor(filter: PostFilterInput, cursorId: number | undefined, take: number) {
  return this.prisma.post.findMany({
    where: this.where(filter),
    ...(cursorId == null ? {} : { cursor: { id: cursorId }, skip: 1 }),
    take,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}
```

Prisma의 `cursor`는 기준 행을 결과에 포함하므로 `skip: 1`로 직전 페이지의 마지막 게시글을 제외합니다. Cursor가 없는 첫 요청에는 `cursor`와 `skip`을 넣지 않습니다.  

Cursor Pagination에서는 정렬 순서가 매번 같아야 합니다. `createdAt` 값이 같은 게시글이 여러 개일 수 있으므로 고유한 `id`를 두 번째 정렬 기준으로 추가해 순서를 확정합니다. Prisma Schema에도 같은 조회 패턴을 고려한 복합 인덱스를 선언했습니다.  

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now()) @map("created_at")

  @@index([createdAt, id])
  @@map("posts")
}
```

## 3. Input Type을 활용한 Filtering 및 Sorting {#session-03}

페이지 조건, 검색 조건, 정렬 조건을 각각 Input Type으로 분리하면 Query 인자가 길어지지 않고 목적도 명확해집니다. 새로운 필터가 추가되더라도 Query 필드의 전체 구조를 바꾸지 않고 Input Type을 확장할 수 있습니다.  

### 🟦 게시글 Filter Input

게시 여부, 작성자, 제목 검색어를 선택적으로 전달할 수 있도록 정의합니다.  

```graphql
input PostFilterInput {
  published: Boolean
  authorId: ID
  titleContains: String
}
```

여러 값을 함께 전달하면 모든 조건을 만족하는 게시글을 찾습니다. 다음 변수는 공개된 게시글 중 작성자 ID가 `2`이고 제목에 `GraphQL`이 포함된 게시글을 의미합니다.  

```json
{
  "filter": {
    "published": true,
    "authorId": "2",
    "titleContains": "GraphQL"
  }
}
```

Repository의 `where` 메서드는 실제 값이 있는 조건만 Prisma의 `PostWhereInput`으로 변환합니다.  

```typescript
// /src/modules/post/post.repository.ts
private where(filter: PostFilterInput = {}): Prisma.PostWhereInput {
  return {
    ...(filter.published != null ? { published: filter.published } : {}),
    ...(filter.authorId != null ? { authorId: Number(filter.authorId) } : {}),
    ...(filter.titleContains
      ? { title: { contains: filter.titleContains } }
      : {}),
  };
}
```

JavaScript에서 `false`는 falsy 값이므로 `if (filter.published)`처럼 검사하면 `published: false` 조건이 사라집니다. `null`과 `undefined`만 제외하도록 `!= null`을 사용해야 공개되지 않은 게시글도 정상적으로 필터링할 수 있습니다.  

같은 `where()`를 목록 조회와 `count()`에서 함께 사용하면 `items`와 `totalCount`에 서로 다른 조건이 적용되는 실수를 막을 수 있습니다.  

### 🟦 게시글 Sort Input

정렬 가능한 필드와 방향은 문자열 대신 Enum으로 제한합니다.  

```graphql
enum PostSortField {
  CREATED_AT
  UPDATED_AT
  TITLE
}

enum SortDirection {
  ASC
  DESC
}

input PostSortInput {
  field: PostSortField = CREATED_AT
  direction: SortDirection = DESC
}
```

클라이언트가 임의의 데이터베이스 열 이름을 전달할 수 없으며, 오타도 GraphQL 검증 단계에서 발견됩니다. Service는 GraphQL Enum을 Prisma의 필드 이름과 정렬 방향으로 변환합니다.  

```typescript
function orderBy(sort: PostSortInput = {}): Prisma.PostOrderByWithRelationInput[] {
  const direction = (sort.direction ?? 'DESC').toLowerCase() as Prisma.SortOrder;
  const fields = {
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
    TITLE: 'title',
  } as const;

  return [
    { [fields[sort.field ?? 'CREATED_AT']]: direction },
    { id: direction },
  ];
}
```

첫 번째 정렬 값이 같을 때도 결과 순서가 바뀌지 않도록 `id`를 보조 정렬 기준으로 사용합니다. 이처럼 Pagination에는 결과의 순서를 완전히 결정할 수 있는 안정적인 정렬 조건이 필요합니다.  

이 예제의 사용자 지정 정렬은 Offset API에만 제공합니다. Cursor API는 Cursor와 정렬 기준이 항상 일치하도록 `createdAt DESC, id DESC`로 고정합니다. Cursor API에 자유로운 정렬을 추가하려면 Cursor에도 정렬 필드의 값과 ID를 함께 담고, 각 정렬 방식에 맞는 다음 페이지 조건을 구현해야 합니다.  

## 4. Prisma 기반 게시글 목록 조회 API 구현 {#session-04}

게시글 목록 요청은 Resolver, Service, Repository 순서로 처리됩니다. 각 계층의 책임을 나누면 GraphQL 연결 코드, 입력 검증, Prisma 조회 코드를 따로 이해하고 변경할 수 있습니다.  

```text
GraphQL Query
  → Post Resolver
    → Post Service: 기본값 적용, 입력 검증, 페이지 응답 조립
      → Post Repository: Prisma where, orderBy, skip, take 실행
        → SQLite
```

### 🟦 Resolver에서 Service 연결

Resolver는 GraphQL 인자를 그대로 Service에 전달합니다.  

```typescript
// /src/modules/post/post.resolver.ts
export const postResolvers = {
  Query: {
    postsByOffset: (
      _parent: unknown,
      args: OffsetPostQueryArgs,
      context: GraphQLContext,
    ) => context.services.posts.listByOffset(args),

    postsByCursor: (
      _parent: unknown,
      args: CursorPostQueryArgs,
      context: GraphQLContext,
    ) => context.services.posts.listByCursor(args),
  },
};
```

Resolver에 검증이나 Prisma 코드를 넣지 않아 HTTP가 아닌 다른 진입점에서도 같은 Service를 재사용할 수 있습니다.  

### 🟦 Offset 목록 Service 구현

Service는 페이지 크기와 Offset을 검증하고, 목록과 전체 개수를 병렬로 조회합니다.  

```typescript
// /src/modules/post/post.service.ts
async listByOffset(args: OffsetPostQueryArgs = {}) {
  const filter = args.filter ?? {};
  this.validateFilter(filter);

  const offset = args.pagination?.offset ?? 0;
  const limit = pageSize(args.pagination?.limit);

  if (!Number.isInteger(offset) || offset < 0) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      'offset은 0 이상의 정수여야 합니다.',
    );
  }

  const [items, totalCount] = await Promise.all([
    this.posts.findByOffset(filter, offset, limit, orderBy(args.sort ?? {})),
    this.posts.count(filter),
  ]);

  return {
    items,
    totalCount,
    pageInfo: {
      offset,
      limit,
      hasNextPage: offset + items.length < totalCount,
    },
  };
}
```

목록과 개수 조회는 서로의 결과에 의존하지 않으므로 `Promise.all()`로 동시에 실행합니다. 다음 페이지 여부는 현재까지 지나온 항목 수인 `offset + items.length`가 전체 개수보다 작은지 비교해 계산합니다.  

페이지 크기는 Service에서 다시 검사합니다. GraphQL의 `Int`는 정수 여부만 보장하므로 음수나 지나치게 큰 값은 별도로 제한해야 합니다.  

```typescript
function pageSize(value: number | null | undefined): number {
  const size = value ?? 10;

  if (!Number.isInteger(size) || size < 1 || size > 100) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      '페이지 크기는 1에서 100 사이여야 합니다.',
    );
  }

  return size;
}
```

### 🟦 Offset API 요청

다음 Query는 공개된 게시글을 제목 오름차순으로 두 개씩 조회합니다.  

```graphql
query GetPostsByOffset(
  $pagination: OffsetPaginationInput
  $filter: PostFilterInput
  $sort: PostSortInput
) {
  postsByOffset(
    pagination: $pagination
    filter: $filter
    sort: $sort
  ) {
    items {
      id
      title
      published
      author {
        id
        displayName
      }
    }
    totalCount
    pageInfo {
      offset
      limit
      hasNextPage
    }
  }
}
```

Variables에는 입력 객체를 각각 전달합니다.  

```json
{
  "pagination": {
    "offset": 0,
    "limit": 2
  },
  "filter": {
    "published": true
  },
  "sort": {
    "field": "TITLE",
    "direction": "ASC"
  }
}
```

다음 페이지는 응답의 `pageInfo.hasNextPage`를 확인한 뒤 `offset`을 2로 바꾸어 요청합니다.  

### 🟦 Cursor 목록 Service 구현

Cursor Service는 `after`를 게시글 ID로 해석한 뒤 요청한 크기보다 한 건 더 조회합니다.  

```typescript
// /src/modules/post/post.service.ts
async listByCursor(args: CursorPostQueryArgs = {}) {
  const filter = args.filter ?? {};
  this.validateFilter(filter);

  const first = pageSize(args.pagination?.first);
  const cursorId = args.pagination?.after == null
    ? undefined
    : decodeCursor(args.pagination.after);

  const rows = await this.posts.findByCursor(filter, cursorId, first + 1);
  const hasNextPage = rows.length > first;
  const items = rows.slice(0, first);
  const totalCount = await this.posts.count(filter);

  return {
    items,
    totalCount,
    pageInfo: {
      hasNextPage,
      endCursor: items.at(-1) ? encodeCursor(items.at(-1)!.id) : null,
    },
  };
}
```

현재 페이지에 게시글이 있으면 마지막 게시글의 ID로 `endCursor`를 만듭니다. 결과가 비어 있으면 다음 요청의 기준점이 없으므로 `null`을 반환합니다. `totalCount`는 Cursor 뒤에 남은 개수가 아니라 같은 Filter를 만족하는 전체 게시글 수입니다.  

### 🟦 Cursor API 요청

첫 페이지에서는 `after`를 생략합니다.  

```graphql
query GetPostsByCursor(
  $pagination: CursorPaginationInput
  $filter: PostFilterInput
) {
  postsByCursor(pagination: $pagination, filter: $filter) {
    items {
      id
      title
      createdAt
    }
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

```json
{
  "pagination": {
    "first": 2
  },
  "filter": {
    "published": true
  }
}
```

응답에서 `hasNextPage`가 `true`라면 다음 요청의 `after`에 받은 `endCursor`를 그대로 넣습니다.  

```json
{
  "pagination": {
    "first": 2,
    "after": "cG9zdDo0"
  },
  "filter": {
    "published": true
  }
}
```

Cursor를 직접 해석하거나 새로 만들지 않고 서버가 반환한 값을 그대로 사용하는 것이 중요합니다. 또한 페이지를 이동하는 동안 Filter를 바꾸면 Cursor가 가리키는 기준과 조회 집합이 달라질 수 있으므로, 같은 목록을 이어서 조회할 때는 동일한 Filter를 유지해야 합니다.  

Offset 방식은 구현과 페이지 이동이 단순하고, Cursor 방식은 큰 데이터나 실시간으로 변하는 목록을 순차적으로 탐색할 때 유리합니다. 어느 방식이 항상 더 좋은 것은 아닙니다. 화면이 페이지 번호와 전체 개수를 요구하는지, 무한 스크롤인지, 데이터가 얼마나 자주 변경되는지를 기준으로 선택해야 합니다.  

이번 실습에서는 두 Pagination 방식을 같은 `Post` 도메인에 구현하고, Input Type으로 Filter와 Sort를 분리했습니다. 다음 편에서는 게시글과 작성자를 중첩 조회할 때 발생할 수 있는 N+1 문제를 Prisma Query 로그로 확인하고 DataLoader로 개선합니다.  
