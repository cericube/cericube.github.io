---
layout: post
title: "[Fastify] 05. Layered 구조와 TypeBox 적용"
description: "Fastify 모듈을 Route, Controller, Service, Repository 계층으로 나누고 TypeBox 스키마를 요청 검증과 TypeScript 타입 추론에 함께 사용합니다. Prisma로 사용자를 조회하는 예제로 각 계층을 연결합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. Fastify Layered 구조와 계층별 책임"
  - id: session-02
    title: "2. Schema-First와 TypeBox 설정"
  - id: session-03
    title: "3. Layered 계층별 코드 작성"
  - id: session-04
    title: "4. Route와 애플리케이션 연결"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. Fastify Layered 구조와 계층별 책임 {#session-01}

Layered 구조의 목적은 관심사를 분리하는 것입니다.  
각 계층이 자신의 책임에 집중하면 API 계약, 비즈니스 규칙과 데이터베이스 구현이 서로 뒤섞이는 것을 줄일 수 있습니다.  

> Route는 계약을 정의하고, Controller는 HTTP 요청과 응답을 처리합니다.  
> Service는 비즈니스 흐름을 결정하고, Repository는 데이터베이스 접근을 담당합니다.  

| 구성 요소 | 주요 책임 |
| --- | --- |
| Route | URL과 HTTP 메서드, 요청·응답 스키마를 정의하고 Controller에 요청을 전달합니다. |
| Controller | 검증된 HTTP 요청 값을 읽고 Service를 호출하며 상태 코드와 응답을 결정합니다. |
| Service | 조회 조건, 존재 여부와 같은 비즈니스 규칙을 판단하고 필요한 Repository를 조합합니다. |
| Repository | Prisma Client로 데이터베이스 조회·저장·수정·삭제 쿼리를 실행합니다. |
| Schema | TypeBox로 요청·응답의 런타임 검증 규칙을 정의하고, API가 주고받을 데이터 형식을 명시합니다. |
| Types | 사용자 상태와 Service 결과처럼 계층 사이에서 전달할 TypeScript 타입을 정의합니다. |

Schema와 Types는 요청을 직접 처리하는 실행 계층은 아닙니다.  
Schema는 서버 실행 중 Fastify가 요청을 검증하고 응답을 직렬화할 때 사용합니다.  
Types는 컴파일할 때 데이터 구조가 올바른지 검사하며, TypeBox의 `Static`으로 Schema에서 필요한 타입을 추출할 수도 있습니다.  

Fastify의 라우트 모듈은 플러그인으로 등록되며, 사용자 도메인의 세부 구현은 `modules/user` 안에서 관리합니다.  

```text
src/
├── app.ts
├── route.ts
├── common/
│   └── errors/
│       ├── business.error.ts
│       ├── error.codes.ts
│       ├── error.handler.ts
│       ├── error.schema.ts
│       └── not-found.handler.ts
├── generated/
│   └── prisma/
├── plugins/
│   └── prisma.plugin.ts
└── modules/
    └── user/
        ├── user.schema.ts
        ├── user.repository.ts
        ├── user.service.ts
        ├── user.controller.ts
        ├── user.types.ts
        └── user.routes.ts
```

요청은 다음 순서로 처리됩니다.  

```text
Client
  ↓
Route: 요청 검증과 API 계약
  ↓
Controller: HTTP 요청과 응답 처리
  ↓
Service: 비즈니스 흐름 결정
  ↓
Repository: Prisma로 DB 접근
```

## 2. Schema-First와 TypeBox 설정 {#session-02}

Fastify는 라우트의 JSON Schema를 사용하여 요청을 검증하고 응답을 직렬화합니다.  
요청의 `params`, `querystring`, `headers`, `body`에 스키마를 지정하면 잘못된 데이터가 핸들러에 도달하기 전에 검증할 수 있습니다.  
응답 스키마를 지정하면 선언한 필드만 JSON 응답으로 직렬화할 수 있습니다.  

TypeBox는 하나의 스키마에서 런타임용 JSON Schema와 컴파일 시점의 TypeScript 타입을 함께 얻도록 도와줍니다.  

```text
TypeBox Schema
  ├─ 런타임: Fastify가 요청 검증과 응답 직렬화에 사용
  └─ 컴파일: TypeScript가 요청과 응답 타입 추론에 사용
```

예를 들어 사용자 ID를 받는 경로 파라미터를 다음과 같이 한 번만 정의합니다.  

```typescript
import { Type, type Static } from 'typebox';

// 서버가 실행될 때 남아 있는 실제 스키마 객체입니다.
const UserIdParamsSchema = Type.Object(
  {
    id: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

// Static은 위 스키마에서 TypeScript 타입을 추출합니다.
// 이 타입은 컴파일할 때만 사용되고 JavaScript 결과에는 남지 않습니다.
type UserIdParamsDto = Static<typeof UserIdParamsSchema>;

// TypeScript는 id가 숫자인지 작성 단계에서 검사합니다.
const params: UserIdParamsDto = { id: 1 };
```

`UserIdParamsSchema`를 JSON으로 표현하면 다음과 같은 구조가 됩니다.  

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "minimum": 1
    }
  },
  "required": ["id"],
  "additionalProperties": false
}
```

Fastify는 이 JSON Schema 객체를 서버 실행 중 요청 검증에 사용합니다.  
개발자는 같은 정의에서 추출한 `UserIdParamsDto`로 자동 완성과 타입 검사를 받습니다.  
따라서 스키마와 TypeScript 타입을 각각 작성하다가 두 정의가 달라지는 문제를 줄일 수 있습니다.  

### 🟦 TypeBox와 Type Provider 설치

현재 TypeBox 1.x 패키지 이름은 `typebox`이며, `@fastify/type-provider-typebox` 5.x 이상은 Fastify 5.x와 호환됩니다.  

```bash
# Fastify 실습 프로젝트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/fastify-basics

# TypeBox와 Fastify용 Type Provider를 설치합니다.
npm install typebox @fastify/type-provider-typebox
```

### 🟦 공통 오류 응답 스키마 정의

`common/errors/error.schema.ts`는 모든 라우트와 오류 처리기가 함께 사용할 오류 응답 계약을 정의합니다.  
오류 코드를 단순 문자열로 선언하지 않고 `ErrorCode` 열거형과 연결하면 스키마와 실제 오류 처리 코드가 같은 값 목록을 사용합니다.  

```typescript
// src/common/errors/error.schema.ts

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

// 전역 오류 처리기도 같은 스키마에서 추출한 타입을 사용합니다.
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
```

전역 `errorHandler`와 `notFoundHandler`는 응답 객체에 `satisfies ErrorResponse`를 사용합니다.  
이 방식은 객체의 구체적인 타입을 유지하면서 공통 오류 응답 형식에 맞는지 검사합니다.  

### 🟦 사용자 조회 스키마와 타입 정의

`user.schema.ts`에서 경로 파라미터와 성공·실패 응답 스키마를 정의합니다.  
`Static`은 TypeBox 스키마에서 TypeScript 타입을 추출하므로 별도의 응답 타입을 다시 작성하지 않아도 됩니다.  

```typescript
// src/modules/user/user.schema.ts

// Fastify Type Provider가 다시 내보내는 TypeBox 빌더를 사용합니다.
import { Type } from '@fastify/type-provider-typebox';
import type { Static } from 'typebox';

import { ErrorResponseSchema } from '../../common/errors/error.schema';
import { UserStatus } from './user.types';

// 애플리케이션의 공통 상태 값을 TypeBox 응답 스키마로 변환합니다.
export const UserStatusSchema = Type.Enum(UserStatus);

// GET /users/:id의 경로 파라미터를 검증합니다.
export const UserIdParamsSchema = Type.Object(
  {
    // Prisma User의 id가 양의 정수이므로 같은 조건을 사용합니다.
    id: Type.Integer({ minimum: 1 }),
  },
  // id 외의 예상하지 않은 경로 파라미터는 허용하지 않습니다.
  { additionalProperties: false },
);

// 클라이언트에 공개할 사용자 정보만 응답 스키마에 포함합니다.
export const UserResponseSchema = Type.Object(
  {
    id: Type.Integer(),
    email: Type.String(),
    // Prisma의 String? 필드는 문자열 또는 null이 될 수 있습니다.
    displayName: Type.Union([Type.String(), Type.Null()]),
    status: UserStatusSchema,
    // Date 객체는 HTTP 응답에서 ISO 문자열로 변환합니다.
    createdAt: Type.String(),
  },
  // 정의하지 않은 내부 필드가 응답에 포함되지 않게 합니다.
  { additionalProperties: false },
);

// Route가 사용할 경로 파라미터와 주요 응답 계약입니다.
export const GetUserRouteSchema = {
  params: UserIdParamsSchema,
  response: {
    // 정상 조회 결과는 공개 가능한 사용자 응답 형태로 직렬화합니다.
    200: UserResponseSchema,
    // 400, 404, 500 등 성공 이외의 응답에는 공통 오류 형식을 사용합니다.
    default: ErrorResponseSchema,
  },
} as const;

// Controller가 반환할 응답 타입도 같은 스키마에서 추출합니다.
export type UserResponseDto = Static<typeof UserResponseSchema>;
```

`additionalProperties: false`는 스키마에 없는 속성을 허용하지 않는다는 JSON Schema 계약입니다.  
Fastify의 기본 Ajv 설정에서는 요청에 포함된 추가 속성을 제거하며, 응답에서는 응답 스키마에 선언한 필드만 직렬화합니다.  
다만 응답 스키마만 믿고 민감 정보를 아무 계층에서나 반환해서는 안 되며, Repository의 `select`에서도 `passwordHash` 같은 필드를 제외하는 편이 안전합니다.  
경로 파라미터는 문자열로 들어오지만 Fastify 5의 기본 Ajv 설정이 스키마에 맞춰 값을 변환하므로 `/users/1`의 `id`를 정수로 사용할 수 있습니다.  

## 3. Layered 계층별 코드 작성 {#session-03}

공통 타입을 분리한 뒤 Repository부터 Controller까지 아래에서 위로 작성합니다.  
의존 방향을 `Controller → Service → Repository → Prisma`로 유지하면 상위 계층이 데이터베이스 쿼리를 직접 알 필요가 없습니다.  

### 🟦 사용자 공통 타입 분리하기

`user.types.ts`에는 Prisma나 HTTP 표현에 직접 의존하지 않는 사용자 상태와 Service 결과 타입을 둡니다.  
상태 값을 `as const` 객체로 정의하면 런타임 값과 TypeScript 유니온 타입을 한곳에서 관리할 수 있습니다.  

```typescript
// src/modules/user/user.types.ts

// 애플리케이션에서 공통으로 사용하는 사용자 상태 값입니다.
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

// 객체의 값으로 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN' 타입을 만듭니다.
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// Service는 HTTP 문자열로 변환하기 전의 Date 객체를 유지합니다.
export interface UserResult {
  id: number;
  email: string;
  displayName: string | null;
  status: UserStatus;
  createdAt: Date;
}
```

### 🟦 Repository에서 Prisma로 조회하기

Repository는 데이터베이스 접근만 담당합니다.  
이 예제에서는 Prisma Client를 생성자에서 전달받고, 사용자 단건 조회에 필요한 필드만 선택합니다.  

```typescript
// src/modules/user/user.repository.ts

import type { PrismaClient } from '../../generated/prisma/client';

export class UserRepository {
  // prisma.plugin.ts에서 공유하는 Prisma Client를 주입받습니다.
  constructor(private readonly prisma: PrismaClient) {}

  // 기본 키로 조회하며 사용자가 없으면 Prisma가 null을 반환합니다.
  findById(id: number) {
    return this.prisma.user.findUnique({
      // id는 고유 키이므로 findUnique로 사용자 한 명만 조회합니다.
      where: { id },
      // 비밀번호 해시처럼 응답에 필요하지 않은 값은 조회하지 않습니다.
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
```

### 🟦 Service에서 비즈니스 흐름 결정하기

Service는 조회 결과가 없는 상황을 `BusinessError`로 바꾸고, 조회한 값을 애플리케이션 결과로 반환합니다.  
전역 오류 처리기는 이 오류의 코드와 HTTP 상태를 읽어 앞에서 정의한 `ErrorResponse` 형식으로 응답합니다.  
따라서 Controller마다 같은 `try/catch`와 오류 응답 코드를 반복하지 않아도 됩니다.  

먼저 `ErrorCode`에 사용자 조회 실패 코드를 정의합니다.  

```typescript
// src/common/errors/error.codes.ts

export enum ErrorCode {
  // 기존 오류 코드는 그대로 둡니다.

  // 사용자를 찾지 못한 경우 Service에서 사용합니다.
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}
```

실제 파일에서는 기존 `ErrorCode` 항목을 지우지 않고 `USER_NOT_FOUND`만 추가합니다.  

`BusinessError`는 Service에서 예상할 수 있는 실패를 오류 코드와 HTTP 상태와 함께 전달합니다.  
전역 오류 처리기는 이 클래스의 인스턴스인지 확인한 뒤 해당 값을 공통 오류 응답으로 변환합니다.  

```typescript
// src/common/errors/business.error.ts

import { ErrorCode } from './error.codes';

export class BusinessError<T = unknown> extends Error {
  constructor(
    // 클라이언트가 오류 종류를 구분할 때 사용하는 고정 코드입니다.
    public readonly errorCode: ErrorCode,
    // Error의 message로 저장할 오류 설명입니다.
    message: string,
    // 전역 오류 처리기가 사용할 HTTP 상태 코드입니다.
    public readonly statusCode: number = 400,
    // 필요한 경우 필드별 검증 결과 같은 상세 정보를 전달합니다.
    public readonly details?: T,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

```typescript
// src/modules/user/user.service.ts

import { BusinessError } from '../../common/errors/business.error';
import { ErrorCode } from '../../common/errors/error.codes';
import type { UserRepository } from './user.repository';
import type { UserResult } from './user.types';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getById(id: number): Promise<UserResult> {
    const user = await this.userRepository.findById(id);

    // 존재하지 않는 사용자는 전역 오류 처리기가 404 응답으로 변환합니다.
    if (user === null) {
      throw new BusinessError(ErrorCode.USER_NOT_FOUND, '사용자를 찾을 수 없습니다.', 404);
    }

    // Repository 결과는 HTTP 표현으로 바꾸지 않고 상위 계층에 전달합니다.
    return user;
  }
}
```

### 🟦 Controller에서 HTTP 요청과 응답 처리하기

Controller는 검증이 끝난 경로 파라미터를 받고 Service를 호출합니다.  
Service의 애플리케이션 결과를 HTTP 응답 스키마에서 추출한 타입으로 변환하여 계층별 책임을 분리합니다.  

```typescript
// src/modules/user/user.controller.ts

import type { FastifyReply } from 'fastify';
import type { Static } from 'typebox';

import {
  UserIdParamsSchema,
  type UserResponseDto,
} from './user.schema';
import type { UserService } from './user.service';

// Controller 입력 타입도 Route에서 사용하는 TypeBox 스키마에서 추출합니다.
type UserIdParamsDto = Static<typeof UserIdParamsSchema>;

export class UserController {
  constructor(private readonly userService: UserService) {}

  async getById(params: UserIdParamsDto, reply: FastifyReply) {
    const user = await this.userService.getById(params.id);

    // HTTP 경계인 Controller에서 Date를 JSON 응답용 문자열로 변환합니다.
    const response: UserResponseDto = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };

    // Controller가 성공 상태 코드와 HTTP 응답을 결정합니다.
    return reply.code(200).send(response);
  }
}
```

## 4. Route와 애플리케이션 연결 {#session-04}

Route는 URL, HTTP 메서드와 스키마를 묶어 API 계약을 정의합니다.  
`FastifyPluginAsyncTypebox`로 라우트 플러그인을 선언하면 스키마에서 `request.params`와 `reply.send()`의 타입을 추론할 수 있습니다.  

Fastify의 Type Provider 타입은 캡슐화된 플러그인 범위에 자동으로 전파되지 않습니다.  
따라서 각 라우트 모듈을 `FastifyPluginAsyncTypebox`로 선언하면 해당 모듈에서 TypeBox 타입 추론을 분명하게 적용할 수 있습니다.  

```typescript
// src/modules/user/user.routes.ts

// 비동기 플러그인 타입을 사용하지만 등록 과정에는 await가 없어 규칙을 비활성화합니다.
/* eslint-disable @typescript-eslint/require-await */

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { UserController } from './user.controller';
import { GetUserRouteSchema } from './user.schema';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

const userRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Repository → Service → Controller 순서로 의존성을 조립합니다.
  // prisma.plugin.ts가 주입한 공유 Prisma Client를 Repository에 전달합니다.
  const userRepository = new UserRepository(fastify.prisma);
  const userService = new UserService(userRepository);
  const userController = new UserController(userService);

  // 상위 prefix와 결합되어 GET /api/users/:id가 됩니다.
  fastify.get(
    '/:id',
    {
      // 요청 검증, 응답 직렬화와 타입 추론에 같은 계약을 사용합니다.
      schema: GetUserRouteSchema,
    },
    // Fastify가 검증하고 추론한 params를 Controller에 전달합니다.
    async (request, reply) => userController.getById(request.params, reply),
  );
};

// 상위 route.ts가 prefix와 함께 등록할 수 있도록 내보냅니다.
export default userRoutes;
```

`route.ts`는 도메인 라우트를 한곳에 모아 각각의 prefix를 지정합니다.  
현재 사용자 라우트에는 `/users`를 붙입니다.  

```typescript
// src/route.ts

import type { FastifyInstance } from 'fastify';

import userRoutes from './modules/user/user.routes';

export function routes(fastify: FastifyInstance) {
  // 사용자 모듈의 /:id와 결합되어 /users/:id가 됩니다.
  fastify.register(userRoutes, { prefix: '/users' });
}
```

마지막으로 `app.ts`에서 Prisma 플러그인 다음에 상위 `routes` 플러그인을 등록합니다.  
Repository가 `fastify.prisma`를 사용하므로 Prisma 플러그인을 먼저 등록해야 합니다.  
상위 prefix `/api`와 사용자 prefix `/users`가 차례로 결합되어 최종 경로가 `/api/users/:id`가 됩니다.  

```typescript
// src/app.ts

import Fastify from 'fastify';

import { routes } from './route';
import prismaPlugin from './plugins/prisma.plugin';

export function createApp() {
  const app = Fastify({
    // 실제 프로젝트의 환경별 로거와 서버 옵션은 그대로 사용합니다.
    logger: loggerOptions,
  });

  // Prisma Client를 먼저 Fastify 인스턴스에 주입합니다.
  app.register(prismaPlugin);

  // route.ts 아래의 모든 비즈니스 API에 /api prefix를 적용합니다.
  app.register(routes, { prefix: '/api' });

  return app;
}
```

`GET /api/users/1` 요청이 들어오면 Route의 TypeBox 스키마가 `id`를 검증하고 Controller가 Service를 호출합니다.  
Service는 사용자 존재 여부를 판단하며, Repository는 Prisma로 데이터베이스를 조회합니다.  
사용자가 없으면 Service가 던진 `BusinessError`를 전역 오류 처리기가 공통 오류 응답으로 변환합니다.  
이처럼 계층별 책임을 분리하면 API 계약이나 데이터베이스 구현이 바뀌어도 수정할 위치를 쉽게 찾을 수 있습니다.  
