---
layout: post
title: "04. 조회 쿼리 고급 옵션과 관계 데이터 생성 패턴"
description: "Prisma 7에서 where·select·include·페이지네이션으로 데이터를 조회하고, connect·create·connectOrCreate로 관계 데이터를 생성하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. 조회 쿼리 고급 옵션: where / select / include / pagination"
  - id: session-02
    title: "2. 관계 데이터 생성 패턴: connect / create / connectOrCreate"
---

## 1. 조회 쿼리 고급 옵션: where / select / include / pagination {#session-01}

### 🟦 `where` 조건: 정밀한 필터링

`where`는 조회할 데이터의 조건을 정할 때 사용합니다.  
먼저 기본 필드에 조건을 적용한 뒤, 여러 조건과 관계 조건을 차례로 살펴보겠습니다.  

### 🔷 1) 기본 스칼라 필터(Boolean / Number / Date)

다음 예제는 Boolean, 숫자와 날짜 필드에 조건을 적용하는 방법입니다.  
각 필터 객체를 `where`에 하나씩 넣어 결과를 확인할 수 있습니다.  

```typescript
// published 컬럼이 true인 게시글만 조회합니다.
const publishedFilter = {
  published: true,
};

// id가 100보다 큰 게시글만 조회합니다.
const greaterThanFilter = {
  id: { gt: 100 },
};

// id가 100 이상인 게시글만 조회합니다.
const greaterThanOrEqualFilter = {
  id: { gte: 100 },
};

// id가 100보다 작은 게시글만 조회합니다.
const lessThanFilter = {
  id: { lt: 100 },
};

// id가 100 이하인 게시글만 조회합니다.
const lessThanOrEqualFilter = {
  id: { lte: 100 },
};

// createdAt이 2025-01-01 00:00:00 이후인 게시글만 조회합니다.
const createdAfterFilter = {
  createdAt: { gte: new Date('2025-01-01T00:00:00.000Z') },
};

// createdAt이 현재 시각 이전인 게시글만 조회합니다.
// 미래 시각으로 저장된 데이터를 제외할 때 사용할 수 있습니다.
const createdBeforeFilter = {
  createdAt: { lt: new Date() },
};

const posts = await prisma.post.findMany({
  // 확인하려는 필터 객체로 바꾸어 실행합니다.
  where: publishedFilter,
});
```

### 🔷 2) 문자열 필터(String)

문자열은 값이 같은지 확인할 뿐만 아니라 특정 글자가 포함되는지, 어떤 글자로 시작하거나 끝나는지도 검색할 수 있습니다.  
PostgreSQL에서 대소문자를 구분하지 않으려면 `mode: 'insensitive'`를 함께 사용합니다.  

```typescript
// title이 'Prisma'와 완전히 일치하는 게시글만 조회합니다.
const equalsFilter = {
  title: { equals: 'Prisma' },
};

// title에 'Prisma'가 포함된 게시글만 조회합니다.
const containsFilter = {
  title: { contains: 'Prisma' },
};

// 대소문자를 구분하지 않고 'Prisma'가 포함된 게시글을 조회합니다.
const insensitiveFilter = {
  title: { contains: 'Prisma', mode: 'insensitive' as const },
};

// title이 'Pri'로 시작하는 게시글만 조회합니다.
const startsWithFilter = {
  title: { startsWith: 'Pri' },
};

// title이 'ORM'으로 끝나는 게시글만 조회합니다.
const endsWithFilter = {
  title: { endsWith: 'ORM' },
};

// 배열의 값 중 하나와 일치하는 게시글만 조회합니다.
const inFilter = {
  title: { in: ['Prisma', 'ORM'] },
};

// 배열에 포함된 제목을 제외하고 조회합니다.
const notInFilter = {
  title: { notIn: ['Draft', 'Temp'] },
};

// title에 'deprecated'가 포함된 게시글을 제외합니다.
const notContainsFilter = {
  NOT: {
    title: { contains: 'deprecated', mode: 'insensitive' as const },
  },
};

const posts = await prisma.post.findMany({
  // 확인하려는 필터 객체로 바꾸어 실행합니다.
  where: containsFilter,
});
```

### 🔷 3) `NULL` 필터(Nullable 필드)

`content`는 값이 없을 수 있는 선택 필드입니다.  
따라서 `null`인지 아닌지를 조건으로 게시글을 조회할 수 있습니다.  

```typescript
// content가 NULL인 게시글만 조회합니다.
// 내용이 없는 임시 데이터를 찾을 때 사용할 수 있습니다.
const nullFilter = {
  content: null,
};

// content가 NULL이 아닌 게시글만 조회합니다.
// 실제 내용이 작성된 데이터만 찾을 때 사용할 수 있습니다.
const notNullFilter = {
  content: { not: null },
};

const posts = await prisma.post.findMany({
  // 내용이 없는 게시글을 확인하기 위해 nullFilter를 적용합니다.
  where: nullFilter,
});
```

### 🔷 4) 논리 조합(AND / OR / NOT)

조건이 여러 개라면 `AND`, `OR`, `NOT`으로 묶을 수 있습니다.  
`AND`는 모든 조건, `OR`은 하나 이상의 조건을 만족해야 하며, `NOT`은 해당 조건을 만족하는 데이터를 제외합니다.  

```typescript
// 여러 조건을 한 번에 조합하여 게시글을 조회합니다.
const posts = await prisma.post.findMany({
  // where 안에서 AND, OR와 NOT을 함께 사용할 수 있습니다.
  where: {
    // 아래 조건을 모두 만족해야 합니다.
    AND: [
      { published: true },
      { id: { gt: 100 } },
    ],

    // 아래 조건 중 하나 이상을 만족해야 합니다.
    OR: [
      { title: { contains: 'Prisma', mode: 'insensitive' } },
      { title: { contains: 'ORM', mode: 'insensitive' } },
    ],

    // 아래 조건에 해당하는 게시글은 제외합니다.
    NOT: {
      title: { contains: 'deprecated', mode: 'insensitive' },
    },
  },
});
```

### 🔷 5) 다대일 관계 필터: `is` / `isNot`

`Post.author`처럼 하나의 레코드와 연결된 관계에는 `is`와 `isNot`을 사용합니다.  
이 글의 스키마에서 모든 게시글에는 작성자가 반드시 있으므로, 작성자의 존재 여부가 아니라 이메일 같은 작성자 필드에 조건을 적용합니다.  

- `is`: 관계 대상이 지정한 조건을 만족해야 합니다.
- `isNot`: 관계 대상이 지정한 조건을 만족하지 않아야 합니다.
- `is: null`: 선택 관계의 외래 키가 `null`인 데이터를 찾습니다. 현재 스키마의 `Post.author`에는 적용할 수 없습니다.
- `isNot: null`: 선택 관계가 연결된 데이터를 찾습니다. 현재 스키마의 `Post.author`는 항상 연결되어 있습니다.

```typescript
// 작성자의 이메일 도메인이 example.com인지 확인합니다.
// 또한 해당 작성자가 내용에 backend가 포함된 글을 작성했는지 확인합니다.
const posts = await prisma.post.findMany({
  where: {
    author: {
      // 작성자 이메일 도메인이 example.com인 게시글만 조회합니다.
      is: {
        email: { endsWith: '@example.com' },

        // 작성자가 쓴 글 중 'backend'가 포함된 글이 하나 이상 있어야 합니다.
        posts: {
          some: {
            content: { contains: 'backend', mode: 'insensitive' },
          },
        },
      },
    },
  },
});
```

```typescript
// 작성자 이메일 도메인이 example.com이 아닌 게시글을 조회합니다.
const posts = await prisma.post.findMany({
  where: {
    author: {
      // example.com 도메인을 사용하지 않는 작성자의 게시글만 조회합니다.
      isNot: {
        email: { endsWith: '@example.com' },
      },
    },
  },
});
```

### 🔷 6) 일대다 관계 필터: `some` / `every` / `none`

`Post.likes`처럼 여러 레코드와 연결된 관계에는 `some`, `every`, `none`을 사용합니다.  
각각 하나 이상 만족하는지, 모두 만족하는지, 하나도 만족하지 않는지를 확인합니다.  

```typescript
// 게시글의 likes 관계에 조건을 적용합니다.
const posts = await prisma.post.findMany({
  where: {
    likes: {
      // 좋아요를 누른 사용자의 이메일을 확인합니다.
      // @example.com으로 끝나는 사용자가 한 명 이상인 게시글을 조회합니다.
      some: {
        user: {
          is: {
            email: { endsWith: '@example.com' },
          },
        },
      },

      // 모든 좋아요 사용자의 이메일이 @example.com으로 끝나는 게시글을 조회합니다.
      // every: { user: { is: { email: { endsWith: '@example.com' } } } },

      // @spam.example 이메일 사용자의 좋아요가 하나도 없는 게시글을 조회합니다.
      // none: { user: { is: { email: { endsWith: '@spam.example' } } } },
    },
  },
});
```

`every`를 사용할 때는 관계 데이터가 하나도 없는 경우도 조건을 만족할 수 있다는 점에 주의해야 합니다.  
좋아요가 반드시 하나 이상 있어야 한다면 `some: {}`도 함께 사용합니다.  
결과는 다음과 같이 달라집니다.  

- 좋아요 3개가 모두 @example.com 사용자 → 만족
- 좋아요 3개 중 1개가 다른 도메인 → 불만족
- 좋아요가 0개 → 만족할 수 있음

좋아요가 반드시 하나 이상 있으면서 모든 좋아요가 조건을 만족해야 한다면 다음처럼 작성합니다.  

```typescript
// some으로 좋아요가 하나 이상 있는지 먼저 확인합니다.
likes: {
  some: {},

  // every로 모든 좋아요 사용자의 이메일 도메인을 검사합니다.
  every: {
    user: {
      is: {
        email: {
          endsWith: '@example.com',
        },
      },
    },
  },
}
```

### 🔷 7) 중첩 관계 조건

관계 안에서 다시 다른 관계로 이동하며 조건을 지정할 수도 있습니다.  
다음 예제는 게시글의 작성자를 확인한 뒤, 그 작성자가 쓴 다른 게시글의 내용까지 검사합니다.  

```typescript
// 내용에 backend가 포함된 게시글을 하나 이상 작성한 작성자를 찾습니다.
// 그 작성자가 작성한 모든 게시글을 조회합니다.
const posts = await prisma.post.findMany({
  where: {
    author: {
      is: {
        posts: {
          some: {
            content: {
              contains: 'backend',
              mode: 'insensitive',
            },
          },
        },
      },
    },
  },
});
```

### 🔷 8) 배열 필드 필터(String[] 등)

배열 필터는 모델에 `String[]`과 같은 목록 필드가 있을 때 사용합니다.  
예를 들어 `tags` 필드가 있다면 특정 태그가 하나 또는 여러 개 포함되어 있는지 확인할 수 있습니다.  

```typescript
// 아래 배열 필터는 tags 필드에 하나씩 적용하는 예시입니다.
where: {
  // tags 배열에 'prisma'가 포함된 게시글만 조회합니다.
  tags: { has: 'prisma' },

  // 두 태그 중 하나 이상을 찾으려면 위 조건 대신 다음 조건을 사용합니다.
  // tags: { hasSome: ['prisma', 'node'] },

  // 두 태그가 모두 있는지 확인하려면 다음 조건을 사용합니다.
  // tags: { hasEvery: ['prisma', 'node'] },

  // 배열이 비어 있지 않은지 확인하려면 다음 조건을 사용합니다.
  // tags: { isEmpty: false },
}
```

### 🟦 `select`와 `include`

| 기준 | `select` | `include` |
| --- | --- | --- |
| 주요 목적 | 응답 데이터의 형태를 결정합니다. | 관계 데이터를 함께 불러옵니다. |
| 데이터 양 | 필요한 필드만 조회하여 최소화합니다. | 관계 모델을 모두 포함하면 데이터가 많아질 수 있습니다. |
| 추천 상황 | 클라이언트 전달용 API, 대량 목록 조회 | 비즈니스 로직 연산, 전체 관계 데이터 확인 |
| 관계 처리 | 하위 `select`를 통해 관계 필드도 선택할 수 있습니다. | 관계 내부에 `select`를 사용하지 않으면 관계 모델의 스칼라 필드를 모두 가져옵니다. |

조회 코드를 작성하기 전에는 화면이나 API에 어떤 데이터가 필요한지 먼저 정하는 것이 좋습니다.  
필요한 필드만 고르려면 `select`를, 기본 필드와 관계 데이터를 함께 보려면 `include`를 사용합니다.  

### 🔷 1) `select`: 필드 선택(권장 기본값)

`select`는 반환할 필드를 직접 고르는 기능입니다.  
`select`에 작성하지 않은 필드는 조회 결과에 포함되지 않습니다.  

- **보안**: 외부에 노출할 필요가 없는 이메일이나 내부 필드가 응답에 포함되는 실수를 줄입니다.
- **성능**: 데이터베이스에서 애플리케이션 서버로 전송하는 데이터의 크기를 줄입니다.
- **타입 추론**: TypeScript에서 선택한 필드만 결과 타입에 포함되므로 조회하지 않은 필드에 접근하는 실수를 방지합니다.

```typescript
// 공개용 사용자 카드에 필요한 필드만 조회합니다.
const userCard = await prisma.user.findUnique({
  // id가 135인 사용자 한 명을 찾습니다.
  where: { id: 135 },

  // 사용자 카드에 보여 줄 필드만 선택합니다.
  select: {
    id: true,
    displayName: true,
    posts: {
      // Post 전체가 아니라 제목만 선택합니다.
      select: {
        title: true,
      },
    },
  },
});
```

반환 결과의 형태는 다음과 같습니다.  

```json
{
  "id": 135,
  "displayName": "홍길동",
  "posts": [
    { "title": "Prisma 시작하기" }
  ]
}
```

Prisma가 내부에서 실행하는 SQL의 개수와 모양은 관계 로드 전략에 따라 달라질 수 있습니다.  
실제 동작이 궁금하다면 추측하기보다 쿼리 로그에서 확인하는 것이 정확합니다.  

### 🔷 2) `include`: 관계 데이터 포함

`include`는 모델을 조회하면서 연결된 데이터도 함께 가져올 때 사용합니다.  
게시글과 작성자 정보를 함께 보거나 관리자 화면에서 전체 관계를 확인할 때 편리합니다.  

```typescript
// 사용자 기본 정보와 작성한 게시글을 함께 조회합니다.
const userWithPosts = await prisma.user.findUnique({
  // id가 135인 사용자 한 명을 찾습니다.
  where: { id: 135 },

  // include는 User의 기본 필드에 posts 관계를 추가합니다.
  include: {
    // User의 스칼라 필드와 연결된 Post의 스칼라 필드를 함께 가져옵니다.
    posts: true,
  },
});
```

관계의 모든 필드가 필요하지 않다면 `include` 내부에서 `select`를 사용할 수 있습니다.  

```typescript
// 사용자 기본 필드는 유지하고 게시글에서는 제목만 가져옵니다.
const userWithPostTitles = await prisma.user.findUnique({
  where: { id: 135 },
  include: {
    posts: {
      // 관계 안에서는 select로 필요한 필드만 선택할 수 있습니다.
      select: {
        title: true,
      },
    },
  },
});
```

### 🔷 3) 최상위 `select`와 `include`는 동시에 사용할 수 없음

같은 단계에서 `select`와 `include`를 나란히 사용할 수는 없습니다.  
대신 `include` 안에서 `select`를 사용하거나, 최상위 `select`에서 관계 필드까지 선택할 수 있습니다.  

- `select`는 어떤 필드를 반환할지 필드 단위로 정의합니다.
- `select`는 API 응답 구조를 명확하게 통제하는 데 초점을 둡니다.
- `include`는 어떤 관계를 함께 불러올지 정의합니다.
- `include`는 관계형 데이터의 탐색과 로딩에 초점을 둡니다.

### 🔷 4) 중첩 `include`의 이해와 깊이 관리

Prisma는 여러 테이블에 나뉘어 있는 관계 데이터를 한 번의 Client 호출로 조회하여 중첩된 객체로 반환합니다.  

### (1) 중첩 `include`의 편리함

```typescript
// 사용자에서 게시글, 좋아요, 좋아요를 누른 사용자까지 세 단계로 조회합니다.
const userFeed = await prisma.user.findUnique({
  // 조회를 시작할 사용자를 지정합니다.
  where: { id: 1 },
  include: {
    // 첫 번째 단계에서 사용자의 게시글을 포함합니다.
    posts: {
      include: {
        // 두 번째 단계에서 각 게시글의 좋아요를 포함합니다.
        likes: {
          include: {
            // 세 번째 단계에서 좋아요를 누른 사용자까지 포함합니다.
            user: true,
          },
        },
      },
    },
  },
});
```

이 방법을 사용하면 복잡한 `JOIN`을 직접 작성하지 않아도 되며, 반환되는 데이터의 타입도 자동으로 추론됩니다.  

관계 조회가 단일 SQL 또는 테이블별 여러 SQL로 실행되는지는 적용한 관계 로드 전략에 따라 달라집니다.  
여러 SQL을 사용하는 전략에서도 Prisma는 관계 데이터를 묶어서 조회할 수 있습니다.  
따라서 게시글마다 좋아요를 따로 조회하는 식의 반복 코드를 줄일 수 있습니다.  

### (2) 중첩 `include`의 위험성

- **데이터 과다 조회**: `user: true`는 좋아요를 누른 사용자의 이메일과 생성일 등 모든 스칼라 필드를 가져옵니다.
- **메모리 사용량 증가**: 중첩 관계와 데이터가 많을수록 큰 결과 객체를 생성하고 처리해야 합니다.
- **불필요한 부하**: 화면에 게시글 제목만 필요한데 여러 단계 아래의 사용자 정보까지 가져오면 자원이 낭비됩니다.

### (3) 개선 방법: 중첩 `select` 사용

관계가 여러 단계로 이어질 때는 하위 관계에도 `select`와 `take`를 적용하는 것이 좋습니다.  
그러면 필요한 필드와 개수만 조회하여 결과가 지나치게 커지는 것을 막을 수 있습니다.  

```typescript
// 깊은 관계에서도 필요한 데이터만 선택합니다.
const optimizedFeed = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    // 사용자에서는 표시 이름만 가져옵니다.
    displayName: true,
    posts: {
      // 최신 게시글 5개만 가져옵니다.
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        // 게시글에서는 제목만 가져옵니다.
        title: true,
        likes: {
          // 각 게시글의 좋아요도 최대 10개로 제한합니다.
          take: 10,
          select: {
            createdAt: true,
            user: {
              // 좋아요를 누른 사용자는 표시 이름만 가져옵니다.
              select: { displayName: true },
            },
          },
        },
      },
    },
  },
});
```

### 🟦 페이지네이션(Pagination): Offset / Cursor

| 구분 | Offset 기반 | Cursor 기반 |
| --- | --- | --- |
| 적합한 UI | 페이지 번호를 사용하는 게시판 | 무한 스크롤, 타임라인 |
| 성능 특성 | 뒤쪽 페이지일수록 건너뛸 데이터가 늘어납니다. | 고유한 커서를 기준으로 다음 데이터를 찾습니다. |
| 데이터 변경 영향 | 조회 중 데이터가 바뀌면 중복이나 누락이 생길 수 있습니다. | 커서 이후를 조회하므로 변경의 영향을 비교적 적게 받습니다. |
| 전체 개수 파악 | 별도의 `count` 쿼리와 함께 사용하기 쉽습니다. | 전체 개수는 별도의 `count` 쿼리가 필요합니다. |
| 임의 페이지 이동 | 가능합니다. | 이전 커서 없이 바로 이동하기 어렵습니다. |
| 데이터 일관성 | 조회 중 데이터 변경에 영향을 받을 수 있습니다. | 정렬과 커서가 안정적이면 변경의 영향을 줄일 수 있습니다. |
| 추천 상황 | 얕은 페이지 탐색과 소규모 목록 | 대용량 목록의 순차 탐색과 실시간 피드 |
| 주요 조건 | 안정적인 정렬 기준이 필요합니다. | 고유하고 순차적인 커서 필드가 필요합니다. |

페이지네이션 방식은 데이터 개수만 보고 결정하기 어렵습니다.  
화면의 이동 방식, 정렬 기준과 실제 쿼리 속도를 함께 살펴보고 선택합니다.  

- 소규모 프로젝트와 페이지 번호가 필요한 관리자 도구에는 Offset 방식이 편리합니다.
- 데이터가 많고 무한 스크롤을 사용하는 사용자 피드에는 Cursor 방식이 적합합니다.
- 실제 전환 기준은 고정된 레코드 수가 아니라 쿼리 실행 계획과 응답 시간을 측정하여 정합니다.

### 🔷 Offset 기반 페이지네이션

Offset 방식은 앞의 데이터를 일정 개수만큼 건너뛰고(`skip`), 그다음 데이터를 필요한 만큼 가져옵니다(`take`).  

```typescript
// 페이지는 1부터 시작하며, 여기서는 3페이지를 조회합니다.
const page = 3;

// 한 페이지당 10개를 가져옵니다.
const limit = 10;

const posts = await prisma.post.findMany({
  // 앞에서부터 (page - 1) * limit개의 레코드를 건너뜁니다.
  // 3페이지에서는 20개를 건너뛰고 21번째 레코드부터 조회합니다.
  skip: (page - 1) * limit,

  // 이번 페이지에서 가져올 개수입니다.
  take: limit,

  // 최신 글이 먼저 오도록 생성일을 내림차순으로 정렬합니다.
  orderBy: [
    { createdAt: 'desc' },
    { id: 'desc' },
  ],
});
```

- **장점**: 1, 2, 3, 10페이지처럼 특정 페이지로 바로 이동하는 UI를 구현하기 쉽습니다.
- **단점(성능 저하)**: `skip` 값이 커지면 데이터베이스가 앞선 레코드를 건너뛰는 비용도 커집니다.
- **단점(중복과 누락)**: 목록을 보는 동안 데이터가 추가되거나 삭제되면 다음 페이지에서 일부 데이터가 중복되거나 누락될 수 있습니다.

### 🔷 Cursor 기반 페이지네이션

Cursor 방식은 마지막으로 조회한 데이터의 고유한 값을 기준으로 그다음 데이터를 가져옵니다.  
여기서 커서는 다음 목록의 시작 위치를 알려 주는 책갈피와 같습니다.  

> 마지막으로 본 게시글이 `id=100`이라면, 다음 요청은 `id=100`을 커서로 전달하여 그다음 게시글을 가져옵니다.

```typescript
// 이전 페이지에서 마지막으로 받은 게시글의 id입니다.
const lastId = 100;

const posts = await prisma.post.findMany({
  // 다음 게시글 10개만 조회합니다.
  take: 10,

  // id=100인 레코드를 다음 조회의 기준점으로 지정합니다.
  cursor: { id: lastId },

  // 이미 조회한 커서 레코드를 제외하고 그다음부터 가져옵니다.
  skip: 1,

  // id를 오름차순으로 정렬하여 커서 다음 레코드를 가져옵니다.
  orderBy: { id: 'asc' },
});
```

- **장점(성능)**: 많은 레코드를 건너뛰는 Offset 방식의 비용을 피할 수 있습니다.
- **장점(안정성)**: 커서 이후부터 조회하므로 앞쪽 데이터의 추가나 삭제에 영향을 비교적 적게 받습니다.
- **단점**: 이전 커서 없이 특정 페이지로 바로 이동하는 기능은 구현하기 어렵습니다.

### 🔷 복합 정렬 커서(Composite Cursor) 이해하기

실제 API에서는 `id`순뿐만 아니라 `createdAt`을 기준으로 최신 게시글부터 보여 주는 경우가 많습니다.  
그러나 여러 게시글의 `createdAt` 값이 같으면 시간만으로는 각 게시글의 순서를 확정할 수 없습니다.  
이때 `createdAt`을 1차 정렬 기준으로 사용하고 고유한 `id`를 2차 정렬 기준으로 사용하면 순서를 안정적으로 결정할 수 있습니다.  

### 1) 스키마에 복합 고유 제약 조건 추가

Prisma Client의 `cursor`에는 고유 조건을 전달해야 합니다.  
`createdAt`과 `id`를 하나의 복합 커서로 사용하려면 `Post` 모델에 `@@unique([createdAt, id])`를 추가합니다.  

```prisma
model Post {
  // 게시글을 식별하는 자동 증가 기본 키입니다.
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)

  // 생성 시각과 마지막 수정 시각을 저장합니다.
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // 여러 Post가 한 User를 참조하는 다대일 관계를 정의합니다.
  authorId Int  @map("author_id")
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // 게시글에 연결된 좋아요 목록입니다.
  likes PostLike[]

  // createdAt과 id를 함께 사용하는 복합 커서를 생성합니다.
  @@unique([createdAt, id])
  @@index([authorId])
  @@map("posts")
}
```

스키마를 데이터베이스에 반영하고 Prisma Client를 다시 생성하면 `createdAt_id`라는 복합 고유 입력을 사용할 수 있습니다.  
`id` 자체가 이미 기본 키이므로 이 제약 조건은 데이터의 고유성을 새롭게 강화하기보다는 `createdAt_id` 복합 입력과 해당 인덱스를 생성하는 역할을 합니다.  

### 2) 복합 커서 조회 예시

```typescript
// 이전 페이지에서 마지막으로 받은 게시글의 커서입니다.
const lastCursor = {
  createdAt: new Date('2025-12-24T00:00:00.000Z'),
  id: 105,
};

const posts = await prisma.post.findMany({
  take: 10,

  // @@unique([createdAt, id])로 생성된 복합 고유 입력을 사용합니다.
  cursor: {
    createdAt_id: lastCursor,
  },

  // 최신 작성일을 먼저 정렬하고, 시간이 같으면 큰 id를 먼저 정렬합니다.
  orderBy: [
    { createdAt: 'desc' },
    { id: 'desc' },
  ],

  // 이전 페이지에서 이미 받은 커서 레코드는 제외합니다.
  skip: 1,
});
```

- `createdAt`: 최신 게시글부터 정렬하는 1차 기준입니다.
- `id`: `createdAt`이 같은 게시글의 순서를 결정하는 2차 기준입니다.
- `createdAt_id`: 두 값을 모두 전달하여 이전 페이지의 마지막 레코드를 정확하게 식별합니다.
- `skip: 1`: 커서로 지정한 레코드를 제외하고 다음 레코드부터 반환합니다.

### 🔷 Cursor 데이터 흐름

Cursor 페이지네이션에서는 클라이언트와 서버가 마지막 데이터의 위치를 커서로 주고받습니다.  
전체 흐름은 다음과 같습니다.  

1. 첫 요청에서 클라이언트는 커서 없이 목록을 요청합니다.
2. 서버는 게시글 목록과 마지막 게시글의 `createdAt`, `id`를 다음 커서로 응답합니다.
3. 다음 요청에서 클라이언트는 받은 `createdAt`, `id`를 전달합니다.
4. 서버는 두 값을 `createdAt_id`에 넣고 `skip: 1`로 커서 다음 데이터부터 조회합니다.

![복합 커서 기반 페이지네이션 결과 예시](/assets/images/nodejs/nodejs-prisma/image-2026-01-16-composite-cursor.png)

## 2. 관계 데이터 생성 패턴: connect / create / connectOrCreate {#session-02}

Prisma에서 관계 데이터를 만들 때는 외래 키를 직접 넣거나 관계 API를 사용할 수 있습니다.  
관계 API를 사용하면 기존 데이터를 연결하는지, 새로운 데이터를 함께 만드는지 코드만 보고 쉽게 구분할 수 있습니다.  

| 상황 | 추천 패턴 | 이유 |
| --- | --- | --- |
| 기존 데이터와 연결 | `connect` | 연결 의도가 명확하며 대상이 없으면 오류가 발생합니다. |
| 관계 데이터를 함께 생성 | `create` | 중첩 쓰기를 트랜잭션으로 처리합니다. |
| 존재 여부가 불확실함 | `connectOrCreate` | 고유 조건을 기준으로 연결하거나 생성합니다. |
| 명시적 다대다 관계 | 중간 모델 생성 | 관계에 생성일 같은 추가 정보를 저장할 수 있습니다. |

### 🟦 `connect`: 기존 데이터와 명시적으로 연결

외래 키 ID를 직접 넣는 방법과 `connect`를 사용하는 방법은 같은 관계를 서로 다른 방식으로 표현합니다.  

### 🔷 1) 외래 키 직접 할당

제공된 스키마에서는 `authorId`에 기존 사용자 ID를 직접 할당할 수 있습니다.  
존재하지 않는 값을 저장할 수 있는지는 데이터베이스의 외래 키 제약과 Prisma의 관계 모드 설정에 영향을 받습니다.  

```typescript
// authorId에 기존 사용자의 ID를 직접 넣어 게시글을 생성합니다.
await prisma.post.create({
  data: {
    title: '게시글',

    // id가 1인 사용자를 게시글 작성자로 지정합니다.
    authorId: 1,
  },
});
```

### 🔷 2) 관계 연결

`connect`는 `@id` 또는 `@unique`로 찾을 수 있는 기존 데이터를 관계에 연결합니다.  
연결하려는 데이터가 없으면 오류가 발생하므로 예외 처리도 준비해야 합니다.  

```typescript
// 실제 애플리케이션에서는 로그인 세션에서 사용자 ID를 가져옵니다.
const userId = 1;

await prisma.post.create({
  // 게시글의 필드와 작성자 관계를 함께 설정합니다.
  data: {
    title: 'Prisma 완벽 가이드',
    content: '관계 생성 패턴을 설명합니다.',

    // 기존 User를 게시글의 작성자로 연결합니다.
    author: {
      connect: { id: userId },
    },
  },
});
```

### 🟦 `create`: 관계 레코드 동시 생성

중첩 `create`를 사용하면 서로 연결된 데이터를 한 번의 Prisma Client 호출로 함께 만들 수 있습니다.  
Prisma는 이 작업을 하나의 트랜잭션으로 처리하므로, 중간에 실패하면 앞에서 만든 데이터도 함께 되돌립니다.  

### 🔷 사용자와 여러 게시글 함께 생성

```typescript
// 사용자 한 명과 그 사용자의 게시글 두 개를 함께 생성합니다.
await prisma.user.create({
  data: {
    email: 'author@prisma.io',
    displayName: '작성자 A',

    // User를 생성하면서 여러 Post도 함께 생성합니다.
    // Post.authorId는 Prisma가 생성된 User의 ID로 연결합니다.
    posts: {
      create: [
        {
          title: '첫 번째 게시글',
          content: '반갑습니다.',
          published: true,
        },
        {
          title: '두 번째 게시글',
          content: 'Prisma 7을 공부하고 있습니다.',
        },
      ],
    },
  },
});
```

### 🔷 게시글과 작성자 함께 생성

```typescript
// 게시글과 새로운 작성자를 한 번에 생성합니다.
await prisma.post.create({
  data: {
    title: '게시글',
    author: {
      // 게시글을 생성하면서 새 작성자를 함께 생성합니다.
      create: {
        email: 'newauthor@example.com',
        displayName: '새 작성자',
      },
    },
  },
});
```

### 🟦 `connectOrCreate`: 조건부 생성

`connectOrCreate`는 조건에 맞는 데이터가 있으면 연결하고, 없으면 새로 만듭니다.  
`where`에는 `@id` 또는 `@unique`로 지정된 고유 조건을 사용해야 합니다.  
외부 시스템에서 받은 데이터처럼 이미 저장되어 있는지 미리 알기 어려울 때 유용합니다.  

```typescript
// 작성자가 이미 있는지 확인한 뒤 연결하거나 새로 생성합니다.
await prisma.post.create({
  data: {
    title: '연동 게시글',
    author: {
      connectOrCreate: {
        // User.email은 @unique 필드이므로 조회 조건으로 사용할 수 있습니다.
        where: { email: 'guest@external.com' },
        create: {
          email: 'guest@external.com',
          displayName: '게스트',
        },
      },
    },
  },
});
```

동시에 같은 고유 값으로 여러 요청이 들어올 수 있으므로 고유 제약 조건 위반 오류에 대한 처리도 준비해야 합니다.  

### 🟦 다대다 관계: `PostLike` 명시적 중간 모델

`PostLike` 같은 중간 모델을 만들면 사용자와 게시글의 다대다 관계를 직접 관리할 수 있습니다.  
좋아요를 누른 시각처럼 관계 자체에 필요한 정보도 함께 저장할 수 있습니다.  

```prisma
model PostLike {
  // User와 Post를 연결하는 두 외래 키입니다.
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")

  // 좋아요를 누른 시각을 자동으로 저장합니다.
  createdAt DateTime @default(now()) @map("created_at")

  // 각 외래 키가 참조하는 관계를 정의합니다.
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  // 같은 사용자가 같은 게시글에 좋아요를 두 번 누르지 못하게 합니다.
  @@id([userId, postId])

  // 게시글별 좋아요를 빠르게 찾기 위한 인덱스입니다.
  @@index([postId])
  @@map("post_likes")
}
```

### 🔷 게시글 좋아요 추가

```typescript
// id가 1인 사용자가 id가 10인 게시글에 누른 좋아요를 생성합니다.
await prisma.postLike.create({
  data: {
    // 기존 User와 Post를 PostLike에 연결합니다.
    user: {
      // 기존 사용자를 좋아요에 연결합니다.
      connect: { id: 1 },
    },
    post: {
      // 기존 게시글을 좋아요에 연결합니다.
      connect: { id: 10 },
    },
  },
});
```

복합 기본 키 `@@id([userId, postId])`가 같은 사용자의 중복 좋아요를 방지합니다.  

### 🔷 게시글 좋아요 취소

제공된 스키마에는 소프트 삭제 필드가 없으므로 좋아요 취소 시 중간 레코드를 삭제합니다.  

```typescript
// 삭제할 좋아요의 사용자 ID와 게시글 ID를 준비합니다.
const userId = 1;
const postId = 10;

// 두 ID로 좋아요 레코드를 찾아 삭제합니다.
await prisma.postLike.delete({
  // @@id([userId, postId])가 생성한 복합 키 이름을 사용합니다.
  where: {
    userId_postId: {
      userId,
      postId,
    },
  },
});
```
