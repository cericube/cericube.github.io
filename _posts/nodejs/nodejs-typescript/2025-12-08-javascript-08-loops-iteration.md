---
layout: post
title: "08. JavaScript 반복문과 순회 이해하기"
description: "JavaScript의 for, while, forEach 문법과 Iterable, Iterator, Generator의 기본 동작을 예제로 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "08"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 반복문의 기본 이해와 흐름 제어"
  - id: session-02
    title: "2. 핵심 반복문 비교: for, for...in, for...of"
  - id: session-03
    title: "3. 순회의 원리: Iterable과 Iterator 프로토콜"
  - id: session-04
    title: "4. 다양한 객체의 forEach 사용법"
  - id: session-05
    title: "5. 고급 순회와 지연 평가: Generator"
---

## 1. 반복문의 기본 이해와 흐름 제어 {#session-01}

### 🟦 기본 반복문: while과 do...while

`while` 문은 조건을 먼저 검사하고 조건이 `true`인 동안 코드 블록을 반복합니다.  
처음부터 조건이 `false`이면 코드 블록은 한 번도 실행되지 않습니다.  

```javascript
let count = 0;

while (count < 3) {
  console.log(`while 반복 ${count}번`);

  // 조건이 언젠가 false가 되도록 값을 변경해야 무한 반복을 피할 수 있습니다.
  count++;
}

// 출력:
// while 반복 0번
// while 반복 1번
// while 반복 2번
```

`do...while` 문은 코드 블록을 먼저 실행한 다음 조건을 검사합니다.  
따라서 조건이 처음부터 `false`이더라도 코드 블록을 한 번은 실행합니다.  

```javascript
let number = 5;

do {
  console.log(`do...while은 최소 한 번 실행됩니다. (현재 number: ${number})`);
  number++;
} while (number < 5);

// 출력:
// do...while은 최소 한 번 실행됩니다. (현재 number: 5)
```

### 🟦 for 문: 횟수 기반 반복

`for` 문은 반복 횟수가 정해져 있을 때 반복 작업을 구조적으로 표현할 수 있게 합니다.  
초기화, 조건과 증감 부분을 한 문장에 작성합니다.  

- **초기화(Initialization)**: 반복을 시작할 때 한 번 실행하며 보통 카운터 변수를 선언합니다.  
- **조건(Condition)**: 각 반복 전에 검사하며, 결과가 `false`이면 반복을 종료합니다.  
- **증감(Increment/Decrement)**: 각 반복이 끝난 뒤 카운터 값을 변경합니다.  

```javascript
const items = ["Pen", "Pencil", "Eraser"];

for (let index = 0; index < items.length; index++) {
  console.log(`[${index}]: ${items[index]}`);
}

// 출력:
// [0]: Pen
// [1]: Pencil
// [2]: Eraser
```

### 🟦 흐름 제어: break와 continue

`break`와 `continue`는 반복문 안에서 실행 흐름을 제어하는 키워드입니다.  

- `break`는 현재 반복문을 즉시 종료합니다.  
- `continue`는 현재 반복에서 남은 코드를 건너뛰고 다음 반복으로 이동합니다.  

```javascript
for (let number = 1; number <= 5; number++) {
  if (number === 3) {
    console.log("숫자 3은 건너뜁니다.");
    continue;
  }

  if (number === 5) {
    console.log("숫자 5에서 반복을 완전히 중단합니다.");
    break;
  }

  console.log(`현재 숫자: ${number}`);
}

// 출력:
// 현재 숫자: 1
// 현재 숫자: 2
// 숫자 3은 건너뜁니다.
// 현재 숫자: 4
// 숫자 5에서 반복을 완전히 중단합니다.
```

## 2. 핵심 반복문 비교: for, for...in, for...of {#session-02}

JavaScript의 `for`, `for...in`, `for...of`는 모두 반복문이지만 순회 대상과 목적이 다릅니다.  
각 문법의 특징을 이해하면 상황에 맞는 순회 방식을 선택할 수 있습니다.  

### 🟦 for: 인덱스 기반 순회

`for` 문은 배열의 인덱스를 직접 사용하거나 반복 횟수를 세밀하게 제어해야 할 때 유용합니다.  
특정 구간만 순회하거나 카운터를 2씩 증가시키는 작업 등에 적합합니다.  

```javascript
const data = ["A", "B", "C"];

for (let index = 0; index < data.length; index++) {
  console.log(`data[${index}] = ${data[index]}`);
}
```

### 🟦 for...in: 속성 키 순회

`for...in` 문은 객체의 열거 가능한 문자열 속성 키를 순회합니다.  
상속받은 열거 가능한 속성도 포함하므로 객체가 직접 가진 속성만 처리하려면 `Object.hasOwn()`으로 확인해야 합니다.  

배열에는 숫자 인덱스 외의 속성이나 상속받은 속성도 존재할 수 있고, 인덱스가 문자열로 전달되므로 배열 순회에는 일반적으로 `for`, `forEach()` 또는 `for...of`를 사용합니다.  

```javascript
const user = { name: "Kim", age: 30, city: "Seoul" };

for (const key in user) {
  // 프로토타입에서 상속받은 속성은 제외합니다.
  if (!Object.hasOwn(user, key)) {
    continue;
  }

  console.log(`${key}: ${user[key]}`);
}

// 출력:
// name: Kim
// age: 30
// city: Seoul
```

### 🟦 for...of: 값 기반 순회

`for...of` 문은 Array, String, Map과 Set 같은 Iterable 객체의 값을 순회합니다.  
배열의 인덱스가 필요하지 않고 값만 사용하면 되는 상황에서 간결하게 사용할 수 있습니다.  

```javascript
const names = ["철수", "영희", "민수"];

for (const name of names) {
  console.log(`이름: ${name}`);
}

const text = "JS";

for (const character of text) {
  console.log(`문자: ${character}`);
}

// 출력:
// 이름: 철수
// 이름: 영희
// 이름: 민수
// 문자: J
// 문자: S
```

### 🟦 for, for...in, for...of 비교

| 구분 | `for` | `for...in` | `for...of` |
| --- | --- | --- | --- |
| 순회 대상 | 카운터나 배열 인덱스 | 객체의 열거 가능한 문자열 속성 키 | Iterable이 제공하는 값 |
| 주요 용도 | 횟수와 인덱스 제어 | 객체의 속성 확인 | Array, Map, Set 등의 값 순회 |
| 흐름 제어 | `break`, `continue` 사용 가능 | `break`, `continue` 사용 가능 | `break`, `continue` 사용 가능 |
| 선택 기준 | 반복 범위를 직접 제어할 때 사용합니다. | 객체 속성을 확인할 때 사용합니다. | 값 중심으로 순회할 때 사용합니다. |

반복문의 성능은 실행 환경과 데이터 형태에 따라 달라집니다.  
일반적인 코드에서는 미세한 성능 차이를 단정하기보다 필요한 인덱스, 키 또는 값을 가장 분명하게 표현하는 문법을 선택하는 편이 좋습니다.  

## 3. 순회의 원리: Iterable과 Iterator 프로토콜 {#session-03}

`for...of` 문이 배열, 문자열, Map과 Set 등 여러 자료 구조를 순회할 수 있는 이유는 JavaScript가 제공하는 Iterable과 Iterator 프로토콜 덕분입니다.  
이 개념을 이해하면 순회 가능한 객체가 어떻게 값을 하나씩 제공하는지 알 수 있습니다.  

| 개념 | 의미 | 조건 | 역할 |
| --- | --- | --- | --- |
| Iterable | 순회할 수 있는 객체 | `[Symbol.iterator]()` 메서드를 가집니다. | Iterator를 생성합니다. |
| Iterator | 순회를 수행하는 객체 | `next()` 메서드를 가집니다. | 각 단계에서 `{ value, done }`을 반환합니다. |
| `for...of` | Iterable을 순회하는 문법 | Iterable이 필요합니다. | Iterator 호출을 자동으로 처리합니다. |

### 🟦 Iterable: Symbol.iterator를 가진 객체

Iterable은 `for...of` 같은 반복문에서 사용할 수 있는 순회 가능한 객체입니다.  
객체가 Iterable이 되려면 `[Symbol.iterator]()` 메서드를 가지고 있어야 하며, 이 메서드는 Iterator 객체를 반환해야 합니다.  

JavaScript에서 기본적으로 Iterable인 대표적인 객체는 다음과 같습니다.  

- Array
- String
- Map
- Set
- 함수의 `arguments` 객체
- 브라우저의 NodeList

이러한 객체는 별도의 설정 없이 `for...of` 문으로 순회할 수 있습니다.  

### 🟦 Iterator: next로 순회를 수행하는 객체

Iterator는 실제 순회 과정을 수행하는 객체입니다.  
`next()`를 호출할 때마다 순회가 한 단계 진행되고 다음과 같은 형태의 객체를 반환합니다.  

```javascript
{
  value: "현재 값",
  done: false,
}
```

`done`이 `true`이면 순회가 끝났다는 뜻입니다.  

```javascript
const myArray = ["A", "B"];
const iterator = myArray[Symbol.iterator]();

// next()를 호출할 때마다 다음 값과 종료 여부를 확인할 수 있습니다.
console.log(iterator.next()); // { value: "A", done: false }
console.log(iterator.next()); // { value: "B", done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

### 🟦 for...of의 내부 동작

`for...of` 문은 개발자가 `[Symbol.iterator]()`와 `next()`를 직접 호출하지 않아도 되도록 이 과정을 처리합니다.  
내부 동작을 단순화하면 다음과 같습니다.  

1. 대상 객체의 `[Symbol.iterator]()`를 호출하여 Iterator를 얻습니다.  
2. Iterator의 `next()`를 반복해서 호출합니다.  
3. 반환 객체의 `value`를 반복문 안에서 사용합니다.  
4. 반환 객체의 `done`이 `true`이면 반복을 종료합니다.  

```javascript
const iterable = ["A", "B"];

for (const item of iterable) {
  console.log(item);
}
```

## 4. 다양한 객체의 forEach 사용법 {#session-04}

JavaScript에서는 배열을 포함한 여러 자료 구조가 콜백 함수를 이용한 순회를 지원합니다.  
고차 함수는 다른 함수를 인수로 받거나 함수를 반환하는 함수입니다.  
배열의 `forEach()`, `map()`, `filter()`와 `reduce()`가 대표적인 고차 함수입니다.  

### 🟦 Array.prototype.forEach

`forEach()`는 배열의 요소를 하나씩 순회하면서 콜백 함수를 실행합니다.  
값을 순서대로 처리하며 새로운 배열을 만들 필요가 없는 상황에 적합합니다.  

- 반환값은 항상 `undefined`입니다.  
- 반복 도중 `break`나 `continue`를 사용할 수 없습니다.  
- 콜백은 요소의 값, 인덱스와 배열 자체를 차례로 받습니다.  
- 콘솔 출력이나 외부 상태 변경 같은 부수 효과가 필요한 작업에 주로 사용합니다.  

```javascript
const scores = [85, 92, 78];
let total = 0;

scores.forEach((score, index) => {
  console.log(`${index + 1}번째 점수: ${score}점`);
  total += score;
});

console.log(`총점: ${total}`); // 총점: 255
```

### 🟦 Map과 Set의 forEach

Map과 Set도 `forEach()` 메서드를 제공하지만 자료 구조의 특성에 따라 콜백 인수가 다릅니다.  

#### 🔷 Map 순회

Map은 키와 값의 쌍을 저장합니다.  
`Map.prototype.forEach()`의 콜백은 값, 키와 Map 객체를 차례로 받습니다.  

```javascript
const personMap = new Map([
  ["id", 101],
  ["role", "Admin"],
]);

personMap.forEach((value, key) => {
  console.log(`[${key}]: ${value}`);
});

// 출력:
// [id]: 101
// [role]: Admin
```

#### 🔷 Set 순회

Set은 중복되지 않는 값만 저장합니다.  
`Set.prototype.forEach()`의 콜백은 값, 같은 값과 Set 객체를 차례로 받습니다.  
첫 번째와 두 번째 인수를 같게 제공하는 것은 Map과 Array의 `forEach()` 콜백 형태와 일관성을 유지하기 위한 API 설계입니다.  

```javascript
const uniqueItems = new Set(["Mouse", "Keyboard", "Monitor"]);

uniqueItems.forEach((value, sameValue) => {
  console.log(
    `항목: ${value} (value === sameValue: ${value === sameValue})`,
  );
});

// 출력 예:
// 항목: Mouse (value === sameValue: true)
```

### 🟦 유사 배열 객체와 Array.from

`arguments`와 NodeList 같은 객체는 배열과 비슷한 형태를 가지지만 실제 Array는 아닙니다.  
최신 브라우저의 NodeList는 자체 `forEach()`를 제공하지만 `map()`이나 `filter()` 같은 Array 메서드는 제공하지 않습니다.  
전체 Array 메서드가 필요하면 `Array.from()`으로 새로운 배열을 만들 수 있습니다.  

```javascript
const nodeList = document.querySelectorAll("button");
const buttonArray = Array.from(nodeList);

buttonArray.forEach((button) => {
  button.classList.add("btn-primary");
  console.log(`${button.textContent}에 클래스를 추가했습니다.`);
});

// 두 번째 인수를 사용하면 각 요소를 변환하면서 배열을 만들 수 있습니다.
const buttonTexts = Array.from(nodeList, (button) => {
  return button.textContent;
});

console.log(buttonTexts);
```

### 🟦 map, filter, reduce 간단 비교

| 함수 | 목적 | 반환값 | 특징 |
| --- | --- | --- | --- |
| `map()` | 배열 요소 변환 | 새로운 배열 | 각 요소를 일대일로 변환합니다. |
| `filter()` | 조건에 맞는 요소 추출 | 새로운 배열 | 조건을 만족하는 요소만 남깁니다. |
| `reduce()` | 배열 전체 집계 | 누적 결과 | 합계와 평균 같은 누적 연산에 활용합니다. |

```javascript
const numbers = [1, 2, 3, 4, 5];

const doubled = numbers.map((number) => number * 2);
const evens = numbers.filter((number) => number % 2 === 0);

console.log(`원본: ${numbers}`);
console.log(`map 결과: ${doubled}`);
console.log(`filter 결과: ${evens}`);
```

고차 함수의 개념은 [3편 함수 다루기](https://quadcube.tistory.com/261)에서도 확인할 수 있습니다.  

## 5. 고급 순회와 지연 평가: Generator {#session-05}

Generator는 JavaScript에서 Iterator를 간편하게 만드는 특별한 함수입니다.  
일반 함수와 달리 한 번에 끝까지 실행하지 않고 필요할 때마다 실행을 이어갈 수 있습니다.  
이러한 특징을 지연 평가(Lazy Evaluation)에 활용할 수 있습니다.  

### 🟦 Generator 함수와 yield

Generator 함수는 `function` 키워드 뒤에 별표를 붙인 `function*` 문법으로 정의합니다.  
함수를 호출하면 본문을 즉시 끝까지 실행하는 대신 중단과 재개가 가능한 Generator 객체를 반환합니다.  

일반 함수의 `return`은 값을 반환하면서 함수를 종료합니다.  
Generator의 `yield`는 값을 하나 제공하고 해당 지점에서 실행을 멈춥니다.  
이후 `next()`를 호출하면 멈춘 지점부터 실행을 이어갑니다.  

```javascript
function* countGenerator() {
  yield 1;
  yield 2;
  yield 3;
}
```

### 🟦 Generator는 Iterator이자 Iterable

Generator 함수를 호출하면 `next()`를 가진 Iterator이면서 `for...of`에서 사용할 수 있는 Iterable인 객체가 반환됩니다.  

```javascript
const counter = countGenerator();

console.log(counter.next()); // { value: 1, done: false }
console.log(counter.next()); // { value: 2, done: false }
console.log(counter.next()); // { value: 3, done: false }
console.log(counter.next()); // { value: undefined, done: true }
```

### 🟦 Generator 활용 예시: ID 생성기

값을 미리 배열에 모두 저장하지 않고 필요할 때마다 하나씩 생성할 수 있습니다.  
다음 예제는 호출할 때마다 증가하는 번호를 제공합니다.  

```javascript
function* idGenerator() {
  let id = 1;

  while (true) {
    // next()가 호출될 때마다 현재 ID를 제공한 뒤 실행을 멈춥니다.
    yield id++;
  }
}

const userIds = idGenerator();

console.log(userIds.next().value); // 1
console.log(userIds.next().value); // 2
console.log(`다음 ID: ${userIds.next().value}`); // 다음 ID: 3
```

이 Generator는 종료 조건이 없는 무한 반복을 사용하므로 필요한 횟수만큼만 `next()`를 호출해야 합니다.  
