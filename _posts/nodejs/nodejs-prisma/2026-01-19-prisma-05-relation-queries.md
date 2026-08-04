---
layout: post
title: "05. Prisma 관계 조회 심화: include, select와 중첩 관계 탐색"
description: "Prisma 7에서 include와 select로 관계 데이터를 조회하고, 중첩 관계와 관계 로드 전략을 적용하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. include와 select의 차이와 실무 선택 기준"
  - id: session-02
    title: "2. 중첩 관계 트리 조회(Nested Query)"
  - id: session-03
    title: "3. 관계 로드 전략(Relation Load Strategy)"
---

## 1. include와 select의 차이와 실무 선택 기준 {#session-01}

Prisma Client를 사용하면 SQL의 `JOIN`을 직접 작성하지 않아도 됩니다.  
가져오려는 데이터의 모양을 코드로 작성하면 Prisma가 알맞은 쿼리를 만들어 줍니다.  

### 🟦 관계 탐색(Relation Traversal)의 실무 적용

Prisma의 관계 조회는 기준이 되는 모델에서 시작해 연결된 데이터를 차례로 따라가는 방식입니다.  
아래 코드는 `User`에서 시작해 각 사용자의 `posts`를 함께 조회합니다.  

```typescript
// 모든 사용자를 조회하면서 각 사용자의 게시글도 함께 가져옵니다.
const users = await prisma.user.findMany({
  // include에는 함께 조회할 관계 필드를 작성합니다.
  include: {
    posts: {
      // 발행된 게시글만 관계 조회 결과에 포함합니다.
      where: { published: true },
      // 사용자마다 게시글을 최대 5개까지 가져옵니다.
      take: 5,
    },
  },
});
```

- 의미: `User`를 기준으로 각 사용자의 `posts`를 찾아 결과에 포함합니다.
- 실무 포인트: 관계를 조회할 때도 `where`, `take`, `skip` 등을 사용해 조건과 조회 개수를 쉽게 지정할 수 있습니다.

### 🟦 `include`: 빠른 개발과 도메인 로직 중심

`include`는 모델의 기본 필드와 연결된 데이터가 모두 필요할 때 사용합니다.  
예를 들어 사용자 정보와 그 사용자가 작성한 게시글을 한 번에 가져올 수 있습니다.  

- 장점: 기본 정보와 관계 데이터를 함께 반환하므로 전체 내용을 확인하기 편리합니다.
- 주의점: 응답에 필요하지 않은 필드나 민감한 필드까지 포함되지 않도록 살펴봐야 합니다.

```typescript
// 사용자 정보와 게시글을 함께 가져와 비즈니스 로직에서 처리합니다.
const userWithPosts = await prisma.user.findUnique({
  // id가 1인 사용자 한 명을 찾습니다.
  where: { id: 1 },
  // 사용자의 기본 필드에 posts 관계를 추가합니다.
  include: { posts: true },
});
```

조회 결과에는 `User`의 기본 필드와 `include`로 지정한 `posts`가 함께 들어 있습니다.  

```text
{
  id: number;
  email: string;
  displayName: string | null;
  createdAt: Date;
  posts: Post[];
}
```

### 🟦 `select`: 성능 최적화와 보안 중심

외부 API 응답처럼 필요한 필드만 골라서 반환하려면 `select`를 사용합니다.  

- 데이터 양 감소: 필요한 컬럼만 조회하므로 데이터베이스가 읽는 양과 응답 크기를 줄일 수 있습니다.
- 보안: 외부에 보여 주면 안 되는 필드를 처음부터 조회 대상에서 뺄 수 있습니다.
- 중첩 조회: 연결된 데이터에서도 필요한 필드만 선택할 수 있습니다.

```typescript
// API 응답에 필요한 데이터만 선택합니다.
const users = await prisma.user.findMany({
  // select에는 결과에 포함할 필드만 작성합니다.
  select: {
    // true로 지정한 기본 필드만 반환합니다.
    id: true,
    email: true,
    // 게시글 전체를 가져오지 않고 개수만 조회합니다.
    _count: {
      select: { posts: true },
    },
    posts: {
      // 발행된 게시글만 최대 5개 조회합니다.
      where: { published: true },
      take: 5,
      // 게시글에서는 title만 반환합니다.
      select: {
        title: true,
      },
    },
  },
});
```

### 🟦 `include`와 `select` 비교 요약

| 구분 | `include` | `select` |
| --- | --- | --- |
| 핵심 관점 | 기본 모델에 연결된 데이터를 추가합니다. | 필요한 필드와 관계만 선택합니다. |
| 반환 타입 | 기본 모델의 모든 필드와 지정한 관계를 반환합니다. | 선택한 필드와 관계만 반환합니다. |
| 데이터 양 | 사용하지 않는 기본 필드도 포함될 수 있습니다. | 필요한 데이터만 가져올 수 있습니다. |
| 사용 방법 | 연결된 데이터를 한꺼번에 가져올 때 편리합니다. | 가져올 필드를 하나씩 정할 수 있습니다. |

간단히 말하면 `include`는 기본 데이터에 관계 데이터를 덧붙이고, `select`는 필요한 데이터만 골라서 가져옵니다.  

### 🟦 실무 선택 기준

| 구분 | `include` | `select` |
| --- | --- | --- |
| 주요 사용 사례 | 관리자 페이지, 내부 도구 | 외부 API 응답 |
| 트래픽 특성 | 상대적으로 트래픽이 적은 기능 | 트래픽이 많은 엔드포인트 |
| 개발 단계 | 빠른 프로토타이핑 | 운영·배포 단계 |
| 데이터 관리 방식 | 모델 전체 구조를 빠르게 확인 | 응답 데이터 구조를 명확하게 관리 |
| 실무 활용 패턴 | 관계 구조 탐색과 초기 구현 | 성능·보안·응답 크기 최적화 |

처음에는 `include`로 전체 구조를 확인하고, 외부 API 응답을 만들 때는 `select`로 필요한 필드만 남기는 방법이 이해하기 쉽습니다.  

## 2. 중첩 관계 트리 조회(Nested Query) {#session-02}

Prisma에서는 여러 단계로 이어진 관계도 하나의 조회 코드 안에 작성할 수 있습니다.  
다음 예시는 앞 글에서 정의한 `User`, `Post`, `PostLike` 관계를 사용합니다.  

```text
# 스키마의 관계 구조입니다.
User
└─ posts (1:N)
   └─ likes (1:N, PostLike)
      └─ user (N:1, User)

# 실습에서 조회할 핵심 트리입니다.
User
└─ posts
   └─ likes
      └─ user
```

### 🟦 `include`를 활용한 전체 트리 조회

기능을 처음 만들거나 내부 관리자 도구를 개발할 때는 연결된 데이터 전체를 빠르게 확인해야 하는 경우가 많습니다.  
이럴 때는 `include`를 여러 단계로 작성할 수 있습니다.  

```typescript
// User에서 posts, likes, user 순서로 관계를 따라가며 조회합니다.
const usersWithAllData = await prisma.user.findMany({
  include: {
    // 각 사용자가 작성한 게시글을 포함합니다.
    posts: {
      include: {
        // 각 게시글에 등록된 좋아요 정보를 포함합니다.
        likes: {
          // 좋아요를 누른 사용자의 기본 필드를 함께 포함합니다.
          include: {
            user: true,
          },
        },
      },
    },
  },
});

// 일부 필드만 표시한 결과 구조 예시입니다.
const example = [
  {
    // 조회의 시작점인 사용자 정보입니다.
    id: 1,
    displayName: '강하늘',
    email: 'sky@example.com',
    createdAt: new Date('2026-01-19T00:00:00.000Z'),
    posts: [
      {
        // 위 사용자가 작성한 게시글 정보입니다.
        id: 101,
        title: 'Prisma 중첩 조회 가이드',
        content: '본문 내용입니다.',
        published: true,
        authorId: 1,
        likes: [
          {
            // 게시글에 등록된 좋아요와 사용자 관계입니다.
            userId: 2,
            postId: 101,
            user: {
              // 좋아요를 누른 사용자의 정보입니다.
              id: 2,
              displayName: '김철수',
              email: 'chulsoo@example.com',
            },
          },
        ],
      },
    ],
  },
];
```

### 🟦 `select`를 활용한 정밀한 트리 제어

실제 서비스의 API에서는 필요한 데이터만 가져오는 것이 안전합니다.  
`select` 안에 다시 `select`를 작성하면 각 관계에서 반환할 필드를 단계별로 정할 수 있습니다.  

```typescript
// 필요한 필드만 선택하여 사용자와 관계 데이터를 조회합니다.
const fastUsers = await prisma.user.findMany({
  // 최상위 select는 User에서 반환할 필드를 정합니다.
  select: {
    id: true,
    // 이메일은 제외하고 표시 이름만 노출합니다.
    displayName: true,
    posts: {
      // 발행된 게시글 중 최근 3개만 조회합니다.
      where: { published: true },
      // 게시글을 작성일이 최신인 순서로 정렬합니다.
      orderBy: { createdAt: 'desc' },
      // 정렬된 게시글 중 앞의 3개만 가져옵니다.
      take: 3,
      // posts의 select는 각 게시글에서 반환할 필드를 정합니다.
      select: {
        title: true,
        createdAt: true,
        // 좋아요 목록 대신 개수만 먼저 확인합니다.
        _count: {
          select: { likes: true },
        },
        likes: {
          // 좋아요 정보는 최대 5개까지만 가져옵니다.
          take: 5,
          select: {
            // 좋아요를 누른 사용자의 표시 이름만 선택합니다.
            user: {
              select: { displayName: true },
            },
          },
        },
      },
    },
  },
});
```

### 🟦 `include`와 `select` 조합

`select`와 `include`는 관계의 단계가 다르면 함께 사용할 수 있습니다.  
아래 코드는 사용자의 일부 정보만 선택하고, 게시글의 기본 필드와 좋아요를 누른 사용자의 표시 이름을 함께 가져옵니다.  

```typescript
// 관계 단계마다 select와 include를 다르게 적용합니다.
const result = await prisma.user.findMany({
  // 최상위 사용자는 일부 필드만 선택합니다.
  select: {
    id: true,
    displayName: true,
    posts: {
      // 게시글은 기본 필드를 모두 가져오고 likes 관계를 포함합니다.
      include: {
        likes: {
          // 좋아요를 누른 사용자는 표시 이름만 선택합니다.
          select: {
            user: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    },
  },
});
```

### 🟦 중첩 조회의 핵심 장점

1. **반복 조회 줄이기**: 게시글마다 좋아요를 따로 조회하는 코드를 작성하지 않아도 Prisma가 관계 데이터를 묶어서 처리합니다.
2. **응답 크기 줄이기**: 크기가 큰 `content`를 제외하고 `title`만 가져오면 네트워크로 보내는 데이터의 양을 줄일 수 있습니다.
3. **관계마다 조건 지정하기**: `posts` 안에서도 `where`, `orderBy`, `take` 등을 사용해 필요한 데이터만 조회할 수 있습니다.

## 3. 관계 로드 전략(Relation Load Strategy) {#session-03}

Prisma 7에서 PostgreSQL, CockroachDB 또는 MySQL의 관계 데이터를 조회할 때는 `relationLoadStrategy` 옵션으로 조회 방식을 선택할 수 있습니다.  
쉽게 말해 관계 데이터를 하나의 쿼리로 가져올지, 여러 쿼리로 나누어 가져올지를 정하는 옵션입니다.  
현재는 Preview 기능이므로 Prisma Client에서 `relationJoins` 기능을 먼저 활성화 하고 Prisma Client를 다시 생성해야 합니다.  

| 전략 | 설명 |
| --- | --- |
| `join` | 데이터베이스에서 한 번의 쿼리로 관계 데이터를 가져옵니다. |
| `query` | 관계마다 쿼리를 나누어 실행한 뒤 애플리케이션에서 결과를 합칩니다. |

`relationJoins를 활성화한 상태에서 relationLoadStrategy를 생략하면 기본값은 join입니다.  
플래그를 활성화하지 않으면 이 옵션을 사용할 수 없으며, 관계 데이터는 기존의 다중 쿼리 방식으로 조회됩니다.  

일반적으로 join이 효율적인 경우가 많지만, 데이터 분포, 관계 구조, 필터, 페이지네이션, 인덱스와 데이터베이스 부하에 따라 query가 더 유리할 수도 있으므로 성능 문제가 있다면 실제 환경에서 측정하여 선택하는 것이 좋습니다.

### 🟦 환경 설정

먼저 `schema.prisma`의 `generator` 블록에서 `relationJoins` Preview 기능을 활성화합니다.  
설정을 바꾼 뒤에는 `npx prisma generate`를 실행하여 Prisma Client를 다시 생성합니다.  

```prisma
generator client {
  // TypeScript 기반 Prisma Client 생성기를 사용합니다.
  provider        = "prisma-client"

  // 생성한 Prisma Client 코드를 저장할 경로입니다.
  output          = "../generated/prisma"

  // relationLoadStrategy 옵션을 사용하기 위한 Preview 기능입니다.
  previewFeatures = ["relationJoins"]
}

datasource db {
  // 이 예제에서 사용할 데이터베이스는 PostgreSQL입니다.
  provider = "postgresql"
}
```

```bash
# 변경한 generator 설정으로 Prisma Client를 다시 생성합니다.
npx prisma generate
```

### 🟦 `join` 전략(Database-level JOIN)

`join` 전략은 데이터베이스에 한 번 요청하여 관계 데이터를 함께 가져옵니다.  

- 데이터베이스에 요청하는 횟수를 줄이고 싶을 때 사용할 수 있습니다.
- 관계 데이터를 데이터베이스에서 한 번에 처리하는 편이 효율적일 때 유용합니다.
- 기본 전략이므로 특별한 성능 문제가 없다면 그대로 사용해도 됩니다.

```typescript
// join 전략으로 사용자와 연결된 관계 데이터를 조회합니다.
const users = await prisma.user.findMany({
  // 한 번의 데이터베이스 쿼리로 관계 데이터를 조회합니다.
  relationLoadStrategy: 'join',
  include: {
    // 사용자가 작성한 게시글을 함께 조회합니다.
    posts: {
      include: {
        // 각 게시글의 좋아요 정보도 함께 조회합니다.
        likes: true,
      },
    },
  },
});
```

내부적으로 PostgreSQL은 `LATERAL JOIN`과 JSON 집계를 사용하고, MySQL은 상관 서브쿼리를 사용합니다.  
처음 학습할 때는 세부 SQL보다 한 번의 쿼리로 관계 데이터를 가져온다는 점을 이해하면 충분합니다.  

### 🟦 `query` 전략(Application-level JOIN)

`query` 전략은 관계마다 필요한 쿼리를 나누어 실행한 뒤 Prisma Client에서 결과를 하나로 합칩니다.  

- 관계가 여러 단계로 이어지거나 일대다 관계가 많아 하나의 쿼리가 복잡해질 때 사용해 볼 수 있습니다.
- 데이터베이스의 작업을 줄이고 애플리케이션 서버에서 결과를 합치는 편이 나은 상황에 사용할 수 있습니다.
- 실제 성능은 데이터 양, 인덱스, 네트워크 지연에 따라 달라지므로 측정한 뒤 선택하는 것이 좋습니다.

```typescript
// query 전략으로 사용자와 연결된 관계 데이터를 조회합니다.
const users = await prisma.user.findMany({
  // 관계별 쿼리로 나누어 조회한 뒤 결과를 결합합니다.
  relationLoadStrategy: 'query',
  include: {
    // Prisma가 posts 관계를 별도의 쿼리로 조회합니다.
    posts: {
      include: {
        // likes 관계도 별도의 쿼리로 조회한 뒤 결과에 연결합니다.
        likes: true,
      },
    },
  },
});
```
