---
layout: post
title: "3. TypeScript 개발 환경 설정: tsconfig.json, tsx, Vitest"
description: "Node.js 프로젝트에 TypeScript와 tsx를 적용하고, tsconfig.json 구성부터 Vitest 기반 테스트 환경과 package.json 스크립트 설정까지 단계별로 정리합니다."
category_id: nodejs-environment
categories: [nodejs, nodejs-environment]
series: nodejs
series_order: 3
ai_assisted: true
toc:
  - id: session-01
    title: "1. TypeScript 설치와 tsconfig.json 설정하기"
  - id: session-02
    title: "2. TypeScript 실행 환경 구축: tsx 기반 개발"
  - id: session-03
    title: "3. 테스트 환경 설정(Vitest 기반)"
  - id: session-04
    title: "4. package.json 예시"
  - id: session-05
    title: "5. tsconfig.json 예시(TypeScript 6.0 + tsx)"
---

## 1. TypeScript 설치와 tsconfig.json 설정하기 {#session-01}

Node.js는 기존의 CommonJS와 표준 모듈 시스템인 ECMAScript Modules(ESM)을 모두 지원합니다.  
특히 새롭게 시작하는 프로젝트에서는 import와 export 문법을 사용하는 ESM 기반 구성이 널리 활용되고 있으며, TypeScript도 Node.js의 모듈 처리 방식을 반영한 NodeNext 설정을 제공하고 있습니다.

### 🟦 프로젝트 초기화 및 TypeScript 설치

#### 🔷 1) 프로젝트 디렉터리 생성 및 초기화

먼저 백엔드 프로젝트를 구성할 디렉터리를 만들고 npm 프로젝트를 초기화합니다.

```bash
mkdir nodejs-workbook
cd /home/ubuntu/blog-workspaces/nodejs-workbook
npm init -y
```

npm init -y 명령을 실행하면 프로젝트의 이름, 버전, 실행 스크립트, 의존성 등을 관리하는 package.json 파일이 생성됩니다.  
ESM 기반 프로젝트로 구성하려면 생성된 package.json에 다음 속성을 추가합니다.

```json
{
  "type": "module"
}
```

"type": "module"을 지정하면 Node.js가 프로젝트의 .js 파일을 CommonJS가 아닌 ES Module로 해석합니다.

#### 🔷 2) TypeScript와 Node.js 타입 정의 설치

TypeScript 컴파일러와 Node.js 내장 API의 타입 정보를 개발 의존성으로 설치합니다.

```bash
# TypeScript 컴파일러와 언어 서비스
npm install -D typescript

# Node.js 내장 API의 타입 정의
npm install -D @types/node
```

- typescript 패키지는 TypeScript 코드를 검사하고 JavaScript로 변환하는 tsc 컴파일러를 제공합니다.
- @types/node 패키지는 process, Buffer, node:fs, node:path 등 Node.js에서 제공하는 API의 타입 정보를 포함합니다.

이 패키지가 없으면 TypeScript가 Node.js 전역 객체와 내장 모듈의 타입을 정확하게 인식하지 못할 수 있습니다.

```text
ubuntu:~/blog-workspaces/nodejs-workbook$ npm list
nodejs-workbook@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook
├── @eslint/js@10.0.1
├── @eslint/json@2.0.1
├── @types/node@26.1.2
├── eslint-config-prettier@10.1.8
├── eslint@10.8.0
├── globals@17.8.0
├── prettier@3.9.6
├── typescript-eslint@8.65.0
└── typescript@6.0.3
```

#### 🔷 3) tsconfig.json 생성

TypeScript 프로젝트의 컴파일 설정을 관리하기 위해 다음 명령을 실행합니다.

```bash
npx tsc --init
```

명령을 실행하면 프로젝트 루트에 tsconfig.json 파일이 생성됩니다.  
tsconfig.json은 TypeScript가 어떤 파일을 검사하고, 어떤 JavaScript 문법으로 변환하며, 모듈을 어떤 방식으로 해석할지를 정의하는 핵심 설정 파일입니다.

## 2. TypeScript 실행 환경 구축: tsx 기반 개발 {#session-02}

과거에는 TypeScript 파일을 직접 실행하기 위해 ts-node가 널리 사용되었습니다.  
최근 Node.js 백엔드 개발 환경에서는 설정이 간단하고 ESM 호환성이 우수한 tsx가 실용적인 대안으로 많이 활용되고 있습니다.

tsx는 esbuild 기반의 고속 변환기를 사용하여 별도의 사전 빌드 과정 없이 TypeScript 파일을 바로 실행할 수 있습니다.  
또한 CommonJS와 ESM 프로젝트를 모두 지원하며, 두 모듈 시스템이 혼재된 환경에서도 비교적 간단한 설정으로 동작합니다.

### 🟦 tsx 설치 및 기본 실행

#### 🔷 1) tsx 설치

tsx는 애플리케이션의 런타임 의존성이 아니라 개발 과정에서 사용하는 실행 도구이므로, 일반적으로 개발 의존성으로 설치합니다.

```bash
npm install -D tsx
```

package.json에 스크립트를 등록하는 구성이 더 일반적입니다.

```jsonc
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

#### 🔷 2) 코드 작성

src/index.ts 파일을 생성하고 다음과 같이 간단한 HTTP 서버를 작성합니다.

```typescript
// src/index.ts
import { createServer } from "node:http";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    const response = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(response));
    return;
  }

  // 기본 응답
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end("Hello from TypeScript + tsx server!");
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
```

이 서버는 다음과 같이 동작합니다.

- GET /health 요청에는 서버 상태와 현재 시각을 JSON 형식으로 반환합니다.
- 그 외의 요청에는 기본 안내 메시지를 반환합니다.
- PORT 환경 변수가 지정되지 않으면 기본 포트로 3000을 사용합니다.

#### 🔷 3) TypeScript 파일 실행

설치가 완료되면 별도의 JavaScript 빌드 결과물을 생성하지 않고 TypeScript 파일을 바로 실행할 수 있습니다.

```bash
npx tsx ./src/index.ts
```

실행 결과는 다음과 같습니다.

```text
🚀 Server is running on http://localhost:3000
```

npx는 현재 프로젝트의 node_modules/.bin에 설치된 tsx 실행 파일을 찾아 실행합니다.

## 3. 테스트 환경 설정(Vitest 기반) {#session-03}

Node.js와 TypeScript 기반 프로젝트에서는 빠른 실행 속도와 간결한 설정을 제공하는 Vitest를 테스트 러너로 활용할 수 있습니다.  
Vitest는 Vite 기반의 테스트 프레임워크로 TypeScript와 ESM을 기본적으로 지원하며, Jest와 유사한 테스트 API와 mocking 기능을 제공합니다.

### 🟦 Vitest 설치

다음 명령어를 실행하여 Vitest를 개발 의존성으로 설치합니다.

```bash
npm install -D vitest
```

코드 커버리지 보고서가 필요한 경우에는 V8 기반 커버리지 패키지도 함께 설치할 수 있습니다.

```bash
npm install -D @vitest/coverage-v8
```

설치 후 package.json에 다음과 같이 테스트 명령어를 등록하면 편리합니다.

```jsonc
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

tsconfig.json 수정

```jsonc
  // TypeScript 타입 검사 대상입니다.
  //
  // src, tests 디렉터리 아래의 모든 .ts 파일을 포함합니다.
  "include": ["src/**/*.ts", "tests/**/*.ts"],
```

### 🟦 TypeScript 타입 설정

테스트 파일에서 describe, it, expect 등의 API를 직접 import하여 사용한다면 별도의 전역 타입 설정 없이도 TypeScript가 해당 타입을 인식할 수 있습니다.

```typescript
import { describe, it, expect } from "vitest";
```

반대로 테스트 API를 import하지 않고 전역 함수로 사용하려면 vitest.config.ts에서 globals 옵션을 활성화해야 합니다.

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

이 경우 `tsconfig.json`의 `types` 항목에도 Vitest 전역 타입을 추가합니다.

```jsonc
{
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  }
}
```

### 🟦 테스트 폴더 및 예제 작성

```typescript
// tests/sample.test.ts
import { describe, it, expect } from 'vitest';

describe('sample test', () => {
  it('should add numbers', () => {
    expect(1 + 1).toBe(2);
  });
});
```

다음 명령어를 실행하면 테스트를 시작할 수 있습니다.

```bash
npm test

> nodejs-workbook@1.0.0 test
> vitest

 DEV  v4.1.10 /home/ubuntu/blog-workspaces/nodejs-workbook

 ✓ tests/sample.test.ts (1 test) 5ms
   ✓ sample test (1)
     ✓ should add numbers 3ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  22:49:39
   Duration  185ms (transform 27ms, setup 0ms, import 40ms, tests 5ms, environment 0ms)

 PASS  Waiting for file changes...
       press h to show help, press q to quit
```

## 4. package.json 예시 {#session-04}

```json
{
  "name": "nodejs-workbook",
  "version": "1.0.0",
  "description": "",
  "private": true,
  "engines": {
    "node": "^20.19.0 || ^22.13.0 || >=24"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm run test:run",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module",
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@eslint/json": "^2.0.1",
    "@types/node": "^26.1.2",
    "@vitest/coverage-v8": "^4.1.10",
    "eslint": "^10.8.0",
    "eslint-config-prettier": "^10.1.8",
    "globals": "^17.8.0",
    "prettier": "^3.9.6",
    "tsx": "^4.23.1",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.65.0",
    "vitest": "^4.1.10"
  }
}
```

## 5. tsconfig.json 예시(TypeScript 6.0 + tsx) {#session-05}

```jsonc
{
  "compilerOptions": {
    // ------------------------------------------------------------
    // Language / Runtime
    // ------------------------------------------------------------

    // TypeScript가 출력 대상으로 가정할 JavaScript 문법 수준입니다.
    // Node.js 18 이상에서는 ES2022가 안정적인 기준입니다.
    //
    // noEmit: true이므로 실제 JavaScript 파일을 출력하지는 않지만,
    // 사용할 수 있는 문법과 일부 타입 추론 기준에 영향을 줍니다.
    "target": "es2022",

    // TypeScript가 기본으로 제공할 JavaScript 표준 라이브러리 타입입니다.
    // Promise, Map, Set, Array.at, Object.hasOwn 등의 ES2022 API 타입을 포함합니다.
    //
    // DOM을 포함하지 않았으므로 window, document 같은 브라우저 전역 타입은
    // 기본적으로 사용할 수 없습니다.
    "lib": ["es2022"],

    // import/export 구문을 특정 모듈 형식으로 강제 변환하지 않고
    // 가능한 한 원본 형태로 유지합니다.
    //
    // tsx, esbuild, tsup 같은 외부 변환 도구가 실제 모듈 변환과
    // 실행을 담당하는 환경에 적합합니다.
    "module": "preserve",

    // 번들러 및 tsx 계열의 모듈 해석 규칙을 사용합니다.
    //
    // 상대 경로 import에서 파일 확장자를 생략할 수 있으며,
    // package.json의 exports/imports도 현대적인 방식으로 해석합니다.
    //
    // 순수 Node.js ESM 규칙을 엄격히 검사하려면
    // module과 moduleResolution을 nodenext로 설정해야 합니다.
    "moduleResolution": "bundler",

    // 자동으로 포함할 전역 타입 패키지를 제한합니다.
    //
    // @types/node가 제공하는 process, Buffer, NodeJS 네임스페이스와
    // node:fs, node:path 같은 Node.js 내장 모듈 타입을 활성화합니다.
    //
    // 테스트도 같은 tsconfig에서 검사하지만 Vitest API를 명시적으로
    // import하므로 별도의 Vitest 전역 타입은 포함하지 않습니다.
    "types": ["node"],

    // ------------------------------------------------------------
    // Path Aliases
    // ------------------------------------------------------------

    // 긴 상대 경로 대신 별칭 기반 import를 사용할 수 있게 합니다.
    //
    // 예:
    // import { logger } from "@utils/logger";
    //
    // TypeScript 6에서는 baseUrl 대신 paths 대상 경로에
    // ./src를 직접 포함하는 구성을 사용할 수 있습니다.
    //
    // 주의:
    // paths는 TypeScript의 타입 검사 및 모듈 탐색을 위한 설정입니다.
    // tsc가 import 문자열 자체를 상대 경로로 변환해 주지는 않습니다.
    // 현재처럼 tsx로 실행하면 tsconfig paths를 해석할 수 있습니다.
    "paths": {
      // @app/server
      // → ./src/app/server.ts
      "@app/*": ["./src/app/*"],

      // @config/env
      // → ./src/config/env.ts
      "@config/*": ["./src/config/*"],

      // @utils/logger
      // → ./src/utils/logger.ts
      "@utils/*": ["./src/utils/*"],

      // @services/user.service
      // → ./src/services/user.service.ts
      "@services/*": ["./src/services/*"]
    },

    // ------------------------------------------------------------
    // Type Checking
    // ------------------------------------------------------------

    // TypeScript의 주요 엄격 검사 옵션을 한 번에 활성화합니다.
    //
    // 대표적으로 다음 검사가 포함됩니다.
    // - strictNullChecks
    // - noImplicitAny
    // - strictFunctionTypes
    // - strictPropertyInitialization
    // - useUnknownInCatchVariables
    "strict": true,

    // 선택적 프로퍼티의 "미존재"와 명시적인 undefined 할당을 구분합니다.
    //
    // interface User {
    //   nickname?: string;
    // }
    //
    // 활성화 시 다음 코드는 기본적으로 허용되지 않습니다.
    // const user: User = { nickname: undefined };
    //
    // 프로퍼티에 undefined 할당도 허용하려면 다음처럼 작성해야 합니다.
    // nickname?: string | undefined;
    "exactOptionalPropertyTypes": true,

    // 배열 또는 인덱스 시그니처를 통한 접근 결과에
    // undefined 가능성을 포함합니다.
    //
    // const users = ["kim"];
    // const user = users[10];
    // // string | undefined
    //
    // 존재하지 않는 인덱스나 키에 접근하는 런타임 오류를 줄일 수 있습니다.
    "noUncheckedIndexedAccess": true,

    // switch 문의 case에서 break, return, throw 없이
    // 다음 case로 의도치 않게 이어지는 fallthrough를 검사합니다.
    "noFallthroughCasesInSwitch": true,

    // 반환값이 있는 함수에서 일부 코드 경로만 값을 반환하는 경우
    // 컴파일 오류로 처리합니다.
    //
    // 조건문 분기 누락으로 undefined가 반환되는 문제를 방지할 수 있습니다.
    "noImplicitReturns": true,

    // 부모 클래스의 메서드나 프로퍼티를 재정의할 때
    // override 키워드를 명시하도록 요구합니다.
    //
    // 부모 클래스의 API가 변경되었는데도 자식 클래스가
    // 잘못된 재정의를 유지하는 문제를 예방할 수 있습니다.
    "noImplicitOverride": true,

    // ------------------------------------------------------------
    // Module Safety & Interop
    // ------------------------------------------------------------

    // TypeScript가 import/export 구문을 임의로 제거하거나 변환하지 않고
    // 작성한 형태를 최대한 그대로 유지합니다.
    //
    // 타입으로만 사용하는 import는 import type으로 작성해야 합니다.
    //
    // 예:
    // import type { User } from "./user";
    //
    // module: preserve와 함께 사용하면 모듈 동작을 명확하게 유지할 수 있습니다.
    "verbatimModuleSyntax": true,

    // 각 파일이 다른 파일의 타입 정보를 이용한 변환 없이도
    // 독립적으로 안전하게 변환될 수 있는지 검사합니다.
    //
    // tsx와 esbuild처럼 파일 단위 변환을 수행하는 도구와
    // 함께 사용할 때 권장되는 옵션입니다.
    "isolatedModules": true,

    // 실행 목적의 side-effect import가 실제로 해석 가능한지 검사합니다.
    //
    // 예:
    // import "./initialize";
    //
    // 오타가 있거나 존재하지 않는 파일을 side-effect import한 경우
    // 이를 놓치지 않도록 도와줍니다.
    "noUncheckedSideEffectImports": true,

    // import 또는 export가 없는 파일도 항상 모듈로 취급합니다.
    //
    // 파일이 전역 스크립트로 간주되어 다른 파일의 전역 변수와
    // 충돌하는 문제를 방지할 수 있습니다.
    "moduleDetection": "force",

    // import 경로에 .ts 확장자를 직접 작성해야 할 때 활성화합니다.
    //
    // 예:
    // import { logger } from "./logger.ts";
    //
    // 현재 설정은 noEmit: true이므로 사용할 수 있습니다.
    // 확장자를 생략하는 스타일이라면 활성화할 필요가 없습니다.
    // "allowImportingTsExtensions": true,

    // ------------------------------------------------------------
    // Output & Build
    // ------------------------------------------------------------

    // TypeScript가 JavaScript, source map, declaration 파일을
    // 생성하지 않도록 설정합니다.
    //
    // 이 프로젝트에서는 다음과 같이 역할을 분리합니다.
    // - tsx: TypeScript 실행
    // - tsc: 정적 타입 검사
    //
    // 타입 검사는 다음 명령으로 수행할 수 있습니다.
    // tsc --noEmit
    "noEmit": true,

    // node_modules에 포함된 외부 라이브러리의 .d.ts 내부 검사를 생략합니다.
    //
    // 프로젝트 코드에서 해당 라이브러리 타입을 사용하는 부분은 검사하지만,
    // 라이브러리 선언 파일 자체의 타입 오류는 건너뜁니다.
    //
    // 타입 검사 속도를 높이고 패키지 간 타입 충돌 영향을 줄일 수 있습니다.
    "skipLibCheck": true,

    // 이전 타입 검사 결과를 캐시하여
    // 이후 tsc 실행 속도를 향상합니다.
    //
    // CI처럼 매번 깨끗한 환경에서 실행되는 경우보다
    // 로컬 개발 환경에서 효과가 큽니다.
    "incremental": true,

    // incremental 타입 검사 캐시 파일의 저장 위치입니다.
    //
    // 소스 디렉터리나 프로젝트 루트에 캐시 파일이 노출되지 않도록
    // node_modules 내부 캐시 디렉터리에 저장합니다.
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.tsbuildinfo"
  },

  // ------------------------------------------------------------
  // Files
  // ------------------------------------------------------------

  // TypeScript 타입 검사 대상입니다.
  //
  // src와 tests 디렉터리 아래의 모든 .ts 파일을 포함합니다.
  // .tsx 파일을 사용한다면 "src/**/*.tsx"도 추가해야 합니다.
  "include": ["src/**/*.ts", "tests/**/*.ts"],

  // 타입 검사 대상에서 제외할 디렉터리입니다.
  //
  // include 범위가 src로 제한되어 있으므로 일부 항목은 중복이지만,
  // 프로젝트 의도를 명시하고 향후 include 범위가 바뀔 때를 대비할 수 있습니다.
  "exclude": [
    // 설치된 외부 패키지
    "node_modules",

    // 빌드 결과물
    "dist",

    // 테스트 커버리지 결과물
    "coverage"
  ]
}
```
