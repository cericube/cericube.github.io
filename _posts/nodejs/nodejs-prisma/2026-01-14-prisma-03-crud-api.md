---
layout: post
title: "03. Prisma Client Query 구조와 CRUD API 이해하기"
description: "Prisma Client Query의 기본 구조와 공통 인자를 살펴보고, User·Post·PostLike 실습 스키마로 생성·조회·수정·삭제·upsert API를 익힙니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prisma Client Query 구조 이해"
  - id: session-02
    title: "2. CRUD 실전 API: create / read / update / delete / upsert"
---

## 1. Prisma Client Query 구조 이해 {#session-01}

### 🟦 Prisma Client 호출의 핵심 구조

Prisma 7에서도 기본적인 호출 형태는 동일하며, 스키마를 기반으로 생성된 타입을 TypeScript에서 활용할 수 있습니다.  

```typescript
const result = await prisma.post.findMany({
  where: { published: true },
});
```

- `model`: `User`, `PostLike`처럼 스키마에 정의된 모델 이름을 camelCase로 바꾼 형태입니다(`prisma.user`, `prisma.postLike`).
- `action`: 데이터베이스에 수행할 연산입니다.  
- `args`: 무엇을 `where`로 찾고, 어떤 데이터를 `data`로 처리하며, 결과를 `orderBy`나 `select`로 어떻게 구성할지 결정하는 객체입니다.  

예를 들어 공개된 게시글은 다음과 같이 조회합니다.  

```typescript
const posts = await prisma.post.findMany({
  where: { published: true },
});
```

### 🟦 Action 종류(CRUD + α)

Prisma Client에서 제공하는 Action은 CRUD를 중심으로 구성되며, 집계와 트랜잭션 같은 확장 API도 함께 제공합니다.  

- 참고: [Prisma Client API Reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference){: target="_blank" rel="noopener noreferrer" }

#### 🔷 Create Actions

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `create` | 단일 레코드를 생성합니다. | `Model` |
| `createMany` | 여러 레코드를 한 번에 생성합니다. | `BatchPayload`(일반적으로 `{ count }`) |
| `createManyAndReturn` | 여러 레코드를 생성하고 생성된 레코드를 반환합니다. | `Model[]` |

#### 🔷 Read Actions

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `findUnique` | 고유 조건으로 한 건을 조회합니다. | `Model \| null` |
| `findUniqueOrThrow` | 고유 조건으로 한 건을 조회하고, 없으면 예외를 발생시킵니다. | `Model` |
| `findFirst` | 조건에 맞는 첫 번째 레코드를 조회합니다. | `Model \| null` |
| `findFirstOrThrow` | 조건에 맞는 첫 번째 레코드를 조회하고, 없으면 예외를 발생시킵니다. | `Model` |
| `findMany` | 여러 레코드를 조회합니다. | `Model[]` |

#### 🔷 Update Actions

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `update` | 고유 조건으로 한 건을 수정합니다. | `Model` |
| `updateMany` | 조건에 맞는 여러 레코드를 수정합니다. | `BatchPayload`(일반적으로 `{ count }`) |
| `updateManyAndReturn` | 여러 레코드를 수정하고 수정된 레코드를 반환합니다. | `Model[]` |

#### 🔷 Delete Actions

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `delete` | 고유 조건으로 한 건을 삭제합니다. | `Model` |
| `deleteMany` | 조건에 맞는 여러 레코드를 삭제합니다. | `BatchPayload`(일반적으로 `{ count }`) |

#### 🔷 Mixed

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `upsert` | 레코드가 있으면 수정하고, 없으면 생성합니다. | `Model` |

#### 🔷 집계와 그룹

| Action | 설명 | 반환 타입 |
| --- | --- | --- |
| `count` | 조건이나 필드를 기준으로 개수를 계산합니다. | `number` 또는 선택한 `select` 형태 |
| `aggregate` | `_count`, `_avg`, `_sum`, `_min`, `_max`를 집계합니다. | 선택한 집계 형태 |
| `groupBy` | 데이터를 그룹화하고 집계합니다. | 그룹 결과 배열 |

#### 🔷 기타

| 분류 | API | 설명 |
| --- | --- | --- |
| Transaction | `$transaction` | 여러 작업을 하나의 트랜잭션으로 처리합니다. |
| Raw SQL | `$queryRaw`, `$executeRaw` | 필요한 경우 원시 SQL을 실행합니다. |

### 🟦 Args 객체의 공통 구성 요소

Prisma Client의 `args` 객체는 다음과 같은 공통 필드로 구성됩니다.  

```typescript
const result = await prisma.user.findMany({
  // 1. where: 공개 게시글이 있는 사용자 중 특정 이메일을 조회합니다.
  where: {
    email: { contains: 'prisma' },
    posts: { some: { published: true } },
  },

  // 2. omit: 전체 스칼라 필드 중 필요하지 않은 필드를 제외합니다.
  omit: {
    createdAt: true,
  },

  // 3. include: 관계 데이터인 게시글 목록을 함께 가져옵니다.
  include: {
    posts: {
      where: { title: { contains: 'Guide' } },
      orderBy: { createdAt: 'desc' },
    },
  },

  // 4. orderBy: 생성일 내림차순, 표시 이름 오름차순으로 정렬합니다.
  orderBy: [{ createdAt: 'desc' }, { displayName: 'asc' }],

  // 5. take와 skip: 10개를 가져오되 앞의 5개를 건너뜁니다.
  take: 10,
  skip: 5,

  // 6. distinct: 표시 이름을 기준으로 중복 결과를 제거합니다.
  distinct: ['displayName'],
});
```

| 요소 | 설명 | 주로 사용하는 Action |
| --- | --- | --- |
| `where` | 필드와 관계 조건으로 결과를 필터링합니다. | `find*`, `update*`, `delete*`, `count`, `aggregate` 등 |
| `data` | 삽입하거나 수정할 실제 데이터를 지정합니다. | `create`, `createMany`, `update`, `updateMany`, `upsert` |
| `select` | 반환할 필드만 선택합니다. | 대부분의 `find*`, `create`, `update`, `upsert` |
| `include` | 관계 데이터를 함께 불러옵니다. | 대부분의 `find*`, `create`, `update`, `upsert` |
| `omit` | 반환 결과에서 지정한 필드를 제외합니다. | 지원되는 조회와 쓰기 Action |
| `orderBy` | 단일 또는 복수 기준으로 정렬합니다. | 주로 `findMany` |
| `take` | 가져올 결과 개수를 제한합니다. | 주로 `findMany` |
| `skip` | 지정한 개수만큼 결과를 건너뜁니다. | 주로 `findMany` |
| `cursor` | 커서 기반 페이지네이션의 기준점을 지정합니다. | `findMany` |
| `distinct` | 지정한 필드를 기준으로 중복 결과를 제거합니다. | 주로 `findMany` |
| `skipDuplicates` | 고유 제약 조건이 충돌하는 레코드를 건너뜁니다. | `createMany` |

API 응답 형식을 엄격하게 제한하거나 반환 데이터의 양을 줄여야 한다면 `select`를 중심으로 사용합니다.  
화면이나 보고서에서 관계 데이터까지 함께 불러오는 것이 중요하다면 `include`를 중심으로 사용합니다.  
`select`와 `include`는 같은 쿼리의 최상위 수준에서 함께 사용할 수 없습니다.  

### 🟦 `undefined`와 `null`

Prisma Client에서 `undefined`와 `null`은 서로 다른 의미를 가집니다.  
기본 동작에서는 `undefined`인 필드를 쿼리에서 제외하지만, `strictUndefinedChecks` Preview 기능을 사용하면 명시적인 `undefined` 전달 시 런타임 오류가 발생합니다.  
선택적 값을 안전하게 제외하려면 `undefined`를 직접 전달하지 않고 조건에 따라 `data` 객체를 구성하는 편이 좋습니다.  

```typescript
const displayName: string | undefined = undefined;

// 값이 있을 때만 displayName 속성을 data에 추가합니다.
await prisma.user.update({
  where: { id: 1 },
  data: {
    ...(displayName !== undefined && { displayName }),
  },
});

// null은 nullable 필드에 데이터베이스의 NULL을 명시적으로 저장합니다.
await prisma.user.update({
  where: { id: 1 },
  data: {
    displayName: null,
  },
});
```

## 2. CRUD 실전 API: create / read / update / delete / upsert {#session-02}

### 🟦 Create: 데이터 생성의 5가지 실전 패턴

#### 🔷 1) 관계 데이터의 중첩 생성(Nested Write)

`User`와 `Post`가 1:N 관계일 때 별도로 사용자 ID를 조회하지 않고 한 번의 API 호출로 두 테이블에 데이터를 삽입합니다.  
Nested Write 도중 한 작업이라도 실패하면 전체 작업이 롤백됩니다.  

```typescript
/**
 * [패턴 1] User와 Post를 함께 생성합니다.
 * 반환값에는 기본적으로 User의 스칼라 필드만 포함됩니다.
 */
async function runCreate() {
  return prisma.user.create({
    data: {
      email: 'cericube1@naver.com',
      displayName: 'cericube1',
      posts: {
        // User를 생성하면서 첫 번째 Post도 함께 생성합니다.
        create: { title: '첫 게시글', content: '반갑습니다!' },
      },
    },
  });
}
```

#### 🔷 2) 1:N 관계의 다중 생성(Nested Create)

사용자 한 명을 만들면서 여러 게시글을 함께 생성합니다.  
데이터가 적을 때 이해하기 쉬운 방식입니다.  

```typescript
/**
 * [패턴 2] User와 여러 Post를 함께 생성합니다.
 * include를 사용하여 생성된 관계 데이터도 반환받습니다.
 */
async function runCreateWithMultiCreate() {
  return prisma.user.create({
    data: {
      email: 'cericube2@naver.com',
      posts: {
        create: [
          { title: '제목1', content: '내용1' },
          { title: '제목2', content: '내용2' },
        ],
      },
    },
    // 반환값에 posts 배열을 포함합니다.
    include: { posts: true },
  });
}
```

#### 🔷 3) 중첩 다중 생성(Nested CreateMany)

`createMany`를 중첩하여 여러 게시글을 한 번에 생성합니다.  
중복 레코드를 건너뛰어야 할 때 유용하지만, 중복 판단에 사용할 고유 제약 조건이 스키마에 있어야 합니다.  

```typescript
/**
 * [패턴 3] User를 생성하면서 여러 Post를 한 번에 삽입합니다.
 */
async function runCreateWithCreateMany() {
  return prisma.user.create({
    data: {
      email: 'cericube3@naver.com',
      posts: {
        createMany: {
          data: [
            { title: '공지사항1', content: '내용' },
            { title: '공지사항2', content: '내용' },
          ],
        },
      },
    },
    include: { posts: true },
  });
}
```

현재 실습 스키마의 `Post`에는 제목을 포함한 별도의 고유 제약 조건이 없으므로 이 예시에는 `skipDuplicates`를 지정하지 않습니다.  

#### 🔷 4) 생성 데이터 즉시 반환(`createManyAndReturn`)

여러 건을 한 번에 삽입하면서 데이터베이스가 생성한 ID와 기본값을 배열로 반환받습니다.  
PostgreSQL에서는 `createManyAndReturn`을 사용할 수 있습니다.  

```typescript
/**
 * [패턴 4] 여러 Post를 생성하고 필요한 필드를 반환받습니다.
 */
async function runCreateManyAndReturn(userId: number) {
  return prisma.post.createManyAndReturn({
    data: [
      { title: '패턴4-1', authorId: userId },
      { title: '패턴4-2', authorId: userId },
    ],
    // 필요한 필드만 선택하여 반환 데이터의 양을 줄입니다.
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });
}
```

#### 🔷 5) 단순 벌크 삽입(`createMany`)

관계 데이터 반환이 필요 없고 성공한 건수만 중요할 때 사용합니다.  

```typescript
/**
 * [패턴 5] 한 사용자의 좋아요 두 건을 한 번에 생성합니다.
 * 반환값은 { count: number } 형태입니다.
 */
async function runCreateMany(
  userId: number,
  firstPostId: number,
  secondPostId: number,
) {
  return prisma.postLike.createMany({
    data: [
      { userId, postId: firstPostId },
      { userId, postId: secondPostId },
    ],
    // @@id([userId, postId])가 충돌하는 레코드는 건너뜁니다.
    skipDuplicates: true,
  });
}
```

### 🟦 Read: 조회 API의 전략적 선택

#### 🔷 1) `findUnique`와 `findUniqueOrThrow`: 정확한 대상 조회

`findUnique`와 `findUniqueOrThrow`는 `@id`, `@unique`, `@@id`, `@@unique`로 고유하게 식별할 수 있는 조건에 사용합니다.  

```typescript
/**
 * [1] findUnique는 레코드가 없으면 null을 반환합니다.
 */
async function runFindUnique(email: string) {
  return prisma.user.findUnique({
    // email은 @unique 필드입니다.
    where: { email },
    select: { id: true, email: true, displayName: true },
  });
}

/**
 * [2] findUniqueOrThrow는 레코드가 없으면 예외를 발생시킵니다.
 */
async function runFindUniqueOrThrow(postId: number) {
  return prisma.post.findUniqueOrThrow({
    where: { id: postId },
    // 게시글을 작성한 사용자의 표시 이름도 함께 조회합니다.
    include: {
      author: { select: { displayName: true } },
    },
  });
}
```

#### 🔷 2) `findFirst`와 `findFirstOrThrow`: 조건에 맞는 첫 번째 레코드 조회

고유 필드가 아닌 `authorId`, `published` 같은 일반 필드로 첫 번째 레코드를 찾을 때 사용합니다.  
어떤 레코드를 첫 번째로 볼지 명확해야 한다면 `orderBy`를 함께 지정합니다.  

```typescript
/**
 * [3] 특정 사용자가 작성한 가장 최근 게시글을 조회합니다.
 */
async function runFindFirst(userId: number) {
  return prisma.post.findFirst({
    where: {
      authorId: userId,
      published: true,
    },
    // 최신 게시글을 선택하도록 정렬 기준을 명시합니다.
    orderBy: { createdAt: 'desc' },
    include: {
      // 게시글의 좋아요 개수를 함께 조회합니다.
      _count: { select: { likes: true } },
    },
  });
}
```

#### 🔷 3) `findMany`: 목록과 페이지네이션

`findMany`는 0개 이상의 레코드를 배열로 반환합니다.  
대량 조회를 피하려면 `take`와 `skip` 또는 커서 기반 페이지네이션을 적용합니다.  

```typescript
/**
 * [4] 공개된 공지 게시글 목록을 페이지 단위로 조회합니다.
 */
async function runFindMany(page: number = 1, pageSize: number = 10) {
  return prisma.post.findMany({
    where: {
      published: true,
      // 제목에 '공지'가 포함된 게시글만 조회합니다.
      title: { contains: '공지' },
    },
    take: pageSize,
    // 오프셋 기반 페이지네이션을 적용합니다.
    skip: (page - 1) * pageSize,
    orderBy: { createdAt: 'desc' },
  });
}
```

### 🟦 Update와 Upsert: 수정 API의 안정성과 무결성

Prisma의 수정 API는 대상의 존재 여부에 따라 예외를 발생시키거나 수정 건수를 반환합니다.  

#### 🔷 1) `update`: 단건 수정과 관계 업데이트

`where`에는 고유하게 식별할 수 있는 조건이 필요하며, 레코드가 없으면 예외가 발생합니다.  

```typescript
/**
 * [1] User의 표시 이름과 관계된 Post의 제목을 함께 수정합니다.
 */
async function runUpdate(userId: number, postId: number) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      displayName: '새로운 이름',
      posts: {
        // 이 사용자와 관계된 Post를 중첩 수정합니다.
        update: {
          where: { id: postId },
          data: { title: '수정된 게시글 제목' },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      posts: { select: { id: true, title: true } },
    },
  });
}
```

지정한 게시글이 해당 사용자와 연결되어 있지 않거나 존재하지 않으면 중첩 수정이 실패합니다.  

#### 🔷 2) `updateMany`: 안전한 일괄 수정

조건에 맞는 모든 레코드를 수정합니다.  
대상이 없어도 예외 없이 `{ count: 0 }`을 반환하므로 배치 작업에 적합합니다.  

```typescript
/**
 * [2] 특정 사용자의 미공개 게시글을 모두 공개합니다.
 */
async function runUpdateMany(userId: number) {
  const result = await prisma.post.updateMany({
    where: {
      authorId: userId,
      published: false,
    },
    data: { published: true },
  });

  console.log(`수정된 행 수: ${result.count}`);
  return result;
}
```

#### 🔷 3) `updateManyAndReturn`: 수정과 동시에 데이터 반환

`updateManyAndReturn`은 여러 레코드를 수정하고 수정된 레코드 목록을 즉시 반환합니다.  
PostgreSQL에서는 이 API를 사용할 수 있습니다.  

```typescript
/**
 * [3] 여러 Post를 수정한 후 변경된 목록을 반환받습니다.
 */
async function runUpdateManyAndReturn(userId: number) {
  return prisma.post.updateManyAndReturn({
    where: { authorId: userId },
    data: { content: '일괄 업데이트된 내용' },
    // 관계 필드가 아닌 Post의 스칼라 필드만 선택합니다.
    select: {
      id: true,
      title: true,
      updatedAt: true,
    },
  });
}
```

#### 🔷 4) `upsert`: 존재하면 수정하고 없으면 생성

중복 생성을 막으면서 데이터를 최신 상태로 유지할 때 사용합니다.  

```typescript
/**
 * [4] 이메일을 기준으로 User를 생성하거나 수정합니다.
 */
async function runUpsert(email: string) {
  return prisma.user.upsert({
    // email은 @unique 필드이므로 고유 조건으로 사용할 수 있습니다.
    where: { email },
    create: {
      email,
      displayName: '신규 가입자',
      posts: {
        create: { title: '가입 인사', content: '반갑습니다!' },
      },
    },
    update: {
      displayName: '기존 사용자 갱신',
      posts: {
        create: { title: '사용자 정보 갱신', content: '정보를 갱신했습니다.' },
      },
    },
    include: { posts: true },
  });
}
```

### 🟦 Delete: 물리 삭제와 데이터 무결성 관리

Prisma에서 삭제할 때는 대상이 존재하는지와 외래 키로 연결된 데이터가 어떻게 처리되는지 먼저 확인해야 합니다.  

#### 🔷 1) 단일 레코드 삭제(`delete`)

`delete`의 `where`에는 고유 조건이 필요하며, 삭제 대상이 없으면 예외가 발생합니다.  
`PostLike`는 `@@id([userId, postId])`로 정의되어 있으므로 복합 키를 사용해 삭제합니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';

/**
 * 사용자 ID와 게시글 ID로 좋아요 한 건을 삭제합니다.
 */
async function runDelete(userId: number, postId: number) {
  try {
    const deletedLike = await prisma.postLike.delete({
      where: {
        // 복합 기본 키의 기본 필드명은 userId_postId입니다.
        userId_postId: { userId, postId },
      },
      select: {
        userId: true,
        postId: true,
        createdAt: true,
      },
    });

    console.log('✅ 삭제 성공:', deletedLike);
  } catch (error: unknown) {
    // P2025는 필요한 레코드를 찾지 못했을 때 발생합니다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      console.error('❌ 삭제 실패: 해당 좋아요를 찾을 수 없습니다.');
      return;
    }

    throw error;
  }
}
```

#### 🔷 2) 다중 레코드 삭제(`deleteMany`)

조건에 맞는 모든 데이터를 삭제하며, 대상이 없어도 예외가 발생하지 않고 `{ count: 0 }`을 반환합니다.  

```typescript
/**
 * 특정 사용자가 등록한 모든 좋아요를 삭제합니다.
 */
async function runDeleteMany(userId: number) {
  const result = await prisma.postLike.deleteMany({
    where: { userId },
  });

  console.log(`삭제 완료: 총 ${result.count}개의 좋아요가 삭제되었습니다.`);
  return result;
}
```
