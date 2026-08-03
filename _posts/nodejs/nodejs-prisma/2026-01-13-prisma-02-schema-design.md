---
layout: post
title: "02. schema.prisma 설계 규칙: 필드, 제약, 인덱스와 관계"
description: "Prisma 7과 PostgreSQL을 기준으로 schema.prisma의 모델과 필드, 제약 조건, 인덱스, 관계를 설계하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. schema.prisma 구성과 모델 선언 규칙"
  - id: session-02
    title: "2. 필드 속성(Attribute)과 제약 설계"
  - id: session-03
    title: "3. Prisma 스칼라 타입과 PostgreSQL 매핑"
  - id: session-04
    title: "4. 관계(Relation) 모델링 패턴: 1:1, 1:N, N:M"
---

## 1. schema.prisma 구성과 모델 선언 규칙 {#session-01}

### 🟦 `schema.prisma`의 역할과 구성 요소

| 구성 요소 | 역할 | 주요 항목 |
| --- | --- | --- |
| Generator | Prisma Client와 같은 코드 생성 도구를 설정합니다. | `provider`, `output` |
| Datasource | 사용할 데이터베이스의 종류를 설정합니다. | `provider`(`postgresql`, `mysql` 등) |
| Model | 실제 데이터베이스 테이블과 매핑할 비즈니스 엔터티를 정의합니다. | 필드 타입, 제약 조건, 관계, `@id`, `@default`, `@unique`, `@updatedAt`, `@@index` 등 |

```prisma
// 1. Generator: Prisma Client 생성 설정입니다.
generator client {
  // Prisma 7에서는 prisma-client 생성기를 사용합니다.
  provider = "prisma-client"

  // 생성된 Client를 저장할 경로를 지정해야 합니다.
  output   = "../generated/prisma"
}

// 2. Datasource: 사용할 데이터베이스 종류를 설정합니다.
datasource db {
  provider = "postgresql"
}

// 3. Model: 실제 데이터 구조를 정의합니다.
model User {
  // Prisma 모델과 필드에는 각각 PascalCase와 camelCase를 사용합니다.
  id          Int     @id @default(autoincrement())
  displayName String? @map("display_name")

  // 실제 데이터베이스 테이블명은 snake_case 복수형으로 매핑합니다.
  @@map("users")
}
```

#### 🔷 Prisma 7 Client 구조 변화 비교: `prisma-client-js`와 `prisma-client`

| 구분 | 기존 `prisma-client-js` | 신규 `prisma-client` |
| --- | --- | --- |
| Generator provider | `prisma-client-js` | `prisma-client` |
| Client 생성 위치 | 기본적으로 `node_modules/.prisma/client` 내부에 생성합니다. | `output`에 지정한 경로에 생성합니다. |
| 생성 결과 | JavaScript와 타입 정의를 생성합니다. | 프로젝트에서 번들링할 일반 TypeScript 코드를 생성합니다. |
| Driver Adapter | 선택적으로 사용합니다. | Prisma 7에서는 데이터베이스 연결에 사용합니다. |
| 모듈 형식 | 설정에 제약이 있습니다. | `moduleFormat`으로 ESM과 CommonJS를 선택할 수 있습니다. |
| 환경 변수 로딩 | 기존 동작에 의존할 수 있습니다. | 런타임에서 자동으로 불러오지 않으므로 `dotenv` 등을 사용합니다. |

### 🟦 모델 선언 문법과 네이밍 컨벤션

```prisma
model User {
  // 모델명은 PascalCase 단수형, 필드명은 camelCase 사용을 권장합니다.
  id          Int     @id @default(autoincrement())
  displayName String? @map("display_name")

  // 실제 데이터베이스 테이블명은 snake_case 복수형으로 매핑합니다.
  @@map("users")
}
```

- 모델 이름은 `User`, `UserOrder`처럼 PascalCase 단수형을 권장합니다.
- 필드 이름은 `createdAt`, `firstName`처럼 camelCase를 권장합니다.
- 실제 테이블이나 컬럼 이름이 프로젝트의 데이터베이스 명명 규칙과 다르면 `@map`, `@@map`을 사용합니다.

### 🟦 필드 정의 및 데이터 타입

다음 예시는 1편에서 만든 실습용 스키마의 `User` 모델입니다.  

```prisma
model User {
  // 스칼라 필드는 실제 데이터베이스 컬럼에 대응합니다.
  id          Int      @id @default(autoincrement())
  email       String   @unique
  displayName String?  @map("display_name")
  createdAt   DateTime @default(now()) @map("created_at")

  // 관계 필드는 다른 모델과의 연결을 나타내며 실제 컬럼이 아닙니다.
  posts Post[]
  likes PostLike[]

  @@map("users")
}
```

#### 🔷 스칼라 필드와 관계 필드

| 구분 | 스칼라 필드 | 관계 필드 |
| --- | --- | --- |
| 데이터베이스 컬럼 | 실제 컬럼에 대응합니다. | 실제 컬럼이 아닌 Prisma의 논리적 필드입니다. |
| 타입 | `String`, `Int`, `Boolean`, `DateTime`, `Json`, `Decimal` 등입니다. | `User`, `Post`, `PostLike`와 같은 다른 모델 타입입니다. |
| 예시 | `email`, `createdAt`, `published` | `posts`, `likes`, `author` |

#### 🔷 Nullable(`?`)의 의미

- `?`가 붙은 필드는 `NULL`을 허용합니다.
- Prisma의 선택적 스칼라 필드는 데이터베이스에서 nullable 컬럼으로 정의됩니다.
- `String`과 `String?`은 명확히 구분됩니다.

```prisma
// 값을 생략할 수 있으며 데이터베이스에 NULL을 저장할 수 있습니다.
displayName String?
content     String?
```

## 2. 필드 속성(Attribute)과 제약 설계 {#session-02}

### 🟦 기본 속성: `@id`, `@default`, `@updatedAt`

```prisma
model Post {
  // @id는 기본 키를 지정합니다.
  id        Int      @id @default(autoincrement())

  // @default는 레코드를 생성할 때 사용할 기본값을 지정합니다.
  createdAt DateTime @default(now()) @map("created_at")

  // @updatedAt은 Prisma ORM에서 수정 시각을 자동으로 갱신합니다.
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("posts")
}
```

#### 🔷 `@id`: Primary Key 선언

`@id`는 해당 필드를 모델의 기본 키로 지정합니다.  
복합 기본 키가 필요하면 모델 수준의 `@@id`를 사용합니다.  
Prisma Client에서 레코드를 고유하게 식별하려면 모델에 `@id`, `@@id`, `@unique`, `@@unique` 가운데 하나 이상의 고유 식별 기준이 있어야 합니다.  

#### 🔷 `@default()`: 기본값 설정

`@default()`는 레코드가 생성될 때 자동으로 채울 기본값을 정의합니다.  
`now()`를 사용하면 레코드를 삽입하는 시점의 현재 시간이 저장되며, 관계형 데이터베이스에서는 데이터베이스 수준의 기본값으로 구현됩니다.  

#### 🔷 `@updatedAt`: 수정 시 자동 갱신

`@updatedAt`은 Prisma Client로 레코드를 수정할 때 해당 필드의 값을 현재 시각으로 자동 갱신합니다.  
Prisma ORM 수준의 기능이므로 Prisma를 통하지 않고 SQL로 직접 수정하면 자동으로 갱신되지 않습니다.  

### 🟦 Unique 제약: `@unique`와 `@@unique`

#### 🔷 `@unique`: 단일 컬럼 제약

`email` 값의 중복을 허용하지 않습니다.  
데이터베이스에는 해당 컬럼의 고유성을 보장하는 제약 조건 또는 고유 인덱스가 생성됩니다.  

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}
```

#### 🔷 `@@unique`: 복합 컬럼 제약

여러 필드의 조합이 중복되지 않도록 설정합니다.  
예를 들어 한 사용자가 하나의 게시글에 좋아요를 한 번만 등록하도록 제한할 수 있습니다.  

```prisma
model PostLike {
  userId Int
  postId Int

  // userId와 postId 조합의 중복을 허용하지 않습니다.
  @@unique([userId, postId])
}
```

실습용 `PostLike` 모델에서는 같은 조건을 보장하면서 레코드의 기본 키로도 사용하는 `@@id([userId, postId])`를 적용했습니다.  

### 🟦 컬럼과 테이블 매핑: `@map`, `@@map`

`@map`과 `@@map`은 TypeScript 코드의 명명 규칙과 데이터베이스의 명명 규칙 사이의 차이를 연결합니다.  

- TypeScript와 Prisma에서는 모델명에 PascalCase, 필드명에 camelCase를 주로 사용합니다.
- SQL 데이터베이스에서는 프로젝트 규칙에 따라 snake_case를 사용하는 경우가 많습니다.
- 코드에서는 `user.displayName`으로 접근하고 데이터베이스에서는 `display_name` 컬럼에 저장할 수 있습니다.

#### 🔷 `@map`: 필드 매핑

- Prisma 필드명은 `displayName`입니다.
- 실제 데이터베이스 컬럼명은 `display_name`입니다.

```prisma
model User {
  id          Int     @id @default(autoincrement())
  displayName String? @map("display_name")
}
```

#### 🔷 `@@map`: 테이블 매핑

- Prisma 모델명은 `User`입니다.
- 실제 데이터베이스 테이블명은 `users`입니다.

```prisma
model User {
  id Int @id @default(autoincrement())

  @@map("users")
}
```

### 🟦 인덱스 선언: `@@index`

실습용 `Post` 모델은 `authorId`로 작성자의 게시글을 조회할 때 사용할 단일 컬럼 인덱스를 정의합니다.  

```prisma
model Post {
  id       Int @id @default(autoincrement())
  authorId Int @map("author_id")

  // 특정 작성자의 게시글을 조회하는 쿼리를 위한 인덱스입니다.
  @@index([authorId])
}
```

작성자별 게시글을 생성 시각순으로 자주 조회한다면 다음과 같은 복합 인덱스를 고려할 수 있습니다.  

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  authorId  Int      @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")

  // WHERE author_id = ? ORDER BY created_at 패턴을 고려한 복합 인덱스입니다.
  @@index([authorId, createdAt])
}
```

#### 🔷 인덱스 설계 전략

- `WHERE` 절에서 자주 사용하는 필드를 검토합니다.
- 조인에 사용하는 외래 키 필드를 검토합니다.
- `ORDER BY`에 사용하는 정렬 필드를 검토합니다.
- 복합 인덱스의 필드 순서는 단순히 선택도가 높은 필드를 앞에 두는 방식이 아니라 실제 필터링과 정렬 조건에 맞춰 결정합니다.

인덱스는 읽기 성능을 높일 수 있지만 저장 공간을 사용하고 쓰기 비용을 늘리므로 실제 쿼리 패턴을 기준으로 추가합니다.  

### 🟦 참조 무결성(Referential Action): `onDelete`, `onUpdate`

Prisma에서 `@relation(...)`을 선언할 때 `onDelete`, `onUpdate` 옵션을 지정할 수 있습니다.  
이 옵션은 부모 레코드가 삭제되거나 참조하는 값이 변경될 때 외래 키로 연결된 자식 레코드를 어떻게 처리할지 정의합니다.  

| 옵션 | 의미 |
| --- | --- |
| `Cascade` | 부모가 삭제되거나 참조 값이 변경되면 연결된 자식 레코드에도 작업을 전파합니다. |
| `Restrict` | 자식 레코드가 참조하는 동안 부모의 삭제나 참조 값 변경을 제한합니다. |
| `SetNull` | 부모가 삭제되거나 참조 값이 변경되면 자식의 외래 키를 `NULL`로 변경합니다. 외래 키 필드가 nullable이어야 합니다. |
| `NoAction` | 작업을 데이터베이스에 위임하며 실제 동작은 사용하는 데이터베이스에 따라 달라질 수 있습니다. |

#### 🔷 `Post`와 `User` 관계의 `onDelete: Cascade`

실습용 스키마에서는 사용자를 삭제하면 해당 사용자가 작성한 게시글도 함께 삭제하도록 설정했습니다.  

```prisma
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int  @map("author_id")

  // User가 삭제되면 연결된 Post도 함께 삭제합니다.
  author User @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
```

`Cascade`는 연관 데이터를 편리하게 정리하지만 예상보다 넓은 범위의 데이터가 삭제될 수 있으므로 도메인의 데이터 보존 정책에 맞게 선택해야 합니다.  
게시글이 존재하는 사용자의 삭제를 막아야 하는 서비스라면 `onDelete: Restrict`를 대신 고려할 수 있습니다.  

#### 🔷 `PostLike` 관계의 `onDelete: Cascade`

사용자나 게시글이 삭제되면 더는 의미가 없는 좋아요 레코드도 함께 삭제합니다.  

```prisma
model PostLike {
  userId Int @map("user_id")
  postId Int @map("post_id")

  // 연결된 User나 Post가 삭제되면 좋아요 레코드도 삭제합니다.
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@id([userId, postId])
}
```

`onUpdate`는 부모의 참조 값이 바뀔 때의 동작을 지정합니다.  
`Cascade`는 자식의 외래 키에도 변경을 전파하고, `Restrict`는 참조 중인 값의 변경을 제한하며, `SetNull`은 nullable 외래 키를 `NULL`로 변경합니다.  

## 3. Prisma 스칼라 타입과 PostgreSQL 매핑 {#session-03}

Prisma는 데이터베이스 추상화 계층을 제공하지만 `@db` 속성을 사용하면 PostgreSQL의 네이티브 타입을 직접 지정할 수 있습니다.  

### 🟦 기본 타입 매핑 요약

| Prisma 타입 | PostgreSQL 기본 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| `String` | `text` | 길이 제한이 없는 가변 길이 문자열입니다. | 이메일, 본문, 이름 |
| `Int` | `integer` | 32비트 정수입니다. | 일반적인 ID, 개수 |
| `BigInt` | `bigint` | 64비트 정수입니다. | 큰 숫자 데이터, 로그 ID |
| `Boolean` | `boolean` | 참과 거짓을 나타냅니다. | 공개 여부, 활성화 여부 |
| `DateTime` | `timestamp(3)` | 밀리초 정밀도의 날짜와 시간입니다. | 생성일, 수정일 |
| `Decimal` | `decimal(65,30)` | 고정 소수점 수를 정밀하게 저장합니다. | 금액, 이자율 |
| `Json` | `jsonb` | JSON 데이터를 저장합니다. | 설정값, 메타데이터 |
| `Bytes` | `bytea` | 이진 데이터를 저장합니다. | 파일 데이터 |

- 금액 계산에 `Float`를 사용하면 `0.1 + 0.2`의 결과처럼 부동 소수점 오차가 발생할 수 있으므로 `Decimal`을 고려합니다.
- 태그 목록이나 상태 값을 하나의 `String`에 쉼표로 구분해 저장하기보다 배열, Enum 또는 별도 테이블이 적합한지 검토합니다.

### 🟦 세밀한 타입 제어: `@db` 속성

기본 매핑만으로 부족할 때 `@db` 속성을 사용하여 PostgreSQL의 네이티브 타입을 지정합니다.  

```prisma
model Product {
  id          Int      @id @default(autoincrement())

  // text 대신 최대 255자인 varchar를 사용합니다.
  name        String   @db.VarChar(255)

  // 긴 설명을 저장할 text 타입을 명시합니다.
  description String   @db.Text

  // 전체 10자리, 소수점 아래 2자리인 금액을 저장합니다.
  price       Decimal  @db.Decimal(10, 2)

  // PostgreSQL의 jsonb 타입을 명시합니다.
  metadata    Json     @db.JsonB

  // 마이크로초 정밀도의 timestamp를 사용합니다.
  createdAt   DateTime @default(now()) @db.Timestamp(6)

  @@map("products")
}
```

## 4. 관계(Relation) 모델링 패턴: 1:1, 1:N, N:M {#session-04}

Prisma 관계 모델링의 핵심은 데이터베이스의 물리적 외래 키 컬럼과 애플리케이션에서 사용하는 논리적 관계 필드를 구분하는 것입니다.  

- 관계 필드는 Prisma 스키마에만 존재하며 실제 데이터베이스 컬럼이 아닙니다. 예를 들어 `author User`가 관계 필드입니다.
- 외래 키 필드는 실제 데이터베이스 테이블의 컬럼입니다. 예를 들어 `authorId Int`가 외래 키 필드입니다.
- `references`에는 연결 대상에서 참조할 고유 필드를 지정하며 일반적으로 기본 키인 `id`를 사용합니다.

### 🟦 1:1 관계(One-to-One)

사용자 한 명이 하나의 상세 프로필만 가지는 `User`와 `Profile` 관계를 예로 들 수 있습니다.  

- 외래 키인 `userId`에 `@unique`를 지정해야 일대일 관계를 보장할 수 있습니다.
- `Profile?`처럼 물음표를 붙이면 프로필이 없는 사용자도 생성할 수 있습니다.
- 사용자를 삭제할 때 프로필도 함께 삭제하려면 `onDelete: Cascade`를 사용할 수 있습니다.

```prisma
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  userId Int  @unique @map("user_id")

  // userId의 @unique가 한 사용자당 하나의 프로필만 허용합니다.
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 🟦 1:N 관계(One-to-Many)

1편의 실습용 스키마에서 사용자 한 명은 여러 게시글을 작성할 수 있습니다.  

- 일대다 관계의 `1` 쪽인 `User`에 `posts Post[]` 배열을 정의합니다.
- `N` 쪽인 `Post`에 실제 외래 키 `authorId`와 관계 필드 `author`를 정의합니다.
- `@@index([authorId])`를 설정하여 특정 사용자의 게시글 조회를 지원합니다.

```prisma
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int  @map("author_id")
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
}
```

### 🟦 N:M 관계(Many-to-Many)

여러 사용자가 여러 게시글에 좋아요를 등록하는 관계를 예로 들 수 있습니다.  

#### 🔷 암시적 관계

중간 테이블에 추가 필드가 필요하지 않을 때 사용하며 Prisma가 중간 테이블을 관리합니다.  

```prisma
model Post {
  id   Int   @id @default(autoincrement())
  tags Tag[]
}

model Tag {
  id    Int    @id @default(autoincrement())
  posts Post[]
}
```

#### 🔷 명시적 관계

중간 테이블을 모델로 직접 정의합니다.  
실습용 스키마는 좋아요를 누른 시각인 `createdAt`을 저장하기 위해 이 방식을 사용합니다.  

```prisma
model User {
  id    Int        @id @default(autoincrement())
  likes PostLike[]
}

model Post {
  id    Int        @id @default(autoincrement())
  likes PostLike[]
}

model PostLike {
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  // 같은 사용자가 같은 게시글에 좋아요를 한 번만 등록할 수 있습니다.
  @@id([userId, postId])
  @@index([postId])
  @@map("post_likes")
}
```

#### 🔷 관계 요약 및 삭제 전략(`onDelete`)

| 유형 | 예시 | `onDelete` 전략 | 설명 |
| --- | --- | --- | --- |
| 1:1 | `User` - `Profile` | `Cascade` | 외래 키에 `@unique`를 지정하여 일대일 관계를 보장합니다. |
| 1:N | `User` - `Post` | `Cascade` | `Post`에 외래 키 `authorId`를 두며, 1편의 실습에서는 사용자 삭제 시 게시글도 삭제합니다. |
| N:M | `User` - `PostLike` - `Post` | `Cascade` | 중간 모델과 복합 기본 키 `@@id([userId, postId])`를 사용합니다. |

삭제 전략은 모든 프로젝트에 동일하게 적용되는 규칙이 아닙니다.  
데이터 보존 정책에 따라 `Cascade`, `Restrict`, `SetNull` 가운데 적절한 동작을 선택해야 합니다.  
