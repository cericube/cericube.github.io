---
layout: post
title: "08. GraphQL Pagination, Filtering, Sorting"
description: "GraphQL Input Type으로 필터·정렬·페이지 조건을 정의하고, Prisma로 Offset Pagination과 GraphQL Cursor Connections 기반 양방향 Cursor Pagination API를 구현하고 테스트합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. Offset 기반 Pagination 구현"
  - id: session-02
    title: "2. GraphQL Cursor Connections 기반 양방향 Pagination"
  - id: session-03
    title: "3. Input Type을 활용한 Filtering 및 Sorting"
  - id: session-04
    title: "4. 게시글 목록 조회 API 구현 및 실습"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. Offset 기반 Pagination 구현 {#session-01}

### 🟦 Offset Pagination 개념과 동작 원리

Offset Pagination은 앞에서 몇 건을 건너뛸지와 몇 건을 가져올지를 숫자로 지정하는 방식입니다.  
`offset`은 건너뛸 데이터 수이고, `limit`은 한 번에 가져올 최대 데이터 수입니다.  

예를 들어 `offset: 10`, `limit: 5`를 전달하면 앞의 10건을 건너뛰고 그다음 5건을 조회합니다.  

```text
전체 데이터: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 ...
offset: 10  → 1번부터 10번까지 건너뜁니다.
limit: 5    → 11번부터 15번까지 가져옵니다.
```

페이지 번호를 Offset으로 바꾸는 식은 다음과 같습니다.  

```text
offset = (page - 1) × limit
```

한 페이지에 10개씩 보여 준다면 1페이지는 `offset: 0`, 2페이지는 `offset: 10`, 3페이지는 `offset: 20`이 됩니다.  
페이지 번호를 조회 조건으로 바꾸기 쉽고 원하는 페이지로 바로 이동할 수 있다는 점이 Offset 방식의 장점입니다.  

### 🟦 GraphQL Schema 및 Pagination Input 정의

Offset 입력과 응답 정보를 GraphQL 타입으로 정의합니다. 입력에는 `offset`과 `limit`을 넣고, 응답에는 게시글 목록과 전체 개수, 현재 페이지 정보를 넣습니다.  

```graphql
# /src/modules/post/post.schema.ts

# offset은 건너뛸 행 수이고 limit은 반환할 최대 행 수입니다.
input OffsetPaginationInput {
  offset: Int = 0
  limit: Int = 10
}

# 현재 조회 범위와 다음 페이지 존재 여부를 제공합니다.
type OffsetPageInfo {
  offset: Int!
  limit: Int!
  hasNextPage: Boolean!
}

# 게시글 목록과 전체 개수, 페이지 정보를 하나로 묶습니다.
type OffsetPostPage {
  items: [Post!]!
  totalCount: Int!
  pageInfo: OffsetPageInfo!
}
```

Pagination 입력을 생략하면 Service에서 기본값을 적용하여 첫 번째 게시글부터 10개를 가져옵니다.  
`items`는 현재 페이지의 게시글이고, `totalCount`는 필터 조건을 만족하는 전체 게시글 수입니다.  

```graphql
extend type Query {
  postsByOffset(
    pagination: OffsetPaginationInput
    filter: PostFilterInput
    sort: PostSortInput
  ): OffsetPostPage!
}
```

`filter`와 `sort`는 선택 사항입니다. 두 입력 타입은 3장에서 정의하고 Pagination과 연결합니다.  

### 🟦 Prisma `skip`, `take`를 이용한 목록 조회

Prisma에서는 `offset`과 `limit`을 각각 `skip`과 `take`로 표현합니다.  
Repository는 필터와 정렬 조건을 먼저 적용한 결과에서 `skip`만큼 건너뛴 뒤 `take`만큼 가져옵니다.  

```typescript
// /src/modules/post/post.repository.ts
findByOffset(
  filter: PostFilterInput,
  offset: number,
  take: number,
  sort: NormalizedPostSort,
) {
  return this.prisma.post.findMany({
    where: this.where(filter), // 조건을 만족하는 게시글만 남깁니다.
    skip: offset,// 앞에서 offset만큼 건너뜁니다.
    take, // 현재 페이지에 필요한 개수만 가져옵니다.
    orderBy: this.orderBy(sort), // 지정한 기준과 방향으로 결과를 정렬합니다.
  });
}
```

Pagination에서는 정렬 순서가 매번 같아야 합니다.  
실습 코드는 사용자가 선택한 필드로 먼저 정렬하고, 값이 같을 때는 고유한 `id`를 두 번째 기준으로 사용합니다.  

```typescript
// /src/modules/post/post.repository.ts
private orderBy(
  sort: NormalizedPostSort,
  reverse = false,
): Prisma.PostOrderByWithRelationInput[] {
  const fields = {
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
    TITLE: 'title',
  } as const;
  const requested = sort.direction.toLowerCase() as Prisma.SortOrder;
  const direction = reverse
    ? (requested === 'asc' ? 'desc' : 'asc')
    : requested;

  return [{ [fields[sort.field]]: direction }, { id: direction }];
}
```

### 🟦 Offset Pagination의 장단점

Offset 방식은 구조가 단순하고 페이지 번호를 사용하기 쉽습니다. `totalCount`와 `limit`을 이용하면 전체 페이지 수도 계산할 수 있습니다.  

```text
totalPages = ceil(totalCount / limit)
```

관리자 화면처럼 특정 페이지로 바로 이동하거나 전체 페이지 수를 보여 주는 목록에 잘 어울립니다.  

반면 Offset이 커질수록 데이터베이스가 앞쪽의 행을 더 많이 건너뛰어야 하므로 뒤쪽 페이지의 조회 비용이 커질 수 있습니다.  
페이지를 이동하는 사이에 데이터가 추가되거나 삭제되면 같은 게시글이 다시 나오거나 일부 게시글이 누락될 수도 있습니다.  

### 🟦 Offset GraphQL 요청과 응답 실습

다음 요청은 공개된 게시글을 최신 작성일 순으로 두 건씩 조회합니다. 첫 페이지이므로 `offset`은 `0`으로 지정합니다.  
![Offset요청 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-16.png)

`hasNextPage`가 `true`이므로 다음 요청에서는 `limit`은 그대로 두고 `offset`만 `2`로 변경합니다. 세 번째 페이지를 조회할 때는 `offset`을 `4`로 변경합니다.  

```json
{
  "pagination": {
    "offset": 2,
    "limit": 2
  }
}
```

무한 스크롤처럼 데이터를 순서대로 계속 불러오거나 목록이 자주 바뀌는 화면에는 Cursor 방식이 더 적합합니다.  

## 2. GraphQL Cursor Connections 기반 양방향 Pagination {#session-02}

### 🟦 Cursor Pagination과 GraphQL Cursor Connections 명세 이해

Cursor Pagination은 건너뛸 데이터 수 대신 현재 위치를 나타내는 Cursor를 사용합니다.  
클라이언트는 서버가 반환한 Cursor를 다음 요청에 그대로 전달하며, Cursor 내부 값을 직접 해석하거나 만들지 않습니다.  

```text
전방 조회: 현재 페이지의 endCursor를 다음 요청의 after에 전달합니다.
후방 조회: 현재 페이지의 startCursor를 이전 요청의 before에 전달합니다.
```

`GraphQL Cursor Connections Specification`은 Relay 프로젝트에서 정의한 명세로, Cursor 기반 목록을 일관된 구조로 표현하는 방법을 제시합니다.  
Relay를 사용하지 않는 GraphQL 서버에도 이 Connection 패턴을 적용할 수 있습니다.  
목록을 배열로 바로 반환하지 않고 `Connection`으로 감싸며, 각 항목은 `Edge`로 표현합니다.  
페이지 이동에 필요한 정보는 `PageInfo`에 담습니다.  

![GraphQL Cursor Connections 구조](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-1.png)

실습 API는 최신 글에서 오래된 글로 이동하는 전방 조회뿐만 아니라 이전 페이지로 돌아가는 후방 조회도 지원합니다.  

### 🟦 Connection, Edge, Node, PageInfo 구조와 네이밍

각 구성 요소의 역할은 다음과 같습니다.  

| 구성 요소 | 역할 | 실습 타입 |
| --- | --- | --- |
| `Connection` | 목록과 Pagination 메타데이터를 묶는 최상위 객체 | `PostConnection` |
| `Edge` | 한 항목과 해당 항목의 Cursor를 묶는 객체 | `PostEdge` |
| `Node` | 실제로 조회한 도메인 데이터 | `Post` |
| `PageInfo` | 앞뒤 페이지 존재 여부와 현재 페이지 경계 | `PageInfo` |

실습 Schema는 GraphQL Cursor Connections의 응답 구조를 기반으로 다음과 같이 정의합니다.  

```graphql
# /src/modules/post/post.schema.ts
# 각 Edge는 Node와 그 Node의 위치를 나타내는 Opaque Cursor를 함께 제공합니다.
type PostEdge {
  cursor: String!
  node: Post!
}
# Connection의 양방향 이동에 필요한 경계 정보입니다.
type PageInfo {
  hasNextPage: Boolean!       # 다음 페이지의 존재 여부
  hasPreviousPage: Boolean!   # 이전 페이지의 존재 여부
  startCursor: String         # 이전 페이지 조회 시 before에 전달할 Cursor
  endCursor: String           # 다음 페이지 조회 시 after에 전달할 Cursor
}
# GraphQL Cursor Connections 구조에 따라 게시글을 Edge 목록으로 반환합니다.
type PostConnection {
  edges: [PostEdge!]!
  totalCount: Int!
  pageInfo: PageInfo!
}
```

> Opaque Cursor는 클라이언트가 내부 구조를 해석하지 않고, 서버에서 받은 값을 다음 요청에 그대로 사용하는 커서입니다.

각 `PostEdge`는 게시글인 `node`와 그 게시글의 위치를 나타내는 `cursor`를 함께 제공합니다.  
`startCursor`와 `endCursor`는 현재 페이지의 첫 Edge와 마지막 Edge에 해당하는 Cursor입니다.  
결과가 비어 있으면 두 값은 `null`입니다.  

`hasNextPage`는 현재 정렬 순서에서 뒤쪽 페이지가 있는지를 나타내고, `hasPreviousPage`는 앞쪽 페이지가 있는지를 나타냅니다.  
`totalCount`는 GraphQL Cursor Connections 명세의 필수 필드는 아니지만, 실습에서는 필터를 만족하는 전체 게시글 수를 보여 주기 위해 추가했습니다.  

### 🟦 `first`, `after`, `last`, `before`를 이용한 양방향 조회

Cursor 입력에는 전방과 후방 Pagination에 필요한 네 필드를 정의합니다.  

```graphql
# first/after는 전방, last/before는 후방 페이지를 조회합니다.
input CursorPaginationInput {
  first: Int       # 조회 범위의 앞에서 반환할 게시글 수
  after: String    # 지정한 Cursor 다음 게시글부터 조회
  last: Int        # 조회 범위의 뒤에서 반환할 게시글 수
  before: String   # 지정한 Cursor 이전 게시글까지만 조회
}

extend type Query {
  postsByCursor(
    pagination: CursorPaginationInput
    filter: PostFilterInput
    sort: PostSortInput
  ): PostConnection!
}
```

| 방향 | 개수 | 기준 Cursor | 사용 예 |
| --- | --- | --- | --- |
| 전방 | `first` | `after` | `after` 다음에서 `first`개를 조회합니다. |
| 후방 | `last` | `before` | `before` 앞에서 `last`개를 조회합니다. |

![전방 페이지 조회 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-2.png)

### 🟦 양방향 GraphQL 요청과 응답 실습

앞에서 정의한 Query로 두 페이지를 이동한 뒤 다시 이전 페이지로 돌아가 보겠습니다. 예제는 게시글을 최신순으로 두 건씩 조회합니다.  

### 🔷 첫 페이지 전방 조회

첫 전방 페이지에는 기준 Cursor가 없습니다. 따라서 `first`만 사용하고 `$after`에는 `null`을 전달하거나 Variables에서 생략합니다.  

```graphql
query ForwardPosts($after: String) {
  postsByCursor(pagination: { first: 2, after: $after }) {
    edges {
      cursor
      node {
        id
        title
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

첫 요청의 GraphQL Variables는 다음과 같습니다.  

```json
{
  "after": null
}
```

응답의 `edges`에는 게시글과 각 게시글의 Cursor가 들어 있습니다. 실제 게시글 내용은 데이터베이스 상태에 따라 달라집니다.  

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "NQ",
          "node": { "id": "5", "title": "GraphQL Pagination 구현" }
        },
        {
          "cursor": "NA",
          "node": { "id": "4", "title": "GraphQL Filtering 구현" }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "NQ",
        "endCursor": "NA"
      }
    }
  }
}
```

### 🔷 다음 페이지 전방 조회

`hasNextPage`가 `true`이므로 다음 페이지를 조회할 수 있습니다. 첫 페이지의 마지막 위치인 `endCursor` 값 `NA`를 `$after`에 전달합니다.  

```json
{
  "after": "NA"
}
```

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "Mw",
          "node": { "id": "3", "title": "GraphQL Sorting 구현" }
        },
        {
          "cursor": "Mg",
          "node": { "id": "2", "title": "GraphQL Schema 작성" }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": true,
        "startCursor": "Mw",
        "endCursor": "Mg"
      }
    }
  }
}
```

두 번째 페이지에서는 게시글 `3`, `2`를 받았고 `hasPreviousPage`도 `true`가 되었습니다. 이제 현재 페이지의 첫 위치인 `startCursor` 값 `Mw`를 사용해 이전 페이지로 돌아갈 수 있습니다.  

### 🔷 이전 페이지 후방 조회

후방 조회는 `last`로 가져올 개수를 지정하고, 현재 페이지의 `startCursor`를 `before`에 전달합니다.  

```graphql
query BackwardPosts($before: String) {
  postsByCursor(pagination: { last: 2, before: $before }) {
    edges {
      cursor
      node {
        id
        title
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

GraphQL Variables에는 `startCursor` 값 `Mw`를 넣습니다.  

```json
{
  "before": "Mw"
}
```

후방 조회는 Cursor 앞쪽의 게시글을 가져옵니다. 응답은 전방 조회와 같은 최신순을 유지하므로 게시글 `5`, `4` 순서로 반환됩니다.  

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "NQ",
          "node": { "id": "5", "title": "GraphQL Pagination 구현" }
        },
        {
          "cursor": "NA",
          "node": { "id": "4", "title": "GraphQL Filtering 구현" }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "NQ",
        "endCursor": "NA"
      }
    }
  }
}
```

정리하면 다음 페이지로 이동할 때는 `endCursor → after`, 이전 페이지로 이동할 때는 `startCursor → before` 흐름을 사용합니다.  
실습 Service는 `first`와 `last`, `after`와 `before`처럼 서로 충돌하는 입력을 함께 전달하지 못하게 막습니다.  

### 🟦 Cursor 인코딩·디코딩 및 Prisma 조회 방식

실습 프로젝트의 Cursor는 게시글 ID를 Base64URL 문자열로 바꾼 값입니다.  
Base64URL은 암호화가 아니므로 민감한 정보를 숨기는 용도로 사용하면 안 됩니다.  

```typescript
// /src/modules/post/post.cursor.ts
export function encodeCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): number {
  // Buffer는 Node.js에서 바이너리 데이터(Byte 배열)를 저장하고 처리하기 위한 객체입니다.
  const id = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(id) || id < 1) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      '올바르지 않은 게시글 cursor입니다.',
    );
  }
  return id;
}
```

Repository는 전방 조회에서는 요청한 정렬 방향을 그대로 사용합니다.  
후방 조회에서는 정렬 방향을 반대로 바꾸어 Cursor 앞쪽의 데이터를 가까운 순서부터 가져온 뒤, 결과 배열을 다시 뒤집어 클라이언트가 항상 같은 정렬 순서를 받도록 합니다.  

```typescript
// /src/modules/post/post.repository.ts
async findByCursor(
  filter: PostFilterInput,
  cursorId: number | undefined,
  take: number,
  sort: NormalizedPostSort,
  backward: boolean,
) {
  const rows = await this.prisma.post.findMany({
    where: this.where(filter),
    ...(cursorId == null ? {} : { cursor: { id: cursorId }, skip: 1 }),
    take,
    orderBy: this.orderBy(sort, backward),
  });
  return backward ? rows.reverse() : rows;
}
```

Prisma의 `cursor`는 기준 게시글도 결과에 포함하므로 `skip: 1`로 해당 게시글을 제외합니다.  
첫 요청처럼 Cursor가 없으면 `cursor`와 `skip`을 모두 생략합니다.  

## 3. Input Type을 활용한 Filtering 및 Sorting {#session-03}

### 🟦 게시글 Filtering Input 정의

게시 여부, 작성자, 제목 검색어를 하나의 Input Type으로 묶습니다.  
각 필드는 선택 사항이며 여러 값을 함께 전달하면 모든 조건을 만족하는 게시글을 찾습니다.  

```graphql
input PostFilterInput {
  published: Boolean
  authorId: ID
  titleContains: String
}
```

다음 변수는 작성자 ID가 `2`이고 제목에 `GraphQL`이 포함된 공개 게시글을 조회한다는 의미입니다.  

```json
{
  "filter": {
    "published": true,
    "authorId": "2",
    "titleContains": "GraphQL"
  }
}
```

### 🟦 게시글 Sorting Input 및 Enum 정의

정렬 필드와 방향은 일반 문자열 대신 Enum으로 제한합니다.  
그러면 지원하지 않는 값이나 오타를 GraphQL 검증 단계에서 발견할 수 있습니다.  

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

정렬 입력을 생략하면 작성일과 ID를 기준으로 최신 게시글부터 조회합니다.  
Service를 GraphQL 외부에서 직접 호출할 때도 같은 기본값을 사용하도록 입력을 정규화합니다.  

```typescript
function normalizeSort(sort: PostSortInput = {}): NormalizedPostSort {
  return {
    field: sort.field ?? 'CREATED_AT',
    direction: sort.direction ?? 'DESC',
  };
}
```

### 🟦 Prisma `where`, `orderBy` 조건 구성

Repository의 `where()` 메서드는 값이 전달된 필터만 Prisma 조건으로 변환합니다.  

```typescript
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

`published`는 `false`도 유효한 검색 조건입니다. `if (filter.published)`처럼 검사하면 `false`가 빠지므로 `!= null`을 사용해 `null`과 `undefined`만 제외합니다.  

`orderBy()`는 GraphQL Enum을 Prisma 모델의 필드 이름으로 바꾸고 `id`를 보조 정렬 기준으로 추가합니다. 첫 번째 정렬 값이 같은 게시글도 `id`로 순서를 확정하므로 페이지 사이의 중복과 누락을 줄일 수 있습니다.  

### 🟦 Pagination과 Filtering·Sorting 연계

목록 조회는 다음 순서로 이해할 수 있습니다.  

```text
전체 게시글
  → where로 필요한 게시글만 남깁니다.
  → orderBy로 결과 순서를 정합니다.
  → skip·take 또는 cursor·take로 현재 페이지를 가져옵니다.
```

목록과 `totalCount`에는 같은 Filter를 적용해야 합니다. 실습 Repository는 `findByOffset()`, `findByCursor()`, `count()`에서 같은 `where()`를 사용합니다.  

Cursor도 현재 필터 결과에 실제로 포함되는지 검사합니다. 필터에 포함되지 않는 게시글의 Cursor를 전달하면 잘못된 페이지 경계가 될 수 있으므로 Service에서 요청을 거절합니다.  

```typescript
async contains(filter: PostFilterInput, id: number) {
  return (await this.prisma.post.count({
    where: { AND: [this.where(filter), { id }] },
  })) === 1;
}
```

정렬을 바꾸면 Cursor가 가리키는 위치의 의미도 달라집니다. 사용자가 정렬 기준을 변경할 때는 기존 Cursor를 버리고 첫 페이지부터 다시 요청해야 합니다.  

## 4. 게시글 목록 조회 API 구현 및 실습 {#session-04}

### 🟦 Resolver → Service → Repository 처리 흐름

게시글 목록 요청은 Resolver, Service, Repository 순서로 처리합니다.  

```text
GraphQL Query
  → Post Resolver: 인자와 Context를 Service에 전달합니다.
    → Post Service: 기본값 적용, 입력 검증, 응답 조립을 담당합니다.
      → Post Repository: Prisma 조회 조건을 구성하고 실행합니다.
        → SQLite
```

Resolver에서는 Offset과 Cursor 요청 인자를 직접 처리하지 않고 해당 Service 메서드로 전달합니다.  

```typescript
// /src/modules/post/post.resolver.ts
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
```

Service는 입력값의 범위와 조합을 검증하고 Repository 결과를 GraphQL 응답 형태로 조립합니다. Repository는 필터, 정렬, 페이지 경계를 Prisma 쿼리로 변환합니다.  

### 🟦 Offset 기반 목록 조회 API 구현

Offset Service는 페이지와 정렬 기본값을 적용한 뒤 게시글 목록과 전체 개수를 병렬로 조회합니다.  

```typescript
// /src/modules/post/post.service.ts
async listByOffset(args: OffsetPostQueryArgs = {}) {
  const filter = args.filter ?? {};
  this.validateFilter(filter);

  const offset = args.pagination?.offset ?? 0;
  const limit = pageSize(args.pagination?.limit);
  const sort = normalizeSort(args.sort ?? {});

  if (!Number.isInteger(offset) || offset < 0) {
    validationError('offset은 0 이상의 정수여야 합니다.');
  }

  const [items, totalCount] = await Promise.all([
    this.posts.findByOffset(filter, offset, limit, sort),
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

`offset + items.length`가 `totalCount`보다 작으면 아직 조회하지 않은 게시글이 있으므로 `hasNextPage`는 `true`가 됩니다.  

### 🟦 GraphQL Cursor Connections 기반 양방향 조회 API 구현

Cursor Service는 `last`나 `before`가 있으면 후방 조회로 판단합니다. 요청한 페이지 크기보다 한 건 더 조회해 이동하려는 방향에 데이터가 더 있는지 확인하고, 게시글마다 `Edge`를 만듭니다.  

```typescript
// /src/modules/post/post.service.ts
async listByCursor(args: CursorPostQueryArgs = {}) {
  // 선택 입력을 빈 객체로 바꿔 이후 로직에서 null과 undefined를 반복해서 확인하지 않습니다.
  const filter = args.filter ?? {};
  this.validateFilter(filter);
  const pagination = args.pagination ?? {};
  const sort = normalizeSort(args.sort ?? {});

  // last나 before가 있으면 이전 페이지를 찾는 후방 조회로 판단합니다.
  // 아무 인자도 없으면 기본 크기 10을 사용하는 전방 첫 페이지를 조회합니다.
  const backward = pagination.last != null || pagination.before != null;

  // 한 요청에는 전방 조회 인자 또는 후방 조회 인자 중 한 방향만 사용할 수 있습니다.
  if (pagination.first != null && pagination.last != null) validationError('first와 last는 함께 사용할 수 없습니다.');
  if (pagination.after != null && pagination.before != null) validationError('after와 before는 함께 사용할 수 없습니다.');
  if (pagination.after != null && backward) validationError('after는 first와 함께 사용해야 합니다.');
  if (pagination.before != null && pagination.first != null) validationError('before는 last와 함께 사용해야 합니다.');

  // 조회 방향에 따라 개수와 경계 Cursor를 각각 first/after 또는 last/before에서 가져옵니다.
  const size = pageSize(backward ? pagination.last : pagination.first);
  const rawCursor = backward ? pagination.before : pagination.after;
  // 정렬을 바꾸는 UI는 이전 Cursor를 버리고 첫 페이지부터 다시 요청해야 합니다.
  const cursorId = rawCursor == null ? undefined : decodeCursor(rawCursor);

  // 삭제됐거나 현재 필터 결과에 없는 게시글은 페이지 경계로 사용할 수 없습니다.
  if (cursorId != null && !(await this.posts.contains(filter, cursorId))) {
    validationError('cursor가 현재 게시글 검색 조건에 포함되지 않습니다.');
  }

  // 한 건을 더 읽어 조회 방향 반대편에 페이지가 남았는지 추가 count 없이 판별합니다.
  const rows = await this.posts.findByCursor(filter, cursorId, size + 1, sort, backward);
  const hasExtra = rows.length > size;

  // Repository는 항상 요청한 정렬 순서로 반환합니다. 후방 조회에서는 앞쪽 초과 행을 제거합니다.
  const items = backward ? rows.slice(-size) : rows.slice(0, size);

  // Edge는 게시글 Node와 그 게시글을 다시 경계로 사용할 Cursor를 묶습니다.
  const edges = items.map((node) => ({ node, cursor: encodeCursor(node.id) }));

  // totalCount는 현재 페이지 크기가 아니라 필터를 만족하는 전체 게시글 수입니다.
  const totalCount = await this.posts.count(filter);

  return {
    edges,
    totalCount,
    pageInfo: {
      // 후방 조회에서는 before가 가리킨 행이 다음 페이지에 있고, 전방 조회에서는 초과 행으로 판단합니다.
      hasNextPage: backward ? cursorId != null : hasExtra,
      // 전방 조회에서는 after 앞에 이전 페이지가 있고, 후방 조회에서는 초과 행으로 판단합니다.
      hasPreviousPage: backward ? hasExtra : cursorId != null,
      // 결과가 비어 있으면 사용할 경계가 없으므로 Cursor는 null입니다.
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
  };
}
```

### 🟦 Filtering 및 Sorting 적용과 동작 확인

![예시 화면](/assets/images/nodejs/nodejs-graphql/image-2026-10-16-3.png)  
다음 Query는 Pagination, Filtering, Sorting 조건을 모두 Variables로 받습니다. 같은 Query를 사용하고 `pagination`만 바꾸면 전방과 후방을 모두 조회할 수 있습니다.  

```graphql
query GetPosts(
  $pagination: CursorPaginationInput
  $filter: PostFilterInput
  $sort: PostSortInput
) {
  postsByCursor(
    pagination: $pagination
    filter: $filter
    sort: $sort
  ) {
    edges {
      cursor
      node {
        id
        title
        published
      }
    }
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

### 🔷 첫 페이지 전방 조회

공개된 게시글 중 제목에 `GraphQL`이 포함된 글을 제목 오름차순으로 두 건 조회합니다. 첫 페이지에는 기준 Cursor가 없으므로 `first`만 전달합니다.  

```json
{
  "pagination": {
    "first": 2
  },
  "filter": {
    "published": true,
    "titleContains": "GraphQL"
  },
  "sort": {
    "field": "TITLE",
    "direction": "ASC"
  }
}
```

조건을 만족하는 게시글이 네 건이라면 첫 페이지에서 제목이 앞선 두 건을 반환합니다. 실제 ID와 제목은 데이터베이스 내용에 따라 달라집니다.  

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "NA",
          "node": {
            "id": "4",
            "title": "GraphQL Filtering",
            "published": true
          }
        },
        {
          "cursor": "NQ",
          "node": {
            "id": "5",
            "title": "GraphQL Pagination",
            "published": true
          }
        }
      ],
      "totalCount": 4,
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "NA",
        "endCursor": "NQ"
      }
    }
  }
}
```

응답에는 `published: true`이고 제목에 `GraphQL`이 포함된 게시글만 있습니다. 제목은 `Filtering → Pagination` 순서로 정렬됩니다.  

### 🔷 다음 페이지 전방 조회

`hasNextPage`가 `true`이므로 첫 페이지의 `endCursor` 값 `NQ`를 `after`에 전달합니다. 페이지를 이동해도 Filter와 Sort는 이전 요청과 같게 유지합니다.  

```json
{
  "pagination": {
    "first": 2,
    "after": "NQ"
  },
  "filter": {
    "published": true,
    "titleContains": "GraphQL"
  },
  "sort": {
    "field": "TITLE",
    "direction": "ASC"
  }
}
```

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "Mg",
          "node": {
            "id": "2",
            "title": "GraphQL Schema",
            "published": true
          }
        },
        {
          "cursor": "Mw",
          "node": {
            "id": "3",
            "title": "GraphQL Sorting",
            "published": true
          }
        }
      ],
      "totalCount": 4,
      "pageInfo": {
        "hasNextPage": false,
        "hasPreviousPage": true,
        "startCursor": "Mg",
        "endCursor": "Mw"
      }
    }
  }
}
```

두 번째 페이지는 마지막 페이지이므로 `hasNextPage`는 `false`입니다. 앞쪽에는 첫 페이지가 있으므로 `hasPreviousPage`는 `true`입니다.  

### 🔷 이전 페이지 후방 조회

이전 페이지로 돌아갈 때는 현재 페이지의 `startCursor` 값 `Mg`를 `before`에 전달하고 `last`로 가져올 개수를 지정합니다. Filter와 Sort는 전방 조회와 동일하게 유지합니다.  

```json
{
  "pagination": {
    "last": 2,
    "before": "Mg"
  },
  "filter": {
    "published": true,
    "titleContains": "GraphQL"
  },
  "sort": {
    "field": "TITLE",
    "direction": "ASC"
  }
}
```

```json
{
  "data": {
    "postsByCursor": {
      "edges": [
        {
          "cursor": "NA",
          "node": {
            "id": "4",
            "title": "GraphQL Filtering",
            "published": true
          }
        },
        {
          "cursor": "NQ",
          "node": {
            "id": "5",
            "title": "GraphQL Pagination",
            "published": true
          }
        }
      ],
      "totalCount": 4,
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "NA",
        "endCursor": "NQ"
      }
    }
  }
}
```

후방 조회 결과도 제목 오름차순을 유지합니다. 페이지 방향만 바뀌며 Filtering과 Sorting 조건은 바뀌지 않습니다.  
