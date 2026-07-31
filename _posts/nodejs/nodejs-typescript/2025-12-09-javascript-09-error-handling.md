---
layout: post
title: "09. JavaScript 에러 처리 기법 이해하기"
description: "JavaScript의 Error 객체와 스택 트레이스, Error.cause, try/catch, 비동기 에러 처리와 Custom Error 클래스 설계를 예제로 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "09"
ai_assisted: true
toc:
  - id: session-01
    title: "1. Error 객체 구조와 스택 트레이스"
  - id: session-02
    title: "2. Error.cause (ES2022)"
  - id: session-03
    title: "3. throw와 try/catch 실무 규칙"
  - id: session-04
    title: "4. 비동기 에러 처리"
  - id: session-05
    title: "5. Custom Error 클래스 설계"
---

## 1. Error 객체 구조와 스택 트레이스 {#session-01}

JavaScript에서 내장 오류가 발생하면 엔진은 해당 오류 상황을 설명하는 `Error` 객체를 생성합니다.  
이 객체는 디버깅 과정에서 중요한 역할을 하며, 오류의 종류와 발생 지점을 체계적으로 파악하도록 돕습니다.  

### 🟦 Error 객체의 핵심 속성

#### 🔷 1. name

발생한 오류의 유형을 나타내는 문자열입니다.  

예시는 다음과 같습니다.  

- `ReferenceError`
- `TypeError`
- `SyntaxError`
- `RangeError` 등

#### 🔷 2. message

오류가 발생한 이유를 사람이 읽을 수 있는 형태로 설명하는 문자열입니다.  
디버깅과 로깅 시 가장 먼저 참고하는 정보입니다.  

#### 🔷 3. stack(스택 트레이스)

`stack`은 오류가 발생하기까지 어떤 함수가 어떤 순서로 호출되었는지를 기록한 호출 스택(Call Stack) 정보입니다.  
대부분의 JavaScript 실행 환경에서 제공하지만 ECMAScript 표준 속성은 아니므로 출력 형식은 실행 환경마다 다를 수 있습니다.  
스택 트레이스는 일종의 사고 현장 기록과 같으며, 문제가 발생한 정확한 위치와 호출 흐름을 추적하는 데 중요한 단서를 제공합니다.  

### 🟦 예시 코드

아래 코드는 의도적으로 `ReferenceError`를 발생시킨 후 `Error` 객체의 주요 속성을 출력하여 호출 경로를 확인하는 예제입니다.  

```javascript
function thirdFunc() {
  // 정의되지 않은 변수를 참조하여 ReferenceError를 발생시킵니다.
  console.log(nonExistentVariable);
}

function secondFunc() {
  // 세 번째 함수를 호출합니다.
  thirdFunc();
}

function firstFunc() {
  try {
    // 오류가 발생할 가능성이 있는 함수 호출을 try 블록으로 감쌉니다.
    secondFunc();
  } catch (error) {
    console.error("--- 에러 정보 ---");

    // Error 객체의 핵심 속성을 출력합니다.
    console.error("에러 이름 (name):", error.name);
    console.error("에러 메시지 (message):", error.message);
    console.error("\n--- 스택 트레이스 (stack) ---");

    // 에러가 발생한 지점까지의 호출 경로를 보여 줍니다.
    console.error(error.stack);
    /*
     * 출력된 스택 트레이스를 통해
     * firstFunc → secondFunc → thirdFunc 순으로 함수가 호출되었고,
     * 최종적으로 thirdFunc에서 오류가 발생했음을 확인할 수 있습니다.
     */
  }
}

// 전체 호출 흐름을 시작합니다.
firstFunc();
```

## 2. Error.cause (ES2022) {#session-02}

실무 환경에서는 여러 함수 호출과 비동기 작업이 연속적으로 수행되는 과정에서 오류가 발생하는 경우가 흔합니다.  
예를 들어 데이터베이스 조회 과정에서 발생한 오류를 상위 계층의 API 핸들러가 자체 오류 형식으로 다시 포장하여 던져야 할 수 있습니다.  

ES2022에서 도입된 `Error.cause` 속성은 이러한 상황에서 새로운 오류를 생성할 때 원인이 된 최초의 오류를 체계적으로 연결(Chaining)하도록 지원합니다.  
이를 통해 오류를 필요한 형태로 감싸면서도 디버깅에 필요한 원본 오류 정보를 잃지 않고 보존할 수 있습니다.  

### 🟦 Error.cause 특징

- `Error.cause`는 새로운 오류를 생성할 때 원인 오류를 전달할 수 있게 하는 ES2022의 기능입니다.  
- 복잡한 호출 구조의 애플리케이션에서 오류를 다시 감싸더라도 근본 원인을 유지할 수 있습니다.  
- 디버깅, 로깅과 모니터링 시스템을 사용할 때 특히 유용합니다.  

### 🟦 Error.cause를 이용한 에러 연결

```javascript
function callExternalAPI() {
  // 외부 API 호출 시 발생한 에러를 시뮬레이션합니다.
  const connectionError = new Error("Connection Timeout");
  throw new Error("외부 서버 응답 오류 (HTTP 500)", {
    cause: connectionError,
  });
}

function handleUserData() {
  try {
    callExternalAPI();
  } catch (externalError) {
    // (1) 외부 에러를 잡습니다.
    console.error("1차 에러: 외부 API 호출 실패");

    // (2) 상위 계층으로 전달할 새 Error에 원본 에러를 연결합니다.
    throw new Error("사용자 데이터 처리 중 심각한 오류 발생", {
      cause: externalError,
    });
  }
}

try {
  handleUserData();
} catch (finalError) {
  console.error("\n최종 에러 (사용자에게 표시):", finalError.message);

  // (3) cause 속성을 확인하여 에러의 실제 원인을 추적합니다.
  if (finalError.cause) {
    console.error("--- 에러의 실제 원인 추적 ---");
    console.error("원인 객체:", finalError.cause);
    console.error("원인 메시지:", finalError.cause.message);
  }
}
```

## 3. throw와 try/catch 실무 규칙 {#session-03}

에러 처리는 단순히 에러를 잡는 것을 넘어 코드의 안전성과 복구 전략을 결정하는 핵심 요소입니다.  
실무에서는 다음과 같은 빠른 실패(Fail Fast) 원칙과 복구 전략을 상황에 맞게 사용합니다.  

### 🟦 1. throw의 역할: 오류 전파(Propagation)

함수가 정상적인 작업을 더 이상 수행할 수 없을 때 `throw`로 에러를 발생시켜 호출자에게 처리 책임을 넘깁니다.  
잘못된 인수가 전달되거나 데이터베이스 연결에 실패하는 등 현재 함수에서 처리할 수 없는 상황에 사용합니다.  

### 🟦 2. try/catch의 역할: 오류 복구 및 대응

`try/catch`는 오류 발생 시 복구할 수 있는지에 따라 두 가지 방향으로 사용합니다.  

🔹 **복구 가능한 오류 처리**

오류가 발생했지만 대체 로직을 수행하거나 사용자에게 더 이해하기 쉬운 메시지를 전달할 수 있는 경우입니다.  

🔹 **로깅 후 재전파(rethrow)**

함수 내부에서 복구할 수 없는 오류라면 에러를 기록한 후 다시 던져 상위 계층에서 적절히 처리하도록 합니다.  

### 🟦 3. finally의 역할: 정리(Cleanup) 작업

`finally` 블록은 오류 발생 여부와 관계없이 실행되는 영역으로 다음과 같은 정리 작업에 사용합니다.  

- 파일 핸들 닫기
- 데이터베이스 커넥션 반환
- 임시 리소스 해제
- 트랜잭션 종료

리소스 누수를 방지하기 위해 실무에서 중요하게 다루는 블록입니다.  

### 🟦 try/catch/finally 실무 패턴

아래 예제는 파일 처리 과정에서 발생할 수 있는 복구 가능한 오류와 복구 불가능한 오류를 구분하여 처리하는 패턴을 보여 줍니다.  

```javascript
function processFile(filePath) {
  // 파일 리소스를 추적하기 위한 가상의 핸들입니다.
  let fileHandle;

  try {
    // (1) 파일 경로의 유효성을 검사합니다.
    if (!filePath) {
      // 현재 함수에서 처리할 수 없으므로 호출자에게 오류를 전달합니다.
      throw new TypeError("파일 경로를 반드시 지정해야 합니다.");
    }

    // (2) 파일을 엽니다. 이 예제에서는 가상의 핸들로 대체합니다.
    fileHandle = "File_ID_123";
    console.log("파일을 성공적으로 열었습니다.");

    // (3) 파일 처리 로직이 들어가는 영역입니다.
    // ...
  } catch (error) {
    // (4) 에러 유형에 따라 처리 방법을 나눕니다.
    if (error instanceof TypeError) {
      // 예상 가능한 입력 오류는 로깅 후 복구할 수 있습니다.
      console.error(`[로깅] 입력값 오류: ${error.message}`);
      console.log("기본값 또는 대체 경로로 처리할 수 있습니다.");
      return null; // 호출자에게 작업 실패를 명확히 전달합니다.
    }

    // 예상하지 못한 예외는 로깅한 뒤 호출자에게 다시 전달합니다.
    console.error(`[심각한 오류] 알 수 없는 오류 발생: ${error.message}`);
    throw error;
  } finally {
    // (5) 에러 발생 여부와 관계없이 정리 작업을 실행합니다.
    if (fileHandle) {
      console.log("파일 리소스를 정상적으로 닫았습니다. (정리 작업 완료)");
      // fileHandle.close(); // 실제 파일 핸들을 해제하는 코드입니다.
    }
  }
}

// 예시 1: 성공 케이스입니다.
console.log("--- 성공 케이스 ---");
processFile("/data/file.txt");

// 예시 2: 복구 가능한 오류(TypeError)가 발생합니다.
console.log("\n--- 복구 가능한 오류 케이스 ---");
processFile(null);
```

- `throw`는 현재 함수에서 처리할 수 없는 오류를 호출자에게 즉시 전달하는 데 사용합니다.  
- `try/catch`는 오류 상황을 복구하거나 적절히 대응하는 영역입니다.  
- `finally`는 리소스 정리에 필요한 안전장치입니다.  
- 이 세 요소를 적절히 조합하면 안정적이고 예측 가능한 오류 흐름을 갖춘 Node.js 애플리케이션을 구축할 수 있습니다.  

## 4. 비동기 에러 처리 {#session-04}

JavaScript의 비동기 환경(Promise, `async/await`, EventEmitter 등)에서는 동기 코드의 `try/catch`만으로 모든 오류를 처리할 수 없습니다.  
특히 Node.js 환경에는 네트워크, 파일 I/O와 이벤트 스트림 등 다양한 비동기 흐름이 있으므로 비동기 오류 전파 방식을 이해해야 합니다.  
아래에서는 비동기 코드에서 오류가 전파되는 방식과 이를 안전하게 관리하는 기법을 설명합니다.  

### 🟦 Promise: catch에 의한 오류 처리

Promise 체인에서 오류가 발생하면 가장 가까운 `.catch()`로 전달됩니다.  

- `.then()` 내부에서 오류가 발생해도 `.catch()`가 처리합니다.  
- `.catch()`가 없으면 해당 Promise는 처리되지 않은 거부(unhandled rejection) 상태가 됩니다.  
- 브라우저는 `unhandledrejection` 이벤트를, Node.js는 `unhandledRejection` 이벤트를 제공합니다.  

```javascript
// Promise 체인에서 발생한 오류는 가장 가까운 .catch()로 전달됩니다.
function getData() {
  return new Promise((resolve, reject) => {
    // 의도적으로 오류를 발생시킵니다.
    reject(new Error("데이터 가져오기 실패"));
  });
}

getData()
  .then((data) => {
    console.log("데이터:", data);
  })
  .catch((error) => {
    // reject에서 전달된 오류를 여기서 처리합니다.
    console.error("[Promise 오류 처리]", error.message);
  });
```

### 🟦 async/await: 비동기 코드의 동기적 오류 처리

`async/await` 구문은 Promise를 기반으로 동작하며, `await` 표현식에서 발생한 오류는 동기 코드와 마찬가지로 `try/catch`로 처리할 수 있습니다.  

실무에서는 다음 패턴을 사용합니다.  

- 네트워크 요청, 파일 처리와 DB 쿼리 등 오류가 발생할 수 있는 `await`를 현재 함수나 상위 호출자의 `try/catch`에서 처리합니다.  
- `fetch()` 응답처럼 거부되지 않는 실패가 있을 수 있으므로 반환값을 검증합니다.  

이러한 패턴을 통해 오류를 적절한 계층에서 처리하고 안정적인 사용자 경험을 제공할 수 있습니다.  

```javascript
// async/await에서 발생한 오류를 try/catch로 처리합니다.
async function fetchUser() {
  try {
    // await 중 오류가 발생하면 catch 블록으로 이동합니다.
    const response = await fetch("https://invalid-url.example.com");

    // fetch는 HTTP 오류 상태만으로 Promise를 거부하지 않으므로 직접 확인합니다.
    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[async/await 오류 처리]", error.message);
    return null; // 호출자가 실패를 확인할 수 있도록 기본값을 반환합니다.
  }
}

fetchUser();
```

### 🟦 전역 비동기 오류 처리

Promise 거부가 `.catch()`로 처리되지 않거나 코드 전반에서 예외가 누락되면 실행 환경에 따라 다음과 같은 전역 이벤트가 발생합니다.  

브라우저에서는 다음 이벤트를 사용할 수 있습니다.  

- `window.addEventListener("unhandledrejection", handler)`
- `window.addEventListener("error", handler)`

Node.js에서는 다음 이벤트를 사용할 수 있습니다.  

- `process.on("unhandledRejection", handler)`
- `process.on("uncaughtException", handler)`

이 전역 핸들러는 다음 목적으로 사용합니다.  

- 프로덕션 환경에서 누락된 오류를 최종적으로 기록합니다.  
- 모니터링 시스템에 오류를 전송합니다.  
- 필요한 리소스를 정리하고 프로세스를 안전하게 종료합니다.  

전역 핸들러는 정상적인 오류 처리 흐름을 대신하는 복구 수단이 아니라, 처리하지 못한 오류를 기록하고 종료를 준비하는 마지막 안전장치로 사용해야 합니다.  

### 🟦 처리되지 않은 Promise 거부(unhandledRejection)

```javascript
// (1) 전역에서 처리되지 않은 Promise 거부를 감지합니다.
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Node.js 전역 unhandledRejection 감지]");
  console.error("거부된 Promise:", promise);
  console.error("이유(reason):", reason);

  // 실무에서는 로깅 및 모니터링 시스템으로 전송합니다.
  // 예: sendErrorToMonitoringService(reason);

  // 애플리케이션 정책에 따라 안전한 종료를 준비합니다.
  // 예: cleanupResources();
  process.exitCode = 1;
});

// 의도적으로 .catch()를 생략하여 unhandledRejection을 발생시킵니다.
Promise.reject(new Error("전역에서 잡힌 Promise 거부"));
```

### 🟦 처리되지 않은 일반 예외(uncaughtException)

```javascript
// (2) try/catch로 잡히지 않은 오류를 전역에서 감지합니다.
process.on("uncaughtException", (error) => {
  console.error("[Node.js 전역 uncaughtException 감지]");
  console.error("오류 메시지:", error.message);
  console.error("스택:", error.stack);

  // 프로덕션에서는 치명적인 오류로 간주하고 동기 방식으로 정리한 뒤 종료합니다.
  // 예: cleanupResourcesSynchronously();
  process.exitCode = 1;
});

// 존재하지 않는 함수를 호출하여 uncaughtException을 발생시킵니다.
nonExistentFunction();
```

![uncaughtException 실행 결과](/assets/images/nodejs/nodejs-typescript/uncaught-exception-output.png)

## 5. Custom Error 클래스 설계 {#session-05}

애플리케이션의 규모가 커지면 에러를 단순히 `Error`나 `TypeError`로만 처리하기 어렵습니다.  
Custom Error 클래스를 설계하면 에러에 의미 있는 이름을 부여하고 추가 정보를 담을 수 있습니다.  

Custom Error가 내장 오류처럼 동작하게 하려면 JavaScript의 내장 `Error` 클래스를 상속해야 합니다.  
상속하면 대부분의 실행 환경에서 스택 트레이스가 기록되며, `try/catch` 블록에서 `instanceof` 연산자로 특정 에러를 식별하고 대응할 수 있습니다.  

### 🟦 Custom Error 클래스 설계 예시

```javascript
/**
 * Custom Error 클래스는 내장 Error 클래스를 상속합니다.
 */
class AuthenticationError extends Error {
  constructor(message, errorCode = 401) {
    // (1) 부모 생성자를 호출하여 message와 스택 트레이스를 설정합니다.
    super(message);

    // (2) 에러 이름을 고정하여 디버깅할 때 쉽게 식별하도록 합니다.
    this.name = "AuthenticationError";

    // (3) HTTP 상태 코드와 같은 Custom 속성을 추가합니다.
    this.errorCode = errorCode;
  }
}

class DatabaseConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

function checkUser(role) {
  if (role !== "admin") {
    // 특정 Custom Error를 발생시킵니다.
    throw new AuthenticationError(
      `접근 권한이 없습니다. (현재 역할: ${role})`,
    );
  }

  // 정상 로직이 들어가는 영역입니다.
}

try {
  checkUser("guest");
} catch (error) {
  // (4) instanceof로 에러의 타입을 식별하여 분기 처리합니다.
  if (error instanceof AuthenticationError) {
    console.warn(
      `[인증 에러 감지] 로그인 페이지로 이동하도록 안내합니다. (${error.errorCode})`,
    );
  } else if (error instanceof DatabaseConnectionError) {
    console.error("[시스템 에러 감지] 데이터베이스 문제가 발생했습니다.");
  } else {
    // 예상하지 못한 다른 모든 에러를 처리합니다.
    console.error(`[일반 에러] ${error.name}: ${error.message}`);
  }
}
```
