---
layout: post
title: "01. Vitest 4로 Node.js 테스트 환경 구축하기"
description: "npm workspace로 구성한 nodejs-workbook에서 루트의 Vitest 4를 공유하고, vitest-basics에 테스트 환경을 설정하여 첫 테스트를 실행하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. Vitest 개요와 실습 환경 이해"
  - id: session-02
    title: "2. 프로젝트 기본 환경 구성"
  - id: session-03
    title: "3. Vitest 설치 및 기본 설정"
  - id: session-04
    title: "4. 첫 테스트 작성 및 실행"
---

## 1. Vitest 개요와 실습 환경 이해 {#session-01}

Vitest는 Vite를 기반으로 동작하는 테스트 러너입니다.  
Vite의 모듈 변환 방식을 활용하며, Vite를 사용하지 않는 Node.js 백엔드 프로젝트에서도 사용할 수 있습니다.  

### 🟦 Vitest의 핵심 특징

1. **빠른 실행 속도**

   Watch 모드에서는 소스 코드가 변경되면 관련 테스트를 찾아 다시 실행하므로 빠르게 결과를 확인할 수 있습니다.  

2. **ESM 지원**

   별도의 복잡한 모듈 설정 없이 최신 JavaScript의 ESM 문법을 사용할 수 있습니다.  

3. **Vite 기반 공유 설정**

   Vite 프로젝트에서는 `vite.config.ts`의 플러그인과 모듈 변환 설정을 테스트에서도 공유할 수 있어 설정을 일관되게 관리할 수 있습니다.  
   Vite를 사용하지 않는 프로젝트에서는 별도의 `vitest.config.ts`를 작성할 수 있습니다.  

> Vite는 프론트엔드 프로젝트의 개발 서버와 빌드 과정을 담당하는 도구로, React나 Vue 같은 프로젝트에서 자주 사용됩니다.


4. **Jest API와의 호환성**

   `describe`, `it`, `expect` 등 널리 사용하는 Jest API와 호환되므로 기존 테스트를 비교적 쉽게 이전할 수 있습니다.  
   다만 모든 Jest 기능과 완전히 같지는 않으므로 이전할 때는 차이점을 확인해야 합니다.  

### 🟦 Jest와 Vitest 비교

Vitest는 특히 ESM 기반 Node.js 프로젝트에서 편리하게 사용할 수 있습니다.  

| 항목 | Jest | Vitest |
| --- | --- | --- |
| 핵심 구조 | 독립적인 테스트 런타임 | Vite 기반 모듈 변환과 테스트 런타임 |
| 코드 변환 | 프로젝트에 맞는 변환기 설정이 필요할 수 있음 | TypeScript와 ESM 문법 변환을 기본 지원 |
| TypeScript 지원 | 변환기 또는 별도 설정이 필요할 수 있음 | 문법 변환을 기본 지원하며 타입 검사는 별도로 실행 |
| 설정 관리 | `jest.config.js` 등으로 관리 | `vitest.config.ts` 또는 `vite.config.ts`로 관리 |
| Watch 모드 | 변경 사항을 감지하여 테스트 재실행 | 관련 테스트를 찾아 다시 실행 |
| 특화 기능 | 폭넓은 생태계 | 브라우저 모드와 UI 대시보드 |

### 🟦 실습 프로젝트 구조 이해

```text
nodejs-workbook/
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ prisma-basics/
├─ redis-basics/
├─ src/
├─ tests/
└─ vitest-basics/
   ├─ package-lock.json
   ├─ package.json
   ├─ tsconfig.json
   ├─ vitest.config.ts
   ├─ src/ch01/math.ts
   └─ tests/ch01/math.test.ts
```

1. **루트 프로젝트에서 공통 개발 도구 관리**

   `nodejs-workbook` 루트에는 TypeScript와 Vitest 같은 공통 개발 도구를 설치합니다.  
   `vitest-basics`에서는 루트에 설치된 도구를 사용하므로 같은 패키지를 다시 설치하지 않습니다.  

2. **Vitest 실습 코드 분리**

   Vitest 학습용 소스 코드와 테스트 코드는 `vitest-basics`에 모아 다른 하위 프로젝트의 코드와 구분합니다.  
   `vitest.config.ts`와 테스트 실행 스크립트도 이 디렉터리에서 관리합니다.  

## 2. 프로젝트 기본 환경 구성 {#session-02}

### 🟦 프로젝트 초기화하기

```bash
# 1. nodejs-workbook 루트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook

# 2. Vitest 실습 디렉터리와 package.json을 생성합니다.
mkdir vitest-basics
cd vitest-basics
npm init -y

# 3. 루트에 설치된 TypeScript로 tsconfig.json을 생성합니다.
npx tsc --init
```

루트 `package.json`은 npm `workspaces`에 `vitest-basics`를 등록하여 하위 프로젝트로 관리합니다.  

```jsonc
{
  // 루트 package.json에서 Vitest 실습에 해당하는 항목 표시합니다.
  "workspaces": [
    "prisma-basics",
    "redis-basics",
    "vitest-basics"
  ]
}
```

`workspaces`에 디렉터리를 등록한 시점에 해당 디렉터리가 없으면 `npm list`에서 `UNMET DEPENDENCY`가 표시될 수 있습니다.  
앞의 명령으로 `vitest-basics`와 `package.json`을 만든 뒤에는 루트로 돌아가 `npm install`을 한 번 실행합니다.  

```bash
# 루트로 돌아가 새 workspace와 package-lock.json 상태를 동기화합니다.
cd ..
npm install
```

이 명령을 실행하면 npm이 새로 만든 `vitest-basics`를 인식하고 루트 `node_modules`와 `package-lock.json`에 workspace 연결을 반영합니다.  

`tsconfig.json`은 다음과 같이 작성합니다.  

```jsonc
{
  // 루트 프로젝트의 공통 TypeScript 설정을 가져옵니다.
  "extends": "../tsconfig.json",
  "compilerOptions": {
    // Node.js와 Vitest 전역 API의 타입을 함께 불러옵니다.
    "types": ["node", "vitest/globals"],
    // 루트 tsconfig.json의 경로 별칭을 이 프로젝트에서는 사용하지 않습니다.
    "paths": {},
    // 이 하위 프로젝트의 타입 검사 캐시를 별도로 저장합니다.
    "tsBuildInfoFile": "./node_modules/.cache/tsconfig.tsbuildinfo"
  },
  // Vitest 설정, 실습 소스와 테스트 코드를 모두 타입 검사합니다.
  "include": ["vitest.config.ts", "src/**/*.ts", "tests/**/*.ts"],
  // 의존성, 빌드 결과물과 커버리지 결과를 검사 대상에서 제외합니다.
  "exclude": ["node_modules", "dist", "coverage"]
}
```

`package.json`에는 테스트 실행 목적에 맞는 스크립트를 등록합니다.  

```json
{
  "name": "vitest-basics",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

`vitest-basics`는 루트 TypeScript 설정을 상속하면서 실습 소스와 테스트 코드만 별도로 검사합니다.  
또한 하위 프로젝트의 `package.json` 스크립트를 통해 Watch 모드, UI 모드, 한 번만 실행하는 모드와 커버리지 측정을 구분합니다.  

## 3. Vitest 설치 및 기본 설정 {#session-03}

Vitest는 Vite 프로젝트의 `vite.config.ts`를 읽을 수 있으며, 별도의 테스트 설정이 필요하면 `vitest.config.ts`를 사용할 수 있습니다.  
이 실습에서는 테스트 전용 설정 파일을 만들어 Node.js 테스트 환경을 구성합니다.  

### 🟦 패키지 설치

현재 `nodejs-workbook`에는 Vitest 4.1.10, V8 커버리지 패키지와 UI 패키지가 루트 개발 의존성으로 설치되어 있습니다.  
따라서 `vitest-basics`에는 같은 패키지를 다시 설치하지 않고 루트의 공통 개발 도구를 사용합니다.  

```bash
# nodejs-workbook 루트로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook

# Vitest, V8 커버리지와 UI 패키지를 루트 개발 의존성으로 설치합니다.
npm install -D vitest @vitest/coverage-v8 @vitest/ui

# 루트에 설치된 Vitest 관련 패키지를 확인합니다.
npm list vitest @vitest/coverage-v8 @vitest/ui --depth=0
```

- `vitest`: 테스트 실행, 파일 감시, 모듈 로딩, Mock과 Assertion을 담당하는 핵심 패키지입니다.  
- `@vitest/coverage-v8`: V8 엔진을 사용하여 코드 커버리지를 측정합니다.  
- `@vitest/ui`: 브라우저에서 테스트 상태를 확인하고 관리할 수 있는 UI 대시보드입니다.  

### 🟦 vitest.config.ts 작성하기

`vitest-basics` 루트에 `vitest.config.ts` 파일을 생성합니다.  
Vitest는 이 테스트 전용 설정 파일을 읽어 실행 환경과 테스트 파일의 위치를 결정합니다.  

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // describe, it, expect 등을 import 없이 전역으로 사용합니다.
    globals: true,

    // 테스트를 Node.js 런타임에서 실행합니다.
    environment: 'node',

    // V8 엔진을 사용하여 코드 커버리지를 수집합니다.
    coverage: {
      provider: 'v8',
      // 콘솔, JSON 파일과 HTML 문서로 결과를 생성합니다.
      reporter: ['text', 'json', 'html'],
      // 실행되지 않은 소스 파일도 전체 커버리지 계산에 포함합니다.
      include: ['src/**/*.ts'],
      // 테스트 코드는 커버리지 측정 대상에서 제외합니다.
      exclude: ['tests/**', '**/*.test.ts'],
    },

    // tests 디렉터리 아래의 .test.ts 파일만 실행합니다.
    include: ['tests/**/*.test.ts'],
  },
});
```

### 🟦 globals: true 사용 시 주의 사항

`vitest.config.ts`에서 `globals: true`를 설정하면 `describe`, `it`, `expect`를 전역 API로 사용할 수 있습니다.  

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 테스트 API를 import하지 않고 전역에서 사용할 수 있게 합니다.
    globals: true,
  },
});
```

따라서 테스트 파일에서 다음 import를 생략할 수 있습니다.  

```typescript
import { describe, expect, it } from 'vitest';
```

`globals: true`를 적용하면 바로 다음과 같이 테스트를 작성할 수 있습니다.  

```typescript
// describe, it, expect를 별도로 import하지 않습니다.
describe('math', () => {
  it('숫자를 더합니다', () => {
    expect(1 + 1).toBe(2);
  });
});
```

다만 `globals: true`는 Vitest가 테스트를 실행할 때 전역 API를 제공하는 런타임 설정입니다.  
TypeScript가 해당 전역 API의 타입까지 자동으로 인식하는 것은 아닙니다.  
TypeScript 프로젝트에서는 `tsconfig.json`의 `types`에 `vitest/globals`를 추가해야 합니다.  

```jsonc
{
  "compilerOptions": {
    // describe, it, expect 등 Vitest 전역 API의 타입을 불러옵니다.
    "types": ["vitest/globals"]
  }
}
```

- `globals: true`: 테스트 실행 시 `describe`, `it`, `expect`를 import 없이 사용할 수 있게 합니다.  
- `"types": ["vitest/globals"]`: TypeScript가 해당 전역 API의 타입을 인식하게 합니다.  

현재 `math.test.ts`처럼 테스트 API를 명시적으로 import하는 방식도 그대로 사용할 수 있습니다.  

### 🟦 커버리지 설정 이해하기

`coverage.provider`의 `v8`은 Node.js의 V8 엔진을 사용하여 실행된 코드 범위를 측정합니다.  
`reporter`는 터미널용 텍스트, JSON 파일과 HTML 문서로 결과를 생성하도록 지정합니다.  
`coverage.include`에 `src/**/*.ts`를 지정하면 테스트에서 불러오지 않은 소스 파일도 0%로 집계되어 전체 코드 기준의 커버리지를 확인할 수 있습니다.  
반면 `coverage.exclude`는 테스트 코드 자체를 커버리지 대상에서 제외합니다.  

## 4. 첫 테스트 작성 및 실행 {#session-04}

### 🟦 TypeScript 소스 코드 작성하기

먼저 `src/ch01/math.ts`에 두 숫자를 더하는 함수를 작성합니다.  

```typescript
// src/ch01/math.ts
// 두 숫자를 받아 더한 결과를 반환합니다.
export const add = (a: number, b: number) => a + b;
```

다음으로 `tests/ch01/math.test.ts`에 테스트 코드를 작성합니다.  

```typescript
// tests/ch01/math.test.ts
import { describe, expect, it } from 'vitest';
import { add } from '../../src/ch01/math';

// add 함수의 동작을 하나의 테스트 그룹으로 묶습니다.
describe('Math Service', () => {
  it('1 더하기 2는 3이어야 한다', () => {
    const result = add(1, 2);

    // 실제 반환값이 기대한 값과 같은지 확인합니다.
    expect(result).toBe(3);
  });
});
```

- `describe`: 여러 테스트를 하나의 그룹으로 묶습니다.  
- `it`: 하나의 테스트 케이스를 정의합니다.  
- `expect`: 실행 결과가 기대한 값과 일치하는지 검증합니다.  

### 🟦 테스트 실행하기: CLI 모드와 UI 모드

`npm run` 계열 명령은 `node_modules/.bin` 디렉터리를 실행 경로에 자동으로 추가합니다.  
따라서 프로젝트에 설치한 Vitest는 `npm` 스크립트로 실행하는 방식을 권장합니다.  
루트에 설치된 Vitest도 `vitest-basics`의 npm 스크립트에서 사용할 수 있습니다.  

#### 🔷 1) CLI 모드 실행

```bash
# vitest-basics로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics

# 하위 프로젝트의 package.json에 등록한 test 스크립트를 실행합니다.
npm test

# 루트에서는 workspace를 지정하여 같은 스크립트를 실행할 수 있습니다.
# npm test --workspace vitest-basics
```

개발 환경의 대화형 터미널에서는 기본적으로 Watch 모드로 실행됩니다.  
설정한 `tests` 디렉터리의 테스트 파일을 찾아 실행하며, 소스 코드나 테스트 파일을 수정하면 관련 테스트를 다시 실행합니다.  
CI 또는 비대화형 환경에서는 한 번만 실행하고 종료합니다.  

특정 파일만 테스트하려면 다음과 같이 파일 경로를 전달합니다.  

```bash
# 지정한 테스트 파일만 실행합니다.
npm test tests/ch01/math.test.ts
```

한 번만 테스트를 실행하거나 코드 커버리지를 확인할 때는 다음 스크립트를 사용합니다.  

```bash
# 테스트를 한 번 실행하고 종료합니다.
npm run test:run

# 테스트를 한 번 실행하고 V8 코드 커버리지 결과를 생성합니다.
npm run test:coverage
```

#### 🔷 2) UI 모드 실행

브라우저 기반 대시보드에서도 테스트 결과를 확인할 수 있습니다.  

```bash
# vitest-basics로 이동합니다.
cd /home/ubuntu/blog-workspaces/nodejs-workbook/vitest-basics

# 하위 프로젝트의 package.json에 등록한 test:ui 스크립트를 실행합니다.
npm run test:ui

# 루트에서는 workspace를 지정하여 같은 스크립트를 실행할 수 있습니다.
# npm run test:ui --workspace vitest-basics
```

브라우저가 열리면 테스트 성공과 실패 여부, 실행 시간, 파일 구조와 모듈 그래프를 한눈에 확인할 수 있습니다.  
테스트 규모가 커질수록 전체 구조를 파악하는 데 도움이 됩니다.  
