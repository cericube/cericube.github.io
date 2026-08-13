---
layout: post
title: "04. Vitest로 Fastify Web API 테스트하기"
description: "Fastify의 inject()를 활용하여 실제 포트를 열지 않고 Query, Path, Body, Header와 인증 및 에러 응답을 Vitest로 검증하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. Fastify 5.6과 Vitest 기본 구조 이해하기"
  - id: session-02
    title: "2. 다양한 입력 유형 테스트 예시: Query, Path, Body, Header"
  - id: session-03
    title: "3. 인증·인가 API 테스트 예시"
  - id: session-04
    title: "4. 에러 응답 및 예외 상황 테스트 예시"
---

## 1. Fastify 5.6과 Vitest 기본 구조 이해하기 {#session-01}

### 🟦 1. Fastify 설치

Vitest는 루트 프로젝트에 설치되어 있으므로 Fastify만 `vitest-basics` 워크스페이스에 설치합니다.  
루트 프로젝트에서 다음 명령어를 실행합니다.  

```bash
# Fastify를 vitest-basics 워크스페이스의 의존성으로 설치합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook
npm install fastify@5.6.2 --workspace vitest-basics

# 루트 프로젝트에서 Fastify와 Vitest 설치 상태를 확인합니다.
npm list fastify vitest

# 또는 vitest-basics 프로젝트로 이동하여 설치합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics
npm install fastify@5.6.2
```

### 🟦 2. inject() 테스트 방식 이해

#### 🔷 inject()란 무엇인가요?

`inject()`는 실제 TCP 포트로 HTTP 요청을 보내지 않고 Fastify 내부에서 가상 요청을 실행하는 메서드입니다.  
요청은 라우팅, Hook, Handler와 직렬화 과정을 통과하므로 실제 서버의 요청 처리 흐름을 검증할 수 있습니다.  

- Controller, Route, Validation과 인증 흐름을 검증할 수 있습니다.  
- Mock 데이터베이스 또는 테스트 데이터베이스를 연결한 통합 테스트에 활용할 수 있습니다.  
- API와 비즈니스 로직이 올바르게 연결되는지 확인하기 좋습니다.  

| 항목 | 실제 HTTP 요청 테스트 | `inject()` 테스트 |
| --- | --- | --- |
| 서버 `listen()` 필요 여부 | 필요합니다. | 필요하지 않습니다. |
| 포트 충돌 | 발생할 수 있습니다. | 발생하지 않습니다. |
| 네트워크 스택 | 포함합니다. | 포함하지 않습니다. |
| 테스트 속도 | 상대적으로 느립니다. | 상대적으로 빠릅니다. |
| CI 환경 | 실행 환경의 영향을 받을 수 있습니다. | 포트에 의존하지 않아 안정적입니다. |

`inject()`는 네트워크 계층 자체를 검증하지는 않습니다.  
대신 애플리케이션 내부의 HTTP 처리 흐름을 빠르게 테스트할 때 적합합니다.  

### 🟦 3. Fastify 서버 기본 구조

Fastify 인스턴스 생성을 별도의 빌더 함수로 분리합니다.  
이렇게 하면 포트를 열지 않은 인스턴스를 테스트에서 생성하여 `inject()`로 요청할 수 있습니다.  

> 실습 파일: `src/ch04/4-1-1.health-app.ts`

```typescript
// src/ch04/4-1-1.health-app.ts
import Fastify from 'fastify';

// 테스트와 실제 서버 실행 코드가 함께 사용할 애플리케이션을 만듭니다.
export function buildApp() {
  // 이 단계에서는 포트를 열지 않고 Fastify 인스턴스만 생성합니다.
  const app = Fastify();

  app.get('/health', () => {
    // 반환한 객체는 Fastify가 JSON 응답으로 직렬화합니다.
    return { ok: true };
  });

  return app;
}
```

여러 Route를 다루는 `4-2-1.request-inputs-app.ts`에서는 등록 함수를 기능별로 나누고 `register()`로 조립합니다.  

```typescript
// src/ch04/4-2-1.request-inputs-app.ts
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify();

  // 기능별 등록 함수를 Fastify Plugin으로 조립합니다.
  app.register(registerSearchRoute);
  app.register(registerUsersRoute);
  app.register(registerEchoRoute);
  app.register(registerWhoamiRoute);
  app.register(registerMultiInputRoute);

  return app;
}
```

### 🟦 4. app.route()와 JSON Schema 구조 이해

`app.post()`와 같은 메서드는 `app.route()`를 간편하게 사용할 수 있도록 제공하는 단축 메서드입니다.  
실습 코드에서는 `schema`로 실행 중의 입력값을 검증하고, 검증을 통과한 값을 TypeScript 타입으로 확인하여 사용합니다.  

```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';

export function registerMultiInputRoute(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/multi',

    // Query와 Body를 각각 JSON Schema로 검증합니다.
    schema: {
      querystring: {
        type: 'object',
        properties: {
          verbose: { type: 'boolean' },
        },
      },
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
        },
      },
    },

    handler: (request: FastifyRequest) => {
      const { verbose } = request.query as { verbose?: boolean };
      const body = request.body as { title: string };

      return {
        message: verbose ? `Verbose: ${body.title}` : body.title,
      };
    },
  });
}
```

`tests/ch04/4-2-1.request-inputs.test.ts`에서는 `verbose` 값에 따라 응답이 달라지는지도 확인합니다.  

```typescript
it('verbose=true이면 상세 메시지를 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/multi?verbose=true',
    body: { title: 'Test' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ message: 'Verbose: Test' });
});

it('verbose=false이면 제목만 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/multi?verbose=false',
    body: { title: 'Test' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ message: 'Test' });
});
```

TypeScript 타입은 컴파일 과정에서만 확인하므로 외부 요청의 실제 값까지 검증하지는 못합니다.  
실습 코드처럼 JSON Schema와 TypeScript 타입을 함께 사용하면 런타임 검증과 타입 검사를 나누어 처리할 수 있습니다.  

### 🟦 5. 테스트 기본 템플릿

Fastify 인스턴스는 테스트를 시작할 때 생성하고 모든 테스트가 끝나면 종료합니다.  

> 실습 파일: `tests/ch04/4-1-1.health.test.ts`

```typescript
// tests/ch04/4-1-1.health.test.ts
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/ch04/4-1-1.health-app';

let app: FastifyInstance;

describe('API 테스트', () => {
  beforeAll(async () => {
    app = buildApp();

    // 등록한 Plugin과 Route가 모두 준비될 때까지 기다립니다.
    await app.ready();
  });

  afterAll(async () => {
    // 테스트가 끝난 뒤 타이머와 연결 같은 리소스를 정리합니다.
    await app.close();
  });

  it('GET /health가 정상 응답을 반환합니다', async () => {
    // 실제 포트를 열지 않고 Fastify 내부에 요청을 주입합니다.
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.json()).toEqual({ ok: true });
  });
});
```

## 2. 다양한 입력 유형 테스트 예시: Query, Path, Body, Header {#session-02}

Fastify의 `inject()`에는 URL, 요청 본문과 Header를 실제 HTTP 요청과 비슷한 형태로 전달할 수 있습니다.  
아래 예제는 `src/ch04/4-2-1.request-inputs-app.ts`와 `tests/ch04/4-2-1.request-inputs.test.ts`의 핵심 코드입니다.  
각 Route는 `buildApp()`에서 등록되며 테스트에서는 같은 `app` 인스턴스를 사용합니다.  

### 🟦 1. Query Parameter 테스트 예시

Fastify는 `request.query`를 통해 Query Parameter를 읽을 수 있습니다.  
필요하면 JSON Schema를 사용하여 입력값을 검증할 수도 있습니다.  

```typescript
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

// Query Parameter를 응답으로 반환하는 Route입니다.
export function registerSearchRoute(app: FastifyInstance) {
  app.route({
    method: 'GET',
    url: '/search',
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
        },
        required: ['q'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
        },
      },
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { q: string };

      return reply.send({ result: query.q });
    },
  });
}

it('Query Parameter에 맞는 결과를 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/search?q=fastify한글',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ result: 'fastify한글' });
});
```

### 🟦 2. Path Parameter 테스트

```typescript
// URL의 id 값을 응답으로 반환하는 Route입니다.
export function registerUsersRoute(app: FastifyInstance) {
  app.route({
    method: 'GET',
    url: '/users/:id',
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
    handler: (request: FastifyRequest) => {
      const params = request.params as { id: string };

      return { id: params.id };
    },
  });
}

it('Path Parameter에 맞는 결과를 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/users/123',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ id: '123' });
});
```

### 🟦 3. JSON Body(POST) 테스트

```typescript
// 전달받은 JSON Body를 그대로 반환하는 Route입니다.
export function registerEchoRoute(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/echo',
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      },
    },
    handler: (request: FastifyRequest) => {
      const body = request.body as { name: string; age?: number };

      return body;
    },
  });
}

it('JSON Body에 맞는 결과를 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/echo',
    body: { name: 'Alice한글', age: 30 },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ name: 'Alice한글', age: 30 });
});
```

실습 파일에서는 `inject()`의 JSON 요청 본문을 `body`로 전달합니다.  
`name`이 누락되면 Route Handler를 실행하기 전에 JSON Schema 검증에서 400 응답을 반환합니다.  

```typescript
it('name이 없으면 400을 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/echo',
    body: { age: 30 },
  });

  expect(response.statusCode).toBe(400);
});
```

### 🟦 4. Header 기반 테스트

```typescript
// User-Agent Header를 읽어 응답으로 반환하는 Route입니다.
export function registerWhoamiRoute(app: FastifyInstance) {
  app.route({
    method: ['GET', 'POST'],
    url: '/whoami',
    handler: (request: FastifyRequest) => {
      // Node.js에서는 요청 Header 이름을 소문자로 정규화합니다.
      const agent = request.headers['user-agent'] ?? 'unknown';

      return { userAgent: agent };
    },
  });
}

it('사용자 정의 Header를 읽어 결과를 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/whoami',
    headers: {
      'user-agent': 'VitestClient/1.0',
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json<{ userAgent: string }>().userAgent).toBe(
    'VitestClient/1.0',
  );
});
```

Query·Path, JSON Body와 Header를 더 자세히 연습하는 코드는 각각 `4-2-2`, `4-2-3`, `4-2-4` 파일로 분리되어 있습니다.  
이 파일들은 필터링과 페이지네이션, 게시글 입력 검증, ETag와 조건부 요청 같은 확장 사례를 다룹니다.  

## 3. 인증·인가 API 테스트 예시 {#session-03}

### 🟦 preHandler란 무엇인가요?

`preHandler`는 요청이 실제 Route Handler에 도달하기 직전에 실행되는 Hook입니다.  
Fastify에서는 인증과 인가, 로깅 또는 요청 전처리 등에 활용할 수 있습니다.  

```text
onRequest
  → preParsing
  → preValidation
  → preHandler
  → handler
  → response
```

다음 예제는 Authorization Header가 있는지와 Token이 올바른지를 `preHandler`에서 확인합니다.  

> 실습 파일: `src/ch04/4-3-1.authentication-and-authorization-app.ts`, `tests/ch04/4-3-1.authentication-and-authorization.test.ts`

```typescript
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

interface AuthenticatedUser {
  id: number;
  name: string;
}

type AuthenticatedRequest = FastifyRequest & { user?: AuthenticatedUser };

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Promise 기반 Hook의 완료 시점을 Fastify가 기다리도록 비동기로 선언합니다.
  await Promise.resolve();
  const auth = request.headers.authorization;

  if (!auth) {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: '토큰이 필요합니다.',
    });
    return;
  }

  if (auth !== 'Bearer valid-token') {
    reply.status(403).send({
      code: 'FORBIDDEN',
      message: '권한이 없습니다.',
    });
    return;
  }

  // 인증을 통과한 요청에 테스트용 사용자 정보를 저장합니다.
  (request as AuthenticatedRequest).user = { id: 1, name: 'Jane' };
}

export function meRoutes(app: FastifyInstance) {
  app.route({
    method: 'GET',
    url: '/me',
    preHandler: verifyToken,
    handler: (request) => {
      // preHandler를 통과한 요청의 사용자 정보를 반환합니다.
      return { user: (request as AuthenticatedRequest).user };
    },
  });
}
```

테스트에서는 Header가 없는 경우, 잘못된 Token을 전달한 경우와 인증에 성공한 경우를 각각 확인합니다.  

```typescript
it('Authorization Header가 없으면 401을 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/me',
  });

  expect(response.statusCode).toBe(401);
  expect(response.json()).toEqual({
    code: 'UNAUTHORIZED',
    message: '토큰이 필요합니다.',
  });
});

it('잘못된 Token이면 403을 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/me',
    headers: { authorization: 'Bearer wrong-token' },
  });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toEqual({
    code: 'FORBIDDEN',
    message: '권한이 없습니다.',
  });
});

it('올바른 Token이면 사용자 정보를 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/me',
    headers: { authorization: 'Bearer valid-token' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    user: { id: 1, name: 'Jane' },
  });
});
```

같은 실습 파일의 `/admin` Route는 인증 여부뿐 아니라 관리자 권한도 확인합니다.  
일반 사용자 Token은 403을 반환하고 관리자 Token은 정상 응답을 반환합니다.  

```typescript
it('일반 사용자 Token이면 관리자 접근을 거부합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/admin',
    headers: { authorization: 'Bearer user-token' },
  });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toEqual({
    code: 'FORBIDDEN',
    message: '관리자 전용입니다.',
  });
});

it('관리자 Token이면 접근을 허용합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/admin',
    headers: { authorization: 'Bearer admin-token' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    status: '관리자 접근 성공',
  });
});
```

권한과 역할을 더 세분화한 연습 코드는 `4-3-2.access-control-app.ts`와 대응하는 테스트 파일에 분리되어 있습니다.  

## 4. 에러 응답 및 예외 상황 테스트 예시 {#session-04}

### 🟦 1. 공통 에러 응답 형식 설계

API의 에러 응답 형식을 일정하게 정하면 클라이언트와 테스트에서 오류를 일관된 방식으로 처리할 수 있습니다.  

```jsonc
{
  "error": "ValidationError",
  "code": "VALIDATION_ERROR",
  "message": "수량은 1 이상이어야 합니다.",
  "details": {} // 필요한 경우에만 상세 정보를 포함합니다.
}
```

### 🟦 2. 공통 비즈니스 에러 클래스 정의

비즈니스 로직에서 발생하는 에러는 공통 `AppError` 클래스를 기준으로 정의합니다.  

> 실습 파일: `src/ch04/4-4-1.app-errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### 🟦 3. 파생 에러 클래스 예시

| 클래스 | HTTP 상태 코드 | `code` |
| --- | ---: | --- |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` |

각 파생 클래스는 상태 코드와 에러 코드를 생성자에서 공통으로 설정합니다.  

```typescript
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const idSuffix = id === undefined ? '' : ` ${id}`;

    super(404, 'NOT_FOUND', `${resource}${idSuffix}을(를) 찾을 수 없습니다`, {
      resource,
      id,
    });
    this.name = 'NotFoundError';
  }
}
```

### 🟦 4. Fastify 전역 Error Handler 구조

Fastify의 전역 Error Handler를 사용하면 처리 중 발생한 예외를 한곳에서 응답으로 변환할 수 있습니다.  
존재하지 않는 Route에 대한 응답은 `setNotFoundHandler()`로 따로 처리할 수 있습니다.  

> 실습 파일: `src/ch04/4-4-1.error-handler.ts`, `src/ch04/4-4-1.orders-app.ts`

```typescript
export function buildApp() {
  const app = Fastify();

  // 공통 Error Handler를 먼저 설정한 뒤 주문 Route를 등록합니다.
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.register(orderRoutes);

  return app;
}
```

#### 🔷 AppError 처리

```typescript
if (error instanceof AppError) {
  const payload: Record<string, unknown> = {
    error: error.name,
    code: error.code,
    message: error.message,
  };

  // 상세 정보가 있을 때만 응답에 포함합니다.
  if (error.details !== undefined) {
    payload.details = error.details;
  }

  return reply.code(error.statusCode).send(payload);
}
```

#### 🔷 Fastify Validation Error 처리

Fastify의 Schema Validation에 실패하면 Error 객체의 `validation` 속성에 검증 결과가 들어갑니다.  
이를 수동으로 발생시킨 `ValidationError`와 같은 에러 코드 체계로 변환할 수 있습니다.  

```typescript
if (error.validation) {
  return reply.code(400).send({
    error: 'ValidationError',
    code: 'VALIDATION_ERROR',
    message: '입력 데이터가 유효하지 않습니다',
    details: {
      validation: error.validation,
      validationContext: error.validationContext,
    },
  });
}
```

`AppError`와 Schema Validation Error에 해당하지 않는 예외는 내부에 상세 내용을 기록하고 클라이언트에는 공통 500 응답을 반환합니다.  

```typescript
console.error('Unexpected error:', error);

return reply.code(500).send({
  error: 'InternalServerError',
  code: 'INTERNAL_SERVER_ERROR',
  message: '서버 내부 오류가 발생했습니다',
});
```

### 🟦 5. 테스트 코드 예시

수량이 허용 범위를 벗어났을 때 상태 코드와 에러 응답의 상세 정보를 함께 확인합니다.  

> 실습 파일: `tests/ch04/4-4-1.order-errors.test.ts`

```typescript
it('quantity가 0 이하면 400을 반환합니다', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/orders',
    payload: {
      productId: 'prod-1',
      quantity: 0,
      userId: 'user-1',
    },
  });

  expect(response.statusCode).toBe(400);

  const body = response.json();
  expect(body.message).toContain('1 이상');
  expect(body.details.field).toBe('quantity');
  expect(body.details.constraint).toContain('min: 1');
});
```
