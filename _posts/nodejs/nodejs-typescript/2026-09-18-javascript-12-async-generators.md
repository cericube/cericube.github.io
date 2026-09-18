---
layout: post
title: "12편. JavaScript 비동기 제너레이터(async function*) 이해하기"
description: "JavaScript의 비동기 제너레이터(async function*) 개념과 동작 방식을 이해하고, JavaScript와 TypeScript 예제를 통해 실제 사용 방법을 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "12"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 비동기 제너레이터(async function*)란?"
  - id: session-02
    title: "2. async function*의 동작 방식"
  - id: session-03
    title: "3. 비동기 제너레이터 사용 예시"
  - id: session-04
    title: "4. Node.js 스트림에서 활용하기"
---

## 1. 비동기 제너레이터(async function*)란? {#session-01}

### 🟦 개념

`async function*`는 비동기 작업을 수행하면서 여러 개의 값을 순차적으로 반환할 수 있는 함수입니다.  
일반 함수는 `return`을 이용하여 하나의 값을 반환합니다.  

```javascript
function getNumber() {
  return 1;
}
```

비동기 함수는 `await`를 사용할 수 있으며, 호출하면 Promise를 반환합니다. 아래 예제에서는 Promise가 성공적으로 완료되면 결과로 숫자 `1`을 받습니다.

```javascript
async function getNumber() {
  const value = await Promise.resolve(1);

  return value;
}
```

반면 비동기 제너레이터는 `await`와 `yield`를 함께 사용할 수 있습니다.

```javascript
async function* generateNumbers() {
  const value1 = await Promise.resolve(1);
  yield value1;

  const value2 = await Promise.resolve(2);
  yield value2;
}
```

즉 다음 두 가지 기능을 결합한 형태입니다.

```text
async
  ↓
비동기 작업을 기다릴 수 있음

function*
  ↓
yield로 값을 여러 번 반환할 수 있음

async function*
  ↓
비동기 작업의 결과를 하나씩 순차적으로 전달
```

### 🟦 JavaScript 문법인가?

`async function*`, `yield`, `for await...of`는 모두 JavaScript 문법입니다.  
TypeScript에서 추가된 문법이 아닙니다.  
JavaScript에서는 다음과 같이 작성할 수 있습니다.  

```javascript
async function* generateNumbers() {
  yield 1;
  yield 2;
  yield 3;
}
```

TypeScript에서는 동일한 JavaScript 문법에 타입 정보를 추가할 수 있습니다.

```typescript
async function* generateNumbers(): AsyncGenerator<number, void, unknown> {
  yield 1;
  yield 2;
  yield 3;
}
```

이 코드에서 TypeScript 문법에 해당하는 부분은 반환 타입을 지정한 부분입니다.  
`AsyncGenerator<T, TReturn, TNext>`의 세 타입 인자는 각각 `yield`로 전달하는 값, 종료 시 반환하는 값, `next(value)`로 받는 값의 타입입니다.  
이 예제에서는 숫자를 생성하고 종료할 때 별도의 값을 반환하지 않으므로 `number, void, unknown`을 사용합니다.  
`AsyncGenerator<number>`처럼 나머지를 생략할 수도 있지만, 이 경우 종료 값의 기본 타입이 `any`여서 `next()` 결과의 타입 검사가 느슨해집니다.  

```typescript
: AsyncGenerator<number, void, unknown>
```

정리하면 다음과 같습니다.

| 문법                                      | JavaScript | TypeScript |
| --------------------------------------- | ---------- | ---------- |
| `async function*`                       | O          | O          |
| `yield`                                 | O          | O          |
| `for await...of`                        | O          | O          |
| `AsyncGenerator<number, void, unknown>` | X          | O          |
| `value: number`                         | X          | O          |

TypeScript는 비동기 제너레이터라는 새로운 기능을 제공하는 것이 아니라, JavaScript의 기능에 **정적 타입 정보**를 추가합니다.

### 🟦 function, async function, function*, async function* 비교

네 가지 함수 형태를 비교하면 차이를 쉽게 이해할 수 있습니다.

```javascript
// 일반 함수는 값을 바로 반환합니다.
function normalFunction() {
  return 1;
}

// 비동기 함수는 Promise를 반환합니다.
async function asyncFunction() {
  return 1;
}

// 제너레이터 함수는 값을 하나씩 생성합니다.
function* generatorFunction() {
  yield 1;
  yield 2;
}

// 비동기 제너레이터 함수는 비동기 작업 후 값을 하나씩 생성합니다.
async function* asyncGeneratorFunction() {
  await Promise.resolve();

  yield 1;
  yield 2;
}
```

| 함수                | `await` | `yield` | 특징                                   |
| ----------------- | ------- | ------- | ------------------------------------ |
| `function`        | X       | X       | 하나의 값을 반환                            |
| `async function`  | O       | X       | Promise를 반환                          |
| `function*`       | X       | O       | Generator 객체를 반환하고 값을 순차적으로 생성       |
| `async function*` | O       | O       | AsyncGenerator 객체를 반환하고 값을 비동기적으로 생성 |

따라서 `async function*`의 핵심은 다음 한 문장으로 정리할 수 있습니다.

> 비동기 작업에서 만들어지는 여러 결과를 한 번에 반환하지 않고 필요한 시점마다 하나씩 전달하는 함수입니다.

---

## 2. async function*의 동작 방식 {#session-02}

### 🟦 개념

비동기 제너레이터 함수를 호출하면 **AsyncGenerator 객체**가 반환됩니다.
이때 함수 본문은 아직 실행되지 않으며, 첫 `next()` 요청이 들어오면 실행을 시작합니다.

```javascript
async function* generateNumbers() {
  yield 1;
  yield 2;
}

const generator = generateNumbers();

console.log(generator);
```

이 객체를 통해 값을 하나씩 요청할 수 있습니다.

### 🟦 yield란?

`yield`는 현재 값을 호출자에게 전달하고 함수 실행을 잠시 중단합니다.

```javascript
async function* generateNumbers() {
  yield 1;

  yield 2;

  yield 3;
}
```

호출 흐름은 다음과 같습니다.

```text
함수 호출 → AsyncGenerator 객체 생성
   ↓
첫 next() 요청
   ↓
yield 1
   ↓
1 반환 후 정지
   ↓
다음 값 요청
   ↓
yield 2
   ↓
2 반환 후 정지
   ↓
다음 값 요청
   ↓
yield 3
```

`yield`와 `return`은 함수 실행을 멈추는 방식이 다릅니다.

`return`은 함수를 종료합니다.

```javascript
function getNumber() {
  return 1;

  // return 뒤의 코드는 실행되지 않습니다.
}
```

`yield`는 함수를 종료하지 않고 **일시 정지**합니다.

```javascript
function* getNumbers() {
  yield 1;

  // 다음 요청이 오면 여기서 실행을 이어 갑니다.
  yield 2;
}
```

### 🟦 next()로 값을 가져오기

비동기 제너레이터에서는 `next()`를 이용해 다음 값을 요청할 수 있습니다.

```javascript
async function* generateNumbers() {
  yield 1;
  yield 2;
}

const generator = generateNumbers();

console.log(await generator.next());
console.log(await generator.next());
console.log(await generator.next());
```

실행 결과는 다음과 같습니다.

```text
{ value: 1, done: false }
{ value: 2, done: false }
{ value: undefined, done: true }
```

각 결과 객체에는 다음 두 가지 정보가 담겨 있습니다.

```text
value → 현재 반환된 값
done  → 제너레이터가 종료되었는지 여부
```

비동기 제너레이터의 `next()`는 Promise를 반환합니다. 결과 객체를 사용하려면 `await`로 기다리거나 `.then()`으로 처리합니다.

```javascript
const result = await generator.next();
```

TypeScript에서는 결과 타입도 추론됩니다.

```typescript
async function* generateNumbers(): AsyncGenerator<number, void, unknown> {
  yield 1;
  yield 2;
}

const generator = generateNumbers();

const result = await generator.next();

if (!result.done) {
  console.log(result.value); // 종료 전에는 value의 타입이 number로 좁혀집니다.
}
console.log(result.done);
```

`done: true`인 결과의 `value`에는 `return`으로 지정한 값이 들어갈 수 있습니다. 위 예제처럼 반환 값이 없으면 `undefined`입니다. `for await...of`는 이 종료 값을 반복 본문에 전달하지 않습니다.

### 🟦 for await...of

실제 코드에서는 `next()`를 직접 반복 호출하는 것보다 `for await...of`를 사용하는 경우가 많습니다.

```javascript
async function* generateNumbers() {
  yield 1;
  yield 2;
  yield 3;
}

async function main() {
  for await (const value of generateNumbers()) {
    console.log(value);
  }
}

main().catch(console.error);
```

실행 결과는 다음과 같습니다.

```text
1
2
3
```

`for await...of`는 내부적으로 다음 값이 준비될 때까지 기다렸다가 값을 하나씩 가져옵니다.

```text
generateNumbers() → 객체 생성
       ↓
for await가 첫 next() 요청
       ↓
    yield 1
       ↓
for await에서 1 처리 후 다음 next() 요청
       ↓
    yield 2
       ↓
for await에서 2 처리 후 다음 next() 요청
       ↓
    yield 3
       ↓
for await에서 3 처리
```

### 🟦 await와 yield의 역할

비동기 제너레이터에서는 `await`와 `yield`의 역할을 구분해서 이해하는 것이 중요합니다.

```javascript
async function* getData() {
  const data = await Promise.resolve("예시 데이터");

  yield data;
}
```

`await`는 **함수 내부의 비동기 작업을 기다리는 역할**을 합니다.

```text
await
 ↓
Promise 완료까지 대기
```

`yield`는 **준비된 값을 함수 외부로 전달하는 역할**을 합니다.

```text
yield
 ↓
호출자에게 값 전달
 ↓
함수 실행 일시 중지
```

다음 예제에서는 비동기 작업으로 준비한 값을 차례로 전달합니다.

```javascript
async function* getData() {
  const first = await Promise.resolve("첫 번째 데이터");

  yield first;

  const second = await Promise.resolve("두 번째 데이터");

  yield second;
}
```

다음 순서로 실행됩니다.

```text
Promise 대기
   ↓
첫 번째 데이터 준비
   ↓
yield
   ↓
호출자에게 전달
   ↓
다음 값 요청
   ↓
Promise 대기
   ↓
두 번째 데이터 준비
   ↓
yield
```

---

## 3. 비동기 제너레이터 사용 예시 {#session-03}

비동기 제너레이터에서 Promise를 `yield`하면, Promise가 성공적으로 완료될 때까지 기다린 뒤 그 결과를 값을 사용하는 쪽(소비자)에 전달합니다.  
Promise가 실패 상태(rejected)가 되면 해당 `next()`의 Promise도 실패하므로, 값을 사용하는 쪽에서 오류를 처리해야 합니다.

### 🟦 예시 1. 일정 시간마다 값 반환하기

비동기 제너레이터의 특징을 가장 쉽게 확인할 수 있는 예제입니다.  
먼저 일정 시간 동안 기다리는 함수를 만듭니다.

#### 🔷 JavaScript

```javascript
// 지정한 시간만큼 기다리는 함수를 정의합니다.
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function* generateNumbers() {
  for (let i = 1; i <= 3; i++) {
    // 다음 값을 준비하기 전에 1초 동안 기다립니다.
    await delay(1000);

    yield i;
  }
}

async function main() {
  for await (const number of generateNumbers()) {
    console.log(number);
  }
}

main().catch(console.error);
```

이 예제에서는 값을 받자마자 출력하므로 약 1초 간격으로 숫자가 표시됩니다.  
값을 처리하는 쪽에서도 비동기 작업을 기다린다면, 다음 값을 요청하기까지 그만큼 시간이 더 걸립니다.  
따라서 정해진 시각마다 자동으로 값을 전달하는 타이머와는 동작 방식이 다릅니다.  

```text
1
2
3
```

동작 흐름은 다음과 같습니다.

```text
1초 대기
   ↓
yield 1
   ↓
1초 대기
   ↓
yield 2
   ↓
1초 대기
   ↓
yield 3
```

#### 🔷 TypeScript

TypeScript에서는 매개변수와 반환 타입을 명시할 수 있습니다.  

```typescript
// 대기 시간과 생성하는 값의 타입을 명시합니다.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function* generateNumbers(): AsyncGenerator<number, void, unknown> {
  for (let i = 1; i <= 3; i++) {
    // 다음 값을 준비하기 전에 1초 동안 기다립니다.
    await delay(1000);

    yield i;
  }
}

async function main(): Promise<void> {
  for await (const number of generateNumbers()) {
    console.log(number);
  }
}

main().catch(console.error);
```

동작 방식은 JavaScript와 동일합니다.  
다음처럼 반환 타입을 지정하면 생성하는 값의 타입을 검사할 수 있습니다. 

```typescript
async function* generateNumbers(): AsyncGenerator<number, void, unknown>
```

이 함수가 `number` 타입의 값을 순차적으로 생성한다는 것을 명확히 표현할 수 있습니다.

---

### 🟦 예시 2. 일반 async function과 비교하기

아래 `async function`은 `delay()`를 세 번 호출하고, 각 대기가 끝난 뒤 결과를 배열에 담습니다.  
함수를 호출하면 즉시 Promise가 반환되며, 이 Promise가 성공적으로 완료되면 결과 배열을 받습니다.  
`async` 함수가 내부에서 시작한 모든 비동기 작업을 자동으로 기다리는 것은 아닙니다.  

아래 두 예제는 각각 앞에서 정의한 `delay()`와 함께 실행합니다.

```javascript
// 세 값을 배열에 모은 뒤 한 번에 반환합니다.
async function getNumbers() {
  const result = [];

  for (let i = 1; i <= 3; i++) {
    // 다음 값을 준비하기 전에 1초 동안 기다립니다.
    await delay(1000);

    result.push(i);
  }

  return result;
}
```

결과 배열을 사용하려면 세 번의 대기가 모두 끝날 때까지 기다려야 합니다.

```javascript
const numbers = await getNumbers();

console.log(numbers);
```

실행 흐름은 다음과 같습니다.

```text
1초 대기
   ↓
1 저장
   ↓
1초 대기
   ↓
2 저장
   ↓
1초 대기
   ↓
3 저장
   ↓
[1, 2, 3] 반환
```

비동기 제너레이터로 작성하면 값을 하나씩 전달할 수 있습니다.

```javascript
async function* getNumbers() {
  for (let i = 1; i <= 3; i++) {
    // 다음 값을 준비하기 전에 1초 동안 기다립니다.
    await delay(1000);

    yield i;
  }
}
```

```text
1초 대기 → 1 전달
1초 대기 → 2 전달
1초 대기 → 3 전달
```

즉 모든 결과가 준비될 때까지 기다릴 필요 없이 **준비된 데이터를 바로 사용할 수 있습니다.**

---

### 🟦 예시 3. 페이지네이션 API 처리

비동기 제너레이터는 여러 페이지의 데이터를 순차적으로 조회할 때도 유용합니다.  
아래 `fetchUsers()`는 실제 HTTP 요청 없이 예제 데이터를 만들어 반환하는 모의 API입니다.  
페이지 1~3에서 사용자 ID `11, 12, 21, 22, 31, 32`를 차례로 반환합니다.

#### 🔷 JavaScript

```javascript
// 요청한 페이지에 해당하는 사용자 두 명의 정보와 다음 페이지가 있는지를 반환합니다.
async function fetchUsers(page) {
  return {
    users: [
      { id: page * 10 + 1 },
      { id: page * 10 + 2 },
    ],
    hasNext: page < 3,
  };
}
```

비동기 제너레이터를 이용하면 다음 페이지를 조회하는 과정을 함수 내부에서 처리할 수 있습니다.

```javascript
async function* getUsers() {
  // 첫 페이지부터 순서대로 조회합니다.
  let page = 1;

  while (true) {
    const result = await fetchUsers(page);

    // 현재 페이지의 사용자를 모두 전달한 뒤 다음 페이지로 이동합니다.
    for (const user of result.users) {
      yield user;
    }

    // 마지막 페이지이면 조회를 종료합니다.
    if (!result.hasNext) {
      break;
    }

    page++;
  }
}
```

호출하는 쪽에서는 페이지 번호를 직접 관리하지 않고 데이터를 하나씩 처리할 수 있습니다.

```javascript
for await (const user of getUsers()) {
  console.log(user);
}
```

#### 🔷 TypeScript

TypeScript에서는 데이터 구조를 타입으로 명확하게 표현할 수 있습니다.

```typescript
// 사용자 정보와 페이지 응답의 구조를 정의합니다.
interface User {
  id: number;
}

interface UserPage {
  users: User[];
  hasNext: boolean;
}

async function fetchUsers(page: number): Promise<UserPage> {
  return {
    users: [
      { id: page * 10 + 1 },
      { id: page * 10 + 2 },
    ],
    hasNext: page < 3,
  };
}

async function* getUsers(): AsyncGenerator<User, void, unknown> {
  // 첫 페이지부터 순서대로 조회합니다.
  let page = 1;

  while (true) {
    const result = await fetchUsers(page);

    // 현재 페이지의 사용자를 모두 전달한 뒤 다음 페이지로 이동합니다.
    for (const user of result.users) {
      yield user;
    }

    // 마지막 페이지이면 조회를 종료합니다.
    if (!result.hasNext) {
      break;
    }

    page++;
  }
}
```

사용 방법은 동일합니다.

```typescript
for await (const user of getUsers()) {
  console.log(user.id);
}
```

이 구조의 장점은 **데이터를 가져오는 방법과 데이터를 사용하는 방법을 분리할 수 있다는 점**입니다.

```text
getUsers() → 객체 생성
   ↓
소비자가 다음 값 요청
   ↓
페이지 조회
   ↓
현재 페이지의 사용자를 하나씩 yield
   ↓
현재 페이지의 데이터를 모두 전달한 뒤 다음 페이지가 있는지 확인
   ↓
다음 페이지 조회 또는 종료
```

호출자는 단순히 다음과 같이 처리합니다.

```typescript
for await (const user of getUsers()) {
  // 전달받은 사용자 데이터를 처리합니다.
}
```

---

## 4. Node.js 스트림에서 활용하기 {#session-04}

### 🟦 개념

Node.js의 파일, HTTP 요청, 네트워크 데이터는 스트림(Stream) 형태로 처리되는 경우가 많습니다.  
스트림은 전체 데이터를 한 번에 메모리에 저장하지 않고 작은 데이터 단위인 **청크(chunk)**로 나누어 처리합니다.  

```text
큰 파일

↓ 스트림으로 읽기

chunk 1
chunk 2
chunk 3
chunk 4
...
```

Node.js의 `Readable` 스트림은 비동기 순회가 가능한 객체이므로 `for await...of`로 읽을 수 있습니다.

### 🟦 Readable 스트림 예시

#### 🔷 JavaScript

```javascript
// 파일을 Buffer 청크 단위로 읽습니다.
import fs from "node:fs";

async function readFile() {
  const stream = fs.createReadStream("./sample.txt");

  for await (const chunk of stream) {
    console.log(chunk);
  }
}

readFile().catch(console.error);
```

실행 전 현재 작업 디렉터리에 `sample.txt`를 준비해야 합니다.  
인코딩을 지정하지 않았으므로 출력되는 `chunk`는 문자열이 아닌 `Buffer`입니다.  
텍스트로 읽으려면 `fs.createReadStream("./sample.txt", { encoding: "utf8" })`을 사용합니다.  

데이터는 청크 단위로 읽으며, 작은 파일은 하나의 청크로 읽힐 수도 있습니다.

```text
Readable Stream
      ↓
   chunk 1
      ↓
   chunk 2
      ↓
   chunk 3
```

### 🟦 비동기 제너레이터로 중간 처리하기

스트림에서 읽은 데이터를 사용하기 전에 검증하거나 변환해야 할 때도 있습니다.  

예를 들어 업로드 파일의 크기를 제한한다고 가정해 보겠습니다.  
아래 함수는 `Buffer` 청크만 허용합니다.  
`Readable`은 문자열이나 객체도 전달할 수 있으므로 실제 값을 검사해야 합니다.  
타입 단언인 `as AsyncIterable<Buffer>`는 실행 중에 실제 값을 검사하거나 변환하지 않습니다.  
문자열의 `.length`는 바이트 수가 아니므로 파일 크기 검사에 그대로 사용할 수 없습니다.  

#### 🔷 TypeScript

```typescript
// 누적 크기가 10MiB 이하인 Buffer 청크만 전달합니다.
import { Buffer } from "node:buffer";
import type { Readable } from "node:stream";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

async function* limitContent(
  content: Readable,
): AsyncGenerator<Buffer, void, unknown> {
  let size = 0;

  for await (const chunk of content) {
    // 바이트 수를 계산하기 전에 청크가 Buffer인지 확인합니다.
    if (!Buffer.isBuffer(chunk)) {
      throw new TypeError("Buffer 청크만 허용합니다.");
    }

    size += chunk.length;

    // 이 청크를 포함했을 때 누적 크기가 제한을 넘으면 전달하지 않습니다.
    if (size > MAX_ATTACHMENT_SIZE) {
      throw new Error(
        `파일은 최대 ${MAX_ATTACHMENT_SIZE}바이트까지 허용합니다.`,
      );
    }

    yield chunk;
  }
}
```

이 함수는 다음 세 단계로 동작합니다.

```text
1. 스트림에서 chunk를 읽고 Buffer인지 검사
2. 누적 바이트 수 검사
3. 문제가 없으면 yield로 전달
```

코드를 순서대로 보면 다음과 같습니다.

```typescript
for await (const chunk of content) {
```

Readable 스트림에서 데이터를 하나씩 읽고, `Buffer.isBuffer(chunk)`로 타입을 확인합니다.  
검사를 통과하면 TypeScript에서도 `chunk`의 타입이 `Buffer`로 좁혀집니다.  

다음으로 읽은 청크의 크기를 누적합니다.

```typescript
size += chunk.length;
```

누적 크기가 허용 범위를 넘었는지 확인합니다.

```typescript
if (size > MAX_ATTACHMENT_SIZE) {
  throw new Error("파일 크기 제한을 초과했습니다.");
}
```

문제가 없다면 해당 데이터를 그대로 전달합니다.

```typescript
yield chunk;
```

전체 흐름은 다음과 같습니다.

```text
Readable Stream
      ↓
    chunk
      ↓
Buffer인지 검사 (아니면 오류)
      ↓
 size 누적
      ↓
크기 제한 확인
   ↙      ↘
초과       정상
 ↓          ↓
Error    yield chunk
             ↓
        다음 처리
```

### 🟦 JavaScript로 작성하면?

앞의 TypeScript 코드에서 타입 관련 문법을 제거하면 다음과 같은 JavaScript 코드가 됩니다.

```javascript
// JavaScript에서도 청크의 실제 타입과 누적 크기를 검사합니다.
import { Buffer } from "node:buffer";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

async function* limitContent(content) {
  let size = 0;

  for await (const chunk of content) {
    // 바이트 수를 계산하기 전에 청크가 Buffer인지 확인합니다.
    if (!Buffer.isBuffer(chunk)) {
      throw new TypeError("Buffer 청크만 허용합니다.");
    }

    size += chunk.length;

    // 이 청크를 포함했을 때 누적 크기가 제한을 넘으면 전달하지 않습니다.
    if (size > MAX_ATTACHMENT_SIZE) {
      throw new Error(
        `파일은 최대 ${MAX_ATTACHMENT_SIZE}바이트까지 허용합니다.`,
      );
    }

    yield chunk;
  }
}
```

다음은 실행 코드가 아니라 JavaScript 문법 이름을 발췌한 목록입니다.

```text
async function*
for await...of
yield
```

TypeScript에서는 여기에 타입이 추가됩니다.

```typescript
content: Readable
```

```typescript
AsyncGenerator<Buffer, void, unknown>
```

### 🟦 limitContent() 사용하기

앞에서 정의한 TypeScript `limitContent()`와 다음 코드를 같은 `.mts` 파일에 넣으면 파일을 읽어 검사할 수 있습니다.   현재 작업 디렉터리에 `sample.txt`를 준비하고, `Buffer`를 받도록 인코딩 옵션은 지정하지 않습니다.

```typescript
// 파일을 읽으면서 크기를 검사하고, 발생한 오류를 처리합니다.
import { createReadStream } from "node:fs";

const fileStream = createReadStream("./sample.txt");

try {
  for await (const chunk of limitContent(fileStream)) {
    console.log("처리 중:", chunk.length);
  }
} catch (error) {
  console.error("파일 처리 실패:", error);
}
```

실제 서비스에서는 검사를 통과한 청크를 파일 저장이나 업로드 단계로 전달할 수 있습니다.

```text
파일 업로드
   ↓
Readable Stream
   ↓
limitContent()
   ↓
파일 크기 검사
   ↓
yield chunk
   ↓
파일 저장 / S3 업로드 / 외부 전송
```

이 방식의 핵심 장점은 **전체 파일을 메모리에 올릴 필요가 없다는 것**입니다.  
예를 들어 최대 허용 크기가 10MiB이고 사용자가 100MiB 파일을 업로드했다고 가정합니다.  
전체 파일을 먼저 받는 방식은 다음과 같습니다.  

```text
100MiB 수신
   ↓
메모리에 저장
   ↓
크기 검사
   ↓
업로드 거부
```

반면 스트림과 비동기 제너레이터를 사용하면 다음처럼 처리할 수 있습니다.

```text
chunk 수신
   ↓
크기 검사
   ↓
chunk 수신
   ↓
크기 검사
   ↓
10MiB 초과
   ↓
즉시 오류 발생
```

여기서 `10 * 1024 * 1024`바이트는 정확히 10MiB입니다.  
누적 크기가 제한값과 같으면 허용하지만, 제한값을 넘게 하는 청크는 전달하지 않습니다.  
다만 검사 시점에는 해당 청크를 이미 읽었으며, 스트림이나 네트워크 계층에 미리 버퍼에 저장된 데이터도 있을 수 있습니다.

오류로 `for await...of`를 빠져나가면 Readable의 기본 비동기 이터레이터는 스트림을 닫고 관련 자원을 정리합니다.  
이미 저장하거나 전송한 청크까지 되돌리지는 않습니다.  
따라서 실제 업로드가 실패하면 일부만 저장된 파일을 삭제하거나 진행 중인 업로드를 취소하는 처리도 필요합니다.  
값을 사용하는 쪽에서도 청크를 계속 배열에 모아 두지 않아야 합니다.  
그래야 파일 크기가 커질수록 메모리 사용량도 함께 늘어나는 것을 막을 수 있습니다.

### 🟦 언제 async function*을 사용하면 좋은가?

비동기 제너레이터는 특히 다음과 같은 상황에 적합합니다.

* 파일을 청크 단위로 처리할 때
* 대용량 데이터를 메모리에 한 번에 올리고 싶지 않을 때
* 페이지네이션 API를 순차적으로 조회할 때
* 네트워크에서 데이터가 계속 들어올 때
* 비동기 데이터 변환 파이프라인을 구성할 때
* 데이터가 준비되는 대로 값을 사용하는 쪽에 전달하고 싶을 때

반대로 결과가 하나뿐이거나 모든 결과를 한 번에 반환하는 것이 더 자연스럽다면 일반 `async function`이 더 적합합니다.

```javascript
async function getUser() {
  return { id: 1, name: "사용자" }; // 사용자 한 명의 정보를 반환합니다.
}
```

비동기 제너레이터의 핵심을 정리하면 다음과 같습니다.

```text
async
  ↓
비동기 작업을 기다림

+

yield
  ↓
값을 하나씩 전달

=

async function*
  ↓
비동기 데이터 스트림을 순차적으로 생성
```

앞에서 살펴본 배열 수집 예제에서는 `async function`이 다음 순서로 동작합니다.

```text
비동기 작업
   ↓
명시적으로 기다린 작업 완료
   ↓
Promise가 완료되면 최종 결과 전달
```

`async function*`는 다음 값을 요청할 때마다 작업을 이어 갑니다.

```text
비동기 작업
   ↓
결과 준비
   ↓
yield
   ↓
소비자의 다음 값 요청
   ↓
다음 비동기 작업
   ↓
결과 준비
   ↓
yield
```

따라서 `async function*`는 비동기적으로 계속 생성되는 여러 데이터를 순차적으로 처리해야 할 때 사용하는 JavaScript의 비동기 제너레이터 문법**이라고 이해하면 됩니다.  