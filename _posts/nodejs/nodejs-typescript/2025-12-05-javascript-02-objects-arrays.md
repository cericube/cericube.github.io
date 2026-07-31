---
layout: post
title: "02. JavaScript 객체와 배열: 구조 분해, Spread, Rest"
description: "JavaScript 객체와 배열의 생성·접근·검색·변경 방법을 살펴보고, 구조 분해 할당과 Spread·Rest 문법을 예제와 함께 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "02"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 객체 리터럴과 프로퍼티"
  - id: session-02
    title: "2. 배열 생성과 주요 조작"
  - id: session-03
    title: "3. 구조 분해 할당"
  - id: session-04
    title: "4. Spread와 Rest 문법"
---

## 1. 객체 리터럴과 프로퍼티 {#session-01}

객체는 **서로 관련된 여러 값을 하나로 묶고 프로퍼티 키를 통해 각 값에 접근하는 자료 구조**입니다.  
Node.js에서 JSON 데이터를 읽고 쓰거나 서버 프레임워크의 요청과 응답을 처리할 때도 객체를 사용합니다.  

### 🟦 객체 리터럴

객체 리터럴(Object Literal)은 중괄호 `{}` 안에 프로퍼티를 작성하여 객체를 만드는 문법입니다.  
각 프로퍼티는 키와 값을 콜론 `:`으로 연결하고, 여러 프로퍼티는 쉼표로 구분합니다.  
프로퍼티 키에는 문자열 또는 `Symbol`을 사용할 수 있으며, 일반적인 식별자 형태의 문자열 키는 따옴표를 생략할 수 있습니다.  

```javascript
// 객체 리터럴로 여러 종류의 값을 하나의 person 객체에 묶습니다.
const person = {
  name: "Alice", // 문자열 값
  age: 30, // 숫자 값
  isStudent: false, // 불리언 값
  hobbies: ["coding", "reading"], // 배열 값
  greet: function () {
    // 일반 함수로 선언한 메서드의 this는 호출한 객체 person을 가리킵니다.
    console.log(`Hello, my name is ${this.name}`);
  },
};

console.log(person);
// Node.js 출력에는 greet가 [Function: greet] 형태로 표시됩니다.
```

### 🟦 프로퍼티 접근과 변경

객체의 프로퍼티에는 점 표기법(Dot Notation) 또는 대괄호 표기법(Bracket Notation)으로 접근합니다.  
프로퍼티에 값을 할당하면 해당 키가 없을 때는 새 프로퍼티가 추가되고, 이미 있을 때는 기존 값이 변경됩니다.  
`delete` 연산자는 객체에서 해당 프로퍼티를 제거합니다.  

#### 🔷 점 표기법

점 표기법은 **프로퍼티 키가 유효한 JavaScript 식별자이고 키를 코드에 직접 작성할 수 있을 때** 사용합니다.  
고정된 프로퍼티에 접근할 때 가장 간결한 방법입니다.  

```javascript
// 점 표기법으로 접근할 수 있는 프로퍼티를 가진 객체입니다.
const user = {
  name: "Alice",
  age: 30,
  isAdmin: false,
};

console.log("--- 초기 객체 상태 ---");
console.log(user);
// 출력: { name: 'Alice', age: 30, isAdmin: false }

// 1. 존재하지 않는 email 키에 값을 할당하여 프로퍼티를 추가합니다.
user.email = "alice@example.com";
console.log("\n--- 'email' 추가 후 ---");
console.log(user.email); // 출력: alice@example.com
console.log(user);
// 출력: { name: 'Alice', age: 30, isAdmin: false, email: 'alice@example.com' }

// 2. 이미 존재하는 age 키에 새 값을 할당하여 프로퍼티를 변경합니다.
user.age = 31;
console.log("\n--- 'age' 수정 후 ---");
console.log(user.age); // 출력: 31
console.log(user);
// 출력: { name: 'Alice', age: 31, isAdmin: false, email: 'alice@example.com' }

// 3. delete로 isAdmin 프로퍼티 자체를 제거합니다.
delete user.isAdmin;
console.log("\n--- 'isAdmin' 삭제 후 ---");
console.log(user.isAdmin); // 출력: undefined
console.log(user);
// 출력: { name: 'Alice', age: 31, email: 'alice@example.com' }
```

#### 🔷 대괄호 표기법

대괄호 표기법은 **공백이나 하이픈이 포함된 키에 접근하거나 변수의 값으로 키를 결정할 때** 사용합니다.  
키를 직접 작성할 때는 `user["full name"]`처럼 문자열로 감쌉니다.  
변수를 사용할 때는 `user[propertyKey]`처럼 변수 이름을 따옴표 없이 작성해야 변수에 저장된 문자열을 키로 사용합니다.  

```javascript
// full name처럼 공백이 포함된 키는 대괄호 표기법으로 접근합니다.
const user = {
  "full name": "Alice Smith",
  age: 30,
  isAdmin: false,
};

console.log("--- 초기 객체 상태 ---");
console.log(user);
// 출력: { 'full name': 'Alice Smith', age: 30, isAdmin: false }

// 1. 변수에 저장된 문자열을 프로퍼티 키로 사용합니다.
const emailKey = "email";
user[emailKey] = "alice@example.com";
user["city of residence"] = "Seoul";

console.log("\n--- 'email' 및 'city of residence' 추가 후 ---");
console.log(user[emailKey]); // 출력: alice@example.com
console.log(user["city of residence"]); // 출력: Seoul
console.log(user);
// 출력: { 'full name': 'Alice Smith', age: 30, isAdmin: false,
//         email: 'alice@example.com', 'city of residence': 'Seoul' }

// 2. 동적으로 선택한 age 프로퍼티를 변경합니다.
const ageKey = "age";
user[ageKey] = 31;
console.log("\n--- 'age' 수정 후 ---");
console.log(user[ageKey]); // 출력: 31
console.log(user);

// 3. 동적으로 선택한 isAdmin 프로퍼티를 제거합니다.
const adminKey = "isAdmin";
delete user[adminKey];
console.log("\n--- 'isAdmin' 삭제 후 ---");
console.log(user[adminKey]); // 출력: undefined
console.log(user);
```

### 🟦 프로퍼티 축약

프로퍼티 축약(Property Shorthand)은 **변수 이름과 프로퍼티 키가 같을 때 `name: name`을 `name`으로 줄이는 문법**입니다.  
API 응답이나 설정 객체처럼 기존 변수로 새 객체를 만들 때 중복을 줄일 수 있습니다.  

```javascript
const name = "Bob";
const age = 30;

// 축약하지 않으면 같은 이름을 키와 값에 각각 작성합니다.
// const person = { name: name, age: age };

// 변수 이름을 한 번만 작성해도 같은 이름의 프로퍼티가 만들어집니다.
const person = { name, age };

console.log(person); // 출력: { name: 'Bob', age: 30 }
```

### 🟦 직접 소유한 프로퍼티 확인

`Object.hasOwn(object, key)`은 **프로토타입에서 상속받은 프로퍼티를 제외하고 객체가 직접 가진 프로퍼티만 확인**합니다.  
직접 소유한 프로퍼티가 있으면 `true`, 없으면 `false`를 반환합니다.  
이 정적 메서드는 ECMAScript 2022에서 추가되었습니다.  

인스턴스의 `hasOwnProperty()`는 같은 이름의 프로퍼티에 의해 가려질 수 있고, 프로토타입이 없는 객체에는 존재하지 않을 수 있습니다.  
따라서 직접 소유 여부를 검사할 때는 `Object.hasOwn()`을 사용하는 편이 안전합니다.  

```javascript
const user = { name: "Alice" };

// name은 user가 직접 소유한 프로퍼티입니다.
console.log(Object.hasOwn(user, "name")); // 출력: true

// age는 user에 존재하지 않습니다.
console.log(Object.hasOwn(user, "age")); // 출력: false
```

### 🟦 객체를 JSON 문자열로 출력

`JSON.stringify(value, replacer, space)`는 JavaScript 값을 JSON 문자열로 변환합니다.  
세 번째 인수에 `2`를 전달하면 중첩 단계마다 공백 두 칸을 사용하므로 로그를 읽기 쉬워집니다.  
다만 함수, `undefined`, `Symbol`은 객체 프로퍼티에서 생략될 수 있고 순환 참조나 `BigInt` 값은 별도 처리 없이 변환하면 오류가 발생합니다.  

```javascript
const user = {
  id: 1,
  name: "Charlie",
  details: { city: "London", registered: true },
};

// replacer는 사용하지 않고 들여쓰기 크기를 2로 지정합니다.
const json = JSON.stringify(user, null, 2);
console.log(json);
```

## 2. 배열 생성과 주요 조작 {#session-02}

배열은 **각 요소가 순서와 인덱스를 가지는 값의 목록**입니다.  
첫 번째 요소의 인덱스는 `0`이며 배열의 크기는 실행 중에 늘리거나 줄일 수 있습니다.  
한 배열에 서로 다른 타입의 값을 넣는 것도 가능하지만, 같은 목적의 데이터를 다룰 때는 요소의 형태를 일정하게 유지하는 편이 이해하고 관리하기 쉽습니다.  

```javascript
// JavaScript 배열에는 서로 다른 타입의 요소를 함께 넣을 수 있습니다.
const dynamicArray = [1, "A", true, { x: 10 }, null];

console.log(dynamicArray.length); // 출력: 5
```

### 🟦 배열 정의와 접근

배열 리터럴은 대괄호 `[]` 안에 요소를 쉼표로 구분하여 작성합니다.  
`array[index]`는 해당 위치의 요소를 반환하고, `length`는 배열의 요소 개수를 나타냅니다.  

```javascript
// 배열 리터럴로 fruits 배열을 만듭니다.
const fruits = ["Apple", "Banana", "Cherry", "Durian"];

// 배열 인덱스는 0부터 시작합니다.
console.log(fruits[0]); // 출력: Apple
console.log(fruits[3]); // 출력: Durian

// length는 현재 배열의 요소 개수입니다.
console.log(fruits.length); // 출력: 4
```

### 🟦 배열 앞뒤에 요소 추가와 제거

`push()`, `pop()`, `unshift()`, `shift()`는 **원본 배열을 직접 변경**합니다.  
`push()`와 `unshift()`는 변경된 배열의 새 길이를 반환하고, `pop()`과 `shift()`는 제거한 요소를 반환합니다.  

| 메서드 | 위치 | 동작 | 반환값 |
| --- | --- | --- | --- |
| `push()` | 끝 | 하나 이상의 요소를 추가 | 변경 후 길이 |
| `pop()` | 끝 | 마지막 요소를 제거 | 제거한 요소 |
| `unshift()` | 앞 | 하나 이상의 요소를 추가 | 변경 후 길이 |
| `shift()` | 앞 | 첫 번째 요소를 제거 | 제거한 요소 |

```javascript
// push와 pop으로 배열의 끝을 조작합니다.
const numbers = [1, 2, 3];

numbers.push(4);
console.log(`push 후: ${numbers}`); // 출력: push 후: 1,2,3,4

const popped = numbers.pop();
console.log(`제거한 값: ${popped}`); // 출력: 제거한 값: 4
console.log(`pop 후: ${numbers}`); // 출력: pop 후: 1,2,3

// unshift와 shift로 배열의 앞을 조작합니다.
const queue = [2, 3];

queue.unshift(1);
console.log(`unshift 후: ${queue}`); // 출력: unshift 후: 1,2,3

const shifted = queue.shift();
console.log(`제거한 값: ${shifted}`); // 출력: 제거한 값: 1
console.log(`shift 후: ${queue}`); // 출력: shift 후: 2,3
```

원문의 `` console.log(`Shift 후: ${2, 3}`) ``는 배열을 출력하지 않습니다.  
중괄호 안의 쉼표 연산자가 마지막 값인 `3`만 반환하기 때문입니다.  
위 예제처럼 변경된 배열 변수 `queue`를 직접 출력해야 `2,3`을 확인할 수 있습니다.  

### 🟦 배열 요소 검색

배열 검색은 **값 자체를 찾는 방법**과 **콜백 함수의 조건을 만족하는 요소를 찾는 방법**으로 나눌 수 있습니다.  

#### 🔷 값과 인덱스로 검색

`indexOf()`는 일치하는 첫 번째 요소의 인덱스를 반환하고, 찾지 못하면 `-1`을 반환합니다.  
`includes()`는 값의 포함 여부를 `true` 또는 `false`로 반환합니다.  

| 메서드 | 동작 | 찾지 못했을 때 |
| --- | --- | --- |
| `indexOf()` | 같은 값의 첫 번째 인덱스를 반환 | `-1` |
| `includes()` | 값의 포함 여부를 반환 | `false` |

#### 🔷 콜백 조건으로 검색

`find()`와 `findIndex()`는 **앞에서부터 요소를 검사하다가 콜백이 Truthy를 반환하면 즉시 검색을 멈춥니다**.  
`find()`는 찾은 요소를 반환하고 `findIndex()`는 해당 요소의 인덱스를 반환합니다.  
조건을 만족하는 요소가 없으면 각각 `undefined`와 `-1`을 반환합니다.  

`findLast()`와 `findLastIndex()`는 같은 방식으로 동작하지만 **배열의 뒤에서부터 검색**하며 ECMAScript 2023에 추가되었습니다.  
네 메서드의 최악 시간 복잡도는 모두 `O(n)`입니다.  
찾으려는 값이 배열 끝에 가까이 있다는 것을 알고 있다면 뒤에서 검색하는 메서드가 더 적은 요소를 검사할 수 있지만, 항상 더 빠른 것은 아닙니다.  

| 메서드 | 검색 방향 | 반환값 | 찾지 못했을 때 |
| --- | --- | --- | --- |
| `find()` | 앞에서 뒤로 | 조건을 만족한 첫 번째 요소 | `undefined` |
| `findIndex()` | 앞에서 뒤로 | 조건을 만족한 첫 번째 요소의 인덱스 | `-1` |
| `findLast()` | 뒤에서 앞으로 | 조건을 만족한 첫 번째 요소 | `undefined` |
| `findLastIndex()` | 뒤에서 앞으로 | 조건을 만족한 첫 번째 요소의 인덱스 | `-1` |

```javascript
const fruits = ["apple", "banana", "melon", "orange", "banana"];
const numbers = [1, 3, 5, 7, 8, 10];

console.log("--- 1. 값과 인덱스로 검색 ---");

// indexOf는 앞에서 처음 만난 banana의 인덱스를 반환합니다.
console.log(fruits.indexOf("banana")); // 출력: 1

// includes는 grape의 포함 여부를 불리언으로 반환합니다.
console.log(fruits.includes("grape")); // 출력: false

console.log("\n--- 2. 앞에서부터 조건 검색 ---");

// find는 앞에서부터 검사하여 5보다 큰 첫 번째 값 7에서 멈춥니다.
console.log(numbers.find((number) => number > 5)); // 출력: 7

// findIndex는 앞에서부터 검사하여 첫 번째 짝수 8의 인덱스를 반환합니다.
console.log(numbers.findIndex((number) => number % 2 === 0)); // 출력: 4

console.log("\n--- 3. 뒤에서부터 조건 검색 ---");

// findLast는 뒤에서부터 검사하여 첫 번째 짝수 10에서 멈춥니다.
console.log(numbers.findLast((number) => number % 2 === 0)); // 출력: 10

// findLastIndex는 뒤에서 처음 만난 5보다 큰 값 10의 인덱스를 반환합니다.
console.log(numbers.findLastIndex((number) => number > 5)); // 출력: 5

// 뒤에서 처음 만난 banana는 인덱스 4에 있습니다.
console.log(fruits.findLastIndex((fruit) => fruit === "banana")); // 출력: 4
```

### 🟦 `slice()`와 `splice()`의 차이

두 메서드는 이름이 비슷하지만 원본 배열을 변경하는지 여부가 다릅니다.  
`slice()`는 선택한 범위로 **새 배열을 만들고 원본을 유지**하지만, `splice()`는 **원본 배열에서 요소를 제거하거나 추가**합니다.  

#### 🔷 `slice()`: 원본을 유지하며 복사

`slice(start, end)`는 `start` 인덱스부터 `end` 인덱스 직전까지 복사한 새 배열을 반환합니다.  
`end`를 생략하면 배열의 끝까지 복사하고, 음수 인덱스는 배열 끝을 기준으로 위치를 계산합니다.  
인수 없이 호출하면 배열 전체를 얕게 복사합니다.  

얕은 복사는 바깥 배열만 새로 만듭니다.  
따라서 복사본에 원시 요소를 추가하거나 제거해도 원본 배열의 구성은 바뀌지 않지만, 중첩된 객체가 있다면 원본과 복사본이 같은 객체를 계속 가리킵니다.  

```javascript
const originalArray = ["A", "B", "C", "D", "E"];

// 1. 인덱스 1부터 4 직전까지 복사합니다.
const subArray = originalArray.slice(1, 4);
console.log(`subArray: ${subArray}`); // 출력: subArray: B,C,D
console.log(`원본: ${originalArray}`); // 출력: 원본: A,B,C,D,E

// 2. 인덱스 2부터 배열 끝까지 복사합니다.
const tailArray = originalArray.slice(2);
console.log(`tailArray: ${tailArray}`); // 출력: tailArray: C,D,E

// 3. 인수 없이 호출하여 배열 전체를 얕게 복사합니다.
const copyArray = originalArray.slice();
copyArray.push("F");

console.log(`복사본: ${copyArray}`); // 출력: 복사본: A,B,C,D,E,F
console.log(`원본: ${originalArray}`); // 출력: 원본: A,B,C,D,E

// 4. -3은 배열 끝에서 세 번째 요소의 인덱스를 뜻합니다.
const negativeSlice = originalArray.slice(-3);
console.log(`negativeSlice: ${negativeSlice}`); // 출력: negativeSlice: C,D,E
```

#### 🔷 `splice()`: 원본에서 제거·교체·추가

`splice(start, deleteCount, ...items)`는 **원본 배열의 `start` 위치에서 요소를 제거하고 새 요소를 삽입**합니다.  
`deleteCount`는 제거할 요소 수이며, 세 번째 인수부터는 제거한 위치에 삽입할 요소입니다.  
메서드는 원본 배열을 변경하고 제거한 요소를 새 배열로 반환합니다.  

```javascript
const mutableArray = [10, 20, 30, 40, 50];

console.log("\n--- splice 실습: 원본 변경 ---");

// 1. 인덱스 1부터 요소 두 개를 제거합니다.
const deleted1 = mutableArray.splice(1, 2);
console.log(`삭제된 요소: ${deleted1}`); // 출력: 삭제된 요소: 20,30
console.log(`남은 배열: ${mutableArray}`); // 출력: 남은 배열: 10,40,50

// 2. 인덱스 1의 요소 하나를 제거하고 A와 B를 삽입합니다.
const deleted2 = mutableArray.splice(1, 1, "A", "B");
console.log(`삭제된 요소: ${deleted2}`); // 출력: 삭제된 요소: 40
console.log(`남은 배열: ${mutableArray}`); // 출력: 남은 배열: 10,A,B,50

// 3. deleteCount가 0이므로 제거하지 않고 인덱스 2에 New를 삽입합니다.
mutableArray.splice(2, 0, "New");
console.log(`삽입 후 배열: ${mutableArray}`); // 출력: 삽입 후 배열: 10,A,New,B,50
```

## 3. 구조 분해 할당 {#session-03}

구조 분해 할당(Destructuring Assignment)은 **객체의 프로퍼티나 배열의 요소를 골라 개별 변수에 할당하는 문법**입니다.  
객체는 프로퍼티 키를 기준으로 값을 찾고, 배열은 요소의 위치를 기준으로 값을 찾습니다.  

### 🟦 객체 구조 분해 할당

객체 구조 분해는 중괄호 `{}` 안에 가져올 프로퍼티 키를 작성합니다.  
작성 순서가 아니라 **프로퍼티 키가 일치하는지**를 기준으로 값을 가져옵니다.  
객체 프로퍼티에는 정의된 열거 순서가 있지만, 구조 분해로 값을 선택할 때 작성 순서는 결과에 영향을 주지 않습니다.  

```javascript
const product = {
  name: "Laptop Pro",
  price: 1500,
  category: "Electronics",
  inStock: true,
};

// 작성 순서와 관계없이 같은 이름의 프로퍼티에서 값을 가져옵니다.
const { price, name, inStock } = product;

console.log(`제품명: ${name}`); // 출력: 제품명: Laptop Pro
console.log(`가격: ${price}`); // 출력: 가격: 1500
console.log(`재고 여부: ${inStock}`); // 출력: 재고 여부: true
```

#### 🔷 별칭 사용

콜론 `:` 뒤에 변수 이름을 작성하면 프로퍼티 키와 다른 이름의 변수에 값을 할당할 수 있습니다.  
`sku: productCode`는 `sku` 프로퍼티의 값을 `productCode` 변수에 넣으며 `sku`라는 변수는 만들지 않습니다.  

```javascript
const item = {
  name: "Coffee Maker",
  price: 50,
  sku: "CM-1001", // Stock Keeping Unit, 재고 관리 번호입니다.
};

// sku 프로퍼티의 값을 productCode라는 새 변수에 할당합니다.
const { name, sku: productCode } = item;

console.log(`상품명: ${name}`); // 출력: 상품명: Coffee Maker
console.log(`상품 코드: ${productCode}`); // 출력: 상품 코드: CM-1001

// sku 변수는 선언되지 않았으므로 접근하면 ReferenceError가 발생합니다.
// console.log(sku);
```

#### 🔷 기본값 설정

구조 분해 대상 프로퍼티의 값이 `undefined`이면 등호 `=` 오른쪽의 기본값을 사용합니다.  
프로퍼티가 없을 때뿐 아니라 프로퍼티가 존재하면서 값이 명시적으로 `undefined`인 경우에도 기본값이 적용됩니다.  
`null`, `0`, 빈 문자열, `false`에는 기본값을 적용하지 않습니다.  

```javascript
const settings = {
  theme: "dark",
  fontSize: 14,
  // lineSpacing 프로퍼티는 없습니다.
};

// lineSpacing의 값이 undefined이므로 기본값 1.5를 사용합니다.
const { theme, lineSpacing = 1.5, fontSize } = settings;

console.log(`테마: ${theme}`); // 출력: 테마: dark
console.log(`글자 크기: ${fontSize}`); // 출력: 글자 크기: 14
console.log(`줄 간격: ${lineSpacing}`); // 출력: 줄 간격: 1.5
```

#### 🔷 별칭과 기본값 함께 사용

별칭과 기본값을 함께 사용할 때는 `property: alias = defaultValue` 순서로 작성합니다.  
프로퍼티의 값이 `undefined`이면 기본값을 별칭 변수에 할당합니다.  

```javascript
const profile = { firstName: "Jane", lastName: "Doe" };

// company가 없으므로 Unknown을 orgName 변수에 할당합니다.
const { company: orgName = "Unknown", lastName } = profile;

console.log(`회사 이름: ${orgName}`); // 출력: 회사 이름: Unknown
console.log(`성: ${lastName}`); // 출력: 성: Doe
```

#### 🔷 중첩 객체 구조 분해

프로퍼티 값이 또 다른 객체라면 구조 분해 패턴을 중첩하여 안쪽 프로퍼티까지 한 번에 가져올 수 있습니다.  
다만 중간 프로퍼티가 `undefined` 또는 `null`이면 안쪽 구조를 분해할 수 없어 `TypeError`가 발생하므로 데이터 구조를 확인해야 합니다.  

```javascript
const application = {
  version: "1.0",
  metadata: {
    author: "Codemaster",
    date: "2024-01-01",
  },
};

// metadata 객체 안에서 author와 date를 꺼내 같은 이름의 변수에 할당합니다.
const {
  metadata: { author, date },
} = application;

console.log(`개발자: ${author}`); // 출력: 개발자: Codemaster
console.log(`작성일: ${date}`); // 출력: 작성일: 2024-01-01
```

### 🟦 배열 구조 분해 할당

배열 구조 분해는 대괄호 `[]` 안에 변수를 작성합니다.  
**왼쪽 변수의 위치와 오른쪽 배열 요소의 인덱스를 순서대로 연결**하므로 객체 구조 분해와 달리 순서가 중요합니다.  
필요하지 않은 요소의 위치에는 변수 대신 쉼표만 작성하여 건너뛸 수 있으며 변수 이름은 자유롭게 정할 수 있습니다.  

#### 🔷 기본 구조 분해와 요소 건너뛰기

```javascript
const userProfile = ["Sam", 35, "New York", "Developer"];

// 두 번째 위치를 비워 age 값 35를 건너뜁니다.
const [name, , city, occupation] = userProfile;

console.log(`이름: ${name}`); // 출력: 이름: Sam
console.log(`거주지: ${city}`); // 출력: 거주지: New York
console.log(`직업: ${occupation}`); // 출력: 직업: Developer
```

#### 🔷 두 변수의 값 교환

오른쪽에 교환할 값을 새 배열로 만들고 왼쪽에서 다시 구조 분해하면 임시 변수 없이 두 값을 바꿀 수 있습니다.  

```javascript
let valueA = "Hello";
let valueB = "World";

console.log(`교환 전: A=${valueA}, B=${valueB}`);
// 출력: 교환 전: A=Hello, B=World

// 오른쪽 배열을 먼저 만든 뒤 각 위치의 값을 왼쪽 변수에 할당합니다.
[valueA, valueB] = [valueB, valueA];

console.log(`교환 후: A=${valueA}, B=${valueB}`);
// 출력: 교환 후: A=World, B=Hello
```

#### 🔷 배열 구조 분해의 기본값

배열 요소가 없거나 해당 요소의 값이 `undefined`이면 변수에 기본값을 할당할 수 있습니다.  
객체 구조 분해와 마찬가지로 `null`, `0`, 빈 문자열, `false`에는 기본값을 적용하지 않습니다.  

```javascript
const ranking = ["Gold", "Silver"];

// 세 번째와 네 번째 요소가 없으므로 각 기본값을 사용합니다.
const [first, second, third = "Bronze", fourth = "None"] = ranking;

console.log(`1등: ${first}`); // 출력: 1등: Gold
console.log(`2등: ${second}`); // 출력: 2등: Silver
console.log(`3등: ${third}`); // 출력: 3등: Bronze
console.log(`4등: ${fourth}`); // 출력: 4등: None
```

#### 🔷 배열로 묶은 함수 결과 처리

JavaScript 함수는 한 번에 하나의 값만 반환합니다.  
여러 결과를 배열 하나에 묶어 반환하면 호출하는 쪽에서 구조 분해하여 각 변수에 담을 수 있습니다.  
다만 각 위치의 의미를 알아야 하므로 반환 항목이 많거나 의미가 복잡하다면 이름이 있는 프로퍼티를 가진 객체가 더 읽기 쉬울 수 있습니다.  

```javascript
// 성공 여부, 위도, 경도를 하나의 배열로 반환합니다.
function fetchCoordinates() {
  return [true, 37.5665, 126.978];
}

// 반환된 배열의 각 위치를 의미에 맞는 변수로 분해합니다.
const [success, latitude, longitude] = fetchCoordinates();

if (success) {
  console.log(`좌표: 위도 ${latitude}, 경도 ${longitude}`);
  // 출력: 좌표: 위도 37.5665, 경도 126.978
}
```

#### 🔷 나머지 요소 모으기

배열 구조 분해의 마지막에 `...변수명`을 작성하면 앞에서 선택하지 않은 나머지 요소를 새 배열로 모읍니다.  
Rest 요소는 반드시 구조 분해 패턴의 마지막에 하나만 작성해야 합니다.  

```javascript
const scores = [95, 90, 88, 75, 60, 55];

// 앞의 두 요소는 개별 변수에 넣고 나머지는 otherScores 배열로 모읍니다.
const [highest, secondHighest, ...otherScores] = scores;

console.log(`최고 점수: ${highest}`); // 출력: 최고 점수: 95
console.log(`두 번째 점수: ${secondHighest}`); // 출력: 두 번째 점수: 90
console.log(`나머지 점수: ${otherScores}`); // 출력: 나머지 점수: 88,75,60,55
```

## 4. Spread와 Rest 문법 {#session-04}

점 세 개 `...`는 작성 위치에 따라 Spread 또는 Rest로 동작합니다.  
Spread는 **배열의 요소나 객체의 프로퍼티를 개별 항목으로 펼치고**, Rest는 **구조 분해 후 남은 항목을 하나로 모읍니다**.  

### 🟦 Spread: 펼치기

배열에서 Spread를 사용하면 이터러블의 값을 하나씩 펼쳐 새 배열의 요소나 함수의 인수로 전달할 수 있습니다.  
객체 리터럴에서 사용하면 객체가 직접 소유한 열거 가능한 프로퍼티를 새 객체로 복사합니다.  

#### 🔷 배열 복사와 병합

배열 리터럴 안에서 `...array`를 작성하면 기존 배열의 요소를 새 배열에 순서대로 넣습니다.  
원본 배열 자체는 변경하지 않지만 새 배열은 얕은 복사이므로 중첩 객체는 원본과 같은 참조를 공유합니다.  

```javascript
const array1 = [1, 2, 3];
const array2 = [4, 5, 6];

// 1. array1의 요소를 펼쳐 새 배열에 넣습니다.
const arrayCopy = [...array1];
console.log(arrayCopy); // 출력: [1, 2, 3]

// 2. 두 배열의 요소를 차례대로 펼치고 7과 8을 뒤에 추가합니다.
const mergedArray = [...array1, ...array2, 7, 8];
console.log(mergedArray); // 출력: [1, 2, 3, 4, 5, 6, 7, 8]
```

#### 🔷 객체 복사와 병합

객체 리터럴 안에서 `...object`를 작성하면 해당 객체가 직접 소유한 열거 가능한 프로퍼티를 새 객체에 복사합니다.  
같은 키가 여러 번 나오면 **뒤에 작성한 프로퍼티가 앞의 값을 덮어씁니다**.  
이 방식도 얕은 복사이므로 중첩 객체까지 새로 복사하지는 않습니다.  

```javascript
const defaults = { size: "M", color: "White", material: "Cotton" };
const userOrder = { color: "Blue", quantity: 2 };

// defaults를 먼저 펼치고 userOrder를 나중에 펼칩니다.
// color는 뒤에 있는 Blue로 바뀌고, 마지막의 size는 L로 다시 바뀝니다.
const finalOrder = { ...defaults, ...userOrder, size: "L" };

console.log(finalOrder);
// 출력: { size: 'L', color: 'Blue', material: 'Cotton', quantity: 2 }
```

### 🟦 Rest: 나머지 모으기

Rest는 객체나 배열을 구조 분해할 때 **앞에서 선택하지 않은 나머지 항목을 새 객체나 배열로 모읍니다**.  
나머지를 모두 수집해야 하므로 Rest 프로퍼티 또는 요소는 구조 분해 패턴의 마지막에 작성해야 합니다.  

#### 🔷 객체의 나머지 프로퍼티

객체 구조 분해에서 Rest를 사용하면 앞에서 선택한 키를 제외한 나머지 직접 소유·열거 가능 프로퍼티를 새 객체에 담습니다.  

```javascript
const userData = {
  name: "Sam",
  age: 25,
  city: "New York",
  job: "Designer",
  role: "user",
};

// name과 age를 먼저 꺼내고 나머지 프로퍼티를 details 객체로 모읍니다.
const { name, age, ...details } = userData;

console.log(name); // 출력: Sam
console.log(age); // 출력: 25
console.log(details);
// 출력: { city: 'New York', job: 'Designer', role: 'user' }
```

#### 🔷 배열의 나머지 요소

배열 구조 분해에서 Rest를 사용하면 앞에서 분해하지 않은 나머지 요소를 순서대로 새 배열에 담습니다.  

```javascript
const scores = [90, 85, 95, 80, 75, 60];

// 앞의 두 요소를 개별 변수에 넣고 나머지를 otherScores 배열로 모읍니다.
const [highest, secondHighest, ...otherScores] = scores;

console.log(highest); // 출력: 90
console.log(secondHighest); // 출력: 85
console.log(otherScores); // 출력: [95, 80, 75, 60]
```
