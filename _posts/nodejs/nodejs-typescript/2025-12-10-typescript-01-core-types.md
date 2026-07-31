---
layout: post
title: "01. TypeScript 개념과 기본 타입 이해하기"
description: "TypeScript의 핵심 개념과 기본 타입, 타입 별칭, 모듈 시스템, any·unknown·never 타입의 차이를 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "01"
ai_assisted: true
toc:
  - id: session-01
    title: "1. TypeScript 핵심 개념 이해하기"
  - id: session-02
    title: "2. 기본 타입(Primitive Types) 이해하기"
  - id: session-03
    title: "3. 타입 별칭(Type Alias) 이해하기"
  - id: session-04
    title: "4. 모듈 시스템과 TypeScript 적용하기"
  - id: session-05
    title: "5. Any, Unknown, Never 타입 이해하기"
---

## 1. TypeScript 핵심 개념 이해하기 {#session-01}

TypeScript(이하 TS)는 Microsoft가 개발하고 유지 관리하는 오픈 소스 프로그래밍 언어로, JavaScript에 정적 타입(Static Type)을 추가한 상위 확장 언어(Superset)입니다.  

TS의 가장 큰 특징은 코드를 실행하기 전인 컴파일 시점에 타입을 검사할 수 있다는 점입니다.  
이를 통해 런타임에서 발생할 수 있는 일부 오류를 미리 발견하고, 더욱 신뢰할 수 있는 코드를 작성할 수 있습니다.  

**핵심 정의: TypeScript는 정적 타입 시스템을 갖춘 JavaScript입니다.**

### 🟦 JavaScript와 TypeScript 비교

| 구분 | JavaScript(동적) | TypeScript(정적) |
| --- | --- | --- |
| 타입 결정 시점 | 코드 실행 시점(런타임) | 코드 작성·컴파일 시점 |
| 오류 검출 시점 | 실행 중 오류 발생 가능 | 컴파일 단계에서 일부 오류 사전 검출 |
| 개발 경험(DX) | 자동 완성·리팩터링 지원이 상대적으로 제한적 | 타입 기반 IDE 지원과 개발 생산성 향상 |
| 대규모 프로젝트 적합성 | 규모가 커질수록 관리·유지보수 난이도 증가 | 명확한 타입을 기반으로 유지보수 가능 |

### 🟦 TypeScript와 JavaScript의 관계

#### 🔷 1) TypeScript는 JavaScript의 상위 확장 언어입니다

TypeScript는 JavaScript 문법을 포함하면서 타입 주석(Type Annotation)을 추가할 수 있도록 확장한 언어입니다.  
따라서 JavaScript 코드를 TypeScript로 점진적으로 옮길 수 있지만, 유효한 JavaScript 코드라도 TypeScript 설정과 타입 검사 결과에 따라 오류가 보고될 수 있습니다.  
이러한 관계 때문에 TypeScript를 흔히 JavaScript의 상위 확장 언어라고 부릅니다.  

```typescript
// 유효한 JavaScript 문법은 TypeScript에서도 사용할 수 있습니다.
const name = "Alice";
const add = (a = 0, b = 0) => a + b;

// TypeScript에서는 타입을 명시하여 코드의 안정성을 높일 수 있습니다.
const age: number = 30; // age에는 number 타입만 할당할 수 있습니다.
const multiply = (a: number, b: number): number => {
  return a * b; // 반환값도 number 타입이어야 합니다.
};
```

이처럼 TypeScript는 기존 JavaScript 개발 경험을 유지하면서 정적 타입 기반의 안전성과 도구 지원을 강화할 수 있는 환경을 제공합니다.  

#### 🔷 2) ECMAScript 표준과의 관계

TypeScript는 JavaScript의 표준 사양인 ECMAScript(ES)의 최신 문법을 지원합니다.  
함수, 클래스, `async`/`await`, 모듈 시스템과 같은 ES 기능을 그대로 사용할 수 있으며, 필요하면 TypeScript 컴파일러가 설정된 `target`에 맞는 JavaScript로 변환합니다.  

TypeScript는 다음 두 가지 역할을 함께 제공합니다.

- 최신 ES 기능을 활용할 수 있도록 지원
- 실행 환경과 `target` 설정에 맞는 JavaScript 문법으로 변환

### 🟦 TypeScript의 동작 원리

#### 🔷 1) 컴파일 과정: 타입 검사 → JavaScript 변환

일반적인 TypeScript 프로젝트는 코드를 실행하기 전에 타입 검사와 JavaScript 변환 과정을 거칩니다.  
최신 Node.js는 일부 TypeScript 문법을 타입 제거 방식으로 직접 실행할 수 있지만, 이 기능은 타입 검사를 수행하지 않으며 변환이 필요한 TypeScript 문법에는 제약이 있습니다.  
따라서 전체 TypeScript 문법과 타입 검사가 필요한 프로젝트에서는 TypeScript 컴파일러나 `tsx` 같은 도구를 사용합니다.  

컴파일 단계는 다음 두 과정으로 구성됩니다.

1. 타입 검사(Type Checking)

   - TypeScript 컴파일러가 코드의 타입 정보를 분석하여 오류가 있는지 확인합니다.
   - 타입 정보는 JavaScript 출력물에서 제거되며 런타임에는 존재하지 않습니다.

2. JavaScript 변환(Transpilation)

   - 컴파일러가 타입 주석을 제거하고 설정에 맞는 JavaScript 코드를 출력합니다.

#### 🔷 2) Node.js 환경에서 TypeScript를 실행하는 전통적인 방식

TypeScript 코드는 다음 흐름을 거쳐 Node.js에서 실행됩니다.

1. 개발자가 `.ts` 파일 작성
2. TypeScript 컴파일러(`tsc`)가 타입 검사와 변환 수행
3. `.js` 파일 출력
4. Node.js가 변환된 JavaScript 파일 실행

```bash
# 1. TypeScript 파일을 작성합니다.
# src/app.ts

# 2. tsconfig.json 설정에 따라 컴파일합니다.
npx tsc

# 3. 설정한 outDir에 JavaScript 결과물이 생성됩니다.
# dist/app.js

# 4. 변환된 JavaScript를 Node.js로 실행합니다.
node dist/app.js
```

이 방식을 사용하면 Node.js 환경에서도 TypeScript 기반의 안전하고 유지보수하기 쉬운 코드를 구현할 수 있습니다.  

#### 🔷 3) `tsx`를 사용한 실행 방식

`tsx`는 TypeScript 실행 도구로, 별도의 JavaScript 파일을 미리 생성하지 않고 `.ts`와 `.tsx` 파일을 실행할 수 있게 해 줍니다.  
실행 시 TypeScript 문법을 빠르게 변환하지만 타입 검사는 수행하지 않으므로, 필요한 경우 `tsc --noEmit`을 별도로 실행해야 합니다.  

```text
npx tsx src/app.ts

TypeScript 코드
    ↓ 타입 제거와 JavaScript 변환
Node.js에서 실행
```

개발 환경 설정은 [TypeScript 개발 환경 설정: tsconfig.json, tsx, Vitest](/archives/nodejs/nodejs-environment/nodejs-3-typescript/)에서 확인할 수 있습니다.  

## 2. 기본 타입(Primitive Types) 이해하기 {#session-02}

TypeScript는 JavaScript의 모든 기본 타입(Primitive Types)을 지원하며 여기에 타입 검사 기능을 추가합니다.  

### 🟦 기본 타입 종류와 설명

| 타입 | 설명 | 예시 |
| --- | --- | --- |
| `number` | 정수, 소수, `NaN`, `Infinity`를 포함한 모든 숫자 값 | `let age: number = 30;` |
| `string` | 큰따옴표, 작은따옴표, 템플릿 리터럴로 작성한 문자열 | `let name: string = "Jane";` |
| `boolean` | 참(`true`) 또는 거짓(`false`)을 나타내는 논리형 | `let isStudent: boolean = false;` |
| `null` | 값이 없음을 명시적으로 표현 | `let data: null = null;` |
| `undefined` | 값이 아직 할당되지 않은 상태를 표현 | `let nothing: undefined = undefined;` |
| `symbol` | 고유하고 변경할 수 없는 값 | `const key: symbol = Symbol("key");` |
| `bigint` | 매우 큰 정수를 표현할 수 있는 타입 | `let bigNum: bigint = 9007199254740991n;` |

`symbol`과 `bigint`는 일반적인 변수 선언보다는 고유 키 정의나 매우 큰 정수 계산과 같은 특정 상황에서 주로 사용됩니다.  

### 🟦 타입 명시(Explicit Typing)

TypeScript에서는 변수를 선언할 때 타입을 명시적으로 지정할 수 있습니다.  
변수 이름 뒤에 콜론(`:`)과 타입을 작성합니다.  

```typescript
let count: number = 10;
let message: string = "안녕하세요";
let isActive: boolean = true;

// count에는 문자열을 할당할 수 없으므로 타입 오류가 발생합니다.
// count = "열"; // Type '"열"' is not assignable to type 'number'.
```

### 🟦 타입 추론(Type Inference)

TypeScript는 변수에 할당한 값을 바탕으로 타입을 추론할 수 있습니다.  

```typescript
let count = 10;
```

타입을 명시하지 않아도 TypeScript는 `10`이 `number`이므로 `count`의 타입을 `number`로 추론합니다.  

```typescript
count = 5; // ✅ 정상
count = "다섯"; // ❌ number 변수에 문자열을 할당하므로 오류가 발생합니다.
```

타입 추론은 코드를 간결하게 유지하면서 타입 안정성을 확보할 수 있는 강력한 도구입니다.  
다만 복잡한 로직에서는 명시적인 타입 선언이 가독성과 유지보수에 도움이 될 수 있습니다.  

![number로 추론된 변수에 문자열을 할당했을 때의 오류](/assets/images/nodejs/nodejs-typescript/type-inference-error.png)

## 3. 타입 별칭(Type Alias) 이해하기 {#session-03}

TypeScript에서는 `type` 키워드를 사용하여 기존 타입에 새로운 이름을 지정할 수 있습니다.  
이 기능을 타입 별칭(Type Alias)이라고 합니다.  

타입 별칭은 특히 다음 상황에서 유용합니다.

- 반복해서 사용하는 타입을 간결하게 표현할 때
- 변수나 함수의 의미를 더욱 명확하게 드러내고 싶을 때
- 구조가 복잡한 타입을 읽기 쉽게 분리할 때

타입 별칭을 사용하면 코드의 표현력이 높아지고 타입 선언을 재사용하기 쉬워져 유지보수성도 향상됩니다.  

### 🟦 타입 별칭 사용법

```typescript
// type 키워드로 새로운 타입 이름을 정의합니다.
type UserID = string;
type Temperature = number;
type Status = boolean;

// 정의한 타입 이름을 변수의 타입으로 지정합니다.
let userID: UserID = "user-12345";
let todayTemp: Temperature = 26.7;
let isPassed: Status = true;
```

`userID`를 `string` 타입으로 작성해도 동작은 같지만, `UserID`라는 별칭을 사용하면 이 값이 단순한 문자열이 아니라 사용자 식별자라는 의미를 전달할 수 있습니다.  

### 🟦 복잡한 타입을 별칭으로 관리하는 방법

다음은 객체 구조를 타입 별칭으로 정의한 예시입니다.  

| 형식 | 예시 | 문법 요소 |
| --- | --- | --- |
| 줄바꿈 형태 | `type AnimalType = { name: string; age: number; };` | 속성 구분자로 세미콜론 사용 |
| 한 줄 형태 | `type AnimalType = { name: string, age: number };` | 속성 구분자로 쉼표 사용 |

```typescript
type Point = {
  x: number;
  y: number;
};

// 다음과 같이 한 줄로 작성하는 문법도 유효합니다.
// type Point = { x: number, y: number };

function logPoint(point: Point) {
  console.log(`x: ${point.x}, y: ${point.y}`);
}

logPoint({ x: 100, y: 200 });
```

위 형태는 다음과 같은 장점을 제공합니다.

- `Point` 구조를 여러 함수에서 재사용할 수 있습니다.
- 같은 객체 구조를 반복해서 작성하지 않아도 됩니다.
- `Point`라는 이름만으로 타입의 의미를 전달할 수 있습니다.

### 🟦 타입 별칭은 언제 사용하면 좋을까요?

#### 🔷 1) 의미 있는 타입 이름이 필요한 경우

코드를 읽는 사람에게 값의 용도를 전달할 수 있습니다.  

```typescript
type Email = string;
type OrderID = string;
type Price = number;
```

#### 🔷 2) 같은 형태를 여러 곳에서 사용할 때

같은 타입을 여러 API 함수에서 재사용하면 일관성을 높일 수 있습니다.  

```typescript
type ApiResponse = {
  success: boolean;
  message: string;
  data?: unknown;
};
```

#### 🔷 3) 복잡한 타입 구조를 하나의 이름으로 표현할 때

```typescript
type Coordinates = [number, number, number];
type Matrix = number[][];
```

### 🟦 참고: `interface`와의 차이

| 구분 | Type Alias | Interface |
| --- | --- | --- |
| 표현 가능 범위 | 기본 타입, 유니언, 교차, 튜플, 객체 등 | 주로 객체 구조 |
| 확장 방법 | 교차 타입(`&`) 사용 | `extends` 사용 |
| 선언 병합 | 지원하지 않음 | 같은 이름의 선언 병합 지원 |
| 주요 용도 | 타입에 의미를 부여하거나 복잡한 타입 관리 | 객체의 구조 정의 |

## 4. 모듈 시스템과 TypeScript 적용하기 {#session-04}

현대 JavaScript와 TypeScript 개발에서는 파일 단위로 코드를 분리하여 관리하는 모듈 시스템이 중요합니다.  
모듈 시스템은 프로젝트의 구조화, 재사용성, 유지보수성을 높여 줍니다.  

TypeScript는 JavaScript의 공식 모듈 시스템인 ESM(ECMAScript Modules)을 지원하며, 타입 정보도 모듈로 분리하여 관리할 수 있습니다.  

### 🟦 모듈 시스템의 기본 구조

| 키워드 | 역할 | 예시 |
| --- | --- | --- |
| `export` | 변수, 함수, 타입 등을 다른 파일에서 사용할 수 있도록 내보냄 | `export const A = 1;` |
| `import` | 다른 파일에서 내보낸 항목을 불러와 사용 | `import { A } from "./module.js";` |

모듈을 사용하면 파일 간 경계를 명확하게 유지할 수 있으며, TypeScript에서는 타입 정보도 파일로 분리하여 재사용할 수 있습니다.  

#### 🔷 1) `types.ts`: 타입 정의 모듈

```typescript
// types.ts
// 다른 파일에서 사용할 타입과 상수를 내보냅니다.

export type Product = {
  id: number;
  name: string;
  price: number;
};

export const API_URL = "https://api.example.com";
```

`Product`는 제품 정보를 표현하는 타입이며, `API_URL`은 다른 모듈에서도 사용할 수 있도록 내보낸 상수입니다.  

#### 🔷 2) `app.ts`: 실제 로직 구현 파일

```typescript
// app.ts
// 값과 타입을 각각 알맞은 방식으로 가져옵니다.

import { API_URL } from "./types.js";
import type { Product } from "./types.js";

const newProduct: Product = {
  id: 1,
  name: "노트북",
  price: 1200000,
};

// 다음 코드는 id의 타입이 맞지 않고 price가 누락되어 오류가 발생합니다.
// const invalidProduct: Product = { id: "a", name: "PC" };

console.log(`새 제품: ${newProduct.name}, 가격: ${newProduct.price}`);
console.log(`API 주소: ${API_URL}`);
```

이 구조는 다음과 같은 실무 장점을 제공합니다.

- 타입 중복을 제거하고 한 곳에서 정의하여 관리할 수 있습니다.
- 파일 간 의존 관계가 명확하게 드러나 가독성이 향상됩니다.
- 타입을 변경하면 관련 모듈에서 컴파일 오류를 확인할 수 있어 안전성이 높아집니다.

### 🟦 타입 분리 전략

많은 타입을 각 기능 파일에 섞어서 선언하면 다음과 같은 문제가 생길 수 있습니다.

- 중복 선언으로 인한 유지보수 어려움
- 타입 이름 충돌 위험
- 파일이 지나치게 커져 발생하는 가독성 저하

따라서 다음과 같은 전략을 사용할 수 있습니다.

| 전략 | 설명 |
| --- | --- |
| `types/` 폴더 생성 | 여러 파일에서 공유할 타입을 별도 디렉터리에서 관리 |
| `import type` 문법 사용 | 타입 전용 가져오기를 사용하여 런타임 코드와 구분 |
| 도메인별 타입 파일 구분 | `user.types.ts`, `product.types.ts`처럼 기능별로 분리 |

## 5. Any, Unknown, Never 타입 이해하기 {#session-05}

TypeScript의 타입 시스템을 이해할 때 `any`, `unknown`, `never`는 중요한 개념입니다.  
이 세 타입은 TypeScript가 제공하는 타입 안전성의 수준을 조절하며, 적절히 사용하면 견고한 코드 구조를 만드는 데 도움이 됩니다.  

### 🟦 `any`: 가장 관대하지만 가장 위험한 타입

`any`는 어떤 타입이든 허용한다는 의미를 가진 타입입니다.  
값이 `any`이면 TypeScript가 해당 값의 속성과 메서드를 안전하게 검사하지 않습니다.  

```typescript
let data: any = "문자열입니다.";
data = 100; // 다른 타입의 값을 할당해도 컴파일 오류가 없습니다.
data.toUpperCase(); // 컴파일은 통과하지만 실행하면 TypeError가 발생합니다.
```

`any`를 남용하면 TypeScript의 타입 검사 이점을 얻기 어렵습니다.  
JavaScript에서 TypeScript로 전환하는 초기에 임시로 사용하는 경우가 아니라면 사용을 줄이는 편이 좋습니다.  

### 🟦 `unknown`: 안전하게 알 수 없는 타입

`unknown`도 알 수 없는 타입을 의미하지만 `any`보다 안전합니다.  
`unknown` 타입의 값은 바로 사용할 수 없으며, 타입을 검사한 후에만 해당 타입의 속성이나 메서드에 접근할 수 있습니다.  

```typescript
let unsafeValue: unknown = "Hello TypeScript";

// unsafeValue.toUpperCase();
// 'unsafeValue' is of type 'unknown'.

if (typeof unsafeValue === "string") {
  // 이 블록에서는 unsafeValue의 타입이 string으로 좁혀집니다.
  console.log(unsafeValue.toUpperCase());
}
```

외부 API 응답처럼 타입을 알 수 없는 데이터를 받을 때 `unknown`을 사용하면, 타입 가드(Type Guard)로 타입을 확인한 후 사용하도록 유도하여 런타임 오류를 예방하는 데 도움이 됩니다.  

| 항목 | 설명 |
| --- | --- |
| 직접 사용 불가 | 타입을 좁히기 전에는 속성 접근과 함수 호출 불가 |
| 타입 검사 후 사용 가능 | `typeof`, `instanceof`, 사용자 정의 타입 가드 등 |
| 안전한 코드 작성 유도 | 런타임 오류 발생 가능성 감소 |

### 🟦 `never`: 발생할 수 없는 타입

`never`는 도달할 수 없는 상태나 발생할 수 없는 값을 표현할 때 사용합니다.  

#### 🔷 1) 항상 예외를 발생시키는 함수

다음 함수는 정상적으로 종료되지 않으므로 반환 타입이 `never`입니다.  

```typescript
function throwError(message: string): never {
  throw new Error(message);
}
```

#### 🔷 2) 무한 루프

끝나지 않는 함수도 호출 지점으로 반환하지 않으므로 반환 타입이 `never`입니다.  

```typescript
function loopForever(): never {
  while (true) {}
}
```

#### 🔷 3) 완전성 검사(Exhaustiveness Checking)

이 `never` 패턴은 잘못된 인자를 막는 용도가 아니라, 나중에 유니언 타입에 항목이 추가되었을 때 `switch` 문에서 빠진 분기를 컴파일 시점에 찾기 위한 장치입니다.  

```typescript
// Fruit는 문자열 리터럴 유니언 타입입니다.
type Fruit = "Apple" | "Banana" | "Orange";

// 새로운 항목을 추가하고 switch 문에 분기를 추가하지 않으면 오류가 발생합니다.
// type Fruit = "Apple" | "Banana" | "Orange" | "Grape";
// Type '"Grape"' is not assignable to type 'never'.

/**
 * 마지막 default 절에서 never 타입을 사용하여
 * 모든 항목을 처리했는지 컴파일 시점에 확인합니다.
 */
function fruitToKorean(fruit: Fruit): string {
  switch (fruit) {
    case "Apple":
      return "사과";
    case "Banana":
      return "바나나";
    case "Orange":
      return "오렌지";
    default: {
      // 모든 항목을 처리했다면 이 지점에서 fruit의 타입은 never입니다.
      const exhaustiveCheck: never = fruit;
      return exhaustiveCheck;
    }
  }
}

function demoFruit() {
  console.log("=== demoFruit ===");
  console.log(fruitToKorean("Apple"));
  console.log(fruitToKorean("Banana"));
  console.log(fruitToKorean("Orange"));

  // Fruit에 없는 값을 전달하면 컴파일 오류가 발생합니다.
  // console.log(fruitToKorean("tomato"));
}
```

`fruitToKorean("tomato")`를 호출하면 `Fruit`에 선언하지 않은 값이므로 인자 단계에서 오류가 발생합니다.  
반면 `Fruit`에 `"Grape"`를 추가하고 `switch` 문에 해당 분기를 추가하지 않으면, `default` 절의 `never` 할당에서 오류가 발생합니다.  
따라서 이 패턴을 사용하면 유니언 타입이 변경되었을 때 빠진 분기를 확인할 수 있습니다.  

![Fruit 타입에 항목을 추가한 뒤 switch 분기를 누락했을 때의 오류](/assets/images/nodejs/nodejs-typescript/never-exhaustiveness-error.png)

| 타입 | 의미 | 특징 | 비고 |
| --- | --- | --- | --- |
| `any` | 무엇이든 허용 | 타입 검사 비활성화 | 최소 사용 권장 |
| `unknown` | 알 수 없는 타입 | 타입 검사 후 접근 가능 | 사용 권장 |
| `never` | 발생할 수 없는 값 | 종료되지 않는 코드, 완전성 검사 | 상황에 따라 사용 |
