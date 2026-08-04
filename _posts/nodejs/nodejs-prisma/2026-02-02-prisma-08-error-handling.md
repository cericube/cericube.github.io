---
layout: post
title: "08. Node.js와 Prisma 오류 종류 및 처리 방법"
description: "Node.js와 Prisma에서 발생하는 주요 오류 유형과 코드를 살펴보고, 이를 애플리케이션 오류와 HTTP 응답으로 안전하게 변환하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prisma 오류 분류 체계"
  - id: session-02
    title: "2. 실무에서 자주 발생하는 Prisma 오류 코드 이해하기"
  - id: session-03
    title: "3. Prisma 오류를 HTTP 오류로 변환하는 예시"
  - id: session-04
    title: "4. Fastify 레이어별 오류 처리 예시"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/prisma-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. Prisma 오류 분류 체계 {#session-01}

Prisma Client는 데이터베이스 접근을 추상화하는 클라이언트 계층입니다.  
따라서 Prisma에서 발생하는 오류는 데이터베이스 요청이나 클라이언트 설정에서 생긴 문제를 애플리케이션에 전달하는 경우가 많습니다.  
Prisma 오류 메시지를 그대로 사용자에게 보여 주기보다 애플리케이션에서 정의한 오류로 변환하는 것이 중요합니다.  

이 글에서는 애플리케이션에서 먼저 구분해야 할 네 가지 Prisma Client 오류를 다룹니다.  

| 분류 | 클래스 | 설명 |
| --- | --- | --- |
| 요청 오류 | `PrismaClientKnownRequestError` | `Pxxxx` 형식의 알려진 오류 코드를 제공합니다. |
| 요청 오류 | `PrismaClientUnknownRequestError` | 요청 처리 중 오류 코드가 없는 예외가 발생합니다. |
| 검증 오류 | `PrismaClientValidationError` | 쿼리 인자나 구조를 Prisma Client가 검증하지 못합니다. |
| 초기화 오류 | `PrismaClientInitializationError` | 쿼리 엔진 시작이나 데이터베이스 연결 초기화에 실패합니다. |

이 가운데 애플리케이션에서 가장 구체적으로 분기할 수 있는 오류는 `PrismaClientKnownRequestError`입니다.  

오류를 식별하고 처리할 때는 다음 원칙을 따릅니다.  

- 오류 메시지 문자열로 분기하지 않습니다.
- `PrismaClientKnownRequestError`인지 확인한 뒤 `code`와 필요한 `meta`를 살펴봅니다.
- 내부 오류 메시지를 그대로 노출하지 않고 안전한 사용자용 메시지로 변환합니다.

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

try {
  await prisma.user.create({
    data: { email: 'test@example.com' },
  });
} catch (error: unknown) {
  // 알려진 Prisma 요청 오류일 때만 code와 meta에 접근합니다.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.log(error.code); // 이메일이 중복되었다면 P2002입니다.
    console.log(error.meta); // 제약 조건 등 오류의 부가 정보입니다.
  }
}
```

## 2. 실무에서 자주 발생하는 Prisma 오류 코드 이해하기 {#session-02}

아래 예시는 Prisma 오류의 의미와 변환 방법을 이해하기 위한 코드입니다.  
실무에서는 공통 변환 로직을 전역 오류 핸들러로 옮겨 중복을 줄이는 경우가 많습니다.  
예제의 `ConflictError`, `BadRequestError`와 `NotFoundError`는 프로젝트에서 정의한 애플리케이션 오류 클래스라고 가정합니다.  

### 🟦 1. P2002 - Unique Constraint Violation

`P2002`는 고유 제약 조건을 위반했을 때 발생합니다.  

- 회원 가입 중 이미 등록된 이메일을 다시 저장한 경우
- `username`, `slug`, `code` 등 고유 인덱스가 있는 컬럼의 값이 중복된 경우
- `@@unique`로 정의한 복합 고유 키가 충돌한 경우

```text
Unique constraint failed on the constraint: (`email`)
```

데이터베이스는 고유 제약 조건을 지키기 위해 요청을 정상적으로 거부한 것입니다.  
그러나 사용자에게는 이해할 수 있는 비즈니스 오류로 안내해야 합니다.  
따라서 일반적인 서버 오류인 500보다 중복 리소스를 뜻하는 409 응답으로 변환할 수 있습니다.  

```typescript
async function createUser(data: Prisma.UserCreateInput) {
  try {
    return await prisma.user.create({ data });
  } catch (error: unknown) {
    // 고유 제약 조건 위반만 애플리케이션의 충돌 오류로 바꿉니다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('이미 존재하는 사용자입니다.');
    }

    // 처리하지 않은 오류는 원래 정보를 유지하여 상위 계층으로 전달합니다.
    throw error;
  }
}
```

HTTP 응답으로 변환하는 예시는 다음과 같습니다.  

| 항목 | 값 |
| --- | --- |
| HTTP 상태 | `409 Conflict` |
| 오류 코드 | `DUPLICATE_RESOURCE` |
| 메시지 | 이미 존재하는 리소스입니다. |

### 🟦 2. P2003 - Foreign Key Constraint Failed

`P2003`은 외래 키 제약 조건을 위반했을 때 발생합니다.  

- 존재하지 않는 외래 키를 참조한 경우
- 부모 레코드가 없는 상태에서 자식 레코드를 생성한 경우
- 연관된 자식 레코드가 있는데 부모 레코드를 삭제하려는 경우

```text
Foreign key constraint failed on the field: `authorId`
```

데이터베이스는 존재하지 않는 데이터를 참조하거나 관계를 깨뜨리지 못하도록 요청을 거부합니다.  
자식 레코드를 만들 때 잘못된 외래 키를 보냈다면 API 관점에서는 요청 데이터의 정합성 문제로 볼 수 있습니다.  

```typescript
async function createPost(authorId: number, title: string) {
  try {
    return await prisma.post.create({
      data: {
        authorId,
        title,
      },
    });
  } catch (error: unknown) {
    // 존재하지 않는 작성자를 참조했다면 잘못된 요청으로 변환합니다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestError('유효하지 않은 참조 값입니다.');
    }

    throw error;
  }
}
```

HTTP 응답으로 변환하는 예시는 다음과 같습니다.  

| 항목 | 값 |
| --- | --- |
| HTTP 상태 | `400 Bad Request` |
| 오류 코드 | `INVALID_REFERENCE` |
| 메시지 | 참조 대상이 존재하지 않습니다. |

같은 `P2003`이라도 연관 데이터 때문에 삭제가 거부된 상황이라면 `409 Conflict`가 더 자연스러울 수 있습니다.  
Prisma 오류 코드와 HTTP 상태는 항상 일대일로 고정하지 않고 수행한 작업의 의미에 맞게 정합니다.  

### 🟦 3. P2025 - Required Record Not Found

Prisma ORM 6부터 기존 `NotFoundError` 타입은 제거되었습니다.  
`findUniqueOrThrow()`와 `findFirstOrThrow()`에서 레코드를 찾지 못하면 `PrismaClientKnownRequestError`의 `P2025` 코드가 발생합니다.  

- `findUniqueOrThrow()` 또는 `findFirstOrThrow()`로 레코드를 찾지 못한 경우
- 관계 연결에 필요한 레코드가 존재하지 않는 경우
- 중첩 쓰기에 필요한 레코드가 누락된 경우

```text
An operation failed because it depends on one or more records that were required but not found.
```

`P2025`는 작업에 반드시 필요한 레코드가 없을 때 발생합니다.  
API에서는 일반적으로 찾을 수 없는 리소스를 뜻하는 404 응답으로 변환합니다.  

```typescript
async function getUser(id: number) {
  try {
    // 레코드가 없으면 null 대신 P2025 오류를 발생시킵니다.
    return await prisma.user.findUniqueOrThrow({
      where: { id },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundError('사용자를 찾을 수 없습니다.');
    }

    throw error;
  }
}
```

HTTP 응답으로 변환하는 예시는 다음과 같습니다.  

| 항목 | 값 |
| --- | --- |
| HTTP 상태 | `404 Not Found` |
| 오류 코드 | `RESOURCE_NOT_FOUND` |
| 메시지 | 리소스를 찾을 수 없습니다. |

### 🟦 4. P2014 - Relation Violation

`P2014`는 Prisma 스키마에 정의한 필수 관계를 깨뜨리는 변경을 시도했을 때 발생합니다.  

- 필수 관계를 해제하려는 경우
- 관계 변경으로 필수 연관 레코드가 사라지는 경우
- 중첩 쓰기에서 필수 관계 조건을 위반한 경우

```text
The change you are trying to make would violate the required relation.
```

이 오류는 데이터 무결성을 지키기 위해 요청을 거부한 경우이므로, 애플리케이션에서는 관계 충돌로 표현할 수 있습니다.  
PostgreSQL의 외래 키가 직접 삭제를 막는 상황에서는 `P2014` 대신 `P2003`이 발생할 수 있습니다.  

```typescript
async function deleteUser(id: number) {
  try {
    return await prisma.user.delete({ where: { id } });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // 필수 관계 위반 또는 DB 외래 키 위반을 같은 삭제 충돌로 처리합니다.
      // onDelete: Restrict 관계에서 연결된 게시물이 있는 사용자를 삭제
      (error.code === 'P2014' || error.code === 'P2003')
    ) {
      throw new ConflictError('연관된 데이터가 있어 삭제할 수 없습니다.');
    }

    throw error;
  }
}
```

HTTP 응답으로 변환하는 예시는 다음과 같습니다.  

| 항목 | 값 |
| --- | --- |
| HTTP 상태 | `409 Conflict` |
| 오류 코드 | `RELATION_CONFLICT` |
| 메시지 | 연관된 리소스로 인해 작업을 수행할 수 없습니다. |

### 🟦 5. Validation 및 Initialization 계열 오류

### 🔷 1) PrismaClientValidationError

`PrismaClientValidationError`는 Prisma Client에 전달한 쿼리 인자나 구조가 올바르지 않을 때 발생합니다.  

- 필드 타입이 일치하지 않는 경우
- 필수 필드를 빠뜨린 경우
- `where`, `include` 또는 `select` 구조가 잘못된 경우
- 생성된 Prisma Client와 현재 코드가 일치하지 않는 경우

```typescript
if (error instanceof Prisma.PrismaClientValidationError) {
  // 쿼리 작성 오류를 추적할 수 있도록 내부 로그에는 원본 오류를 남깁니다.
  request.log.error({ err: error }, 'Prisma validation error');

  // 내부 구조와 자세한 메시지는 사용자에게 노출하지 않습니다.
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
    },
  });
}
```

### 🔷 2) PrismaClientInitializationError

`PrismaClientInitializationError`는 쿼리 엔진을 시작하거나 처음 데이터베이스 연결을 만들 때 문제가 생기면 발생합니다.  

- 데이터베이스 서버에 연결하지 못한 경우
- `DATABASE_URL` 환경 변수가 없거나 잘못된 경우
- 데이터베이스 인증 정보가 잘못된 경우
- 현재 데이터베이스 버전이 Prisma 기능을 지원하지 않는 경우

```typescript
if (error instanceof Prisma.PrismaClientInitializationError) {
  // 서비스 시작이나 DB 연결 문제이므로 높은 로그 수준으로 기록합니다.
  request.log.fatal({ err: error }, 'Prisma initialization error');

  return reply.status(503).send({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: '일시적으로 서비스를 사용할 수 없습니다.',
    },
  });
}
```

커넥션 풀에서 연결을 얻지 못해 시간이 초과된 경우에는 초기화 오류가 아니라 알려진 요청 오류인 `P2024`가 발생할 수 있습니다.  

### 🔷 3) PrismaClientUnknownRequestError

`PrismaClientUnknownRequestError`는 요청 처리 중 쿼리 엔진이 오류 코드를 제공하지 않은 예외를 반환할 때 발생합니다.  

- 오류 코드가 없는 쿼리 엔진 오류가 발생한 경우
- 일반 코드만으로 원인을 구분하기 어려운 요청 실패가 발생한 경우

```typescript
if (error instanceof Prisma.PrismaClientUnknownRequestError) {
  // 원인을 조사할 수 있도록 서버 로그에 원본 오류를 기록합니다.
  request.log.error({ err: error }, 'Unknown Prisma error');

  return reply.status(500).send({
    error: {
      code: 'DATABASE_ERROR',
      message: '서버 오류가 발생했습니다.',
    },
  });
}
```

## 3. Prisma 오류를 HTTP 오류로 변환하는 예시 {#session-03}

### 🟦 1. Prisma에서 HTTP 상태로 매핑하는 예시

다음 표는 일반적인 API에서 사용할 수 있는 매핑 예시입니다.  
요청의 목적과 서비스 정책에 따라 같은 Prisma 코드도 다른 HTTP 상태로 변환할 수 있습니다.  

| Prisma 코드 또는 클래스 | 상황 | HTTP 상태 예시 |
| --- | --- | --- |
| `P2002` | 고유 제약 조건 충돌 | `409 Conflict` |
| `P2003` | 존재하지 않는 외래 키 참조 | `400 Bad Request` |
| `P2025` | 작업 대상 레코드 없음 | `404 Not Found` |
| `P2001` | `where` 조건에 맞는 레코드 없음 | `404 Not Found` |
| `P2014` | 필수 관계 충돌 | `409 Conflict` |
| `PrismaClientValidationError` | 서버 쿼리 코드 오류 | `500 Internal Server Error` |
| `PrismaClientInitializationError` | 데이터베이스 연결 또는 환경 문제 | `503 Service Unavailable` |
| `PrismaClientUnknownRequestError` | 코드가 없는 요청 처리 오류 | `500 Internal Server Error` |

### 🟦 2. Prisma 오류를 애플리케이션 오류로 변환하기

Prisma 같은 인프라 계층의 오류는 한곳에서 애플리케이션 오류로 변환하면 처리 흐름을 일관되게 유지할 수 있습니다.  
다음 예제에서는 애플리케이션 오류가 HTTP 상태와 응답 코드를 함께 갖도록 정의합니다.  

```typescript
// 애플리케이션에서 공통으로 사용할 오류의 기본 클래스입니다.
class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'RESOURCE_NOT_FOUND');
  }
}

class InternalServerError extends AppError {
  constructor() {
    super('서버 오류가 발생했습니다.', 500, 'INTERNAL_SERVER_ERROR');
  }
}

function mapPrismaError(error: unknown): AppError {
  // 알려진 요청 오류가 아니면 안전한 내부 서버 오류로 변환합니다.
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return new InternalServerError();
  }

  // message 문자열 대신 안정적으로 제공되는 code로 분기합니다.
  switch (error.code) {
    case 'P2002':
      return new ConflictError('이미 존재하는 리소스입니다.');
    case 'P2001':
    case 'P2025':
      return new NotFoundError('리소스를 찾을 수 없습니다.');
    case 'P2003':
      return new BadRequestError('유효하지 않은 참조 값입니다.');
    case 'P2014':
      return new ConflictError(
        '연관된 데이터로 인해 작업을 수행할 수 없습니다.',
      );
    default:
      return new InternalServerError();
  }
}
```

이 매퍼는 공통 기본값을 제공하는 예시입니다.  
삭제 중 발생한 `P2003`처럼 작업 맥락이 필요한 오류는 서비스 계층에서 먼저 더 구체적인 오류로 바꿀 수 있습니다.  

### 🟦 3. 오류 응답 표준 형식

모든 오류 응답은 하나의 고정된 구조로 유지하는 것이 좋습니다.  
응답 구조가 일정하면 프런트엔드에서도 오류를 단순하고 일관되게 처리할 수 있습니다.  

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "게시글을 찾을 수 없습니다."
  }
}
```

## 4. Fastify 레이어별 오류 처리 예시 {#session-04}

### 🟦 1. Repository - 데이터베이스 접근에 집중하기

Repository는 데이터베이스 접근을 담당합니다.  
일반적인 CRUD 코드에서는 오류를 HTTP 응답으로 바꾸거나 같은 오류를 반복해서 기록하지 않고 상위 계층으로 전달합니다.  

- 일반적인 CRUD에서는 불필요한 `try-catch`를 두지 않습니다.
- HTTP 상태나 응답 형식을 결정하지 않습니다.
- 필요한 데이터베이스 작업만 수행합니다.

```typescript
// user.repository.ts
import {
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    // email은 고유 필드이므로 findUnique()로 한 명을 조회합니다.
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput) {
    // 검증된 생성 데이터를 Prisma Client에 그대로 전달합니다.
    return this.prisma.user.create({ data });
  }
}
```

### 🟦 2. Service - 비즈니스 의미로 표현하기

Service는 HTTP 응답을 직접 만들지 않고 비즈니스 규칙을 표현합니다.  
예상 가능한 비즈니스 오류는 애플리케이션 오류로 바꾸고, 그 밖의 오류는 전역 오류 핸들러가 처리할 수 있도록 전달합니다.  

- HTTP 응답을 직접 만들지 않습니다.
- 의도한 비즈니스 오류는 애플리케이션 오류로 표현합니다.
- 알 수 없는 인프라 오류는 임의로 숨기지 않고 상위 계층으로 전달합니다.

> Service는 의도한 비즈니스 오류만 직접 던집니다.  
> Prisma 같은 인프라 오류는 전역 오류 핸들러에서 일관되게 변환할 수 있습니다.  

```typescript
// user.service.ts
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async register(email: string, displayName: string) {
    // 서비스 정책에 따라 가입 전에 이메일 중복 여부를 확인합니다.
    const existingUser = await this.repository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('이미 가입된 이메일입니다.');
    }

    // 동시에 같은 이메일 가입 요청이 들어오면 P2002가 발생할 수 있습니다.
    // 이 경쟁 상황은 전역 오류 핸들러에서도 다시 처리합니다.
    return this.repository.create({ email, displayName });
  }
}
```

### 🟦 3. Controller - 입력과 출력에 집중하기

Controller는 요청 입력을 Service에 전달하고 성공 응답을 만드는 역할을 담당합니다.  
각 Controller에서 같은 `try-catch`를 반복하면 오류 처리가 분산되므로 처리하지 않은 오류는 Fastify에 전달합니다.  

```typescript
// user.controller.ts
import type { FastifyReply, FastifyRequest } from 'fastify';

type RegisterBody = {
  email: string;
  displayName: string;
};

// 애플리케이션을 시작할 때 생성한 Service를 사용한다고 가정합니다.
declare const userService: UserService;

export async function registerHandler(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply,
) {
  const { email, displayName } = request.body;
  const user = await userService.register(email, displayName);

  return reply.code(201).send({
    id: user.id,
    email: user.email,
  });
}
```

### 🟦 4. 전역 오류 핸들러와 로그 기록 예시

Fastify는 동기 라우트에서 던진 오류와 비동기 라우트에서 거부된 Promise를 포착하여 오류 핸들러로 전달합니다.  
`setErrorHandler()`를 등록하면 애플리케이션의 공통 오류 응답과 로그 정책을 한곳에서 관리할 수 있습니다.  

```typescript
app.setErrorHandler((error, request, reply) => {
  // 1. Service에서 의도적으로 던진 애플리케이션 오류를 처리합니다.
  if (error instanceof AppError) {
    request.log.info({ err: error }, 'Operational error');

    return reply.status(error.statusCode).send({
      error: {
        code: error.errorCode,
        message: error.message,
      },
    });
  }

  // 2. Service에서 변환하지 않은 알려진 Prisma 오류를 공통 규칙으로 바꿉니다.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mappedError = mapPrismaError(error);
    request.log.warn({ err: error }, 'Prisma request error');

    return reply.status(mappedError.statusCode).send({
      error: {
        code: mappedError.errorCode,
        message: mappedError.message,
      },
    });
  }

  // 3. 초기화 문제는 서비스가 현재 요청을 처리할 수 없음을 알립니다.
  if (error instanceof Prisma.PrismaClientInitializationError) {
    request.log.error({ err: error }, 'Prisma initialization error');

    return reply.status(503).send({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '일시적으로 서비스를 사용할 수 없습니다.',
      },
    });
  }

  // 4. 잘못 구성한 쿼리의 내부 정보를 숨기고 서버 오류로 처리합니다.
  if (error instanceof Prisma.PrismaClientValidationError) {
    request.log.error({ err: error }, 'Prisma validation error');

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  }

  // 5. 코드가 없는 Prisma 요청 오류도 세부 내용을 노출하지 않습니다.
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    request.log.error({ err: error }, 'Unknown Prisma error');

    return reply.status(500).send({
      error: {
        code: 'DATABASE_ERROR',
        message: '서버 오류가 발생했습니다.',
      },
    });
  }

  // 6. 그 밖의 예기치 못한 오류는 높은 수준으로 기록합니다.
  request.log.fatal({ err: error }, 'Unexpected error');

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
    },
  });
});
```

운영 환경에서는 내부 오류 객체를 로그에 남기되, 클라이언트에는 안전하고 일관된 메시지만 반환해야 합니다.  
