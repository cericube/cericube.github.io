---
layout: post
title: "[Fastify] 07. TypeBox 스키마 패턴 예시"
description: "Fastify 실습 프로젝트의 User, Post와 PostAttachment Prisma 모델을 바탕으로 TypeBox 요청·응답 스키마를 구성합니다. 이메일·비밀번호 검증, Nullable 필드, 스키마 재사용과 Route 응답 계약을 함께 알아봅니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 07
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prisma 모델과 기본 유효성 검증 패턴"
  - id: session-02
    title: "2. Nullable 필드 & 스키마 재사용 패턴"
  - id: session-03
    title: "3. PostAttachment 요청·응답 스키마"
  - id: session-04
    title: "4. 오류 응답 표준화 & Route 스키마 조합"
---

## 1. Prisma 모델과 기본 유효성 검증 패턴 {#session-01}

현재 Prisma 스키마에는 `User`, `Session`, `Post`, `PostAttachment`, `PostLike` 모델이 정의되어 있습니다.  
관계 필드는 API의 목적에 따라 중첩 응답으로 포함할 수 있지만, 기본 응답 예제에서는 각 모델의 스칼라 필드를 중심으로 작성합니다.  

### 🟦 Prisma 타입을 TypeBox로 표현하기

Prisma 모델은 데이터베이스에 저장할 타입을 정의하고 TypeBox는 HTTP 요청과 응답의 JSON 형식을 정의합니다.  
따라서 Prisma 타입을 그대로 복사하기보다 JSON으로 전달될 형태에 맞춰 TypeBox 스키마를 작성해야 합니다.  

| Prisma 필드 | TypeBox 표현 | 적용 예시 |
| --- | --- | --- |
| `Int` | `Type.Integer()` | `User.id`, `Post.authorId`, `PostAttachment.size` |
| `String` | `Type.String()` | `User.email`, `Post.title`, `PostAttachment.storageKey` |
| `String?` | `Type.Union([Type.String(), Type.Null()])` | `User.displayName`, `Post.content` 응답 |
| `Boolean` | `Type.Boolean()` | `Post.published` |
| `DateTime` | `Type.String({ format: 'date-time' })` | JSON으로 변환한 `createdAt`, `updatedAt` |
| Enum | `Type.Enum()` | `UserStatus` |

TypeBox의 `Type.Optional()`은 요청 객체에서 필드를 생략할 수 있다는 뜻입니다.  
Prisma의 `String?`처럼 데이터베이스 값으로 `null`을 허용한다는 뜻과는 다르므로 두 경우를 구분해야 합니다.  

### 🟦 이메일과 비밀번호 요청 검증

Prisma의 `User` 모델은 로그인 식별자인 `email`과 비밀번호 해시인 `passwordHash`를 저장합니다.  
HTTP 가입 요청에서는 원문 비밀번호를 `password`로 받은 뒤 Service에서 안전하게 해시하여 `passwordHash`에 저장해야 합니다.  
이메일 형식과 문자열 길이처럼 데이터베이스 접근이 필요 없는 조건은 TypeBox 스키마에서 먼저 검사합니다.  

```typescript
import { Type } from '@fastify/type-provider-typebox';
import type { Static } from 'typebox';

// 이메일 형식과 지나치게 긴 입력을 요청 경계에서 제한합니다.
export const EmailSchema = Type.String({
  format: 'email',
  maxLength: 254,
});

// 영문자, 숫자와 허용된 특수문자를 각각 한 개 이상 포함해야 합니다.
const PASSWORD_PATTERN =
  '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]+$';

export const PasswordSchema = Type.String({
  minLength: 10,
  maxLength: 64,
  pattern: PASSWORD_PATTERN,
});

export const RegisterUserBodySchema = Type.Object(
  {
    email: EmailSchema,
    // passwordHash가 아니라 사용자가 입력한 원문 비밀번호를 받습니다.
    password: PasswordSchema,
  },
  { additionalProperties: false },
);

export const LoginUserBodySchema = Type.Object(
  {
    email: EmailSchema,
    // 가입과 로그인에서 같은 비밀번호 형식과 길이 규칙을 적용합니다.
    password: PasswordSchema,
  },
  { additionalProperties: false },
);

export type RegisterUserBody = Static<typeof RegisterUserBodySchema>;
export type LoginUserBody = Static<typeof LoginUserBodySchema>;
```

비밀번호는 10자 이상 64자 이하이며, 영문자, 숫자와 특수문자를 각각 한 개 이상 포함해야 합니다.  
이 예제에서 사용할 수 있는 특수문자는 `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`이며 공백이나 그 밖의 문자는 허용하지 않습니다.  
가입과 로그인 요청에 같은 `PasswordSchema`를 사용하므로 두 API에 동일한 규칙이 적용됩니다.  

`format: 'email'`은 문자열의 기본 형식만 검사하며 해당 이메일의 실제 소유 여부를 확인하지는 않습니다.  
이메일 중복 확인, 인증 메일 확인, 유출 비밀번호 차단 목록 조회와 비밀번호 해시는 요청 스키마를 통과한 뒤 Service에서 처리해야 합니다.  

### 🟦 사용자 상태 값과 Enum 스키마

사용자 상태는 애플리케이션 공통 타입 파일에 정의합니다.  
런타임 값과 TypeScript 타입을 같은 객체에서 만들면 상태 문자열을 여러 파일에 반복해서 작성하지 않아도 됩니다.  

```typescript
// Prisma나 HTTP 계층에 직접 의존하지 않는 사용자 상태 값입니다.
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

// 객체의 값으로 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' 타입을 만듭니다.
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
```

`Type.Enum()`에 이 객체를 전달하면 Prisma 모델과 같은 세 가지 상태만 허용하는 JSON Schema가 만들어집니다.  

```typescript
// Prisma User 모델을 바탕으로 응답 계약을 구체화한 예제입니다.

// Fastify Type Provider가 다시 내보내는 TypeBox 빌더를 사용합니다.
import { Type } from '@fastify/type-provider-typebox';

import { UserStatus } from './user.types';

// 공통 상태 객체를 스키마로 변환하여 문자열 중복을 방지합니다.
export const UserStatusSchema = Type.Enum(UserStatus);
```

### 🟦 공통 정수형 ID 파라미터

`User`, `Post`와 `PostAttachment`는 자동 증가하는 양의 정수 ID를 사용합니다.  
같은 제약 조건을 여러 Route에서 사용할 수 있도록 공통 파라미터 스키마로 정의합니다.  

```typescript
// /users/:id, /posts/:id와 /attachments/:id에서 재사용할 수 있습니다.
export const IdParamsSchema = Type.Object(
  {
    // Fastify의 Ajv가 "1" 같은 경로 문자열을 정수로 변환한 뒤 검사합니다.
    id: Type.Integer({ minimum: 1 }),
  },
  // id 외의 예상하지 않은 경로 파라미터는 허용하지 않습니다.
  { additionalProperties: false },
);

// 기존 사용자 조회 Route에서는 의미가 분명한 이름으로 다시 내보낼 수 있습니다.
export const UserIdParamsSchema = IdParamsSchema;
```

`id`가 `0`, 음수 또는 정수로 바꿀 수 없는 값이면 Fastify가 검증 오류로 요청을 거절합니다.  
검증을 통과한 값은 이후 Controller에서 `number` 타입으로 사용할 수 있습니다.  

### 🟦 게시글 목록 조회 조건

`Post` 모델의 `authorId`, `published`, `title`, `createdAt`과 `updatedAt`을 기준으로 목록 조회 조건을 구성할 수 있습니다.  
페이지 번호와 검색어는 데이터베이스 열이 아니라 목록 API가 조회 범위를 결정하기 위한 입력값입니다.  

```typescript
// Prisma Post 모델의 필드를 기준으로 목록 조회 옵션을 제한합니다.
export const PostListQuerySchema = Type.Object(
  {
    // 특정 사용자가 작성한 게시글만 조회할 때 사용합니다.
    authorId: Type.Optional(Type.Integer({ minimum: 1 })),
    // 공개 여부가 같은 게시글만 조회할 때 사용합니다.
    published: Type.Optional(Type.Boolean()),
    // title 또는 content 검색에 사용할 문자열입니다.
    keyword: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    // 실제 Post 모델에 있는 필드만 정렬 기준으로 허용합니다.
    sortBy: Type.Optional(Type.Union([
      Type.Literal('title'),
      Type.Literal('createdAt'),
      Type.Literal('updatedAt'),
    ], { default: 'createdAt' })),
    sortOrder: Type.Optional(Type.Union([
      Type.Literal('asc'),
      Type.Literal('desc'),
    ], { default: 'desc' })),
  },
  { additionalProperties: false },
);
```

## 2. Nullable 필드 & 스키마 재사용 패턴 {#session-02}

실무에서는 같은 데이터 구조를 여러 번 작성하지 않고 기존 스키마에서 필요한 형태를 파생합니다.  
이 예제에서는 Prisma의 `User`와 `Post` 모델을 응답 스키마로 옮기고 필요한 형태를 파생합니다.  

### 🟦 사용자 응답과 Nullable 처리

Prisma의 `displayName`은 `String?`이므로 값이 없을 때 `null`이 반환됩니다.  
따라서 응답 스키마에서도 `Type.String()`과 `Type.Null()`을 조합해야 데이터베이스 결과와 API 계약이 일치합니다.  

```typescript
// 클라이언트에 공개할 사용자 정보만 응답 스키마에 포함합니다.
export const UserResponseSchema = Type.Object(
  {
    id: Type.Integer(),
    email: Type.String(),
    // Prisma의 String? 필드는 문자열 또는 null이 될 수 있습니다.
    displayName: Type.Union([Type.String(), Type.Null()]),
    status: UserStatusSchema,
    // Controller에서 Date 객체를 ISO 8601 문자열로 변환하여 반환합니다.
    createdAt: Type.String({ format: 'date-time' }),
  },
  // 비밀번호 해시 같은 내부 필드가 응답에 포함되지 않게 합니다.
  { additionalProperties: false },
);
```

실제 프로젝트의 현재 `UserResponseSchema`는 `createdAt`을 `Type.String()`으로 검사합니다.  
이 글에서는 응답 값이 ISO 8601 문자열이라는 계약까지 명시하기 위해 `format: 'date-time'`을 적용했습니다.  

### 🟦 게시글 응답과 Nullable content

Prisma의 `Post.content`도 `String?`이므로 게시글 응답에서는 문자열과 `null`을 모두 허용해야 합니다.  
`authorId`는 작성자와 연결되는 외래 키이지만 JSON 응답에서는 정수로 표현됩니다.  

```typescript
// Prisma Post 모델의 스칼라 필드를 JSON 응답 형태로 정의합니다.
export const PostResponseSchema = Type.Object(
  {
    id: Type.Integer(),
    title: Type.String(),
    content: Type.Union([Type.String(), Type.Null()]),
    published: Type.Boolean(),
    authorId: Type.Integer(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);
```

### 🟦 조회 스키마 파생과 명시적인 수정 요청

`Type.Pick()`은 기존 사용자 응답에서 필요한 필드만 선택하므로 목록이나 요약 응답을 만들 때 유용합니다.  
반면 수정 요청을 응답 스키마에서 바로 파생하면 응답 필드의 변경이 입력 계약에도 의도치 않게 영향을 줄 수 있습니다.  
실무에서는 읽기 전용 응답은 필요한 형태로 파생하고, 쓰기 요청은 수정 가능한 필드만 명시적으로 정의하는 패턴을 많이 사용합니다.  

```typescript
// 사용자 목록에서 보여 줄 최소 정보만 선택합니다.
export const UserSummarySchema = Type.Pick(
  UserResponseSchema,
  ['id', 'displayName', 'status'],
);

// Prisma의 displayName String?에 맞춰 생략, 문자열과 null을 구분합니다.
export const UpdateUserProfileBodySchema = Type.Object(
  {
    displayName: Type.Optional(Type.Union([
      Type.String({ minLength: 1 }),
      Type.Null(),
    ])),
  },
  // 빈 PATCH 요청과 허용하지 않은 필드를 모두 거절합니다.
  { additionalProperties: false, minProperties: 1 },
);

// 응답의 id, authorId와 시간 필드는 수정 요청에 포함하지 않습니다.
export const UpdatePostBodySchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1 })),
    content: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    published: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false, minProperties: 1 },
);
```

`UpdateUserProfileBodySchema`의 `displayName`은 생략할 수 있고, 전달한다면 비어 있지 않은 문자열이나 `null`이어야 합니다.  
이는 현재 Prisma 모델의 `displayName String?` 정의와 같은 의미입니다.  
`UpdatePostBodySchema`도 수정할 필드만 전달할 수 있으며, `content`에는 문자열 또는 `null`을 사용할 수 있습니다.  
두 수정 스키마의 `minProperties: 1`은 변경할 필드가 하나도 없는 빈 요청을 거절합니다.  
정렬 필드는 응답 필드 전체에서 자동으로 파생하지 않고 앞 절의 `sortBy`처럼 허용 목록을 명시하면, 정렬을 지원하지 않는 필드가 실수로 공개되는 일을 막을 수 있습니다.  

## 3. PostAttachment 요청·응답 스키마 {#session-03}

Prisma 스키마에는 게시글 첨부파일의 메타데이터를 저장하는 `PostAttachment` 모델이 있습니다.  
현재 `src`에는 첨부파일 Route가 아직 구현되어 있지 않으므로, 이 절의 코드는 Prisma 모델을 API로 확장할 때 사용할 수 있는 예제입니다.  

### 🟦 첨부파일 메타데이터 스키마

`originalName`은 사용자가 업로드한 파일명이고 `storageKey`는 서버가 실제 파일을 찾을 때 사용하는 고유 키입니다.  
`mimeType`과 `size`는 다운로드 응답 헤더와 업로드 제한을 확인할 때 사용할 수 있습니다.  
`postId`는 첨부파일이 속한 게시글의 정수형 ID입니다.  
`storageKey`의 중복 여부와 `postId`가 가리키는 게시글의 존재 여부는 Prisma의 고유 제약 조건과 외래 키가 최종적으로 보장합니다.  

```typescript
import { Type } from '@fastify/type-provider-typebox';
import type { Static } from 'typebox';

// 파일을 스토리지에 저장한 뒤 데이터베이스에 기록할 메타데이터입니다.
export const PostAttachmentMetadataSchema = Type.Object(
  {
    originalName: Type.String({ minLength: 1 }),
    // storageKey는 클라이언트 입력을 그대로 사용하지 않고 서버에서 생성합니다.
    storageKey: Type.String({ minLength: 1 }),
    mimeType: Type.String({ minLength: 1 }),
    size: Type.Integer({ minimum: 0 }),
    postId: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

// Service가 사용할 TypeScript 타입도 같은 스키마에서 추출합니다.
export type PostAttachmentMetadata = Static<typeof PostAttachmentMetadataSchema>;
```

이 스키마는 `multipart/form-data` 원본 요청을 직접 검증하는 스키마가 아닙니다.  
Multipart 플러그인으로 파일을 받은 뒤 스토리지 키를 생성하고 파일 정보를 추출한 결과를 검증하는 용도입니다.  

### 🟦 첨부파일 응답 스키마

데이터베이스에 저장된 첨부파일 응답에는 자동 생성된 `id`와 `createdAt`이 추가됩니다.  
`storageKey`는 내부 저장 위치를 나타내므로 공개 응답에서는 제외하고, 클라이언트에 필요한 Prisma 스칼라 필드만 명시합니다.  

```typescript
export const PostAttachmentResponseSchema = Type.Object(
  {
    id: Type.Integer(),
    originalName: Type.String(),
    mimeType: Type.String(),
    size: Type.Integer(),
    createdAt: Type.String({ format: 'date-time' }),
    postId: Type.Integer(),
  },
  { additionalProperties: false },
);

export type PostAttachmentResponse = Static<typeof PostAttachmentResponseSchema>;
```

### 🟦 첨부파일 조회 파라미터

`PostAttachment.id`도 자동 증가하는 정수이므로 앞에서 만든 `IdParamsSchema`를 그대로 재사용할 수 있습니다.  

```typescript
export const PostAttachmentIdParamsSchema = IdParamsSchema;
```

실제 파일 다운로드 응답은 JSON이 아니라 스트림이므로 `PostAttachmentResponseSchema`를 파일 본문에 적용하지 않습니다.  
이 스키마는 첨부파일 메타데이터 조회나 업로드 완료 응답에 사용하고, 다운로드 Route에서는 저장된 `mimeType`, `originalName`과 `storageKey`로 응답 헤더와 파일 스트림을 구성합니다.  

## 4. 오류 응답 표준화 & Route 스키마 조합 {#session-04}

현재 구현된 사용자 조회 API는 성공 응답을 별도의 래퍼로 감싸지 않고 `UserResponseSchema` 형태로 바로 반환합니다.  
게시글이나 첨부파일 API를 추가할 때도 각 Prisma 모델에 맞춘 응답 스키마를 같은 방식으로 적용할 수 있습니다.  
오류 응답은 `success`, `code`, `message` 필드를 가진 공통 스키마로 표준화합니다.  

### 🟦 공통 오류 응답 스키마

`ErrorCode` Enum을 스키마에 사용하면 전역 오류 처리기와 API 응답이 같은 오류 코드 목록을 공유합니다.  

```typescript
import { Type } from '@fastify/type-provider-typebox';
import type { Static } from 'typebox';

import { ErrorCode } from './error.codes';

// 모든 오류 처리기와 라우트가 공통으로 사용하는 오류 응답 형식입니다.
export const ErrorResponseSchema = Type.Object(
  {
    success: Type.Literal(false),
    code: Type.Enum(ErrorCode),
    message: Type.String(),
  },
  { additionalProperties: false },
);

// 오류 처리기가 반환할 TypeScript 타입도 같은 스키마에서 추출합니다.
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
```

예를 들어 전역 오류 처리기는 다음 객체가 `ErrorResponse`와 일치하는지 컴파일 단계에서 검사합니다.  

```typescript
return reply.status(statusCode).send({
  success: false,
  code: errorCode,
  message,
} satisfies ErrorResponse);
```

### 🟦 요청과 응답을 하나의 Route 스키마로 조합

`GetUserRouteSchema`는 경로 파라미터, 성공 응답과 공통 오류 응답을 하나의 객체로 묶습니다.  
이 객체를 Route의 `schema` 옵션에 전달하면 요청 검증과 응답 직렬화에 같은 계약을 적용할 수 있습니다.  

```typescript
// src/modules/user/user.schema.ts

import { ErrorResponseSchema } from '../../common/errors/error.schema';

export const GetUserRouteSchema = {
  // GET /users/:id의 경로 파라미터를 검증합니다.
  params: UserIdParamsSchema,
  response: {
    // 정상 조회 결과에서 공개 가능한 사용자 필드만 직렬화합니다.
    200: UserResponseSchema,
    // 400, 404, 500 등 성공 이외의 응답에 공통 오류 형식을 사용합니다.
    default: ErrorResponseSchema,
  },
} as const;
```

첨부파일 메타데이터 조회 Route를 추가한다면 같은 공통 오류 스키마와 앞 절의 첨부파일 스키마를 조합할 수 있습니다.  
다음 코드는 아직 `src`에 구현되지 않은 Prisma 모델 기반 확장 예제입니다.  

```typescript
export const GetPostAttachmentRouteSchema = {
  params: PostAttachmentIdParamsSchema,
  response: {
    // PostAttachment의 스칼라 필드를 JSON 응답으로 직렬화합니다.
    200: PostAttachmentResponseSchema,
    default: ErrorResponseSchema,
  },
} as const;
```

첨부파일을 찾지 못한 상황을 별도 비즈니스 오류로 처리하려면 `ErrorCode`에 `POST_ATTACHMENT_NOT_FOUND` 같은 값을 먼저 추가해야 합니다.  
그러면 `Type.Enum(ErrorCode)`를 사용하는 공통 오류 응답과 실제 오류 처리기가 같은 코드 목록을 공유할 수 있습니다.  
