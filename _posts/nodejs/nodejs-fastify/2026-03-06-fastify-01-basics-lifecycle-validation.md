---
layout: post
title: "[Fastify]01. 프로젝트 설정, 요청 생명주기와 스키마 검증"
description: "npm workspace에 Fastify 프로젝트를 생성하고 TypeScript 환경과 기본 서버를 구성한 뒤 요청 생명주기와 JSON Schema 기반 검증 방법을 알아봅니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. 가장 단순한 Fastify 서버(Hello World)"
  - id: session-02
    title: "2. 요청 생명주기(Lifecycle Hooks)"
  - id: session-03
    title: "3. 스키마 기반 검증(Schema-first): preValidation 이후 수행"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 가장 단순한 Fastify 서버(Hello World) {#session-01}

Fastify는 Node.js를 위한 빠른 웹 프레임워크로, 낮은 오버헤드와 강력한 플러그인 시스템이 특징입니다.  
Express와 비슷해 보이지만, 캡슐화된 플러그인 구조를 바탕으로 예측 가능한 방식으로 애플리케이션을 구성할 수 있습니다.  

### 🟦 실습 환경 확인

이 글에서는 `~/blog-workspaces/nodejs-workbook`을 루트로 사용하는 npm workspace에서 실습합니다.  
루트 프로젝트에는 Node.js 22.13 이상을 사용하도록 설정되어 있고, TypeScript와 `tsx` 같은 공통 개발 도구가 설치되어 있습니다.  
`fastify-basics`는 루트의 개발 도구를 공유하면서 Fastify 관련 의존성과 소스 코드를 독립적으로 관리합니다.  

### 🟦 `fastify-basics` 프로젝트 생성

처음부터 프로젝트를 만든다면 `nodejs-workbook` 루트에서 다음 명령을 실행합니다.  

```bash
# npm workspace의 루트 디렉터리로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook

# Fastify 실습용 디렉터리와 package.json을 생성합니다.
mkdir fastify-basics
cd fastify-basics
npm init -y

npx tsc --init
# 소스 코드와 테스트 코드를 분리할 디렉터리를 생성합니다.
mkdir src tests
```

루트 `package.json`의 `workspaces`에도 `fastify-basics`를 등록합니다.  
이 설정이 있어야 npm이 하위 프로젝트의 의존성을 루트 `node_modules`와 `package-lock.json`에서 함께 관리합니다.  

```jsonc
{
  "name": "nodejs-workbook",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.13"
  },
  "workspaces": [
    "prisma-basics",
    "redis-basics",
    "vitest-basics",
    "fastify-basics"
  ]
}
```

### 🟦 Fastify 패키지 설치

루트 디렉터리에서 `--workspace fastify-basics` 옵션을 사용하면 의존성을 해당 하위 프로젝트에 설치할 수 있습니다.  
실제 프로젝트에 맞추어 Fastify 5.6.2와 `fastify-plugin` 6.0.0을 설치합니다.  

```bash
# npm workspace의 fastify-basics경로로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/fastify-basics

# Fastify 서버와 플러그인 작성에 필요한 패키지를 설치합니다.
npm install fastify@5.6.2 fastify-plugin@6.0.0

# prisma 로 미리 설치합니다.
 npm install -D @types/better-sqlite
 npm install @prisma/adapter-better-sqlite3@7 better-sqlite3

 npm install -D prisma@7
 npm install @prisma/client@7

# workspace에 설치된 버전을 확인합니다.
npm list
```

설치를 마치면 `fastify-basics/package.json`의 Fastify 관련 의존성은 다음과 같습니다.  
현재 프로젝트에는 이후 데이터베이스 실습을 위한 Prisma와 SQLite 패키지도 있습니다.

```json
{
  "name": "fastify-basics",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "@prisma/adapter-better-sqlite3": "^7.9.1",
    "@prisma/client": "^7.9.1",
    "better-sqlite3": "^13.0.3",
    "fastify": "^5.6.2",
    "fastify-plugin": "^6.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "prisma": "^7.9.1"
  }
}

```

### 🟦 프로젝트 구조

현재 설정 파일에 맞추어 `src`와 `tests` 디렉터리를 만들고, 이 글의 기본 서버 코드를 `src/app.ts`에 작성합니다.  
Prisma 관련 파일은 이후 데이터베이스 연동에서 사용하므로 여기서는 수정하지 않습니다.  

```text
nodejs-workbook/
├── package.json
├── package-lock.json
├── tsconfig.json
└── fastify-basics/
    ├── .env
    ├── .gitignore
    ├── package.json
    ├── prisma.config.ts
    ├── prisma/
    │   └── schema.prisma
    ├── src/
    │   └── app.ts
    ├── tests/
    ├── tsconfig.json
    └── vitest.config.ts
```

- 루트 `package.json`과 `package-lock.json`은 workspace와 전체 의존성을 관리합니다.
- `fastify-basics/package.json`은 Fastify 프로젝트에서 직접 사용하는 패키지를 관리합니다.
- `src`에는 애플리케이션 코드를 작성하고 `tests`에는 테스트 코드를 작성합니다.
- `.env`에는 데이터베이스 연결 정보 같은 환경 변수를 저장하며 Git에 커밋하지 않습니다.
- `tsconfig.json`은 루트의 공통 TypeScript 설정을 상속합니다.
- `vitest.config.ts`는 Node.js 환경에서 실행할 테스트와 커버리지 기준을 설정합니다.

### 🟦 TypeScript 설정

`fastify-basics/tsconfig.json`은 루트 설정을 `extends`로 상속합니다.  
루트 설정에는 ES2022, ESM, Node.js 타입, 엄격한 타입 검사와 `noEmit` 옵션이 적용되어 있습니다.  
하위 프로젝트에서는 검사할 파일과 증분 타입 검사 캐시의 저장 위치만 별도로 지정합니다.  

```jsonc
{
  // 루트 프로젝트의 공통 TypeScript 설정을 상속합니다.
  "extends": "../tsconfig.json",
  "compilerOptions": {
    // 루트에 정의된 경로 별칭을 이 프로젝트에서는 사용하지 않습니다.
    "paths": {},
    // 소스 디렉터리나 프로젝트 루트에 캐시 파일이 노출되지 않도록
    // node_modules 내부 캐시 디렉터리에 저장합니다.
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.tsbuildinfo"
  },
  // 애플리케이션, 테스트, Prisma와 도구 설정 파일을 타입 검사합니다.
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "prisma/**/*.ts",
    "prisma.config.ts",
    "vitest.config.ts"
  ],
  // 의존성, 빌드 결과, 커버리지와 생성 코드를 검사 대상에서 제외합니다.
  "exclude": ["node_modules", "dist", "coverage", "generated"]
}
```

다음 명령으로 `fastify-basics`에 포함된 TypeScript 파일을 출력 없이 검사할 수 있습니다.  

```bash
# 루트에 설치된 TypeScript로 fastify-basics 프로젝트를 검사합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook
npx tsc --project fastify-basics/tsconfig.json --noEmit
```

### 🟦 기본 서버 작성 및 실행

Fastify는 인스턴스를 생성하고, 라우트를 등록한 뒤, 서버를 실행하는 세 단계로 시작합니다.  

- `Fastify()`: 서버 인스턴스를 생성하고 로깅, 타임아웃 등의 설정을 전달합니다.
- `get()`: HTTP GET 메서드로 처리할 라우트를 정의합니다.
- `listen()`: 지정한 포트에서 요청을 기다립니다.

```typescript
// src/ch01/app.ts
import Fastify from 'fastify';

// 1. 요청 로그를 기록하는 서버 인스턴스를 생성합니다.
const fastify = Fastify({
  logger: true,
});

// 2. GET /ping 요청을 처리하는 라우트를 등록합니다.
fastify.get('/ping', () => {
  // Fastify는 반환한 객체를 JSON 응답으로 자동 직렬화합니다.
  return { pong: true };
});

// 3. 3000번 포트에서 서버를 실행합니다.
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

await start();

```

루트에 설치된 `tsx`로 TypeScript 파일을 바로 실행합니다.  

```bash
# fastify-basics 디렉터리에서 기본 서버를 실행합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/fastify-basics
npx tsx src/ch01/app.ts
```

서버가 실행되면 다른 터미널에서 `/ping` 엔드포인트를 호출합니다.  

```bash
curl http://127.0.0.1:3000/ping
```

```json
{
  "pong": true
}
```

## 2. 요청 생명주기(Lifecycle Hooks) {#session-02}

Fastify의 주요 특징 중 하나는 Hook(훅)입니다.  
요청이 들어와 응답이 나갈 때까지 각 단계에 훅을 등록하여 처리 과정을 세밀하게 제어할 수 있습니다.  

### 🟦 주요 훅 순서

1. `onRequest`: 요청이 들어온 직후 실행합니다.  
   아직 본문을 파싱하기 전이므로 `request.body`는 `undefined`이며, 인증처럼 본문이 필요 없는 처리에 적합합니다. CORS는 보통 `@fastify/cors` 플러그인으로 처리합니다.  
2. `preParsing`: 요청 본문을 파싱하기 전에 실행합니다.  
   원본 payload 스트림을 가공할 수 있어 압축 해제나 스트림 변환 등에 사용하며, 이때도 `request.body`는 `undefined`입니다.  
3. `preValidation`: 본문을 파싱한 뒤 스키마를 검증하기 직전에 실행합니다.  
   여기서 `request.body`를 읽거나 수정하면 변경된 값이 검증 대상이 됩니다.  
4. `preHandler`: 스키마 검증을 통과한 뒤 route handler 직전에 실행합니다.  
   권한과 인가를 확인하는 데 적합합니다.  
5. `Handler`: 실제 route handler에서 API 로직을 실행합니다.  
6. `preSerialization`: handler가 반환한 payload를 직렬화하기 직전에 실행합니다.  
   응답 객체를 감싸거나 구조를 바꿀 수 있지만, payload가 문자열, `Buffer`, stream, `null`이면 실행되지 않습니다.  
7. `onSend`: 직렬화를 마친 payload를 클라이언트에 보내기 직전에 실행합니다.  
   payload를 변경할 수 있지만 사용할 수 있는 타입에는 제약이 있습니다.  
8. `onResponse`: 응답 전송을 마친 뒤 실행합니다.  
   응답을 바꿀 수 없으므로 로깅, 통계 수집, 모니터링 등에 사용합니다.  

```typescript
/* eslint-disable @typescript-eslint/require-await */
// Fastify의 Promise 기반(async) 라이프사이클 훅을 살펴보는 예제입니다.

/**
 * Fastify 훅은 Promise 방식과 콜백 방식 중 하나로 작성할 수 있습니다.
 * 이 파일에서는 async 함수를 사용하는 Promise 방식을 사용합니다.
 *
 * async를 사용하지 않는 경우에는 아래처럼 done 콜백을 호출하여
 * 훅의 처리가 끝났음을 Fastify에 알려야 합니다.
 *
 * fastify.addHook('onRequest', (request, _reply, done) => {
 *   request.log.info('onRequest');
 *   done();
 * });
 *
 * async 함수와 done 콜백을 함께 사용하면 요청이 중복 처리될 수 있으므로
 * 두 방식을 혼용하지 않습니다.
 */

import Fastify from 'fastify';

// 1. 요청 로그를 기록하는 서버 인스턴스를 생성합니다.
const fastify = Fastify({
  logger: true,
});

fastify.addHook('onRequest', async (request, reply) => {
  void reply; //값을 실제로 사용하지 않고 의도적으로 무시한다는 의미
  request.log.info('1. onRequest: 요청을 받자마자 실행 (인증, CORS 등)');
});

fastify.addHook('preParsing', async (request, reply, payload) => {
  void reply;
  request.log.info('2. preParsing: 본문을 파싱하기 전');
  return payload;
});

fastify.addHook('preValidation', async (request, reply) => {
  void reply;
  request.log.info('3. preValidation: 요청이 유효성 검사되기 전');
});

fastify.addHook('preHandler', async (request, reply) => {
  void reply;
  request.log.info('4. preHandler: 핸들러 실행 전 (권한 검사 가능)');
});

fastify.get('/example', async (request) => {
  request.log.info('5. handler: 실제 API 로직(핸들러) 실행');
  return { message: '5. 핸들러 실행 완료' };
});

fastify.addHook('onSend', async (request, reply, payload) => {
  void reply;
  request.log.info('6. onSend: 응답을 보내기 직전 (응답 변조)');
  return payload;
});

fastify.addHook('onResponse', async (request, reply) => {
  void reply;
  request.log.info('7. onResponse: 응답이 클라이언트로 전송된 후');
});
```

![Fastify 요청 생명주기 훅의 실행 순서를 출력한 로그](/assets/images/nodejs/nodejs-fastify/fastify-lifecycle-hooks-output.png)

## 3. 스키마 기반 검증(Schema-first): preValidation 이후 수행 {#session-03}

Fastify는 별도의 유효성 검사 라이브러리를 직접 연결하지 않아도 JSON Schema를 사용하여 입력을 검증할 수 있습니다.  
`preValidation` 훅이 끝난 뒤 스키마 검증을 수행하므로, 잘못된 요청은 Handler에 도달하기 전에 `400 Bad Request` 응답으로 처리됩니다.  

```typescript
// /src/ch01/validation.ts
import Fastify from 'fastify';

// 요청 처리 과정과 검증 오류를 콘솔에서 확인할 수 있도록 로거를 활성화합니다.
const fastify = Fastify({
  logger: true,
});

// 요청 본문을 표현하는 TypeScript 타입입니다.
// 이 타입은 컴파일 시점에만 검사되며, 실제 요청 데이터 검증은 아래 JSON Schema가 담당합니다.
interface CreateUserBody {
  email: string;
  password: string;
  age?: number;
}

// 제네릭의 Body 타입을 지정하면 핸들러에서 request.body를 안전하게 사용할 수 있습니다.
fastify.post<{ Body: CreateUserBody }>(
  '/users',
  {
    schema: {
      // 클라이언트가 보낸 요청 본문을 실행 시점에 검증합니다.
      body: {
        type: 'object',
        // email과 password는 필수이고 age는 선택 사항입니다.
        required: ['email', 'password'],
        properties: {
          // 올바른 이메일 형식인지 검사합니다.
          email: { type: 'string', format: 'email' },
          // 비밀번호는 8자 이상의 문자열이어야 합니다.
          password: { type: 'string', minLength: 8 },
          age: { type: 'integer' },
        },
      },

      // 상태 코드별 응답 구조를 정의하고 직렬화에 사용합니다.
      // 이 스키마는 HTTP 201 응답에만 적용됩니다.
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            success: { type: 'boolean' },
          },
        },
      },
    },
  },
  async (request, reply) => {
    // 검증을 통과한 요청 본문은 CreateUserBody 타입으로 추론됩니다.
    const { email, password, age } = request.body;

    // 예제에서 사용하지 않는 값임을 명시하여 미사용 변수 경고를 방지합니다.
    void password;
    void age;

    request.log.info({ email }, '사용자 생성 요청을 처리합니다.');

    // 응답 상태 코드와 본문을 설정하여 클라이언트에 전송합니다.
    return reply.code(200).send({ id: '123', success: true });
  },
);

// 서버 시작 중 발생하는 오류를 기록한 뒤 프로세스를 종료합니다.
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

await start();
```

![필수 password 필드가 없어 400 응답을 반환한 스키마 검증 결과](/assets/images/nodejs/nodejs-fastify/fastify-schema-validation-error.png)
