---
layout: post
title: "07. Vitest와 V8로 테스트 커버리지 측정하기"
description: "Vitest에서 @vitest/coverage-v8을 설정하고, 예제 테스트를 보완하며 V8 커버리지 리포트를 확인하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 07
ai_assisted: true
toc:
  - id: session-01
    title: "1. 테스트 커버리지는 왜 중요한가?"
  - id: session-02
    title: "2. Vitest에서 커버리지 활성화하기: @vitest/coverage-v8 설정"
  - id: session-03
    title: "3. 커버리지 리포트 실습 및 예제"
  - id: session-04
    title: "4. 커버리지 리포트 확인"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/vitest-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 테스트 커버리지는 왜 중요한가? {#session-01}

### 🟦 1. 테스트 커버리지란?

테스트 커버리지(Test Coverage)는 전체 애플리케이션 코드 중 테스트를 통해 실행된 코드의 비율을 의미합니다.  

즉, 작성한 테스트 코드가 실제 애플리케이션의 어느 부분까지 실행하는지를 정량적으로 측정하는 지표입니다.  

### 🟦 2. 주요 커버리지 지표 및 필요한 이유

| 지표 | 설명 |
| --- | --- |
| Statements | 전체 실행 가능 명령문(statement) 중 테스트에서 실행된 명령문의 비율입니다. |
| Branches | `if`, `else`, `switch`, 삼항 연산자 등의 조건 분기 중 테스트한 경로의 비율입니다. |
| Functions | 정의된 함수 또는 메서드 중 테스트에서 호출된 함수의 비율입니다. |
| Lines | 전체 실행 가능 코드 줄 중 테스트에서 실행된 코드 줄의 비율입니다. |

- **QA 및 유지보수**: 테스트하지 않은 사각지대를 찾아 잠재적인 버그를 줄이는 데 도움이 됩니다.
- **리팩터링 자신감**: 높은 커버리지는 코드 구조를 변경할 때 기존 로직의 문제를 더 빨리 발견할 수 있게 돕습니다.
- **협업 기준**: 팀에서 최소 커버리지 기준(Threshold)을 정해 일관된 품질 기준으로 활용할 수 있습니다.

### 🟦 실무 포인트: 커버리지 100%가 목표는 아닙니다

> 커버리지가 반드시 100%일 필요는 없습니다.  
> 다만 핵심 로직은 높은 커버리지를 유지해야 안정적으로 서비스를 운영하는 데 도움이 됩니다.  

테스트 커버리지를 무조건 100%로 맞추는 것은 비효율적일 수 있습니다.  
테스트 가치가 낮은 코드까지 억지로 검증하면 테스트 유지 비용이 높아질 수 있습니다.  

## 2. Vitest에서 커버리지 활성화하기: @vitest/coverage-v8 설정 {#session-02}

### 🟦 V8 기반 커버리지란?

Vitest는 V8 JavaScript 엔진의 네이티브 커버리지 기능을 이용해 코드 실행 정보를 수집할 수 있습니다.  
V8 공급자를 사용하려면 `@vitest/coverage-v8` 패키지가 필요합니다.  

### 🟦 1. @vitest/coverage-v8 패키지 설치

워크북 루트에서 다음 명령어를 실행합니다.  

```bash
cd blog-workspaces/nodejs-workbook
npm install -D @vitest/coverage-v8
```

`vitest`와 `@vitest/coverage-v8`의 버전이 다르면 호환성 경고가 발생할 수 있으므로 같은 버전을 사용하는 것이 좋습니다.  

### 🟦 2. vitest.config.ts 설정

프로젝트 루트의 `vitest.config.ts` 파일에 커버리지 옵션을 설정합니다.  

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      // V8 엔진의 네이티브 커버리지 기능을 사용합니다.
      provider: 'v8',
      // 터미널, JSON 파일과 HTML 문서로 결과를 생성합니다.
      reporter: ['text', 'json', 'html'],
      // 커버리지 리포트를 저장할 디렉터리를 지정합니다.
      reportsDirectory: './coverage',

      // 테스트 대상 소스 코드만 커버리지 측정 범위에 포함합니다.
      include: ['src/**/*.ts'],

      // 진입점, 타입 선언과 테스트 파일은 측정 대상에서 제외합니다.
      exclude: [
        'src/main.ts',
        '**/*.d.ts',
        'src/types/**',
        '**/*.test.ts',
      ],

      // 항목별 최소 기준에 미달하면 테스트 실행을 실패로 처리합니다.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

## 3. 커버리지 리포트 실습 및 예제 {#session-03}

### 🟦 1. 커버리지 실행 명령어

다음 명령어는 테스트를 한 번 실행하면서 커버리지를 수집합니다.  

```bash
npx vitest run --coverage
```

`--coverage` 옵션은 `vitest.config.ts`의 `coverage` 설정을 바탕으로 커버리지 수집 기능을 활성화합니다.  

| 옵션 | 설명 |
| --- | --- |
| `--coverage` | 커버리지를 수집합니다. |
| `--run` | watch 모드를 사용하지 않고 테스트를 한 번만 실행합니다. |
| `--dir [경로]` | 테스트 파일을 검색할 기준 디렉터리를 지정합니다. 기본값은 프로젝트 루트입니다. |
| `--reporter [형식]` | 테스트 결과 출력 형식을 지정합니다. `default`, `verbose`, `dot`, `json` 등을 사용할 수 있습니다. |
| `--config [파일명]` | 사용할 Vitest 설정 파일을 지정합니다. |
| `--testNamePattern [정규식]` | 정규식과 일치하는 이름의 테스트만 실행합니다. |
| `--passWithNoTests` | 실행할 테스트가 없어도 오류 없이 종료합니다. CI 환경에서 활용할 수 있습니다. |

예를 들어 다음과 같이 옵션을 조합할 수 있습니다.  

```bash
# 특정 테스트 파일만 실행하면서 커버리지를 수집합니다.
npx vitest run tests/ch07/user.service.test.ts --coverage

# 이름이 일치하는 테스트만 실행합니다.
npx vitest run --coverage --testNamePattern="성인인 경우 true를 반환해야 한다"

# 별도의 설정 파일을 사용합니다.
npx vitest run --coverage --config=vitest.coverage.config.ts
```

### 🟦 2. 실습용 예시 코드

먼저 사용자의 나이가 유효한지 확인하는 함수를 작성합니다.  

```typescript
// src/ch07/user.service.ts
export interface User {
  id: number;
  name: string;
  age: number;
}

// 사용자의 나이를 검증하고 성인 여부를 반환합니다.
export const validateUserAge = (user: User): boolean => {
  if (user.age < 0) {
    // 음수 나이는 유효하지 않으므로 예외를 발생시킵니다.
    throw new Error('Age cannot be negative');
  }

  // 만 19세 이상이면 true, 그렇지 않으면 false를 반환합니다.
  return user.age >= 19;
};
```

이 함수의 커버리지 지표는 다음과 같이 해석할 수 있습니다.  

- **Statements**: 조건 확인, 예외 발생과 결과 반환처럼 실행 가능한 명령문이 테스트되었는지를 나타냅니다.
- **Branches**: 음수 나이 조건과 성인 여부 비교에서 발생하는 각 결과가 테스트되었는지를 나타냅니다.
- **Functions**: `validateUserAge()` 함수가 테스트에서 호출되었는지를 나타냅니다.
- **Lines**: 함수 안의 실행 가능한 코드 줄이 테스트에서 실행되었는지를 나타냅니다.

처음에는 성인인 경우만 테스트합니다.  

```typescript
// tests/ch07/user.service.test.ts
import { describe, it, expect } from 'vitest';
import { validateUserAge } from '../../src/ch07/user.service';

describe('validateUserAge', () => {
  it('성인인 경우 true를 반환해야 한다', () => {
    const user = { id: 1, name: 'Alice', age: 20 };
    expect(validateUserAge(user)).toBe(true);
  });

  // 누락된 케이스: 미성년자(false 반환), 음수 나이(에러 발생)
});
```

### 🟦 3. 테스트 범위(커버리지 대상) 제한하기

실습 단위로 커버리지를 확인할 때는 전체 프로젝트보다 특정 폴더만 포함하는 것이 좋습니다.  

```typescript
// vitest.config.ts의 test.coverage 설정입니다.
coverage: {
  provider: 'v8',
  // 이번 실습에서는 ch07 아래의 소스 파일만 측정 대상에 포함합니다.
  include: ['src/ch07/**/*.ts'],
  // 테스트 파일과 타입 선언 파일은 측정 대상에서 제외합니다.
  exclude: ['**/*.test.ts', '**/*.d.ts'],
  reporter: ['text', 'html'],
},
```

### 🟦 4. 커버리지 결과 해석

작성한 테스트 파일만 실행하여 결과를 확인합니다.  

```bash
npx vitest run tests/ch07/user.service.test.ts --coverage
```

성인 입력만 테스트하면 Branch 커버리지가 100%에 도달하지 않습니다.  
음수 나이 조건이 참인 경우와 성인이 아닌 경우를 아직 테스트하지 않았기 때문입니다.  

```text
if (user.age < 0) { ... }
return user.age >= 19;

user.age < 0인 경우: 예외가 발생합니다.
user.age >= 19인 경우: true를 반환합니다.
0 <= user.age < 19인 경우: false를 반환합니다.
```

커버리지는 단순히 코드 줄의 실행 여부만 보는 것이 아니라 조건에 따라 달라지는 실행 경로도 측정합니다.  

### 🟦 5. 누락된 테스트의 주석 해제 → Branch 100% 달성

실제 `tests/ch07/user.service.test.ts`에는 두 테스트가 주석 처리되어 있습니다.  
미성년자인 경우와 음수 나이가 입력된 경우를 확인하려면 다음 두 테스트의 주석을 해제합니다.  

```typescript
it('미성년자인 경우 false를 반환해야 한다', () => {
  const user = { id: 2, name: 'Bob', age: 15 };
  expect(validateUserAge(user)).toBe(false);
});

it('나이가 음수면 에러를 던져야 한다', () => {
  const user = { id: 3, name: 'Charlie', age: -1 };
  expect(() => validateUserAge(user)).toThrow('Age cannot be negative');
});
```

이제 예제 함수의 모든 실행 경로를 테스트하여 Branch 커버리지 100%를 달성할 수 있습니다.  

## 4. 커버리지 리포트 확인 {#session-04}

Vitest에서는 커버리지 리포트를 여러 형식으로 출력하고 결과 파일의 저장 위치도 지정할 수 있습니다.  
이 기능은 로컬 디버깅, CI 리포트 확인과 시각적 분석 등에 활용할 수 있습니다.  

```typescript
// vitest.config.ts의 test.coverage 설정입니다.
coverage: {
  // 터미널, JSON 파일과 HTML 문서로 결과를 생성합니다.
  reporter: ['text', 'json', 'html'],
  // 리포트를 저장할 경로를 지정합니다.
  reportsDirectory: './coverage',
},
```

| 옵션 | 설명 |
| --- | --- |
| `'text'` | 터미널에 커버리지 결과를 요약하여 출력합니다. 수치를 빠르게 확인할 때 유용합니다. |
| `'json'` | `coverage-final.json` 파일을 생성합니다. Codecov나 Coveralls 같은 외부 리포팅 도구에서 활용할 수 있습니다. |
| `'html'` | 브라우저에서 볼 수 있는 HTML 리포트를 생성합니다. 테스트하지 않은 코드 줄을 시각적으로 확인할 수 있습니다. |

### 🟦 HTML 리포트 화면 예시

![HTML 커버리지 리포트 요약 화면](/assets/images/nodejs/nodejs-vitest/v8-coverage-html-summary.png)

![HTML 커버리지 리포트의 소스 파일 상세 화면](/assets/images/nodejs/nodejs-vitest/v8-coverage-html-source.png)
