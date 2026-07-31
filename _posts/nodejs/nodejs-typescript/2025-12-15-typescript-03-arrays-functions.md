---
layout: post
title: "03. TypeScript 배열, 튜플과 함수 타입 이해하기"
description: "TypeScript의 배열과 튜플 선언법부터 함수 매개변수와 반환 타입, void·never·undefined, 오버로딩과 콜백 타입 설계까지 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "03"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 배열과 튜플 이해하기: 리스트형 데이터 타입 선언법"
  - id: session-02
    title: "2. 함수 타입 기초: 매개변수 타입과 반환 타입 명확히 정의하기"
  - id: session-03
    title: "3. 함수 타입 심화: void, never, undefined와 함수 오버로딩"
  - id: session-04
    title: "4. 함수 타입 별칭과 콜백 타입 정의하기: 재사용 가능한 타입 설계"
---

## 1. 배열과 튜플 이해하기: 리스트형 데이터 타입 선언법 {#session-01}

TypeScript에서는 배열과 튜플을 통해 리스트형 데이터를 더욱 안전하고 구조화된 방식으로 관리할 수 있습니다.  
JavaScript의 유연한 배열은 편리하지만 여러 타입의 값이 의도치 않게 섞이면 오류를 놓치기 쉽습니다.  
TypeScript에서는 배열과 튜플에 정확한 타입을 지정하여 이러한 문제를 줄일 수 있습니다.  

### 🟦 배열 타입 지정(Array Types)

TypeScript에서는 하나의 배열이 지정한 타입의 요소만 담도록 제한하여 안정성을 높일 수 있습니다.  
배열 타입은 `string[]`처럼 대괄호를 사용하거나 `Array<string>`처럼 제네릭 문법으로 선언할 수 있습니다.  
두 방식은 동일하게 동작하지만 대괄호 방식이 간결하여 흔히 사용됩니다.  

#### 🔷 1) 타입 뒤에 대괄호(`[]`) 붙이기

```typescript
// 문자열만 담을 수 있는 배열입니다.
let names: string[] = ["김민수", "이서현", "박지호"];

// 숫자만 담을 수 있는 배열입니다.
let ages: number[] = [25, 30, 22];

// 숫자 배열에 문자열을 추가하면 오류가 발생합니다.
// ages.push("서른");
```

#### 🔷 2) 제네릭 배열 타입(`Array<T>`)

```typescript
// 숫자 배열을 제네릭 문법으로 선언합니다.
let scores: Array<number> = [90, 85, 95];
```

### 🟦 튜플 타입의 엄격한 구조(Tuple Types)

일반 배열은 지정한 요소 타입을 따르지만 길이는 고정하지 않습니다.  
반면 좌표나 이름과 나이의 쌍처럼 정해진 개수와 순서에 따라 서로 다른 타입을 저장해야 할 때는 튜플을 사용할 수 있습니다.  

튜플은 각 위치의 타입과 요소 개수를 명시한 배열 타입입니다.  

```typescript
// 첫 번째 요소는 숫자이고 두 번째 요소는 문자열인 튜플입니다.
let userInfo: [number, string];

userInfo = [1, "김철수"]; // 올바른 값입니다.
// userInfo = ["김철수", 1]; // 요소의 순서와 타입이 달라 오류가 발생합니다.
// userInfo = [1, "김철수", 20]; // 요소 개수가 많아 오류가 발생합니다.
```

튜플은 함수에서 서로 다른 타입의 값을 함께 반환할 때도 사용할 수 있습니다.  

```typescript
function getUser(): [string, number] {
  return ["홍길동", 28];
}

const [name, age] = getUser(); // name은 string, age는 number입니다.
```

## 2. 함수 타입 기초: 매개변수 타입과 반환 타입 명확히 정의하기 {#session-02}

JavaScript에서는 함수의 매개변수나 반환값의 타입을 제한하지 않으므로 잘못된 타입의 값이 전달되어도 실행될 수 있습니다.  
이는 예상하지 못한 오류로 이어질 수 있습니다.  

TypeScript에서는 함수의 매개변수(Parameter)와 반환값(Return Value)에 타입을 명시하여 일부 오류를 실행 전에 확인할 수 있습니다.  

### 🟦 매개변수와 반환값에 타입 지정하기

함수를 선언할 때 각 매개변수 이름 뒤에 타입을 지정하고, 매개변수 괄호 뒤에 콜론(`:`)을 사용하여 반환 타입을 명시할 수 있습니다.  

```typescript
// a와 b는 number이고 반환값도 number입니다.
function add(a: number, b: number): number {
  return a + b;
}

const sum = add(10, 5); // sum은 number로 추론됩니다.

// string 인수는 number 매개변수에 전달할 수 없습니다.
// add(10, "5");
```

### 🟦 선택적 매개변수와 기본값 매개변수

TypeScript에서도 일부 매개변수를 생략할 수 있도록 정의할 수 있습니다.  
이를 위해 선택적 매개변수와 기본값 매개변수를 사용합니다.  

#### 🔷 1) 선택적 매개변수(`?`)

매개변수 이름 뒤에 `?`를 붙이면 해당 매개변수를 생략할 수 있으며, 함수 안에서는 `T | undefined` 타입으로 다룹니다.  
선택적 매개변수는 필수 매개변수 뒤에 위치해야 합니다.  

```typescript
function greet(name: string, message?: string): string {
  if (message) {
    return `${name}님께, ${message}`;
  }
  return `${name}님, 안녕하세요!`;
}

console.log(greet("홍길동")); // "홍길동님, 안녕하세요!"
console.log(greet("홍길동", "오늘 날씨가 좋아요."));
// "홍길동님께, 오늘 날씨가 좋아요."
```

#### 🔷 2) 기본값 매개변수(Default Parameters)

기본값을 지정하면 해당 인수를 생략하거나 `undefined`를 전달했을 때 기본값을 사용합니다.  
필수 매개변수 뒤에 있는 기본값 매개변수는 호출할 때 생략할 수 있습니다.  
기본값 매개변수가 필수 매개변수 앞에 올 수도 있지만, 기본값을 사용하려면 해당 위치에 `undefined`를 명시적으로 전달해야 합니다.  

```typescript
function calculate(price: number, taxRate: number = 0.1): number {
  return price * (1 + taxRate);
}

console.log(calculate(100)); // 약 110
console.log(calculate(100, 0.2)); // 120
```

### 🟦 함수 표현식과 화살표 함수에 타입 적용하기

TypeScript는 다양한 함수 선언 방식에 동일하게 타입을 지정할 수 있습니다.  
익명 함수와 화살표 함수에도 타입을 지정하여 일관된 타입 안전성을 유지할 수 있습니다.  

#### 🔷 1) 함수 표현식(Function Expression)

```typescript
// 1. 함수 선언문입니다.
function greet(name: string): string {
  return `안녕하세요, ${name}님!`;
}

// 2. 함수 표현식입니다.
const greet2 = function (name: string): string {
  return `반가워요, ${name}님!`;
};

// 3. 선택적 매개변수를 사용합니다.
function introduce(name: string, hobby?: string): string {
  if (hobby) {
    return `${name}님은 ${hobby}를 좋아합니다.`;
  }
  return `${name}님의 취미 정보가 없습니다.`;
}

// 4. 기본값 매개변수를 사용합니다.
function discount(price: number, rate: number = 0.1): number {
  return price * (1 - rate);
}

// 5. 반환 타입이 void인 함수입니다.
function logError(message: string): void {
  console.error("오류:", message);
}

// 6. 매개변수가 없는 함수입니다.
function getNow(): Date {
  return new Date();
}

// 7. 객체를 반환하는 함수입니다.
function createUser(name: string, age: number): { name: string; age: number } {
  return {
    name,
    age,
  };
}

// 8. 변수에 할당할 함수의 전체 타입을 지정합니다.
// 두 개의 number 매개변수를 받고 number를 반환해야 합니다.
const addFn: (a: number, b: number) => number = function (a, b) {
  return a + b;
};

console.log("addFn(3, 4):", addFn(3, 4)); // 7
```

#### 🔷 2) 화살표 함수(Arrow Function)

```typescript
// 1. 매개변수에 타입 주석이 있으면 소괄호를 사용합니다.
const sayHello = (name: string): string => {
  return `안녕하세요, ${name}님!`;
};

// 2. 한 줄 표현식은 중괄호와 return을 생략할 수 있습니다.
const double = (x: number): number => x * 2;

// 3. 매개변수가 여러 개이면 소괄호가 필요합니다.
const add = (a: number, b: number): number => {
  return a + b;
};

// 4. 매개변수가 여러 개여도 한 줄 표현식으로 작성할 수 있습니다.
const multiply = (a: number, b: number): number => a * b;

// 5. 반환값이 없는 함수는 void로 지정합니다.
const logMessage = (message: string): void => {
  console.log("메시지:", message);
};

// 6. 선택적 매개변수를 사용합니다.
const greet = (name: string, message?: string): string => {
  return message
    ? `${name}님께, ${message}`
    : `${name}님, 안녕하세요!`;
};

// 7. 기본값 매개변수를 사용합니다.
const calculateTax = (price: number, rate: number = 0.1): number => {
  return price * (1 + rate);
};

// 8. 객체 리터럴을 바로 반환할 때는 소괄호로 감쌉니다.
const createUser = (name: string, age: number) => ({
  name,
  age,
  createdAt: new Date(),
});
```

## 3. 함수 타입 심화: void, never, undefined와 함수 오버로딩 {#session-03}

TypeScript에서는 함수의 반환 타입을 명확히 지정할 수 있습니다.  
특히 `void`, `undefined`, `never`는 값이 없는 것처럼 보이는 함수에서 사용되지만 의미와 용도가 다릅니다.  

하나의 함수 이름을 매개변수의 타입이나 개수에 따라 다른 방식으로 호출할 수 있도록 표현하는 함수 오버로딩(Function Overloading)도 함께 살펴봅니다.  

| 반환 타입 | 의미 | 예시 |
| --- | --- | --- |
| `void` | 호출자가 사용할 반환값이 없음 | 콘솔 출력과 같은 부수 효과 중심의 함수 |
| `undefined` | 반환값이 `undefined`임을 명시 | `undefined`를 반환하는 함수 |
| `never` | 정상적으로 호출 지점에 돌아오지 않음 | 예외를 던지거나 무한 루프를 실행하는 함수 |

### 🟦 `void` 예시: 단순 출력 함수

`void`는 호출자가 사용할 반환값이 없는 함수를 나타냅니다.  
주로 콘솔 출력이나 상태 업데이트처럼 부수 효과(Side Effect)가 중심인 함수에 사용합니다.  

```typescript
function logMessage(message: string): void {
  console.log(`[로그]: ${message}`);
}

logMessage("작업이 완료되었습니다.");
```

### 🟦 `undefined` 예시: 명시적 반환

`undefined` 반환 타입은 함수의 결과가 `undefined`임을 타입으로 명시할 때 사용합니다.  
특별히 `undefined` 반환을 구분할 필요가 없다면 일반적으로 `void`를 사용합니다.  

```typescript
function returnUndefined(): undefined {
  return undefined;
}

const result = returnUndefined(); // result는 undefined 타입입니다.
```

### 🟦 `never` 예시: 도달할 수 없는 분기

`never`는 예외를 던지거나 무한 루프를 실행하는 함수뿐 아니라, 타입을 좁힌 뒤 남을 수 없는 경우를 나타낼 때도 사용합니다.  

> 타입 좁히기(Type Narrowing)는 복합적인 타입에서 조건 검사를 통해 현재 값의 타입을 더 구체적으로 좁히는 과정입니다.  

```typescript
type Shape = "circle" | "square";

function getArea(shape: Shape): number {
  switch (shape) {
    case "circle":
      // 이 분기에서 shape는 "circle"로 좁혀집니다.
      return 3.14 * 10 * 10;
    case "square":
      // 이 분기에서 shape는 "square"로 좁혀집니다.
      return 10 * 10;
    default:
      // 모든 값을 처리했다면 shape는 never로 좁혀집니다.
      return assertNever(shape);
  }
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 값입니다: ${value}`);
}
```

### 🟦 함수 오버로딩(Function Overloading)

함수 오버로딩은 하나의 함수가 여러 매개변수 타입이나 개수로 호출될 수 있음을 타입으로 표현하는 기능입니다.  
JavaScript 구현에서는 런타임에 인수를 검사하고, TypeScript에서는 여러 오버로드 시그니처로 각 호출과 반환 타입의 관계를 표현합니다.  

1. 오버로드 시그니처(Overload Signature)
   - 호출할 수 있는 매개변수와 반환 타입을 본문 없이 정의합니다.
2. 구현 시그니처(Implementation Signature)
   - 모든 오버로드를 처리할 수 있는 실제 함수 구현을 작성합니다.

```typescript
// 1. 오버로드 시그니처를 정의합니다.
function makeId(name: string): number;
function makeId(count: number): string;

// 2. 모든 오버로드를 처리하는 구현을 작성합니다.
function makeId(argument: string | number): number | string {
  if (typeof argument === "string") {
    return argument.length * 10;
  }

  return `ID-${argument}`;
}

const idNumber = makeId("Alice"); // number로 추론됩니다.
const idString = makeId(10); // string으로 추론됩니다.

console.log(idNumber); // 50
console.log(idString); // "ID-10"
```

오버로딩을 사용하면 함수 내부에서는 유니언 타입을 처리하면서 호출하는 쪽에서는 인수에 맞는 반환 타입을 추론할 수 있습니다.  

### 🟦 오버로드 시그니처가 없는 경우

오버로드 없이 구현 시그니처만 공개하면 TypeScript는 인수와 반환 타입의 구체적인 관계를 알 수 없습니다.  
따라서 호출 결과를 `number | string`으로 추론하며, 어느 한 타입에만 있는 메서드를 바로 호출할 수 없습니다.  

```typescript
function makeIdWithoutOverload(
  argument: string | number,
): number | string {
  if (typeof argument === "string") {
    return argument.length * 10;
  }

  return `ID-${argument}`;
}

const id = makeIdWithoutOverload("Alice");

// number | string에는 toUpperCase()를 바로 호출할 수 없습니다.
// console.log(id.toUpperCase());

// number | string에는 toFixed()를 바로 호출할 수 없습니다.
// console.log(id.toFixed(2));
```

![오버로드 시그니처 없이 유니언 반환 타입의 메서드를 호출했을 때의 오류](/assets/images/nodejs/nodejs-typescript/overload-union-return-error.png)

## 4. 함수 타입 별칭과 콜백 타입 정의하기: 재사용 가능한 타입 설계 {#session-04}

TypeScript에서는 함수의 구조에도 타입 별칭을 정의하여 재사용성과 가독성, 유지보수성을 높일 수 있습니다.  
함수의 매개변수와 반환 타입을 함께 표현한 구조를 함수 타입(Function Type) 또는 호출 시그니처(Call Signature)라고 합니다.  

### 🟦 함수 타입 별칭이란?

두 숫자를 받아 숫자를 반환하는 함수가 여러 개 있다면 매번 타입을 작성하는 대신 공통 타입을 정의할 수 있습니다.  

```typescript
// 두 개의 number를 받아 number를 반환하는 함수 타입입니다.
type MathOperation = (x: number, y: number) => number;

// 같은 함수 타입을 여러 함수에 재사용합니다.
const add: MathOperation = (a, b) => a + b;
const subtract: MathOperation = (a, b) => a - b;

console.log(add(10, 5)); // 15
console.log(subtract(10, 3)); // 7

// string 인수는 number 매개변수에 전달할 수 없습니다.
// subtract(10, "5");
```

함수 시그니처에 타입을 적용하면 매개변수나 반환값을 잘못 사용한 경우 컴파일 시점에 확인할 수 있습니다.  

### 🟦 콜백 함수 타입 정의하기

함수를 다른 함수의 인수로 전달할 때도 타입 별칭을 사용하면 콜백의 구조를 명확하게 정의할 수 있습니다.  

```typescript
// number를 받고 호출자가 사용할 반환값이 없는 콜백 타입입니다.
type Callback = (result: number) => void;

// calculator는 두 숫자와 콜백 함수를 인수로 받습니다.
function calculator(a: number, b: number, callback: Callback): void {
  const sum = a + b;
  callback(sum);
}

// Callback 타입에 맞는 함수를 정의합니다.
const printResult: Callback = (result) => {
  console.log(`계산 결과: ${result}`);
};

calculator(20, 30, printResult); // "계산 결과: 50"
```

### 🟦 콜백 타입이 유용한 상황

```typescript
// T 타입의 값을 받아 boolean을 반환하는 콜백 타입입니다.
type Filter<T> = (item: T) => boolean;

const numbers = [1, 2, 3, 4, 5];

// 숫자가 짝수인지 확인하는 Filter<number> 함수입니다.
const isEven: Filter<number> = (number) => number % 2 === 0;

// filter()는 true를 반환한 요소만 새 배열에 남깁니다.
const evenNumbers = numbers.filter(isEven);

console.log(evenNumbers); // [2, 4]
```

제네릭 타입인 `Filter<T>`를 사용하면 여러 데이터 타입에 재사용할 수 있는 콜백 타입을 만들 수 있습니다.  

- `Filter<T>`: `T` 타입의 값을 받아 `boolean`을 반환하는 함수 타입
- `filter()`: 조건을 만족하는 배열 요소만 남기는 메서드
- `isEven()`: 짝수 여부를 판단하는 콜백 함수

### 🟦 함수 타입 별칭 vs 오버로드 시그니처

#### 🔷 1) 함수 타입 별칭

```typescript
type Callback = (result: number) => void;
```

함수 타입 별칭은 특정한 구조의 함수를 가리키는 타입 이름을 정의합니다.  
실제 함수 구현은 별도로 작성해야 합니다.  

#### 🔷 2) 함수 선언 또는 오버로드 시그니처

```typescript
declare function makeId(name: string): number;
```

함수 선언 시그니처는 `makeId`라는 함수가 해당 형태로 호출될 수 있음을 표현합니다.  
실제 함수 오버로딩에서는 여러 오버로드 시그니처 뒤에 모든 경우를 처리하는 하나의 구현이 필요합니다.  

#### 🔷 3) 비교

| 코드 | 역할 | 사용 예 |
| --- | --- | --- |
| `type Callback = (result: number) => void;` | 함수 타입 별칭 정의 | 변수, 매개변수, 프로퍼티의 타입 |
| `declare function makeId(name: string): number;` | 함수 선언 시그니처 | 외부에 존재하는 함수의 호출 형태 선언 |
| `function makeId(name: string): number;` | 오버로드 시그니처 | 구현 앞에서 호출 형태를 세부적으로 정의 |
