---
layout: post
title: "08. TypeScript 실무 문법 정리"
description: "JavaScript 연산자부터 TypeScript 타입 시스템, 함수, 클래스, 제네릭, 고급 타입, 비동기 처리와 ESM까지 실무에서 자주 쓰는 문법을 한 번에 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "08"
ai_assisted: true
toc:
  - id: part1
    title: "1. JS 연산자 기본기 - TS 코드에서도 그대로 쓰인다"
  - id: part2
    title: "2. 타입 시스템의 뼈대"
  - id: part3
    title: "3. 함수에 타입 입히기"
  - id: part4
    title: "4. 클래스와 객체지향"
  - id: part5
    title: "5. 제네릭"
  - id: part6
    title: "6. 고급 타입 조작 - 실무 차별화 포인트"
  - id: part7
    title: "7. 비동기 프로그래밍"
  - id: part8
    title: "8. 모듈 시스템 (ESM)"
  - id: cheatsheet
    title: "9. 한눈에 보는 요약 치트시트"
---

## 1. JS 연산자 기본기 - TS 코드에서도 그대로 쓰인다 {#part1}

TypeScript는 JavaScript에 타입을 더한 언어입니다.  
아래 연산자들은 타입 시스템과 무관하게 **매일 사용하는 로직 자체**이므로 가장 먼저 확실히 익히는 것이 좋습니다.  

### 1.1 ⭐ 비교 연산자: `==` vs `===` vs `Object.is()`

- `==`: 타입을 자동 변환한 뒤 비교하므로 실무에서는 사용을 지양합니다.  
- `===`: 타입과 값이 모두 같아야 `true`이며, 기본적으로 이 연산자를 사용합니다.  
- `Object.is()`: `===`와 다른 SameValue 비교이며, `NaN`과 `+0/-0` 처리에서만 차이가 있습니다.  

| 구분 | `===` | `Object.is()` |
|---|---|---|
| `NaN` vs `NaN` | `false` | `true` |
| `+0` vs `-0` | `true` | `false` |

```typescript
console.log(NaN === NaN);        // false
console.log(Object.is(NaN, NaN)); // true - React 등 라이브러리의 내부 상태 비교에 사용합니다.

const box = [1, 5, NaN];
box.indexOf(NaN);   // -1  (=== 기반이므로 NaN을 찾지 못합니다.)
box.includes(NaN);  // true (SameValueZero 알고리즘을 사용합니다.)
```

**실무 포인트**: 배열에서 `NaN`을 찾을 때는 `indexOf` 대신 `includes`를 사용합니다.  

---

### 1.2 ⭐ Truthy / Falsy와 단축 평가: `||`, `&&`

JavaScript의 `||`, `&&`는 Boolean 값을 만드는 것이 아니라 **피연산자 중 하나를 그대로 반환**합니다.  

**일반적으로 사용하는 Falsy 원시 값은 8개이며, 나머지는 모두 Truthy입니다.**  
`false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`

> 브라우저 환경에는 하위 호환성을 위해 Falsy로 취급되는 예외적인 객체인 `document.all`도 있습니다.  

```typescript
// 자주 실수하는 부분으로, 빈 배열과 빈 객체도 Truthy입니다.
Boolean([]); // true
Boolean({}); // true

let items: string[] = [];
if (items) { /* 배열이 비어 있어도 항상 실행됩니다. */ }
if (items.length > 0) { /* 배열의 길이를 확인해야 안전합니다. */ }
```

- `||`: 왼쪽부터 검사하여 **첫 Truthy**를 반환하고, 없으면 마지막 피연산자를 반환합니다. 기본값 설정에 사용합니다.  
- `&&`: 왼쪽부터 검사하여 **첫 Falsy**를 반환하고, 없으면 마지막 피연산자를 반환합니다. 안전한 조건부 접근에 사용합니다.  

```typescript
const userName = name || "익명"; // 기본값을 설정합니다.
const value = user && user.profile && user.profile.name; // 옵셔널 체이닝 등장 전의 안전한 접근 방식입니다.
```

**⚠️ `||`의 함정**: `0`, `false`, `""`처럼 의도한 Falsy 값도 무조건 대체됩니다. 이 문제를 해결하기 위해 `??`가 도입되었습니다(1.3 참고).

---

### 1.3 ⭐ 진짜 기본값 처리: Nullish 병합 `??`

`??`는 오직 `null` / `undefined`일 때만 오른쪽 값을 채택합니다. `0`, `false`, `""`는 유효한 값으로 인정하고 그대로 통과시킵니다.  

```typescript
console.log(0 || "default");   // "default"  ← 버그가 발생할 수 있는 지점입니다.
console.log(0 ?? "default");   // 0          ← 의도한 대로 동작합니다.

let fontSize: number | null = 0;
const displaySize = fontSize ?? 16; // 0으로 정상 처리됩니다.
```

**선택 기준**
- `||`: 값이 비었거나 `0`, `false`, 빈 문자열이면 대체하려는 경우에만 사용합니다.  
- `??`: 실제로 할당되지 않은 경우(`null` 또는 `undefined`)에만 대체하며, 대부분의 기본값 처리에 적합합니다.  

---

### 1.4 ⭐ 안전한 접근: Optional Chaining `?.`

`?.` 앞의 값이 `null`/`undefined`이면 즉시 `undefined`를 반환하고 뒤 연산을 멈춥니다. `??`와 함께 쓰는 조합이 실무에서 가장 많이 등장합니다.  

```typescript
// 중첩 객체에 안전하게 접근합니다.
const instaId = apiResult?.payload?.user?.profile?.sns?.instagram ?? "아이디 없음";

// 함수 또는 콜백이 있을 때만 안전하게 실행합니다.
config?.onSuccess?.();

// 배열 인덱스 접근에도 사용할 수 있습니다.
const firstTitle = searchResult?.items?.[0]?.title ?? "검색 결과가 없습니다";
```

**주의**: `user.id`처럼 **반드시 존재해야 하는 값**에 습관적으로 `?.`를 붙이면 실제 버그가 조용히 `undefined`로 처리되어 디버깅하기 어려워집니다. 필수 값에는 사용하지 않는 것이 좋습니다.  

---

### 1.5 🔸 복합 대입 연산자: `||=`, `&&=`, `??=`

| 연산자 | 의미 | 예시 |
|---|---|---|
| `||=` | 왼쪽이 Falsy일 때만 대입 | `a ||= 10` |
| `&&=` | 왼쪽이 Truthy일 때만 대입 | `a &&= 10` |
| `??=` | 왼쪽이 Nullish일 때만 대입 | `a ??= 10` |

캐시를 초기화하거나 옵션의 기본값을 채울 때 `if` 문을 줄일 수 있습니다.  

---

### 1.6 🔸 타입·구조 판별: `typeof`, `instanceof`, `Array.isArray`, `Object.hasOwn`

```typescript
// 원시 타입은 typeof로 빠르고 안전하게 판별할 수 있습니다.
typeof "hi" === "string";
typeof null === "object"; // ⚠️ 언어 설계상의 예외이므로 null은 직접 비교해야 합니다(value === null).

// 배열은 typeof로 구분할 수 없으므로 Array.isArray를 사용합니다.
Array.isArray([1, 2, 3]); // true

// 클래스와 에러는 instanceof로 판별합니다.
try { throw new TypeError("타입 에러"); }
catch (err) {
  if (err instanceof TypeError) { /* ... */ }
  else if (err instanceof Error) { /* ... */ }
}

// in은 상속받은 속성까지 확인하고, Object.hasOwn은 직접 소유한 속성만 확인합니다.
"toString" in {};               // true (상속됨)
Object.hasOwn({}, "toString");  // false (직접 소유 아님)
```

---

### 1.7 ⭐ 구조분해 / Rest / Spread

```typescript
// 객체 구조분해로 변수명을 변경하고 기본값을 지정합니다.
const user = { id: 1, name: "Alice" };
const { name: userName, sns = "None" } = user;

// ⚠️ 기본값은 undefined일 때만 적용됩니다. null은 값으로 취급됩니다.
const { score = 100 } = { score: null }; // score는 100이 아니라 null입니다.
const { point = 50 } = { point: undefined }; // point는 50입니다.

// 배열 구조분해는 순서를 기준으로 하며, 값 교환에도 사용할 수 있습니다.
let [a, b] = ["Coffee", "Tea"];
[a, b] = [b, a]; // swap

// Rest는 나머지 요소를 하나로 묶으며 항상 마지막에 위치합니다.
const { theme, ...rest } = { theme: "dark", fontSize: 16 };
function sum(...numbers: number[]) { return numbers.reduce((a, c) => a + c, 0); }

// Spread는 얕은 복사와 불변성 유지 패턴에 사용합니다.
const updatedUser = { ...user, name: "New Name" };

// ⚠️ 얕은 복사에서는 내부 참조 타입인 배열과 객체가 공유됩니다.
const group = { title: "Team A", members: ["Kim"] };
const groupCopy = { ...group };
groupCopy.members.push("Park");
console.log(group.members); // ["Kim", "Park"] - 원본도 함께 변경됩니다.
```

---

## 2. 타입 시스템의 뼈대 {#part2}

### 2.1 ⭐ 원시 타입

```typescript
const userName: string = "TS Learner";
const decimal: number = 25.5;
let isActive: boolean = true;
let data: string | null = null;          // strictNullChecks 환경의 표준 패턴입니다.
const uniqueId: symbol = Symbol("id");    // 매번 고유한 값입니다.
const bigNumber: bigint = 9007199254740991n + 1n;
```

### 2.2 ⭐ 특수 타입: `any` vs `unknown` vs `void` vs `never`

| 타입 | 설명 | 실무 지침 |
|---|---|---|
| `any` | 모든 타입 허용, 타입 체크 무력화 | 사용을 지양하고, 부득이한 경우 범위 최소화 |
| `unknown` | 사용 전 반드시 타입 좁히기 필요 | 외부 입력값(API 응답 등)에 `any` 대신 사용 |
| `void` | 함수가 값을 반환하지 않음 | 콜백/이벤트 핸들러 시그니처에 사용 |
| `never` | 절대 도달 불가능한 경로 | 예외를 항상 던지는 함수, switch exhaustiveness 체크 |

```typescript
let userInput: unknown = "Hello";

// unknown은 타입 가드 없이 바로 사용할 수 없습니다.
if (typeof userInput === "string") {
  userInput.toUpperCase(); // 이 블록 안에서만 안전하게 사용할 수 있습니다.
}
```

### 2.3 🔸 배열과 튜플

```typescript
const fruits: string[] = ["apple", "banana"];
const scores: Array<number> = [90, 85];

// 튜플은 순서와 개수가 고정된 배열입니다.
let profile: [string, number, boolean];
profile = ["Alice", 30, true];
```

### 2.4 ⭐ `interface` vs `type` - 언제 무엇을 쓸까

| 구분 | interface | type |
|---|---|---|
| 확장 | `extends` | `&` (인터섹션) |
| 선언적 병합 | 가능 (동일 이름 자동 병합) | 불가능 (오류) |
| 적용 범위 | 객체/클래스 구현 | 원시·유니온·튜플 등 모든 타입 |
| 주 용도 | 객체 구조, 클래스 계약, 라이브러리 타입 | 유니온/튜플에 이름 붙이기, 타입 매핑 |

```typescript
interface Point { x: number; y: number; }
interface Point3D extends Point { z: number; }

type ID = string | number;
type Coordinate = [number, number];
type Manager = Employee & { reportsTo: ID }; // 인터섹션으로 결합합니다.
```

**실무 지침**: 객체 형태나 클래스 계약에는 `interface`를 사용하고, 유니온·튜플·매핑처럼 유연한 타입 조합이 필요하면 `type`을 사용할 수 있습니다. 팀에 따라 객체에는 항상 `interface`를 사용하는 컨벤션을 정하기도 합니다.  
객체 타입은 둘 다 작성할 수 있으므로, 절대적인 규칙이라기보다 권장 기준과 팀 컨벤션에 가깝습니다.  

### 2.5 ⭐ 유니온 `|` / 인터섹션 `&`

```typescript
type Numeric = string | number; // 두 타입 중 하나를 허용합니다.
function printID(id: Numeric) {
  if (typeof id === "string") id.toUpperCase(); // 타입을 좁힌 뒤에 고유 메서드에 접근할 수 있습니다.
}

type IntersectedPerson = HasName & HasAge; // 두 타입을 모두 만족해야 합니다.
```

### 2.6 🔸 리터럴 타입

```typescript
type Direction = "up" | "down" | "left" | "right";
type StatusCode = 200 | 404 | 500;

function setDirection(dir: Direction) { /* dir은 네 값 중 하나만 허용합니다. */ }
```

허용 값이 제한된 문자열이나 숫자(상태값, HTTP 코드 등)를 함수 인자로 받을 때 `string`이나 `number`보다 훨씬 안전합니다.  

---

## 3. 함수에 타입 입히기 {#part3}

### 3.1 ⭐ 함수 시그니처 기본

```typescript
function add(a: number, b: number): number { return a + b; }

// 함수 타입을 변수에 먼저 정의합니다.
type Calculator = (x: number, y: number) => number;
const subtract: Calculator = (a, b) => a - b;
```

### 3.2 ⭐ 화살표 함수 - 객체 리터럴 반환 함정

```typescript
type Coordinates = { x: number; y: number };

// ❌ 잘못된 사용: {}가 함수 본문으로 해석되어 undefined를 반환합니다.
const bad = (x: number) => { x: x };

// ✅ 올바른 사용: 괄호로 감싸야 객체 리터럴로 인식됩니다.
const createCoord = (x: number, y: number): Coordinates => ({ x, y });
```

고차 함수(`map`/`filter`/`reduce`)와 결합하여 매일 사용하게 되는 패턴입니다.  

### 3.3 ⭐ 선택적 매개변수 `?`와 기본값

```typescript
function greet(firstName: string, lastName?: string): string {
  return lastName ? `Hello, ${firstName} ${lastName}!` : `Hello, ${firstName}!`;
}

function getArray(item: string, count: number = 10): string[] {
  return new Array(count).fill(item);
}
```

### 3.4 🔸 Rest 파라미터

```typescript
function sumAll(...numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}
```

### 3.5 ▫️ 함수 오버로딩

호출 시그니처(입력 → 출력 타입 매핑)를 여러 개 정의하고, 마지막에 실제 구현부인 가장 넓은 유니온 타입을 둡니다.  

```typescript
function convert(input: string): string;
function convert(input: number): number;
function convert(input: Date): string;
function convert(input: string | number | Date): string | number {
  if (typeof input === "string") return input.toUpperCase();
  if (typeof input === "number") return input * 2;
  if (input instanceof Date) return input.toISOString();
  throw new Error("Unsupported input type.");
}
```

함수 오버로딩은 라이브러리의 공개 API를 설계할 때 자주 필요하지만, 내부 로직용 함수에는 과도할 수 있습니다.  

### 3.6 🔸 제네릭 함수

```typescript
function identity<T>(arg: T): T { return arg; }

let output = identity("my string"); // T는 string으로 자동 추론됩니다.
```

---

## 4. 클래스와 객체지향 {#part4}

### 4.1 ⭐ 접근 제어자 & Getter/Setter

```typescript
class Employee {
  constructor(
    public name: string, // 어디서든 접근할 수 있으며 기본값입니다.
    private _salary: number, // 클래스 내부에서만 접근할 수 있습니다.
    protected hireYear: number, // 클래스와 자식 클래스에서만 접근할 수 있습니다.
    readonly salaryGrade: "A" | "B" | "C" = "B", // 초기화한 뒤에는 수정할 수 없습니다.
  ) {}

  get salary(): number { return this._salary * (1 + this.getBonusRate()); }
  set salary(v: number) {
    if (v < 0) { console.error("급여는 음수가 될 수 없습니다."); return; }
    this._salary = v;
  }

  private getBonusRate(): number {
    return this.salaryGrade === "A" ? 0.15 : 0;
  }
}
```

**실무 포인트**: 위 예시처럼 생성자 매개변수에 접근 제어자(`public`/`private` 등)를 바로 붙이면 필드 선언과 초기화를 한 번에 끝낼 수 있습니다.  

### 4.2 🔸 상속과 `super`

```typescript
class SavingsAccount extends Account {
  private interestRate: number;

  constructor(name: string, balance: number, accNum: string, rate: number) {
    super(name, balance, accNum); // 부모 생성자를 반드시 호출합니다.
    this.interestRate = rate;
  }

  // 메서드를 오버라이딩하고 부모 메서드를 참조합니다.
  public introduce(): string {
    return `${super.getMaskedNumber()} / rate ${this.interestRate}`;
  }
}
```

### 4.3 🔸 추상 클래스 (`abstract`)

```typescript
abstract class Shape {
  abstract name: string;            // 자식 클래스에서 반드시 구현합니다.
  abstract calculateArea(): number; // 자식 클래스에서 반드시 구현합니다.
  getInfo(): string { return `This is a ${this.name} shape.`; } // 공통 로직입니다.
}

class Circle extends Shape {
  name = "Circle";
  constructor(private radius: number) { super(); }
  calculateArea() { return Math.PI * this.radius ** 2; }
}
// new Shape() // ❌ 추상 클래스는 인스턴스화할 수 없습니다.
```

공통 로직은 상속하고 클래스마다 구현이 달라야 하는 부분만 강제할 때 사용합니다.  

### 4.4 🔸 인터페이스 구현 (`implements`)

```typescript
interface Logger {
  log(message: string): void;
  level: "info" | "warn" | "error";
}

class ConsoleLogger implements Logger {
  level: "info" | "warn" | "error" = "info";
  log(message: string): void { console.log(`[${this.level}] ${message}`); }
}
```

`interface`는 계약을 정의하고, `implements`는 클래스가 해당 계약을 준수한다는 것을 선언합니다. 이는 DI(의존성 주입) 설계의 기본 패턴입니다.  

---

## 5. 제네릭 {#part5}

### 5.1 ⭐ 제네릭 인터페이스 / 클래스

```typescript
interface Box<T> { value: T; read(): T; }
const stringBox: Box<string> = { value: "Generics", read() { return this.value; } };

class Queue<T> {
  private items: T[] = [];
  enqueue(item: T): void { this.items.push(item); }
  dequeue(): T | undefined { return this.items.shift(); }
}
const taskQueue = new Queue<{ id: number }>();
```

제네릭은 상태 관리나 API 응답 래퍼처럼 재사용할 수 있는 컬렉션 또는 래퍼 타입을 만들 때 필수적입니다.  

### 5.2 ⭐ 제네릭 제약조건 `extends`

```typescript
interface Lengthwise { length: number; }

function loggingIdentity<T extends Lengthwise>(arg: T): T {
  console.log(arg.length); // length 속성이 보장되므로 안전합니다.
  return arg;
}
loggingIdentity("Hello");     // OK - string에는 length가 있습니다.
loggingIdentity([1, 2, 3]);   // OK - 배열에도 length가 있습니다.
// loggingIdentity(10);       // ❌ number에는 length가 없습니다.
```

### 5.3 🔸 `keyof`로 객체 키 제약하기

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const userProfile = { id: 1, username: "dev_user" };
getProperty(userProfile, "username"); // OK
// getProperty(userProfile, "age");   // ❌ 'age'는 존재하지 않는 키입니다.
```

객체에 존재하지 않는 프로퍼티 접근을 컴파일 시점에 방지하는 패턴으로, 폼 필드 접근이나 설정 조회 헬퍼 등에 자주 사용합니다.  

---

## 6. 고급 타입 조작 - 실무 차별화 포인트 {#part6}

이 절은 TypeScript를 단순히 사용하는 단계에서 안전한 설계를 하는 단계로 나아가는 데 필요한 핵심 내용을 다룹니다.  

### 6.1 ⭐ 타입 가드와 좁히기 (Narrowing)

```typescript
// 기본 타입 가드로 typeof와 instanceof를 사용합니다.
type Data = string | Date;
function processData(data: Data) {
  if (typeof data === "string") console.log(data.length);
  else if (data instanceof Date) console.log(data.getFullYear());
}

// `arg is Type` 형식으로 사용자 정의 타입 가드를 작성합니다.
interface ApiResponse { success: true; data: string; }
interface ApiError { success: false; error: string; }

function isSuccess(result: ApiResponse | ApiError): result is ApiResponse {
  return result.success === true;
}

function handleResult(result: ApiResponse | ApiError) {
  if (isSuccess(result)) console.log(result.data.toUpperCase()); // ApiResponse로 좁혀집니다.
  else console.error(result.error); // ApiError로 좁혀집니다.
}
```

API 응답이나 폼 검증 결과처럼 성공과 실패의 형태가 다른 유니온을 다룰 때 사용하는 표준 패턴입니다.  

### 6.2 ⭐ `as` (타입 단언) vs `satisfies`

```typescript
type SettingValues = Record<"config" | "style", string>;

// as: 컴파일러에 타입을 단언하므로 리터럴 타입 정보를 잃을 수 있습니다.
const settingsAs = { config: "large", style: "dark" } as SettingValues;
// settingsAs.config는 string 타입이며 구체적인 "large" 정보는 사라집니다.

// satisfies: 표현식의 추론 타입을 유지하면서 대상 타입과 호환되는지 검사합니다.
const settingsSatisfies = {
  config: "large",
  style: "dark",
} as const satisfies SettingValues;
settingsSatisfies.config.slice(0, 3); // config의 타입은 "large"로 보존됩니다.
```

**실무 지침**: `satisfies`는 표현식의 기존 추론 결과를 바꾸지 않고 대상 타입과의 호환성을 검사합니다.  
객체 프로퍼티의 리터럴 타입까지 확실히 보존하려면 위 예시처럼 `as const satisfies` 조합을 사용할 수 있습니다.  

### 6.3 🔸 조건부 타입과 `infer`

```typescript
type IsNumberArray<T> = T extends number[] ? true : false;

// 유니온에 분배 법칙이 자동으로 적용됩니다.
type NonString<T> = T extends string ? never : T;
type Mixed = NonString<string | number | boolean>; // number | boolean

// infer를 사용하여 타입 내부에서 특정 부분을 추출합니다.
type GetElementType<T> = T extends Array<infer E> ? E : T;
type ExtractPromiseResult<T> = T extends Promise<infer R> ? R : T; // Awaited<T>의 기본 원리입니다.
```

### 6.4 🔸 Mapped Types

```typescript
// keyof T로 순회하며 새 타입을 생성하는 Partial<T>의 구현 원리입니다.
type Optional<T> = { [K in keyof T]?: T[K] };

// 모든 속성을 boolean으로 변환합니다.
type Flags<T> = { [K in keyof T]: boolean };
```

내장 유틸리티 타입이 만들어지는 방식을 이해하면 필요할 때 사용자 정의 유틸리티 타입을 직접 만들 수 있습니다.  

### 6.5 ⭐ 자주 쓰는 유틸리티 타입

| 유틸리티 | 하는 일 | 실무 사용처 |
|---|---|---|
| `Partial<T>` | 모든 속성 선택적으로 | PATCH/업데이트 payload 타입 |
| `Readonly<T>` | 모든 속성 읽기 전용으로 | 불변 상태(state) 정의 |
| `Pick<T, K>` | 지정 속성만 선택 | 요약 DTO 만들기 |
| `Omit<T, K>` | 지정 속성 제외 | 민감정보 제거한 응답 타입 |
| `Exclude<T, U>` | 유니온에서 U 제거 | 특정 값 제외한 상태 타입 |
| `Extract<T, U>` | 유니온에서 U만 추출 | 특정 값만 남긴 상태 타입 |
| `NonNullable<T>` | null/undefined 제거 | null 체크 후 값 타입 확정 |
| `Parameters<T>` | 함수 매개변수를 튜플로 | 래퍼 함수 시그니처 재사용 |
| `ReturnType<T>` | 함수 반환 타입 추출 | 반환값 기반 타입 정의 |
| `Awaited<T>` | Promise 내부 타입 추출 | 비동기 함수 결과 타입 (Node.js 필수급) |
| `Record<K, T>` | K-T 키/값 객체 타입 생성 | 권한 맵, 상태별 설정 맵 |

```typescript
type PartialUser = Partial<UserProfile>;
type UserSummary = Pick<UserProfile, "id" | "username">;
type SafeUser = Omit<UserProfile, "id" | "createdAt">;
type PermissionsMap = Record<"admin" | "user" | "guest", boolean>;
type ActivityArray = Awaited<ReturnType<UserProfile["fetchActivity"]>>; // Promise를 해제한 최종 타입입니다.
```

---

## 7. 비동기 프로그래밍 {#part7}

### 7.1 ⭐ `Promise<T>` 기본

```typescript
type FetchResult = { data: string };

function fetchData(id: number): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      id > 0 ? resolve({ data: `User ${id}` }) : reject(new Error("Invalid ID"));
    }, 100);
  });
}
```

### 7.2 ⭐ `async`/`await`

```typescript
async function processUserData(id: number): Promise<string> {
  try {
    const result = await fetchData(id); // 이행된 값은 FetchResult 타입으로 추론됩니다.
    return result.data;
  } catch (error) {
    // strict 또는 useUnknownInCatchVariables가 활성화되면 error는 unknown입니다.
    if (error instanceof Error) throw new Error(`Processing failed: ${error.message}`);
    throw new Error("Unknown error");
  }
}
```

**실무 포인트**: `strict` 또는 `useUnknownInCatchVariables`가 활성화된 환경에서 `catch (error)`의 `error`는 `unknown`입니다.  
`error.message`에 바로 접근하지 말고 `instanceof Error` 같은 타입 가드를 먼저 적용해야 합니다.  

### 7.3 🔸 에러 핸들링 패턴 비교

```typescript
// async/await 방식입니다.
async function safeApiCall(id: number) {
  try {
    const result = await fetchData(id);
  } catch (error) {
    if (error instanceof Error) console.error(error.message);
    // 여기서 error를 던지지 않으면 함수는 정상 종료됩니다. 재전파하려면 명시적으로 던져야 합니다.
  }
}

// Promise 체이닝 방식입니다.
fetchData(0)
  .then(result => console.log(result.data))
  .catch(error => { if (error instanceof Error) console.error(error.message); })
  .finally(() => console.log("완료")); // 성공과 실패 여부에 관계없이 항상 실행됩니다.
```

### 7.4 ⭐ `Promise.all` / `race` / `allSettled`

| 메서드 | 동작 | 실무 사용처 |
|---|---|---|
| `Promise.all()` | 모두 성공해야 성공, 하나라도 실패 시 전체 실패 | 여러 API를 동시에 호출하고 전부 필요한 경우 |
| `Promise.race()` | 가장 먼저 끝나는 것의 결과 반환 | 타임아웃 구현 (요청 vs 타이머 경쟁) |
| `Promise.allSettled()` | 성공/실패 관계없이 전부 기다리고 상태별로 결과 취합 | 일부 실패를 허용해야 하는 배치 작업 |

```typescript
const results = await Promise.allSettled([successPromise, failurePromise]);
results.forEach(r => {
  if (r.status === "fulfilled") console.log(r.value);
  else console.error(r.reason instanceof Error ? r.reason.message : r.reason);
});
```

---

## 8. 모듈 시스템 (ESM) {#part8}

### 8.1 ⭐ Named Export/Import

```typescript
// math.ts
export const PI: number = 3.14159;
export function add(a: number, b: number): number { return a + b; }

// app.ts - Node.js ESM에서는 컴파일된 JS 파일을 기준으로 .js 확장자를 명시해야 합니다.
import { PI, add } from "./math.js";
import * as MathUtils from "./math.js"; // 네임스페이스 전체를 가져옵니다.
```

### 8.2 ⭐ Default Export/Import

```typescript
// user.ts
class UserService { getUser(id: number) { return { id }; } }
export default UserService;

// app.ts - {} 없이 원하는 이름으로 자유롭게 가져올 수 있습니다.
import MyService from "./user.js";
```

### 8.3 🔸 동적 import (지연 로딩과 코드 스플리팅)

```typescript
async function loadHeavyModule(condition: boolean) {
  if (condition) {
    const module = await import("./heavy-calc.js"); // Promise를 반환합니다.
    module.add(5, 5);
    const HeavyService = module.default;
  }
}
```

동적 `import()`는 모듈이 필요한 시점까지 로딩을 미룰 때 사용합니다.  
번들러 환경에서는 별도 청크로 분리하는 코드 스플리팅에 활용할 수 있지만, 실제 분리 여부는 사용하는 번들러와 설정에 따라 달라집니다.  

### 8.4 ⭐ `import type` - 타입 전용 import

```typescript
import type { Config } from "./types/config.js"; // 런타임 JavaScript 코드로 컴파일되지 않습니다.
import { fetchConfig } from "./config-loader.js"; // 런타임에서 사용하는 값은 일반 import로 가져옵니다.
```

타입만 필요한 import에 `import type`을 붙이면 컴파일된 JavaScript에서 해당 import가 완전히 제거됩니다.  
이를 통해 런타임에 필요한 값과 타입 전용 의존성을 명확하게 구분할 수 있습니다.  

---

## 9. 한눈에 보는 요약 치트시트 {#cheatsheet}

| 문법 | 핵심 동작 |
|---|---|
| `===` | 타입+값 모두 같아야 true |
| `Object.is()` | NaN끼리 같음 / +0·-0 다름으로 판정 |
| `\|\|` | 첫 Truthy 반환, 없으면 마지막 피연산자 반환 |
| `??` | 첫 non-nullish 반환 (진짜 null/undefined만 대체) |
| `?.` | 왼쪽이 Nullish이면 즉시 `undefined` 반환, 필수 값에는 사용하지 않음 |
| `typeof` / `instanceof` / `Array.isArray` | 원시 타입 / 클래스·에러 / 배열 판별 |
| 구조분해 `{}`/`[]`, `...rest`, `...spread` | 값 추출·나머지 수집·얕은 복사 |
| `interface` vs `type` | 객체·클래스 계약 vs 유니온/튜플 등 모든 타입 |
| `unknown` | 사용 전 반드시 타입 좁히기, `any` 대신 사용 |
| 제네릭 `<T>`, `T extends U` | 재사용 가능한 타입, 제약조건으로 안전성 확보 |
| 타입 가드 `is` | 유니온을 안전하게 좁히는 사용자 정의 함수 |
| `as` vs `satisfies` | 타입 단언 vs 기존 추론 타입을 유지한 호환성 검사 |
| 조건부 타입 `T extends U ? X : Y`, `infer` | 타입 레벨 분기와 추출 |
| `Partial/Pick/Omit/Record/ReturnType/Awaited` | 실무에서 가장 자주 쓰는 유틸리티 타입 |
| `Promise<T>`, `async/await` | 비동기 값의 타입, strict 환경에서 catch의 error는 `unknown` |
| `Promise.all/race/allSettled` | 병렬 처리 전략 3종 |
| `export`/`import`, `import type` | 값·타입 모듈 관리, 타입 전용 import는 런타임에서 제거 |

---
