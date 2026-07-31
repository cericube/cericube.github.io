---
layout: post
title: "11. JavaScript 핵심 연산자 정리"
description: "JavaScript의 비교, 논리, 기본값 처리, 선택적 체이닝, 타입 판별, 구조 분해와 Rest·Spread 문법을 예제로 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "11"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 비교 연산의 기초: == vs === / Object.is"
  - id: session-02
    title: "2. Truthy / Falsy와 단축 평가: || vs &&"
  - id: session-03
    title: "3. 기본값 처리와 안전한 대체 전략: Nullish(??)"
  - id: session-04
    title: "4. 안전한 접근과 조건부 실행: Optional Chaining(?.)"
  - id: session-05
    title: "5. 타입·인스턴스·구조 판별 전략: typeof, instanceof, isArray, hasOwn"
  - id: session-06
    title: "6. 데이터 구조 연산자 전략: 구조분해, Rest, Spread"
  - id: session-07
    title: "7. 요약정리"
---

## 1. 비교 연산의 기초: == vs === / Object.is {#session-01}

### 🟦 기본 비교: Equality(`==`) vs Strict Equality(`===`)

`==`는 두 값의 타입이 다르면 JavaScript가 암묵적으로 타입을 변환한 뒤 비교합니다.  
`===`는 타입을 변환하지 않으며, 타입과 값이 모두 같아야 `true`를 반환합니다.  
암묵적 타입 변환을 명확히 의도한 경우가 아니라면 일반적으로 `===` 사용을 권장합니다.  

```javascript
const a = 10;
const b = "10";

console.log("--- Equality ---");
console.log(a == b); // true (문자열 "10"이 숫자 10으로 변환됩니다.)

console.log("--- Strict Equality ---");
console.log(a === b); // false (숫자와 문자열로 타입이 다릅니다.)

// 특이한 사례를 확인합니다.
console.log(null == undefined); // true
console.log(null === undefined); // false
```

### 🟦 숫자 비교의 예외: `NaN`, `+0`, `-0`

수학적으로는 낯설 수 있지만, JavaScript의 숫자 비교에는 IEEE 754 표준과 명세에 따른 특이한 사례가 있습니다.  
`NaN !== NaN`은 명세에 정의된 정상 동작이며, `===`는 `+0`과 `-0`을 같은 값으로 취급합니다.  

```javascript
// 1. NaN은 자기 자신과도 같지 않습니다.
const result = "apple" / 10; // NaN
console.log(result === NaN); // false

// 2. +0과 -0을 비교합니다.
console.log(+0 === -0); // true
```

### 🟦 더 정교한 비교: `Object.is()`

ES2015에서 도입된 `Object.is()`는 SameValue 알고리즘으로 두 값이 같은지 판단합니다.  
대부분의 비교 결과는 `===`와 같지만, `NaN`과 부호가 다른 0을 비교할 때 결과가 다릅니다.  

| 구분 | `===` | `Object.is()` |
| --- | --- | --- |
| `NaN` vs `NaN` | `false` | `true` |
| `+0` vs `-0` | `true` | `false` |

```javascript
// NaN과 부호가 다른 0을 Object.is()로 비교합니다.
console.log(Object.is(NaN, NaN)); // true
console.log(Object.is(+0, -0)); // false
```

`===`는 `NaN`을 자기 자신과도 같지 않은 값으로 판단하지만, `Object.is()`는 두 `NaN`을 같은 값으로 판단합니다.  
`===`는 부호가 다른 0을 같은 값으로 처리하지만, `Object.is()`는 부호까지 구분합니다.  

### 🟦 실무 응용: 메서드마다 다른 비교 방식

사용하는 메서드에 따라 내부 비교 알고리즘이 다르다는 점을 기억해야 합니다.  

```javascript
const box = [1, 5, NaN];

// indexOf()는 Strict Equality 방식으로 비교하므로 NaN을 찾지 못합니다.
console.log(box.indexOf(NaN)); // -1

// includes()는 SameValueZero 방식으로 비교하므로 NaN을 찾습니다.
console.log(box.includes(NaN)); // true
```

## 2. Truthy / Falsy와 단축 평가: || vs && {#session-02}

JavaScript의 조건문과 논리 연산자는 값을 내부적으로 불리언으로 변환하여 판단합니다.  
다만 논리 연산자는 판단 결과를 불리언으로 바꾸어 반환하지 않고, 실제로 평가한 피연산자 중 하나를 반환합니다.  

### 🟦 알아 두어야 할 8가지 Falsy 값

JavaScript에서 주로 다루는 Falsy 값은 다음 8가지이며, 이외의 값은 대부분 Truthy로 판단합니다.  

```javascript
// 주요 Falsy 값 8가지를 확인합니다.
if (!false) console.log("1. false는 Falsy입니다.");
if (!0) console.log("2. 숫자 0은 Falsy입니다.");
if (!-0) console.log("3. 음수 0도 Falsy입니다.");
if (!0n) console.log("4. BigInt 0도 Falsy입니다.");
if (!"") console.log("5. 빈 문자열은 Falsy입니다.");
if (!null) console.log("6. null은 Falsy입니다.");
if (!undefined) console.log("7. undefined는 Falsy입니다.");
if (!NaN) console.log("8. NaN은 Falsy입니다.");
```

비어 있는 것처럼 보여도 JavaScript가 Truthy로 판단하는 값이 있으므로 주의해야 합니다.  

```javascript
console.log(Boolean(" ")); // true (공백이 있는 문자열)
console.log(Boolean("0")); // true (문자열 "0")
console.log(Boolean([])); // true (빈 배열)
console.log(Boolean({})); // true (빈 객체)

// 배열이 비었는지는 length로 확인합니다.
const items = [];
if (items) {
  // items가 빈 배열이어도 이 블록은 실행됩니다.
}
if (items.length > 0) {
  // 배열에 요소가 있을 때만 이 블록이 실행됩니다.
}
```

### 🟦 단축 평가 이해하기: `||`, `&&`

`||`와 `&&`는 불리언을 만드는 연산자가 아니라 피연산자 중 하나를 선택하여 반환하는 연산자입니다.  

#### 🔷 OR 연산자(`||`): 첫 번째 Truthy 찾기

왼쪽부터 검사하다가 처음 만나는 Truthy 값을 즉시 반환하며, 모든 값이 Falsy이면 마지막 값을 반환합니다.  

```javascript
// 기본값을 설정합니다.
function greet(name) {
  // name이 없거나 빈 문자열이면 "익명"을 사용합니다.
  const userName = name || "익명";
  console.log(`안녕하세요, ${userName}님!`);
}

greet("철수"); // "안녕하세요, 철수님!"
greet(""); // "안녕하세요, 익명님!" (빈 문자열은 Falsy입니다.)
```

#### 🔷 AND 연산자(`&&`): 첫 번째 Falsy 찾기

왼쪽부터 검사하다가 처음 만나는 Falsy 값을 즉시 반환하며, 모든 값이 Truthy이면 마지막 값을 반환합니다.  

```javascript
// 조건에 맞을 때만 속성에 접근합니다.
const user = {
  profile: { name: "민수" },
};

// user와 user.profile이 있을 때만 이름을 가져옵니다.
const name = user && user.profile && user.profile.name;
console.log(name); // "민수"

const guest = null;
const guestName = guest && guest.name; // guest가 null이므로 평가를 멈춥니다.
console.log(guestName); // null
```

### 🟦 `||` 연산자의 함정

`||`는 `0`이나 빈 문자열도 Falsy로 취급하므로 사용자가 입력한 유효한 값을 기본값으로 덮을 수 있습니다.  

```javascript
const fontSize = 0;
const displaySize = fontSize || 16;
console.log(displaySize); // 16 (0을 사용하려 했지만 16이 선택됩니다.)

// 해결: null 병합 연산자 ??를 사용합니다. (ES2020)
// null이나 undefined일 때만 오른쪽 값을 선택합니다.
const correctSize = fontSize ?? 16;
console.log(correctSize); // 0
```

### 🟦 명시적 불리언 변환: Double Bang(`!!`)

값의 존재 여부를 명시적인 `true` 또는 `false` 값으로 변환하여 전달할 때 사용합니다.  

```javascript
const uploadFile = (file) => {
  // file이 Truthy이면 true, Falsy이면 false로 변환합니다.
  const hasFile = !!file;
  console.log("파일 업로드 여부:", hasFile);
};

uploadFile(null); // false
uploadFile({ name: "a.jpg" }); // true
```

## 3. 기본값 처리와 안전한 대체 전략: Nullish(??) {#session-03}

`||`는 값이 Falsy이면 기본값으로 대체하려 할 때 사용합니다.  
`??`는 값이 실제로 할당되지 않은 `null` 또는 `undefined`일 때만 기본값을 사용하고, 그 외에는 입력된 값을 유지하려 할 때 사용합니다.  

### 🟦 `||` 연산자의 함정: Falsy의 역설

JavaScript에서 `||`는 왼쪽 값이 Falsy이면 오른쪽 값을 반환합니다.  
그러나 실제 코드에서는 값이 없는 상태와 값이 `0` 또는 `false`인 상태를 구분해야 할 때가 많습니다.  

```javascript
// || 연산자의 문제점을 확인합니다.
function configureSetting(userValue) {
  const setting = userValue || "default";
  return setting;
}

console.log(configureSetting("custom")); // "custom"
console.log(configureSetting(undefined)); // "default"
console.log(configureSetting(null)); // "default"

// 아래 값이 유효한 입력이라면 의도와 다른 결과가 됩니다.
console.log(configureSetting(0)); // "default"
console.log(configureSetting(false)); // "default"
console.log(configureSetting("")); // "default"
```

### 🟦 `??`: 실제로 비어 있는 값만 찾기

`??` 연산자는 왼쪽 값이 Nullish 값인 `null` 또는 `undefined`일 때만 오른쪽 기본값을 선택합니다.  
그 외의 값은 `0`이나 `false`이더라도 유효한 데이터로 인정하고 그대로 반환합니다.  

```javascript
// null과 undefined일 때만 기본값을 선택합니다.
console.log(null ?? "default"); // "default"
console.log(undefined ?? "default"); // "default"

// 다른 Falsy 값은 그대로 유지합니다.
console.log(0 ?? "default"); // 0
console.log(false ?? "default"); // false
console.log("" ?? "default"); // ""
console.log(NaN ?? "default"); // NaN

// || 연산자와 비교합니다.
console.log(0 || "default"); // "default"
console.log(0 ?? "default"); // 0

console.log(false || "default"); // "default"
console.log(false ?? "default"); // false

console.log("" || "default"); // "default"
console.log("" ?? "default"); // ""
```

## 4. 안전한 접근과 조건부 실행: Optional Chaining(?.) {#session-04}

선택적 체이닝 앞의 값이 `null` 또는 `undefined`이면 뒤쪽 표현식을 평가하지 않고 즉시 `undefined`를 반환합니다.  

반드시 있어야 하는 값에는 선택적 체이닝을 사용하지 않는 편이 좋습니다.  
예를 들어 `user.id`가 반드시 존재해야 하는데 `user?.id`로 작성하면, `id`가 없는 오류 상황에서도 `undefined`만 반환되어 문제를 찾기 어려울 수 있습니다.  

### 🟦 예시 1: API 응답 데이터 처리

서버에서 데이터를 받아올 때 특정 필드가 누락되더라도 프로그램이 멈추지 않도록 처리하는 예시입니다.  

```javascript
// 서버에서 받은 데이터 중 일부 정보가 누락된 상태입니다.
const apiResult = {
  status: 200,
  payload: {
    user: {
      profile: {
        nickname: "코딩왕",
        // SNS 정보는 아직 설정하지 않았습니다.
      },
    },
  },
};

// SNS의 인스타그램 아이디가 없으면 기본 문구를 출력합니다.
const instaId =
  apiResult?.payload?.user?.profile?.sns?.instagram ?? "아이디 없음";
console.log(instaId); // "아이디 없음"
```

### 🟦 예시 2: 설정 객체와 함수 실행

사용자가 설정값을 일부만 전달했을 때 기본값을 적용하고 콜백 함수를 안전하게 호출하는 패턴입니다.  

```javascript
function initializeApp(config) {
  // 테마가 없으면 "light"를 사용합니다.
  const theme = config?.settings?.theme ?? "light";

  // onSuccess가 함수로 전달된 경우에만 호출합니다.
  config?.onSuccess?.();

  console.log(`App initialized with ${theme} mode.`);
}

initializeApp({ settings: { theme: "dark" } }); // onSuccess가 없어도 실행됩니다.
initializeApp(); // config가 전달되지 않아도 실행됩니다.
```

### 🟦 예시 3: 동적 목록과 검색 결과 처리

선택적 요소 접근을 사용하면 배열 자체가 `null` 또는 `undefined`인 경우에도 안전하게 특정 요소에 접근할 수 있습니다.  

```javascript
const searchResult = {
  items: null, // 검색 결과가 아직 로딩 중이거나 없는 경우입니다.
  totalCount: 0,
};

// 첫 번째 검색 결과가 없으면 기본 문구를 사용합니다.
const firstTitle =
  searchResult?.items?.[0]?.title ?? "검색 결과가 없습니다";
console.log(firstTitle); // "검색 결과가 없습니다"
```

## 5. 타입·인스턴스·구조 판별 전략: typeof, instanceof, isArray, hasOwn {#session-05}

### 🟦 원시 타입 판별에는 `typeof`

`typeof`는 원시 타입과 함수의 타입을 간단히 확인할 수 있으며, 선언되지 않은 식별자에 직접 사용해도 오류가 발생하지 않습니다.  

```javascript
// 원시 타입과 함수의 타입을 확인합니다.
console.log(typeof "Hello" === "string"); // true
console.log(typeof 123 === "number"); // true
console.log(typeof true === "boolean"); // true
console.log(typeof undefined === "undefined"); // true
console.log(typeof function () {} === "function"); // true

// null과 객체를 판별할 때 주의합니다.
console.log(typeof null === "object"); // true (JavaScript의 오래된 언어 특성입니다.)
console.log(typeof {} === "object"); // true
console.log(typeof [] === "object"); // true (배열도 객체입니다.)

// null은 직접 비교합니다.
const value = null;
if (value === null) {
  console.log("value는 null입니다.");
}
```

### 🟦 배열 판별의 표준: `Array.isArray()`

배열도 객체이므로 `typeof`만으로는 일반 객체와 배열을 구분할 수 없습니다.  

```javascript
const list = [1, 2, 3];

// 일반 객체와 구분할 수 없습니다.
console.log(typeof list === "object"); // true

// 배열인지 정확히 확인합니다.
console.log(Array.isArray(list)); // true
```

### 🟦 클래스 인스턴스와 오류 판별에는 `instanceof`

객체의 프로토타입 체인에 특정 생성자의 `prototype`이 있는지 확인할 때 사용합니다.  

```javascript
// 1. 사용자 정의 클래스의 인스턴스인지 확인합니다.
class User {}
const kim = new User();
console.log(kim instanceof User); // true

// 2. 오류의 종류를 확인합니다.
try {
  throw new TypeError("타입 에러 발생!");
} catch (error) {
  if (error instanceof TypeError) {
    console.error("타입 관련 에러입니다.");
  } else if (error instanceof Error) {
    console.error("일반적인 에러입니다.");
  }
}
```

### 🟦 프로퍼티 존재 여부 확인: `in` vs `Object.hasOwn()`

객체에 특정 키가 있는지 확인할 때 사용합니다.  

```javascript
const person = { name: "Alice" };

// in은 상속받은 프로퍼티까지 확인합니다.
console.log("name" in person); // true
console.log("toString" in person); // true

// Object.hasOwn()은 객체가 직접 소유한 프로퍼티만 확인합니다.
console.log(Object.hasOwn(person, "name")); // true
console.log(Object.hasOwn(person, "toString")); // false
```

## 6. 데이터 구조 연산자 전략: 구조분해, Rest, Spread {#session-06}

### 🟦 객체 구조 분해 할당

객체의 키에 대응하는 값을 변수로 추출할 수 있으며, 키 이름과 다른 변수명을 사용할 수도 있습니다.  

```javascript
const user = { id: 1, name: "Alice", email: "alice@example.com" };

// 기본 추출과 기본값 적용을 확인합니다.
const { name, email, sns = "None" } = user;
// 객체에 sns가 없으므로 기본값 "None"이 적용됩니다.

const { name: userName } = user; // userName이라는 변수에 값을 할당합니다.
console.log(userName); // "Alice"

// 기본값은 값이 undefined일 때만 적용됩니다.
const profile = { score: null, point: undefined };
const { score = 100, point = 50 } = profile;

console.log(score); // null
console.log(point); // 50
```

### 🟦 함수 인자에 활용하기

객체 구조 분해를 함수 매개변수에 사용하면 인자의 순서에 의존하지 않고 필요한 값을 명시할 수 있습니다.  

```javascript
// 필요한 속성을 매개변수에서 바로 추출합니다.
function displayUser({ name, email, age = "Unknown" }) {
  console.log(`${name}(${age})님, 이메일: ${email}`);
}

const userObj = { id: 7, name: "Sora", email: "sora@test.com" };
displayUser(userObj); // "Sora(Unknown)님, 이메일: sora@test.com"
```

### 🟦 배열 구조 분해 할당

배열은 키가 없으므로 인덱스 순서에 따라 값이 할당됩니다.  

```javascript
const ranking = ["Gold", "Silver", "Bronze", "Iron"];

// 순서대로 추출하고 나머지는 무시합니다.
const [first, second] = ranking;
console.log(first); // "Gold"

// 쉼표를 사용하여 특정 요소를 건너뜁니다.
const [top, , third] = ranking;
console.log(top, third); // "Gold", "Bronze"

// 두 변수의 값을 맞바꿉니다.
let a = "Coffee";
let b = "Tea";
[a, b] = [b, a];
console.log(a); // "Tea"
```

### 🟦 Rest 문법(`...rest`)

구조 분해 후 남은 요소를 하나의 배열 또는 객체로 모으며, 구조 분해 패턴의 마지막에 위치해야 합니다.  

```javascript
// 객체에서 남은 프로퍼티를 모읍니다.
const settings = {
  theme: "dark",
  fontSize: 16,
  language: "ko",
  alert: true,
};
const { theme, ...others } = settings;
console.log(others); // { fontSize: 16, language: "ko", alert: true }

// 전달된 모든 인자를 배열로 모읍니다.
function sum(...numbers) {
  return numbers.reduce((accumulator, current) => accumulator + current, 0);
}
console.log(sum(1, 2, 3, 4, 5)); // 15
```

### 🟦 Spread 문법(`...spread`)

기존 요소를 펼쳐 새로운 배열이나 객체를 만들고 복사하거나 확장할 때 사용합니다.  

```javascript
// 배열을 합치고 요소를 추가합니다.
const fastFood = ["Burger", "Fries"];
const fullMenu = [...fastFood, "Soda", "Coke"];
console.log(fullMenu); // ["Burger", "Fries", "Soda", "Coke"]

// 원본을 변경하지 않고 객체의 속성을 갱신합니다.
const originalUser = { id: 1, name: "Gemini" };
const updatedUser = { ...originalUser, name: "Advanced Gemini" };
console.log(updatedUser);

// Spread는 얕은 복사를 수행합니다.
const group = { title: "Team A", members: ["Kim", "Lee"] };
const groupCopy = { ...group };

// 중첩 배열은 원본과 복사본이 같은 참조를 공유합니다.
groupCopy.members.push("Park");
console.log(group.members); // ["Kim", "Lee", "Park"]
```

## 7. 요약정리 {#session-07}

| 연산자/문법 | 특징/내부 동작 | 예시 |
| --- | --- | --- |
| `==` | 암묵적 타입 변환 후 비교 | `10 == "10"` → `true` |
| `===` | 타입 변환 없이 타입과 값을 비교 | `10 === "10"` → `false` |
| `Object.is()` | SameValue: `NaN`은 같고 `+0`, `-0`은 다르게 판정 | `Object.is(NaN, NaN)` → `true` |
| `Array.prototype.includes()` | SameValueZero: `NaN` 비교 가능, `+0`, `-0`은 같게 판정 | `[NaN].includes(NaN)` → `true` |
| `\|\|` | 첫 번째 Truthy를 반환하며 모두 Falsy이면 마지막 값을 반환 | `"" \|\| "default"` → `"default"` |
| `&&` | 첫 번째 Falsy를 반환하며 모두 Truthy이면 마지막 값을 반환 | `null && "A"` → `null` |
| `??` | 왼쪽이 `null` 또는 `undefined`일 때 기본값 선택 | `0 ?? 10` → `0` |
| `\|\|=` | 왼쪽이 Falsy일 때만 오른쪽 값을 대입 | `a \|\|= 10` |
| `&&=` | 왼쪽이 Truthy일 때만 오른쪽 값을 대입 | `a &&= 10` |
| `??=` | 왼쪽이 `null` 또는 `undefined`일 때 오른쪽 값을 대입 | `a ??= 10` |
| `?.` | 왼쪽이 `null` 또는 `undefined`이면 접근·호출을 중단하고 `undefined` 반환 | `obj?.prop`, `obj?.method()` |
| `!!` | 값을 불리언 타입으로 명시적 변환 | `!!"x"` → `true` |
| `typeof` | 타입을 나타내는 문자열 반환 | `typeof null` → `"object"` |
| `instanceof` | 프로토타입 체인에 생성자의 `prototype`이 있는지 확인 | `error instanceof Error` |
| `Array.isArray()` | 값이 배열인지 판별 | `Array.isArray([])` → `true` |
| `Object.hasOwn(obj, key)` | 상속 프로퍼티를 제외하고 직접 소유한 프로퍼티만 확인 | `Object.hasOwn(obj, "key")` |
| 객체 구조 분해 `{}` | 키를 기준으로 값을 추출하고 `undefined`일 때만 기본값 적용 | `const { a = 1 } = { a: null }` |
| 배열 구조 분해 `[]` | 인덱스 순서에 따라 값 추출 | `const [a, b] = [1, 2]` |
| Rest(`...rest`) | 구조 분해 후 남은 요소 수집 | `const [a, ...rest] = [1, 2, 3]` |
| Spread(`...spread`) | 기존 요소를 펼쳐 얕게 복사 | `const newObj = { ...oldObj }` |
