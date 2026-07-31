---
layout: post
title: "02. TypeScript Interface와 Type Alias 비교"
description: "TypeScript의 Interface와 Type Alias를 비교하고, 선택적·읽기 전용 속성, 계산된 프로퍼티, 타입 단언과 타입 추론 원리를 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "02"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 인터페이스(Interface): 객체 타입 정의의 기본"
  - id: session-02
    title: "2. Type vs Interface: 언제 무엇을 사용해야 할까요?"
  - id: session-03
    title: "3. 객체 타입 심화: 유연하고 안전한 구조 만들기"
  - id: session-04
    title: "4. 타입 추론(Type Inference) 이해하기: 자동으로 타입 유추"
---

## 1. 인터페이스(Interface): 객체 타입 정의의 기본 {#session-01}

JavaScript의 객체는 매우 유연하여 다양한 속성과 구조를 가질 수 있습니다.  
하지만 어떤 속성이 존재하는지 미리 알기 어렵고, 잘못된 속성을 사용해도 실행할 때까지 오류를 발견하지 못할 수 있습니다.  

TypeScript에서는 이러한 문제를 줄이기 위해 인터페이스(Interface)를 제공합니다.  

### 🟦 인터페이스란?

인터페이스는 객체가 가져야 할 속성(Property)과 메서드(Method)의 이름과 타입을 미리 정의하는 설계도입니다.  

- 객체에 필요한 속성을 명확하게 규정할 수 있습니다.
- 자동 완성, 타입 검사, 문서화에 도움이 됩니다.
- 클래스와 함께 사용할 수 있습니다.

### 🟦 인터페이스 정의 및 사용법

```typescript
// User라는 이름의 인터페이스를 정의합니다.
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  // 선택적 속성은 객체에 있어도 되고 없어도 됩니다.
  phoneNumber?: string;
  // 메서드의 반환 타입도 정의할 수 있습니다.
  greet(): string;
}

// 이 객체는 User 인터페이스의 구조를 따라야 합니다.
const user1: User = {
  id: 1,
  name: "김민준",
  email: "minjun.kim@example.com",
  isActive: true,
  greet() {
    return `안녕하세요, ${this.name}입니다.`;
  },
};

console.log(user1.greet()); // "안녕하세요, 김민준입니다."
```

- `id`, `name`, `email`, `isActive`: 필수 속성
- `phoneNumber`: 있어도 되고 없어도 되는 선택적 속성
- `greet()`: 문자열을 반환하는 메서드

### 🟦 오류 예시: 속성 누락 또는 타입 불일치

```typescript
const user2: User = {
  id: 2,
  name: "이서연",
  email: "seoyeon@example.com",
  // 필수 속성인 isActive가 누락되어 오류가 발생합니다.
  // Property 'isActive' is missing in type ...
  greet() {
    return "안녕하세요!";
  },
};
```

TypeScript는 컴파일 단계에서 `User` 인터페이스와 실제 객체 구조를 비교하여 누락된 속성이나 잘못된 타입을 알려 줍니다.  

### 🟦 인터페이스 확장(Extending Interfaces)

인터페이스는 다른 인터페이스를 `extends`로 확장할 수 있습니다.  
기존 인터페이스의 속성을 유지하면서 새로운 속성을 추가할 수 있습니다.  

```typescript
// User 인터페이스를 확장하여 AdminUser를 정의합니다.
interface AdminUser extends User {
  role: "admin" | "super-admin"; // 두 역할 중 하나만 허용합니다.
  permissions: string[]; // 권한 목록입니다.
}

const admin: AdminUser = {
  id: 100,
  name: "홍길동",
  email: "gildong.hong@example.com",
  isActive: true,
  role: "admin",
  permissions: ["read", "write", "delete"],
  greet() {
    return `관리자 ${this.name}입니다.`;
  },
};

console.log(admin.greet()); // "관리자 홍길동입니다."
```

인터페이스 확장은 다음과 같은 장점을 제공합니다.

- 코드 재사용: 공통 속성을 정의하여 여러 타입에서 공유할 수 있습니다.
- 유지보수: 공통 속성을 한 곳에서 수정할 수 있습니다.
- 의미 있는 타입 분리: 일반 사용자와 관리자처럼 역할을 구분할 수 있습니다.

## 2. Type vs Interface: 언제 무엇을 사용해야 할까요? {#session-02}

TypeScript를 처음 접할 때 자주 혼동하는 부분 중 하나가 `type`을 이용한 타입 별칭(Type Alias)과 `interface`를 이용한 인터페이스 정의입니다.  
두 문법 모두 객체의 구조를 정의할 수 있지만 용도와 동작 방식에는 차이가 있습니다.  

| 항목 | `interface` | `type` |
| --- | --- | --- |
| 확장 방식 | `extends`로 확장 | `&` 인터섹션으로 결합 |
| 정의 대상 | 객체의 구조 정의에 특화 | 객체, 기본 타입, 유니언, 튜플 등 |
| 선언 병합 | 같은 이름의 선언을 병합 | 같은 이름으로 다시 선언하면 오류 발생 |
| 주요 용도 | 확장 가능한 객체, 클래스, API 응답 구조 | 유니언, 튜플, 함수와 복합 타입 |

객체 구조를 정의할 때는 `interface`를 사용할 수 있습니다.  
특히 `extends`와 선언 병합이 필요하다면 `interface`가 적합합니다.  
반면 `type`은 유니언, 튜플, 함수 타입과 같이 다양한 타입을 조합할 때 적합합니다.  

| 상황 | 선택 |
| --- | --- |
| 객체 구조를 정의할 때 | `interface` |
| 객체 타입을 자주 확장할 때 | `interface` |
| 유니언, 튜플, 복합 타입이 필요할 때 | `type` |
| 기본 타입이나 다른 타입을 조합할 때 | `type` |
| 같은 이름의 선언 병합이 필요할 때 | `interface` |

### 🟦 예제 1: `type`으로 유니언 타입 정의하기

`type`은 문자열 리터럴 유니언 타입을 선언할 때 유용합니다.  

```typescript
// 상태 값을 제한된 문자열로 표현합니다.
type Status = "pending" | "success" | "error";

// 정의한 타입을 변수에 적용합니다.
let currentStatus: Status = "success";

// 정의하지 않은 값을 할당하면 오류가 발생합니다.
// currentStatus = "done";
// Type '"done"' is not assignable to type 'Status'.
```

### 🟦 예제 2: `interface`로 객체 타입 정의하기

`interface`는 객체의 구조를 명확하게 정의하고 선택적 속성을 지정할 수 있어 API 응답과 같은 객체 타입에도 사용할 수 있습니다.  

```typescript
interface ApiResponse {
  status: "success" | "error";
  data: any;
  message?: string; // 선택적 속성입니다.
}

const res1: ApiResponse = {
  status: "success",
  data: { id: 1, name: "Jane" },
};

const res2: ApiResponse = {
  status: "error",
  data: null,
  message: "요청에 실패했습니다.",
};
```

### 🟦 예제 3: `interface` 확장 vs `type` 확장

두 방식 모두 기존 객체 타입을 확장할 수 있지만, `interface`는 `extends`를 사용하고 `type`은 `&` 인터섹션을 사용합니다.  

```typescript
// interface를 확장합니다.
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

const myDog: Dog = {
  name: "Coco",
  breed: "Poodle",
};
```

```typescript
// type을 인터섹션으로 확장합니다.
type Animal = { name: string };
type Dog = Animal & { breed: string };

const myDog: Dog = {
  name: "Coco",
  breed: "Poodle",
};
```

### 🟦 예제 4: 선언 병합의 차이

```typescript
// 같은 이름의 interface 선언은 하나로 병합됩니다.
interface User {
  name: string;
}

interface User {
  age: number;
}

// 병합된 User에는 name과 age가 모두 필요합니다.
const user: User = {
  name: "Jane",
  age: 30,
};
```

```typescript
// type은 같은 이름으로 다시 선언할 수 없습니다.
type Admin = {
  role: string;
};

// 다음 선언은 중복된 이름으로 인해 오류가 발생합니다.
// type Admin = { level: number };
// Duplicate identifier 'Admin'.
```

## 3. 객체 타입 심화: 유연하고 안전한 구조 만들기 {#session-03}

TypeScript를 사용하면 객체의 구조를 더욱 정밀하게 제어할 수 있습니다.  
속성을 선택적으로 정의하거나, 객체를 통해 특정 속성을 다시 할당하지 못하도록 지정할 수 있습니다.  
컴파일러보다 개발자가 값의 타입을 더 구체적으로 알고 있다면 타입 단언(Type Assertion)으로 타입을 지정할 수도 있습니다.  
계산된 프로퍼티(Computed Property)를 이용하면 키 이름이 동적으로 결정되는 객체도 다룰 수 있습니다.  

| 개념 | 설명 | 키워드 |
| --- | --- | --- |
| 선택적 속성 | 있어도 되고 없어도 되는 속성 | `?` |
| 읽기 전용 속성 | 해당 객체를 통해 다시 할당할 수 없는 속성 | `readonly` |
| 계산된 프로퍼티 | 표현식의 결과를 키 이름으로 사용하는 속성 | `[expr]` |
| 타입 단언 | 개발자가 값의 타입을 더 구체적으로 지정 | `as` |

### 🟦 선택적 속성(Optional Properties)

객체의 모든 속성이 항상 필수일 필요는 없습니다.  
TypeScript에서는 속성 이름 뒤에 `?`를 붙여 선택적 속성(Optional Property)으로 만들 수 있습니다.  

```typescript
interface Profile {
  nickname: string; // 필수 속성입니다.
  age?: number; // 선택적 속성입니다.
}

const profile1: Profile = {
  nickname: "TypeScriptLover",
}; // age가 없어도 오류가 발생하지 않습니다.

const profile2: Profile = {
  nickname: "JSExpert",
  age: 30,
}; // age가 있어도 올바른 객체입니다.
```

### 🟦 선택적 속성과 `number | undefined`의 차이

```typescript
interface A {
  age?: number;
}

// age라는 키가 없어도 됩니다.
const a1: A = {};
const a2: A = { age: 10 };

interface B {
  age: number | undefined;
}

// age 키는 항상 있어야 하며 값만 undefined일 수 있습니다.
const b1: B = { age: undefined };
// const b2: B = {};
// Property 'age' is missing in type '{}'.
```

### 🟦 읽기 전용 속성(`readonly`)

`readonly`를 사용하면 해당 객체를 통해 속성값을 다시 할당할 수 없습니다.  
이 제약은 TypeScript의 타입 검사 단계에서 적용되며, JavaScript 런타임에서 객체를 자동으로 동결하지는 않습니다.  

```typescript
interface Point {
  readonly x: number;
  readonly y: number;
}

const p: Point = { x: 10, y: 20 };

// p.x = 5;
// Cannot assign to 'x' because it is a read-only property.
```

### 🟦 `const` vs `readonly`

두 키워드는 의미하는 대상이 다릅니다.  

```typescript
const p: Point = { x: 10, y: 20 };

// p = { x: 0, y: 0 }; // const는 변수 자체의 재할당을 막습니다.
// p.x = 5; // readonly는 해당 속성의 재할당을 막습니다.
```

```typescript
interface Config {
  apiBaseUrl: string;
  timeoutMs: number;
}

// 모든 속성을 읽기 전용으로 만듭니다.
const config: Readonly<Config> = {
  apiBaseUrl: "https://api.example.com",
  timeoutMs: 5000,
};

// config.timeoutMs = 3000;
// Cannot assign to 'timeoutMs' because it is a read-only property.
```

### 🟦 계산된 프로퍼티(Computed Property)와 동적 키

실무에서는 키 이름이 코드 실행 시점에 결정되는 객체도 사용합니다.  
이때 JavaScript와 TypeScript의 계산된 프로퍼티 이름 문법을 사용할 수 있습니다.  

```typescript
const fieldName = "email";

const user = {
  name: "Alice",
  [fieldName]: "alice@example.com", // "email" 키로 계산됩니다.
};

console.log(user.email); // "alice@example.com"
console.log(user["email"]); // "alice@example.com"
```

`[fieldName]`이 계산된 프로퍼티 이름입니다.  
`fieldName`의 값이 `"email"`이므로 결과는 `{ name: "Alice", email: "..." }`와 같습니다.  

### 🟦 타입 단언(Type Assertion)

TypeScript의 타입 시스템은 강력하지만 개발자가 값의 타입을 컴파일러보다 더 구체적으로 알고 있는 상황이 있습니다.  
이때 타입 단언을 사용하여 컴파일러가 값을 특정 타입으로 취급하도록 지정할 수 있습니다.  

가장 일반적인 문법은 `as`를 사용하는 방식입니다.  

```typescript
type CanvasLike = {
  id: string;
};

const unknownValue: unknown = { id: "main_canvas" };

// unknownValue를 CanvasLike로 취급하도록 단언합니다.
const canvasLike = unknownValue as CanvasLike;

console.log("canvasLike.id:", canvasLike.id);
```

타입 단언은 런타임 검사를 추가하지 않으므로 실제 값의 구조가 단언한 타입과 다를 수 있습니다.  
따라서 값의 구조를 확인할 수 없다면 무분별하게 사용하지 않는 편이 좋습니다.  

### 🟦 타입 단언 사용 시 주의점

실제로는 `<canvas>`가 아닌 요소가 반환되거나 요소가 없는데도 `HTMLCanvasElement`로 단언하면 런타임 오류가 발생할 수 있습니다.  
가능하면 다음과 같이 런타임 검사로 타입을 좁히는 방식을 먼저 고려하는 편이 안전합니다.  

```typescript
const element = document.getElementById("main_canvas");

if (element instanceof HTMLCanvasElement) {
  // 이 블록에서 element는 HTMLCanvasElement로 좁혀집니다.
  const context = element.getContext("2d");
  context?.fillRect(0, 0, 100, 100);
}
```

`type`과 `interface`는 TypeScript의 타입 공간에만 존재하므로 `instanceof`의 오른쪽에 사용할 수 없습니다.  

`instanceof`는 다음과 같은 값에 사용할 수 있습니다.

- 클래스로 만든 인스턴스
- 생성자 함수로 만든 인스턴스
- `Array`, `Date`, `RegExp`, `Error`와 같은 내장 생성자의 인스턴스

## 4. 타입 추론(Type Inference) 이해하기: 자동으로 타입 유추 {#session-04}

TypeScript의 주요 장점 중 하나는 타입 추론(Type Inference)입니다.  
타입 추론은 개발자가 타입을 명시하지 않아도 TypeScript가 변수의 초기값, 함수의 반환값, 코드의 문맥을 바탕으로 타입을 유추하는 기능입니다.  
이를 활용하면 코드를 간결하게 작성하면서 타입 안정성도 유지할 수 있습니다.  

| 상황 | 타입 추론 | 타입 명시 |
| --- | --- | --- |
| 변수 선언과 초기값이 함께 있음 | 초기값으로 추론 가능 | 대부분 생략 가능 |
| 변수 선언에 초기값이 없음 | 이후 할당과 제어 흐름에 따라 분석 | 의도한 타입이 있다면 권장 |
| 함수 반환값 | 함수 본문으로 추론 가능 | 대부분 생략 가능 |
| 독립된 함수 선언의 매개변수 | 문맥이 없으면 `any`로 처리될 수 있음 | `noImplicitAny`에서는 필요 |
| 문맥이 제공되는 콜백 매개변수 | 문맥적 타입 추론 가능 | 생략 가능 |

### 🟦 타입 추론의 기본 원리

TypeScript는 변수에 초기값이 있거나 함수가 값을 반환할 때 해당 값을 기준으로 타입을 추론합니다.  

### 🟦 변수 선언 시의 타입 추론

`let favoriteColor = "blue";`처럼 타입을 명시하지 않아도 TypeScript는 초기값을 보고 `string` 타입으로 이해합니다.  

```typescript
let favoriteColor = "blue";
// "blue"가 문자열이므로 favoriteColor를 string으로 추론합니다.

favoriteColor = "red"; // 올바른 할당입니다.
// favoriteColor = 10;
// Type 'number' is not assignable to type 'string'.
```

### 🟦 함수 반환값의 타입 추론

함수의 매개변수 타입을 명시하면 함수 본문을 바탕으로 반환 타입도 추론할 수 있습니다.  

```typescript
function calculateSum(a: number, b: number) {
  return a + b;
}

const result = calculateSum(5, 3);
// 반환값이 숫자이므로 result를 number로 추론합니다.

console.log(result * 2); // 16
```

### 🟦 타입 명시가 필요한 경우

대부분은 타입 추론만으로 충분하지만, 다음 상황에서는 타입을 명시하면 코드의 의도를 더 분명하게 전달할 수 있습니다.  

#### 🔷 1) 초기값 없이 선언한 변수

```typescript
let data;
// 초기 타입 정보가 없으므로 이후 할당과 제어 흐름에 따라 타입이 분석됩니다.

data = 10;
data = "hello";

// 하나의 타입만 허용하려면 타입을 명시합니다.
let count: number;
// count = "text";
// Type 'string' is not assignable to type 'number'.
```

#### 🔷 2) 독립된 함수 선언의 매개변수

독립된 함수 선언의 매개변수에는 타입을 추론할 문맥이 없습니다.  
`noImplicitAny`가 활성화된 환경에서는 타입을 명시하지 않은 매개변수에 오류가 발생합니다.  

```typescript
// 다음 함수는 noImplicitAny가 활성화되어 있으면 오류가 발생합니다.
// function multiply(a, b) {
//   return a * b;
// }
// Parameter 'a' implicitly has an 'any' type.

function multiply(a: number, b: number) {
  return a * b;
}

console.log(multiply(4, 5)); // 20
```
