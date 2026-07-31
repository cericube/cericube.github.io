---
layout: post
title: "04. TypeScript Union, Literal, Intersection 타입 이해하기"
description: "TypeScript의 유니언, 리터럴, 인터섹션 타입과 typeof, keyof, instanceof를 활용한 타입 좁히기 방법을 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "04"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 유니언 타입(Union Types): 여러 타입 중 하나 허용하기"
  - id: session-02
    title: "2. 리터럴 타입(Literal Types): 특정 값만 허용하기"
  - id: session-03
    title: "3. 인터섹션 타입(Intersection Type): 여러 타입 결합하기"
  - id: session-04
    title: "4. 타입 연산자(typeof, keyof)와 instanceof 이해하기"
---

## 1. 유니언 타입(Union Types): 여러 타입 중 하나 허용하기 {#session-01}

TypeScript에서는 변수나 함수의 매개변수 등이 하나의 타입에만 제한되지 않고 여러 타입 중 하나를 허용하도록 만들 수 있습니다.  
이러한 방식을 유니언 타입(Union Type)이라고 부르며, `타입1 | 타입2`와 같은 형식으로 표현합니다.

### 🟦 유니언 타입 정의와 사용

유니언 타입은 다음과 같이 `|` 기호(수직선)를 사용하여 선언합니다.  
두 개 이상의 타입 중 하나와 일치하면 유효한 값으로 허용합니다.  
실무에서는 사용자 입력값, API 응답, ID 등 여러 형태가 가능한 값을 다룰 때 자주 활용합니다.

```typescript
let priceOrText: number | string;

priceOrText = 10000; // number를 할당할 수 있습니다.
priceOrText = "무료"; // string을 할당할 수 있습니다.

// priceOrText = true; // 오류: boolean 타입은 허용되지 않습니다.
```

### 🟦 타입 좁히기(Type Narrowing): 유니언 타입 안전하게 다루기

유니언 타입을 사용하면 코드를 작성하는 시점에는 값이 어떤 타입인지 확실하지 않을 수 있습니다.  
이러한 경우 TypeScript는 유니언에 포함된 모든 타입에서 안전한 작업만 허용합니다.

예를 들어 `number | string` 타입의 변수에 `toUpperCase()`와 같은 문자열 전용 메서드를 직접 사용하면 TypeScript에서 오류가 발생합니다.  
이 값이 `number`일 수도 있기 때문입니다.  
이럴 때 타입 좁히기(Type Narrowing)를 사용합니다.

#### 🔷 typeof 연산자를 활용한 타입 좁히기

```typescript
function printID(id: number | string) {
  // id가 string이 아닐 수도 있으므로 다음 코드는 오류가 발생합니다.
  // console.log(id.toUpperCase());

  if (typeof id === "string") {
    // 이 블록에서는 id가 string 타입으로 좁혀집니다.
    console.log(`ID는 문자열입니다: ${id.toUpperCase()}`);
  } else {
    // 이 블록에서는 id가 number 타입으로 좁혀집니다.
    console.log(`ID는 숫자입니다: ${id + 10}`);
  }
}

printID(12345); // 출력: ID는 숫자입니다: 12355
printID("abc-xyz"); // 출력: ID는 문자열입니다: ABC-XYZ
```

- `typeof` 연산자를 사용하여 런타임에 값의 타입을 검사할 수 있습니다.
- 검사 결과에 따라 TypeScript는 각 블록 안에서 변수의 타입을 더 구체적으로 인식합니다.
- 이를 통해 유니언 타입으로 선언된 변수도 타입 안정성을 유지하며 다룰 수 있습니다.

## 2. 리터럴 타입(Literal Types): 특정 값만 허용하기 {#session-02}

TypeScript에서는 특정 값 자체를 타입으로 사용하는 리터럴 타입(Literal Type)을 제공합니다.  
이 기능을 사용하면 변수나 함수의 인자에 정해진 값만 허용할 수 있어 코드의 의도와 안정성을 더욱 명확하게 표현할 수 있습니다.

### 🟦 리터럴 타입이란?

리터럴 타입은 문자열, 숫자, 불리언 값처럼 고정된 값 자체를 타입으로 사용합니다.  
UI 컴포넌트의 상태, API 응답 코드, 방향값 등에서 잘못된 값을 사용하는 일을 방지할 때 유용합니다.

### 🟦 문자열 리터럴 타입

```typescript
// Status 타입은 아래 세 가지 값만 허용합니다.
type Status = "pending" | "success" | "error";

let currentStatus: Status = "pending"; // 올바른 값입니다.
currentStatus = "success"; // 올바른 값입니다.

// currentStatus = "finished";
// 오류: Type '"finished"' is not assignable to type 'Status'.
```

```typescript
function updateStatus(status: Status) {
  console.log(`현재 상태는 ${status}입니다.`);
}

updateStatus("error"); // 출력: 현재 상태는 error입니다.
// updateStatus("ready"); // 오류: "ready"는 Status 타입에 포함되지 않습니다.
```

리터럴 타입을 함수의 인자 타입으로 사용하면 허용되지 않은 값으로 함수를 호출하는 실수를 컴파일 단계에서 확인할 수 있습니다.

### 🟦 숫자 및 불리언 리터럴 타입

문자열뿐 아니라 숫자와 불리언 값도 리터럴 타입으로 사용할 수 있습니다.

```typescript
type Direction = 1 | -1;

let move: Direction = 1; // 올바른 값입니다.
move = -1; // 올바른 값입니다.
// move = 0; // 오류: Type '0' is not assignable to type 'Direction'.
```

```typescript
type AlwaysTrue = true;

let flag: AlwaysTrue = true; // 올바른 값입니다.
// flag = false; // 오류: Type 'false' is not assignable to type 'true'.
```

### 🟦 리터럴 타입과 enum 비교

| 항목 | 리터럴 타입 | enum |
| --- | --- | --- |
| 정의 | 고정된 값 자체를 타입으로 사용 | 이름이 있는 상수 집합을 선언 |
| 형태 | `"left"` \| `"right"` | `enum Direction { Left, Right }` |
| 코드 길이 | 짧고 간결함 | 상대적으로 길고 구조화됨 |
| 런타임 코드 | 없음 | 일반적으로 JavaScript 코드가 생성됨 |
| 주요 용도 | 간단한 선택지와 상태값 제한 | 이름이 있는 상수 집합이 필요할 때 |

아래 예제에서는 타입 이름과 변수 이름이 충돌하지 않도록 리터럴 타입과 `enum`에 서로 다른 이름을 사용합니다.

```typescript
// 리터럴 타입
type LiteralStatus = "pending" | "success" | "error";
let literalStatus: LiteralStatus = "pending";

// enum
enum StatusEnum {
  Pending = "pending",
  Success = "success",
  Error = "error",
}

let enumStatus: StatusEnum = StatusEnum.Pending;
```

## 3. 인터섹션 타입(Intersection Type): 여러 타입 결합하기 {#session-03}

### 🟦 인터섹션 타입이란?

인터섹션 타입은 여러 타입을 하나로 결합하여 모든 타입 조건을 동시에 만족하는 새로운 타입을 만드는 방법입니다.  
TypeScript에서는 앰퍼샌드(`&`) 기호를 사용하며, 이는 A 타입과 B 타입을 모두 만족해야 한다는 의미입니다.

### 🟦 인터섹션 타입 정의 및 활용

다음은 두 개의 인터페이스를 인터섹션 타입으로 결합한 예제입니다.

```typescript
interface HasName {
  name: string;
}

interface HasAge {
  age: number;
}

// Person은 HasName과 HasAge를 모두 만족해야 합니다.
type Person = HasName & HasAge;

const myProfile: Person = {
  name: "이아름", // HasName의 속성입니다.
  age: 25, // HasAge의 속성입니다.
};
```

다음은 필요한 속성 중 일부가 누락되어 오류가 발생하는 예제입니다.

```typescript
const partialProfile: Person = {
  name: "김철수",
  // 오류: age 속성이 누락되었습니다.
};
```

인터섹션 타입은 결합한 모든 객체 타입의 속성을 포함해야 합니다.  
필수 속성이 하나라도 누락되면 TypeScript는 오류로 판단합니다.

### 🟦 유니언 타입과 인터섹션 타입 비교

| 구분 | 유니언 타입(`A` \| `B`) | 인터섹션 타입(`A & B`) |
| --- | --- | --- |
| 의미 | A 또는 B 타입의 값을 허용 | A와 B를 모두 만족하는 값을 허용 |
| 객체 타입 예제 | A 또는 B의 구조를 만족하는 객체 | A와 B의 필수 속성을 모두 가진 객체 |
| 기본 타입 예제 | `string` \| `number`는 둘 중 하나를 허용 | `string & number`는 동시에 만족할 수 없어 `never`가 됨 |
| 사용 목적 | 가능한 타입의 범위 확장 | 여러 타입의 조건 결합 |

```typescript
// 유니언 타입: string 또는 number 중 하나를 허용합니다.
let value: string | number;

value = "안녕하세요"; // string 값입니다.
value = 123; // number 값입니다.
// value = true; // 오류: boolean은 허용되지 않습니다.

// 인터섹션 타입: 동시에 만족할 수 없는 기본 타입의 조합입니다.
type Impossible = string & number;
// Impossible 타입은 never로 평가되어 할당할 수 있는 값이 없습니다.
```

## 4. 타입 연산자(typeof, keyof)와 instanceof 이해하기 {#session-04}

TypeScript는 기존에 정의된 값(Value)이나 타입(Type)을 바탕으로 새로운 타입을 만들 수 있는 타입 연산자(Type Operator)를 제공합니다.  
그중 `typeof`와 `keyof`는 제네릭(Generic), 유틸리티 타입, 조건부 타입 등을 이해하는 데 필요한 기본 개념입니다.

| 연산자 | 위치 | 역할 | 사용 예 |
| --- | --- | --- | --- |
| `typeof` | 런타임 | 값의 타입을 문자열로 반환 | 타입 검사, 타입 좁히기 |
| `typeof` | 타입 위치 | 값에서 타입을 추출 | 상수, 객체, 함수의 타입 재사용 |
| `keyof` | 타입 위치 | 객체 타입의 키를 유니언 타입으로 추출 | 안전한 속성 접근 |
| `instanceof` | 런타임 | 특정 클래스나 생성자의 인스턴스인지 검사 | 클래스 기반 타입 좁히기 |

### 🟦 typeof 연산자: 값에서 타입 추출하기

`typeof`는 JavaScript의 연산자이지만 TypeScript에서는 두 가지 문맥에서 사용합니다.

- 런타임에서는 JavaScript와 같이 값의 타입을 나타내는 문자열을 반환합니다.
- 타입 위치(Type Position)에서는 값으로부터 타입을 추출합니다.

두 문맥의 차이를 구분하여 살펴보겠습니다.

#### 🔷 1) 런타임 typeof

런타임 `typeof`는 JavaScript부터 존재한 연산자로, 실행 시점에 값의 타입을 문자열로 반환합니다.  
반환값에는 `"string"`, `"number"`, `"boolean"`, `"object"`, `"undefined"`, `"function"`, `"symbol"`, `"bigint"` 등이 있습니다.

```typescript
const a = 123;
const b = "hello";
const c = () => {};

console.log(typeof a); // "number"
console.log(typeof b); // "string"
console.log(typeof c); // "function"
```

TypeScript에서도 이 동작은 JavaScript와 같으며, 검사 결과를 이용하여 타입을 좁힐 수 있습니다.

```typescript
function printValue(v: number | string) {
  if (typeof v === "string") {
    // 이 블록에서는 v가 string 타입으로 좁혀집니다.
    console.log(v.toUpperCase());
  } else {
    // 이 블록에서는 v가 number 타입으로 좁혀집니다.
    console.log(v.toFixed(2));
  }
}
```

다음부터는 `typeof`를 타입 위치에서 사용하는 방법을 살펴보겠습니다.  
TypeScript에서는 `typeof`를 타입을 선언하는 위치에서도 사용할 수 있습니다.  
이때 `typeof`는 문자열을 반환하지 않고 해당 값의 타입을 가져오는 타입 쿼리(Type Query) 역할을 합니다.

#### 🔷 2) 객체와 변수의 타입 재사용

기존에 선언된 값의 구조를 그대로 타입으로 가져올 수 있습니다.  
객체 구조가 변경되면 이 값에서 추출한 타입에도 변경 사항이 반영되므로 타입을 중복해서 작성하는 일을 줄일 수 있습니다.

```typescript
const userExample = {
  name: "Alice",
  age: 30,
};

type UserFromValue = typeof userExample;
// UserFromValue는 { name: string; age: number } 타입입니다.

const anotherUser: UserFromValue = {
  name: "Bob",
  age: 26,
};
```

#### 🔷 3) 함수 타입 추출

라이브러리 함수나 유틸리티 함수의 시그니처를 그대로 재사용할 때 유용합니다.

```typescript
function greet(name: string): string {
  return `Hello, ${name}`;
}

type GreetFn = typeof greet;
// GreetFn은 (name: string) => string 타입입니다.

const myGreet: GreetFn = (name) => `Hi, ${name}`;
```

#### 🔷 4) as const, typeof와 인덱싱 조합

리터럴 타입과 조합하면 선택 가능한 값을 상수 객체로 관리할 수 있습니다.
> as const가 없으면 StatusValue는 단순히 string이 되어 "PENDING" 같은 값도 허용하게 됩니다.  
> 즉, as const를 사용하는 이유는 객체의 값을 리터럴 타입으로 유지하여 안전한 유니언 타입을 만들기 위해서입니다.

```typescript
const STATUS = {
  READY: "READY",
  DONE: "DONE",
  ERROR: "ERROR",
} as const;

// 키의 유니언 타입은 "READY" | "DONE" | "ERROR"입니다.
type StatusKey = keyof typeof STATUS;

// 값의 유니언 타입도 "READY" | "DONE" | "ERROR"입니다.
type StatusValue = (typeof STATUS)[StatusKey];

function setStatus(status: StatusValue) {
  console.log(`상태: ${status}`);
}

setStatus("DONE");
// setStatus("PENDING"); // 오류: "PENDING"은 StatusValue에 포함되지 않습니다.
```

### 🟦 keyof 연산자: 객체 타입의 키를 유니언으로 추출하기

`keyof`는 객체 타입의 모든 속성 이름을 문자열, 숫자 또는 심벌 리터럴의 유니언 타입으로 추출하는 연산자입니다.  
이를 사용하면 객체에 실제로 존재하는 키만 사용하도록 타입을 제한할 수 있습니다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

type UserKey = keyof User;
// UserKey는 "id" | "name" | "email" 타입입니다.

let firstKey: UserKey = "id";
let secondKey: UserKey = "email";
// let wrongKey: UserKey = "age"; // 오류: "age"는 UserKey에 없습니다.
```

이처럼 `keyof`로 키를 타입으로 추출하면 존재하는 키만 사용하도록 제한할 수 있습니다.

#### 🔷 1) keyof와 제네릭으로 안전한 속성 접근하기

대표적인 활용 방법은 제네릭과 함께 안전한 속성 접근 함수를 만드는 것입니다.

```typescript
function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
};

const nameValue = getValue(user, "name"); // string 타입으로 추론됩니다.
// const wrong = getValue(user, "notExist"); // 오류: 존재하지 않는 키입니다.
```

- `K extends keyof T`에 따라 `key`에는 `T`에 실제로 존재하는 키만 전달할 수 있습니다.
- `T[K]`에 따라 반환 타입은 `obj[key]`의 타입으로 정확히 추론됩니다.

#### 🔷 2) keyof typeof로 상수 객체의 키와 값 활용하기

앞에서 살펴본 `typeof`와 결합하면 상수 객체에서 키와 값의 타입을 추출할 수 있습니다.

```typescript
const PERMISSIONS = {
  READ: "read",
  WRITE: "write",
  DELETE: "delete",
} as const;

type PermissionKey = keyof typeof PERMISSIONS;
// PermissionKey는 "READ" | "WRITE" | "DELETE" 타입입니다.

type PermissionValue = (typeof PERMISSIONS)[PermissionKey];
// PermissionValue는 "read" | "write" | "delete" 타입입니다.

let permissionKey: PermissionKey = "WRITE";
let permissionValue: PermissionValue = "delete";
// permissionValue = "admin"; // 오류: "admin"은 허용되지 않습니다.
```

실제 코드에서 사용하는 상수 객체를 관리하면 키와 값의 타입도 함께 변경되므로 타입과 값이 서로 어긋날 가능성을 줄일 수 있습니다.

### 🟦 instanceof: 런타임 인스턴스 검사와 타입 좁히기

`instanceof`는 JavaScript부터 존재하는 런타임 연산자입니다.  
특정 객체가 어떤 생성자나 클래스의 인스턴스인지 프로토타입 체인을 기준으로 검사합니다.

```typescript
class PersonRecord {
  constructor(public name: string) {}
}

const person = new PersonRecord("Alice");

console.log(person instanceof PersonRecord); // true
console.log(person instanceof Object); // true
console.log(person instanceof Array); // false
```

TypeScript에서는 이 검사 결과를 이용하여 유니언 타입을 안전하게 좁힐 수도 있습니다.

#### 🔷 instanceof를 사용한 타입 좁히기

```typescript
class Dog {
  bark() {
    console.log("멍멍!");
  }
}

class Cat {
  meow() {
    console.log("야옹!");
  }
}

type Animal = Dog | Cat;

function speak(animal: Animal) {
  if (animal instanceof Dog) {
    // 이 블록에서는 animal이 Dog 타입으로 좁혀집니다.
    animal.bark();
  } else {
    // 이 블록에서는 animal이 Cat 타입으로 좁혀집니다.
    animal.meow();
  }
}
```

- `animal instanceof Dog` 조건을 만족하는 블록에서는 `animal`이 `Dog` 타입으로 인식됩니다.
- `else` 블록에서는 `animal`이 `Cat` 타입으로 좁혀집니다.
- 이러한 패턴은 클래스 기반 객체 지향 코드에서 자주 사용합니다.
