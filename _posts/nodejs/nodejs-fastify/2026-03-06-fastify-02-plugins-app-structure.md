---
layout: post
title: "[Fastify] 02. 플러그인 활용, 애플리케이션 구조와 로깅"
description: "Fastify 플러그인으로 공통 기능을 재사용하고 라우트와 서버 실행 코드를 분리합니다. 전역 에러 처리와 Pino 다중 전송 및 로그 회전 구성도 알아봅니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. Fastify 플러그인 활용"
  - id: session-02
    title: "2. 실무용 구조: 라우트 분리 및 app/server 관리"
  - id: session-03
    title: "3. 전역 에러 핸들링 및 파일 로깅"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. Fastify 플러그인 활용 {#session-01}

Fastify의 플러그인은 여러 라우트에서 공통으로 사용하는 기능을 한곳에 정의할 때 유용합니다.  
예를 들어 공통 유틸리티 함수를 Fastify 인스턴스에 추가하거나, 모든 요청에서 사용할 값을 `request` 객체에 추가할 수 있습니다.  

```typescript
// src/ch02/plugins/hello.plugin.ts
/* eslint-disable @typescript-eslint/require-await */

import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';

// declare는 TypeScript에게 “이 타입이나 값은 실제로 존재한다고 가정하고 타입 검사에 반영해 줘”라고 알려주는 키워드

// Fastify가 기본으로 제공하는 타입에 이 플러그인의 사용자 정의 타입을 합칩니다.
// 이 선언은 TypeScript에 타입 정보를 알려 줄 뿐이며, 실제 속성이나 메서드를
// 생성하지는 않습니다. 런타임 등록은 아래의 decorate/decorateRequest가 담당합니다.
declare module 'fastify' {
  // 모든 요청(request) 객체에서 사용할 사용자 정의 속성입니다.
  interface FastifyRequest {
    // onRequest 훅에서 요청이 시작된 시각을 ISO 8601 문자열로 저장합니다.
    timestamp: string;
  }

  // fastify 인스턴스에 추가해서 여러 라우트가 함께 사용할 메서드들입니다.
  interface FastifyInstance {
    // 이름을 받아 인사말을 반환하며, 아래의 fastify.decorate('sayHello', ...)
    // 코드가 실제 구현을 Fastify 인스턴스에 등록합니다.
    sayHello(name: string): string;
  }
}

// 여러 라우트에서 사용할 함수와 요청 속성을 하나의 플러그인으로 정의합니다.
export default fp(async (fastify) => {
  // 1. decorate는 Fastify 인스턴스에 사용자 정의 속성이나 메서드를 추가합니다.
  // 첫 번째 인수인 'sayHello'는 추가할 메서드의 이름이고,
  // 두 번째 인수는 fastify.sayHello(...)를 호출할 때 실행될 실제 함수입니다.
  // 플러그인이 등록된 범위의 라우트에서는 이 메서드를 공통으로 사용할 수 있습니다.
  fastify.decorate('sayHello', (name: string) => {
    // 전달받은 이름을 템플릿 리터럴(${...})에 넣어 인사말을 반환합니다.
    // 예: fastify.sayHello('Fastify') → 'Hello, Fastify!'
    return `Hello, ${name}!`;
  });

  // 2. 모든 Fastify 요청 객체에 `timestamp` 접근자 속성을 추가합니다.
  // 접근자(getter/setter)를 사용하면 외부에서는 request.timestamp처럼 간단히
  // 사용하면서, 실제 값은 내부 속성인 request._timestamp에 보관할 수 있습니다.
  fastify.decorateRequest('timestamp', {
    // request.timestamp를 읽을 때 호출됩니다.
    // 여기서 `this`는 현재 요청 객체이며, 해당 요청에 저장된 값을 반환합니다.
    getter(this: FastifyRequest) {
      // `FastifyRequest & { _timestamp: string }`는 기존 요청 타입에
      // 내부 속성 `_timestamp`가 있다고 TypeScript에 알려 주는 타입 단언입니다.
      // 실제 객체를 변환하거나 새로운 객체를 만드는 코드는 아닙니다.
      return (this as FastifyRequest & { _timestamp: string })._timestamp;
    },
    // request.timestamp = 값 형태로 값을 대입할 때 호출됩니다.
    // value에는 대입한 문자열이 전달되고, `this`는 현재 요청 객체를 가리킵니다.
    setter(this: FastifyRequest, value: string) {
      // 공개 접근자인 timestamp로 받은 값을 내부 저장 공간 `_timestamp`에
      // 기록합니다. 요청 객체마다 저장되므로 서로 다른 요청의 값과 섞이지 않습니다.
      (this as FastifyRequest & { _timestamp: string })._timestamp = value;
    },
  });

  // 3. onRequest 훅은 Fastify가 요청을 받은 직후, 라우트 핸들러를 실행하기 전에
  // 호출됩니다. 따라서 이후의 훅과 라우트 핸들러에서 요청 시작 시각을 사용할 수 있습니다.
  fastify.addHook('onRequest', async (request) => {
    // 현재 시각을 ISO 8601 형식의 문자열로 만듭니다.
    // 예: '2026-08-19T12:34:56.789Z' (`Z`는 UTC 기준이라는 뜻입니다.)
    // 이 값을 timestamp에 대입하면 위에서 정의한 setter가 실행되어
    // 현재 요청 객체의 내부 `_timestamp` 속성에 값이 저장됩니다.
    request.timestamp = new Date().toISOString();
  });
});
```

위 플러그인은 다음과 같은 역할을 합니다.  

- `decorate()`로 `fastify.sayHello()`라는 공통 함수를 추가합니다.  
- `decorateRequest()`로 모든 요청 객체에서 `request.timestamp`를 사용할 수 있게 합니다.  
- `onRequest` 훅으로 요청이 시작되는 시각을 기록합니다.  

### 🟦 플러그인 등록 및 사용

플러그인은 등록 순서와 의존 관계에 따라 로드됩니다.  
여러 라우트에서 사용하는 공통 플러그인은 해당 기능을 사용하는 라우트보다 먼저 등록해야 합니다.  

```typescript
// src/ch02/app.ts 중 helloPlugin 등록 부분입니다.
import helloPlugin from './plugins/hello.plugin';

// helloPlugin을 서버에 등록합니다.
// 이 플러그인은 fastify.sayHello 메서드와 request.timestamp 속성,
// 그리고 요청 시각을 기록하는 onRequest 훅을 추가합니다.
// 라우트보다 먼저 등록하여 아래의 /hello 라우트가 해당 기능을 사용하게 합니다.
fastify.register(helloPlugin);

// GET /hello 요청을 처리할 비동기 라우트 핸들러를 등록합니다.
fastify.get('/hello', async (request) => {
  // 플러그인이 Fastify 인스턴스에 추가한 sayHello 메서드로 인사말을 만듭니다.
  const greeting = fastify.sayHello('Fastify');

  // helloPlugin의 onRequest 훅이 현재 요청 객체에 기록한 시작 시각을 읽습니다.
  const timestamp = request.timestamp;

  // 객체를 반환하면 Fastify가 JSON 응답으로 직렬화하여 클라이언트에 전송합니다.
  // 응답 예: { "greeting": "Hello, Fastify!", "timestamp": "2026-08-19T...Z" }
  return { greeting, timestamp };
});
```

`/hello`로 요청하면 다음과 같은 응답을 받을 수 있습니다.  

```console
ubuntu:~/blog-workspaces/nodejs-workbook$ curl http://127.0.0.1:3000/hello | python3 -m json.tool
  % Total    % Received % Xferd  Average Speed  Time    Time    Time   Current
                                 Dload  Upload  Total   Spent   Left   Speed
100     69 100     69   0      0  15778      0                              0
{
    "greeting": "Hello, Fastify!",
    "timestamp": "2026-08-19T11:44:19.361Z"
}
```

플러그인을 활용하면 공통 기능을 여러 파일에서 반복해서 구현하지 않고 Fastify 인스턴스와 요청 객체를 통해 재사용할 수 있습니다.  

## 2. 실무용 구조: 라우트 분리 및 app/server 관리 {#session-02}

프로젝트 규모가 커지면 모든 라우트와 서버 설정을 하나의 파일에 작성하기 어렵습니다.  
실무에서는 보통 다음과 같이 역할을 나눕니다.  

- `routes/`: 도메인별 API를 정의합니다.  
- `app.ts`: Fastify 인스턴스를 생성하고 플러그인과 라우트를 등록합니다.  
- `server.ts`: 실제 서버를 실행합니다.  

이렇게 분리하면 API가 늘어나더라도 파일별 책임이 명확해져 유지보수가 쉬워집니다.  
이 글에서 사용하는 `src/ch02`의 구조는 다음과 같습니다.  

```text
src/ch02/
├── app.ts
├── plugins/
│   └── hello.plugin.ts
├── routes/
│   └── user.routes.ts
└── server.ts
```

### 🟦 1. 라우트 분리(`routes/user.routes.ts`)

사용자, 주문, 상품처럼 기능 단위로 라우트를 분리할 수 있습니다.  
다음은 사용자 관련 API를 별도의 라우트 파일로 정의한 예제입니다.  

```typescript
// src/ch02/routes/user.routes.ts
/* eslint-disable @typescript-eslint/require-await */

import type { FastifyInstance } from 'fastify';

// 사용자와 관련된 API를 하나의 라우트 플러그인으로 정의합니다.
export async function userRoutes(fastify: FastifyInstance) {
  // GET /users 요청을 처리합니다.
  fastify.get('/', async () => {
    return { users: [] };
  });

  // GET /users/:id 요청에서 경로 매개변수로 사용자 ID를 받습니다.
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };

    return {
      id,
      name: 'John Doe',
    };
  });
}
```

여기서는 라우트 자체에 `/users`를 직접 작성하지 않았습니다.  
대신 `app.ts`에서 `prefix`를 지정해 해당 라우트 전체에 공통 경로를 적용합니다.  

### 🟦 2. `app.ts`(서버 정의)

`app.ts`는 Fastify 애플리케이션을 구성하는 역할을 담당합니다.  
Fastify 인스턴스를 만들고 플러그인, 라우트, 에러 핸들러 등의 설정을 등록합니다.  

```typescript
// src/ch02/app.ts
/* eslint-disable @typescript-eslint/require-await */

import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import { join } from 'node:path';

import { userRoutes } from './routes/user.routes';
import helloPlugin from './plugins/hello.plugin';

// Fastify 애플리케이션의 설정과 라우트를 구성합니다.
export function buildApp() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino/file',
        options: {
          destination: join(process.cwd(), 'logs/app.log'),
          mkdir: true,
        },
      },
    },
  });

  // userRoutes에 포함된 모든 API 앞에 /users를 붙입니다.
  fastify.register(userRoutes, {
    prefix: '/users',
  });

  // 서버 상태를 확인할 API를 등록합니다.
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // 공통 인사말 메서드와 요청 시각을 기록하는 훅을 등록합니다.
  fastify.register(helloPlugin);

  // helloPlugin에서 추가한 메서드와 요청 속성을 사용합니다.
  fastify.get('/hello', async (request) => {
    const greeting = fastify.sayHello('Fastify');
    const timestamp = request.timestamp;

    return { greeting, timestamp };
  });

  // 처리되지 않은 오류를 애플리케이션의 공통 응답 형식으로 변환합니다.

  return fastify;
}
```

이제 `userRoutes`에 정의한 API는 다음 경로로 접근할 수 있습니다.  

```text
GET /users
GET /users/:id
```

`prefix`를 활용하면 각 라우트 파일에서 동일한 경로를 반복해서 작성할 필요가 없습니다.  

### 🟦 3. `server.ts`(서버 실행)

`server.ts`는 `app.ts`에서 만든 Fastify 애플리케이션을 실제 포트에서 실행하는 역할만 담당합니다.  

```typescript
// src/ch02/server.ts
import { buildApp } from './app';

const PORT = 3000;

// app.ts에서 구성한 애플리케이션을 실제 포트에서 실행합니다.
async function startServer() {
  const app = buildApp();

  try {
    await app.listen({
      port: PORT,
    });

    app.log.info(`Server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

await startServer();
```

`app.ts`와 `server.ts`를 분리하면 애플리케이션 구성과 실행 코드가 분리됩니다.  
특히 테스트 코드에서는 실제 포트를 열지 않고 `buildApp()`으로 Fastify 인스턴스만 생성할 수 있어 테스트하기도 편해집니다.  

## 3. 전역 에러 핸들링 및 파일 로깅 {#session-03}

API 서버를 운영할 때는 정상 응답뿐 아니라 오류와 로그도 일관된 방식으로 관리해야 합니다.  
Fastify에서는 `setErrorHandler()`로 전역 에러를 처리하고, 기본 로거인 Pino로 콘솔이나 파일에 로그를 기록할 수 있습니다.  

### 🟦 1. 전역 에러 핸들링

라우트마다 `try/catch`를 반복해서 작성하기보다 전역 에러 핸들러를 설정하면 공통된 응답 형식을 유지할 수 있습니다.  

```typescript
import type { FastifyError } from 'fastify';

// 처리되지 않은 오류를 애플리케이션의 공통 응답 형식으로 변환합니다.
fastify.setErrorHandler((error, request, reply) => {
  // 서버 로그에는 원인을 확인할 수 있도록 실제 오류 정보를 기록합니다.
  request.log.error(error);

  const err = error as FastifyError;

  // JSON Schema 검증에 실패하면 400 응답을 반환합니다.
  if (err.validation) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: '입력값이 올바르지 않습니다.',
      details: err.validation,
    });
  }

  // 그 밖의 오류는 지정된 상태 코드 또는 기본값인 500으로 처리합니다.
  return reply.status(err.statusCode ?? 500).send({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
  });
});
```

요청 데이터가 JSON Schema 검증에 실패하면 `400 Bad Request`를 반환합니다.  
그 밖의 오류는 에러에 지정된 `statusCode` 또는 기본값인 `500`으로 처리합니다.  
따라서 클라이언트는 여러 API에서 일관된 형태의 오류 응답을 받을 수 있습니다.  

### 🟦 2. 파일 로깅

Fastify의 Pino 로깅은 기본적으로 비활성화되어 있으므로, 인스턴스를 생성할 때 `logger: true`나 로거 설정 객체를 전달해 활성화해야 합니다.  
별도의 출력 대상을 지정하지 않으면 Pino는 JSON 로그를 표준 출력(`stdout`)으로 보냅니다.  

가장 간단한 설정은 다음과 같습니다.  

```typescript
const fastify = Fastify({
  logger: true,
});
```

운영 로그를 나중에 확인할 수 있도록 다음과 같이 별도의 파일에 저장할 수도 있습니다.  

```typescript
import Fastify from 'fastify';
import { join } from 'node:path';

// Pino의 파일 전송 대상을 사용해 JSON 로그를 파일에 저장합니다.
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino/file',
      options: {
        destination: join(process.cwd(), 'logs/app.log'),
        mkdir: true,
      },
    },
  },
});

fastify.get('/ping', async (request) => {
  request.log.info('Ping 요청 처리 중');

  return {
    pong: true,
  };
});
```

위 설정에서는 로그가 `logs/app.log` 파일에 저장됩니다.  
Pino의 기본 로그 형식은 JSON이므로 로그 수집 시스템이나 분석 도구와 연동하기에도 적합합니다.  

콘솔에서는 사람이 읽기 쉬운 로그를 사용하고 파일에는 JSON 로그를 저장할 수도 있습니다.  
이 경우 개발 환경에서 주로 사용하는 `pino-pretty`를 설치합니다.  

```bash
# 콘솔에서 로그를 읽기 쉬운 형식으로 출력하는 개발 의존성을 설치합니다.
npm install --save-dev pino-pretty
```

그다음 여러 개의 전송 대상을 설정합니다.  

```typescript
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      targets: [
        // 콘솔에는 읽기 쉬운 형식으로 출력합니다.
        {
          target: 'pino-pretty',
          level: 'info',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },

        // 파일에는 JSON 형식으로 저장합니다.
        {
          target: 'pino/file',
          level: 'info',
          options: {
            destination: 'logs/app.log',
            mkdir: true,
          },
        },
      ],
    },
  },
});
```

Pino에서 사용할 수 있는 대표적인 전송 대상은 다음과 같습니다.  

| `target` 값 | 패키지 | 용도 |
| --- | --- | --- |
| `pino-pretty` | `pino-pretty` | 콘솔에서 로그를 사람이 읽기 좋은 형식으로 출력합니다. |
| `pino/file` | `pino` 내장 | JSON 로그를 파일이나 표준 출력·표준 오류 같은 파일 디스크립터로 전송합니다. |
| `pino-roll` | `pino-roll` | 날짜나 파일 크기를 기준으로 로그 파일을 회전합니다. |
| `pino-loki` | `pino-loki` | Pino 로그를 Grafana Loki로 전송합니다. |
| `pino-elasticsearch` | `pino-elasticsearch` | Pino 로그를 Elasticsearch에 저장합니다. |

`pino/file`은 Pino에 내장되어 있지만, 나머지 전송 대상은 별도 패키지를 설치해야 합니다.  
Grafana Loki나 Elasticsearch로 전송할 때는 해당 패키지 문서에서 연결 주소와 인증 정보 같은 필수 옵션도 확인해야 합니다.  

### 🟦 3. 로그 회전(Log Rotation)

하나의 로그 파일에 계속 기록하면 파일 크기가 지나치게 커져 보관과 검색이 어려워질 수 있습니다.  
로그 회전은 날짜나 파일 크기를 기준으로 기존 파일을 나누고 새 파일에 이어서 기록하는 방식입니다.  

Pino의 서드파티 전송 대상인 `pino-roll`은 시간과 크기 조건을 함께 지정할 수 있습니다.  
먼저 패키지를 설치합니다.  

```bash
# 날짜 또는 크기를 기준으로 로그 파일을 회전하는 전송 대상을 설치합니다.
npm install pino-roll
```

다음 예제는 하루가 지나거나 활성 로그 파일이 10MB에 도달하면 새 파일로 교체합니다.  

```typescript
import Fastify from 'fastify';
import { join } from 'node:path';

// 로그 파일이 날짜 또는 크기 조건에 도달하면 자동으로 회전합니다.
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-roll',
      options: {
        // 애플리케이션 실행 위치를 기준으로 로그 파일 경로를 만듭니다.
        file: join(process.cwd(), 'logs/app.log'),

        // 하루가 지나거나 파일 크기가 10MB에 도달하면 회전합니다.
        frequency: 'daily',
        size: '10m',

        // 활성 파일과 별도로 회전된 로그 파일을 최대 7개 보관합니다.
        limit: { count: 7 },

        // logs 디렉터리가 없으면 자동으로 생성합니다.
        mkdir: true,
      },
    },
  },
});
```

`frequency`와 `size`를 함께 설정하면 둘 중 먼저 충족한 조건을 기준으로 파일을 회전합니다.  
`frequency: 'daily'`는 매일, `size: '10m'`은 파일이 10MB에 도달했을 때 회전한다는 뜻입니다.  

`limit.count`는 활성 파일을 제외하고 보관할 회전 파일의 최대 개수입니다.  
따라서 `count: 7`이면 회전 파일 7개와 현재 기록 중인 활성 파일 1개를 합쳐 최대 8개가 남습니다.  
오래된 로그가 자동으로 삭제될 수 있으므로 감사나 장애 분석을 위해 장기 보관이 필요하다면 별도의 로그 저장소로 전송하는 방법도 함께 고려해야 합니다.  
