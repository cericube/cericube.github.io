---
layout: post
title: "08. TypeScript 문법을 이해하는 쉬운 예제"
description: "개발 초보자가 TypeScript의 연산자, 타입, 함수, 클래스, 제네릭과 비동기 문법을 짧고 독립적인 예제와 상세한 설명으로 이해할 수 있도록 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "08"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 예제를 읽는 방법"
  - id: session-02
    title: "2. 값과 연산자 이해하기"
  - id: session-03
    title: "3. 배열과 객체 다루기"
  - id: session-04
    title: "4. TypeScript 기본 타입 이해하기"
  - id: session-05
    title: "5. interface와 type 이해하기"
  - id: session-06
    title: "6. 함수에 타입 적용하기"
  - id: session-07
    title: "7. 클래스 문법 이해하기"
  - id: session-08
    title: "8. 제네릭과 타입 조작 이해하기"
  - id: session-09
    title: "9. 비동기와 모듈 문법 이해하기"
---

## 1. 예제를 읽는 방법 {#session-01}

이 글의 목적은 하나의 프로그램을 완성하는 것이 아니라 TypeScript 문법을 짧은 예제로 이해하는 것입니다.  
각 코드 블록은 대부분 독립적인 예제이므로 처음부터 끝까지 한 파일에 복사할 필요가 없습니다.  

예제를 읽을 때는 다음 세 가지를 순서대로 확인합니다.  

1. 기호가 무엇을 의미하는지 확인합니다.  
2. TypeScript가 변수나 반환값을 어떤 타입으로 판단하는지 확인합니다.  
3. 실제 개발에서 언제 사용하는지 확인합니다.  

예제 안에서 오류가 발생하는 코드는 주석으로 처리했습니다.  
주석을 해제했을 때 TypeScript가 어떤 오류를 알려 주는지 확인하면 문법을 더 쉽게 이해할 수 있습니다.  

## 2. 값과 연산자 이해하기 {#session-02}

### 🟦 `===`로 타입 변환 없이 비교하기

```typescript
const numberValue = 1;
const stringValue = "1";

// 입력 문자열을 개발자가 의도적으로 숫자로 변환합니다.
const parsedValue = Number(stringValue);

// ===는 자동으로 타입을 변환하지 않고 같은 타입의 값을 비교합니다.
console.log(numberValue === parsedValue); // true
```

`==`는 값의 타입을 자동으로 바꾼 뒤 비교하므로 예상하기 어려운 결과를 만들 수 있습니다.  
TypeScript에서는 입력값을 원하는 타입으로 명확히 변환한 뒤 `===`로 비교하는 것이 좋습니다.  

### 🟦 `Object.is()`의 특별한 숫자 비교

```typescript
const invalidNumber = Number("숫자가 아닙니다");

function strictNumberEquals(left: number, right: number): boolean {
  return left === right;
}

// NaN은 === 방식으로 자기 자신과 비교해도 false입니다.
console.log(strictNumberEquals(invalidNumber, NaN)); // false

// Object.is()는 NaN끼리 같은 값으로 판단합니다.
console.log(Object.is(invalidNumber, NaN)); // true

// ===는 +0과 -0을 같다고 판단합니다.
console.log(+0 === -0); // true

// Object.is()는 +0과 -0을 다르게 판단합니다.
console.log(Object.is(+0, -0)); // false
```

`Object.is()`는 `===`보다 더 엄격한 연산자가 아니라 다른 비교 규칙을 사용하는 함수입니다.  

### 🟦 Truthy와 Falsy 이해하기

```typescript
// 다음 값은 조건문에서 false처럼 동작하는 대표적인 Falsy 값입니다.
console.log(Boolean(false));     // false
console.log(Boolean(0));         // false
console.log(Boolean(""));        // false
console.log(Boolean(null));      // false
console.log(Boolean(undefined)); // false
console.log(Boolean(NaN));       // false

// 빈 배열과 빈 객체는 내용이 없어도 Truthy입니다.
console.log(Boolean([])); // true
console.log(Boolean({})); // true
```

배열이 비었는지 확인할 때는 배열 자체가 아니라 길이를 검사해야 합니다.  

```typescript
const items: string[] = [];

if (items) {
  // 빈 배열도 Truthy이므로 항상 실행됩니다.
}

if (items.length > 0) {
  // 배열에 원소가 있을 때만 실행됩니다.
}
```

### 🟦 `||`와 `??`의 차이

```typescript
const savedVolume = 0;

// ||는 0을 Falsy로 판단하여 기본값으로 바꿉니다.
const volumeWithOr = savedVolume || 50;
console.log(volumeWithOr); // 50

// ??는 null과 undefined만 기본값으로 바꿉니다.
const volumeWithNullish = savedVolume ?? 50;
console.log(volumeWithNullish); // 0
```

`0`, `false`, 빈 문자열도 의미 있는 값이라면 `||`보다 `??`가 안전합니다.  

### 🟦 Optional Chaining으로 안전하게 접근하기

```typescript
interface Profile {
  social?: {
    instagram?: string;
  };
}

const profile: Profile = {};

// social이 없으면 이후 접근을 멈추고 undefined를 반환합니다.
const instagramId = profile.social?.instagram;

// undefined이면 안내 문구를 기본값으로 사용합니다.
const displayId = profile.social?.instagram ?? "등록되지 않음";
```

`?.`는 값이 없을 수 있는 위치에 사용합니다.  
반드시 있어야 하는 값에 무조건 사용하면 실제 오류가 `undefined`로 조용히 넘어갈 수 있습니다.  

### 🟦 논리 대입 연산자 이해하기

```typescript
let userName = "";
userName ||= "익명";
// 왼쪽이 Falsy이므로 "익명"을 대입합니다.

let pageSize: number | undefined;
pageSize ??= 20;
// 왼쪽이 undefined이므로 20을 대입합니다.

let canSend = true;
canSend &&= userName !== "익명";
// 왼쪽이 Truthy이므로 오른쪽 비교 결과를 다시 대입합니다.
```

- `||=`는 왼쪽이 Falsy일 때 대입합니다.  
- `??=`는 왼쪽이 `null` 또는 `undefined`일 때 대입합니다.  
- `&&=`는 왼쪽이 Truthy일 때 오른쪽 결과를 대입합니다.  

## 3. 배열과 객체 다루기 {#session-03}

### 🟦 객체 구조분해

```typescript
interface User {
  id: number;
  name: string;
  nickname?: string;
}

const user: User = {
  id: 1,
  name: "Alice",
};

const {
  name: userName,           // name을 userName이라는 변수명으로 받습니다.
  nickname = "별명 없음", // undefined이면 기본값을 사용합니다.
  ...userWithoutName       // 나머지 속성을 새 객체에 모읍니다.
} = user;
```

구조분해 기본값은 값이 `undefined`일 때만 적용됩니다.  
값이 `null`이면 `null`도 하나의 값으로 취급하므로 기본값으로 바뀌지 않습니다.  

```typescript
const { score = 100 } = { score: null };
console.log(score); // null
```

### 🟦 배열 구조분해와 튜플

```typescript
const colors = ["red", "blue"];
const [firstColor, secondColor] = colors;

// 튜플은 각 위치의 타입과 의미가 정해진 배열입니다.
type Coordinate = [x: number, y: number];

const point: Coordinate = [10, 20];
const [x, y] = point;
```

일반 배열은 같은 종류의 값을 여러 개 저장할 때 사용합니다.  
튜플은 각 위치마다 의미가 다르고 원소 수가 정해져 있을 때 사용합니다.  

### 🟦 Rest와 Spread 구분하기

```typescript
const originalUser = {
  id: 1,
  name: "Alice",
  role: "member",
};

// Rest는 구조분해하고 남은 값을 하나로 모읍니다.
const { role, ...basicUser } = originalUser;

// Spread는 기존 객체의 속성을 새로운 객체에 펼칩니다.
const updatedUser = {
  ...originalUser,
  name: "Bob",
};
```

Spread로 만든 복사본은 얕은 복사입니다.  
객체 안에 또 다른 배열이나 객체가 있으면 내부 값은 원본과 공유할 수 있습니다.  

```typescript
const group = {
  name: "개발팀",
  members: ["Alice"],
};

const copiedGroup = { ...group };
copiedGroup.members.push("Bob");

// members 배열은 공유되므로 원본도 변경됩니다.
console.log(group.members); // ["Alice", "Bob"]
```

### 🟦 값의 종류 판별하기

```typescript
const value: unknown = [1, 2, 3];

// 원시 타입은 typeof로 확인합니다.
if (typeof value === "string") {
  console.log(value.toUpperCase());
}

// 배열은 Array.isArray()로 확인합니다.
if (Array.isArray(value)) {
  console.log(value.length);
}

// 특정 클래스의 인스턴스인지 확인합니다.
if (value instanceof Date) {
  console.log(value.toISOString());
}

// 객체가 직접 소유한 속성인지 확인합니다.
const todo = { id: 1, title: "공부하기" };
console.log(Object.hasOwn(todo, "title")); // true
```

## 4. TypeScript 기본 타입 이해하기 {#session-04}

### 🟦 원시 타입과 배열

```typescript
const title: string = "TypeScript 공부";
const count: number = 3;
const completed: boolean = false;
const uniqueId: symbol = Symbol("id");
const largeNumber: bigint = 9_007_199_254_740_992n;

const tags: string[] = ["typescript", "study"];
const scores: Array<number> = [90, 80, 100];
```

타입 표시는 변수명 뒤에 콜론과 함께 작성합니다.  

```typescript
const 변수명: 타입 = 값;
```

TypeScript가 오른쪽 값을 보고 타입을 정확히 추론할 수 있다면 타입 표시를 생략할 수도 있습니다.  

```typescript
const language = "TypeScript";
// language는 string으로 추론됩니다.
```

### 🟦 `any`와 `unknown`

```typescript
let unsafeValue: any = "hello";

// any는 존재하지 않는 메서드도 허용합니다.
// 컴파일은 되지만 실행 중 오류가 발생할 수 있습니다.
// unsafeValue.notExistingMethod();
// 주석을 해제하면 컴파일은 되지만 실행 중 오류가 발생합니다.

let safeValue: unknown = "hello";

// unknown은 타입을 확인해야 사용할 수 있습니다.
if (typeof safeValue === "string") {
  console.log(safeValue.toUpperCase());
}
```

`any`는 타입 검사를 포기하는 타입이고 `unknown`은 아직 타입을 모른다는 의미입니다.  
외부 입력처럼 신뢰할 수 없는 값에는 `unknown`을 우선 사용하는 것이 좋습니다.  

### 🟦 `void`와 `never`

```typescript
// void는 의미 있는 반환값이 없는 함수에 사용합니다.
function printMessage(message: string): void {
  console.log(message);
}

// never는 정상적으로 끝나지 않는 함수에 사용합니다.
function throwError(message: string): never {
  throw new Error(message);
}
```

`void` 함수는 실행을 마치고 호출 위치로 돌아옵니다.  
`never` 함수는 항상 오류를 던지거나 끝나지 않으므로 정상적인 반환 지점에 도달하지 않습니다.  

### 🟦 리터럴 타입과 유니온

```typescript
type TodoStatus = "todo" | "doing" | "done";
type Identifier = string | number;

const status: TodoStatus = "doing";
const firstId: Identifier = 1;
const secondId: Identifier = "user-1";

// const wrongStatus: TodoStatus = "finished";
// 허용한 문자열이 아니므로 컴파일 오류가 발생합니다.
```

유니온 `|`는 여러 타입 중 하나를 허용한다는 의미입니다.  
리터럴 타입과 함께 사용하면 상태값처럼 허용 범위가 정해진 값을 안전하게 표현할 수 있습니다.  

### 🟦 인터섹션

```typescript
type HasName = {
  name: string;
};

type HasAge = {
  age: number;
};

// &는 양쪽 타입을 모두 만족해야 한다는 의미입니다.
type Person = HasName & HasAge;

const person: Person = {
  name: "Alice",
  age: 20,
};
```

## 5. interface와 type 이해하기 {#session-05}

### 🟦 객체의 모양 정의하기

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  description?: string;
}

const product: Product = {
  id: 1,
  name: "키보드",
  price: 50_000,
};
```

`interface`는 객체가 가져야 할 속성과 각 속성의 타입을 정의합니다.  
`description?`처럼 물음표를 붙이면 해당 속성을 생략할 수 있습니다.  

### 🟦 interface 확장하기

```typescript
interface BasicUser {
  id: number;
  name: string;
}

interface AdminUser extends BasicUser {
  permissions: string[];
}

const admin: AdminUser = {
  id: 1,
  name: "관리자",
  permissions: ["read", "write"],
};
```

`extends`는 기존 인터페이스의 속성을 물려받고 새로운 속성을 추가합니다.  

### 🟦 `interface`와 `type` 선택 기준

```typescript
// 객체 구조는 interface로 표현할 수 있습니다.
interface UserProfile {
  id: number;
  name: string;
}

// 문자열 조합이나 튜플은 type으로 표현합니다.
type Role = "admin" | "member";
type NameAndAge = [name: string, age: number];
```

객체도 `type`으로 작성할 수 있으므로 절대적인 규칙은 아닙니다.  
처음에는 객체의 구조에는 `interface`, 유니온과 튜플에는 `type`을 사용하는 기준으로 시작하면 이해하기 쉽습니다.  

## 6. 함수에 타입 적용하기 {#session-06}

### 🟦 매개변수와 반환 타입

```typescript
function add(a: number, b: number): number {
  return a + b;
}

//         매개변수 타입             반환 타입
//               ↓                      ↓
type Calculator = (x: number, y: number) => number;

const subtract: Calculator = (x, y) => x - y;
```

함수 괄호 안에는 매개변수 타입을 작성하고 괄호 뒤에는 반환 타입을 작성합니다.  

### 🟦 객체를 반환하는 화살표 함수

```typescript
interface Point {
  x: number;
  y: number;
}

// 객체를 바로 반환할 때는 객체를 괄호로 감쌉니다.
const createPoint = (x: number, y: number): Point => ({
  x,
  y,
});
```

괄호가 없으면 중괄호가 반환할 객체가 아니라 함수 본문으로 해석될 수 있습니다.  

### 🟦 기본 매개변수와 선택적 매개변수

```typescript
function greet(
  name: string,
  greeting: string = "안녕하세요",
  suffix?: string,
): string {
  const suffixText = suffix ? ` ${suffix}` : "";
  return `${greeting}, ${name}님${suffixText}`;
}

greet("Alice");
greet("Alice", "반갑습니다", "오늘도 좋은 하루 보내세요.");
```

- `greeting = "안녕하세요"`는 인수를 생략했을 때 사용할 기본값입니다.  
- `suffix?`는 인수 자체를 생략할 수 있다는 의미입니다.  

### 🟦 Rest 매개변수

```typescript
function sum(...numbers: number[]): number {
  return numbers.reduce((total, number) => total + number, 0);
}

sum(1, 2, 3, 4); // 10
```

`...numbers`는 여러 숫자 인수를 하나의 `number[]` 배열로 모읍니다.  
Rest 매개변수는 항상 마지막에 작성해야 합니다.  

### 🟦 함수 오버로딩

```typescript
function format(value: number): string;
function format(value: Date): string;
function format(value: number | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.toLocaleString("ko-KR");
}
```

위의 두 줄은 호출 가능한 입력 형태를 설명하는 오버로드 시그니처입니다.  
마지막 함수는 실제 구현부이며 모든 입력 타입을 처리해야 합니다.  

## 7. 클래스 문법 이해하기 {#session-07}

### 🟦 필드, 생성자와 메서드

```typescript
class Counter {
  private value = 0;

  constructor(public readonly name: string) {}

  increase(): void {
    this.value += 1;
  }

  get count(): number {
    return this.value;
  }
}

const counter = new Counter("방문자 수");
counter.increase();
console.log(counter.count); // 1
```

- `private value`는 클래스 내부에서만 접근할 수 있습니다.  
- 생성자 매개변수의 `public`은 필드 선언과 초기화를 한 번에 처리합니다.  
- `readonly name`은 초기화한 뒤 다시 할당할 수 없습니다.  
- Getter는 `counter.count`처럼 속성을 읽는 문법으로 사용합니다.  

### 🟦 Setter로 값 검사하기

```typescript
class Temperature {
  private _celsius = 0;

  get celsius(): number {
    return this._celsius;
  }

  set celsius(value: number) {
    if (value < -273.15) {
      throw new RangeError("절대 영도보다 낮을 수 없습니다.");
    }

    this._celsius = value;
  }
}
```

Setter는 외부에서 값을 대입하는 문법을 유지하면서 저장 전에 검증 로직을 실행할 수 있습니다.  

### 🟦 상속과 `super`

```typescript
class Animal {
  constructor(protected name: string) {}

  introduce(): string {
    return `이름은 ${this.name}입니다.`;
  }
}

class Dog extends Animal {
  constructor(name: string, private breed: string) {
    super(name);
  }

  introduce(): string {
    return `${super.introduce()} 품종은 ${this.breed}입니다.`;
  }
}
```

`extends`는 부모 클래스의 필드와 메서드를 물려받습니다.  
`super()`는 부모 생성자를 호출하고 `super.introduce()`는 부모 메서드를 호출합니다.  

### 🟦 추상 클래스와 `implements`

```typescript
abstract class Shape {
  abstract calculateArea(): number;
}

interface Printable {
  print(): void;
}

class Square extends Shape implements Printable {
  constructor(private size: number) {
    super();
  }

  calculateArea(): number {
    return this.size ** 2;
  }

  print(): void {
    console.log(`넓이는 ${this.calculateArea()}입니다.`);
  }
}
```

추상 클래스는 공통 기반을 제공하면서 자식 클래스가 특정 메서드를 구현하도록 강제합니다.  
`implements Printable`은 `Printable` 인터페이스의 계약을 지키겠다는 의미입니다.  

## 8. 제네릭과 타입 조작 이해하기 {#session-08}

### 🟦 제네릭 함수

```typescript
function identity<Value>(value: Value): Value {
  return value;
}

const text = identity("hello"); // string으로 추론됩니다.
const number = identity(123);   // number로 추론됩니다.
```

`Value`는 함수를 호출할 때 결정되는 타입 매개변수입니다.  
입력 타입을 그대로 반환 타입에 연결하므로 `any`와 달리 타입 정보를 잃지 않습니다.  

### 🟦 제네릭 제약 조건

```typescript
interface HasLength {
  length: number;
}

function printLength<Value extends HasLength>(value: Value): Value {
  console.log(value.length);
  return value;
}

printLength("hello");
printLength([1, 2, 3]);
// printLength(123); // number에는 length가 없으므로 오류가 발생합니다.
```

`extends HasLength`는 `Value`가 반드시 `length` 속성을 가져야 한다는 제약 조건입니다.  

### 🟦 `keyof`로 실제 키만 허용하기

```typescript
function getProperty<ObjectType, Key extends keyof ObjectType>(
  object: ObjectType,
  key: Key,
): ObjectType[Key] {
  return object[key];
}

const book = {
  title: "TypeScript 입문",
  pages: 300,
};

const bookTitle = getProperty(book, "title");
// getProperty(book, "price"); // 존재하지 않는 키이므로 오류가 발생합니다.
```

`keyof ObjectType`은 객체가 실제로 가진 키의 유니온입니다.  
반환 타입 `ObjectType[Key]`는 선택한 키에 해당하는 값의 타입입니다.  

### 🟦 타입 가드

```typescript
interface SuccessResult {
  success: true;
  data: string;
}

interface FailureResult {
  success: false;
  error: string;
}

type Result = SuccessResult | FailureResult;

function isSuccess(result: Result): result is SuccessResult {
  return result.success;
}

function printResult(result: Result): void {
  if (isSuccess(result)) {
    console.log(result.data);
  } else {
    console.error(result.error);
  }
}
```

`result is SuccessResult`는 함수가 `true`를 반환한 분기에서 타입을 `SuccessResult`로 좁혀 줍니다.  

### 🟦 `satisfies`

```typescript
type Status = "todo" | "done";

const labels = {
  todo: "할 일",
  done: "완료",
} as const satisfies Record<Status, string>;
```

`satisfies`는 객체가 대상 타입과 호환되는지 검사합니다.  
`as const`를 함께 사용하면 객체의 문자열 값을 구체적인 리터럴 타입으로 보존합니다.  

### 🟦 조건부 타입과 `infer`

```typescript
type ElementType<Value> =
  Value extends Array<infer Element> ? Element : Value;

type StringElement = ElementType<string[]>; // string
type NumberValue = ElementType<number>;     // number
```

조건부 타입은 `조건 ? 참일 때 타입 : 거짓일 때 타입` 형태입니다.  
`infer Element`는 배열 안에 들어 있는 원소 타입을 추론하여 새 이름으로 사용할 수 있게 합니다.  

### 🟦 매핑된 타입과 유틸리티 타입

```typescript
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

// 모든 속성을 선택적으로 만듭니다.
type TodoUpdate = Partial<Todo>;

// 필요한 속성만 선택합니다.
type TodoSummary = Pick<Todo, "id" | "title">;

// 지정한 속성을 제외합니다.
type NewTodo = Omit<Todo, "id">;

// 모든 속성을 읽기 전용으로 만듭니다.
type ReadonlyTodo = Readonly<Todo>;

// 모든 키를 순회하며 값 타입을 boolean으로 바꿉니다.
type TodoFlags = {
  [Key in keyof Todo]: boolean;
};
```

유틸리티 타입은 원본 타입을 실제로 변경하지 않고 새로운 타입을 만듭니다.  
런타임 객체의 속성을 제거하거나 객체를 동결하는 기능은 아닙니다.  

## 9. 비동기와 모듈 문법 이해하기 {#session-09}

### 🟦 Promise와 `async`/`await`

```typescript
interface User {
  id: number;
  name: string;
}

function fetchUser(id: number): Promise<User> {
  return Promise.resolve({
    id,
    name: "Alice",
  });
}

async function printUser(id: number): Promise<void> {
  const user = await fetchUser(id);
  console.log(user.name);
}
```

`Promise<User>`는 나중에 `User` 값이 준비된다는 의미입니다.  
`async` 함수는 항상 Promise를 반환하며 `await`는 Promise가 완료된 값을 꺼냅니다.  

### 🟦 비동기 오류 처리

```typescript
async function safePrintUser(id: number): Promise<void> {
  try {
    const user = await fetchUser(id);
    console.log(user.name);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
      return;
    }

    console.error("알 수 없는 오류가 발생했습니다.");
  }
}
```

JavaScript에서는 `Error` 객체가 아닌 문자열이나 숫자도 던질 수 있습니다.  
오류를 `unknown`으로 받은 뒤 `instanceof Error`로 확인하면 안전하게 `message`에 접근할 수 있습니다.  

### 🟦 여러 Promise 처리하기

```typescript
async function comparePromiseMethods(): Promise<void> {
  const userPromise = fetchUser(1);
  const anotherUserPromise = fetchUser(2);

  // 두 결과가 모두 필요할 때 사용합니다.
  const users = await Promise.all([
    userPromise,
    anotherUserPromise,
  ]);

  // 가장 먼저 끝난 결과가 필요할 때 사용합니다.
  const firstUser = await Promise.race([
    userPromise,
    anotherUserPromise,
  ]);

  // 일부 실패를 허용하고 모든 결과를 확인할 때 사용합니다.
  const results = await Promise.allSettled([
    userPromise,
    Promise.reject(new Error("요청 실패")),
  ]);

  console.log({ users, firstUser, results });
}
```

| 메서드 | 동작 | 사용하는 상황 |
| --- | --- | --- |
| `Promise.all()` | 모두 성공해야 성공 | 모든 결과가 필요한 병렬 요청 |
| `Promise.race()` | 가장 먼저 끝난 결과 반환 | 시간 제한 또는 가장 빠른 응답 |
| `Promise.allSettled()` | 성공과 실패에 관계없이 모두 대기 | 일부 실패를 허용하는 작업 |

### 🟦 Named Export와 Default Export

```typescript
// math.ts
export const PI = 3.14159;

export function add(a: number, b: number): number {
  return a + b;
}

class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}

export default Calculator;
```

```typescript
// app.ts
import Calculator, { PI, add } from "./math.js";

const calculator = new Calculator();
console.log(add(1, 2));
console.log(calculator.multiply(3, 4));
```

Default Export는 중괄호 없이 가져오고 Named Export는 중괄호 안에 작성합니다.  

### 🟦 `import type`

```typescript
// User는 타입으로만 사용하므로 import type으로 가져옵니다.
import type { User } from "./types.js";

// createUser는 실행 시 필요한 값이므로 일반 import로 가져옵니다.
import { createUser } from "./user-service.js";
```

`import type`으로 가져온 선언은 컴파일된 JavaScript에서 제거됩니다.  
클래스 생성이나 함수 호출처럼 런타임에 필요한 값은 일반 `import`를 사용해야 합니다.  

처음에는 모든 문법을 한 번에 외우려고 하지 않는 것이 좋습니다.  
변수와 함수 타입부터 익힌 뒤 객체, 클래스, 제네릭, 비동기 순서로 학습 범위를 넓히면 각 문법의 역할을 더 쉽게 파악할 수 있습니다.  
