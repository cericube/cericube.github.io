---
layout: post
title: "07. TypeScript 유틸리티 타입과 조건부 타입 이해하기"
description: "TypeScript의 Partial, Readonly, Pick, Omit과 조건부 타입, 매핑된 타입의 동작 원리와 활용 방법을 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "07"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 기본 유틸리티 타입: Partial<T>와 Readonly<T>"
  - id: session-02
    title: "2. 선택 유틸리티 타입 Pick과 Omit으로 타입 구조 최적화하기"
  - id: session-03
    title: "3. 조건부 타입(Conditional Types)을 활용한 타입 분기 처리"
  - id: session-04
    title: "4. 매핑된 타입(Mapped Types)과 실전 사용 패턴"
---

## 1. 기본 유틸리티 타입: Partial<T>와 Readonly<T> {#session-01}

`Partial<T>`와 `Readonly<T>`는 프로퍼티를 가진 객체 타입에 의미 있게 사용하는 유틸리티 타입입니다.

TypeScript는 자주 사용하는 타입 변환 패턴을 기본 유틸리티 타입(Utility Type)으로 제공합니다.  
그중 `Partial<T>`와 `Readonly<T>`는 객체 타입을 더 유연하거나 안전하게 다룰 수 있도록 돕는 대표적인 유틸리티 타입입니다.

| 유틸리티 타입 | 설명 | 예 |
| --- | --- | --- |
| `Partial<T>` | 모든 속성을 선택적(Optional) 속성으로 변경 | `updateUser(id, { name: "홍길동" })` |
| `Readonly<T>` | 모든 속성을 읽기 전용(Readonly) 속성으로 변경 | `const config: Readonly<Config>` |

### 🟦 Partial<T>: 모든 속성을 선택적으로 만들기

`Partial<T>`는 타입 `T`의 모든 속성을 선택적 속성으로 바꾸는 유틸리티 타입입니다.  
주로 다음과 같은 경우에 유용합니다.

- 사용자의 일부 정보만 업데이트할 때
- 객체를 점진적으로 초기화할 때

#### 🔷 사용자 정보 업데이트 함수

```typescript
// 1. 모든 속성이 필수인 원본 User 타입입니다.
interface User {
  id: number;
  name: string;
  email: string;
}

// 2. Partial을 사용하여 모든 속성이 선택적인 타입을 만듭니다.
type UserUpdate = Partial<User>;

// 3. 변경할 사용자 ID와 일부 변경값을 받습니다.
function updateUser(id: number, changes: UserUpdate): void {
  console.log(`사용자 ID ${id}의 정보를 업데이트합니다.`, changes);
  // 실제 애플리케이션에서는 데이터베이스 업데이트 로직이 들어갈 수 있습니다.
}

// 4. 일부 속성만 전달할 수 있습니다.
updateUser(101, { name: "새로운 이름" });

// id도 선택적 속성이 되므로 수정값에 포함할 수 있습니다.
updateUser(102, { email: "new@example.com", id: 999 });
```

`Partial<T>`는 모든 프로퍼티를 선택적으로 만들기 때문에 원하지 않는 속성까지 수정할 수 있다는 점에 주의해야 합니다.  
특히 ID처럼 변경하면 안 되는 필드는 별도로 처리하거나 타입에서 제외하는 것이 좋습니다.

#### 🔷 객체 초기화에 활용하기

```typescript
interface Todo {
  title: string;
  completed: boolean;
}

function createTodo(data: Partial<Todo>): Todo {
  const defaultTodo: Todo = {
    title: "제목 없음",
    completed: false,
  };

  return { ...defaultTodo, ...data };
}

const todoWithTitle = createTodo({ title: "TS 공부" });
const defaultTodo = createTodo({});
```

`Partial<T>` 덕분에 `createTodo()` 함수에 필요한 속성만 전달하거나 빈 객체를 전달할 수 있습니다.

### 🟦 Readonly<T>: 모든 속성을 읽기 전용으로 만들기

`Readonly<T>`는 타입 `T`의 모든 속성에 `readonly` 수정자를 적용하여 속성을 다시 할당하지 못하게 하는 유틸리티 타입입니다.  
주로 다음과 같은 상황에서 사용합니다.

- 설정 객체처럼 변경하면 안 되는 데이터를 보호할 때
- 의도하지 않은 속성 재할당을 방지할 때

`Readonly<T>`는 타입 검사 단계에서 객체의 바로 아래 속성만 읽기 전용으로 만드는 얕은 변환입니다.  
런타임에 객체를 동결하거나 중첩 객체까지 자동으로 읽기 전용으로 만들지는 않습니다.

#### 🔷 애플리케이션 설정을 읽기 전용으로 유지하기

```typescript
// 1. 원본 Config 타입입니다.
interface Config {
  apiUrl: string;
  timeout: number;
  debugMode: boolean;
}

// 2. Readonly를 적용합니다.
type AppConfig = Readonly<Config>;

const appConfig: AppConfig = {
  apiUrl: "https://api.myapp.com",
  timeout: 5000,
  debugMode: false,
};

// 읽기 전용 속성에는 값을 다시 할당할 수 없습니다.
// appConfig.timeout = 10000;
```

이처럼 `Readonly<T>`를 적용하면 객체 속성의 재할당을 타입 수준에서 제한하여 코드 안정성을 높일 수 있습니다.

#### 🔷 설정 객체의 실수 방지하기

```typescript
interface AppSettings {
  theme: "light" | "dark";
  autoSave: boolean;
}

const settings: Readonly<AppSettings> = {
  theme: "light",
  autoSave: true,
};

// 읽기 전용 속성이므로 컴파일 오류가 발생합니다.
// settings.theme = "dark";
```

설정 객체를 만든 뒤 속성을 다시 할당하지 않아야 하는 경우 `Readonly<T>`가 유용합니다.

## 2. 선택 유틸리티 타입 Pick과 Omit으로 타입 구조 최적화하기 {#session-02}

`Pick<T, K>`와 `Omit<T, K>`는 프로퍼티를 가진 객체 타입에서 필요한 속성을 선택하거나 제외할 때 사용하는 유틸리티 타입입니다.

TypeScript에서는 기존 타입의 일부 속성만 사용하여 새 타입을 만들 수 있습니다.

- `Pick<T, K>`: 원하는 속성만 선택하여 새로운 타입을 만듭니다.
- `Omit<T, K>`: 지정한 속성을 제외하고 새로운 타입을 만듭니다.

| 유틸리티 타입 | 역할 | 활용 예 |
| --- | --- | --- |
| `Pick<T, K>` | `T`에서 원하는 속성만 선택하여 새 타입 생성 | 공개 사용자 정보, 요약 카드, 미리 보기 |
| `Omit<T, K>` | `T`에서 지정한 속성을 제외하여 새 타입 생성 | 생성 요청 본문, 민감 정보 제외 |

### 🟦 Pick<T, K>: 원하는 속성만 선택하기

`Pick<T, K>`는 타입 `T`에서 `K`에 해당하는 속성만 선택하여 새로운 타입을 만듭니다.

- `T`: 원본 타입
- `K`: 가져올 속성 이름의 유니언 타입

#### 🔷 사용자 정보 요약 데이터 만들기

API 응답 중 일부 필드만 보여 주고 싶을 때 유용합니다.  
사용자의 공개 정보 요약이나 간략한 카드 UI 등에 사용할 수 있습니다.

```typescript
interface UserDetails {
  id: number;
  name: string;
  age: number;
  address: string;
  phoneNumber: string;
}

// id와 name만 포함하는 UserSummary 타입을 만듭니다.
type UserSummary = Pick<UserDetails, "id" | "name">;

const summary: UserSummary = {
  id: 5,
  name: "이유나",
  // address: "서울", // 오류: address는 UserSummary에 없습니다.
};
```

`UserSummary`는 `id`와 `name` 속성만 포함합니다.  
그 외 속성을 객체 리터럴에 추가하면 TypeScript가 오류를 알려 줍니다.

### 🟦 Omit<T, K>: 특정 속성을 제외하기

`Omit<T, K>`는 타입 `T`에서 `K`에 해당하는 속성을 제외한 새로운 타입을 만듭니다.

- `T`: 원본 타입
- `K`: 제외할 속성 이름의 유니언 타입

#### 🔷 ID를 제외한 사용자 생성 타입 만들기

```typescript
interface UserDetails {
  id: number;
  name: string;
  age: number;
  address: string;
  phoneNumber: string;
}

// 서버에서 id를 생성하므로 요청 데이터에서는 제외합니다.
type UserCreatePayload = Omit<UserDetails, "id">;

const newUser: UserCreatePayload = {
  name: "최지우",
  age: 25,
  address: "부산",
  phoneNumber: "010-1234-5678",
};

// id는 UserCreatePayload에 존재하지 않습니다.
// console.log(newUser.id);
```

### 🟦 Pick과 Omit 비교하기

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

// 상세 페이지에서는 모든 속성을 사용합니다.
type ProductDetail = Product;

// 목록에서는 요약 정보만 사용합니다.
type ProductSummary = Pick<Product, "id" | "name" | "price">;

// 상품 등록 요청에서는 자동으로 생성되는 id를 제외합니다.
type ProductCreatePayload = Omit<Product, "id">;
```

## 3. 조건부 타입(Conditional Types)을 활용한 타입 분기 처리 {#session-03}

TypeScript에는 값이 아닌 타입에 따라 결과 타입을 분기하는 기능이 있습니다.  
이를 조건부 타입(Conditional Type)이라고 하며 JavaScript의 삼항 연산자와 비슷한 문법을 사용합니다.

```text
조건식 ? 참일 때의 타입 : 거짓일 때의 타입
```

조건부 타입을 활용하면 타입 간의 관계에 따라 결과 타입을 결정하는 유연한 타입 로직을 작성할 수 있습니다.  
조건부 타입은 다음과 같은 상황에서 유용합니다.

| 상황 | 활용 예 |
| --- | --- |
| API 응답 타입 처리 | 성공과 실패 구조를 서로 다른 타입으로 표현 |
| 값의 래핑 여부 처리 | 특정 타입일 때만 배열로 감싸거나 선택적 속성으로 처리 |
| 유틸리티 타입 작성 | `Exclude`, `Extract`, `NonNullable` 등의 타입 구현 |

### 🟦 기본 문법: T extends U ? X : Y

조건부 타입은 `T`가 `U`에 할당될 수 있으면 `X`를, 그렇지 않으면 `Y`를 결과 타입으로 사용합니다.

```typescript
type NewType<T, U, X, Y> = T extends U ? X : Y;
```

여기서 `extends`는 클래스 상속이 아니라 `T`가 `U`에 할당 가능한 타입인지 검사하는 의미로 사용됩니다.

### 🟦 string이면 배열로 감싸기

다음은 `T`가 문자열이면 `string[]`로 바꾸고 그 외에는 `T`를 그대로 유지하는 타입입니다.

```typescript
// string이면 string[]로, 아니면 T를 그대로 사용합니다.
type WrapIfString<T> = T extends string ? string[] : T;
```

```typescript
// string이면 string[]를, 아니면 T를 결과 타입으로 사용합니다.
type WrapIfString<T> = T extends string ? string[] : T;

// T가 string인 경우입니다.
type Result1 = WrapIfString<string>; // string[]

// T가 number인 경우입니다.
type Result2 = WrapIfString<number>; // number

// T가 boolean인 경우입니다.
type Result3 = WrapIfString<boolean>; // boolean
```

`Result1`은 조건을 만족하므로 `string[]`이 됩니다.  
`Result2`와 `Result3`은 조건을 만족하지 않으므로 전달한 타입이 그대로 유지됩니다.

### 🟦 조건부 타입과 제네릭 결합하기

조건부 타입은 제네릭과 함께 사용하여 매개변수 타입에 따라 반환 타입이 달라지는 함수를 표현할 수 있습니다.

```typescript
// T가 string이면 { value: string[] }을 사용하고,
// 그렇지 않으면 { value: T }를 사용합니다.
type WrapResult<T> = T extends string ? { value: string[] } : { value: T };

function wrap<T>(input: T): WrapResult<T> {
  if (typeof input === "string") {
    // TypeScript는 제네릭 조건부 타입과 런타임 검사의 관계를
    // 일반적으로 직접 추론하지 못하므로 반환 타입을 단언합니다.
    return { value: [input] } as WrapResult<T>;
  }

  return { value: input } as WrapResult<T>;
}

const wrappedString = wrap("hi");
// WrapResult<string>은 { value: string[] }입니다.

const wrappedNumber = wrap(123);
// WrapResult<number>는 { value: number }입니다.

const wrappedBoolean = wrap(true);
// WrapResult<boolean>은 { value: boolean }입니다.
```

`wrap("hi")`는 문자열을 배열로 감싼 객체를 반환합니다.  
`wrap(123)`은 숫자를 그대로 `value`에 담은 객체를 반환합니다.

## 4. 매핑된 타입(Mapped Types)과 실전 사용 패턴 {#session-04}

TypeScript는 기존 타입의 구조를 기반으로 각 속성을 변형하여 새로운 타입을 만드는 기능을 제공합니다.  
이를 매핑된 타입(Mapped Type)이라고 합니다.  
매핑된 타입은 런타임에 반복문을 실행하는 것이 아니라 타입 수준에서 속성 이름을 순회하는 것처럼 변환 규칙을 적용합니다.

### 🟦 매핑된 타입의 기본 형태

```typescript
type MyMappedType<T, Value> = {
  [K in keyof T]: Value;
};
```

- `T`는 원본 타입입니다.
- `keyof T`는 `T`의 모든 속성 키로 이루어진 타입입니다.
- `K in keyof T`는 각 속성 키를 차례로 매핑합니다.
- `Value` 자리에 각 속성을 어떤 타입으로 변환할지 지정합니다.

이러한 구조를 사용하면 타입 수준에서 각 속성에 같은 변환 규칙을 적용할 수 있습니다.

### 🟦 함수 타입 속성을 boolean으로 변환하기

```typescript
interface TaskList {
  fetchData: () => void;
  processData: () => void;
  renderUI: () => void;
}

// TaskList의 모든 속성을 boolean 타입으로 변환합니다.
type StatusTracker<T> = {
  [K in keyof T]: boolean;
};

type TaskStatus = StatusTracker<TaskList>;
/*
TaskStatus는 다음과 같습니다.
{
  fetchData: boolean;
  processData: boolean;
  renderUI: boolean;
}
*/

const currentStatus: TaskStatus = {
  fetchData: true,
  processData: false,
  renderUI: false,
};
```

### 🟦 매핑된 타입 기반 유틸리티 타입의 구현 원리

`Readonly<T>`, `Partial<T>`, `Required<T>`와 같은 유틸리티 타입은 매핑된 타입을 이용해 구현됩니다.

```typescript
// 모든 속성을 readonly로 변환합니다.
type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

interface Person {
  name: string;
  age: number;
}

type ReadonlyPerson = MyReadonly<Person>;
/*
ReadonlyPerson은 다음과 같습니다.
{
  readonly name: string;
  readonly age: number;
}
*/

const readonlyPerson: ReadonlyPerson = {
  name: "Jane",
  age: 30,
};

// readonlyPerson.age = 31; // 오류: 읽기 전용 속성에는 값을 할당할 수 없습니다.
```

### 🟦 조건부 타입 기반 유틸리티 타입

조건부 타입은 특정 타입이 조건을 만족하는지에 따라 결과 타입을 분기하는 기능입니다.  
TypeScript는 조건부 타입을 활용한 여러 유틸리티 타입을 제공하며, 이를 사용하면 타입 안전성을 유지하면서 타입 정의를 간결하게 작성할 수 있습니다.

| 유틸리티 타입 | 설명 |
| --- | --- |
| `NonNullable<T>` | `null`과 `undefined`를 제외 |
| `Exclude<T, U>` | 유니언 타입에서 특정 타입을 제외 |
| `Extract<T, U>` | 유니언 타입에서 특정 타입만 추출 |
| `ReturnType<T>` | 함수의 반환 타입을 추출 |
| `Parameters<T>` | 함수의 매개변수 타입을 튜플로 추출 |

```typescript
// 1. NonNullable<T>
// 타입에서 null과 undefined를 제외합니다.
type WithNull = string | null | undefined;
type WithoutNull = NonNullable<WithNull>; // string

const nonNullName: WithoutNull = "홍길동";
// const invalidName: WithoutNull = null; // 오류가 발생합니다.

// 2. Exclude<T, U>
// 타입 T에서 U에 할당 가능한 타입을 제외합니다.
type Role = "admin" | "user" | "guest";
type VisibleRole = Exclude<Role, "admin">; // "user" | "guest"

const role1: VisibleRole = "user";
const role2: VisibleRole = "guest";
// const role3: VisibleRole = "admin"; // 오류가 발생합니다.

// 3. Extract<T, U>
// 타입 T에서 U에 할당 가능한 타입만 추출합니다.
type Status = "success" | "error" | "loading";
type FinalStatus = Extract<Status, "success" | "error">; // "success" | "error"

const status1: FinalStatus = "success";
// const status2: FinalStatus = "loading"; // 오류가 발생합니다.

// 4. ReturnType<T>
// 함수의 반환 타입을 추출합니다.
function getUser() {
  return {
    id: 1,
    name: "Jane",
    isAdmin: false,
  };
}

type ReturnedUser = ReturnType<typeof getUser>;

const returnedUser: ReturnedUser = {
  id: 1,
  name: "Jane",
  isAdmin: true,
};

// 5. Parameters<T>
// 함수의 매개변수 타입을 튜플로 추출합니다.
function sendMessage(to: string, body: string, urgent?: boolean): void {
  console.log(`[Message] To: ${to}, Body: ${body}, Urgent: ${urgent}`);
}

type SendMessageParams = Parameters<typeof sendMessage>;

const args: SendMessageParams = ["alice@example.com", "Hello!", true];
sendMessage(...args);
```
