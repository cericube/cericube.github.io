---
layout: post
title: "06. JavaScript 모듈 시스템 이해하기: ESM과 import/export"
description: "JavaScript의 표준 모듈 시스템인 ESM을 중심으로 import와 export 문법, 모듈 해석, 동적 import와 Top-Level await의 기본 사용법을 살펴봅니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "06"
ai_assisted: true
toc:
  - id: session-01
    title: "1. ESM 기본 개념과 import/export 문법"
  - id: session-02
    title: "2. 모듈 로딩과 해석, 동적 import"
  - id: session-03
    title: "3. Top-Level await"
---

## 1. ESM 기본 개념과 import/export 문법 {#session-01}

### 🟦 ESM이란?

ESM은 ECMAScript 2015에서 도입된 JavaScript의 공식 표준 모듈 시스템입니다.  
CommonJS나 AMD처럼 실행 환경이나 라이브러리에서 제공하던 방식과 달리 JavaScript 언어 자체에 정의되어 있습니다.  

ESM의 주요 특징은 다음과 같습니다.  

- **정적 구조**: 정적 `import`와 `export` 선언은 모듈의 최상위 수준에 작성하므로 실행 전에 의존 관계를 분석할 수 있습니다.  
- **명시적인 의존 관계**: 각 모듈이 가져오고 내보내는 값을 코드에서 분명하게 확인할 수 있습니다.  
- **한 번만 평가되는 모듈**: 같은 모듈을 여러 곳에서 가져와도 일반적으로 한 번만 평가되며 같은 모듈 인스턴스를 공유합니다.  
- **자동 strict mode**: 모듈 내부 코드는 자동으로 strict mode로 실행됩니다.  

Node.js에서 `.js` 파일을 ESM으로 실행하려면 가까운 `package.json`에 `"type": "module"`을 지정하며, 별도의 설정 없이 `.mjs` 확장자를 사용할 수도 있습니다.  

ESM은 모듈에서 값을 내보내는 방식에 따라 크게 Named Export와 Default Export 두 가지 문법을 제공합니다.  

### 🟦 기본 문법: export와 import

`export`와 `import`는 모듈 사이의 공개 인터페이스를 정의하는 핵심 문법입니다.  
`export`는 모듈의 변수, 함수, 클래스 등을 외부에 공개하고, `import`는 공개된 값을 현재 모듈에서 사용할 수 있게 합니다.  

| 문법 | 역할 |
| --- | --- |
| `export` | 현재 모듈에 정의된 값을 다른 모듈에서 사용할 수 있도록 공개합니다. |
| `import` | 다른 모듈이 내보낸 값을 현재 모듈로 가져옵니다. |

### 🟦 Named Export와 Import 사용하기

Named Export는 모듈에서 여러 값을 내보낼 때 사용합니다.  
각 값은 고유한 이름을 가지며, 가져올 때 해당 이름을 정확하게 지정해야 합니다.  

```javascript
// math.js - 여러 값을 각각의 이름으로 내보냅니다.
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

// 먼저 선언한 값을 한 번에 내보낼 수도 있습니다.
const E = 2.71828;

function subtract(a, b) {
  return a - b;
}

export { E, subtract };
```

```javascript
// main.js - 내보낼 때 사용한 이름으로 값을 가져옵니다.
import { PI, add, multiply } from "./math.js";
import { subtract as minus } from "./math.js";
import * as MathUtils from "./math.js";

console.log(PI); // 3.14159
console.log(add(5, 3)); // 8
console.log(multiply(4, 2)); // 8

// as를 사용하면 현재 모듈에서 사용할 이름을 바꿀 수 있습니다.
console.log(minus(10, 3)); // 7

// 별표로 가져오면 모듈의 공개 값을 하나의 객체처럼 사용할 수 있습니다.
console.log(MathUtils.PI); // 3.14159
console.log(MathUtils.add(1, 2)); // 3
```

### 🟦 Default Export와 Import 사용하기

Default Export는 모듈마다 하나만 지정할 수 있으며, 해당 모듈을 대표하는 값을 내보낼 때 사용합니다.  
가져오는 쪽에서는 원하는 이름을 지정할 수 있습니다.  

```javascript
// calculator.js - 모듈을 대표하는 클래스를 기본값으로 내보냅니다.
export default class Calculator {
  constructor() {
    this.result = 0;
  }

  add(number) {
    this.result += number;
    return this;
  }

  multiply(number) {
    this.result *= number;
    return this;
  }

  getResult() {
    return this.result;
  }
}

// 함수도 기본값으로 내보낼 수 있습니다.
// export default function calculate(x, y) {
//   return x + y;
// }
```

```javascript
// app.js - Default Export는 원하는 이름으로 가져올 수 있습니다.
import Calculator from "./calculator.js";

const calculator = new Calculator();
const result = calculator.add(10).multiply(2).getResult();

console.log(result); // 20
```

### 🟦 Named Export와 Default Export 함께 사용하기

하나의 모듈에서 대표값은 Default Export로, 부가적인 값은 Named Export로 제공할 수 있습니다.  

```javascript
// user.js - 대표 클래스와 부가 기능을 함께 내보냅니다.
export default class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
}

export const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
  GUEST: "guest",
};

export function validateEmail(email) {
  return email.includes("@");
}
```

```javascript
// main.js - 기본값과 이름이 있는 값을 한 문장에서 가져옵니다.
import User, { USER_ROLES, validateEmail } from "./user.js";

const admin = new User("Alice", "alice@example.com");

console.log(admin.name); // Alice
console.log(USER_ROLES.ADMIN); // admin
console.log(validateEmail("test@email.com")); // true
```

### 🟦 Re-export

Re-export는 다른 모듈의 공개 값을 현재 모듈을 통해 다시 외부에 공개하는 기능입니다.  
여러 모듈을 하나의 진입점으로 묶어 제공할 때 유용합니다.  

```javascript
// shapes/circle.js
export class Circle {
  constructor(radius) {
    this.radius = radius;
  }

  area() {
    return Math.PI * this.radius ** 2;
  }
}

// shapes/rectangle.js
export class Rectangle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  area() {
    return this.width * this.height;
  }
}

// shapes/index.js - 여러 모듈의 공개 값을 한곳에서 다시 내보냅니다.
export { Circle } from "./circle.js";
export { Rectangle } from "./rectangle.js";

// 모든 Named Export를 다시 내보낼 수도 있습니다.
// export * from "./circle.js";
// export * from "./rectangle.js";
```

```javascript
// app.js - 하나의 진입점에서 필요한 값을 가져옵니다.
import { Circle, Rectangle } from "./shapes/index.js";

const circle = new Circle(5);
const rectangle = new Rectangle(4, 6);

console.log(circle.area()); // 78.53981633974483
console.log(rectangle.area()); // 24
```

## 2. 모듈 로딩과 해석, 동적 import {#session-02}

모듈을 가져오는 과정은 단순히 파일을 읽는 것이 아니라 경로 해석(Resolution), 모듈 로딩(Loading), 연결과 평가(Evaluation)의 단계를 거칩니다.  

### 🟦 경로 기반 해석

모듈 지정자(Module Specifier)는 가져올 모듈의 위치나 패키지 이름을 나타냅니다.  
브라우저와 Node.js는 실행 환경의 규칙에 따라 이 지정자를 실제 모듈로 해석합니다.  

#### 🔷 상대 경로

상대 경로는 현재 파일의 위치를 기준으로 다른 모듈을 참조합니다.  
`./`는 현재 디렉터리, `../`는 상위 디렉터리를 나타냅니다.  
브라우저와 Node.js의 ESM에서 로컬 파일을 가져올 때는 파일 확장자를 명시해야 합니다.  

```javascript
import { sum } from "./utils/math.js";
```

#### 🔷 절대 URL

브라우저에서는 완전한 URL을 사용하여 외부 모듈을 가져올 수 있습니다.  
다른 출처의 모듈을 가져올 때는 해당 서버가 CORS 요청을 허용해야 합니다.  

```javascript
// 외부 서버가 모듈 요청을 허용해야 브라우저에서 가져올 수 있습니다.
import { test } from "https://example.com/module.js";
```

Node.js에서는 `file:` URL을 사용하여 로컬 파일 시스템의 절대 경로를 참조할 수 있습니다.  

```javascript
// 로컬 모듈은 확장자를 포함한 정확한 경로로 가져옵니다.
import util from "./util.js";
```

브라우저는 지정된 URL을 그대로 요청하므로 일반적인 로컬 ESM 경로에는 확장자가 필요합니다.  
Node.js도 상대 경로나 절대 경로로 ESM을 가져올 때 파일 확장자를 생략할 수 없습니다.  

### 🟦 Node.js의 모듈 해석과 package.json의 exports

`package.json`의 `exports` 필드는 Node.js에서 패키지의 진입점과 외부에 공개할 하위 경로를 정의하는 방법입니다.  

```json
{
  "exports": {
    // 패키지 자체(mypkg)를 import하면 ./src/index.js를 사용합니다.
    ".": "./src/index.js",

    // mypkg/feature를 import하면 ./src/feature.js를 사용합니다.
    "./feature": "./src/feature.js"
  }
}
```

위 설정에서 `.`은 `mypkg`의 기본 진입점을, `./feature`는 `mypkg/feature`로 가져올 하위 경로를 뜻합니다.  

```javascript
// exports에 공개된 경로를 통해 패키지 모듈을 가져옵니다.
import main from "mypkg";
import feature from "mypkg/feature";
```

이 기능을 사용하면 패키지의 내부 파일 구조를 모두 노출하지 않고 공개 API를 명확하게 관리할 수 있습니다.  

### 🟦 정적 import와 동적 import

`import`는 정적인 선언문과 동적인 `import()` 표현식으로 사용할 수 있습니다.  

| 구분 | 정적 `import` | 동적 `import()` |
| --- | --- | --- |
| 문법 | `import { name } from "./module.js";` | `const module = await import("./module.js");` |
| 특징 | 모듈의 의존 관계를 실행 전에 분석할 수 있습니다. | 실행 중 조건에 따라 모듈을 불러옵니다. |
| 반환값 | 선언문이므로 반환값이 없습니다. | Promise를 반환합니다. |
| 용도 | 항상 필요한 의존성을 가져올 때 사용합니다. | 조건부 로딩이나 코드 분할이 필요할 때 사용합니다. |

### 🟦 동적 import 사용하기

`import()`는 함수처럼 호출하며 Promise를 반환합니다.  
이를 사용하면 실행 중 조건에 따라 필요한 모듈만 비동기적으로 불러올 수 있습니다.  

```javascript
// mode와 data는 앞에서 준비된 값이라고 가정합니다.
let parser;

if (mode === "json") {
  // 필요한 파서 모듈만 불러온 뒤 모듈 객체를 얻습니다.
  parser = await import("./json-parser.js");
} else {
  parser = await import("./xml-parser.js");
}

parser.parse(data);

// 사용자의 언어에 해당하는 메시지 모듈을 필요한 시점에 불러옵니다.
const locale = navigator.language;
const messages = await import(`./i18n/${locale}.js`);
```

### 🟦 모듈 캐싱

모듈은 처음 불러올 때 평가되며, 같은 모듈을 다시 가져오면 일반적으로 같은 모듈 인스턴스를 사용합니다.  
따라서 같은 실행 환경에서 동일한 모듈을 반복해서 `import()`해도 모듈의 최상위 코드는 매번 다시 실행되지 않습니다.  

```javascript
// 같은 경로의 모듈을 두 번 불러와 동일한 모듈 객체인지 확인합니다.
const firstModule = await import("./a.js");
const secondModule = await import("./a.js");

console.log(firstModule === secondModule); // true
```

이 동작을 통해 여러 파일에서 하나의 모듈 상태를 공유할 수 있습니다.  

## 3. Top-Level await {#session-03}

### 🟦 Top-Level await란?

Top-Level `await`는 ESM의 최상위 수준에서 `async` 함수 없이 `await`를 직접 사용할 수 있게 하는 문법입니다.  
이 문법은 애플리케이션을 시작하기 전에 필요한 설정처럼 비동기 모듈 초기화가 끝나야 하는 경우에 사용할 수 있습니다.  
CommonJS 파일에서는 사용할 수 없으며 ESM으로 실행되는 파일에서만 사용할 수 있습니다.  

### 🟦 설정 데이터 불러오기

다음 예제는 모듈을 평가하는 동안 설정 데이터를 불러온 뒤 외부에 공개합니다.  

```javascript
// config-loader.js - 설정을 모두 읽은 뒤 모듈 평가가 완료됩니다.
let config;

try {
  const response = await fetch("/api/config");

  if (!response.ok) {
    throw new Error(`설정 요청 실패: ${response.status}`);
  }

  config = await response.json();
} catch (error) {
  // 설정 요청이 실패해도 모듈을 사용할 수 있도록 기본값을 제공합니다.
  console.error("기본 설정을 사용합니다.", error);
  config = { theme: "light" };
}

export const appConfig = config;
```

```javascript
// main.js는 config-loader.js의 평가가 끝난 뒤 실행됩니다.
import { appConfig } from "./config-loader.js";

console.log("애플리케이션 설정:", appConfig);
```

Top-Level `await`가 끝날 때까지 이 모듈을 가져오는 다른 모듈의 평가도 기다리게 됩니다.  
따라서 여러 모듈의 시작을 불필요하게 지연하지 않도록 초기화에 꼭 필요한 작업에만 사용하는 것이 좋습니다.
