---
layout: post
title: "05. Vitest로 외부 API 테스트하기: Axios와 Undici"
description: "Vitest에서 Axios와 Undici로 외부 HTTP API를 호출하고, 상태 코드와 JSON 응답을 검증하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. 외부 API 테스트 실습 준비"
  - id: session-02
    title: "2. Axios와 Undici 비교"
  - id: session-03
    title: "3. Axios를 이용한 테스트(생산성 중심)"
  - id: session-04
    title: "4. Undici를 이용한 테스트(성능 및 표준 중심)"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/vitest-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 외부 API 테스트 실습 준비 {#session-01}

실습에서는 별도로 실행한 Fastify 서버를 외부 API처럼 호출합니다.  

### 🟦 1. Fastify 실습용 서버 구현하기

#### 🔷 1) 실습용 Route 구성

```typescript
// src/ch05/5-1-1.test-routes.ts
import type { FastifyInstance } from 'fastify';

// Query, Path Parameter, Body, Header 테스트에 사용할 Route를 등록합니다.
// Fastify의 async Plugin 형태를 사용하지만 현재 등록 과정에는 await할 작업이 없습니다.
// eslint-disable-next-line @typescript-eslint/require-await
export async function testRoutes(app: FastifyInstance) {
  // GET /api/echo?message=hello에서 Query Parameter를 읽습니다.
  app.get('/echo', (request) => {
    const { message } = request.query as {
      message?: string;
    };

    return {
      method: 'GET',
      message: message ?? null,
    };
  });

  // GET /api/users/:id에서 Path Parameter를 숫자로 변환합니다.
  app.get('/users/:id', (request) => {
    const { id } = request.params as {
      id: string;
    };

    return {
      method: 'GET',
      userId: Number(id),
    };
  });

  // POST /api/users의 JSON Body를 응답으로 반환합니다.
  app.post('/users', (request, reply) => {
    const body = request.body as {
      name: string;
      age: number;
    };

    reply.code(201);

    return {
      method: 'POST',
      user: body,
    };
  });

  // GET /api/secure의 Authorization Header를 검증합니다.
  app.get('/secure', (request, reply) => {
    const auth = request.headers.authorization;

    if (!auth || auth !== 'Bearer test-token') {
      reply.code(401);
      return {
        message: 'Unauthorized',
      };
    }

    return {
      message: 'Authorized',
      token: auth,
    };
  });
}
```

#### 🔷 2) 테스트 서버 구성

```typescript
// src/ch05/5-1-2.test-server.ts
import Fastify from 'fastify';
import { testRoutes } from './5-1-1.test-routes';

// Route 등록을 마친 Fastify 인스턴스를 생성합니다.
export function createApp() {
  const app = Fastify({
    logger: true,
  });

  // 모든 실습용 Route에 /api prefix를 적용합니다.
  app.register(testRoutes, {
    prefix: '/api',
  });

  return app;
}

const PORT = 3001;
const app = createApp();

// Axios와 Undici 테스트가 접속할 3001 포트를 엽니다.
app.listen({ port: PORT }, () => {
  console.log(`🚀 Test API Server running on http://localhost:${PORT}`);
});
```

테스트용 엔드포인트는 다음과 같습니다.  

| Method | Path | 입력 유형 |
| --- | --- | --- |
| GET | `/api/echo?message=hello` | Query |
| GET | `/api/users/:id` | Path Parameter |
| POST | `/api/users` | Body(JSON) |
| GET | `/api/secure` | Header |

다음 명령으로 실습용 서버를 실행합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics
npx tsx ./src/ch05/5-1-2.test-server.ts

# 🚀 Test API Server running on http://localhost:3001
```

### 🟦 2. Axios와 Undici 설치

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics
npm install axios undici

# 설치된 패키지 버전을 확인합니다.
npm list axios fastify undici vitest

nodejs-workbook@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook
└─┬ vitest-basics@1.0.0 -> ./vitest-basics
  ├── axios@1.19.0
  ├── fastify@5.6.2
  └── undici@8.10.0
```

## 2. Axios와 Undici 비교 {#session-02}

Node.js 환경에서 HTTP 요청을 보낼 때 Axios가 편리한 도구 세트라면, Undici는 빠르고 가벼운 HTTP 클라이언트에 가깝습니다.  

### 🟦 1. Axios와 Undici 비교

| 항목 | Axios | Undici |
| --- | --- | --- |
| 주요 방향 | 개발자 경험(DX) 및 생산성 | 성능 및 Node.js HTTP 환경에 최적화 |
| 오류 처리 | 기본적으로 HTTP 상태 코드가 2xx가 아니면 예외 발생 | 상태 코드와 관계없이 응답 객체 반환 |
| JSON 처리 | `response.data`로 응답 JSON 자동 파싱 | `body.json()`으로 응답 Body를 명시적으로 소비 |
| 연결 관리 | Node.js HTTP Adapter와 Agent 사용 | Connection Pool과 HTTP Pipelining 지원 |
| 적합한 상황 | 프론트엔드·백엔드 공용 코드, 빠른 기능 구현 | Node.js 전용 HTTP 클라이언트, 성능과 연결 제어가 중요한 서비스 |

### 🟦 2. 코드 스타일 비교

🔹 **Axios: JSON 처리와 오류 처리를 편리하게 구성합니다.**

```typescript
import axios from 'axios';

try {
  const response = await axios.get('https://api.example.com/data');

  // Axios가 JSON 응답을 JavaScript 객체로 변환합니다.
  console.log(response.data);
} catch (error) {
  // 4xx와 5xx 응답은 기본 설정에서 예외로 처리됩니다.
  if (axios.isAxiosError(error)) {
    console.error('에러 발생!', error.response?.status);
  }
}
```

🔹 **Node.js `fetch()`: 표준 Fetch API에 맞게 상태 코드와 Body를 직접 처리합니다.**

Node.js의 내장 `fetch()`는 Undici를 기반으로 구현되어 있습니다.  

```typescript
const response = await fetch('https://api.example.com/data');

// fetch()는 4xx와 5xx 응답을 자동으로 예외 처리하지 않습니다.
if (!response.ok) {
  throw new Error(`HTTP Error: ${response.status}`);
}

// 응답 스트림을 읽어 JSON으로 변환합니다.
const data = await response.json();
console.log(data);
```

### 🟦 3. 언제 무엇을 사용할까요?

#### 🔷 1) Axios를 선택하기 좋은 경우

- 프론트엔드와 백엔드에서 유사한 API를 사용하고 싶을 때
- Interceptor로 인증 Token 주입이나 오류 Logging을 공통화하고 싶을 때
- 빠른 Prototype 구현과 높은 생산성이 중요할 때

#### 🔷 2) Undici를 선택하기 좋은 경우

- Node.js 서비스에서 많은 HTTP 요청을 효율적으로 처리해야 할 때
- Connection Pool과 Pipelining 같은 연결 제어가 필요할 때
- Node.js의 내장 Fetch API와 유사한 HTTP 처리 방식을 사용하고 싶을 때

## 3. Axios를 이용한 테스트(생산성 중심) {#session-03}

Axios는 Interceptor와 자동 JSON Parsing을 제공하여 비즈니스 Logic을 검증하기에 편리합니다.  

- Axios는 JSON 응답 Parsing을 자동으로 처리합니다.
- 4xx와 5xx 응답은 `catch` 문이나 Promise 거부 검증으로 확인합니다.
- Status, Payload, Header를 함께 검증해야 의미 있는 API 테스트가 됩니다.

### 🟦 1. Axios 요청 메서드 구조

🔹 **축약 메서드 형태**

```typescript
axios.get(url, config);
axios.post(url, data, config);
axios.put(url, data, config);
axios.delete(url, config);
```

🔹 **범용 `request()` 형태**

```typescript
axios.request({
  method: 'GET',
  url: 'http://localhost:3001/api/echo',
  headers: {},
  params: {},
  data: {},
});
```

### 🟦 2. Axios 응답 객체 구조

```typescript
type AxiosResponseShape = {
  data: unknown;                    // 응답 Body입니다. JSON은 자동으로 Parsing됩니다.
  status: number;                   // HTTP 상태 코드입니다.
  headers: Record<string, unknown>; // 응답 Header입니다.
  config: Record<string, unknown>;  // 요청 설정입니다.
  request: unknown;                 // 내부 요청 객체입니다.
};
```

### 🟦 3. API 테스트 예제

#### 🔷 1) Axios 인스턴스 설정

테스트 코드마다 Base URL이나 Authorization Header를 반복해서 작성하는 것은 비효율적입니다.  
`axios.create()`로 공통 설정을 분리하면 코드를 간결하게 유지할 수 있습니다.  

```typescript
// tests/ch05/5-3.axios-client.ts
import axios from 'axios';

// 모든 테스트에서 공통으로 사용할 Axios 인스턴스입니다.
export const testAxios = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'X-Test-Client': 'Vitest',
  },
});
```

#### 🔷 2) Query Parameter와 Path Parameter 테스트

```typescript
// tests/ch05/5-3-1.axios-query-and-path.test.ts
import { describe, expect, it } from 'vitest';
import { testAxios } from './5-3.axios-client';

describe('GET API 테스트 (axios)', () => {
  it('Query Parameter 전달 및 응답 검증', async () => {
    const response = await testAxios.get('/api/echo', {
      params: {
        message: 'hello',
      },
    });

    // HTTP 상태 코드와 JSON Payload를 검증합니다.
    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      method: 'GET',
      message: 'hello',
    });

    // Content-Type에 JSON 미디어 타입이 포함되었는지 확인합니다.
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('Path Parameter를 통한 데이터 조회', async () => {
    const response = await testAxios.get('/api/users/10');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      method: 'GET',
      userId: 10,
    });
  });
});
```

#### 🔷 3) POST Body 테스트

```typescript
// tests/ch05/5-3-2.axios-post.test.ts
import { describe, expect, it } from 'vitest';
import { testAxios } from './5-3.axios-client';

describe('POST API 테스트 (axios)', () => {
  it('새로운 사용자를 생성합니다', async () => {
    const newUser = { name: 'kim', age: 30 };
    const response = await testAxios.post<{
      method: 'POST';
      user: { name: string; age: number };
    }>('/api/users', newUser);

    expect(response.status).toBe(201);

    // 응답 Body의 사용자 정보가 전송한 데이터와 일치하는지 검증합니다.
    expect(response.data.user).toMatchObject(newUser);
  });
});
```

#### 🔷 4) Authorization Header 테스트

```typescript
// tests/ch05/5-3-3.axios-authorization-header.test.ts
import { describe, expect, it } from 'vitest';
import { testAxios } from './5-3.axios-client';

describe('Header 기반 API 테스트 (axios)', () => {
  it('Authorization Header가 있으면 200을 반환합니다', async () => {
    const response = await testAxios.get<{
      message: string;
      token: string;
    }>('/api/secure', {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Authorized');
  });

  it('Authorization Header가 없으면 401을 반환합니다', async () => {
    // 요청이 성공하면 테스트가 실패하도록 Promise 거부를 직접 검증합니다.
    await expect(testAxios.get('/api/secure')).rejects.toMatchObject({
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
    });
  });
});
```

Axios는 기본적으로 상태 코드가 2xx 범위를 벗어나면 예외를 발생시킵니다.  
실패 테스트에서는 예외가 발생하지 않았을 때 테스트가 허무하게 통과하지 않도록 주의해야 합니다.  

## 4. Undici를 이용한 테스트(성능 및 표준 중심) {#session-04}

Undici는 Node.js에 최적화된 HTTP 클라이언트입니다.  
`request()`는 상태 코드와 Header, 스트림 기반 Body를 명시적으로 다룰 수 있게 합니다.  

- Node.js의 내장 `fetch()`를 구현하는 기반 기술입니다.
- 고성능, 저수준 HTTP 클라이언트 API를 제공합니다.
- 응답 Body를 스트림 방식으로 처리합니다.

### 🟦 1. Undici 요청 메서드 구조

Undici에서 외부 API를 호출할 때 `request()`를 사용할 수 있습니다.  
`request()`는 Promise를 반환하며 비동기 방식으로 응답을 가져옵니다.  

```typescript
import { request } from 'undici';

// 응답에서 상태 코드, Header, Body를 구조 분해합니다.
const { statusCode, headers, body } = await request(
  'http://localhost:3001/api/echo',
  {
    method: 'GET',
    // 필요하면 headers와 body 옵션을 추가합니다.
  },
);
```

### 🟦 2. Undici 응답 객체 구조

Undici의 응답 Body는 메모리를 효율적으로 사용할 수 있도록 스트림 방식으로 제공됩니다.  

```typescript
import type { Dispatcher } from 'undici';

type UndiciResponseShape = Pick<
  Dispatcher.ResponseData,
  'statusCode' | 'headers' | 'body'
>;
```

### 🟦 3. Body 처리: 스트림을 데이터로 바꾸기

Body는 아직 완성된 데이터가 아니라 데이터가 들어오는 통로와 같습니다.  
이를 코드에서 사용할 수 있는 형태로 변환하려면 Body 처리 메서드를 호출해야 합니다.  

```typescript
await body.json();        // 전체 데이터를 JSON 객체로 변환합니다.
await body.text();        // 전체 데이터를 문자열로 변환합니다.
await body.arrayBuffer(); // 이미지나 파일 같은 이진 데이터로 변환합니다.
```

📌 **Undici의 Body는 스트림이므로 한 번만 읽을 수 있습니다.**

다시 읽으면 Body가 이미 소비되었다는 오류가 발생합니다.  
`const data = await body.json()`처럼 한 번 읽은 값을 변수에 담은 뒤 필요한 곳에서 재사용합니다.  

### 🟦 4. 주요 테스트 Case

#### 🔷 1) Query Parameter와 Path Parameter 테스트

```typescript
// tests/ch05/5-4-1.undici-query-and-path.test.ts
import { describe, expect, it } from 'vitest';
import { request } from 'undici';

const BASE_URL = 'http://localhost:3001';

describe('GET API 테스트 (undici)', () => {
  it('GET /api/echo?message=hello', async () => {
    const { statusCode, headers, body } = await request(
      `${BASE_URL}/api/echo?message=hello`,
    );

    // 상태 코드와 Content-Type Header를 검증합니다.
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toContain('application/json');

    // Body 스트림을 JSON으로 변환한 뒤 Payload를 검증합니다.
    const json = await body.json();
    expect(json).toEqual({
      method: 'GET',
      message: 'hello',
    });
  });

  it('GET /api/users/:id', async () => {
    const { statusCode, body } = await request(`${BASE_URL}/api/users/10`);

    expect(statusCode).toBe(200);

    const json = await body.json();
    expect(json).toEqual({
      method: 'GET',
      userId: 10,
    });
  });
});
```

#### 🔷 2) POST Body 테스트

```typescript
// tests/ch05/5-4-2.undici-post.test.ts
import { describe, expect, it } from 'vitest';
import { request } from 'undici';

const BASE_URL = 'http://localhost:3001';

describe('POST API 테스트 (undici)', () => {
  it('POST /api/users', async () => {
    const { statusCode, body } = await request(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      // Undici에서는 요청 객체를 JSON 문자열로 변환하여 전달합니다.
      body: JSON.stringify({
        name: 'kim',
        age: 30,
      }),
    });

    expect(statusCode).toBe(201);

    const json = await body.json();
    expect(json).toEqual({
      method: 'POST',
      user: {
        name: 'kim',
        age: 30,
      },
    });
  });
});
```

#### 🔷 3) Authorization Header 테스트

```typescript
// tests/ch05/5-4-3.undici-authorization-header.test.ts
import { describe, expect, it } from 'vitest';
import { request } from 'undici';

const BASE_URL = 'http://localhost:3001';

interface SecureResponse {
  message: string;
  token?: string;
}

describe('Header 기반 API 테스트 (undici)', () => {
  it('Authorization Header가 있으면 200을 반환합니다', async () => {
    const { statusCode, body } = await request(`${BASE_URL}/api/secure`, {
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(statusCode).toBe(200);

    // body.json()의 반환값을 실습 API의 응답 타입으로 확인합니다.
    const json = (await body.json()) as SecureResponse;
    expect(json.message).toBe('Authorized');
  });

  it('Authorization Header가 없으면 401을 반환합니다', async () => {
    const { statusCode, body } = await request(`${BASE_URL}/api/secure`);

    expect(statusCode).toBe(401);

    const json = await body.json();
    expect(json).toEqual({
      message: 'Unauthorized',
    });
  });
});
```
