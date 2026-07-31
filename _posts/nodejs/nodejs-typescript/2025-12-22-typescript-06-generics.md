---
layout: post
title: "06. TypeScript 제네릭 이해하기"
description: "TypeScript에서 any 대신 제네릭을 사용하는 이유와 제네릭 함수, 인터페이스, 클래스, 제약 조건의 활용 방법을 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "06"
ai_assisted: true
toc:
  - id: session-01
    title: "1. any 대신 제네릭(Generic)이 필요한 이유"
  - id: session-02
    title: "2. 제네릭(Generic) 함수의 개념과 동작 방식"
  - id: session-03
    title: "3. 제네릭 인터페이스(Interface)와 클래스(Class) 활용"
  - id: session-04
    title: "4. 제약 조건(Constraints)으로 타입 제한하기"
---

## 1. any 대신 제네릭(Generic)이 필요한 이유 {#session-01}

제네릭은 '일반적인', '범용적인'이라는 뜻처럼 코드를 작성할 때 사용할 타입을 미리 정하지 않고, 그 코드를 사용하는 시점에 원하는 타입을 지정할 수 있게 하는 기능입니다.  
이를 통해 타입 안전성을 유지하면서 유연하고 재사용할 수 있는 코드를 작성할 수 있습니다.

개발하다 보면 여러 타입에 동일한 처리 과정을 적용해야 하는 상황이 자주 생깁니다.  
예를 들어 전달받은 값을 그대로 반환하는 단순한 함수를 만든다고 가정해 보겠습니다.  
이때 `any`를 사용하면 편리해 보이지만 TypeScript가 제공하는 타입 안전성(Type Safety)을 잃게 됩니다.

### 🟦 any 타입을 사용할 때 발생하는 문제

```typescript
function identityAny(arg: any): any {
  return arg;
}

let numResult = identityAny(123);
let strResult = identityAny("hello");

// 반환 타입이 any이므로 TypeScript는 실제 타입 정보를 유지하지 못합니다.
// 문자열에는 toFixed()가 없지만 any이므로 컴파일 오류를 보고하지 않습니다.
// strResult.toFixed(2);
```

위 코드에서 TypeScript는 `numResult`가 어떤 타입인지 정확하게 알지 못합니다.  
`strResult`도 특정 타입으로 결정되지 않고 `any`로 처리됩니다.  
따라서 다음과 같은 코드를 작성해도 컴파일 단계에서는 오류가 발생하지 않습니다.

```typescript
// TypeScript 오류는 없지만 주석을 해제하여 실행하면 런타임 오류가 발생합니다.
// strResult.toFixed(2);
```

즉, `any`를 사용하면 TypeScript가 제공하는 정적 타입 검사의 장점이 사라집니다.

### 🟦 제네릭(Generic)을 사용한 해결 방법

제네릭은 함수나 클래스 내부에서 사용할 타입을 사용 시점에 결정할 수 있도록 하는 문법입니다.  
제네릭을 사용하면 입력과 출력 타입의 관계를 유지하면서 동일한 코드를 여러 타입에 재사용할 수 있습니다.

#### 🔷 제네릭을 적용한 예제

```typescript
// 함수이름<타입>(인수)
function identityGeneric<T>(arg: T): T {
  return arg;
}
```

위 코드에서 `<T>`의 `T`는 타입 매개변수(Type Parameter)이며 함수를 호출할 때 전달한 값에 따라 구체적인 타입으로 결정됩니다.

```typescript
let numResult = identityGeneric<number>(123);
// 또는 let numResult = identityGeneric(123);
// numResult의 타입은 number로 추론됩니다.

let strResult = identityGeneric<string>("hello");
// 또는 let strResult = identityGeneric("hello");
// strResult의 타입은 string으로 추론됩니다.
```

> TypeScript는 타입 추론 기능을 지원하므로, 전달한 인수를 기반으로 제네릭 타입을 자동으로 추론합니다.  
> 따라서 대부분의 경우 타입 인수를 생략할 수 있습니다.

이제 TypeScript는 `strResult`가 문자열이라는 사실을 알기 때문에 다음과 같은 잘못된 코드를 작성하면 컴파일 단계에서 오류를 알려 줍니다.

```typescript
// strResult.toFixed(1);
// 오류: Property 'toFixed' does not exist on type 'string'.
```

제네릭을 사용하면 함수나 클래스에서 타입 정보를 유지한 채 다양한 타입에 대응할 수 있습니다.  
또한 `any`를 사용할 때처럼 타입 안전성이 사라지는 문제를 방지할 수 있습니다.

#### 🔷 전체 예제

```typescript
// 제네릭 함수를 선언합니다.
function identityGeneric<T>(value: T): T {
  return value;
}

// number 타입으로 호출합니다.
const a = identityGeneric(42);
console.log(a.toFixed(2));

// string 타입으로 호출합니다.
const b = identityGeneric("hello");
console.log(b.toUpperCase());

// string에는 toFixed()가 없으므로 다음 코드는 컴파일 오류가 발생합니다.
// console.log(b.toFixed(2));
```

## 2. 제네릭(Generic) 함수의 개념과 동작 방식 {#session-02}

TypeScript에서 제네릭(Generics)은 타입을 변수처럼 다루어 코드의 재사용성과 타입 안전성을 함께 높이는 기능입니다.

### 🟦 타입 매개변수(Type Parameter)란?

제네릭 함수는 타입 매개변수를 사용하여 정의합니다.  
일반적으로 `T`, `U`, `K`, `V`와 같은 대문자 한 글자를 이름으로 사용합니다.

`T`는 Temporary의 의미가 아니라 Type을 나타내는 관용적인 표기입니다.  
제네릭 함수는 다음과 같은 기본 구조로 작성합니다.

```typescript
function 함수명<T>(value: T) {}
```

여기서 `<T>`는 함수 호출 시 전달된 값이나 명시한 타입을 나타내는 타입 매개변수입니다.

### 🟦 제네릭 함수 정의하기

```typescript
/**
 * T 타입의 값을 받아 T 타입 요소로 이루어진 배열을 반환합니다.
 * @param element 배열로 만들 요소
 * @returns T 타입의 요소를 가진 배열
 */
function toArray<T>(element: T): T[] {
  return [element];
}

// 1. string 타입을 사용합니다.
let stringArray = toArray("Apple");
// stringArray는 string[] 타입으로 추론됩니다.

// 2. number 타입을 사용합니다.
let numberArray = toArray(42);
// numberArray는 number[] 타입으로 추론됩니다.

console.log(stringArray); // 출력: ["Apple"]
console.log(numberArray); // 출력: [42]
```

### 🟦 여러 타입 매개변수 사용하기

필요하면 두 개 이상의 타입 매개변수를 사용할 수 있습니다.  
다음 예제는 서로 다른 타입의 값을 받아 튜플로 반환하는 함수입니다.

```typescript
// 서로 다른 타입 U와 V를 사용하여 튜플을 반환합니다.
function createPair<U, V>(first: U, second: V): [U, V] {
  return [first, second];
}

// 호출할 때 U는 string, V는 number로 결정됩니다.
let myPair = createPair("score", 95);
// myPair의 타입은 [string, number]입니다.

myPair[0].toUpperCase(); // 첫 번째 요소는 string입니다.
myPair[1].toFixed(1); // 두 번째 요소는 number입니다.
```

이 호출에서 만들어진 `myPair`의 첫 번째 요소는 `string`, 두 번째 요소는 `number`로 정해집니다.

### 🟦 제네릭 함수가 필요한 이유

#### 🔷 1) 제네릭을 사용하지 않을 때

반환값이 `any[]`이므로 잘못된 메서드 호출이나 오타를 TypeScript가 확인하기 어렵습니다.

```typescript
function wrap(value: any) {
  return [value];
}

const result = wrap("Hello");
result[0].toUpperCase(); // 호출할 수 있지만 타입이 안전하지 않습니다.
```

#### 🔷 2) 제네릭을 사용할 때

- 타입 안전성을 강화합니다.
- 전달한 값에 따라 타입을 자동으로 추론합니다.
- 호출할 때마다 알맞은 타입을 적용합니다.

```typescript
function wrapSafe<T>(value: T): T[] {
  return [value];
}

const resultSafe = wrapSafe("Hello");
resultSafe[0].toUpperCase(); // string 메서드를 안전하게 호출합니다.
```

## 3. 제네릭 인터페이스(Interface)와 클래스(Class) 활용 {#session-03}

제네릭은 함수뿐 아니라 인터페이스, 클래스와 여러 데이터 구조에도 적용할 수 있습니다.  
이를 통해 사용할 타입을 미리 확정하지 않은 상태에서 구조를 설계하고, 사용하는 시점에 타입을 지정하여 타입 안전성과 재사용성을 함께 확보할 수 있습니다.

TypeScript에서 자주 사용하는 대표적인 제네릭 구조는 다음과 같습니다.

- `Array<number>`
- `Promise<string>`

이와 같이 값을 담는 구조에 구체적인 타입을 지정할 수 있습니다.

### 🟦 제네릭 인터페이스(Generic Interface)

인터페이스를 정의할 때 타입 매개변수를 선언하면 인터페이스를 사용하는 시점에 어떤 타입의 데이터를 다룰지 지정할 수 있습니다.

#### 🔷 Container 인터페이스 예제

```typescript
// T 타입의 값을 담는 컨테이너 인터페이스입니다.
interface Container<T> {
  value: T;
  isLocked: boolean;
}

// Container를 string 타입으로 사용합니다.
const stringBox: Container<string> = {
  value: "TypeScript is awesome",
  isLocked: false,
};

console.log(stringBox.value.toUpperCase());
```

위 예제처럼 `Container<string>`으로 선언하면 `value`는 `string` 타입이 됩니다.  
따라서 `string`의 메서드를 타입 안전하게 사용할 수 있습니다.

#### 🔷 사용자 정의 타입 적용 예제

```typescript
interface User {
  id: number;
  name: string;
}

// User 타입 데이터를 담는 Container입니다.
const userBox: Container<User> = {
  value: {
    id: 1,
    name: "Alice",
  },
  isLocked: true,
};

console.log(userBox.value.name);
```

이 경우 `value`는 `User` 타입이어야 하며 `name`, `id`와 같은 속성을 타입 안전하게 사용할 수 있습니다.

### 🟦 제네릭 클래스(Generic Class)

제네릭 클래스는 클래스가 저장하는 데이터의 타입을 외부에서 지정할 수 있게 합니다.  
특히 큐(Queue), 스택(Stack)처럼 여러 데이터 타입을 담을 수 있는 자료 구조에 적합합니다.

#### 🔷 단순한 큐 구현(SimpleQueue)

```typescript
class SimpleQueue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }
}
```

#### 🔷 사용 예제와 타입 안전성 확인

```typescript
// number 타입만 허용하는 큐를 생성합니다.
const numberQueue = new SimpleQueue<number>();
numberQueue.enqueue(10);
numberQueue.enqueue(20);

// string은 number 타입 큐에 추가할 수 없습니다.
// numberQueue.enqueue("hello");

let removed = numberQueue.dequeue();
console.log(removed); // number 또는 undefined입니다.

console.log(numberQueue.size()); // 남은 요소 개수를 출력합니다.
```

`numberQueue`는 `number` 타입의 요소만 처리합니다.  
컴파일 단계에서 타입이 맞지 않는 값을 전달하면 오류가 발생합니다.

## 4. 제약 조건(Constraints)으로 타입 제한하기 {#session-04}

TypeScript에서 제네릭을 사용할 때 모든 타입을 허용하지 않고 특정 속성이나 구조를 가진 타입만 허용해야 할 수 있습니다.  
이때 제약 조건(Constraint)을 사용합니다.

제약 조건을 설정하면 타입 안전성을 유지하면서 유연한 함수나 클래스를 설계할 수 있습니다.

### 🟦 제약 조건이 필요한 이유

다음은 입력한 값의 길이(`length`)를 반환하는 함수를 만들려는 예제입니다.

```typescript
// T에는 length 속성이 있다는 보장이 없으므로 다음 함수는 오류가 발생합니다.
// function getLength<T>(arg: T): number {
//   return arg.length;
// }
```

`T`가 어떤 타입인지 TypeScript가 알 수 없기 때문에 오류가 발생합니다.  
`T`는 `string`이나 배열처럼 `length` 속성이 있는 타입일 수도 있지만, `number`처럼 `length` 속성이 없는 타입일 수도 있습니다.  
따라서 제약 조건 없이 `arg.length`에 접근하는 것은 타입이 안전하지 않습니다.

### 🟦 extends를 사용하여 제약 조건 설정하기

`extends` 키워드를 사용하면 제네릭 타입 `T`가 `length` 속성을 가져야 한다는 조건을 설정할 수 있습니다.

#### 🔷 1) 인터페이스로 제약 조건 정의하기

```typescript
interface HasLength {
  length: number;
}
```

#### 🔷 2) 제네릭 타입에 제약 조건 적용하기

```typescript
function getLength<T extends HasLength>(arg: T): number {
  return arg.length;
}
```

이렇게 작성하면 `T`는 `length: number` 속성을 가진 타입이어야 합니다.

#### 🔷 여러 타입으로 테스트하기

```typescript
// 문자열에는 length 속성이 있습니다.
console.log(getLength("Hello TypeScript")); // 출력: 16

// 배열에는 length 속성이 있습니다.
console.log(getLength([1, 2, 3, 4])); // 출력: 4

// length 속성이 있는 사용자 정의 객체도 사용할 수 있습니다.
const book = { title: "TypeScript", length: 300 };
console.log(getLength(book)); // 출력: 300

// number에는 length 속성이 없으므로 컴파일 오류가 발생합니다.
// console.log(getLength(100));
```
