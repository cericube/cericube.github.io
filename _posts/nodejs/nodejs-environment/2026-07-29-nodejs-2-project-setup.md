---
layout: post
title: "2. 프로젝트 초기화와 ESLint·Prettier 개발 환경 구성"
description: "npm으로 Node.js 프로젝트를 초기화하고 package.json의 구조와 ESM·의존성 설정을 살펴봅니다. ESLint와 Prettier, VS Code 설정을 연동해 코드 검사와 포맷팅을 자동화하는 방법을 정리합니다."
category_id: nodejs-environment
categories: [nodejs, nodejs-environment]
series: nodejs
series_order: 2
ai_assisted: true
toc:
  - id: session-01
    title: "1. 프로젝트 초기화: init과 package.json 구조 이해"
  - id: session-02
    title: "2. ESLint와 Prettier로 코드 품질 관리하기"
  - id: session-03
    title: "3. VSCode 확장과 settings.json 통합"
---

## 1. 프로젝트 초기화: init과 package.json 구조 이해 {#session-01}

### 🟦 프로젝트 폴더 선택

VS Code 상단 메뉴에서 **File →  Open Folder ...**를 선택한 뒤, 다음 프로젝트 폴더를 지정합니다.

```text
/home/ubuntu/blog-workspaces/nodejs-workbook/
```

![alt text](/assets/images/nodejs/nodejs-environment/image-2026-07-29-4.png)
폴더를 선택하면 nodejs-workbook 프로젝트가 생성됩니다.  
이제 탐색기(Explorer) 영역에서 프로젝트의 파일과 디렉터리 구조를 확인할 수 있습니다.

### 🟦 Node.js 프로젝트 초기화

```text
ubuntu:~/blog-workspaces/nodejs-workbook$ npm init -y
Wrote to /home/ubuntu/blog-workspaces/nodejs-workbook/package.json:
```

이 명령을 실행하면 프로젝트의 루트 디렉터리에 package.json 파일이 생성됩니다.  
package.json은 Node.js 생태계에서 프로젝트의 정체성 카드이자 통합 설정 파일 역할을 합니다.

이 파일에는 다음과 같은 정보가 담깁니다.

- 프로젝트의 이름(name)
- 현재 버전(version)
- 실행 가능한 명령어(scripts)
- 프로젝트에 필요한 의존성(dependencies)

즉, package.json은 프로젝트의 기본 정보와 실행 환경을 한곳에서 관리하는 핵심 파일입니다.

### 🟦 package.json 기본 구조 예시

```json
{
  "name": "nodejs-workbook",
  "version": "1.0.0",
  "description": "Node.js + TypeScript 실무형 개발환경 예제",
  "main": "dist/index.js",
  "scripts": {
    "dev": "node --watch dist/index.js",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src --ext .ts,.js",
    "format": "prettier --write
  },
  "author": "",
  "license": "MIT",
  "type": "module"
}
```

#### ✔️ "type": "module" — ESM 사용 설정

ESM(ECMAScript Modules)은 JavaScript의 표준 모듈 시스템으로, import와 export 문법을 사용해 모듈을 불러오거나 내보냅니다.  
package.json에 다음 설정을 추가하면 Node.js는 해당 패키지 내부의 .js 파일을 ES 모듈로 해석합니다.

```json
{
  "type": "module"
}
```

따라서 브라우저 JavaScript와 유사한 방식으로 import와 export 문법을 사용할 수 있습니다.

```typescript
// ESM 방식
import fs from "node:fs";
import path from "node:path";

console.log("ESM 기반 Node.js 환경입니다.");
```

모듈 형식 정리

- "type": "module": .js 파일을 ESM으로 해석
- "type": "commonjs" 또는 "type" 생략: .js 파일을 CommonJS로 해석
- .mjs: "type" 설정과 관계없이 ESM으로 해석
- .cjs: "type" 설정과 관계없이 CommonJS로 해석

#### ✔️ scripts - 개발 생산성을 높이는 명령어 관리 기능

scripts는 package.json에서 제공하는 명령어 매핑 기능입니다.  
자주 사용하는 긴 명령어를 짧은 이름으로 등록해 두면, 매번 전체 명령어를 입력하거나 기억하지 않아도 됩니다.  
또한 팀원 모두가 동일한 명령어를 사용하게 되므로 프로젝트의 실행, 빌드, 검사 과정을 일관되게 관리할 수 있습니다.

예를 들어 package.json에 다음과 같이 스크립트를 정의할 수 있습니다.

```json
{
  "scripts": {
    "dev": "node --watch dist/index.js",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "format": "prettier --write ."
    }
}
```

예를 들어 다음과 같은 스크립트를 정의했다고 가정해 보겠습니다.

- `npm run dev`
  - `dist/index.js`를 실행하고, 파일이 변경되면 자동으로 다시 실행합니다.

- `npm run build`
  - `tsconfig.json` 설정을 기준으로 TypeScript 코드를 컴파일합니다.

- `npm run lint`
  - ESLint를 사용해 `src` 디렉터리의 코드를 검사합니다.

- `npm run format`
  - Prettier를 사용해 프로젝트의 코드 스타일을 일관되게 정리합니다.

예를 들어 다음 명령을 실행하면 `scripts`에 등록된 `build` 스크립트가 실행됩니다.

```bash
npm run build
```

#### ✔️ `dependencies`와 `devDependencies`

Node.js 프로젝트에서 사용하는 패키지는 용도에 따라 `dependencies`와 `devDependencies`로 구분합니다.  
애플리케이션이 실제로 실행될 때 필요한 패키지는 `dependencies`에 등록하고, 개발·빌드·테스트 과정에서만 사용하는 도구는 `devDependencies`에 등록합니다.  
ESLint, Prettier, TypeScript는 대표적인 개발 도구이므로 `--save-dev` 옵션으로 설치합니다.

```bash
npm install --save-dev typescript eslint prettier
```

`--save-dev`는 다음과 같이 `-D`로 줄여 사용할 수도 있습니다.

```bash
npm install -D typescript eslint prettier
```

설치가 완료되면 `package.json`의 `devDependencies` 항목에 패키지 정보가 자동으로 추가됩니다.

 ▸ `dependencies`

애플리케이션이 실제로 실행될 때 필요한 패키지입니다.  
예를 들어 Express와 같은 웹 프레임워크나 데이터베이스 드라이버는 일반적으로 `dependencies`에 등록합니다.

▸ `devDependencies`
개발, 빌드, 테스트, 코드 검사, 코드 포맷팅 과정에서만 사용하는 패키지입니다.  
대표적인 예시는 다음과 같습니다.

- TypeScript
- ESLint
- Prettier
- Jest
- Vite
- Webpack

```bash
npm install -D typescript eslint prettier
```

## 2. ESLint와 Prettier로 코드 품질 관리하기 {#session-02}

Node.js와 TypeScript 프로젝트에서 코드 품질과 코드 스타일을 일관되게 유지하려면 ESLint와 Prettier를 함께 사용하는 것이 일반적입니다.

두 도구는 비슷해 보이지만 담당하는 역할이 다릅니다.

- ESLint는 잠재적인 오류와 잘못된 코드 패턴을 검사하여 코드 품질을 관리합니다.
- Prettier는 들여쓰기, 줄바꿈, 따옴표와 같은 코드 형식을 자동으로 정리합니다.

최신 ESLint에서는 Flat Config가 기본 설정 방식으로 사용됩니다.

### 🟦 1단계 - ESLint 자동 초기화 (npx eslint --init)

ESLint v9부터는 **Flat Config**가 기본 설정 방식(Default Configuration Format)으로 채택되었습니다.  
프로젝트 루트 디렉터리에서 다음 명령을 실행합니다.

```bash
npx eslint --init
```

이 명령을 실행하면 ESLint의 공식 설정 생성기인 `@eslint/create-config`가 실행됩니다.  
생성기는 프로젝트 환경에 맞는 ESLint 설정을 만들기 위해 몇 가지 질문을 순서대로 표시하며, 응답한 내용에 따라 필요한 패키지를 설치하고 `eslint.config.js`(또는 환경에 맞는 설정 파일)를 생성합니다.

#### ✔️ 질문 예시

실제로 실행하면 다음과 같은 과정이 진행됩니다:

1. What do you want to lint?
   → JavaScript, JSON 등 검사할 파일 형식을 선택
2. How would you like to use ESLint?
   → 문법 오류와 문제만 검사할지, 스타일 규칙까지 포함할지 선택 (일반적으로 “problems” 선택)
3. What type of modules does your project use?
   → ESM ("type": "module") 환경 선택
4. Does your project use TypeScript?
   → Yes 선택 → TypeScript 린팅 자동 구성
5. Where does your code run?
   → browser, node 등 환경 선택
6. Which language do you want your configuration file be written in?
   → JavaScript

모든 질문에 답하면 ESLint는 선택한 환경에 맞는 패키지를 설치하고, 프로젝트 루트에 Flat Config 기반의 설정 파일(eslint.config.mjs)을 생성합니다.  
이렇게 생성된 설정은 프로젝트의 기본 출발점이며, 이후 TypeScript 규칙이나 Prettier 연동 등 프로젝트에 필요한 옵션을 추가하여 사용할 수 있습니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-2026-07-29-1.png)

```bash
ubuntu:~/blog-workspaces/nodejs-workbook$ npm list
nodejs-workbook@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook
├── @eslint/js@10.0.1
├── @eslint/json@2.0.1
├── eslint-config-prettier@10.1.8
├── eslint@10.8.0
├── globals@17.8.0
├── prettier@3.9.6
└── typescript-eslint@8.65.0
```

### 🟦 2단계 - Prettier 설치 및 스타일 설정

ESLint와 Prettier는 서로 다른 역할을 담당합니다.

- ESLint: 잠재적인 오류와 잘못된 코드 패턴을 검사하여 코드 품질을 관리합니다.
- Prettier: 들여쓰기, 따옴표, 줄바꿈과 같은 코드 형식을 일관되게 정리합니다.

```bash
npm install -D prettier eslint-config-prettier
```

eslint-config-prettier는 Prettier와 충돌할 수 있는 ESLint의 서식 관련 규칙을 비활성화합니다.

> Prettier 자체가 ESLint 안에서 실행되는 것은 아닙니다. ESLint는 코드 품질을 검사하고, Prettier는 별도의 포맷팅 도구로 실행하는 방식이 일반적입니다.

#### ✔️ .prettierrc 파일 생성

프로젝트 루트 디렉터리에 .prettierrc 파일을 생성하고 다음 내용을 작성합니다.

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

이 설정은 프로젝트 전체에서 동일한 코드 스타일을 유지하기 위한 포맷팅 기준으로 사용됩니다.

| 옵션 | 의미 |
| --- | --- |
| `semi` | 세미콜론 사용 |
| `singleQuote` | 문자열에 작은따옴표 사용 |
| `tabWidth` | 들여쓰기 2칸 |
| `trailingComma` | 마지막 요소에도 쉼표 사용 |
| `printWidth` | 100자에서 줄바꿈 |
| `endOfLine` | 줄바꿈 문자를 LF로 통일 |

#### ✔️ 포맷팅 제외 파일 설정

필요하다면 프로젝트 루트에 .prettierignore 파일을 생성하여 포맷팅 대상에서 제외할 파일과 디렉터리를 지정할 수 있습니다.

```text
node_modules
dist
coverage
*.min.js
```

빌드 결과물이나 외부 패키지처럼 직접 관리하지 않는 파일은 Prettier 검사 대상에서 제외하는 것이 좋습니다

### 🟦 3단계 - ESLint와 Prettier 충돌 방지

- ESLint는 잠재적인 오류와 잘못된 코드 패턴을 검사하여 코드 품질을 관리합니다.
- Prettier는 코드의 형식을 자동으로 정리하여 일관된 스타일을 유지합니다.

두 도구는 목적이 다르지만, ESLint 설정에도 들여쓰기나 따옴표처럼 코드 형식과 관련된 규칙이 포함될 수 있습니다.  
이 경우 Prettier가 자동으로 정리한 코드를 ESLint가 다시 스타일 오류로 판단하는 충돌이 발생할 수 있습니다.

이러한 충돌을 방지하기 위해 eslint-config-prettier를 사용합니다.  
eslint-config-prettier는 Prettier와 충돌하거나 함께 사용할 필요가 없는 ESLint의 서식 관련 규칙을 비활성화합니다.

#### ✔️ 왜 배열의 마지막에 추가해야 할까?

ESLint Flat Config는 설정 배열을 앞에서부터 순서대로 적용합니다.  
동일한 파일에 여러 설정이 적용되고 같은 규칙이 중복으로 정의된 경우, 일반적으로 뒤에 있는 설정이 앞의 설정을 덮어씁니다.

따라서 `eslint-config-prettier`를 마지막에 배치해야 앞에서 활성화된 서식 관련 ESLint 규칙을 최종적으로 비활성화할 수 있습니다.  
설정 적용 순서는 다음과 같이 구성할 수 있습니다.

```text
1. JavaScript 권장 규칙 적용
2. TypeScript 권장 규칙 적용
3. 프로젝트별 사용자 규칙 적용
4. Prettier와 충돌하는 서식 규칙 비활성화
```

#### ✔️ 통합 eslint.config.mjs 예시

```javascript
import js from '@eslint/js';
import json from '@eslint/json';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  /**
   * --------------------------------------------------------------------
   * 1. 전역 무시 패턴
   * --------------------------------------------------------------------
   *
   * ESLint가 검사하지 않을 빌드 산출물과 자동 생성 파일을 지정합니다.
   *
   * `globalIgnores()`는 파일이나 디렉터리를 ESLint의 전체 검사 대상에서
   * 제외할 때 사용하는 Flat Config 전용 헬퍼 함수입니다.
   *
   * `node_modules`와 `.git`은 ESLint가 기본적으로 제외하지만,
   * 설정 의도를 명확하게 보여주기 위해 필요에 따라 작성할 수 있습니다.
   */
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/*.log',
  ]),

  /**
   * --------------------------------------------------------------------
   * 2. JavaScript 설정
   * --------------------------------------------------------------------
   *
   * ESLint 설정 파일이나 프로젝트 내부의 JavaScript 파일을 검사합니다.
   *
   * JavaScript 파일에는 ESLint 공식 권장 규칙을 적용하고,
   * Node.js 전역 변수를 사용할 수 있도록 설정합니다.
   */
  {
    files: ['**/*.{js,mjs}'],

    extends: [js.configs.recommended],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.node,
      },
    },
  },

  /**
   * --------------------------------------------------------------------
   * 3. CommonJS JavaScript 설정
   * --------------------------------------------------------------------
   *
   * `.cjs` 파일은 CommonJS 모듈로 해석합니다.
   *
   * `require`, `module.exports`와 같은 CommonJS 문법을 사용하는 파일에
   * `sourceType: 'commonjs'`를 적용합니다.
   */
  {
    files: ['**/*.cjs'],

    extends: [js.configs.recommended],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',

      globals: {
        ...globals.node,
      },
    },
  },

  /**
   * --------------------------------------------------------------------
   * 4. TypeScript ESM 설정
   * --------------------------------------------------------------------
   *
   * `.ts`와 `.mts` 파일에 TypeScript 권장 규칙을 적용합니다.
   *
   * `recommendedTypeChecked`는 TypeScript 타입 정보를 활용하여
   * Promise 오용, 잘못된 타입 연산 등 일반적인 정적 분석만으로
   * 발견하기 어려운 문제까지 검사합니다.
   *
   * `projectService: true`를 설정하면 typescript-eslint가
   * 프로젝트의 tsconfig.json을 기준으로 타입 정보를 불러옵니다.
   */
  {
    files: ['**/*.{ts,mts}'],

    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },

      globals: {
        ...globals.node,
      },
    },
  },

  /**
   * --------------------------------------------------------------------
   * 5. TypeScript CommonJS 설정
   * --------------------------------------------------------------------
   *
   * `.cts` 파일은 TypeScript 기반 CommonJS 모듈로 해석합니다.
   */
  {
    files: ['**/*.cts'],

    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',

      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },

      globals: {
        ...globals.node,
      },
    },
  },

  /**
   * --------------------------------------------------------------------
   * 6. JSON 및 JSONC 파일 설정
   * --------------------------------------------------------------------
   *
   * JSON 계열 파일은 JavaScript나 TypeScript가 아니므로
   * @eslint/json에서 제공하는 전용 language를 사용합니다.
   *
   * `json/recommended` 설정을 통해 중복 키, 빈 키,
   * 안전하지 않은 값 등의 문제를 검사합니다.
   *
   * 일반 JSON 파일에는 json/json을 적용합니다. 주석을 허용하는
   * tsconfig 계열 파일에는 json/jsonc를 별도로 적용합니다.
   *
   * package-lock.json은 npm이 자동으로 생성하고 관리하므로 제외합니다.
   */
  {
    files: ['**/*.json'],
    ignores: ['**/package-lock.json', '**/tsconfig*.json'],

    plugins: {
      json,
    },

    language: 'json/json',

    extends: ['json/recommended'],
  },
  {
    files: ['**/tsconfig*.json'],

    plugins: {
      json,
    },

    language: 'json/jsonc',

    extends: ['json/recommended'],
  },

  /**
   * --------------------------------------------------------------------
   * 7. Prettier와 ESLint 규칙 충돌 방지
   * --------------------------------------------------------------------
   *
   * eslint-config-prettier는 Prettier와 충돌할 수 있는
   * ESLint의 포맷 관련 규칙을 비활성화합니다.
   *
   * 앞에서 적용된 설정을 최종적으로 덮어쓸 수 있도록
   * 설정 배열의 마지막에 배치합니다.
   *
   * 실제 코드 포맷팅은 Prettier가 담당하며,
   * eslint-config-prettier는 코드를 직접 포맷팅하지 않습니다.
   */
  eslintConfigPrettier,
]);
```

### 🟦 4단계 - ESLint와 Prettier 실행 스크립트 등록

ESLint와 Prettier는 각각 CLI(Command Line Interface) 명령어를 제공합니다.  
하지만 검사나 포맷팅을 실행할 때마다 긴 명령어를 직접 입력하면 번거롭고, 팀원마다 실행 방식이 달라질 수 있습니다.  
따라서 자주 사용하는 명령어를 `package.json`의 `scripts` 항목에 등록해 두면 더 짧고 일관된 방식으로 실행할 수 있습니다.  

다음은 ESLint와 Prettier를 사용할 때 일반적으로 구성하는 스크립트입니다.

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

```bash
# 프로젝트 전체를 대상으로 ESLint 검사를 실행합니다.
npm run lint

# ESLint 검사를 실행하고, 자동으로 수정할 수 있는 문제를 함께 수정합니다.
npm run lint:fix

# Prettier를 사용해 프로젝트 전체 파일의 형식을 정리합니다.
npm run format

#프로젝트의 파일이 Prettier 규칙을 따르고 있는지 검사합니다.
npm run format:check
```

#### ✔️ package.json 예시

```json
{
  "name": "nodejs-workbook",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@eslint/json": "^2.0.1",
    "eslint": "^10.8.0",
    "eslint-config-prettier": "^10.1.8",
    "globals": "^17.8.0",
    "prettier": "^3.9.6",
    "typescript-eslint": "^8.65.0"
  }
}
```

## 3. VSCode 확장과 settings.json 통합 {#session-03}

프로젝트에 ESLint와 Prettier를 설치하고 설정까지 완료했다면, 이제 두 도구가 VS Code 안에서 자연스럽게 동작하도록 연결해야 합니다.

VS Code 연동을 완료하면 다음과 같은 개발 환경을 구성할 수 있습니다.

- 코드를 작성하는 동안 ESLint 오류와 경고를 실시간으로 확인
- 파일을 저장할 때 ESLint가 수정 가능한 문제를 자동으로 처리
- 파일을 저장할 때 Prettier가 코드 스타일을 자동으로 정리
- 팀원 모두 동일한 에디터 설정과 포맷팅 규칙 사용

즉, 개발자가 매번 린트와 포맷 명령을 직접 실행하지 않아도 저장만으로 기본적인 코드 검사와 포맷팅이 수행되는 환경을 만들 수 있습니다.

### 🟦 확장 설치

🔸 ESLint (Marketplace ID: dbaeumer.vscode-eslint)
프로젝트에 설치된 ESLint를 사용해 코드 오류와 규칙 위반을 실시간으로 표시하고, 저장 시 자동 수정 기능을 제공합니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-2026-07-29-2.png)

🔸 Prettier - Code formatter
프로젝트의 Prettier 설정에 따라 들여쓰기, 따옴표, 세미콜론, 줄바꿈 등을 자동으로 정리합니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-2026-07-29-3.png)

### 🟦 .vscode/settings.json 구성

프로젝트 루트에 .vscode/settings.json 파일을 생성합니다.  

이 파일은 현재 프로젝트에만 적용되는 VS Code 설정입니다.  
Git 저장소에 포함하면 팀원 모두 동일한 에디터 설정을 사용할 수 있습니다.

```jsonc
{
  "terminal.integrated.env.linux": {
    "PATH": "/home/ubuntu/runtimes/node-v24.18.0-linux-x64/bin:${env:PATH}"
  },

  // ===============================================================
  // 1. 저장 시 Prettier 포맷팅 실행
  // ---------------------------------------------------------------
  // 파일을 저장할 때 기본 포맷터로 지정한 Prettier를 실행합니다.
  // ===============================================================
  "editor.formatOnSave": true,

  // ===============================================================
  // 2. 저장 시 ESLint 자동 수정
  // ---------------------------------------------------------------
  // 명시적으로 파일을 저장할 때 ESLint가 자동으로 수정할 수 있는
  // 문제를 처리합니다.
  //
  // "explicit":
  //   Ctrl+S와 같은 명시적 저장 시 실행
  //
  // "always":
  //   명시적 저장뿐 아니라 일부 Auto Save 상황에서도 실행
  // ===============================================================
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },

  // ===============================================================
  // 3. Prettier를 기본 포맷터로 지정
  // ---------------------------------------------------------------
  // 여러 포맷터가 설치되어 있을 때 발생할 수 있는 충돌을 방지합니다.
  // 코드 형식은 Prettier가 담당하고 ESLint는 코드 품질 검사를 담당합니다.
  // ===============================================================
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // ===============================================================
  // 4. 프로젝트에 설정 파일이 있을 때만 Prettier 실행
  // ---------------------------------------------------------------
  // .prettierrc 등의 Prettier 설정 파일이 존재하는 프로젝트에서만
  // Prettier가 동작하도록 제한합니다.
  //
  // 전역 기본값이 아닌 프로젝트에 정의된 포맷팅 규칙을 사용하게 하여
  // 팀원 간 코드 스타일 차이를 줄일 수 있습니다.
  // ===============================================================
  "prettier.requireConfig": true,

  // ===============================================================
  // 5. 프로젝트에 설치된 TypeScript 사용
  // ---------------------------------------------------------------
  // VS Code 내장 TypeScript 대신 node_modules에 설치된
  // 프로젝트 버전의 TypeScript SDK 경로를 지정합니다.
  // ===============================================================
  "typescript.tsdk": "node_modules/typescript/lib",

  // ===============================================================
  // 6. 탐색기에서 불필요한 디렉터리 숨기기
  // ---------------------------------------------------------------
  // 외부 패키지와 빌드 결과물을 VS Code 탐색기에서 숨깁니다.
  //
  // 파일이 삭제되는 것은 아니며 탐색기에서만 보이지 않게 됩니다.
  // ===============================================================
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/coverage": true
  },

  // ===============================================================
  // 7. 검색 대상에서 불필요한 디렉터리 제외
  // ---------------------------------------------------------------
  // VS Code 전체 검색에서 외부 패키지와 빌드 결과물을 제외합니다.
  // ===============================================================
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/coverage": true
  },

  // ===============================================================
  // 8. 기본 들여쓰기 설정
  // ---------------------------------------------------------------
  // VS Code에서 직접 입력할 때 공백 2칸을 사용합니다.
  // .prettierrc의 tabWidth 설정과 동일하게 맞춥니다.
  // ===============================================================
  "editor.tabSize": 2,
  "editor.insertSpaces": true,

  // ===============================================================
  // 9. 불필요한 공백 제거 및 마지막 줄 추가
  // ---------------------------------------------------------------
  // 파일 저장 시 줄 끝의 불필요한 공백을 제거하고,
  // 파일 마지막에 빈 줄 하나를 추가합니다.
  // ===============================================================
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,

  // ===============================================================
  // 10. 파일 이동 시 import 경로 자동 수정
  // ---------------------------------------------------------------
  // TypeScript 또는 JavaScript 파일을 이동하거나 이름을 변경했을 때
  // 해당 파일을 참조하는 import 경로를 자동으로 업데이트합니다.
  // ===============================================================
  "typescript.updateImportsOnFileMove.enabled": "always",
  "javascript.updateImportsOnFileMove.enabled": "always"
}
```
