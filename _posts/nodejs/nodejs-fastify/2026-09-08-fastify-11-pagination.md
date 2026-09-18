---
layout: post
title: "[Fastify] 11. Offset·Prisma Cursor·Keyset 페이징 이해와 구현"
description: "Fastify 게시글 API의 실제 코드를 바탕으로 Offset·Prisma Cursor·Keyset 구현의 개념과 동작 흐름을 설명합니다. 요청·응답, 복합 정렬, 글 추가·삭제 시뮬레이션을 통해 각 방식의 차이를 이해합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 11
ai_assisted: true
toc:
  - id: session-01
    title: "1. 페이징 방식과 공통 구조"
  - id: session-02
    title: "2. Offset: 페이지 번호 기반 조회"
  - id: session-03
    title: "3. Prisma Cursor: 기준 글 이후 조회"
  - id: session-04
    title: "4. Keyset: 정렬 값 기반 범위 조회"
  - id: session-05
    title: "5. 데이터 변경 시뮬레이션"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 페이징 방식과 공통 구조 {#session-01}

게시글이 수만 개라면 모든 글을 한 번에 내려받기보다 화면에 필요한 만큼 나누어 읽는 편이 좋습니다. 이렇게 목록을 일정 크기로 나누어 조회하는 것이 페이징입니다.  

세 방식은 다음 페이지를 어디서부터 읽을지 정하는 방법이 다릅니다.  

| 방식 | 시작점 표현 | 핵심 구현 |
| --- | --- | --- |
| Offset | `page`로 계산한 `offset` | `skip`, `take` |
| Prisma Cursor | 기준 레코드의 unique 값 | `cursor`, `skip: 1`, `take` |
| Keyset | 마지막 레코드의 정렬 경계 값 | `WHERE id < ...` 또는 복합 범위 조건 |

cursor는 다음 조회를 이어 갈 위치를 나타내는 값입니다. 이 글에서는 일반적인 cursor pagination 전체를 뜻하지 않고, 현재 코드의 세 구현을 비교합니다.  

Prisma의 `cursor` 옵션을 사용하는 구현은 Prisma Cursor라고 부르겠습니다. `where`에 정렬 값의 범위를 직접 지정하는 구현은 Keyset이라고 부르겠습니다. 이렇게 구분하면 Prisma 기능을 이용한 구현과 직접 범위 조건을 만드는 구현의 차이가 분명해집니다.  

### 🟦 방식별 흐름 비교

| 비교 항목 | Offset | Prisma Cursor | Keyset |
| --- | --- | --- | --- |
| 어울리는 화면 | 페이지 번호가 있는 게시판 | 더 보기·무한 스크롤 | 더 보기·무한 스크롤 |
| 다음 위치 | 페이지 번호로 계산한 offset | 기준 글 ID | 기준 정렬 값 |
| 중간 페이지 이동 | 번호로 바로 요청 가능 | 해당 위치의 cursor 필요 | 해당 위치의 경계 값 필요 |
| 전체 건수 | `count()`로 반환 | 반환하지 않음 | 반환하지 않음 |
| 응답 nextCursor | 없음 | 숫자 또는 `null` | 객체 또는 `null` |
| 생성 시각 정렬의 요청 | `page` | `cursor` | `cursorId` + `cursorCreatedAt` |

Offset은 페이지 번호를 다루기 쉽고 전체 페이지 수를 보여 주기 좋습니다. 대신 뒤쪽 페이지로 갈수록 건너뛸 글이 많아지고, 페이지를 읽는 사이에 글이 추가되거나 삭제되면 목록의 위치가 달라질 수 있습니다.  

Prisma Cursor는 앞 페이지의 마지막 글을 기준으로 이어 읽기 때문에 더 보기 화면에 잘 맞습니다. 현재 구현은 Prisma의 `cursor` 옵션으로 기준 글을 찾으므로, 기준 글이 DB에 남아 있어야 다음 위치를 찾을 수 있습니다.  

Keyset은 기준 글을 다시 찾지 않고 요청으로 받은 정렬 값을 비교해 다음 범위를 조회합니다. 이 방식도 매번 현재 DB를 조회하므로 첫 요청 시점의 목록을 고정하지는 않습니다. 실제 속도는 데이터 양·인덱스·검색 조건·관계 조회 비용에 따라 달라집니다. 현재 `Post` 모델에는 ID 기본 키와 `authorId` 인덱스가 있으며 `(createdAt, id)` 복합 인덱스는 없습니다. 데이터가 많을 때의 생성 시각 정렬 성능은 실행 계획과 실제 조회 시간을 함께 확인해야 합니다.  

다음 페이지도 같은 사용자로 요청하고, `orderBy`, `keyword`, `authorId`, `published` 값을 유지합니다. 검색어나 정렬을 바꿨다면 Offset은 `page=1`로, Prisma Cursor와 Keyset은 경계를 생략한 첫 요청으로 다시 시작합니다.  

### 🟦 공통 요청 처리 흐름

```text
클라이언트: 필터 + 정렬 기준 + 페이지 위치 전송
    ↓
Route / Schema: 요청 형식 검증, authenticate로 인증 확인
    ↓
Controller: 인증 사용자와 쿼리를 Service에 전달
    ↓
Service: 기본값 적용, 페이지 위치 변환·검증
    ↓
Repository: 공개 범위 + 검색 조건 + 정렬 + 페이징으로 DB 조회
    ↓
Service: 전체 페이지 수 또는 nextCursor 계산
    ↓
Controller: Date를 ISO 문자열로 변환하여 HTTP 200 응답
```

세 목록 API 모두 인증이 필요하므로 공개 글만 조회해도 Access Token을 전달합니다.  

### 🟦 공통 필터와 정렬

| 쿼리 파라미터 | 의미 | 기본값·허용 범위 |
| --- | --- | --- |
| `limit` | 한 번에 반환할 최대 글 수 | 기본 20, 1~100의 정수 |
| `orderBy` | 정렬 기준 | `id` 또는 `createdAt`, 기본 `id` |
| `authorId` | 특정 작성자의 글로 제한 | 선택, 1 이상의 정수 |
| `published` | 공개 또는 비공개 글로 제한 | 선택, `true` 또는 `false` |
| `keyword` | 제목 또는 본문에 포함된 문자열 검색 | 선택, 1~100자, Service에서 앞뒤 공백 제거 |

정렬 방향은 내림차순으로 고정되어 있습니다. `orderBy=id`는 ID가 큰 글부터, `orderBy=createdAt`은 최근에 생성된 글부터 조회합니다. 생성 시각이 같으면 ID가 큰 글을 먼저 배치합니다.  

```typescript
// post.repository.ts: 모든 페이징 방식이 같은 정렬 함수를 사용합니다.
function postListOrderBy(
  orderBy: PostListFilter['orderBy'],
): Prisma.PostOrderByWithRelationInput[] {
  return orderBy === PostOrderBy.CREATED_AT
    // 같은 생성 시각에도 순서가 하나로 정해지도록 ID를 보조 기준으로 사용합니다.
    ? [{ createdAt: 'desc' }, { id: 'desc' }]
    : [{ id: 'desc' }];
}
```

조회 가능한 글의 범위는 다음과 같습니다.  

| `published` | 일반 사용자 | 관리자 |
| --- | --- | --- |
| 생략 | 모든 공개 글 + 자신의 비공개 글 | 모든 글 |
| `true` | 모든 공개 글 | 모든 공개 글 |
| `false` | 자신의 비공개 글 | 모든 비공개 글 |

`postListWhere()`는 사용자가 볼 수 있는 글의 범위에 작성자와 검색어 조건을 더합니다. `AND`로 묶인 조건은 모두 만족해야 합니다. 다른 작성자의 ID를 지정해도 그 사람의 비공개 글을 볼 권한이 생기지는 않습니다. 이 조건에 맞는 글을 모은 뒤 페이지 단위로 나누어 조회합니다.  

### 🟦 공통 예시 데이터

먼저 조건에 맞는 글 일곱 개를 ID 내림차순으로 조회한다고 가정합니다.  

```text
정렬된 목록: [107, 106, 105, 104, 103, 102, 101]
limit: 3
목표: [107, 106, 105] → [104, 103, 102] → [101]
```

이 목록이 바뀌지 않는 상태에서 세 방식의 페이지 이동을 비교합니다. 같은 글을 같은 순서로 반환하더라도, 다음 요청에 보내는 값과 DB에서 시작점을 찾는 방법은 서로 다릅니다.  

## 2. Offset: 페이지 번호 기반 조회 {#session-02}

Offset은 정렬된 목록에서 앞의 글을 정해진 개수만큼 건너뛰고 한 페이지를 가져옵니다. 페이지 번호가 있는 게시판에서 “2페이지를 보여 주세요”라는 요청을 처리하기 쉽습니다.  

### 🟦 Offset 방식 동작 흐름

페이지 번호는 1부터 시작하므로 건너뛸 개수는 다음과 같습니다.  

```text
offset = (page - 1) × limit

page=2, limit=3
    ↓
offset=(2-1)×3=3
    ↓
[107, 106, 105] [104, 103, 102] [101]
 └─ 건너뛰기 ─┘  └─ 반환하기 ─┘
    ↓
동일한 조건의 전체 글 수: total=7
전체 페이지 수: ceil(7/3)=3
```

![흰색 배경의 Offset 삽화: page=2, limit=3이면 앞의 107·106·105를 건너뛰고 104·103·102를 반환합니다. 전체 7건을 3개씩 나누면 총 3페이지입니다.](/assets/images/nodejs/nodejs-fastify/fastify-offset-skip-take.png)

회색 글 세 개는 `skip: 3`으로 건너뛰고, 파란색 글 세 개는 `take: 3`으로 가져옵니다. 마지막 글 101은 이번 페이지에 포함되지 않습니다. 전체 글 수 7을 페이지 크기 3으로 나누고 올림하면 총 3페이지입니다.  

### 🟦 구현: Service에서 page를 offset으로 변환

Service는 `offset`을 `PostOffsetListFilter` 객체에 담아 Repository로 전달합니다. `toPostListFilter()`는 인증된 사용자의 정보와 검색 조건을 모으는 공통 함수입니다. `limit`과 `orderBy`를 생략했다면 각각 20과 `id`를 기본값으로 사용합니다.  

```typescript
// post.service.ts: 페이지 번호를 DB가 사용할 건너뛸 개수로 바꿉니다.
async listByOffset(
  actor: AuthActor,
  query: PostOffsetListQueryDto,
): Promise<PostOffsetListResult> {
  const page = query.page ?? 1;
  const common = toPostListFilter(actor, query);
  const filter: PostOffsetListFilter = {
    ...common,
    offset: (page - 1) * common.limit,
  };
  const result = await this.postRepository.findManyByOffset(filter);

  return {
    items: result.items,
    page,
    limit: filter.limit,
    total: result.total,
    // 마지막 페이지가 덜 차더라도 한 페이지로 계산합니다.
    totalPages: Math.ceil(result.total / filter.limit),
  };
}
```

### 🟦 구현: Repository에서 skip·take와 count 사용

```typescript
// post.repository.ts의 findManyByOffset() 내부입니다.
// 목록과 전체 건수에 동일한 검색·공개 범위를 적용합니다.
const where = postListWhere(filter);
const [posts, total] = await this.prisma.$transaction([
  this.prisma.post.findMany({
    where,
    orderBy: postListOrderBy(filter.orderBy),
    skip: filter.offset, // 앞의 offset개를 건너뜁니다.
    take: filter.limit, // 이번 페이지에 필요한 개수만 가져옵니다.
    select: postSelect(filter.actor.userId),
  }),
  // 페이지 제한 없이 조건에 맞는 전체 글 수를 셉니다.
  this.prisma.post.count({ where }),
]);

return { items: posts.map((post) => toPostResult(post)), total };
```

`postSelect()`는 게시글·작성자·좋아요 정보를 선택하고, `toPostResult()`는 조회 결과를 Service에서 사용할 게시글 객체로 바꿉니다. 페이징의 핵심 옵션은 `skip`과 `take`입니다. 이 옵션의 기본 동작은 [Prisma의 페이징 문서](https://www.prisma.io/docs/orm/v7/prisma-client/queries/pagination)에서도 확인할 수 있습니다.  

글 목록을 가져오는 작업과 전체 글 수를 세는 작업은 하나의 트랜잭션으로 묶어 처리합니다. 이 처리는 한 요청 안에서만 적용됩니다. 다음 페이지를 요청하면 그때의 DB 상태를 기준으로 다시 조회합니다.  

### 🟦 Offset 방식 요청·결과 시나리오

```bash
# 로그인에서 받은 실제 Access Token으로 교체합니다.
ACCESS_TOKEN='로그인으로_받은_Access_Token'

# 세 개씩 나눈 목록의 두 번째 페이지를 요청합니다.
curl 'http://localhost:3000/api/posts/offset?page=2&limit=3&orderBy=id' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

응답 예시에서는 페이지 정보를 쉽게 볼 수 있도록 `items`에 각 글의 ID만 표시합니다. 이후 JSON 예시에서도 나머지 게시글 필드는 생략합니다.  

```json
{
  "items": [{ "id": 104 }, { "id": 103 }, { "id": 102 }],
  "page": 2,
  "limit": 3,
  "total": 7,
  "totalPages": 3
}
```

같은 목록을 첫 페이지부터 차례로 조회하면 다음과 같습니다. 요청 경로는 모두 `/api/posts/offset`입니다.  

| 요청 쿼리 | skip | 응답 ID | page | total | totalPages |
| --- | --- | --- | --- | --- | --- |
| `page=1&limit=3` | 0 | `[107,106,105]` | 1 | 7 | 3 |
| `page=2&limit=3` | 3 | `[104,103,102]` | 2 | 7 | 3 |
| `page=3&limit=3` | 6 | `[101]` | 3 | 7 | 3 |
| `page=4&limit=3` | 9 | `[]` | 4 | 7 | 3 |

범위를 벗어난 4페이지를 요청해도 서버는 3페이지로 바꾸지 않습니다. 요청한 `page=4`와 빈 배열을 반환합니다. 검색 결과 자체가 없으면 `total=0`, `totalPages=0`입니다.  

Offset은 중간 페이지로 바로 이동하기 편리합니다. 다만 뒤쪽 페이지일수록 건너뛸 글 수가 늘어나고, 페이지 사이에 글이 추가·삭제되면 글의 위치도 바뀝니다.  

## 3. Prisma Cursor: 기준 글 이후 조회 {#session-03}

이 API의 Prisma Cursor 방식은 “이 글까지 읽었으니 그다음부터 주세요”라는 요청을 처리합니다. 클라이언트는 이전 응답의 `nextCursor`를 다음 요청의 `cursor`로 전달합니다. 값은 게시글 ID인 숫자입니다.  

### 🟦 Prisma Cursor 방식 동작 흐름

아래 삽화는 `cursor=105&limit=3`으로 다음 페이지를 요청한 ID 내림차순 예시입니다. 주황색 책갈피가 기준 글 105를 가리키고, 파란색 글 104·103·102가 이번 응답에 포함됩니다.  

![흰색 배경의 Prisma Cursor 삽화: ID 내림차순 목록에서 기준 글 105를 제외하고 104·103·102를 반환합니다. 101은 다음 페이지 확인용이며 nextCursor는 102입니다.](/assets/images/nodejs/nodejs-fastify/fastify-cursor-bookmark.png)

다음 요청의 책갈피는 마지막으로 반환한 글인 102로 옮깁니다. 101은 다음 페이지가 있는지 확인하려고 읽은 글이므로 이번 응답의 `nextCursor`로 사용하지 않습니다.  

```text
첫 요청: cursor 생략
    ↓
최대 4개 조회: [107, 106, 105, 104]
응답 3개:     [107, 106, 105] / nextCursor=105
    ↓
다음 요청: cursor=105
    ↓
Prisma cursor로 기준 글 105 지정 → skip: 1로 기준 글 제외
    ↓
최대 4개 조회: [104, 103, 102, 101]
응답 3개:     [104, 103, 102] / nextCursor=102
```

`limit=3`인데 네 개를 읽는 이유는 다음 페이지가 있는지 확인하기 위해서입니다. 네 번째 글은 이번 응답에 넣지 않습니다. 다음 cursor에는 실제로 반환한 마지막 글, 즉 세 번째 글의 ID를 넣습니다.  

### 🟦 Prisma cursor의 고유 값 조건

Prisma의 `cursor`에는 기준 글 하나를 구분할 수 있는 고유한 값이 필요합니다. 기본 키뿐 아니라 `@unique` 필드도 사용할 수 있지만, 현재 API는 기본 키인 게시글 `id`만 받습니다.  

따라서 `cursor=105`는 ID가 105인 글을 기준으로 조회한다는 뜻입니다. `createdAt`은 같은 값이 여러 글에 저장될 수 있고 고유 제약도 없어, 현재 모델에서는 단독으로 cursor에 사용할 수 없습니다.  

### 🟦 기준 글과 정렬 순서

책을 읽다가 꽂아 둔 책갈피를 떠올리면 이해하기 쉽습니다. `cursor`는 책갈피를 꽂은 기준 글을 가리키고, `orderBy`는 글을 읽는 순서를 정합니다.  

```typescript
// 기준 글은 ID로 찾고, 이어 읽을 순서는 생성 시각과 ID로 정합니다.
const posts = await prisma.post.findMany({
  cursor: { id: 105 },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  skip: 1, // 기준 글은 이미 읽었으므로 제외합니다.
  take: 4, // 세 개를 반환하고 다음 페이지를 확인할 한 개를 추가로 읽습니다.
});
```

이 코드는 두 옵션의 역할만 보여 주는 예시이며, 실제 Repository는 검색 조건과 사용자가 볼 수 있는 글의 범위도 적용하고, 응답에 필요한 필드를 선택합니다. ID 105는 기준 글을 찾는 값이고, 이어서 조회할 글은 기준 글보다 먼저 생성되었거나, 같은 시각에 생성되었으면서 ID가 더 작은 글입니다. 따라서 cursor의 필드가 첫 번째 정렬 필드와 반드시 같아야 하는 것은 아닙니다.  

### 🟦 구현: Prisma의 cursor와 skip: 1

`listByCursor()`는 공통 필터에 `query.cursor`를 넣어 `PostCursorListFilter`를 만듭니다. Repository의 핵심 쿼리는 다음과 같습니다.  

```typescript
// post.repository.ts의 findManyByCursor() 내부 쿼리입니다.
this.prisma.post.findMany({
  where: postListWhere(filter),
  orderBy: postListOrderBy(filter.orderBy),
  take: filter.limit + 1, // 다음 페이지 확인용으로 한 건 더 읽습니다.
  ...(filter.cursor === undefined
    ? {} // 첫 요청에서는 cursor와 skip을 모두 생략합니다.
    : {
        cursor: { id: filter.cursor }, // 이어 읽을 기준 글을 지정합니다.
        skip: 1, // 이미 반환한 기준 글은 제외합니다.
      }),
  select: postSelect(filter.actor.userId),
});
```

여기서 `skip: 1`은 Offset처럼 앞 페이지의 글 수만큼 건너뛰는 의미가 아닙니다. cursor로 지정한 기준 글 한 개를 제외합니다.  

### 🟦 구현: 응답과 nextCursor 계산

```typescript
// post.service.ts: Repository가 반환한 추가 한 건으로 다음 페이지를 판단합니다.
function toCursorListResult(posts: PostResult[], limit: number): PostCursorListResult {
  const hasNextPage = posts.length > limit;
  const items = hasNextPage ? posts.slice(0, limit) : posts;

  return {
    items,
    // 마지막 반환 글의 ID를 전달하고, 더 읽을 글이 없으면 null로 종료합니다.
    nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
  };
}
```

남은 글이 정확히 `limit`개라면 모두 반환하고 `nextCursor=null`이 됩니다. 화면이 꽉 찼다는 사실만으로 다음 페이지가 있다고 판단하지 않습니다.  

### 🟦 Prisma Cursor 방식 요청·결과 시나리오

```bash
# 첫 페이지는 cursor를 생략합니다.
curl 'http://localhost:3000/api/posts/cursor?limit=3&orderBy=id' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```json
{
  "items": [{ "id": 107 }, { "id": 106 }, { "id": 105 }],
  "nextCursor": 105
}
```

다음 요청에는 받은 `105`를 그대로 전달합니다.  

```bash
# 앞 페이지의 마지막 글 다음부터 이어서 읽습니다.
curl 'http://localhost:3000/api/posts/cursor?limit=3&orderBy=id&cursor=105' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```json
{
  "items": [{ "id": 104 }, { "id": 103 }, { "id": 102 }],
  "nextCursor": 102
}
```

요청 경로를 `/api/posts/cursor`로 고정하고 끝까지 조회하면 다음과 같습니다.  

| 요청 쿼리 | DB에서 읽는 ID | 응답 ID | nextCursor |
| --- | --- | --- | --- |
| `limit=3` | `[107,106,105,104]` | `[107,106,105]` | `105` |
| `limit=3&cursor=105` | `[104,103,102,101]` | `[104,103,102]` | `102` |
| `limit=3&cursor=102` | `[101]` | `[101]` | `null` |

`nextCursor=null`이면 더 보기 요청을 중단합니다. `cursor`를 생략해서 다시 요청하면 첫 페이지로 돌아갑니다. 저장된 글이 없거나 조회 조건에 맞는 글이 없어도 `items=[]`, `nextCursor=null`입니다.  

## 4. Keyset: 정렬 값 기반 범위 조회 {#session-04}

Keyset은 이전 페이지의 마지막 글에서 정렬에 사용한 값을 받아 다음 조회 범위를 정합니다. ID 내림차순에서 마지막 ID가 105라면 `id < 105`인 글을 가져옵니다. 생성 시각 정렬이면 생성 시각과 ID를 함께 비교합니다.  

현재 구현은 다음 요청에 필요한 정렬 값을 `nextCursor` 객체로 반환합니다. 클라이언트가 이 값을 다시 보내므로 Repository는 기준 글을 따로 찾지 않습니다.  

서버는 먼저 전달받은 경계 값이 올바른지 확인하고 조회 조건을 만듭니다. 그 조건으로 최대 `limit + 1`개를 읽은 뒤, 최대 `limit`개만 응답에 담습니다. 다음 페이지가 있으면 마지막으로 반환한 글의 정렬 값을 `nextCursor`에 넣고, 없으면 `null`을 반환합니다.  

먼저 ID 하나로 범위를 정하는 경우를 살펴보고, 이어서 생성 시각과 ID를 함께 비교하는 경우를 살펴보겠습니다.  

### 🟦 요청·응답의 경계 값

| 정렬 | 첫 요청 | 응답 nextCursor 예시 | 다음 요청에 추가할 쿼리 |
| --- | --- | --- | --- |
| `id` | 경계 생략 | `{"id":105}` | `cursorId=105` |
| `createdAt` | 경계 둘 다 생략 | `{"id":204,"createdAt":"2026-09-08T10:02:00.000Z"}` | `cursorId=204`와 `cursorCreatedAt=응답의 시각` |
| 마지막 페이지 | 정렬과 무관 | `null` | 요청 종료 |

Prisma Cursor API는 숫자 `nextCursor`를 `cursor`에 넣습니다. Keyset API는 객체의 `id`를 `cursorId`에, `createdAt`이 있으면 이를 `cursorCreatedAt`에 넣습니다. 두 API의 요청 형식을 구분해야 합니다.  

### 🟦 ID 정렬: 동작과 구현

```text
첫 요청: /api/posts/keyset?limit=3
    ↓
cursorId 없음 → 검색·공개 범위만 적용
    ↓
ID 내림차순으로 4개 읽기 → 3개 반환 / nextCursor={id:105}
    ↓
다음 요청: /api/posts/keyset?limit=3&cursorId=105
    ↓
검색·공개 범위 AND id < 105
    ↓
[104,103,102,101] 읽기 → [104,103,102] 반환 / nextCursor={id:102}
```

다음은 `cursorId=105`를 받았을 때 원본 코드가 만드는 조회 조건을 풀어 쓴 예시입니다.  

```typescript
// ID 내림차순에서는 기준 ID보다 작은 글이 다음 목록입니다.
const posts = await prisma.post.findMany({
  where: {
    AND: [
      postListWhere(filter), // 다음 페이지에서도 검색·공개 범위를 유지합니다.
      { id: { lt: 105 } }, // lt는 미만이며, 기준 글 자체도 제외합니다.
    ],
  },
  orderBy: [{ id: 'desc' }],
  take: filter.limit + 1,
  select: postSelect(filter.actor.userId),
});
```

첫 페이지에서는 ID 범위 조건을 생략합니다. 다음 페이지에서는 `where`가 이미 기준 글을 제외하므로 Prisma의 `cursor`나 `skip: 1`을 사용하지 않습니다.  

### 🟦 ID 정렬: 요청·응답

```bash
# ID 경계를 cursorId로 전달합니다. orderBy를 생략하면 id 정렬입니다.
curl 'http://localhost:3000/api/posts/keyset?limit=3&cursorId=105' \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

```json
{
  "items": [{ "id": 104 }, { "id": 103 }, { "id": 102 }],
  "nextCursor": { "id": 102 }
}
```

| `/api/posts/keyset` 요청 쿼리 | 응답 ID | nextCursor |
| --- | --- | --- |
| `limit=3` | `[107,106,105]` | `{"id":105}` |
| `limit=3&cursorId=105` | `[104,103,102]` | `{"id":102}` |
| `limit=3&cursorId=102` | `[101]` | `null` |

### 🟦 생성 시각 정렬: 시각과 ID 비교

이번에는 새로운 예시 데이터를 사용합니다. 날짜는 모두 `2026-09-08`이며, 시각은 UTC 기준입니다. ID와 생성 시각의 순서를 일부러 다르게 배치했습니다.  

| 정렬 순서 | ID | createdAt 시각 |
| --- | --- | --- |
| 1 | 201 | `10:03:00.000Z` |
| 2 | 205 | `10:02:00.000Z` |
| 3 | 204 | `10:02:00.000Z` |
| 4 | 203 | `10:02:00.000Z` |
| 5 | 202 | `10:01:00.000Z` |

`orderBy=createdAt&limit=3`의 첫 응답은 다음과 같습니다.  

```json
{
  "items": [{ "id": 201 }, { "id": 205 }, { "id": 204 }],
  "nextCursor": {
    "id": 204,
    "createdAt": "2026-09-08T10:02:00.000Z"
  }
}
```

다음 페이지에는 기준 글보다 먼저 생성된 글과, 같은 시각에 생성되었으면서 ID가 더 작은 글이 포함되어야 합니다.  

![흰색 배경의 Keyset 삽화: 생성 시각 10시 2분과 ID 204를 경계로 사용합니다. 같은 시각에서 ID가 작은 203과 더 이전 시각의 202를 반환하며, 기준 글은 다시 조회하지 않습니다.](/assets/images/nodejs/nodejs-fastify/fastify-keyset-boundary.png)

주황색은 요청으로 전달한 경계를 나타내고, 파란색은 범위 조건에 맞아 반환할 글입니다. 203은 기준 글과 생성 시각이 같고 ID가 더 작아서 포함됩니다. 202는 기준 글보다 먼저 생성되어 포함됩니다. 그림의 시각은 읽기 쉽게 줄여 표시했으며, 실제 `cursorCreatedAt`에는 응답에서 받은 날짜·밀리초·시간대를 포함한 ISO 문자열을 그대로 전달합니다.  

```text
기준: (createdAt=10:02:00, id=204)
    ↓
createdAt < 10:02:00
또는
createdAt = 10:02:00 AND id < 204
    ↓
203: 같은 시각 + 더 작은 ID → 포함
202: 더 이전 시각          → 포함
    ↓
응답 [203,202] / nextCursor=null
```

| 비교 방법 | 조건에 맞는 ID | 문제 또는 결과 |
| --- | --- | --- |
| `id < 204`만 적용 | `[201,203,202]` | 이미 읽은 201이 다시 포함됩니다. |
| `createdAt < 기준 시각`만 적용 | `[202]` | 같은 시각의 203이 빠집니다. |
| `createdAt <= 기준 시각`만 적용 | `[205,204,203,202]` | 이미 읽은 205와 204가 다시 포함됩니다. |
| 이전 시각 또는 같은 시각의 더 작은 ID | `[203,202]` | 정렬 순서에 맞는 다음 목록입니다. |

이렇게 두 정렬 값을 차례대로 비교하는 것이 복합 Keyset의 핵심입니다.  

### 🟦 생성 시각 정렬: 요청·응답

앞서 받은 `id=204`와 시각을 각각의 파라미터로 전달합니다. `curl --data-urlencode`를 사용하면 날짜 문자열에 들어 있는 콜론 등의 문자를 URL에 맞는 형태로 바꿔 전달할 수 있습니다.  

```bash
# 응답에서 받은 ID와 시각을 함께 보내며 정렬 기준을 유지합니다.
curl --get 'http://localhost:3000/api/posts/keyset' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode 'orderBy=createdAt' \
  --data-urlencode 'limit=3' \
  --data-urlencode 'cursorId=204' \
  --data-urlencode 'cursorCreatedAt=2026-09-08T10:02:00.000Z'
```

```json
{
  "items": [{ "id": 203 }, { "id": 202 }],
  "nextCursor": null
}
```

시각을 화면 표시용으로 반올림하거나 밀리초를 제거하지 말고, 응답 값을 그대로 전달합니다. 경계 시각이 달라지면 같은 초에 생성된 글의 포함 여부도 달라질 수 있습니다.  

### 🟦 구현: 정렬에 맞는 범위 조건 만들기

다음은 `post.repository.ts`의 조건 생성 함수입니다.  

```typescript
// 공통 필터와 정렬 경계를 결합합니다. 정렬 방향은 내림차순입니다.
function postListKeysetWhere(filter: PostKeysetListFilter): Prisma.PostWhereInput {
  const where = postListWhere(filter);
  if (filter.cursorId === undefined) return where; // 첫 페이지입니다.

  if (filter.orderBy === PostOrderBy.CREATED_AT) {
    const cursorCreatedAt = filter.cursorCreatedAt;
    // 서비스 검증을 거치지 않고 저장소를 호출하는 경우도 방어합니다.
    if (cursorCreatedAt === undefined)
      throw new Error('createdAt 정렬의 커서에는 생성 시각이 필요합니다.');

    return {
      AND: [
        where,
        {
          OR: [
            { createdAt: { lt: cursorCreatedAt } },
            // 같은 시각의 글은 ID 경계로 이어서 읽습니다.
            { createdAt: cursorCreatedAt, id: { lt: filter.cursorId } },
          ],
        },
      ],
    };
  }

  return { AND: [where, { id: { lt: filter.cursorId } }] };
}
```

`findManyByKeyset()`은 이 함수를 사용해 바로 목록을 조회합니다. 생성 시각을 알아내기 위한 `findUnique()` 조회는 없습니다.  

```typescript
// post.repository.ts: 요청에서 받은 정렬 값으로 다음 범위를 바로 조회합니다.
this.prisma.post.findMany({
  where: postListKeysetWhere(filter),
  orderBy: postListOrderBy(filter.orderBy),
  take: filter.limit + 1, // Prisma Cursor와 마찬가지로 다음 페이지 확인용 한 건을 추가합니다.
  select: postSelect(filter.actor.userId),
});
```

### 🟦 구현: 경계 검증과 nextCursor 생성

스키마는 `cursorId`가 1 이상의 정수인지, `cursorCreatedAt`이 날짜와 시간을 나타내는 `date-time` 형식의 문자열인지 검사합니다. Service의 `listByKeyset()`은 정렬 기준에 맞는 조합인지 추가로 검사합니다.  

| 정렬 | cursorId | cursorCreatedAt | 처리 |
| --- | --- | --- | --- |
| `id` | 생략 | 생략 | 첫 페이지 |
| `id` | 전달 | 생략 | ID 경계로 다음 페이지 |
| `id` | 전달 또는 생략 | 전달 | HTTP 400 |
| `createdAt` | 생략 | 생략 | 첫 페이지 |
| `createdAt` | 전달 | 전달 | 복합 경계로 다음 페이지 |
| `createdAt` | 전달 | 생략 | HTTP 400 |
| `createdAt` | 생략 | 전달 | HTTP 400 |

```typescript
// post.service.ts의 listByKeyset() 앞부분입니다.
const common = toPostListFilter(actor, query);
const hasId = query.cursorId !== undefined;
const hasCreatedAt = query.cursorCreatedAt !== undefined;

if (
  (common.orderBy === PostOrderBy.ID && hasCreatedAt) ||
  (common.orderBy === PostOrderBy.CREATED_AT && hasId !== hasCreatedAt)
) {
  // 불완전한 경계를 첫 페이지로 처리하지 않고 입력 오류로 거절합니다.
  throw new BusinessError(
    ErrorCode.VALIDATION_ERROR,
    'ID 정렬은 cursorId만, createdAt 정렬은 cursorId와 cursorCreatedAt을 함께 전달해야 합니다.',
    400,
  );
}
```

이후 Service는 시각 문자열을 `new Date()`로 Date 객체로 변환합니다. `Number.isFinite(cursorCreatedAt.getTime())`으로 변환 결과가 유효한지도 확인합니다. JavaScript의 Date로 나타낼 수 없는 시각이면 HTTP 400을 반환합니다. 검사를 통과한 ID와 Date 객체는 `PostKeysetListFilter`에 담아 Repository에 전달합니다.  

조회가 끝나면 응답에 담을 글을 추리고 다음 페이지의 경계를 만듭니다.  

```typescript
// post.service.ts: filter에는 검증·변환된 경계가 들어 있습니다.
const posts = await this.postRepository.findManyByKeyset(filter);
const hasNextPage = posts.length > filter.limit;
const items = posts.slice(0, filter.limit);
const last = items.at(-1);

return {
  items,
  nextCursor:
    hasNextPage && last !== undefined
      ? {
          id: last.id,
          // 생성 시각 정렬일 때만 시각도 다음 경계에 포함합니다.
          ...(filter.orderBy === PostOrderBy.CREATED_AT ? { createdAt: last.createdAt } : {}),
        }
      : null,
};
```

Service 내부의 `createdAt`은 Date입니다. Controller의 `listByKeyset()`이 `cursor.createdAt.toISOString()`으로 변환하므로 HTTP 응답에서는 밀리초를 포함한 ISO 문자열이 됩니다.  

## 5. 데이터 변경 시뮬레이션 {#session-05}

이제 페이지를 읽는 사이에 데이터가 바뀌는 경우를 비교합니다. 각 시나리오는 앞 시나리오의 변경 사항을 이어받지 않고 처음 상태에서 다시 시작합니다. A~C는 목록 `[107,106,105,104,103,102,101]`을 ID 내림차순으로 조회하며, `limit=3`인 첫 페이지 `[107,106,105]`를 받은 상태에서 시작합니다.  

### 🟦 시나리오 A: 첫 페이지 이후 새 글 108 추가

세 방식 모두 첫 응답은 `[107,106,105]`입니다. 그다음 108이 추가되면 목록은 다음과 같습니다.  

```text
[108,107,106,105,104,103,102,101]
```

| 방식 | 두 번째 요청 | 응답 ID | 이유 |
| --- | --- | --- | --- |
| Offset | `page=2&limit=3` | `[105,104,103]` | 현재 목록의 앞 세 개를 건너뛰어 105가 다시 나옵니다. |
| Prisma Cursor | `cursor=105&limit=3` | `[104,103,102]` | 기준 글 105 다음부터 읽습니다. |
| Keyset | `cursorId=105&limit=3` | `[104,103,102]` | `id < 105`인 범위를 읽습니다. |

Prisma Cursor와 Keyset의 다음 페이지에는 새 글 108이 들어오지 않습니다. 108은 이어 읽는 경계보다 앞에 있으므로 첫 페이지를 새로 조회해야 볼 수 있습니다.  

### 🟦 시나리오 B: 이미 읽은 글 107 삭제

첫 페이지 이후 107이 삭제되면 `[106,105,104,103,102,101]`이 됩니다.  

| 방식 | 두 번째 요청 | 응답 ID | 이유 |
| --- | --- | --- | --- |
| Offset | `page=2&limit=3` | `[103,102,101]` | 앞의 세 글에 104가 포함되어 아직 읽지 않은 104를 건너뜁니다. |
| Prisma Cursor | `cursor=105&limit=3` | `[104,103,102]` | 기준 글 105는 남아 있어 이어 읽습니다. |
| Keyset | `cursorId=105&limit=3` | `[104,103,102]` | 경계 값 105는 바뀌지 않습니다. |

### 🟦 시나리오 C: 기준 글 105 자체 삭제

이번에는 첫 페이지의 마지막 글인 105를 삭제합니다. 현재 목록은 `[107,106,104,103,102,101]`입니다.  

| 방식 | 두 번째 요청 | 응답 ID | 페이지 정보 |
| --- | --- | --- | --- |
| Offset | `page=2&limit=3` | `[103,102,101]` | `total=6`, `totalPages=2` |
| Prisma Cursor | `cursor=105&limit=3` | `[]` | `nextCursor=null` |
| Keyset | `cursorId=105&limit=3` | `[104,103,102]` | `nextCursor={"id":102}` |

현재 프로젝트의 Prisma Cursor 테스트에서는 기준 글이 삭제되면 빈 목록과 `nextCursor=null`이 반환되는지 확인합니다. Keyset은 실제 105번 글의 존재를 확인하지 않고 숫자 105와 비교하므로 계속 조회합니다.  

### 🟦 시나리오 D: 생성 시각 정렬의 기준 글 삭제

다음 다섯 글을 생성 시각 내림차순으로 조회합니다. 생성 시각이 같으면 ID가 큰 글부터 읽습니다. 날짜는 모두 `2026-09-08`이며, 시각은 UTC 기준입니다.  

| 정렬 순서 | ID | createdAt 시각 |
| --- | --- | --- |
| 1 | 201 | `10:03:00.000Z` |
| 2 | 205 | `10:02:00.000Z` |
| 3 | 204 | `10:02:00.000Z` |
| 4 | 203 | `10:02:00.000Z` |
| 5 | 202 | `10:01:00.000Z` |

`orderBy=createdAt&limit=3`으로 첫 페이지 `[201,205,204]`를 받은 뒤, 마지막으로 반환된 204번 글이 삭제되었다고 가정합니다.  

```text
보관한 Keyset 경계:
{id:204, createdAt:"2026-09-08T10:02:00.000Z"}

다음 요청의 조건:
createdAt < 10:02:00
OR (createdAt = 10:02:00 AND id < 204)

204가 DB에 없어도 조건은 그대로입니다.
→ [203,202] 반환 / nextCursor=null
```

이 시나리오에서는 기준 글 204가 없어도 Keyset 조건이 그대로 동작합니다. 요청에 보관해 둔 생성 시각과 ID를 경계로 사용하기 때문입니다.  

### 🟦 시뮬레이션에서 확인할 점

위 시뮬레이션은 각 요청이 그 순간의 DB 상태를 다시 조회한다는 점을 보여 줍니다. Offset은 페이지 번호로 위치를 계산하므로 글이 앞쪽에서 추가되거나 삭제되면 중복이나 누락이 생길 수 있습니다.  

Prisma Cursor는 기준 글이 남아 있으면 그다음부터 이어 읽습니다. 하지만 현재 구현에서는 기준 글이 삭제되면 Prisma가 다음 위치를 찾지 못해 빈 목록과 `nextCursor=null`을 반환합니다.  

Keyset은 요청에 담긴 경계 값으로 범위를 계산합니다. 기준 글이 삭제되어도 경계 값 자체는 남아 있으므로 이어 읽을 수 있습니다. 다만 경계 뒤에 새 글이 추가되면 이후 페이지에 포함될 수 있고, 아직 읽지 않은 글이 삭제되면 반환되지 않습니다.  
