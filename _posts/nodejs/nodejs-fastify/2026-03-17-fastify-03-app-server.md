---
layout: post
title: "[Fastify] 03. app/server 분리와 전역 오류 처리"
description: "환경 변수를 한곳에서 관리하고 Fastify 애플리케이션 구성과 서버 실행을 분리합니다. 안전한 종료, 환경별 로깅, 전역 오류 및 404 처리까지 API 서버의 기본 골격을 완성합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. 환경 변수 관리: env.ts"
  - id: session-02
    title: "2. Fastify 인스턴스 구성: app.ts"
  - id: session-03
    title: "3. 서버 실행과 안전한 종료: server.ts"
  - id: session-04
    title: "4. 전역 오류 처리와 로깅"
  - id: session-05
    title: "5. Fastify API 서버 실행"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**  

프로젝트 루트의 `src` 디렉터리를 기준으로 환경 설정, 애플리케이션 구성, 서버 실행과 오류 처리를 연결합니다.  

```text
src/
├── app.ts
├── server.ts
├── config/
│   └── env.ts
└── common/
    └── errors/
        ├── business.error.ts
        ├── error.codes.ts
        ├── error.handler.ts
        └── not-found.handler.ts
```

`app.ts`는 Fastify 인스턴스를 구성하고, `server.ts`는 구성된 애플리케이션을 실제 포트에서 실행합니다.  
두 책임을 분리하면 테스트에서는 포트를 열지 않고 `createApp()`만 호출할 수 있고, 실행 환경과 관계없는 애플리케이션 설정도 한곳에서 관리할 수 있습니다.  

## 1. 환경 변수 관리: env.ts {#session-01}

`.env` 파일은 포트, 데이터베이스 주소, 로그 수준처럼 실행 환경마다 달라지는 값을 `KEY=VALUE` 형식으로 저장합니다.  
Node.js의 `process.env`에서 읽은 값은 문자열 또는 `undefined`이므로, 숫자로 사용할 값은 변환과 검증이 필요합니다.  

애플리케이션 여러 곳에서 `process.env`에 직접 접근하면 같은 기본값과 변환 로직이 반복됩니다.  
`env.ts`를 단일 진입점으로 두면 필요한 환경 변수를 한눈에 확인하고, 나머지 코드에서는 `env.PORT`처럼 일관된 형태로 사용할 수 있습니다.  

### 🟦 `.env` 불러오기와 포트 검증

```typescript
// src/config/env.ts

// 이 모듈을 불러올 때 .env의 값을 process.env에 등록합니다.
import 'dotenv/config';
import process from 'node:process';

// 문자열로 읽은 PORT를 숫자로 바꾸고, 값이 없으면 3000을 사용합니다.
const port = Number(process.env.PORT ?? 3_000);

// TCP 포트로 사용할 수 있는 정수 범위를 벗어나면 시작 단계에서 중단합니다.
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT는 1부터 65535 사이의 정수여야 합니다.');
}

// 환경 변수를 한곳에 모아 애플리케이션의 공통 설정으로 제공합니다.
export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',

  // 실행 환경을 지정하지 않으면 운영 환경으로 처리합니다.
  NODE_ENV: process.env.NODE_ENV ?? 'production',

  HOST: process.env.HOST ?? '0.0.0.0',
  PORT: port,

  SERVICE_NAME: process.env.SERVICE_NAME ?? 'fastify-service',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
  LOG_PATH: process.env.LOG_PATH ?? './logs/app.log',
};
```

`dotenv/config`은 가져오는 즉시 기본 `.env` 파일을 읽습니다.  
포트를 요청 처리 중에 검사하지 않고 모듈을 불러올 때 검사하므로, 잘못된 설정으로 서버가 실행되는 것을 미리 막을 수 있습니다.  

현재 코드는 설정이 없을 때 `production`과 `error`를 기본값으로 사용합니다.  
따라서 개발용 로그를 보려면 `.env`에서 `NODE_ENV=development`와 필요한 `LOG_LEVEL`을 명시하는 편이 좋습니다.  
`LOG_PATH`도 설정 객체에 포함되어 있어 이후 로그 경로를 환경별로 바꿀 때 사용할 수 있습니다.  

## 2. Fastify 인스턴스 구성: app.ts {#session-02}

`app.ts`는 Fastify 인스턴스를 만들고 애플리케이션 전체에 적용할 옵션과 오류 처리기를 등록합니다.  
실제 네트워크 포트를 여는 `listen()`은 호출하지 않고, 구성을 마친 인스턴스를 `createApp()`에서 반환합니다.  

### 🟦 1. 개발 환경과 운영 환경의 로그 분리

pino-pretty는 Pino가 출력하는 JSON 로그를 사람이 읽기 쉬운 형태로 변환해 주는 개발용 포매터입니다.  

```bash
cd ~/blog-workspaces/nodejs-workbook/fastify-basics
npm install -D pino-pretty
```


```typescript
// src/app.ts
// 개발 환경: 설정된 로그 레벨 이상의 메시지만 보기 좋게 출력합니다.
const developmentLoggerOptions = {
  level: env.LOG_LEVEL,
  transport: {
    // JSON 로그를 개발자가 읽기 쉬운 형식으로 변환합니다.
    target: 'pino-pretty',
    options: {
      // 로그 시간을 현재 시스템의 표준 날짜·시간 형식으로 표시합니다.
      translateTime: 'SYS:standard',
      // 개발 중 중요도가 낮은 프로세스 ID와 호스트 이름은 숨깁니다.
      ignore: 'pid,hostname',
    },
  },
};

// 운영 환경: 설정된 로그 레벨 이상의 메시지를 JSON 형식으로 기록합니다.
const productionLoggerOptions = {
  level: env.LOG_LEVEL,
  transport: {
    // Pino의 파일 전송기를 사용합니다.
    target: 'pino/file',
    options: {
      // env.ts에서 읽은 LOG_PATH를 로그 파일 경로로 사용합니다.
      destination: env.LOG_PATH,
      // 로그 경로의 상위 디렉터리가 없으면 자동으로 생성합니다.
      mkdir: true,
    },
  },
};

// 실행 환경에 맞는 로거 설정을 선택합니다.
const loggerOptions =
  env.NODE_ENV === 'development' ? developmentLoggerOptions : productionLoggerOptions;

```

개발 환경에서는 `pino-pretty`가 시간 형식을 읽기 쉽게 바꾸고 `pid`, `hostname` 필드를 숨깁니다.  
운영 환경에서는 `pino/file`이 `logs/app.log`에 구조화된 JSON 로그를 저장하며, `mkdir: true`가 디렉터리가 없을 때 만들어 줍니다.  

### 🟦 2. Fastify 서버 옵션 설정

```typescript
export function createApp() {
  // 애플리케이션 전체에서 공유할 옵션으로 Fastify 인스턴스를 생성합니다.
  const app = Fastify({
    logger: loggerOptions,

    // 요청 본문의 최대 크기를 1 MiB로 제한합니다.
    bodyLimit: 1024 * 1024,

    // 연결된 소켓에서 10초 동안 데이터 송수신이 없으면 타임아웃 처리합니다.
    connectionTimeout: 10_000,

    // 응답 후 Keep-Alive 연결에서 다음 요청을 최대 5초 동안 기다립니다.
    keepAliveTimeout: 5_000,

    // 클라이언트가 HTTP 요청 전체를 보내는 시간을 30초로 제한합니다.
    requestTimeout: 30_000,

    // 신뢰하는 리버스 프록시가 전달한 X-Forwarded-* 헤더를 사용합니다.
    trustProxy: true,

    // 플러그인이 10초 안에 로드되지 않으면 오류로 처리합니다.
    pluginTimeout: 10_000,

    routerOptions: {
      // /path와 /path/를 같은 라우트로 처리합니다.
      ignoreTrailingSlash: true,
      // URL 경로의 대소문자를 구분하지 않습니다.
      caseSensitive: false,
      // URL 경로 매개변수의 최대 길이를 200자로 제한합니다.
      maxParamLength: 200,
    },
  });

  // 모든 요청 처리 오류를 공통 HTTP 응답으로 변환합니다.
  app.setErrorHandler(errorHandler);

  // 등록된 라우트가 없는 요청에는 공통 형식의 404 응답을 반환합니다.
  app.setNotFoundHandler(notFoundHandler);

  return app;
}
```

`connectionTimeout`은 연결된 소켓의 비활성 시간을 다루고, `requestTimeout`은 요청 전체를 수신할 수 있는 시간을 제한합니다.  
두 옵션 모두 라우트 핸들러의 비즈니스 로직 실행 시간을 직접 제한하지는 않습니다.  

`trustProxy: true`이면 `X-Forwarded-For`와 같은 프록시 헤더를 신뢰합니다.  
클라이언트가 서버에 직접 접근할 수 있는 환경에서는 헤더를 위조할 수 있으므로, 신뢰할 수 있는 리버스 프록시 뒤에서만 사용하는 것이 안전합니다.  

현재 예제는 API 서버의 공통 골격에 집중하므로 라우트를 아직 등록하지 않았습니다.  
이후 기능별 플러그인과 라우트를 추가할 때는 `return app`보다 앞에서 `app.register()`를 호출하면 됩니다.  

## 3. 서버 실행과 안전한 종료: server.ts {#session-03}

`server.ts`는 `createApp()`으로 애플리케이션을 만들고 실제 포트를 엽니다.  
또한 운영체제가 보내는 종료 신호와 처리되지 않은 Promise 거부를 감지하여 서버를 안전하게 닫습니다.  

### 🟦 1. 애플리케이션 생성과 종료 함수

```typescript
// src/server.ts
// 애플리케이션 실행 진입점: 서버 시작과 안전한 종료를 담당합니다.

import { createApp } from './app';
import { env } from './config/env';

async function startServer() {
  // 플러그인과 공통 처리기가 설정된 Fastify 인스턴스를 생성합니다.
  const app = createApp();

  // 여러 종료 신호가 연달아 들어와도 종료 절차는 한 번만 실행합니다.
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);

      // 새 요청을 받지 않고 처리 중인 요청과 연결을 정리합니다.
      // 등록된 플러그인의 onClose 훅도 이 과정에서 실행됩니다.
      await app.close();
      app.log.info('Server closed gracefully');
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
    } finally {
      process.exit(0);
    }
  };
```

`isShuttingDown`은 `SIGINT`와 `SIGTERM`이 연달아 도착해도 `app.close()`가 중복 실행되지 않게 막습니다.  
`app.close()`는 새 요청 수신을 중단하고 처리 중인 요청과 연결을 정리한 뒤, 플러그인에 등록된 `onClose` 훅을 실행합니다.  
데이터베이스 연결 풀, Redis와 메시지 큐처럼 직접 연 외부 리소스는 해당 플러그인의 `onClose` 훅에서 닫아야 합니다.  

### 🟦 2. 종료 신호와 런타임 오류 처리

```typescript
  // 이벤트 리스너는 Promise를 기다리지 않으므로 void로 의도적인 미대기를 표시합니다.
  // SIGINT는 터미널에서 Ctrl+C를 눌렀을 때 주로 전달됩니다.
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // SIGTERM은 Docker, Kubernetes, PM2, systemd 등이 종료할 때 주로 전달합니다.
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // 처리되지 않은 Promise 거부를 기록한 뒤 종료 절차를 시작합니다.
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'Unhandled rejection');
    void shutdown('unhandledRejection');
  });
```

`SIGINT`와 `SIGTERM`은 정상적인 운영 과정에서도 발생하는 종료 신호입니다.  
`unhandledRejection`은 처리되지 않은 비동기 오류이므로 원인을 로그에 남긴 뒤 종료 절차를 시작합니다.  

### 🟦 3. 서버 시작

```typescript
  try {
    // listen()이 성공하면 실제로 바인딩된 서버 주소를 반환합니다.
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`Server listening at ${address}`);
  } catch (error) {
    // 시작 실패는 정상 서비스가 불가능하므로 오류 코드 1로 종료합니다.
    app.log.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// 최상위 await로 초기 구동이 끝날 때까지 기다립니다.
await startServer();
```

종료 이벤트 리스너를 `listen()`보다 먼저 등록하므로, 서버가 시작되는 도중 종료 신호를 받아도 정리 절차를 시도할 수 있습니다.  
`listen()`이 성공하면 실제 바인딩 주소를 로그에 남기고, 포트 충돌 같은 이유로 실패하면 종료 코드 `1`을 반환합니다.  

## 4. 전역 오류 처리와 로깅 {#session-04}

라우트마다 `try/catch`와 오류 응답을 반복하면 상태 코드와 JSON 구조가 조금씩 달라지기 쉽습니다.  
Fastify의 전역 오류 처리기를 사용하면 예상 가능한 비즈니스 오류, 입력 검증 오류와 예상하지 못한 시스템 오류를 한곳에서 분류할 수 있습니다.  

### 🟦 1. 오류 코드와 `BusinessError`

클라이언트가 오류 종류를 안정적으로 구분하려면 사람이 읽는 메시지와 별도로 고정된 오류 코드가 필요합니다.  
`ErrorCode` enum에는 인증, 사용자, 게시물과 데이터베이스 등 애플리케이션에서 사용할 오류 코드를 모아 둡니다.  

```typescript
// src/common/errors/error.codes.ts 중 공통 오류 코드입니다.
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  // 도메인별 오류 코드는 같은 enum에 계속 추가합니다.
}
```

서비스 계층에서 예상한 실패는 `BusinessError`에 오류 코드, 메시지, HTTP 상태 코드와 선택적인 상세 정보를 담아 전달합니다.  

```typescript
// src/common/errors/business.error.ts

import { ErrorCode } from './error.codes';

// 예상 가능한 비즈니스 규칙 위반을 표현하는 사용자 정의 Error입니다.
export class BusinessError<T = unknown> extends Error {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: T,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

### 🟦 2. 오류 종류 판별하기

전역 처리기는 매개변수를 `unknown`으로 받아 먼저 오류의 종류를 확인합니다.  
Fastify 검증 오류는 `validation` 속성의 존재 여부를 검사하는 타입 가드로 구분합니다.  

```typescript
// src/common/errors/error.handler.ts

import type { FastifyReply, FastifyRequest } from 'fastify';

import { Prisma } from '../../generated/prisma/client';
import { ErrorCode } from './error.codes';
import { BusinessError } from './business.error';

interface ErrorResponse {
  success: false;
  code: ErrorCode;
  message: string;
}

interface FastifyValidationError extends Error {
  validation: unknown;
  validationContext?: string;
  statusCode?: number;
}

// validation 속성이 있는 Error인지 확인하고 TypeScript 타입을 좁힙니다.
function isValidationError(error: unknown): error is FastifyValidationError {
  return error instanceof Error && 'validation' in error;
}
```

### 🟦 3. 공통 응답과 로그 만들기

```typescript
export function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // 어떤 분기에도 해당하지 않으면 내부 서버 오류로 처리합니다.
  let statusCode = 500;
  let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
  let message = '서버 내부 오류가 발생했습니다.';

  if (error instanceof BusinessError) {
    // 서비스에서 의도적으로 던진 오류의 응답 정보를 그대로 사용합니다.
    statusCode = error.statusCode;
    errorCode = error.errorCode;
    message = error.message;
  } else if (isValidationError(error)) {
    // body, params, query가 JSON Schema와 맞지 않으면 400으로 응답합니다.
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = '입력 형식이 올바르지 않습니다.';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // 처리하지 않은 Prisma 오류의 내부 정보는 클라이언트에 노출하지 않습니다.
    statusCode = 500;
    errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    message = '서버 내부 오류가 발생했습니다.';
  }

  if (statusCode >= 500) {
    // 5xx는 원인과 스택 추적을 확인할 수 있도록 원본 오류를 기록합니다.
    request.log.error(
      {
        err: error,
        code: errorCode,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Request failed',
    );
  } else {
    // 4xx는 예상 가능한 거절이므로 요청 식별 정보만 info 수준으로 남깁니다.
    request.log.info(
      {
        code: errorCode,
        statusCode,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Request rejected',
    );
  }

  // satisfies는 객체를 변환하지 않고 ErrorResponse 형식만 검사합니다.
  return reply.status(statusCode).send({
    success: false,
    code: errorCode,
    message,
  } satisfies ErrorResponse);
}
```

처리기는 먼저 모든 오류를 `500 INTERNAL_SERVER_ERROR`로 가정합니다.  
이후 `BusinessError`, Fastify 검증 오류, Prisma의 알려진 요청 오류 순서로 검사하여 상태 코드와 메시지를 결정합니다.  

`5xx` 로그에는 디버깅에 필요한 원본 오류를 포함하지만, 클라이언트에는 내부 정보를 보내지 않습니다.  
`4xx` 로그에는 오류 코드와 요청 ID, 메서드, URL을 남겨 어떤 요청이 거절되었는지 추적합니다.  

### 🟦 4. 존재하지 않는 라우트 처리

요청 URL과 일치하는 라우트가 없을 때는 일반 오류 처리기가 아니라 `setNotFoundHandler()`에 등록한 처리기가 실행됩니다.  

```typescript
// src/common/errors/not-found.handler.ts

import type { FastifyReply, FastifyRequest } from 'fastify';

import { ErrorCode } from './error.codes';

// 등록된 라우트를 찾지 못하면 요청 정보를 기록하고 공통 404 응답을 반환합니다.
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  request.log.info(
    {
      code: ErrorCode.ROUTE_NOT_FOUND,
      statusCode: 404,
      requestId: request.id,
      method: request.method,
      url: request.url,
    },
    'Route not found',
  );

  return reply.status(404).send({
    success: false,
    code: ErrorCode.ROUTE_NOT_FOUND,
    message: '요청한 API를 찾을 수 없습니다.',
  });
}
```

오류 응답을 모두 `success`, `code`, `message` 구조로 통일하면 클라이언트도 같은 방식으로 실패를 처리할 수 있습니다.  

## 5. Fastify API 서버 실행 {#session-05}

워크북 루트에는 `tsx`가 개발 의존성으로 설치되어 있습니다.  
`tsx`를 사용하면 TypeScript 소스를 JavaScript로 미리 빌드하지 않고 실행할 수 있으며, `watch` 옵션은 파일이 바뀔 때 프로세스를 다시 시작합니다.  

```bash
# nodejs-workbook 루트에서 Fastify 서버를 watch 모드로 실행합니다.
npx tsx watch ./fastify-basics/src/server.ts
```

개발 환경의 읽기 쉬운 로그를 확인하려면 `fastify-basics/.env`에 다음 값을 지정합니다.  

```dotenv
NODE_ENV=development
LOG_LEVEL=info
HOST=0.0.0.0
PORT=3000
```

![Fastify 서버 시작과 SIGINT 안전한 종료 결과](/assets/images/nodejs/nodejs-fastify/fastify-server-graceful-shutdown.png)

`Server listening at ...` 로그가 출력되면 서버가 시작된 것입니다.  
터미널에서 `Ctrl+C`를 누르면 프로세스가 `SIGINT`를 받고 `shutdown()`을 실행합니다.  
이후 `app.close()`가 요청과 연결을 정리하고 `Server closed gracefully` 로그를 남긴 뒤 프로세스가 종료됩니다.  
