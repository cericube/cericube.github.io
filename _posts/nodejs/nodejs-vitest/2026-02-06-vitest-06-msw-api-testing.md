---
layout: post
title: "06. MSW와 Vitest로 실무 API 테스트하기"
description: "Vitest의 Node.js 테스트 환경에 MSW를 설정하고, 외부 API 핸들러와 Fastify 통합 테스트를 작성하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. 테스트에서 네트워크 흐름을 제어하는 MSW의 역할"
  - id: session-02
    title: "2. Vitest 환경에 MSW 설치 및 설정"
  - id: session-03
    title: "3. 핸들러 설계: 외부 API 응답 코드 구현 예시"
  - id: session-04
    title: "4. Fastify 서버와 MSW 통합 테스트 예시"
---

## 1. 테스트에서 네트워크 흐름을 제어하는 MSW의 역할 {#session-01}

MSW(Mock Service Worker)는 이름 때문에 흔히 "가짜 API 서버를 띄워 주는 도구"로 오해받곤 합니다.  
하지만 MSW의 핵심은 서버를 구현하는 것이 아니라 네트워크 요청을 가로채고(Intercept) 응답을 교체하는 스위치 역할을 하는 데 있습니다.  

### 🟦 1. 네트워크 요청 가로채기(Interception) 구조 이해

일반적인 Node.js 환경에서 HTTP 요청이 발생하는 흐름은 다음과 같습니다.  

- **Application Code**: 개발자가 작성한 비즈니스 로직
- **HTTP Client**: Axios, Fetch, Undici 등
- **Node.js HTTP API**: 저수준 네트워크 처리
- **OS Network Stack / Actual Network**: 실제 외부 네트워크로 요청 전송

### 🔷 MSW가 개입하는 지점

MSW는 애플리케이션에서 사용하는 네트워크 요청 API를 가로챕니다.  
애플리케이션에서는 요청을 정상적으로 보내고 응답을 받은 것처럼 동작하지만, 일치하는 핸들러가 응답하면 실제 외부 네트워크로 요청을 보내지 않습니다.  

```text
[Fastify API]
   ↓
[Service / Domain]
   ↓
[HTTP Client]
   ↓
[MSW]
```

### 🟦 2. vi.mock()과 MSW 비교

| 구분 | `vi.mock()` | MSW |
| --- | --- | --- |
| 개입 지점 | 함수 호출 수준 | 네트워크 요청 수준 |
| HTTP 요청 코드 | 실행하지 않음 | 실제 클라이언트 코드가 실행되지만 외부 네트워크 요청은 차단됨 |
| 검증 대상 | 로직 중심 | 통신 설정을 포함한 통합 흐름 |
| 애플리케이션 코드 영향 | `import` 구조에 영향을 줄 수 있음 | 애플리케이션 코드를 바꾸지 않음 |
| 역할 | 내부 의존성 단위 테스트 | 외부 API 의존성 통합 테스트 |

### 🔷 `vi.mock()`: 함수 호출 자체를 교체

모듈을 불러오는 단계에서 특정 함수를 Mock 함수로 교체합니다.  
실제 HTTP 클라이언트 함수는 호출되지 않습니다.  

- **검증 범위**: 비즈니스 로직 위주
- **단점**: URL Parameter 구성, Header 설정, 응답 파싱 로직과 같은 통신 과정을 검증할 수 없음

```typescript
// 외부 API 호출 함수를 Mock 함수로 교체하여 고정된 사용자 정보를 반환합니다.
vi.mock('../userApi', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'test' }),
}));
```

### 🔷 MSW: HTTP 요청을 가로채 응답만 교체

HTTP 요청 함수는 실제로 실행됩니다.  
요청 객체 생성, Header 설정, 응답 처리와 같은 클라이언트 코드도 그대로 동작합니다.  

- **검증 범위**: 비즈니스 로직, HTTP Client 설정, Request와 Response 처리 과정
- **장점**: 애플리케이션의 실제 통신 흐름에 가까운 방식으로 테스트할 수 있음

```typescript
// 실제 Axios 호출 코드는 유지하고, 요청과 일치하는 응답은 MSW가 반환합니다.
await axios.get('https://api.external.com/users/1');
```

### 🟦 3. 네트워크 스위치 모델

MSW의 Node.js용 서버는 간단한 API로 요청 가로채기를 제어합니다.  
이 API는 테스트 환경의 네트워크 요청을 관리하는 스위치 역할을 합니다.  

- **`server.listen()`(Switch ON)**: 네트워크 요청 가로채기를 활성화합니다.
- **`server.close()`(Switch OFF)**: 요청 가로채기를 종료합니다.

이 구조의 핵심 가치는 테스트 대상 코드를 환경에 따라 변경하지 않아도 된다는 점입니다.  
따라서 리팩터링할 때 테스트 수정 비용을 줄이고, Mock 함수만 사용했을 때 놓칠 수 있는 통신 설정 오류를 확인하는 데 도움이 됩니다.  

## 2. Vitest 환경에 MSW 설치 및 설정 {#session-02}

네트워크 요청을 가로채는 MSW는 테스트가 실제 외부 API 상태에 영향받지 않도록 요청 흐름을 제어합니다.  

### 🟦 1. 패키지 설치(Mock Service Worker)

```bash
# Vitest 실습 프로젝트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics

# MSW를 개발 의존성으로 설치합니다.
npm install -D msw
```

### 🟦 2. Node.js 전용 MSW 서버 생성

Node.js 환경에서는 브라우저의 Service Worker 대신 Node.js의 네트워크 요청 API를 가로채는 방식을 사용합니다.  

### 🔷 실행 환경별 MSW 초기화 방식

| 환경 | 사용 API |
| --- | --- |
| Browser | `setupWorker()` |
| Node.js(Test) | `setupServer()` |

Node.js 환경에서 실행하는 Vitest와 Jest에서는 `setupServer()`를 사용합니다.  
이 API는 실제 HTTP 서버를 실행하지 않고 Node.js에서 발생하는 네트워크 요청을 가로챕니다.  

### 🔷 MSW 서버 인스턴스 생성: `server.ts`

같은 테스트 환경에서 공통으로 사용할 MSW 서버 인스턴스를 한 곳에 생성합니다.  
이 서버는 실제 포트를 열지 않고 네트워크 요청 가로채기만 담당합니다.  

```typescript
// tests/ch06/6-2-1.server.ts
// Node.js 환경에서 요청을 가로챌 MSW 서버 생성 함수를 가져옵니다.
import { setupServer } from 'msw/node';

// 외부 API 역할을 하는 요청 핸들러를 가져옵니다.
import { userHandlers } from './6-2-1.example.handlers';

// 공통 핸들러를 등록한 서버 인스턴스를 생성합니다.
export const server = setupServer(...userHandlers);
```

### 🔷 핸들러: `handlers.ts`

```typescript
// tests/ch06/6-2-1.example.handlers.ts
import { http, HttpResponse } from 'msw';

type CreateUserBody = {
  name?: string;
  role?: string;
};

export const userHandlers = [
  // GET 요청의 Query Parameter를 읽어 응답 데이터에 반영합니다.
  http.get('https://api.example.com/users', ({ request }) => {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    return HttpResponse.json([
      { id: 1, name: 'Alice', role: role ?? 'user' },
    ]);
  }),

  // POST 요청의 JSON Body를 읽고 필수 값을 검증합니다.
  http.post('https://api.example.com/users', async ({ request }) => {
    const newUser = (await request.json()) as CreateUserBody;

    if (!newUser.name) {
      return new HttpResponse(null, { status: 400 });
    }

    // 요청에 id가 있어도 서버에서 정한 값이 마지막에 적용됩니다.
    return HttpResponse.json({ ...newUser, id: 2 }, { status: 201 });
  }),
];
```

### 🔷 테스트 파일에서 스위치 제어: `setup.ts`

공통 MSW 서버의 시작과 종료는 Setup 파일에서 Lifecycle Hook으로 제어합니다.  
이 Setup을 가져온 테스트 파일마다 `beforeAll`, `afterEach`, `afterAll`이 적용됩니다.  

```typescript
// tests/ch06/6-2-1.setup.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './6-2-1.server';

// 이 Setup을 가져온 테스트 파일을 실행하기 전에 요청 가로채기를 켭니다.
beforeAll(() => {
  server.listen({
    // 등록되지 않은 요청이 실제 네트워크로 나가지 않도록 오류를 발생시킵니다.
    onUnhandledRequest: 'error',
  });
});

// 각 테스트가 추가한 임시 핸들러를 제거하고 초기 상태로 되돌립니다.
afterEach(() => {
  server.resetHandlers();
});

// 이 Setup을 가져온 테스트 파일의 실행을 마치면 요청 가로채기를 종료합니다.
afterAll(() => {
  server.close();
});
```

### 🔷 `onUnhandledRequest: 'error'`: 등록하지 않은 외부 요청 차단

Mock 핸들러가 없는 HTTP 요청이 발생하면 `onUnhandledRequest: 'error'` 설정에 따라 즉시 오류가 발생합니다.  
테스트 도중 예상하지 않은 실제 외부 요청이 발생하는 상황을 찾는 데 유용합니다.  

![등록하지 않은 외부 요청으로 발생한 MSW 오류 화면](/assets/images/nodejs/nodejs-vitest/msw-unhandled-request-error.png)

### 🔷 테스트 파일과 Setup 연결  

이 `import`가 실행되면 해당 테스트 파일에 MSW Lifecycle Hook이 등록됩니다.  

```typescript
// tests/ch06/6-2-1.test.ts
import axios from 'axios';
import { describe, expect, it } from 'vitest';

// 이 테스트 파일에만 공통 MSW Lifecycle Hook을 적용합니다.
import './6-2-1.setup';
```

프로젝트의 모든 테스트 파일에 같은 Setup을 적용하려면 `vitest.config.ts`의 `setupFiles`에 등록할 수도 있습니다.  

### 🔷 사용자 API 요청과 응답 확인

Axios로 실제 요청 코드를 실행하고, `userHandlers`가 반환한 응답을 확인합니다.  
기본 사용자 목록, Query Parameter, 정상적인 POST 요청과 `name`이 없는 POST 요청을 각각 테스트합니다.  
다음 코드는 그중 기본 GET 응답과 실패 POST 응답을 확인하는 대표 예시입니다.  

```typescript
describe('사용자 API 통합 테스트', () => {
  it('MSW가 가로챈 기본 사용자 목록을 가져옵니다', async () => {
    const response = await axios.get('https://api.example.com/users');

    expect(response.data).toEqual([{ id: 1, name: 'Alice', role: 'user' }]);
  });

  it('name이 없는 사용자 생성 요청에 400으로 응답합니다', async () => {
    const response = await axios.post(
      'https://api.example.com/users',
      { role: 'admin' },
      // 400 응답도 예외로 처리하지 않고 상태 코드를 확인합니다.
      { validateStatus: () => true },
    );

    expect(response.status).toBe(400);
  });
});
```

Query Parameter를 전달하면 Handler가 `role`을 응답에 반영합니다.  
정상적인 POST 요청에서는 요청에 포함된 `id` 대신 Handler가 발급한 `id: 2`가 반환되는지도 확인합니다.  

### 🟦 3. 테스트 인프라 구조

```text
6-2-1.test.ts 실행
   ↓
setup.ts 실행
   → server.listen()으로 네트워크 요청 가로채기 활성화
   ↓
테스트 실행
   → Axios 또는 Fetch의 실제 호출 코드 실행
   → MSW가 요청을 가로채고 Mock 응답 반환
   ↓
각 테스트 종료
   → server.resetHandlers()로 임시 핸들러 초기화
   ↓
테스트 파일 종료
   → server.close()로 요청 가로채기 종료
```

## 3. 핸들러 설계: 외부 API 응답 코드 구현 예시 {#session-03}

MSW 핸들러는 단순한 가짜 데이터가 아니라 외부 API가 특정 요청에 어떻게 응답할지에 관한 약속(Contract)을 코드로 표현합니다.  

### 🟦 1. API 명세를 코드로 표현하기: 기본 구조

MSW v2는 `http`와 `HttpResponse`를 사용하여 핸들러를 선언합니다.  
핸들러의 목적은 요청을 해석하고 그에 맞는 HTTP 응답을 반환하는 것입니다.  
`request.json()`은 비동기로 동작하며, 응답에는 필요에 따라 사용자 정의 Header를 포함할 수 있습니다.  

### 🔷 GET 응답: 데이터 조회

```typescript
// tests/ch06/6-3-1.user.handlers.test.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

type UserParams = {
  id: string;
};

type CreateUserBody = {
  name: string;
};

const server = setupServer(
  // URL의 Path Parameter를 읽어 사용자 응답을 만듭니다.
  http.get<UserParams>(
    'https://api.external.com/users/:id',
    ({ params }) => {
      const { id } = params;

      return HttpResponse.json(
        {
          id: Number(id),
          name: 'Test User',
          email: 'test@example.com',
        },
        { status: 200 },
      );
    },
  ),

  // POST 요청의 Body 타입을 지정하고 JSON 데이터를 읽습니다.
  http.post<never, CreateUserBody>(
    'https://api.external.com/users',
    async ({ request }) => {
      const body = await request.json();

      return HttpResponse.json(
        { ...body, id: 100 },
        {
          status: 201,
          headers: { 'X-Request-Id': 'mock-123' },
        },
      );
    },
  ),
);
```

### 🔷 Handler 응답 검증

같은 파일의 테스트에서는 Axios로 GET과 POST 요청을 보내고, Handler가 Path Parameter와 Body를 응답에 반영했는지 확인합니다.  
POST 응답에서는 상태 코드, JSON 데이터와 `X-Request-Id` Header도 함께 검증합니다.  
GET 테스트는 `/users/7`의 Path Parameter가 응답의 `id: 7`로 변환되는지 확인합니다.  
다음은 POST 응답에서 확인하는 핵심 부분입니다.  

```typescript
describe('외부 사용자 API 핸들러', () => {
  it('POST Body를 읽어 응답과 Header를 생성합니다', async () => {
    const response = await axios.post('https://api.external.com/users', {
      name: 'Alice',
    });

    expect(response.status).toBe(201);
    expect(response.data).toEqual({ id: 100, name: 'Alice' });
    expect(response.headers['x-request-id']).toBe('mock-123');
  });
});
```

### 🟦 2. 동적 요청 처리: 비즈니스 로직 시뮬레이션

단순한 고정 데이터와 달리 MSW는 요청 값에 따라 응답을 나눌 수 있습니다.  

| 구분 | 처리 방식 | 예시 |
| --- | --- | --- |
| Path Parameter | URL 경로의 변수 값을 추출 | `id`가 `invalid-id`이면 404 Not Found 반환 |
| Query String | URL 객체 또는 프레임워크 제공 API로 값을 추출 | `confirm`이 `true`가 아니면 400 Bad Request 반환 |
| Request Body | 결제 금액 조건 검사 | 결제 금액이 0 이하면 422 Unprocessable Content 반환 |

```typescript
// tests/ch06/6-3-2.order.handlers.test.ts
import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

type OrderParams = {
  id: string;
};

type UpdateOrderBody = {
  amount: number;
};

const server = setupServer(
  http.patch<OrderParams, UpdateOrderBody>(
    'https://api.shop.com/orders/:id',
    async ({ params, request }) => {
      // Path Parameter가 유효한 주문을 가리키는지 확인합니다.
      const { id } = params;
      if (id === 'invalid-id') {
        return HttpResponse.json(
          { error: '존재하지 않는 주문입니다.' },
          { status: 404 },
        );
      }

      // Query String에 요청 처리 확인 값이 있는지 검사합니다.
      const url = new URL(request.url);
      const confirm = url.searchParams.get('confirm');
      if (confirm !== 'true') {
        return HttpResponse.json(
          { error: '확인 플래그(confirm)가 필요합니다.' },
          { status: 400 },
        );
      }

      // Request Body의 결제 금액이 올바른 범위인지 검사합니다.
      const body = await request.json();
      if (body.amount <= 0) {
        return HttpResponse.json(
          { error: '금액은 0보다 커야 합니다.' },
          { status: 422 },
        );
      }

      // 모든 조건을 통과하면 처리 결과를 반환합니다.
      return HttpResponse.json({
        orderId: id,
        status: 'SUCCESS',
        paidAmount: body.amount,
        message: '주문이 성공적으로 처리되었습니다.',
      });
    },
  ),
);
```

### 🔷 조건별 주문 응답 검증

실제 예제의 `requestOrder()`는 주문 ID, 금액과 확인 여부를 받아 PATCH 요청을 만드는 Helper입니다.  
`validateStatus`가 항상 `true`를 반환하므로 Axios가 4xx 응답을 예외로 처리하지 않고, 테스트에서 상태 코드를 직접 비교합니다.  
정상 요청은 200과 주문 결과를 확인하며, 오류 조건은 `it.each()`로 중복을 줄여 검증합니다.  

```typescript
it.each([
  { condition: '존재하지 않는 주문', id: 'invalid-id', amount: 10_000, confirm: true, status: 404 },
  { condition: 'confirm이 false', id: 'order-1', amount: 10_000, confirm: false, status: 400 },
  { condition: '0 이하의 금액', id: 'order-1', amount: 0, confirm: true, status: 422 },
])('$condition이면 $status로 응답합니다', async ({ id, amount, confirm, status }) => {
  const response = await requestOrder(id, amount, confirm);

  expect(response.status).toBe(status);
});
```

## 4. Fastify 서버와 MSW 통합 테스트 예시 {#session-04}

Fastify의 테스트 유틸리티인 `app.inject()`와 네트워크 Mock 도구인 MSW를 조합하여 통합 테스트 환경을 구축해 보겠습니다.  

### 🟦 1. API Chain 테스트 구조

실제 외부 서버에 요청을 보내는 대신 MSW가 중간에서 요청을 가로채 미리 정의한 응답을 반환합니다.  

- **`app.inject()`**: 실제 포트를 사용하지 않고 Fastify Route에 요청을 전달하는 진입점
- **Fastify Route**: 요청을 받고 Axios로 외부 사용자 API를 호출하는 계층
- **Axios**: 외부 API에 HTTP 요청을 보내는 Client
- **MSW**: 네트워크 요청을 가로채고 Mock 응답을 반환하는 도구

### 🟦 2. `app.inject()` 기반 서버 내부 테스트: 서버 및 Route 설정

Fastify의 `app.inject()`는 실제 HTTP 서버를 실행하지 않고 서버 내부에 요청을 주입합니다.  

```typescript
// tests/ch06/6-4.fastify.server.ts
// 외부 사용자 정보를 가져와 내부 API 응답 형식으로 변환합니다.
app.get<{ Params: { id: string } }>('/user-profile/:id', async (request) => {
  const { data } = await axios.get<ExternalUser>(
    `https://api.external.com/users/${request.params.id}`,
  );

  return {
    userId: data.id,
    displayName: data.name.toUpperCase(),
    email: data.email,
  };
});

// 요청에서 받은 인증 Header를 외부 API에 전달합니다.
app.get('/secure-data', async (request, reply) => {
  const authHeader = request.headers.authorization;
  const headers = authHeader ? { Authorization: authHeader } : {};
  const response = await axios.get('https://api.external.com/data', {
    headers,
    // 4xx 응답도 받아 Fastify 응답에 같은 상태 코드를 적용합니다.
    validateStatus: () => true,
  });

  return reply.status(response.status).send(response.data);
});
```

### 🟦 3. 데이터 정합성 검증 전략(MSW 활용): MSW 설정 및 통합 테스트

외부 API의 응답이 시스템 내부의 DTO(Data Transfer Object)로 올바르게 변환되는지 확인해야 합니다.  
실제 파일의 Import와 Lifecycle은 앞에서 설명했으므로, 여기서는 외부 API Handler와 대표 검증만 살펴봅니다.  

```typescript
// tests/ch06/6-4.msw.server.test.ts
// 외부 사용자 API 요청에 응답할 MSW 서버를 생성합니다.
const externalServer = setupServer(
  http.get<UserParams>('https://api.external.com/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'External User 123',
      email: 'test@test.com',
    });
  }),
);

it('외부 사용자 API를 호출하여 가공된 응답을 반환합니다', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/user-profile/user_123',
  });

  expect(response.statusCode).toBe(200);
  // 실제 파일에서는 DTO Generic으로 JSON 응답 타입을 지정합니다.
  expect(response.json<UserProfileResponse>()).toEqual({
    userId: 'user_123',
    displayName: 'EXTERNAL USER 123',
    email: 'test@test.com',
  });
});
```

### 🟦 4. 인증 Context 전파 테스트: 인증 Header 전파 검증

실무에서는 로그인한 사용자의 Token을 외부 API로 전달해야 하는 경우가 많습니다.  
따라서 인증 Context가 올바르게 전달되는지 확인하는 테스트는 통합 테스트에서 중요한 항목입니다.  

다음 테스트는 같은 `describe` 블록 안에서 인증 Header가 Fastify Route를 거쳐 외부 API까지 전달되는지 확인합니다.  
실제 파일에서는 성공 응답과 오류 응답에도 각각 DTO Generic을 적용합니다.  

```typescript
// 이 테스트에서만 사용할 보호된 외부 API Handler를 등록합니다.
externalServer.use(
  http.get('https://api.external.com/data', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== 'Bearer valid_token_123') {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return HttpResponse.json({ secretData: 'This is very secure data.' });
  }),
);

const validResponse = await app.inject({
  method: 'GET',
  url: '/secure-data',
  headers: { authorization: 'Bearer valid_token_123' },
});
expect(validResponse.statusCode).toBe(200);
expect(validResponse.json<SecureDataResponse>()).toEqual({
  secretData: 'This is very secure data.',
});

const invalidResponse = await app.inject({
  method: 'GET',
  url: '/secure-data',
  headers: { authorization: 'Bearer invalid_token_456' },
});
expect(invalidResponse.statusCode).toBe(403);
expect(invalidResponse.json<ErrorResponse>()).toEqual({ error: 'Forbidden' });
```
