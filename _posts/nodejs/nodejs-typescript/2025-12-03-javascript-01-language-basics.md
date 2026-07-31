---
layout: post
title: "01. JavaScript 기본 문법: 변수, 타입, 스코프, 호이스팅"
description: "JavaScript의 변수 선언, 데이터 타입, Truthy와 Falsy, 스코프, 호이스팅, 주요 연산자와 템플릿 리터럴을 예제와 함께 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "01"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 변수: let, const, var"
  - id: session-02
    title: "2. 데이터 타입: 원시 타입과 객체 타입"
  - id: session-03
    title: "3. Truthy와 Falsy, 단축 평가"
  - id: session-04
    title: "4. 스코프: 블록, 함수, 전역"
  - id: session-05
    title: "5. 호이스팅과 TDZ"
  - id: session-06
    title: "6. 주요 연산자"
  - id: session-07
    title: "7. 템플릿 리터럴"
---

## 1. 변수: let, const, var {#session-01}

JavaScript에서 변수는 **이름을 통해 값에 접근할 수 있도록 연결한 바인딩**입니다.  
변수를 선언할 때는 `let`, `const`, `var` 중 하나를 사용합니다.  
새 코드에서는 **기본적으로 `const`를 사용하고, 변수에 다른 값을 다시 넣어야 할 때만 `let`을 사용**합니다.  
`var`는 블록 스코프를 따르지 않고 같은 스코프에서 재선언할 수도 있어 예상하지 못한 동작을 만들기 쉬우므로 사용을 지양합니다.  

| 키워드 | 스코프 | 재할당 | 같은 스코프에서 재선언 | 특징 |
| --- | --- | --- | --- | --- |
| `let` | 블록 스코프 | 가능 | 불가 | 재할당이 필요한 변수에 사용 |
| `const` | 블록 스코프 | 불가 | 불가 | 바인딩을 다시 할당할 수 없음 |
| `var` | 함수 또는 전역 스코프 | 가능 | 가능 | 블록 스코프를 따르지 않아 사용 지양 |

`const`는 **변수와 값의 연결을 고정하여 다른 값을 재할당하지 못하게 하는 키워드**입니다.  
값 자체를 모두 변경 불가능하게 만드는 기능은 아닙니다.  
따라서 `const`로 선언한 객체나 배열은 다른 객체나 배열로 바꿀 수 없지만, 내부 속성이나 요소는 변경할 수 있습니다.  

```javascript
// 1. let은 선언 후 다른 값을 재할당할 수 있습니다.
let name = "Alice";
console.log(name); // 출력: Alice

name = "Bob";
console.log(name); // 출력: Bob

// 같은 스코프에서 let 변수를 다시 선언하면 SyntaxError가 발생합니다.
// let name = "Charlie";

if (true) {
  // let으로 선언한 변수는 현재 블록 안에서만 접근할 수 있습니다.
  let blockScoped = "I'm block-scoped";
  console.log(blockScoped); // 출력: I'm block-scoped
}

// 블록 밖에서는 blockScoped를 찾을 수 없어 ReferenceError가 발생합니다.
// console.log(blockScoped);

// 2. const는 선언과 동시에 초기화해야 하며 재할당할 수 없습니다.
const PI = 3.14159;
console.log(PI); // 출력: 3.14159

// const 바인딩을 다시 할당하면 TypeError가 발생합니다.
// PI = 3.14;

const user = { id: 1, name: "Max" };

// const가 객체 내부까지 불변으로 만들지는 않으므로 속성은 변경할 수 있습니다.
user.name = "Maximilian";
console.log(user); // 출력: { id: 1, name: 'Maximilian' }

// user 바인딩 자체를 다른 객체로 바꾸면 TypeError가 발생합니다.
// user = { id: 2, name: "New" };

// 3. var는 같은 스코프에서 재선언할 수 있습니다.
var oldVar = "Global or Function Scope";
var oldVar = "Re-declared and no error";
console.log(oldVar); // 출력: Re-declared and no error
```

## 2. 데이터 타입: 원시 타입과 객체 타입 {#session-02}

JavaScript의 값은 크게 **원시 값(Primitive Value)**과 **객체(Object)**로 나눌 수 있습니다.  
두 종류의 가장 중요한 차이는 값을 다룰 때 **값 자체를 사용하는지, 객체를 가리키는 참조를 사용하는지**에 있습니다.  

### 🟦 원시 타입

원시 타입에는 `string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`의 7가지가 있습니다.  
원시 값은 **값 자체의 내용을 직접 변경할 수 없는 값**입니다.  
원시 값을 가공하면 기존 값이 수정되는 것이 아니라 **연산 결과에 해당하는 새로운 원시 값**이 만들어집니다.  
변수를 `let`으로 선언하면 그 변수에 새로운 원시 값을 재할당할 수 있지만, 기존 원시 값 자체가 바뀌는 것은 아닙니다.  
이는 변수의 재할당을 막는 `const`와 구분해야 합니다.  

- `string`: 텍스트를 나타내는 문자열입니다.  
- `number`: 정수와 부동소수점 수를 함께 나타내는 숫자 타입입니다.  
- `boolean`: `true` 또는 `false`를 나타내는 논리 타입입니다.  
- `null`: 값이 없음을 의도적으로 나타냅니다.  
- `undefined`: 값이 할당되지 않았음을 나타냅니다.  
- `symbol`: 고유한 식별자로 사용할 수 있으며 주로 객체의 속성 키에 사용합니다.  
- `bigint`: `Number.MAX_SAFE_INTEGER`보다 큰 정수를 정밀하게 다룰 때 사용합니다.  

`bigint`는 **`number`가 안전하게 표현할 수 있는 정수 범위를 넘어선 큰 정수를 정확하게 다루기 위한 타입**이며 ECMAScript 2020에서 표준화되었습니다.  
`number`와 `bigint`는 서로 다른 타입이므로 두 값을 그대로 섞어 산술 연산하면 `TypeError`가 발생합니다.  
함께 계산해야 한다면 값의 범위와 정밀도를 확인한 뒤 한쪽 타입으로 명시적으로 변환해야 합니다.  

### 🟦 객체 타입

객체는 **여러 값을 하나로 묶고, 속성 이름을 통해 각 값에 접근하는 데이터 구조**입니다.  
일반 객체뿐 아니라 배열, 함수, 날짜, 정규 표현식도 객체에 해당합니다.  
객체를 변수에 할당하면 객체 자체를 복사하는 것이 아니라 **같은 객체를 가리키는 참조가 전달**됩니다.  
따라서 두 변수가 같은 객체를 가리키고 있다면 한 변수를 통해 속성을 변경했을 때 다른 변수에서도 변경된 결과가 보입니다.  
객체의 속성은 일반적으로 변경할 수 있지만 `Object.freeze()` 같은 기능으로 변경을 제한할 수도 있습니다.  
실제 메모리에 값과 참조를 저장하는 방식은 JavaScript 엔진의 구현 세부 사항입니다.  

```javascript
// 1. 원시 타입의 값을 선언합니다.
const str = "Hello";
const num = 123.45;
const bool = true;
const n = null;
let u; // 값을 할당하지 않았으므로 undefined입니다.
const uniqueKey = Symbol("key");

console.log(typeof str); // 출력: string
console.log(typeof num); // 출력: number
console.log(typeof bool); // 출력: boolean

// typeof null이 "object"인 것은 초창기 JavaScript부터 이어진 특수 동작입니다.
// null의 실제 분류는 원시 값입니다.
console.log(typeof n); // 출력: object
console.log(typeof u); // 출력: undefined
console.log(typeof uniqueKey); // 출력: symbol

// 2. Number의 최대 안전 정수 경계에서는 서로 다른 정수가 같게 표현될 수 있습니다.
const maxSafe = Number.MAX_SAFE_INTEGER; // 9007199254740991
console.log(maxSafe + 1 === maxSafe + 2); // 출력: true

// 정수 리터럴 끝에 n을 붙이면 bigint 값을 만들 수 있습니다.
const reallyBig = 9007199254740991n + 2n;
console.log(reallyBig); // 출력: 9007199254740993n
console.log(typeof reallyBig); // 출력: bigint

// number와 bigint를 직접 더하면 TypeError가 발생합니다.
// console.log(1n + 1);

// 3. 객체, 배열, 함수의 typeof 결과를 확인합니다.
const obj = { a: 1 };
const arr = [1, 2, 3];
const func = function () {};

console.log(typeof obj); // 출력: object
console.log(typeof arr); // 출력: object

// 함수도 객체이지만 typeof는 호출 가능한 값을 구분해 "function"을 반환합니다.
console.log(typeof func); // 출력: function
```

## 3. Truthy와 Falsy, 단축 평가 {#session-03}

JavaScript는 `boolean`이 아닌 값도 `if` 문의 조건이나 논리 연산자에서 **필요에 따라 `true` 또는 `false`로 변환하여 판단**합니다.  
이때 `false`로 판단하는 값을 Falsy, `true`로 판단하는 값을 Truthy라고 합니다.  

### 🟦 Falsy와 Truthy

Falsy는 조건을 판단할 때 **`false`로 변환되는 값**입니다.  
일반적으로 기억해야 할 Falsy 원시 값은 `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`입니다.  
웹 호환성을 위해 남아 있는 `document.all`은 객체이면서 Falsy로 판단되는 특수한 예외입니다.  
이 예외를 제외한 나머지 값은 모두 Truthy입니다.  
따라서 문자열 `"0"`과 `"false"`, 빈 배열 `[]`, 빈 객체 `{}`, `1`, `-1`, `Infinity`도 내용이나 이름과 관계없이 Truthy로 판단됩니다.  

```javascript
// 빈 배열은 내용이 없어도 객체이므로 Truthy입니다.
if ([]) {
  console.log("[] (빈 배열)은 Truthy입니다.");
} // 출력: [] (빈 배열)은 Truthy입니다.

// 숫자 0은 Falsy이므로 else 블록을 실행합니다.
if (0) {
  console.log("이 문장은 실행되지 않습니다.");
} else {
  console.log("0은 Falsy입니다."); // 출력: 0은 Falsy입니다.
}

// 템플릿 리터럴 "${""}"는 결과적으로 빈 문자열 ""가 되므로 Falsy입니다.
console.log(Boolean(`${1}`));  // true ("1")
console.log(Boolean(`${""}`)); // false ("")
```

### 🟦 논리 OR(`||`) 단축 평가

`||`는 **왼쪽부터 평가하다가 Truthy를 만나면 즉시 그 값을 반환**하고 뒤는 평가하지 않습니다.  
왼쪽 값이 Falsy이면 오른쪽 값을 평가하여 반환합니다.  
모든 값이 Falsy라면 마지막 값을 그대로 반환합니다.  
이 동작을 이용하면 기본값을 간단히 설정할 수 있습니다.  
다만 `0`, 빈 문자열, `false`처럼 의도적으로 사용한 값도 Falsy이므로 오른쪽 기본값으로 바뀔 수 있다는 점에 주의해야 합니다.  

```javascript
// 빈 문자열은 Falsy이므로 defaultName을 선택합니다.
const username = "";
const defaultName = "Guest";
const finalName = username || defaultName;
console.log(finalName); // 출력: Guest

// 30은 Truthy이므로 뒤의 10을 평가하지 않고 age를 선택합니다.
const age = 30;
const finalAge = age || 10;
console.log(finalAge); // 출력: 30
```

### 🟦 논리 AND(`&&`) 단축 평가

`&&`는 **왼쪽부터 평가하다가 Falsy를 만나면 즉시 그 값을 반환**하고 뒤는 평가하지 않습니다.  
왼쪽 값이 Truthy이면 오른쪽 값을 평가하여 반환합니다.  
모든 값이 Truthy라면 마지막 값을 그대로 반환합니다.  
이 동작을 이용하면 앞의 조건이 참일 때만 뒤의 함수를 실행할 수 있습니다.  

```javascript
// true는 Truthy이므로 뒤의 console.log를 실행합니다.
const isAuthenticated = true;
isAuthenticated && console.log("관리자 패널 로딩...");
// 출력: 관리자 패널 로딩...

// 0은 Falsy이므로 뒤의 문자열을 평가하지 않고 0을 반환합니다.
const shouldProcess = 0;
const result = shouldProcess && "Processed";
console.log(result); // 출력: 0
```

## 4. 스코프: 블록, 함수, 전역 {#session-04}

스코프(Scope)는 **변수나 함수의 이름을 사용할 수 있는 범위**입니다.  
변수를 어디에서 선언했는지에 따라 접근할 수 있는 위치가 달라집니다.  
안쪽 스코프에서는 바깥 스코프의 이름을 사용할 수 있지만, 바깥 스코프에서는 안쪽에만 선언된 이름을 사용할 수 없습니다.  

### 🟦 블록 스코프

`let`과 `const`로 선언한 변수는 **가장 가까운 중괄호 블록 안에서만 사용**할 수 있습니다.  
`if`, `for`, `while` 문이나 일반 중괄호로 만든 영역이 하나의 블록이 됩니다.  
블록을 벗어나면 그 안에서 선언한 이름에 접근할 수 없어 `ReferenceError`가 발생합니다.  
변수가 필요한 영역을 블록 안으로 제한하면 다른 코드에서 실수로 값을 읽거나 변경하는 일을 줄일 수 있습니다.  

```javascript
function exampleBlockScope() {
  if (true) {
    // message와 limit은 현재 if 블록 안에서만 유효합니다.
    const message = "Inside the block";
    const limit = 100;
    console.log(message, limit); // 출력: Inside the block 100
  }

  // 블록 밖에서 message에 접근하면 ReferenceError가 발생합니다.
  // console.log(message);
}

exampleBlockScope();
```

### 🟦 함수 스코프

함수 안에서 `var`로 선언한 변수는 **가장 가까운 함수 전체에서 사용**할 수 있습니다.  
`if`, `for`, `while`의 중괄호는 `var`의 스코프를 제한하지 않습니다.  
따라서 블록 안에서 선언한 `var` 변수를 같은 함수의 블록 밖에서도 사용할 수 있습니다.  
이처럼 변수의 범위가 코드 모양보다 넓어질 수 있어 값을 잘못 읽거나 덮어쓰는 실수가 발생하기 쉽습니다.  

> "가장 가까운 함수"란? 예를 들어 함수가 중첩되어 있다면 가장 안쪽(가장 가까운) 함수가 스코프가 됩니다.

```javascript
function exampleFunctionScope() {
  if (true) {
    // var는 if 블록이 아닌 exampleFunctionScope 함수에 속합니다.
    var counter = 10;
    console.log(counter); // 출력: 10
  }

  // 같은 함수 안이므로 if 블록 밖에서도 counter에 접근할 수 있습니다.
  console.log(counter); // 출력: 10
}

exampleFunctionScope();

// 함수 스코프 밖에서 counter에 접근하면 ReferenceError가 발생합니다.
// console.log(counter);
```

### 🟦 전역 스코프

전역 스코프는 **특정 함수나 블록 안에 제한되지 않은 가장 바깥쪽 범위**입니다.  
전역에 선언된 이름은 여러 코드 영역에서 접근할 수 있어 편리하지만, 어디에서 값이 바뀌었는지 추적하기 어려워질 수 있습니다.  
다만 코드의 최상위에 선언했다고 해서 항상 전역 객체의 속성이 되는 것은 아닙니다.  
브라우저의 일반 스크립트 최상위에서 선언한 `let`과 `const`는 `globalThis`의 속성이 되지 않습니다.  
Node.js의 CommonJS 모듈과 ES 모듈의 최상위 선언은 전역 스코프가 아니라 각각의 모듈 스코프에 속합니다.  
여러 곳에서 공유해야 하는 값이라도 가능한 한 모듈로 내보내고 가져오는 방식을 사용하여 접근 범위를 명확하게 관리하는 것이 좋습니다.  

```javascript
// 이 예제 파일의 최상위 스코프에 두 바인딩을 선언합니다.
// 스크립트인지 모듈인지에 따라 이 최상위 스코프의 성격은 달라집니다.
const API_URL = "https://api.example.com";
let applicationStatus = "Ready";

function fetchData() {
  // 내부 스코프에서는 바깥 스코프의 API_URL에 접근할 수 있습니다.
  console.log(`Fetching data from: ${API_URL}`);
}

fetchData(); // 출력: Fetching data from: https://api.example.com
console.log(`Current Status: ${applicationStatus}`); // 출력: Current Status: Ready
```

## 5. 호이스팅과 TDZ {#session-05}

JavaScript는 코드를 한 줄씩 실행하기 전에 **현재 스코프에 어떤 선언이 있는지 먼저 확인하고 바인딩을 준비**합니다.  
이 때문에 선언문보다 앞에서도 해당 이름이 이미 존재하는 것처럼 보이는데, 이를 호이스팅(Hoisting)이라고 합니다.  
코드가 실제로 위로 이동하는 것은 아니며, 선언 종류에 따라 초기화 시점과 선언 전 접근 결과가 달라집니다.  

### 🟦 함수 선언 호이스팅

함수 선언문은 **코드 실행 전에 함수 객체까지 준비**됩니다.  
따라서 함수 선언문이 작성된 위치보다 앞에서도 해당 함수를 호출할 수 있습니다.  
반면 함수 표현식은 먼저 변수를 선언한 뒤 함수 값을 할당하는 방식이므로, 함수를 담은 변수가 `var`, `let`, `const` 중 무엇으로 선언되었는지에 따라 선언 전 접근 결과가 달라집니다.  

### 🟦 변수 선언 호이스팅

`var` 바인딩은 스코프가 준비될 때 **먼저 생성되고 `undefined`로 초기화**됩니다.  
따라서 실제 선언문보다 앞에서 읽어도 오류가 발생하지 않고 `undefined`가 반환됩니다.  
`let`과 `const` 바인딩도 미리 생성되지만 **선언문에 도달하여 초기화되기 전에는 접근할 수 없습니다**.  
스코프가 시작된 지점부터 선언문에서 초기화되기 전까지의 구간을 일시적 사각지대(Temporal Dead Zone, TDZ)라고 합니다.  
TDZ에서 `let`이나 `const` 변수에 접근하면 `ReferenceError`가 발생합니다.  

```javascript
// 1. 함수 선언문은 선언 위치보다 앞에서 호출할 수 있습니다.
hello(); // 출력: Hello from function declaration!

function hello() {
  console.log("Hello from function declaration!");
}

// 2. var 바인딩은 선언문 실행 전에 undefined로 초기화됩니다.
console.log(varVariable); // 출력: undefined
var varVariable = "I am var";

// 3. let 바인딩은 초기화 전까지 TDZ에 있으므로 접근하면 ReferenceError가 발생합니다.
// console.log(letVariable); // ❌ ReferenceError

let letVariable = "I am let";
console.log(letVariable); // 출력: I am let

// 4. const로 선언한 함수 표현식도 초기화 전에는 호출할 수 없습니다.
// bye();
const bye = function () {
  console.log("Goodbye!");
};

bye(); // 출력: Goodbye!
```

## 6. 주요 연산자 {#session-06}

JavaScript 연산자는 값을 계산하고 비교하거나 조건에 따라 사용할 값을 선택합니다.  
특히 동등 비교, 옵셔널 체이닝, 널 병합, 논리 할당 연산자는 **값의 타입과 평가를 멈추는 조건**을 이해해야 정확하게 사용할 수 있습니다.  

### 🟦 엄격한 동등 비교

`==`는 **두 값의 타입이 다르면 정해진 규칙에 따라 타입을 변환한 뒤 비교**합니다.  
이 때문에 `0 == false`나 `"5" == 5`처럼 타입이 다른 값도 `true`가 될 수 있습니다.  
`===`는 타입을 변환하지 않으며 **타입이 같고 값도 같을 때만 `true`를 반환**합니다.  
의도하지 않은 타입 변환을 피하고 비교 결과를 예측하기 쉽게 만들려면 일반적으로 `===`를 사용합니다.  

| 연산자 | 설명 | 동작 | 권장 여부 |
| --- | --- | --- | --- |
| `==` | 느슨한 동등 | 타입 변환 후 비교할 수 있음 | 사용 지양 |
| `===` | 엄격한 동등 | 타입이 같을 때 값을 비교함 | 일반적으로 권장 |

```javascript
// 1. ==는 추상 동등 비교 규칙에 따라 타입을 변환할 수 있습니다.
console.log(0 == false); // 출력: true
console.log("5" == 5); // 출력: true
console.log(null == undefined); // 출력: true

// 2. ===는 타입을 변환하지 않으므로 타입이 다르면 false입니다.
console.log(0 === false); // 출력: false
console.log("5" === 5); // 출력: false
console.log(null === undefined); // 출력: false
```

### 🟦 옵셔널 체이닝(`?.`)

옵셔널 체이닝 `?.`은 **속성 접근 경로를 따라가다가 `null` 또는 `undefined`를 만나면 즉시 평가를 멈추고 `undefined`를 반환**합니다.  
따라서 중첩된 속성의 존재 여부를 단계마다 `if` 문으로 확인하지 않고도 안전하게 접근할 수 있습니다.  
다만 객체가 존재하지만 속성 이름이 잘못된 경우도 `undefined`가 반환될 수 있으므로 오타까지 찾아주는 기능은 아닙니다.  

```javascript
const user = {
  id: 1,
  info: { name: "John" },
};

// profile이 undefined이므로 예외를 던지지 않고 undefined를 반환합니다.
const email = user.profile?.email;
console.log(email); // 출력: undefined

// 객체 자체가 null이어도 옵셔널 체이닝을 사용하면 안전하게 평가를 멈춥니다.
const missingUser = null;
const name = missingUser?.info?.name;
console.log(name); // 출력: undefined
```

### 🟦 널 병합 연산자(`??`)

널 병합 연산자 `??`는 **왼쪽 값이 `null` 또는 `undefined`일 때만 오른쪽 값을 반환**합니다.  
왼쪽 값이 `0`, 빈 문자열, `false`라면 값이 존재한다고 판단하여 그대로 반환합니다.  
따라서 Falsy 값은 유지하면서 실제로 값이 없는 경우에만 기본값을 사용하고 싶을 때 적합합니다.  

```javascript
const count = 0;
const setting = null;
const emptyString = "";

// ||는 0을 Falsy로 평가하여 오른쪽 기본값을 반환합니다.
const orResult = count || 100;
console.log(`|| Result: ${orResult}`); // 출력: || Result: 100

// ??는 0을 유효한 값으로 유지합니다.
const nullishResult = count ?? 100;
console.log(`?? Result: ${nullishResult}`); // 출력: ?? Result: 0

// null은 Nullish 값이므로 오른쪽 기본값을 반환합니다.
const finalSetting = setting ?? "default-value";
console.log(finalSetting); // 출력: default-value

// 빈 문자열은 Nullish 값이 아니므로 그대로 반환합니다.
const finalString = emptyString ?? "not-empty";
console.log(finalString); // 출력: 빈 문자열
```

### 🟦 논리 할당 연산자(`||=`, `&&=`, `??=`)

논리 할당 연산자는 **왼쪽 값을 먼저 확인하고 조건을 만족할 때만 오른쪽 값을 계산하여 할당**합니다.  
왼쪽 표현식은 한 번만 평가되므로 객체의 속성 접근이나 함수 호출이 불필요하게 반복되지 않습니다.  

- `||=`는 **왼쪽 값이 Falsy일 때만** 오른쪽 값을 할당합니다.  
- `&&=`는 **왼쪽 값이 Truthy일 때만** 오른쪽 값을 할당합니다.  
- `??=`는 **왼쪽 값이 `null` 또는 `undefined`일 때만** 오른쪽 값을 할당합니다.  

```javascript
const user = {
  theme: "",
  isLoggedIn: true,
};

// theme이 빈 문자열로 Falsy이므로 "light"를 할당합니다.
user.theme ||= "light";
console.log(user.theme); // 출력: light

function checkPermissions(currentUser) {
  // 예제에서는 로그인 여부를 권한 확인 결과로 사용합니다.
  return currentUser.isLoggedIn;
}

// isLoggedIn이 true이므로 함수를 호출하고 그 결과를 다시 할당합니다.
user.isLoggedIn &&= checkPermissions(user);
console.log(user.isLoggedIn); // 출력: true

const settings = {
  timeout: undefined,
};

// timeout이 undefined이므로 기본 제한 시간을 할당합니다.
settings.timeout ??= 3000;
console.log(settings.timeout); // 출력: 3000
```

세 연산자는 **어떤 값을 비어 있는 값으로 판단하는지**가 다릅니다.  
다음 예제에서는 `0`, `null`, `true`, `false`가 각 논리 할당 연산자에서 어떻게 처리되는지 비교합니다.  

```javascript
const config = {
  timeout: 0, // Falsy이지만 Nullish 값은 아닙니다.
  user: null, // Falsy이면서 Nullish 값입니다.
  isAdmin: true, // Truthy 값입니다.
};

// 1. ||=는 Falsy 값에 오른쪽 값을 할당합니다.
config.timeout ||= 5000;
console.log(`Timeout: ${config.timeout}`); // 출력: Timeout: 5000

config.user ||= "Guest";
console.log(`User: ${config.user}`); // 출력: User: Guest

config.isAdmin ||= false;
console.log(`IsAdmin: ${config.isAdmin}`); // 출력: IsAdmin: true

const serverSettings = {
  retryCount: undefined, // Nullish 값입니다.
  port: 0, // Falsy이지만 Nullish 값은 아닙니다.
};

// 2. ??=는 Nullish 값에만 오른쪽 값을 할당합니다.
serverSettings.retryCount ??= 3;
console.log(`RetryCount: ${serverSettings.retryCount}`); // 출력: RetryCount: 3

serverSettings.port ??= 8080;
console.log(`Port: ${serverSettings.port}`); // 출력: Port: 0

const permissions = {
  canEdit: true, // Truthy 값입니다.
  canDelete: false, // Falsy 값입니다.
};

// 3. &&=는 Truthy 값에만 오른쪽 값을 할당합니다.
permissions.canEdit &&= "ENABLED";
console.log(`CanEdit: ${permissions.canEdit}`); // 출력: CanEdit: ENABLED

permissions.canDelete &&= "ENABLED";
console.log(`CanDelete: ${permissions.canDelete}`); // 출력: CanDelete: false
```

## 7. 템플릿 리터럴 {#session-07}

템플릿 리터럴(Template Literal)은 **백틱(`` ` ``)으로 문자열을 작성하는 문법**입니다.  
`${expression}`을 만나면 중괄호 안의 표현식을 먼저 계산하고, 그 결과를 문자열로 변환하여 해당 위치에 삽입합니다.  
백틱 안에서 줄을 바꾸면 그 줄 바꿈도 문자열에 그대로 포함되므로 `\n`을 직접 작성하지 않고 여러 줄 문자열을 만들 수 있습니다.  

```javascript
const user = "Tom";
const age = 25;

// 1. ${...} 안의 표현식을 평가하여 문자열에 삽입합니다.
const greeting = `안녕하세요, 저는 ${user}입니다. 저는 내년에 ${age + 1}살이 됩니다.`;
console.log(greeting);
// 출력: 안녕하세요, 저는 Tom입니다. 저는 내년에 26살이 됩니다.

// 2. 백틱 안의 실제 줄 바꿈을 문자열에 그대로 포함합니다.
const multiLine = `
이것은
템플릿 리터럴을 사용한
여러 줄 문자열입니다.
`;

console.log(multiLine);
/* 출력:
이것은
템플릿 리터럴을 사용한
여러 줄 문자열입니다.
*/
```
