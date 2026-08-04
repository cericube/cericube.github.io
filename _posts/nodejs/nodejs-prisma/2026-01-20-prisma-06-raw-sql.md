---
layout: post
title: "06. Prisma Raw SQL 실전 활용"
description: "Prisma 7에서 $queryRaw와 $executeRaw로 Raw SQL을 실행하고, SQL Injection을 방지하며 동적 쿼리와 키셋 페이지네이션을 구성하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. $queryRaw: 조회 전용 Raw SQL 다루기"
  - id: session-02
    title: "2. $executeRaw: 데이터 변경 및 DDL 쿼리 실행하기"
  - id: session-03
    title: "3. Prisma Raw SQL 보안: SQL Injection 방지 원리"
  - id: session-04
    title: "4. Prisma.sql: 유연하고 안전한 동적 쿼리 조립"
---

## 1. $queryRaw: 조회 전용 Raw SQL 다루기 {#session-01}

Prisma Client의 기본 쿼리 API만으로 표현하기 어려운 통계, 집계 함수 또는 데이터베이스 전용 기능이 필요할 때가 있습니다.  
이럴 때 `$queryRaw`로 SQL을 직접 작성하여 조회할 수 있습니다.  

### 🟦 `$queryRaw`의 핵심 개념: 보안과 효율

`$queryRaw`는 `SELECT` 같은 조회 SQL을 실행하고 실제 데이터베이스 레코드를 반환합니다.  

- **Tagged Template Literal 방식**: `$queryRaw` 뒤에 괄호 대신 백틱을 붙여 SQL을 작성합니다.  
- **파라미터 바인딩**: `${variable}`로 전달한 값은 SQL 문장과 분리되어 데이터베이스 파라미터로 처리됩니다.  
- **결과 형식**: 조회 결과는 배열이며, 결과가 없으면 빈 배열을 반환합니다.  

파라미터 바인딩은 값을 안전하게 전달하지만, 테이블명이나 컬럼명 같은 식별자에는 사용할 수 없습니다.  

### 🟦 타입 정의와 컬럼 매핑(Type Casting)

Prisma는 Raw SQL의 결과 구조를 스키마만으로 정확히 추론할 수 없습니다.  
따라서 TypeScript에서 결과 타입을 정의하고 `$queryRaw<T>`의 제네릭으로 전달합니다.  

> 제네릭 타입은 컴파일 단계에서 사용하는 힌트입니다.  
> 런타임의 데이터 구조를 검사하거나 변환하지는 않습니다.  

SQL의 별칭과 TypeScript 타입의 필드명은 정확히 일치해야 합니다.  
PostgreSQL의 snake_case 컬럼을 camelCase 필드로 받으려면 다음 예제처럼 큰따옴표 별칭을 지정합니다.  

### 🟦 특수 타입 처리(BigInt 및 Decimal)

Raw SQL을 사용할 때는 데이터베이스 타입이 JavaScript에서 어떤 타입으로 반환되는지 확인해야 합니다.  

### 🔷 BigInt

PostgreSQL의 `COUNT(*)`와 `BIGINT` 결과는 JavaScript의 `bigint`로 반환될 수 있습니다.  
`JSON.stringify()`는 기본적으로 `bigint`를 처리하지 못하므로 SQL에서 `::int`로 변환하거나, 안전한 범위인지 확인한 뒤 코드에서 `Number()`로 변환합니다.  

### 🔷 Decimal

데이터베이스의 Decimal 값은 Prisma의 Decimal 객체로 반환됩니다.  
API 응답에는 `.toString()`을 사용할 수 있으며, 정밀도 손실이 허용되는 값만 `.toNumber()`로 변환합니다.  

### 🟦 예제: 게시글 통계와 작성자별 조회

첫 번째 함수는 사용자, 게시글과 좋아요를 조인하여 게시글 통계를 만듭니다.  
두 번째 함수는 `${authorId}`를 값으로 바인딩하여 특정 작성자의 공개 게시글을 조회합니다.  

```typescript
import { prisma } from '../shared/database';

// Raw SQL의 SELECT 별칭과 같은 이름으로 결과 타입을 정의합니다.
export type PostStatisticsRow = {
  postId: number;
  title: string;
  authorName: string | null;
  likeCount: number;
  createdAt: Date;
};

// 게시글, 작성자와 좋아요 통계를 조회합니다.
export async function runQueryRawPostStatistics() {
  const posts = await prisma.$queryRaw<PostStatisticsRow[]>`
    SELECT
      p.id AS "postId",
      p.title,
      u.display_name AS "authorName",
      COUNT(pl.user_id)::int AS "likeCount",
      p.created_at AS "createdAt"
    FROM study.posts AS p
    INNER JOIN study.users AS u ON u.id = p.author_id
    LEFT JOIN study.post_likes AS pl ON pl.post_id = p.id
    GROUP BY p.id, p.title, p.created_at, u.display_name
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 10
  `;

  // COUNT를 ::int로 변환했으므로 likeCount를 number로 다룰 수 있습니다.
  console.dir(posts, { depth: null });
  return posts;
}

export type AuthorPostRow = {
  id: number;
  title: string;
  published: boolean;
  createdAt: Date;
};

// 특정 작성자의 공개 게시글을 조회합니다.
export async function runQueryRawByAuthor(authorId: number) {
  const posts = await prisma.$queryRaw<AuthorPostRow[]>`
    SELECT
      p.id,
      p.title,
      p.published,
      p.created_at AS "createdAt"
    FROM study.posts AS p
    WHERE p.author_id = ${authorId}
      AND p.published = TRUE
    ORDER BY p.created_at DESC, p.id DESC
  `;

  // authorId는 SQL 문법이 아니라 값으로 바인딩됩니다.
  console.dir(posts, { depth: null });
  return posts;
}
```

## 2. $executeRaw: 데이터 변경 및 DDL 쿼리 실행하기 {#session-02}

Prisma의 `updateMany()` 같은 기본 메서드로 표현하기 어려운 데이터 변경 SQL은 `$executeRaw`로 실행할 수 있습니다.  
`$executeRaw`는 조회 결과가 아니라 SQL의 영향을 받은 행 개수를 `number`로 반환합니다.  

### 🟦 `$executeRaw`의 역할과 특징

- **반환 값**: `UPDATE`나 `DELETE` 등으로 영향을 받은 행 개수를 반환합니다.  
- **주요 용도**: 데이터 변경 쿼리와 일부 데이터베이스 명령을 실행합니다.  
- **파라미터 처리**: Tagged Template Literal을 올바르게 사용하면 `${variable}` 값을 SQL과 분리하여 전달합니다.  

### 🟦 예제: 게시글 일괄 변경과 트랜잭션

첫 번째 함수는 특정 작성자의 공개 게시글을 비공개로 바꾸고, 두 번째 함수는 사용자와 게시글 변경을 하나의 트랜잭션으로 처리합니다.  

```typescript
import { prisma } from '../shared/database';

// 특정 작성자의 공개 게시글을 모두 비공개로 변경합니다.
export async function runExecuteRawUnpublishByAuthor(authorId: number) {
  // Raw SQL은 Prisma의 @updatedAt 처리를 거치지 않으므로 updated_at도 갱신합니다.
  const affectedCount = await prisma.$executeRaw`
    UPDATE study.posts
    SET
      published = FALSE,
      updated_at = NOW()
    WHERE author_id = ${authorId}
      AND published = TRUE
  `;

  console.log(`비공개로 변경된 게시글 수: ${affectedCount}개`);
  return affectedCount;
}

// 표시 이름 변경과 게시글 비공개 처리를 함께 실행합니다.
export async function runExecuteRawTransaction(userId: number, displayName: string) {
  const [updatedUserCount, unpublishedPostCount] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE study.users
      SET display_name = ${displayName}
      WHERE id = ${userId}
    `,
    prisma.$executeRaw`
      UPDATE study.posts
      SET
        published = FALSE,
        updated_at = NOW()
      WHERE author_id = ${userId}
        AND published = TRUE
    `,
  ]);

  const result = {
    updatedUserCount,
    unpublishedPostCount,
  };

  console.log(result);
  return result;
}
```

### 🟦 DDL 사용 시 주의사항

Raw SQL로 데이터베이스 구조를 변경할 수 있더라도 스키마 변경 이력은 Prisma Migrate로 관리하는 편이 안전합니다.  
특히 PostgreSQL의 `ALTER` 명령은 Prepared Statement에서 지원되지 않으므로 `$executeRaw`로 실행할 수 없습니다.  
또한 `$executeRaw`는 하나의 문자열에 여러 SQL 문장을 넣는 방식을 지원하지 않습니다.  

### 🟦 주의사항 및 권장 패턴

### 🔷 1) 트랜잭션으로 안전장치 마련하기

여러 Raw SQL 작업이 모두 성공하거나 모두 취소되어야 한다면 `$transaction`을 사용합니다.  
위의 `runExecuteRawTransaction()`처럼 배열 트랜잭션에 넣은 쿼리 중 하나라도 실패하면 전체 작업이 롤백됩니다.  
각 `$executeRaw`는 변경한 행 수를 반환하므로 트랜잭션 결과도 배열에 전달한 순서대로 받을 수 있습니다.  

### 🔷 2) 데이터베이스 종속성 확인하기

Raw SQL은 PostgreSQL이나 MySQL 같은 데이터베이스의 문법에 직접 의존합니다.  
나중에 데이터베이스 엔진을 바꾸면 해당 SQL도 함께 수정해야 할 수 있습니다.  

### 🔷 3) 문자열 보간 주의하기

외부에서 받은 값은 SQL 문자열에 `+` 연산자로 이어 붙이지 않습니다.  
값은 반드시 Tagged Template Literal의 `${variable}` 형태로 전달합니다.  

## 3. Prisma Raw SQL 보안: SQL Injection 방지 원리 {#session-03}

Raw SQL은 자유롭게 작성할 수 있지만, 외부 입력을 잘못 연결하면 SQL Injection 공격에 노출될 수 있습니다.  
Prisma의 안전한 Raw SQL API도 올바른 방식으로 사용해야 보호 효과를 얻을 수 있습니다.  

### 🟦 Tagged Template Literal: 안전한 쿼리의 핵심

`$queryRaw`나 `$executeRaw` 뒤에 백틱을 붙이는 이유는 JavaScript의 Tagged Template Literal을 사용하기 위해서입니다.  
Prisma는 SQL 문장과 `${variable}` 값을 분리하여 Prepared Statement의 파라미터로 전달합니다.  

### 🟦 Parameterized Query 작동 원리

1. **템플릿 분석**: Prisma가 SQL 문장과 변수 값을 분리합니다.  
2. **플레이스홀더 치환**: SQL의 값 위치를 데이터베이스가 사용하는 플레이스홀더로 바꿉니다.  
3. **값 바인딩**: 변수 값을 별도 파라미터로 전달하여 SQL 명령이 아닌 데이터로 처리합니다.  

### 🟦 `$queryRawUnsafe`: 문자열 조합의 위험

`$queryRawUnsafe()`와 `$executeRawUnsafe()`는 일반 문자열을 데이터베이스에 전달할 수 있습니다.  
외부 입력을 문자열에 직접 넣으면 SQL Injection으로 데이터가 노출되거나 변경될 수 있으므로 가능한 한 사용하지 않습니다.  
실습 코드에는 안전하지 않은 API를 실행하는 예제를 두지 않고, 아래의 `Prisma.sql`과 값 바인딩 방식만 사용합니다.  

### 🟦 `Prisma.sql`을 활용한 안전한 동적 조건

조건에 따라 SQL 일부를 바꿔야 할 때는 문자열을 직접 합치지 않고 `Prisma.sql`로 쿼리 조각을 만듭니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

export type FilteredPostRow = {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: number;
};

// 작성자와 공개 여부를 실행 시점에 받아 WHERE 조건을 만듭니다.
export async function runSafeDynamicFilter(authorId: number, published: boolean) {
  // 조건 조각 안의 두 변수도 Prepared Statement 값으로 바인딩됩니다.
  const condition = Prisma.sql`
    p.author_id = ${authorId}
    AND p.published = ${published}
  `;

  const posts = await prisma.$queryRaw<FilteredPostRow[]>`
    SELECT
      p.id,
      p.title,
      p.content,
      p.published,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt",
      p.author_id AS "authorId"
    FROM study.posts AS p
    WHERE ${condition}
    ORDER BY p.created_at DESC, p.id DESC
  `;

  console.dir(posts, { depth: null });
  return posts;
}
```

### 🟦 Prisma Raw SQL API 비교 요약

| 구분 | `$queryRaw` / `$executeRaw` | `$queryRawUnsafe` / `$executeRawUnsafe` |
| --- | --- | --- |
| SQL 전달 방식 | Tagged Template Literal 또는 `Prisma.sql` | 일반 문자열 또는 파라미터화된 문자열 |
| 파라미터 바인딩 | `${value}`를 자동으로 바인딩합니다. | 개발자가 안전한 전달 방식을 직접 책임져야 합니다. |
| SQL Injection 위험 | 올바르게 사용하면 비교적 안전합니다. | 외부 입력을 문자열에 합치면 매우 위험합니다. |
| 동적 값 | 숫자와 문자열 같은 값에 사용합니다. | 값 전달이 가능하지만 안전한 API를 우선합니다. |
| 동적 식별자 | 템플릿 변수로 사용할 수 없습니다. | 문자열로 만들 수 있지만 반드시 허용 목록으로 검증합니다. |
| 권장 여부 | 기본적으로 사용합니다. | 피할 수 없는 경우에만 제한적으로 사용합니다. |

## 4. Prisma.sql: 유연하고 안전한 동적 쿼리 조립 {#session-04}

검색 조건이 실행할 때마다 달라진다면 SQL의 `WHERE` 절도 조건에 맞춰 조립해야 합니다.  
`Prisma.sql`은 값의 파라미터 바인딩을 유지하면서 여러 SQL 조각을 안전하게 결합할 때 사용합니다.  

### 🟦 SQL Tag란 무엇인가?

`Prisma.sql`은 단순한 문자열이 아니라 다른 Raw SQL 안에 넣을 수 있는 SQL 조각을 만듭니다.  
조각 안의 `${variable}`도 실행할 때 파라미터로 바인딩됩니다.  

### 🟦 동적 조립의 핵심 도구: `Prisma.join`과 `Prisma.empty`

- `Prisma.join(조각들, '구분자')`: 배열에 모은 SQL 조각을 `AND`나 `OR` 같은 구분자로 연결합니다.  
- `Prisma.empty`: 추가할 조건이 없을 때 사용하는 빈 SQL 조각입니다.  

### 🟦 예제: 다중 조건 검색(Dynamic Filter)

다음 예제는 작성자, 공개 여부와 제목 키워드가 전달된 경우에만 해당 조건을 `WHERE` 절에 추가합니다.  
`src/ch06/dynamic-query-composition-examples.ts`의 첫 번째 예제입니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

export type PostSearchFilters = {
  authorId?: number;
  published?: boolean;
  keyword?: string;
};

export type PostSearchRow = {
  id: number;
  title: string;
  published: boolean;
  authorId: number;
  createdAt: Date;
};

// 전달된 검색 조건만 사용하여 동적 WHERE 절을 만듭니다.
export async function runDynamicPostSearch(filters: PostSearchFilters) {
  // 조건이 있을 때마다 Prisma.sql 조각을 이 배열에 추가합니다.
  const conditions: Prisma.Sql[] = [];

  // authorId가 전달되었을 때만 작성자 조건을 추가합니다.
  if (filters.authorId !== undefined) {
    conditions.push(Prisma.sql`p.author_id = ${filters.authorId}`);
  }

  // false도 유효한 값이므로 undefined와 직접 비교합니다.
  if (filters.published !== undefined) {
    conditions.push(Prisma.sql`p.published = ${filters.published}`);
  }

  // 빈 문자열이 아닌 keyword가 있을 때만 부분 검색 조건을 추가합니다.
  if (filters.keyword !== undefined && filters.keyword.length > 0) {
    const pattern = `%${filters.keyword}%`;
    conditions.push(Prisma.sql`p.title ILIKE ${pattern}`);
  }

  // 조건이 있으면 AND로 연결하고, 없으면 WHERE 절을 생략합니다.
  const whereClause =
    conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

  const posts = await prisma.$queryRaw<PostSearchRow[]>`
    SELECT
      p.id,
      p.title,
      p.published,
      p.author_id AS "authorId",
      p.created_at AS "createdAt"
    FROM study.posts AS p
    ${whereClause}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 20
  `;

  console.dir(posts, { depth: null });
  return posts;
}
```

### 🟦 동적 식별자(Table/Column) 처리: `Prisma.raw`

`${variable}`은 값으로 바인딩되므로 테이블명이나 컬럼명에는 사용할 수 없습니다.  
식별자를 동적으로 바꿔야 한다면 허용 목록으로 입력을 먼저 검증한 뒤 `Prisma.raw()`를 사용할 수 있습니다.  

> `Prisma.raw()`는 문자열을 그대로 SQL에 넣습니다.  
> 외부 입력을 검증하지 않고 전달하면 SQL Injection이 발생할 수 있습니다.  

다음은 `src/ch06/dynamic-query-composition-examples.ts`의 두 번째 예제입니다.  
앞서 정의한 `PostSearchRow`를 같이 사용합니다.  

```typescript
const SORT_COLUMNS = {
  title: 'p.title',
  createdAt: 'p.created_at',
} as const;

export type PostSortColumn = keyof typeof SORT_COLUMNS;
export type SortDirection = 'asc' | 'desc';

// 허용한 컬럼과 방향으로만 게시글을 정렬합니다.
export async function runAllowedDynamicSort(sortBy: string, direction: string) {
  if (!Object.hasOwn(SORT_COLUMNS, sortBy)) {
    throw new Error('허용되지 않은 정렬 컬럼입니다.');
  }

  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error('정렬 방향은 asc 또는 desc만 사용할 수 있습니다.');
  }

  // 검증된 키로 내부 상수만 선택하여 Raw SQL 조각을 만듭니다.
  const sortColumn = Prisma.raw(SORT_COLUMNS[sortBy as PostSortColumn]);
  const sortDirection = Prisma.raw(direction.toUpperCase());

  const posts = await prisma.$queryRaw<PostSearchRow[]>`
    SELECT
      p.id,
      p.title,
      p.published,
      p.author_id AS "authorId",
      p.created_at AS "createdAt"
    FROM study.posts AS p
    ORDER BY ${sortColumn} ${sortDirection}, p.id DESC
    LIMIT 20
  `;

  console.dir(posts, { depth: null });
  return posts;
}
```

### 🟦 예제: Raw SQL 키셋 페이지네이션

다음은 `src/ch06/raw-keyset-pagination-examples.ts`의 예제입니다.  
`createdAt`과 `id`를 복합 커서로 사용하여 직전 페이지의 마지막 행 다음부터 조회합니다.  
`OFFSET`을 크게 증가시키지 않아도 되므로 데이터가 많은 테이블에 적합합니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

// 다음 페이지의 시작 위치를 결정하는 정렬 키입니다.
export type RawPostCursor = {
  createdAt: Date;
  id: number;
};

export type RawPostPageParams = {
  published?: boolean;
  take?: number;
  cursor?: RawPostCursor;
};

export type RawPostPageRow = {
  id: number;
  title: string;
  published: boolean;
  createdAt: Date;
  authorId: number;
};

// 음수나 과도한 LIMIT을 방지하도록 페이지 크기를 검증합니다.
function validateTake(take: number): void {
  if (!Number.isInteger(take) || take < 1 || take > 100) {
    throw new RangeError('take는 1 이상 100 이하의 정수여야 합니다.');
  }
}

export async function runRawKeysetPagination({
  published,
  take = 20,
  cursor,
}: RawPostPageParams = {}) {
  validateTake(take);

  // false도 유효한 검색값이므로 undefined와 직접 비교합니다.
  const publishedFilter =
    published === undefined ? Prisma.empty : Prisma.sql`AND p.published = ${published}`;

  // 첫 페이지에는 커서 조건을 생략합니다.
  const cursorFilter = cursor
    ? Prisma.sql`
        AND (p.created_at, p.id) < (${cursor.createdAt}, ${cursor.id})
      `
    : Prisma.empty;

  // WHERE TRUE를 고정하여 선택적 조건을 AND 조각으로 통일합니다.
  const posts = await prisma.$queryRaw<RawPostPageRow[]>`
    SELECT
      p.id,
      p.title,
      p.published,
      p.created_at AS "createdAt",
      p.author_id AS "authorId"
    FROM study.posts AS p
    WHERE TRUE
      ${publishedFilter}
      ${cursorFilter}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${take}
  `;

  // 현재 페이지의 마지막 행으로 다음 커서를 만듭니다.
  const lastPost = posts.at(-1);
  const nextCursor = lastPost ? { createdAt: lastPost.createdAt, id: lastPost.id } : undefined;

  const result = {
    posts,
    nextCursor,
  };

  console.dir(result, { depth: null });
  return result;
}
```

### 🟦 핵심 요약 및 권장 패턴

| 상황 | 도구 | 특징 |
| --- | --- | --- |
| 단순한 값 전달 | 백틱 안의 `${value}` | 값을 자동으로 바인딩하므로 기본적으로 사용합니다. |
| 여러 조건 조합 | `Prisma.join()` | SQL 조각을 `AND`, `OR` 등으로 연결합니다. |
| 조건부 쿼리 생략 | `Prisma.empty` | 조건이 없을 때 빈 SQL 조각을 사용합니다. |
| 테이블명·컬럼명 변경 | `Prisma.raw()` | 반드시 허용 목록으로 검증한 식별자만 사용합니다. |
| 복합 커서 페이지네이션 | `Prisma.sql` | 정렬 키와 `LIMIT` 값을 바인딩합니다. |
