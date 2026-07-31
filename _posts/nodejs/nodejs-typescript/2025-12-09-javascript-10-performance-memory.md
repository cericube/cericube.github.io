---
layout: post
title: "10. JavaScript 퍼포먼스와 메모리 최적화 이해하기"
description: "JavaScript의 Spread와 구조 분해에 드는 비용, 클로저와 WeakMap의 메모리 특성, 반복문과 임시 객체가 성능에 미치는 영향을 예제로 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "10"
ai_assisted: true
toc:
  - id: session-01
    title: "1. Spread와 구조 분해가 느린 이유: 내부 동작과 성능 비용"
  - id: session-02
    title: "2. 메모리 누수의 진짜 원인: 클로저와 WeakMap"
  - id: session-03
    title: "3. 반복문 선택이 성능을 좌우하는 이유"
---

## 1. Spread와 구조 분해가 느린 이유: 내부 동작과 성능 비용 {#session-01}

Spread(`...`) 문법은 객체와 배열을 손쉽게 복사하거나 병합할 수 있어 매우 편리합니다.  
그러나 이 편리함 뒤에는 잘 드러나지 않는 성능 비용이 숨어 있습니다.  
특히 대규모 데이터를 반복해서 다루는 상황에서는 이러한 비용이 누적되어 전체 코드의 성능을 떨어뜨릴 수 있습니다.  

### 🟦 Spread 구문의 숨겨진 비용과 성능 영향

Spread 문법이 실행될 때 JavaScript 엔진은 다음과 같은 작업을 수행합니다.  

#### 🔷 1. 전체 순회 발생

객체 Spread는 원본 객체가 직접 소유한 열거 가능한 속성을 읽고, 배열 Spread는 모든 요소를 처음부터 끝까지 순회합니다.  
따라서 복사할 데이터가 많을수록 처리할 작업도 늘어납니다.  

#### 🔷 2. 새로운 객체 또는 배열 생성

객체나 배열 리터럴에서 사용하는 Spread는 단순한 참조 복사가 아니라 새로운 객체 또는 배열을 생성합니다.  
이 과정에서 속성이나 요소를 복사하는 비용이 추가로 발생합니다.  

#### 🔷 3. 얕은 복사만 수행

Spread는 내부 객체까지 깊게 복사하지 않습니다.  
중첩된 객체는 기존 객체의 참조를 그대로 공유합니다.  

이러한 특성 때문에 수천 개 이상의 데이터를 반복해서 처리할 때 Spread를 남용하면 예상보다 큰 성능 저하로 이어질 수 있습니다.  

### 🟦 Spread의 동작과 얕은 복사 확인하기

```javascript
const user = {
  id: 101,
  name: "Alice",
  settings: { theme: "dark" },
};

// user의 열거 가능한 속성을 복사하여 새로운 객체를 만듭니다.
const copy = { ...user, isLoggedIn: true };

console.log("원본 user:", user);
console.log("복사본 copy:", copy);

// settings는 얕게 복사되므로 두 객체가 같은 settings를 가리킵니다.
console.log("settings 동일 참조 여부:", copy.settings === user.settings); // true

// 복사본의 settings를 수정합니다.
copy.settings.theme = "light";

console.log("user.settings.theme:", user.settings.theme); // "light"
console.log("copy.settings.theme:", copy.settings.theme); // "light"
```

`const copy = { ...user, isLoggedIn: true };` 표현은 다음 작업을 수행합니다.  

1. 새로운 객체를 만듭니다.  
2. `user`의 열거 가능한 속성을 읽습니다.  
3. 각 속성을 `copy`에 씁니다.  
4. `isLoggedIn` 속성을 추가합니다.  

`copy.settings === user.settings`가 `true`인 것을 보면 바깥쪽 객체만 새로 만들고 `settings`는 공유한다는 사실을 알 수 있습니다.  
따라서 `copy.settings.theme`을 변경하면 원본 `user.settings.theme`도 함께 바뀝니다.  
이를 통해 얕은 복사임을 확인할 수 있습니다.  

### 🟦 실무 최적화: 복사 대신 참조 유지와 직접 수정

성능이 중요하고 원본 데이터의 직접 수정이 허용되는 상황이라면 불필요한 객체 복사를 만들지 않는 것이 유리합니다.  
특히 대량 데이터를 반복해서 처리하면서 매번 Spread로 새 객체를 만드는 패턴은 주의해야 합니다.  

#### 🔷 나쁜 예: Spread 남용으로 인한 성능 저하

```javascript
// 10만 개의 데이터가 담긴 배열을 준비합니다.
const bigList = Array.from({ length: 100_000 }, (_, index) => ({
  id: index,
  name: `item-${index}`,
  status: "PENDING",
}));

console.time("spread-map");

// 매 순회마다 item 객체를 Spread로 복사하여 새로운 객체를 만듭니다.
const resultWithSpread = bigList.map((item) => ({
  ...item,
  status: "DONE",
}));

console.timeEnd("spread-map");
```

이 코드는 `bigList`의 길이만큼 `map()`을 실행하고 각 요소마다 `...item`을 수행합니다.  
따라서 10만 개 객체의 속성을 읽고 10만 개의 새 객체를 생성하는 비용이 발생합니다.  

#### 🔷 좋은 예: 참조 기반 수정으로 객체 복사 비용 줄이기

```javascript
// 같은 형태의 bigList를 준비합니다.
const bigList2 = Array.from({ length: 100_000 }, (_, index) => ({
  id: index,
  name: `item-${index}`,
  status: "PENDING",
}));

console.time("mutate-map");

// 새로운 객체를 만들지 않고 기존 객체의 속성만 수정합니다.
const resultWithMutation = bigList2.map((item) => {
  item.status = "DONE";
  return item;
});

console.timeEnd("mutate-map");
```

이 예제는 각 요소를 새 객체로 복사하지 않고 `status` 속성만 변경합니다.  
다만 `map()` 자체는 결과 배열을 새로 생성하므로 배열 할당 비용까지 없어지는 것은 아닙니다.  
실행 환경과 데이터 형태에 따라 차이는 달라질 수 있으므로 실제 작업과 유사한 조건에서 측정해야 합니다.  

이 방식은 원본 데이터를 변경해도 괜찮은 상황에서만 사용해야 합니다.  
원본 보존이 필요하다면 Spread나 `structuredClone()`과 같은 복사 전략을 선택해야 합니다.  

### 🟦 안전한 깊은 복사: structuredClone 사용하기

때로는 단순한 얕은 복사가 아니라 객체 내부의 중첩된 값까지 분리된 복사본이 필요합니다.  
이때는 깊은 복사를 사용해야 합니다.  

과거에 많이 사용한 `JSON.parse(JSON.stringify(value))` 방식에는 다음과 같은 한계가 있습니다.  

- Date, Map, Set과 RegExp 등의 타입을 제대로 보존하지 못합니다.  
- 순환 참조가 있으면 오류가 발생합니다.  
- `undefined`와 같은 일부 값을 잃을 수 있습니다.  

현대적인 브라우저와 Node.js 17 이상에서는 `structuredClone()`을 사용할 수 있습니다.  
이 함수는 Date, Map, Set과 순환 참조 등을 복사할 수 있지만 함수는 복사할 수 없습니다.  

#### 🔷 JSON 방식과 structuredClone 비교

```javascript
const complexData = {
  id: 1,
  time: new Date(),
  cache: new Map([["key", "value"]]),
};

// JSON 방식은 Date와 Map의 타입을 보존하지 못합니다.
const jsonClone = JSON.parse(JSON.stringify(complexData));

console.log("JSON Clone - time 타입:", jsonClone.time instanceof Date); // false
console.log("JSON Clone - cache 타입:", jsonClone.cache instanceof Map); // false
console.log("JSON Clone - time 값:", jsonClone.time); // 문자열
console.log("JSON Clone - cache 값:", jsonClone.cache); // 빈 일반 객체

// structuredClone은 지원하는 타입을 보존하여 깊게 복사합니다.
const safeClone = structuredClone(complexData);

console.log("structuredClone - time 타입:", safeClone.time instanceof Date); // true
console.log("structuredClone - cache 타입:", safeClone.cache instanceof Map); // true
console.log("structuredClone - time 값:", safeClone.time); // Date 객체
console.log(
  'structuredClone - cache.get("key"):',
  safeClone.cache.get("key"),
); // "value"
```

## 2. 메모리 누수의 진짜 원인: 클로저와 WeakMap {#session-02}

JavaScript는 가비지 컬렉션(GC)이 자동으로 메모리를 관리하지만, 코드에서 특정 객체에 도달할 수 있는 참조가 남아 있으면 GC는 그 객체를 해제할 수 없습니다.  
더 이상 필요하지 않은 객체가 참조 때문에 계속 메모리에 남는 현상을 메모리 누수(Memory Leak)라고 합니다.  
Node.js는 장시간 실행되는 서버 환경에서 많이 사용하므로 작은 누수도 쌓이면 프로세스의 메모리 부족이나 비정상 종료로 이어질 수 있습니다.  

### 🟦 메모리 누수의 위험성과 클로저 관리

> 클로저는 함수가 선언될 당시의 스코프를 기억하고, 함수가 실행되는 시점에도 그 환경에 접근할 수 있게 하는 기능입니다.  

클로저는 JavaScript의 강력한 기능입니다.  
함수가 선언 당시의 변수 환경을 기억하고 사용할 수 있게 합니다.  
하지만 이 환경에 대규모 데이터가 포함되어 있으면 해당 클로저가 유지되는 동안 GC는 그 데이터를 해제하지 못합니다.  

#### 🔷 주의할 코드: 클로저가 대형 데이터를 유지하는 경우

```javascript
function createCacheHandler() {
  // 100만 개의 숫자를 가진 대형 배열을 생성합니다.
  const hugeData = new Array(1_000_000).fill(0);

  // 반환한 함수가 hugeData를 계속 참조합니다.
  return (index) => hugeData[index];
}

const handler = createCacheHandler();

// handler가 필요한 동안 hugeData도 메모리에 유지됩니다.
console.log(handler(0)); // 0
```

`hugeData`는 함수 외부에서 직접 접근할 수 없지만 `handler`를 통해 도달할 수 있으므로 GC의 수거 대상이 아닙니다.  
이 보유 자체는 클로저의 정상 동작이며, `handler`가 더 이상 필요하지 않은데도 장기간 참조할 때 메모리 누수가 될 수 있습니다.  

#### 🔷 클래스 기반으로 재작성

클래스 방식은 상태가 인스턴스 내부에 명시적으로 저장되므로 데이터의 수명과 정리 시점을 파악하기 쉽습니다.  
다만 클래스도 인스턴스가 유지되는 동안 데이터를 참조하므로 그 자체로 메모리 사용량을 줄이는 것은 아닙니다.  

```javascript
class DataCache {
  constructor(size) {
    // 큰 데이터가 인스턴스 내부에 명시적으로 존재합니다.
    this.hugeData = new Array(size).fill(0);
  }

  get(index) {
    return this.hugeData[index];
  }

  clear() {
    // 참조를 제거하여 다음 GC에서 회수할 수 있는 상태로 만듭니다.
    this.hugeData = null;
  }
}

const cache = new DataCache(1_000_000);
console.log(cache.get(0)); // 0

// 더 이상 필요하지 않은 데이터의 참조를 제거합니다.
cache.clear();
```

#### 🔷 개선 코드: 필요한 값만 클로저에 남기기

대규모 데이터가 클로저에 불필요하게 포함되지 않도록 꼭 필요한 값만 클로저 환경에 남기는 편이 안전합니다.  

```javascript
function createCounter() {
  // 작은 상태만 클로저에 저장합니다.
  let count = 0;
  return () => ++count;
}

const counter = createCounter();

console.log(counter()); // 1
console.log(counter()); // 2
```

클로저는 유지되지만 보관하는 데이터는 매우 작습니다.  
대규모 데이터가 필요하다면 수명과 해제 시점을 명확하게 관리할 수 있는 구조를 선택해야 합니다.  

#### 🔷 개선 코드: 클래스 기반 Counter 구현

```javascript
class Counter {
  constructor() {
    // 상태를 인스턴스의 속성으로 명확하게 저장합니다.
    this.count = 0;
  }

  next() {
    this.count += 1;
    return this.count;
  }
}

const counter = new Counter();

console.log(counter.next()); // 1
console.log(counter.next()); // 2
console.log(counter.next()); // 3
```

### 🟦 WeakMap을 활용한 자동 정리 캐시 패턴

서버 코드에서 메모리 누수가 발생하는 또 다른 원인은 수명이나 크기를 제한하지 않은 캐시입니다.  

#### 🔷 문제: 일반 Map의 강한 참조

`Map` 객체는 키로 설정한 객체를 강하게 참조합니다.  
외부에서 해당 객체를 더 이상 사용하지 않더라도 `Map`이 참조하고 있으면 GC가 제거하지 못합니다.  

#### 🔷 해결: WeakMap의 약한 참조

`WeakMap`은 객체 키에 대해 약한 참조를 유지합니다.  
`WeakMap`의 키를 다른 곳에서 참조하지 않게 되면 GC는 키와 연결된 값을 정리할 수 있습니다.  
GC의 실행 시점은 직접 제어하거나 예측할 수 없습니다.  

#### 🔷 WeakMap으로 캐시 만들기

```javascript
const computeCache = new WeakMap();

/**
 * 특정 객체를 키로 사용하여 계산 결과를 캐시합니다.
 */
function getHeavyResult(inputObject) {
  if (computeCache.has(inputObject)) {
    console.log("캐시 히트!");
    return computeCache.get(inputObject);
  }

  // 실제로는 CPU 사용량이 많은 작업이라고 가정합니다.
  const result = inputObject.value * 123456;
  computeCache.set(inputObject, result);

  console.log("새로운 값 계산 완료.");
  return result;
}

let data = { value: 10 };

// 최초 호출에서는 계산을 수행합니다.
console.log("결과:", getHeavyResult(data));

// 두 번째 호출에서는 캐시를 사용합니다.
console.log("결과:", getHeavyResult(data));

// 객체를 더 이상 사용하지 않도록 참조를 제거합니다.
data = null;

// 이후 GC가 실행되면 WeakMap의 해당 항목도 정리될 수 있습니다.
```

## 3. 반복문 선택이 성능을 좌우하는 이유 {#session-03}

대량의 데이터를 다루거나 반복적인 연산을 수행할 때 반복문 선택은 JavaScript 성능에 영향을 줄 수 있습니다.  
또한 반복 과정에서 생성되는 임시 객체의 양은 GC 빈도와 관련되므로 반복문과 메모리 할당 방식을 함께 살펴봐야 합니다.  

### 🟦 성능을 고려한 반복문 선택

반복문의 성능은 JavaScript 엔진, 데이터 형태와 반복문 안에서 수행하는 작업에 따라 달라집니다.  
단순 반복에서는 콜백 호출이나 결과 배열 할당이 없는 기본 `for` 문이 유리할 수 있지만 고정된 성능 순위를 모든 코드에 적용할 수는 없습니다.  

| 형태 | 특징 | 적합한 상황 |
| --- | --- | --- |
| `for` | 인덱스와 반복 범위를 직접 제어하며 별도 콜백 호출이 없습니다. | 반복 범위를 세밀하게 제어하거나 성능을 측정해 최적화할 때 |
| `for...of` | 값을 직접 순회하므로 가독성이 좋습니다. | Iterable의 값을 단순하게 순회할 때 |
| `forEach()` | 요소마다 콜백을 호출하며 중간에 `break`할 수 없습니다. | 반환 배열 없이 각 요소에 작업을 수행할 때 |
| `map()` | 각 요소를 변환한 새로운 배열을 만듭니다. | 같은 길이의 변환 결과 배열이 필요할 때 |
| `filter()` | 조건을 통과한 요소로 새로운 배열을 만듭니다. | 일부 요소를 선택한 결과 배열이 필요할 때 |
| `reduce()` | 값을 하나로 누적하며 결과 배열을 반드시 만들지는 않습니다. | 합계나 객체 등 하나의 결과로 누적할 때 |

```javascript
// 20만 개의 숫자로 구성된 배열을 생성합니다.
const numbers = new Array(200_000).fill(1);

// 1. reduce()
console.time("reduce");
const sumReduce = numbers.reduce((sum, number) => sum + number, 0);
console.timeEnd("reduce");

// 2. forEach()
console.time("forEach");
let sumForEach = 0;
numbers.forEach((number) => {
  sumForEach += number;
});
console.timeEnd("forEach");

// 3. for...of
console.time("forOf");
let sumForOf = 0;
for (const number of numbers) {
  sumForOf += number;
}
console.timeEnd("forOf");

// 4. 기본 for 문
console.time("for");
let sumFor = 0;
for (let index = 0; index < numbers.length; index++) {
  sumFor += numbers[index];
}
console.timeEnd("for");
```

실행 결과는 엔진 버전, 실행 시점의 최적화 상태와 시스템 환경에 따라 달라질 수 있습니다.  
원문에서 측정한 한 번의 실행 결과는 다음과 같습니다.  

```text
reduce: 1.79ms
forEach: 2.63ms
forOf: 3.55ms
for: 1.24ms
```

이 결과만으로 반복문의 일반적인 성능 순위를 확정할 수는 없습니다.  
정확하게 비교하려면 워밍업과 반복 측정을 포함한 벤치마크 도구를 사용하고 실제 작업과 비슷한 데이터로 측정해야 합니다.  

### 🟦 고차 함수 사용 시 고려할 성능 비용

`map()`, `filter()`, `reduce()`와 같은 고차 함수는 각 요소를 처리하기 위해 콜백을 호출합니다.  
이 가운데 `map()`과 `filter()`는 결과 배열을 새로 만들지만 `reduce()`는 누적 방식에 따라 새 배열을 만들지 않을 수 있습니다.  

```javascript
// 10만 개의 숫자를 가진 배열을 생성합니다.
const numbers = new Array(100_000).fill(1);

// reduce()는 각 요소마다 콜백을 호출합니다.
console.time("Reduce_Time");
const totalA = numbers.reduce((sum, number) => sum + number, 0);
console.timeEnd("Reduce_Time");

// 기본 for 문은 콜백 호출 없이 합계를 계산합니다.
console.time("For_Time");
let totalB = 0;
for (let index = 0; index < numbers.length; index++) {
  totalB += numbers[index];
}
console.timeEnd("For_Time");
```

단순한 합산에서는 기본 `for` 문이 더 빠를 수 있지만 엔진이 콜백을 인라인화하는 등 최적화를 적용하면 차이가 달라질 수 있습니다.  
일반적인 코드에서는 가독성과 유지보수성을 우선하고, 성능 문제가 측정된 구간만 벤치마크한 뒤 최적화하는 편이 좋습니다.  

### 🟦 GC Pause와 임시 객체 최소화

V8 가비지 컬렉터는 사용하지 않는 메모리를 회수하는 일부 과정에서 JavaScript 실행을 잠시 멈출 수 있습니다.  
이를 GC Pause라고 하며 서버 환경에서는 응답 지연의 원인이 될 수 있습니다.  

GC를 자주 유발할 수 있는 대표적인 코드 패턴은 다음과 같습니다.  

- 반복문이나 `map()` 내부에서 Spread로 대형 객체를 복사하는 패턴
- 반복 호출마다 새로운 배열이나 객체를 생성하는 패턴
- `JSON.parse()`와 `JSON.stringify()`를 반복해서 사용하는 패턴
- 요청마다 임시 객체를 대량으로 생성하는 패턴

이러한 코드는 V8의 Young Generation 영역을 빠르게 채우고 GC가 더 자주 실행되게 할 수 있습니다.  

#### 🔷 문제 코드: 매번 새로운 대형 배열 생성

```javascript
function processData(size) {
  // 호출할 때마다 큰 배열을 새로 생성합니다.
  const temporaryData = new Array(size).fill(0);
  return temporaryData[0];
}

console.time("bad");

for (let index = 0; index < 5000; index++) {
  processData(50_000);
}

console.timeEnd("bad");
```

이 코드는 호출할 때마다 새로운 배열을 생성합니다.  
배열이 클수록 메모리 할당량이 늘어나며 반복 호출 시 GC가 더 자주 실행될 수 있습니다.  
