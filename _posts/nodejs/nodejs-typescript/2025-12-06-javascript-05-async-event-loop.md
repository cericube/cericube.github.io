---
layout: post
title: "05. JavaScript 비동기 처리와 이벤트 루프 이해하기"
description: "JavaScript의 콜백, Promise, async/await, AbortController, 이벤트 루프와 Promise.withResolvers를 예제와 함께 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "05"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 콜백 기반 비동기 처리와 콜백 지옥"
  - id: session-02
    title: "2. Promise의 기본 구조와 체이닝"
  - id: session-03
    title: "3. async/await과 현대 비동기 처리 실무 패턴"
  - id: session-04
    title: "4. AbortController와 AbortSignal"
  - id: session-05
    title: "5. Microtask, Task Queue와 Event Loop"
---

## 1. 콜백 기반 비동기 처리와 콜백 지옥 {#session-01}

JavaScript의 초기 비동기 프로그래밍 방식은 대부분 콜백(Callback)에 의존했습니다.  
콜백은 특정 작업이 완료된 시점에 실행할 함수를 미리 인수로 전달하는 방식이며, 당시의 브라우저 API와 Node.js 표준 라이브러리는 이러한 패턴을 기본으로 제공했습니다.  
예를 들어 네트워크 요청, 파일 읽기, 타이머 같은 작업은 실행에 시간이 걸리기 때문에 결과를 즉시 반환하는 대신 완료 후 콜백 함수를 호출하는 방식으로 처리했습니다.  

### 🟦 기본적인 콜백 비동기 패턴

다음 예제는 1초 후 데이터를 반환하는 비동기 함수입니다.  

```javascript
function fetchData(callback) {
  setTimeout(() => {
    // Node.js의 오류 우선 콜백 관례에 따라 오류와 결과를 순서대로 전달합니다.
    callback(null, "데이터 로드 완료");
  }, 1000);
}

fetchData((error, data) => {
  // 오류가 있으면 성공 결과를 사용하지 않고 처리를 종료합니다.
  if (error) {
    console.error("오류 발생:", error);
    return;
  }

  console.log(data); // 1초 후 출력: 데이터 로드 완료
});
```

이 코드는 JavaScript 초기에 흔히 사용하던 구조로, 오류는 첫 번째 인수로 전달하고 정상 값은 두 번째 인수로 전달하는 Node.js의 오류 우선 콜백(Error-first Callback) 관례를 따릅니다.  
이와 같은 패턴은 작은 함수에서는 충분히 사용할 수 있지만, 여러 비동기 작업이 순차적으로 연결되기 시작하면 문제가 드러납니다.  

### 🟦 콜백 지옥의 실제 문제

콜백 지옥(Callback Hell)은 JavaScript에서 비동기 작업을 콜백으로만 처리할 때 콜백 함수가 여러 번 중첩되면서 코드가 지나치게 복잡하고 읽기 어려워지는 현상을 말합니다.  
다음 코드는 1초 간격으로 세 번의 비동기 작업을 순차적으로 실행합니다.  

```javascript
setTimeout(() => {
  console.log("1초 후");

  // 앞 단계가 끝난 뒤 다음 단계를 시작하기 위해 콜백을 중첩합니다.
  setTimeout(() => {
    console.log("2초 후");

    setTimeout(() => {
      console.log("3초 후");
    }, 1000);
  }, 1000);
}, 1000);
```

이와 같은 구조에는 다음과 같은 문제가 있습니다.  

- 비동기 작업이 많아질수록 들여쓰기가 깊어지고, 로직의 흐름을 위에서 아래로 자연스럽게 읽기 어렵습니다.  
- 오류가 발생할 수 있는 위치가 많아지는 반면, 모든 중첩 콜백에서 오류를 적절히 처리하고 전파하기는 쉽지 않습니다.  
- 하나의 단계만 수정하더라도 상위와 하위 콜백의 흐름 전체를 다시 검토해야 합니다.  

실무 프로젝트에서는 이러한 복잡성이 빠르게 누적됩니다.  

## 2. Promise의 기본 구조와 체이닝 {#session-02}

콜백 기반 비동기 처리의 구조적 한계를 보완하기 위해 ECMAScript 2015에서는 Promise가 공식 표준으로 도입되었습니다.  
Promise는 비동기 작업의 완료 또는 실패를 표현하는 객체로, 비동기 코드의 흐름을 더 명확하고 예측 가능하게 관리할 수 있게 합니다.  
전통적인 콜백 패턴에서는 작업 순서를 읽기 어렵고, 여러 단계의 비동기 흐름을 제어하는 동안 깊은 중첩이 발생하는 문제가 있었습니다.  
Promise는 이러한 중첩을 평평한 구조로 바꾸고 오류 전파를 하나의 경로로 통합하여 비동기 프로그래밍을 더 안정적이고 체계적으로 만듭니다.  

### 🟦 Promise의 기본 구조

```javascript
new Promise((resolve, reject) => {
  // 실행자 함수는 Promise를 생성하는 즉시 실행됩니다.
  // 이곳에서 비동기 작업을 시작하고 결과에 따라 resolve 또는 reject를 호출합니다.
});
```

Promise 객체는 `new Promise()` 생성자를 사용하여 생성합니다.  

🔹 **실행자 함수(Executor Function)**

- 실행자 함수는 `resolve`와 `reject`라는 두 개의 인수를 받으며, `new Promise()`가 호출되면 즉시 동기적으로 실행됩니다.  
- 이 함수 내부에는 실제로 시간이 걸리는 비동기 로직을 시작하는 코드가 포함될 수 있습니다.  

🔹 **resolve(value)**

- 비동기 작업이 성공적으로 완료되었을 때 호출하는 함수입니다.  
- 일반 값을 전달하면 Promise가 이행(Fulfilled) 상태가 되며, 그 값은 나중에 `then()` 메서드에서 사용할 결과가 됩니다.  

🔹 **reject(reason)**

- 비동기 작업 중 오류가 발생하여 실패했을 때 호출하는 함수입니다.  
- 이 함수를 호출하면 Promise가 거부(Rejected) 상태가 됩니다.  
- 인수로 전달한 `reason`은 나중에 `catch()` 메서드에서 사용할 실패 이유가 되며, 일반적으로 `Error` 객체를 전달합니다.  

### 🟦 기본 Promise 생성 및 처리

```javascript
// 비동기 작업을 Promise로 감싸서 반환합니다.
function fetchData() {
  return new Promise((resolve) => {
    // setTimeout으로 1초가 걸리는 비동기 작업을 흉내 냅니다.
    setTimeout(() => {
      // 작업이 정상적으로 끝났으므로 성공 결과를 전달합니다.
      resolve("데이터 로드 완료");
    }, 1000);
  });
}

// fetchData()가 Promise를 반환하므로 then, catch, finally를 연결할 수 있습니다.
fetchData()
  .then((result) => {
    // resolve가 호출되면 이 콜백이 실행됩니다.
    console.log("성공:", result);

    // then()에서 반환한 값은 다음 then()으로 전달됩니다.
    return "다음 처리 단계";
  })
  .then((nextStep) => {
    console.log(nextStep);
  })
  .catch((error) => {
    // Promise가 거부되거나 앞선 then()에서 오류가 발생하면 실행됩니다.
    console.error("오류:", error);
  })
  .finally(() => {
    // 성공과 실패에 관계없이 마지막 정리 작업을 실행합니다.
    console.log("작업 완료");
  });
```

- `resolve()`는 Promise에 성공 결과를 전달합니다.  
- `reject()`는 Promise를 실패 상태로 만듭니다.  
- `then()`은 성공 흐름을 처리합니다.  
- `catch()`는 실패 흐름을 처리합니다.  
- `finally()`는 결과와 관계없이 마지막 처리를 실행합니다.  

이 구조만으로도 콜백 기반의 오류 우선 패턴보다 로직이 명확하게 분리되고 흐름을 읽기 쉬워집니다.  

### 🟦 Promise 체이닝의 개념

Promise는 `then()`을 호출할 때마다 새로운 Promise를 반환합니다.  
이 특성 덕분에 여러 비동기 작업을 자연스럽게 연결할 수 있습니다.  
다음과 같은 순서의 비동기 로직을 콜백처럼 깊게 들여쓰기하지 않고 위에서 아래로 이어지는 흐름으로 구성할 수 있습니다.  

```text
작업 1
  → 작업 2
  → 작업 3
```

### 🟦 단계적 Promise 체이닝

```javascript
// 비동기 작업 1은 0.5초 후 완료되는 Promise를 반환합니다.
function step1() {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("1단계 완료");
      resolve("step1-result"); // 다음 단계로 전달할 값입니다.
    }, 500);
  });
}

// 비동기 작업 2는 이전 단계의 결과를 받아 처리합니다.
function step2(previousResult) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("2단계 완료, 이전 결과:", previousResult);
      resolve("step2-result"); // 다음 단계로 전달할 값입니다.
    }, 500);
  });
}

// 비동기 작업 3은 두 번째 단계의 결과를 전달받아 처리합니다.
function step3(previousResult) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("3단계 완료, 이전 결과:", previousResult);
      resolve("step3-result"); // 전체 흐름의 최종 결과입니다.
    }, 500);
  });
}

// 각 then()에서 다음 Promise를 반환하여 작업을 순차적으로 실행합니다.
step1()
  .then((result1) => step2(result1))
  .then((result2) => step3(result2))
  .then((finalResult) => {
    console.log("최종 결과:", finalResult);
  })
  .catch((error) => {
    // 어느 단계에서든 오류가 발생하면 이 콜백으로 이동합니다.
    console.error("오류 발생:", error);
  });
```

Promise 체이닝에는 다음과 같은 장점이 있습니다.  

- 들여쓰기 없이 위에서 아래로 흐름을 작성할 수 있습니다.  
- 각 단계는 이전 단계의 결과를 자연스럽게 전달받을 수 있습니다.  
- 하나의 `catch()`로 모든 단계의 오류를 처리할 수 있습니다.  
- API 호출, 데이터베이스 요청, 파일 처리와 같은 순차 비동기 작업에 활용할 수 있습니다.  

### 🟦 예외 처리와 오류 전파의 일관성

Promise의 강력한 기능 중 하나는 오류 전파(Error Propagation)입니다.  
Promise 체이닝의 어느 단계에서든 오류가 발생하면 이후의 성공 처리용 `then()`을 건너뛰고 가장 가까운 거부 처리 콜백으로 이동합니다.  
이와 같은 일관된 오류 흐름은 중첩된 콜백 기반 패턴에서 직접 구현하기 어려운 부분입니다.  

```javascript
Promise.resolve()
  .then(() => {
    throw new Error("중간 단계에서 오류 발생");
  })
  .then(() => {
    console.log("이 부분은 실행되지 않습니다.");
  })
  .catch((error) => {
    console.error("오류 처리:", error.message);
  });
```

### 🟦 Promise는 async/await의 기반

ECMAScript 2017에서 `async`/`await`이 도입되었지만, `async`/`await`도 Promise를 기반으로 동작합니다.  
따라서 Promise의 기본 구조를 이해하는 것은 현대 JavaScript 비동기 프로그래밍의 토대입니다.  

## 3. async/await과 현대 비동기 처리 실무 패턴 {#session-03}

Promise를 통해 비동기 흐름을 개선할 수 있지만, `then()` 체이닝이 길어지거나 여러 비동기 작업을 조합하는 과정에서는 코드의 가독성과 의도를 전달하기 어려울 때가 있습니다.  
이러한 문제를 줄이기 위해 ECMAScript 2017에서는 `async`/`await` 문법이 도입되었습니다.  
이 문법은 서버 개발과 브라우저 개발 모두에서 폭넓게 사용되며 현대적인 비동기 처리의 기본 문법으로 자리 잡았습니다.  
`async`/`await`은 Promise를 기반으로 동작하면서 비동기 코드를 동기 코드와 비슷한 순서로 이해하고 작성할 수 있도록 설계된 문법입니다.  

이 절은 다음 순서로 학습합니다.  

1. `async` 함수가 반환하는 값을 확인합니다.  
2. `await`으로 비동기 작업을 순서대로 실행합니다.  
3. `try...catch`로 비동기 오류를 처리합니다.  
4. 여러 작업을 목적에 맞는 Promise 정적 메서드로 조합합니다.  

### 🟦 async 함수

- `async` 키워드는 함수 앞에 붙이며, 해당 함수가 항상 Promise를 반환하게 합니다.  
- 함수가 일반 값을 반환하면 그 값은 이행된 Promise로 감싸져 반환됩니다.  
- 함수 안에서 처리되지 않은 예외가 발생하면 거부된 Promise가 반환됩니다.  

### 🟦 await 표현식

- `await`는 일반적으로 `async` 함수 내부에서 사용합니다.  
- Promise가 이행되면 `await` 표현식은 Promise의 결과 값을 반환합니다.  
- Promise가 거부되면 `await` 표현식은 해당 실패 이유를 예외로 던집니다.  

### 🟦 Promise와 async/await의 관계

`async` 함수는 항상 Promise를 반환하므로 다른 `async` 함수나 Promise 체이닝에서 연속적으로 사용할 수 있습니다.  
Promise 기반 코드에서는 `catch()`를 사용하여 오류를 처리할 수 있습니다.  
`async`/`await`에서는 `try...catch` 블록을 사용하여 `await`가 기다리는 Promise의 거부를 처리할 수 있습니다.  

### 🟦 async/await으로 비동기 코드 작성하기

`async` 키워드를 함수 앞에 붙이면 해당 함수는 자동으로 Promise를 반환합니다.  
`await` 키워드는 기다리는 값이 준비될 때까지 해당 `async` 함수의 실행만 잠시 중단합니다.  
이 덕분에 비동기 흐름을 동기 코드처럼 읽고 작성할 수 있습니다.  

```javascript
const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function processSteps() {
  console.log("시작");

  // await는 processSteps 함수의 다음 실행만 멈추며 전체 스레드를 막지 않습니다.
  await delay(1000);
  console.log("1초 경과");

  await delay(1000);
  console.log("2초 경과");
}

console.log("--- processSteps 함수 실행 시작 ---");

// async 함수가 반환한 Promise의 예상하지 못한 오류까지 처리합니다.
processSteps().catch((error) => {
  console.error("처리 중 오류 발생:", error);
});

console.log("--- processSteps 함수 호출 완료 ---");
```

`await delay(1000)`에 도달하면 `delay()` 함수는 1초 후 이행될 Promise를 반환합니다.  
`await`는 Promise가 처리될 때까지 `processSteps()` 함수의 실행을 일시 중지하고 호출자에게 제어권을 돌려줍니다.  
따라서 `processSteps()`가 중단된 뒤 `processSteps 함수 호출 완료` 메시지가 먼저 출력됩니다.  

실행 결과는 다음 순서로 나타납니다.  

```text
--- processSteps 함수 실행 시작 ---
시작
--- processSteps 함수 호출 완료 ---
1초 경과
2초 경과
```

### 🟦 try...catch와 async를 조합한 오류 처리

Promise의 거부는 `catch()`로 처리할 수 있으며, `async`/`await`에서는 동기 코드와 비슷하게 `try...catch`로 오류를 처리할 수 있습니다.  

```javascript
async function fetchUser() {
  throw new Error("사용자 정보를 가져오는 중 오류 발생");
}

async function main() {
  try {
    const user = await fetchUser();
    console.log(user);
  } catch (error) {
    // JavaScript에서는 Error가 아닌 값으로도 거부할 수 있으므로 안전하게 변환합니다.
    const message = error instanceof Error ? error.message : String(error);
    console.error("오류 발생:", message);
  }
}

main().catch((error) => {
  // main() 밖에서 발생한 예상하지 못한 오류를 마지막으로 처리합니다.
  console.error("main 함수 오류:", error);
});
```

### 🟦 비동기 작업을 조합하는 Promise 정적 메서드

여러 개의 비동기 작업을 효율적으로 처리하기 위해 Promise 객체에는 여러 정적 메서드가 제공됩니다.  
각 메서드는 서로 다른 사용 상황에 맞는 완료 조건을 제공합니다.  
다만 이 메서드들이 작업을 직접 시작하거나 별도 스레드에서 병렬로 실행하는 것은 아닙니다.  
각 Promise를 만들 때 이미 시작된 비동기 작업의 결과를 하나로 조합한다고 이해하는 편이 정확합니다.  
또한 반환된 Promise의 결과가 먼저 결정되더라도, 이미 시작된 나머지 비동기 작업이 자동으로 중단되거나 취소되는 것은 아닙니다.  

먼저 각 메서드의 차이를 표로 비교하면 다음과 같습니다.  

| 메서드 | 완료 조건 | 실패 조건 | 적합한 상황 |
| --- | --- | --- | --- |
| `Promise.all()` | 모든 작업이 성공함 | 하나라도 실패함 | 모든 결과가 반드시 필요할 때 |
| `Promise.allSettled()` | 모든 작업이 처리됨 | 입력 작업의 실패 때문에 거부되지 않음 | 성공과 실패를 모두 확인할 때 |
| `Promise.race()` | 가장 먼저 처리된 결과를 따름 | 가장 먼저 처리된 작업이 실패함 | 성공 여부와 관계없이 가장 빠른 결과가 필요할 때 |

#### 🔷 Promise.all: 모든 작업이 성공해야 완료

`Promise.all()`은 인수로 받은 모든 Promise가 이행되었을 때 결과를 반환합니다.  
모든 Promise가 이행되면 결과 값을 입력 순서대로 배열에 담아 반환합니다.  
단 하나라도 거부되면 반환된 Promise도 그 이유로 거부되는 Fail-fast 방식으로 동작합니다.  
이때 나머지 비동기 작업이 자동으로 취소되는 것은 아닙니다.  
모든 작업이 성공해야 다음 단계로 진행할 수 있는 API 요청이나 데이터베이스 다중 질의 등에 적합합니다.  

```javascript
async function executeAll() {
  console.log("--- 1. Promise.all 실행 ---");

  try {
    const results = await Promise.all([
      new Promise((resolve) => {
        setTimeout(() => resolve("A 결과"), 1000);
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve("B 결과"), 500);
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve("C 결과"), 2000);
      }),
    ]);

    // B가 먼저 완료되어도 결과 배열은 입력 순서인 A, B, C를 유지합니다.
    console.log("Promise.all 성공:", results);
    // 출력: [ "A 결과", "B 결과", "C 결과" ]
  } catch (error) {
    console.error("Promise.all 실패:", error);
  }

  try {
    await Promise.all([
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("첫 번째 실패")), 100);
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve("두 번째 성공"), 2000);
      }),
    ]);
  } catch (error) {
    // 첫 번째 Promise가 먼저 거부되므로 이 오류를 받습니다.
    console.error("하나 이상의 작업 실패:", error);
  }
}

executeAll().catch((error) => {
  console.error("Promise.all 예제 오류:", error);
});
```

#### 🔷 Promise.allSettled: 성공과 실패를 모두 반환

`Promise.allSettled()`는 인수로 받은 모든 Promise가 처리될 때까지 기다립니다.  
모든 Promise가 처리되면 각 결과를 나타내는 객체의 배열을 반환합니다.  
이행된 Promise의 결과는 `{ status: "fulfilled", value: 값 }` 형태입니다.  
거부된 Promise의 결과는 `{ status: "rejected", reason: 이유 }` 형태입니다.  
반환된 Promise는 입력 Promise의 거부 때문에 거부되지 않으므로 외부 연동이나 독립적인 배치 작업처럼 모든 결과를 개별적으로 확인해야 하는 상황에 적합합니다.  

```javascript
async function executeAllSettled() {
  console.log("--- 2. Promise.allSettled 실행 ---");

  const results = await Promise.allSettled([
    Promise.resolve("성공 결과"),
    Promise.reject(new Error("네트워크 오류")),
    new Promise((resolve) => {
      setTimeout(() => resolve(123), 100);
    }),
  ]);

  for (const result of results) {
    // status를 확인해야 value와 reason을 안전하게 구분할 수 있습니다.
    if (result.status === "fulfilled") {
      console.log("성공:", result.value);
    } else {
      console.error("실패:", result.reason);
    }
  }
}

executeAllSettled().catch((error) => {
  console.error("Promise.allSettled 예제 오류:", error);
});
```

#### 🔷 Promise.race: 가장 먼저 처리된 결과 사용

`Promise.race()`는 인수로 받은 Promise 중 가장 먼저 처리된 Promise의 결과를 따릅니다.  
가장 먼저 끝난 Promise가 성공하면 이행되고 실패하면 거부되며, 나머지 Promise의 결과는 반환 값에 반영되지 않습니다.  
다만 경쟁에서 제외된 나머지 비동기 작업이 자동으로 취소되지는 않습니다.  
타임아웃 처리나 여러 작업 중 가장 먼저 끝나는 하나의 결과가 필요한 경우에 사용합니다.  

```javascript
async function executeRace() {
  console.log("--- 3. Promise.race 실행 ---");

  const fastSuccess = new Promise((resolve) => {
    setTimeout(() => resolve("가장 빠른 성공"), 100);
  });
  const slowReject = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("느린 실패")), 500);
  });
  const slowSuccess = new Promise((resolve) => {
    setTimeout(() => resolve("느린 성공"), 2000);
  });

  try {
    const result = await Promise.race([
      fastSuccess,
      slowReject,
      slowSuccess,
    ]);
    console.log("Promise.race 결과:", result);
    // 출력: Promise.race 결과: 가장 빠른 성공
  } catch (error) {
    console.error("가장 먼저 처리된 작업이 실패함:", error);
  }
}

executeRace().catch((error) => {
  console.error("Promise.race 예제 오류:", error);
});
```

## 4. AbortController와 AbortSignal {#session-04}

`AbortController`와 `AbortSignal`은 진행 중인 비동기 작업에 취소 요청을 전달하기 위한 공식 표준 API입니다.  
이 API는 ECMAScript 2022 문법이 아니라 DOM 표준에 정의된 취소 인터페이스이며, 브라우저와 Node.js의 여러 비동기 API에서 사용합니다.  
Signal을 전달받은 API가 취소를 지원하거나 직접 작성한 함수가 취소 처리를 구현해야 실제 작업을 멈출 수 있습니다.  

### 🟦 fetch 요청 취소하기

Node.js 18 이상에서는 전역 `fetch()`를 사용할 수 있습니다.  
기본적인 취소 흐름은 다음과 같습니다.  

1. `AbortController` 객체를 생성합니다.  
2. `controller.signal` 속성을 통해 `AbortSignal` 객체를 얻습니다.  
3. 비동기 작업을 시작할 때 옵션 객체에 Signal을 전달합니다.  
4. 작업을 취소할 때 `controller.abort()` 메서드를 호출합니다.  

`fetch()`가 전달받은 Signal로 취소되면 반환한 Promise가 거부됩니다.  

```javascript
const controller = new AbortController();
const fetchUrl = "https://httpbin.org/delay/2";

// 0.5초 후 취소 명령을 전달합니다.
const timeoutId = setTimeout(() => {
  controller.abort(new Error("500ms 시간 제한 초과"));
  console.log("요청 취소 명령 전달");
}, 500);

async function runFetchWithCancellation() {
  console.log(`${fetchUrl}에 요청 시작`);

  try {
    const response = await fetch(fetchUrl, {
      // AbortSignal을 fetch 요청에 연결합니다.
      signal: controller.signal,
    });

    // fetch는 HTTP 오류 상태만으로 거부되지 않으므로 응답 상태를 직접 확인합니다.
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    console.log("응답 성공, 본문 길이:", text.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (controller.signal.aborted) {
      console.error("요청이 취소됨:", message);
    } else {
      console.error("요청 오류:", message);
    }
  } finally {
    // 성공, 취소, 오류 어느 경우에도 남아 있는 타이머를 정리합니다.
    clearTimeout(timeoutId);
  }
}

void runFetchWithCancellation();
```

취소 시 발생하는 오류의 세부 형태는 Node.js 버전과 호출한 API에 따라 달라질 수 있습니다.  
따라서 오류 이름만 확인하기보다 `signal.aborted`와 `signal.reason`을 함께 확인하는 편이 안전합니다.  

### 🟦 주요 활용 상황

#### 🔷 특정 시간이 지나면 API 요청 중단

서버 응답이 지나치게 늦어지는 상황을 방지하고 사용자 경험을 개선하는 전형적인 사용 사례입니다.  
예를 들어 API 요청 후 5초 이내에 응답이 오지 않으면 사용자에게 실패를 알리고 요청을 중단할 수 있습니다.  

#### 🔷 사용자가 화면을 이동했을 때 요청 취소

SPA에서 다음 화면으로 이동한 뒤에도 이전 화면의 비동기 작업이 계속 실행되는 상황을 방지할 수 있습니다.  
이전 화면에서 시작한 요청의 응답이 늦게 도착하여 현재 화면의 상태를 의도하지 않게 갱신하면 경쟁 조건(Race Condition)이 발생할 수 있습니다.  
컴포넌트가 제거될 때 `controller.abort()`를 호출하면 완료되지 않은 요청을 정리할 수 있습니다.  

### 🟦 setTimeout과 Promise를 결합한 취소 가능 작업

`fetch()` 외에도 `setTimeout()` 기반 Promise나 Node.js의 스트림 처리 등 다양한 비동기 작업에 `AbortSignal`을 연결할 수 있습니다.  

```javascript
// Signal이 취소되거나 지정된 시간만큼 지난 시점에 처리되는 함수입니다.
function delayWithSignal(ms, signal) {
  return new Promise((resolve, reject) => {
    // 이미 취소된 Signal이면 타이머와 리스너를 만들지 않고 즉시 거부합니다.
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = () => {
      clearTimeout(timerId);
      reject(signal.reason);
    };

    const timerId = setTimeout(() => {
      // 정상 완료되면 더 이상 필요하지 않은 이벤트 리스너를 제거합니다.
      signal.removeEventListener("abort", onAbort);
      resolve(`${ms}ms 지연 완료`);
    }, ms);

    // 취소 이벤트는 한 번만 발생하므로 once 옵션으로 리스너를 등록합니다.
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function testDelayCancellation() {
  console.log("--- 취소 가능한 지연 테스트 ---");

  const controller = new AbortController();

  // 100ms 후 500ms 지연 작업에 취소를 요청합니다.
  setTimeout(() => {
    controller.abort(new Error("지연 작업 취소"));
  }, 100);

  try {
    const result = await delayWithSignal(500, controller.signal);
    console.log(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("취소 오류:", message);
  }
}

void testDelayCancellation();
```

원본 예제에서는 이미 취소된 Signal을 처리하는 과정에서 선언 전의 `timerId`를 참조할 수 있었습니다.  
수정한 예제는 취소 여부를 먼저 검사한 뒤 타이머를 생성하므로 이러한 TDZ 오류가 발생하지 않습니다.  

## 5. Microtask, Task Queue와 Event Loop {#session-05}

JavaScript는 한 번에 하나의 작업만 처리할 수 있는 단일 스레드(Single-Threaded) 언어입니다.  
그런데도 동시에 여러 작업을 처리하는 것처럼 보이는 것은 이벤트 루프(Event Loop) 메커니즘 덕분입니다.  
이벤트 루프는 실행해야 할 비동기 작업을 우선순위와 실행 시점이 다른 대기열에 담아 관리하며, 정해진 순서에 따라 작업을 스케줄링합니다.  

처음에는 Microtask Queue와 Task Queue라는 두 가지 흐름으로 구분하여 이해하면 쉽습니다.  
다만 실제 브라우저에는 여러 Task Queue가 존재할 수 있고, Node.js는 timers, poll, check와 같은 단계로 이벤트 루프를 구성한다는 차이가 있습니다.  

### 🟦 1. Call Stack: 모든 작업의 시작점

이벤트 루프가 대기 중인 작업을 실행하기 전에 동기적으로 작성된 코드는 Call Stack이라는 곳에서 즉시 실행됩니다.  
JavaScript는 Call Stack에 있는 현재 작업이 모두 끝날 때까지 다른 큐의 작업을 실행하지 않습니다.  
즉, 현재 작업 안에서는 동기 코드가 먼저 실행됩니다.  

동기 코드가 Call Stack을 오랫동안 점유하면 다른 비동기 콜백도 실행되지 못하고 함께 지연됩니다.  

### 🟦 2. Microtask Queue: 다음 Task보다 먼저 처리되는 대기열

Microtask Queue에는 현재 작업이 끝난 직후 처리해야 하는 작업들이 등록됩니다.  
비교적 짧고 즉각적인 처리가 필요한 미세 작업을 이곳에 등록하는 것이 일반적입니다.  

| 작업 | 설명 |
| --- | --- |
| `Promise.then()`, `catch()`, `finally()` | Promise가 이행되거나 거부된 뒤 실행할 콜백 |
| `queueMicrotask()` | 개발자가 직접 Microtask를 등록할 수 있는 API |
| `MutationObserver` | 브라우저에서 DOM 변경을 감지하는 API |

Microtask는 호출 스택이 비워진 뒤 다음 Task로 넘어가기 전에 큐가 빌 때까지 연속적으로 처리됩니다.  

### 🟦 3. Task Queue: Microtask 이후에 처리되는 대기열

Task Queue에는 타이머, 이벤트, I/O와 관련된 콜백 등이 등록됩니다.  
작업이 오래 걸리는지 여부가 Task와 Microtask를 나누는 기준은 아닙니다.  
어떤 API가 해당 콜백을 어느 대기열에 등록하도록 정의했는지에 따라 종류가 결정됩니다.  

| 작업 | 환경 | 설명 |
| --- | --- | --- |
| `setTimeout()`, `setInterval()` | 브라우저, Node.js | 지정된 시간이 지난 후 실행할 콜백 |
| I/O 이벤트 | Node.js | 파일 읽기와 쓰기, 네트워크 요청과 응답 등 |
| DOM 이벤트 | 브라우저 | 클릭과 키보드 입력 같은 사용자 상호작용 |
| `setImmediate()` | Node.js | 이벤트 루프의 check 단계에서 실행할 콜백 |

브라우저 이벤트 루프를 단순화하면 Microtask Queue를 모두 비운 뒤 실행 가능한 Task 하나를 선택하여 실행한다고 이해할 수 있습니다.  
Node.js에서는 하나의 Task Queue만 사용하는 대신 이벤트 루프의 여러 단계를 순환하므로 세부 실행 순서가 다를 수 있습니다.  

### 🟦 Event Loop 우선순위 규칙

브라우저 이벤트 루프의 기본 흐름을 단순화하면 다음과 같습니다.  

1. **동기 코드 실행**: Call Stack이 완전히 비워질 때까지 현재 작업의 코드를 실행합니다.  
2. **Microtask 처리**: Call Stack이 비워지면 Microtask Queue의 작업을 큐가 빌 때까지 연속적으로 실행합니다.  
3. **Task 하나 실행**: Microtask Queue가 비워지면 실행 가능한 Task 하나를 선택하여 Call Stack에서 실행합니다.  
4. **Microtask 재처리**: Task 하나가 완료되면 다시 Microtask Queue를 비웁니다.  
5. **반복**: Task 실행과 Microtask 처리를 반복합니다.  

이 규칙 때문에 같은 실행 흐름에서 준비된 Promise 콜백은 일반적인 타이머 콜백보다 먼저 실행될 기회를 얻습니다.  
이는 Microtask의 처리 속도가 무조건 더 빠르다는 의미가 아니라 스케줄링 순서가 앞선다는 의미입니다.  

### 🟦 예제: Microtask 우선순위 확인

```javascript
console.log("시작"); // 1. 동기 코드입니다.

setTimeout(() => {
  console.log("setTimeout 실행 (Task)"); // 4. Task로 등록됩니다.
}, 0);

Promise.resolve().then(() => {
  // 현재 동기 코드가 끝난 뒤 타이머보다 먼저 처리됩니다.
  console.log("Promise then 실행 (Microtask)"); // 3. Microtask로 등록됩니다.
});

console.log("끝"); // 2. 동기 코드입니다.
```

실행 결과는 다음과 같습니다.  

```text
시작
끝
Promise then 실행 (Microtask)
setTimeout 실행 (Task)
```

1. `시작`과 `끝`이 동기 코드로서 Call Stack에서 즉시 실행됩니다.  
2. Call Stack이 비워지면 이벤트 루프가 Microtask Queue를 확인합니다.  
3. `Promise.resolve().then()` 콜백이 Microtask Queue에 있으므로 이 콜백이 실행됩니다.  
4. Microtask Queue가 비워지면 이벤트 루프가 다음 Task를 확인합니다.  
5. `setTimeout()` 콜백이 실행 가능한 상태이므로 이 콜백이 실행됩니다.  

### 🟦 Microtask와 Task의 구분이 중요한 이유

#### 🔷 실행 순서 예측

`async`/`await`도 Promise를 기반으로 동작하므로 `await` 다음의 코드는 기다리던 값이 준비되면 Microtask 흐름으로 재개됩니다.  
같은 실행 흐름에서 이미 준비된 Promise와 `setTimeout()`을 함께 예약하면 일반적으로 Promise의 후속 코드가 먼저 실행됩니다.  
다만 모든 `await` 이후 코드가 모든 I/O 작업보다 항상 먼저 실행되는 것은 아니며, 각 작업이 준비된 시점도 함께 확인해야 합니다.  

#### 🔷 UI 업데이트 시점 제어

브라우저는 일반적으로 Task 하나와 이어지는 Microtask 처리가 끝난 뒤 화면을 업데이트할 기회를 가집니다.  
Task가 너무 길면 화면이 멈춘 것처럼 보입니다.  
Microtask를 연속적으로 실행해도 다음 렌더링 시점이 지연될 수 있으므로, 긴 작업은 적절히 나누어 다음 Task와 렌더링에 실행 기회를 주어야 합니다.  

#### 🔷 일관성 유지

DOM 조작이나 상태 변경 뒤에 Microtask를 등록하면 현재 Call Stack이 끝난 직후이면서 다음 Task가 시작되기 전에 후속 처리를 실행할 수 있습니다.  
이 순서를 활용하면 서로 관련된 상태 변경을 다음 Task 전에 정리할 수 있습니다.  
다만 Microtask를 계속 추가하면 다음 Task와 렌더링이 실행되지 못하는 기아 상태가 발생할 수 있으므로 주의해야 합니다.  

### 🟦 요약

- Microtask는 Promise 기반 비동기 흐름의 핵심이며 다음 Task보다 먼저 처리됩니다.  
- 브라우저 이벤트 루프의 기본 흐름은 `동기 코드 → Microtask → Task → Microtask → ...` 순서로 이해할 수 있습니다.  
- 브라우저와 Node.js의 세부 이벤트 루프 구조는 서로 다릅니다.  
- 이 원리를 이해하면 복잡한 비동기 흐름의 실행 순서를 더 정확하게 예측할 수 있습니다.  
