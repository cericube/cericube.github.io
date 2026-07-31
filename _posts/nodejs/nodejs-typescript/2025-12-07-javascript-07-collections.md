---
layout: post
title: "07. JavaScript 컬렉션 이해하기: 배열, Map과 Set"
description: "JavaScript 배열의 주요 메서드와 Map, Set, groupBy, WeakMap과 WeakSet의 특징을 예제로 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "07"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 배열 핵심 패턴: map, filter, reduce, flatMap, some, every"
  - id: session-02
    title: "2. 배열 검색 기능: find, findIndex, findLast, findLastIndex"
  - id: session-03
    title: "3. Map과 Set 기본 컬렉션"
  - id: session-04
    title: "4. Map과 Set 확장 기능"
  - id: session-05
    title: "5. WeakMap과 WeakSet"
---

## 1. 배열 핵심 패턴: map, filter, reduce, flatMap, some, every {#session-01}

JavaScript에서 배열을 다루는 강력한 도구 중 하나는 고차 함수(Higher-Order Function)입니다.  
이 절에서 다루는 배열 메서드는 원본 배열을 직접 수정하지 않고 새로운 배열이나 계산 결과를 반환하므로 코드의 흐름을 예측하기 쉽습니다.  
또한 `for` 문보다 처리 의도를 선언적으로 표현할 수 있어 실무에서도 자주 사용합니다.  

아래에서는 각 메서드를 언제, 왜, 어떻게 사용하는지 예제와 함께 살펴봅니다.  

### 🟦 1) map: 배열을 다른 형태로 변환할 때

`map()`은 배열의 각 요소를 하나씩 변환하여 원본과 길이가 같은 새로운 배열을 만듭니다.  
데이터 형식 변경, 새로운 속성 추가와 원하는 필드 추출 등에 널리 활용됩니다.  

```javascript
const products = [
  { id: 101, name: "Laptop", price: 1200 },
  { id: 102, name: "Mouse", price: 25 },
];

// 기존 상품 정보는 유지하면서 세금이 포함된 가격을 추가합니다.
const productsWithTax = products.map((product) => ({
  ...product,
  finalPrice: Math.round(product.price * 1.1),
}));

// 결과:
// [
//   { id: 101, name: "Laptop", price: 1200, finalPrice: 1320 },
//   { id: 102, name: "Mouse", price: 25, finalPrice: 28 },
// ]
```

### 🟦 2) filter: 배열에서 필요한 요소만 골라낼 때

`filter()`는 조건을 만족하는 요소만 남긴 새로운 배열을 반환합니다.  
특정 상태의 데이터만 남기거나 조건에 맞지 않는 데이터를 제외할 때 유용합니다.  

```javascript
const userList = [
  { name: "Alice", status: "active", role: "admin" },
  { name: "Bob", status: "inactive", role: "user" },
  { name: "Charlie", status: "active", role: "user" },
];

// 활성 상태이면서 역할이 user인 사용자만 추출합니다.
const activeUsers = userList.filter(
  (user) => user.status === "active" && user.role === "user",
);

// 결과:
// [{ name: "Charlie", status: "active", role: "user" }]
```

### 🟦 3) reduce: 여러 값을 하나의 결과로 누적하거나 요약할 때

`reduce()`는 배열 전체를 순회하며 값을 누적하여 하나의 결과를 만듭니다.  
총계 계산, 통계 요약과 배열을 객체로 변환하는 작업 등에 활용할 수 있습니다.  

#### 🔷 숫자 누적

```javascript
const items = [
  { item: "A", count: 3 },
  { item: "B", count: 5 },
  { item: "C", count: 1 },
];

// 초기값 0부터 각 항목의 count를 차례로 더합니다.
const totalCount = items.reduce((accumulator, current) => {
  return accumulator + current.count;
}, 0);

console.log(totalCount); // 9
```

#### 🔷 배열을 객체 형태로 변환하기

```javascript
// item을 속성 이름으로, count를 속성값으로 저장합니다.
const itemsMap = items.reduce((accumulator, current) => {
  accumulator[current.item] = current.count;
  return accumulator;
}, {});

console.log(itemsMap); // { A: 3, B: 5, C: 1 }
```

### 🟦 4) flatMap: 배열을 변환한 후 한 단계 평탄화할 때

`flatMap()`은 `map()`을 적용한 결과에 `flat(1)`을 적용한 것과 같은 방식으로 동작합니다.  

> 한 단계 평탄화는 배열의 깊이를 한 단계만 줄이는 것이며, 결과가 항상 완전한 일차원 배열이 되는 것은 아닙니다.  

```text
중첩 배열
[A, [B, C], [D, [E]]]

한 단계 평탄화
[A, B, C, D, [E]]
```

각 요소에 포함된 배열을 변환과 동시에 하나의 배열로 합쳐야 할 때 유용합니다.  

```javascript
const departments = [
  { name: "Sales", employees: ["Sam", "Tom"] },
  { name: "Tech", employees: ["Mike", "Lisa", "Jenny"] },
];

// 각 부서의 직원 배열을 꺼낸 뒤 한 단계 평탄화합니다.
const allEmployees = departments.flatMap(
  (department) => department.employees,
);

// 결과:
// ["Sam", "Tom", "Mike", "Lisa", "Jenny"]
```

### 🟦 5) some과 every: 배열 요소가 조건을 만족하는지 검사할 때

조건 검사는 실무에서 자주 등장하며 `some()`과 `every()`로 간결하게 표현할 수 있습니다.  

- `some()`은 하나 이상의 요소가 조건을 만족하면 `true`를 반환합니다.  
- `every()`는 모든 요소가 조건을 만족해야 `true`를 반환합니다.  
- 두 메서드 모두 결과가 결정되면 남은 요소를 검사하지 않습니다.  

```javascript
const formFields = [
  { name: "title", isValid: true },
  { name: "content", isValid: false },
  { name: "tags", isValid: true },
];

// 유효하지 않은 필드가 하나라도 있는지 확인합니다.
const hasInvalidField = formFields.some(
  (field) => field.isValid === false,
);

// 모든 필드가 유효한지 확인합니다.
const allFieldsValid = formFields.every(
  (field) => field.isValid === true,
);

console.log(hasInvalidField); // true
console.log(allFieldsValid); // false
```

## 2. 배열 검색 기능: find, findIndex, findLast, findLastIndex {#session-02}

이 메서드들은 배열에서 특정 조건을 만족하는 요소나 해당 요소의 인덱스를 찾을 때 사용합니다.  
조건을 만족하는 요소를 찾으면 탐색을 중단하므로 모든 결과를 모으는 `filter()`와 목적이 다릅니다.  

| 메서드 | 반환값 | 검색 방향 | 사용 예 |
| --- | --- | --- | --- |
| `find()` | 요소 또는 `undefined` | 앞에서 뒤 | 첫 번째 일치 요소를 찾습니다. |
| `findLast()` | 요소 또는 `undefined` | 뒤에서 앞 | 마지막 일치 요소를 찾습니다. |
| `findIndex()` | 인덱스 또는 `-1` | 앞에서 뒤 | 첫 번째 일치 위치를 찾습니다. |
| `findLastIndex()` | 인덱스 또는 `-1` | 뒤에서 앞 | 마지막 일치 위치를 찾습니다. |

ECMAScript 2023에서는 역방향으로 검색하는 `findLast()`와 `findLastIndex()`가 추가되었습니다.  

### 🟦 1) 요소 검색: find와 findLast

`find()`는 배열의 앞쪽부터 조건을 만족하는 첫 번째 요소를 반환합니다.  
`findLast()`는 배열의 뒤쪽부터 조건을 만족하는 첫 번째 요소를 반환합니다.  
특히 `findLast()`는 최신 기록이나 가장 마지막으로 조건을 만족한 값을 찾을 때 유용합니다.  

```javascript
const revisions = [
  { version: 1, author: "A", date: "2024-01-01" },
  { version: 2, author: "B", date: "2024-03-15" },
  { version: 3, author: "A", date: "2024-05-20" },
];

// 앞에서부터 작성자가 A인 첫 번째 기록을 찾습니다.
const firstRevisionByA = revisions.find(
  (revision) => revision.author === "A",
);

// 뒤에서부터 작성자가 A인 첫 번째 기록을 찾아 최신 기록을 얻습니다.
const lastRevisionByA = revisions.findLast(
  (revision) => revision.author === "A",
);

console.log(firstRevisionByA);
// { version: 1, author: "A", date: "2024-01-01" }

console.log(lastRevisionByA);
// { version: 3, author: "A", date: "2024-05-20" }
```

### 🟦 2) 인덱스 검색: findIndex와 findLastIndex

요소 자체가 아니라 해당 요소의 위치가 필요할 때 사용합니다.  
`findIndex()`는 앞에서부터 조건을 만족하는 첫 번째 인덱스를 반환합니다.  
`findLastIndex()`는 뒤에서부터 검색하여 마지막으로 조건을 만족하는 요소의 인덱스를 반환합니다.  
조건을 만족하는 요소가 없으면 두 메서드 모두 `-1`을 반환합니다.  

```javascript
const statusList = [
  "pending",
  "success",
  "error",
  "pending",
  "complete",
];

// error가 처음 등장하는 위치를 찾습니다.
const firstErrorIndex = statusList.findIndex(
  (status) => status === "error",
);

// pending이 마지막으로 등장하는 위치를 찾습니다.
const lastPendingIndex = statusList.findLastIndex(
  (status) => status === "pending",
);

console.log(firstErrorIndex); // 2
console.log(lastPendingIndex); // 3
```

## 3. Map과 Set 기본 컬렉션 {#session-03}

JavaScript에서 데이터를 관리할 때는 Object와 Array를 자주 사용하지만, 데이터의 성격에 따라 Map과 Set이 더 적합할 수 있습니다.  

- Object의 속성 키에는 문자열 또는 Symbol을 사용합니다.  
- Array에서 `includes()`로 값을 찾으면 앞에서부터 요소를 비교합니다.  
- Object도 속성 순서 규칙이 있지만, Map은 삽입 순서에 따른 반복을 목적으로 설계되었습니다.  
- Map과 Set은 추가, 삭제, 존재 여부 확인을 위한 전용 메서드를 제공합니다.  

### 🟦 1) Map: 유연한 키-값 저장소

Map은 Object처럼 키와 값을 저장하지만 키로 객체, 배열과 함수 등 모든 JavaScript 값을 사용할 수 있습니다.  
키를 삽입한 순서대로 반복할 수 있고 `size` 속성으로 항목 수를 바로 확인할 수 있습니다.  
캐시, 설정 테이블과 객체 간 매핑 등에 적합합니다.  

#### 🔷 Map의 주요 메서드

```javascript
const objectKey = { type: "objectKey" };
const arrayKey = ["arrayKey"];
const functionKey = function functionKey() {};

const map = new Map();

// 객체의 내용이 아니라 같은 객체 참조를 키로 사용합니다.
map.set(objectKey, { message: "Object key 사용 예시" });
map.set(arrayKey, { message: "Array key 사용 예시" });
map.set(functionKey, { message: "Function key 사용 예시" });

console.log(map.get(objectKey));
console.log(map.get(arrayKey));
console.log(map.get(functionKey));

console.log(map.has(arrayKey)); // true
console.log(map.has("notExist")); // false
console.log(`Map 크기: ${map.size}개`); // 3

map.delete(functionKey);
console.log(map.has(functionKey)); // false

for (const key of map.keys()) {
  console.log("key =", key);
}

for (const value of map.values()) {
  console.log("value =", value);
}

for (const [key, value] of map.entries()) {
  console.log("entry =", key, value);
}

map.forEach((value, key) => {
  console.log("key =", key, "value =", value);
});

// 전체 항목을 삭제해야 할 때 사용합니다.
// map.clear();
```

#### 🔷 Map을 활용한 캐시 패턴

```javascript
const cache = new Map();

function heavyCompute(number) {
  console.log("무거운 작업 실행");
  return number * number;
}

function getCachedValue(number) {
  if (cache.has(number)) {
    // 이미 계산한 값은 같은 작업을 반복하지 않고 반환합니다.
    return cache.get(number);
  }

  const result = heavyCompute(number);
  cache.set(number, result);
  return result;
}

console.log(getCachedValue(10)); // 무거운 작업 실행 후 100
console.log(getCachedValue(10)); // 캐시에서 100 반환
```

#### 🔷 배열을 Map으로 변환하여 조회하기

```javascript
const products = [
  { id: 101, name: "Laptop", price: 1200 },
  { id: 102, name: "Mouse", price: 25 },
];

// 상품 ID를 키로 사용하여 원하는 상품을 바로 조회할 수 있게 합니다.
const productMap = new Map(
  products.map((product) => [product.id, product]),
);

console.log(productMap.get(101));
console.log(productMap.get(102));
```

### 🟦 2) Set: 고유한 값만 저장하는 집합

Set은 중복을 허용하지 않는 집합 구조입니다.  
중복 제거와 포함 여부 확인처럼 값의 고유성이 중요한 작업에서 의도를 명확하게 표현할 수 있습니다.  

#### 🔷 배열의 중복 제거

```javascript
const tags = ["js", "html", "css", "js", "react", "css"];

// Set에서 중복이 제거된 값을 다시 배열로 펼칩니다.
const uniqueTags = [...new Set(tags)];

console.log(uniqueTags);
// ["js", "html", "css", "react"]
```

#### 🔷 포함 여부 확인

```javascript
const restrictedIPs = new Set([
  "192.168.1.1",
  "10.0.0.5",
  "172.16.0.10",
]);

const requestedIP = "10.0.0.5";

if (restrictedIPs.has(requestedIP)) {
  console.log(`${requestedIP} → 접근 제한 IP`);
} else {
  console.log(`${requestedIP} → 허용됨`);
}
```

#### 🔷 Set으로 목록 필터링하기

```javascript
const allowedRoles = new Set(["admin", "manager"]);

const users = [
  { name: "Alice", role: "admin" },
  { name: "Bob", role: "guest" },
  { name: "Charlie", role: "manager" },
];

// 허용된 역할의 사용자만 남깁니다.
const allowedUsers = users.filter((user) => {
  return allowedRoles.has(user.role);
});

console.log(allowedUsers);
// Alice, Charlie
```

#### 🔷 Set의 주요 메서드

```javascript
const set = new Set();

set.add(1);
set.add(2);
set.add(2); // 중복된 값은 추가되지 않습니다.
set.add(3);

console.log([...set]); // [1, 2, 3]
console.log(set.has(2)); // true
console.log(set.has(5)); // false
console.log(set.size); // 3

set.delete(2);
console.log(set.has(2)); // false

for (const value of set) {
  console.log("value =", value);
}

set.forEach((value) => {
  console.log("value =", value);
});

// 전체 값을 삭제해야 할 때 사용합니다.
// set.clear();
```

Map과 Set의 조회 성능은 구현에 따라 달라지므로 항상 `O(1)`이라고 단정할 수는 없습니다.  
ECMAScript 명세는 평균적으로 요소 수에 대해 선형보다 빠른 접근 시간을 제공하도록 요구합니다.  

## 4. Map과 Set 확장 기능 {#session-04}

2024년에는 데이터를 그룹화하는 `Object.groupBy()`와 `Map.groupBy()`, Set의 집합 연산 메서드를 여러 주요 실행 환경에서 사용할 수 있게 되었습니다.  
비교적 최근에 지원되기 시작한 기능이므로 프로젝트의 Node.js와 브라우저 버전을 먼저 확인해야 합니다.  

### 🟦 1) Object.groupBy와 Map.groupBy

`Object.groupBy()`와 `Map.groupBy()`는 배열과 같은 반복 가능한 객체의 요소를 지정한 기준에 따라 그룹으로 묶습니다.  

#### 🔷 Object.groupBy

`Object.groupBy()`는 그룹 결과를 null 프로토타입 객체로 반환합니다.  
콜백이 반환한 값은 문자열 또는 Symbol인 속성 키로 사용되며, 다른 값은 속성 키로 변환됩니다.  

```javascript
const orders = [
  { id: 1, status: "pending", region: "Seoul" },
  { id: 2, status: "shipped", region: "Busan" },
  { id: 3, status: "pending", region: "Seoul" },
];

// 각 주문의 status 값을 그룹 이름으로 사용합니다.
const ordersByStatus = Object.groupBy(
  orders,
  (order) => order.status,
);

console.log(ordersByStatus.pending);
// [
//   { id: 1, status: "pending", region: "Seoul" },
//   { id: 3, status: "pending", region: "Seoul" },
// ]
```

기존에는 같은 작업을 `reduce()`로 다음과 같이 작성할 수 있었습니다.  

```javascript
const grouped = orders.reduce((accumulator, order) => {
  const key = order.status;

  if (!accumulator[key]) {
    accumulator[key] = [];
  }

  accumulator[key].push(order);
  return accumulator;
}, {});
```

다음처럼 가격, 날짜와 여러 속성을 조합한 값을 기준으로 그룹화할 수도 있습니다.  

```javascript
const products = [
  { name: "Laptop", price: 1200, date: "2024-05-10" },
  { name: "Mouse", price: 25, date: "2024-05-18" },
];

const productsByPrice = Object.groupBy(products, (product) => {
  return product.price > 100 ? "expensive" : "cheap";
});

const productsByMonth = Object.groupBy(products, (product) => {
  return product.date.slice(0, 7);
});

console.log(productsByPrice.expensive);
console.log(productsByMonth["2024-05"]);
```

#### 🔷 Map.groupBy

`Map.groupBy()`는 그룹 결과를 Map으로 반환하므로 문자열뿐 아니라 객체와 숫자 등 다양한 값을 그룹 키로 사용할 수 있습니다.  

```javascript
// 지역을 키로 사용하여 주문을 Map에 그룹화합니다.
const ordersByRegion = Map.groupBy(
  orders,
  (order) => order.region,
);

console.log(ordersByRegion.get("Seoul").length); // 2
console.log(ordersByRegion.has("Busan")); // true
```

### 🟦 2) Set 집합 연산 메서드

Set에는 합집합, 교집합과 차집합을 구하는 메서드가 추가되었습니다.  
각 메서드는 원본 Set을 변경하지 않고 새로운 Set을 반환합니다.  

| 메서드 | 의미 | 설명 |
| --- | --- | --- |
| `union(other)` | 합집합 | 두 집합의 모든 요소를 담은 Set을 반환합니다. |
| `intersection(other)` | 교집합 | 두 집합에 모두 존재하는 요소를 담은 Set을 반환합니다. |
| `difference(other)` | 차집합 | 현재 Set에만 존재하는 요소를 담은 Set을 반환합니다. |

```javascript
const userPermissions = new Set(["read", "write", "admin"]);
const defaultPermissions = new Set(["read", "guest"]);

const commonRights = userPermissions.intersection(
  defaultPermissions,
);
const exclusiveRights = userPermissions.difference(
  defaultPermissions,
);
const allRights = userPermissions.union(defaultPermissions);

console.log([...commonRights]); // ["read"]
console.log([...exclusiveRights]); // ["write", "admin"]
console.log([...allRights]); // ["read", "write", "admin", "guest"]
```

## 5. WeakMap과 WeakSet {#session-05}

WeakMap과 WeakSet은 일반적인 Map과 Set과 비슷하지만 저장한 객체를 가비지 컬렉션에서 강하게 유지하지 않는 특수 목적의 컬렉션입니다.  
외부에서 해당 객체를 더 이상 참조하지 않으면 객체가 가비지 컬렉션의 대상이 될 수 있습니다.  
가비지 컬렉션의 실행 시점은 JavaScript 코드에서 확인하거나 보장할 수 없습니다.  

| 구분 | 특징 | 사용 예 |
| --- | --- | --- |
| WeakMap | 주로 객체를 키로 사용하며 임의의 값을 연결합니다. | 객체나 DOM 요소에 메타데이터를 연결합니다. |
| WeakSet | 주로 객체를 값으로 저장합니다. | 특정 객체의 처리 여부를 기록합니다. |

WeakMap의 키와 WeakSet의 값에는 객체 또는 등록되지 않은 Symbol을 사용할 수 있습니다.  
두 컬렉션은 항목을 순회하거나 `size`로 개수를 확인할 수 없으므로 일반적인 목록 관리에는 적합하지 않습니다.  
일반 애플리케이션에서 직접 사용할 일은 많지 않지만, 객체에 부가 데이터를 연결하면서 객체의 메모리 회수를 방해하지 않아야 할 때 사용할 수 있습니다.  

DOM 요소가 문서에서 제거되고 다른 코드에서도 더 이상 참조하지 않는다면, 가비지 컬렉터가 해당 요소를 정리할 수 있습니다.  
그 요소와 연결된 WeakMap의 데이터도 함께 정리될 수 있습니다.

> 일반 Map은 키로 사용된 객체를 강하게 참조합니다.  
> 따라서 DOM 요소가 문서에서 제거되더라도 Map에 키로 남아 있으면 메모리에서 정리되지 않을 수 있습니다.

```javascript
// DOM 요소별 부가 정보를 저장할 WeakMap을 생성합니다.
// WeakMap의 키는 객체만 사용할 수 있으며, DOM 요소도 객체입니다.
const metadata = new WeakMap();

// HTML 문서에서 id가 "box"인 DOM 요소를 찾습니다.
// 요소가 없으면 null이 반환됩니다.
const element = document.getElementById("box");

if (element) {
  // element를 키로 사용하여 클릭 상태를 연결합니다.
  // DOM 요소 객체를 직접 수정하지 않고 외부에서 상태를 관리합니다.
  metadata.set(element, { clicked: 0 });

  // 같은 DOM 요소를 키로 사용하여 연결된 상태를 조회합니다.
  console.log(metadata.get(element)); // { clicked: 0 }
}
```
