---
layout: post
title: "03. JavaScript 함수: 화살표 함수, this, 콜백, 클로저"
description: "JavaScript의 함수 선언과 호출, 화살표 함수, this 바인딩, 고차 함수와 콜백, 클로저와 메모이제이션의 동작을 예제로 정리합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "03"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 함수 정의와 실행 원리"
  - id: session-02
    title: "2. 화살표 함수"
  - id: session-03
    title: "3. 실행 컨텍스트와 this"
  - id: session-04
    title: "4. 고차 함수, 콜백, 클로저"
---

## 1. 함수 정의와 실행 원리 {#session-01}

함수를 정의하는 대표적인 방식에는 함수 선언문과 함수 표현식이 있습니다.  
두 방식은 함수를 작성하는 형태뿐 아니라 **선언문보다 앞에서 호출할 수 있는지**가 다릅니다.  

### 🟦 함수 선언문과 함수 표현식

#### 🔷 함수 선언문

함수 선언문은 `function` 키워드 뒤에 함수 이름, 매개변수, 함수 본문을 작성합니다.  
JavaScript는 코드를 실행하기 전에 함수 선언의 바인딩과 함수 객체를 준비합니다.  
따라서 **함수 선언문은 선언된 위치보다 앞에서도 호출**할 수 있습니다.  
선언문이 실제로 코드 위로 이동하는 것은 아니며, 실행 전에 선언이 처리되기 때문에 위로 올라간 것처럼 보입니다.  

```javascript
// 함수 선언문으로 greet 함수를 정의합니다.
function greet(name) {
  return `안녕하세요, ${name}님!`;
}

console.log(greet("민수")); // 출력: 안녕하세요, 민수님!

// 함수 선언문은 실행 전에 초기화되므로 선언보다 앞에서 호출할 수 있습니다.
console.log(sayHello("철수")); // 출력: Hello, 철수!

function sayHello(name) {
  return `Hello, ${name}!`;
}
```

#### 🔷 함수 표현식

함수 표현식은 **함수를 하나의 값으로 만들어 변수에 할당**합니다.  
아래 예제의 `const sayHi` 바인딩은 실행 전에 생성되지만 선언문에서 초기화되기 전까지 TDZ에 있습니다.  
따라서 선언보다 앞에서 `sayHi`에 접근하면 `ReferenceError`가 발생합니다.  

> 스코프가 시작된 지점부터 선언문에서 초기화되기 전까지의 구간을 일시적 사각지대(Temporal Dead Zone, TDZ)


```javascript
// 익명 함수 표현식을 greet 변수에 할당합니다.
const greet = function (name) {
  return `안녕하세요, ${name}님!`;
};

console.log(greet("민수")); // 출력: 안녕하세요, 민수님!

// sayHi는 아직 TDZ에 있으므로 선언 전에 호출하면 ReferenceError가 발생합니다.
// console.log(sayHi("영희"));

const sayHi = function (name) {
  return `Hi, ${name}!`;
};

console.log(sayHi("영희")); // 출력: Hi, 영희!
```

### 🟦 매개변수와 인자

매개변수(Parameter)는 함수 정의에 작성한 이름이고, 인자(Argument)는 함수를 호출할 때 전달하는 실제 값입니다.  
JavaScript는 매개변수와 인자의 개수가 달라도 호출 자체에서 오류를 발생시키지 않습니다.  
인자가 부족하면 대응하는 매개변수는 `undefined`가 되고, 남는 인자는 일반 함수의 `arguments` 객체나 나머지 매개변수로 읽을 수 있습니다.  
화살표 함수는 자체 `arguments`를 만들지 않으므로 나머지 매개변수를 사용해야 합니다.  

#### 🔷 기본 매개변수

기본 매개변수는 **전달된 인자가 없거나 명시적으로 `undefined`일 때** 기본값을 사용합니다.  
`null`, `0`, 빈 문자열, `false`는 전달된 값으로 취급하므로 기본값으로 바뀌지 않습니다.  

```javascript
function createUser(name, age = 20, role = "user") {
  // 프로퍼티 축약으로 매개변수와 같은 이름의 키를 만듭니다.
  return { name, age, role };
}

// age와 role을 생략했으므로 기본값을 사용합니다.
console.log(createUser("김철수"));
// 출력: { name: '김철수', age: 20, role: 'user' }

// 세 인자를 모두 전달했으므로 전달한 값을 사용합니다.
console.log(createUser("이영희", 25, "admin"));
// 출력: { name: '이영희', age: 25, role: 'admin' }
```

#### 🔷 나머지 매개변수

나머지 매개변수 `...name`은 **앞의 매개변수에 대응하고 남은 인자를 새 배열로 모읍니다**.  
나머지 매개변수는 매개변수 목록의 마지막에 하나만 작성할 수 있습니다.  

```javascript
function sum(...numbers) {
  // numbers는 전달된 모든 인자를 담은 실제 배열입니다.
  return numbers.reduce((total, number) => total + number, 0);
}

console.log(sum(1, 2, 3, 4, 5)); // 출력: 15
console.log(sum(10, 20)); // 출력: 30
```

#### 🔷 구조 분해 매개변수

객체를 받는 매개변수에 구조 분해 패턴을 작성하면 필요한 프로퍼티를 바로 변수로 꺼낼 수 있습니다.  
어떤 프로퍼티를 사용하는지 함수 정의에서 확인할 수 있다는 장점이 있습니다.  
다만 인자 자체가 `undefined`나 `null`이면 구조 분해할 수 없으므로 필요하다면 매개변수 전체의 기본값도 지정해야 합니다.  

```javascript
function displayUser({ name, age, email = "미등록" }) {
  // email이 없거나 undefined이면 미등록을 사용합니다.
  console.log(`이름: ${name}, 나이: ${age}, 이메일: ${email}`);
}

displayUser({ name: "박민수", age: 30 });
// 출력: 이름: 박민수, 나이: 30, 이메일: 미등록
```

### 🟦 반환과 함수 종료

`return`은 **함수 실행을 즉시 끝내고 지정한 값을 호출한 위치로 돌려줍니다**.  
`return` 뒤의 코드는 실행되지 않습니다.  
함수가 끝날 때까지 `return`을 만나지 않거나 값 없이 `return`하면 `undefined`를 반환합니다.  

```javascript
function multiply(a, b) {
  // 계산 결과를 반환하는 순간 함수 실행이 끝납니다.
  return a * b;

  // return 이후이므로 도달할 수 없는 코드입니다.
  // console.log("이 코드는 실행되지 않습니다.");
}

console.log(multiply(3, 4)); // 출력: 12
```

#### 🔷 조기 반환

조기 반환(Early Return)은 **함수 시작 부분에서 잘못된 입력이나 예외 조건을 먼저 확인하고 즉시 함수를 끝내는 패턴**입니다.  
오류 조건을 먼저 제거하면 정상 처리 로직의 중첩을 줄일 수 있습니다.  

```javascript
function processPayment(amount, balance) {
  // 1. 결제 금액이 유효하지 않으면 즉시 실패 결과를 반환합니다.
  if (amount <= 0) {
    return { success: false, error: "잘못된 금액" };
  }

  // 2. 잔액이 부족하면 정상 처리로 진행하지 않습니다.
  if (balance < amount) {
    return { success: false, error: "잔액 부족" };
  }

  // 3. 두 오류 조건을 통과한 경우에만 결제를 처리합니다.
  const newBalance = balance - amount;
  return { success: true, newBalance };
}

console.log(processPayment(3000, 10000));
// 출력: { success: true, newBalance: 7000 }
```

## 2. 화살표 함수 {#session-02}

화살표 함수는 ECMAScript 2015에서 도입된 함수 표현식 문법입니다.  
짧은 콜백을 간결하게 작성할 수 있지만 일반 함수와 `this`, `arguments`, 생성자 사용 여부가 다릅니다.  

### 🟦 기본 문법과 암시적 반환

화살표 함수는 매개변수 뒤에 `=>`를 작성합니다.  
본문이 하나의 표현식이면 중괄호와 `return`을 생략할 수 있으며 그 표현식의 결과를 반환합니다.  
중괄호를 사용하면 명시적으로 `return`을 작성해야 값을 반환합니다.  

| 형태 | 예제 | 동작 |
| --- | --- | --- |
| 기본 | `(a, b) => { return a + b; }` | 중괄호 안에서 명시적으로 반환 |
| 암시적 반환 | `(a, b) => a + b` | 표현식의 결과를 반환 |
| 매개변수 하나 | `value => value * value` | 매개변수 괄호 생략 가능 |
| 매개변수 없음 | `() => Math.random()` | 빈 괄호 필수 |
| 객체 반환 | `(name, age) => ({ name, age })` | 객체 리터럴을 소괄호로 감쌈 |

```javascript
// 1. 중괄호를 사용하면 return을 명시합니다.
const add = (a, b) => {
  const result = a + b + 10;
  return result;
};
console.log(`add(5, 3): ${add(5, 3)}`); // 출력: add(5, 3): 18

// 2. 표현식 하나는 계산 결과를 암시적으로 반환합니다.
const addSimple = (a, b) => a + b;
console.log(`addSimple(10, 5): ${addSimple(10, 5)}`); // 출력: 15

// 3. 매개변수가 하나이면 괄호를 생략할 수 있습니다.
const square = (value) => value * value;
console.log(`square(7): ${square(7)}`); // 출력: 49

// 4. 매개변수가 없으면 빈 괄호를 작성합니다.
const getRandomNumber = () => Math.floor(Math.random() * 100);
console.log(`0 이상 100 미만의 난수: ${getRandomNumber()}`);

// 5. 객체를 암시적으로 반환하려면 객체 리터럴을 소괄호로 감쌉니다.
const createPerson = (name, age) => ({ name, age: age + 1 });
console.log(createPerson("홍길동", 25));
// 출력: { name: '홍길동', age: 26 }

// 6. 여러 문장을 실행할 때는 중괄호와 return을 사용합니다.
const createPersonExplicitly = (name, age) => {
  const nextAge = age + 1;
  return {
    name,
    age: nextAge,
  };
};
console.log(createPersonExplicitly("홍길동", 25));
```

### 🟦 배열 고차 함수의 콜백

화살표 함수는 `map()`처럼 콜백을 받는 메서드에서 반복 동작을 짧게 표현할 수 있습니다.  
`map()`은 **각 요소에 콜백을 한 번씩 호출하고 반환값을 모아 같은 길이의 새 배열을 만듭니다**.  
원본 배열은 `map()` 자체로 변경되지 않습니다.  

```javascript
const numbers = [1, 2, 3, 4, 5];

// 일반 함수 표현식을 콜백으로 전달합니다.
const doubledWithFunction = numbers.map(function (number) {
  return number * 2;
});
console.log(doubledWithFunction); // 출력: [2, 4, 6, 8, 10]

// 화살표 함수의 암시적 반환으로 같은 동작을 간결하게 작성합니다.
const doubledWithArrow = numbers.map((number) => number * 2);
console.log(doubledWithArrow); // 출력: [2, 4, 6, 8, 10]
```

### 🟦 화살표 함수의 렉시컬 `this`

일반 함수의 `this`는 **함수가 호출된 방식에 따라 결정**됩니다.  
반면 화살표 함수는 자체 `this` 바인딩을 만들지 않고 **정의된 위치의 바깥 `this`를 그대로 사용**합니다.  
이를 렉시컬 `this`라고 합니다.  

화살표 함수는 `new`와 함께 생성자로 호출할 수 없으며 자체 `arguments` 객체도 만들지 않습니다.  
전달된 인자를 배열로 모아야 한다면 나머지 매개변수를 사용합니다.  

#### 🔷 일반 함수 콜백에서 `this`가 달라지는 예

`forEach()`에 일반 함수를 콜백으로 전달하면 그 함수의 `this`는 `person` 메서드의 `this`를 자동으로 이어받지 않습니다.  
엄격 모드에서는 `undefined`이고 비엄격 모드에서는 전역 객체가 될 수 있으므로 `person.name`에 접근할 수 없습니다.  

```javascript
"use strict";

const person = {
  name: "김철수",
  hobbies: ["독서", "운동", "음악"],

  printHobbies: function () {
    this.hobbies.forEach(function (hobby) {
      // 일반 함수 콜백은 바깥 메서드의 this를 이어받지 않습니다.
      // 엄격 모드에서 this는 undefined이므로 this.name 접근 시 TypeError가 발생합니다.
      console.log(`${this.name}는 ${hobby}를 좋아합니다.`);
    });
  },
};

// 오류 동작을 설명하기 위한 예제이므로 호출하지 않습니다.
// person.printHobbies();
```

#### 🔷 화살표 함수로 바깥 `this` 사용

화살표 함수 콜백은 `printHobbies()`가 호출될 때 결정된 `this`를 그대로 사용합니다.  
따라서 `person.printHobbies()`로 호출하면 콜백 안의 `this`도 `person`을 가리킵니다.  

```javascript
const person = {
  name: "이영희",
  hobbies: ["그림", "여행", "요리"],

  printHobbies: function () {
    this.hobbies.forEach((hobby) => {
      // 화살표 함수는 printHobbies 메서드의 this를 사용합니다.
      console.log(`${this.name}는 ${hobby}를 좋아합니다.`);
    });
  },
};

person.printHobbies();
// 출력: 이영희는 그림을 좋아합니다.
// 출력: 이영희는 여행을 좋아합니다.
// 출력: 이영희는 요리를 좋아합니다.
```

#### 🔷 타이머 콜백에서 활용

타이머에 일반 함수를 전달하면 콜백의 `this`는 `timer` 객체로 자동 연결되지 않습니다.  
화살표 함수로 전달하면 `startWithArrow()` 메서드의 `this`를 사용하여 `seconds`에 접근할 수 있습니다.  
실제 반복 타이머는 더 이상 필요하지 않을 때 `clearInterval()`로 해제해야 합니다.  

```javascript
const timer = {
  seconds: 10,

  start: function () {
    setInterval(function () {
      // 이 일반 함수의 this는 timer 객체가 아닙니다.
      // 실행 환경에 따라 전역 객체, undefined 또는 타이머 객체가 될 수 있습니다.
      console.log(this);
    }, 1000);
  },

  startWithArrow: function () {
    const intervalId = setInterval(() => {
      // 화살표 함수는 startWithArrow의 this를 사용합니다.
      this.seconds -= 1;
      console.log(this.seconds);

      if (this.seconds === 0) {
        clearInterval(intervalId);
      }
    }, 1000);
  },
};

// 필요할 때 다음과 같이 실행합니다.
// timer.startWithArrow();
```

### 🟦 배열 데이터 처리

`filter()`는 콜백이 Truthy를 반환한 요소만 새 배열에 담고, `map()`은 각 요소의 반환값으로 새 배열을 만듭니다.  
`reduce()`는 왼쪽부터 요소를 처리하면서 누적값을 갱신하고 마지막 누적값 하나를 반환합니다.  

```javascript
const products = [
  { name: "노트북", price: 1200000, category: "전자제품" },
  { name: "마우스", price: 30000, category: "전자제품" },
  { name: "키보드", price: 80000, category: "전자제품" },
  { name: "의자", price: 150000, category: "가구" },
];

// filter는 category가 전자제품인 상품만 선택합니다.
const electronics = products.filter(
  (product) => product.category === "전자제품",
);

// map은 각 상품 객체를 상품명 문자열로 변환합니다.
const productNames = products.map((product) => product.name);

// reduce는 0부터 시작하여 모든 상품 가격을 누적합니다.
const totalPrice = products.reduce(
  (sum, product) => sum + product.price,
  0,
);

console.log(electronics.length); // 출력: 3
console.log(productNames); // 출력: ['노트북', '마우스', '키보드', '의자']
console.log(totalPrice); // 출력: 1460000
```

메서드 체이닝은 앞 메서드의 반환값에서 다음 메서드를 연속으로 호출하는 방식입니다.  
각 단계가 어떤 배열을 반환하는지 순서대로 읽으면 데이터 처리 흐름을 파악하기 쉽습니다.  

```javascript
const result = products
  // 1. 가격이 100000원 미만인 상품만 새 배열에 담습니다.
  .filter((product) => product.price < 100000)
  // 2. 원본 객체를 펼치고 10% 할인 가격을 추가한 새 객체를 만듭니다.
  .map((product) => ({
    ...product,
    discountPrice: product.price * 0.9,
  }))
  // 3. map이 만든 새 배열을 할인 가격의 오름차순으로 정렬합니다.
  .sort((a, b) => a.discountPrice - b.discountPrice);

console.log(result);
```

`reduce()`의 누적값으로 객체를 사용하면 요소를 특정 키별로 그룹화할 수 있습니다.  
아래 예제는 학점별 배열이 없으면 먼저 만들고 현재 학생을 해당 배열에 추가합니다.  

```javascript
const students = [
  { name: "김철수", grade: "A", score: 95 },
  { name: "이영희", grade: "B", score: 85 },
  { name: "박민수", grade: "A", score: 92 },
  { name: "정수진", grade: "C", score: 78 },
];

const groupedByGrade = students.reduce((groups, student) => {
  const { grade } = student;

  // 현재 학점의 배열이 없으면 빈 배열을 먼저 만듭니다.
  if (!groups[grade]) {
    groups[grade] = [];
  }

  // 현재 학생을 해당 학점 배열에 추가합니다.
  groups[grade].push(student);
  return groups;
}, {});

console.log(groupedByGrade);
```

## 3. 실행 컨텍스트와 this {#session-03}

`this`는 함수 실행 중에 사용할 수 있는 특별한 값입니다.  
일반 함수의 `this`는 함수가 정의된 위치가 아니라 **어떻게 호출되었는지**에 따라 결정됩니다.  
화살표 함수는 이 규칙으로 새 `this`를 만들지 않고 바깥 렉시컬 환경의 `this`를 사용합니다.  

### 🟦 실행 환경에 따른 `this`

최상위 `this`는 실행 환경과 스크립트 종류에 따라 다릅니다.  
브라우저의 일반 스크립트 최상위에서는 `window`이지만 ES 모듈 최상위에서는 `undefined`입니다.  
Node.js CommonJS 모듈 최상위에서는 `module.exports`이고 ES 모듈 최상위에서는 `undefined`입니다.  
따라서 Node.js 최상위 `this`가 항상 `globalThis`를 가리킨다고 가정하면 안 됩니다.  

```javascript
// 실행 환경과 모듈 형식에 따라 최상위 this 결과가 달라집니다.
console.log(this);

function showThis() {
  // 일반 함수 호출은 엄격 모드에서 undefined입니다.
  // 비엄격 모드에서는 전역 객체가 될 수 있습니다.
  console.log(this);
}
showThis();

const object = {
  name: "객체",
  showThis: function () {
    // object.showThis()로 호출했으므로 this는 object입니다.
    console.log(this);
  },
};
object.showThis();
```

### 🟦 `this` 바인딩 규칙

일반 함수 호출에서 `this`를 결정하는 대표 규칙은 다음과 같습니다.  
충돌할 때는 대체로 **`new` 바인딩 → 명시적 바인딩 → 암시적 바인딩 → 기본 바인딩** 순으로 적용됩니다.  
단, 화살표 함수의 렉시컬 `this`와 `bind()`로 만든 함수의 생성자 호출처럼 별도로 이해해야 할 세부 규칙도 있습니다.  

- `new` 바인딩은 생성자 호출로 만든 새 객체를 `this`로 사용합니다.  
- 명시적 바인딩은 `call()`, `apply()`, `bind()`로 `this`를 지정합니다.  
- 암시적 바인딩은 `object.method()`에서 점 앞의 객체를 `this`로 사용합니다.  
- 기본 바인딩은 독립적인 일반 함수 호출에 적용되며 엄격 모드에서는 `undefined`입니다.  

### 🟦 암시적 바인딩과 손실

객체의 프로퍼티로 함수를 호출하면 **호출 표현식의 점 앞에 있는 객체가 `this`**가 됩니다.  

```javascript
const user = {
  name: "홍길동",
  age: 30,

  introduce: function () {
    // user.introduce()로 호출했으므로 this는 user입니다.
    console.log(`제 이름은 ${this.name}이고, ${this.age}살입니다.`);
  },

  getInfo: function () {
    return {
      name: this.name,
      age: this.age,
      isAdult: this.age >= 18,
    };
  },
};

user.introduce(); // 출력: 제 이름은 홍길동이고, 30살입니다.
console.log(user.getInfo());
```

메서드를 변수에 따로 저장한 뒤 호출하면 호출 표현식에서 객체가 사라집니다.  
이 경우 암시적 바인딩을 잃고 독립적인 일반 함수 호출 규칙이 적용됩니다.  

```javascript
"use strict";

const user = {
  name: "김철수",
  greet: function () {
    console.log(`안녕하세요, ${this.name}입니다.`);
  },
};

user.greet(); // 출력: 안녕하세요, 김철수입니다.

// 함수 값만 변수로 가져오면 user와의 호출 관계가 사라집니다.
const greetFunction = user.greet;

// 엄격 모드의 일반 함수 호출에서 this는 undefined이므로 TypeError가 발생합니다.
// greetFunction();
```

타이머에 `button.click`만 전달해도 메서드가 객체에서 분리됩니다.  
화살표 함수 안에서 `button.click()`을 직접 호출하면 점 앞의 `button`을 통해 암시적 바인딩이 다시 적용됩니다.  

```javascript
const button = {
  content: "클릭하세요",

  click: function () {
    console.log(`${this.content}가 클릭되었습니다.`);
  },
};

button.click(); // 출력: 클릭하세요가 클릭되었습니다.

// 메서드만 전달하면 button과의 호출 관계가 사라집니다.
// setTimeout(button.click, 1000);

// 콜백이 실행될 때 button.click() 형태로 호출합니다.
setTimeout(() => button.click(), 1000);
```

### 🟦 명시적 바인딩

`call()`, `apply()`, `bind()`는 일반 함수에서 사용할 `this`를 직접 지정합니다.  
`call()`과 `apply()`는 함수를 즉시 실행하고, `bind()`는 나중에 호출할 새 함수를 반환합니다.  

#### 🔷 `call()`

`call(thisValue, arg1, arg2, ...)`은 첫 번째 인자를 `this`로 사용하고 나머지 인자를 함수에 개별적으로 전달합니다.  

```javascript
function introduce(greeting, punctuation) {
  console.log(`${greeting}, 저는 ${this.name}입니다${punctuation}`);
}

const person1 = { name: "김철수" };
const person2 = { name: "이영희" };

introduce.call(person1, "안녕하세요", "!");
// 출력: 안녕하세요, 저는 김철수입니다!

introduce.call(person2, "반갑습니다", ".");
// 출력: 반갑습니다, 저는 이영희입니다.
```

#### 🔷 `apply()`

`apply(thisValue, argsArray)`는 `call()`처럼 함수를 즉시 실행하지만 인자를 배열이나 배열과 유사한 객체로 전달합니다.  
현대 코드에서 배열 요소를 개별 인자로 펼칠 때는 Spread 문법도 자주 사용합니다.  

```javascript
function sum(a, b, c) {
  console.log(`${this.name}의 합계: ${a + b + c}`);
}

const calculator = { name: "계산기" };
sum.apply(calculator, [10, 20, 30]); // 출력: 계산기의 합계: 60

const numbers = [5, 10, 15, 3, 8];

// Math.max는 this를 사용하지 않으므로 첫 번째 인자에 null을 전달합니다.
const maxWithApply = Math.max.apply(null, numbers);
console.log(maxWithApply); // 출력: 15

// Spread를 사용하면 같은 결과를 더 직접적으로 표현할 수 있습니다.
const maxWithSpread = Math.max(...numbers);
console.log(maxWithSpread); // 출력: 15
```

#### 🔷 `bind()`

`bind(thisValue, ...args)`는 지정한 `this`와 일부 인자를 기억하는 새 함수를 반환합니다.  
새 함수의 일반 호출에서는 지정한 `this`를 사용하지만 `new`로 생성자 호출하면 새 인스턴스가 `this`가 됩니다.  

```javascript
"use strict";

const moduleObject = {
  x: 42,
  getX: function () {
    return this.x;
  },
};

const unboundGetX = moduleObject.getX;

// 독립 호출에서는 this가 undefined이므로 오류가 발생합니다.
// console.log(unboundGetX());

// moduleObject를 this로 지정한 새 함수를 만듭니다.
const boundGetX = moduleObject.getX.bind(moduleObject);
console.log(boundGetX()); // 출력: 42
```

이벤트 리스너에 메서드를 넘길 때도 `bind()` 또는 화살표 함수로 인스턴스의 `this`를 유지할 수 있습니다.  
리스너를 나중에 제거해야 한다면 `bind()` 결과를 별도 프로퍼티에 저장하여 같은 함수 참조를 사용해야 합니다.  

```javascript
class Counter {
  constructor(button) {
    this.count = 0;
    this.button = button;

    // bind 결과를 저장해야 removeEventListener에서도 같은 참조를 사용할 수 있습니다.
    this.boundIncrement = this.increment.bind(this);
    this.button.addEventListener("click", this.boundIncrement);
  }

  increment() {
    this.count += 1;
    console.log(`현재 카운트: ${this.count}`);
  }

  destroy() {
    this.button.removeEventListener("click", this.boundIncrement);
  }
}

class CounterWithArrow {
  constructor(button) {
    this.count = 0;
    this.button = button;

    // 화살표 콜백은 constructor의 this를 사용합니다.
    this.button.addEventListener("click", () => {
      this.count += 1;
      console.log(`현재 카운트: ${this.count}`);
    });
  }
}
```

## 4. 고차 함수, 콜백, 클로저 {#session-04}

고차 함수(Higher-Order Function)는 **함수를 인자로 받거나 함수를 반환하는 함수**입니다.  
다른 함수에 인자로 전달되어 특정 시점이나 조건에서 실행되는 함수를 콜백 함수라고 합니다.  
콜백은 반드시 비동기인 것은 아니며 배열 메서드처럼 즉시 실행되는 동기 콜백도 있습니다.  

### 🟦 동기 콜백

다음 `processArray()`는 배열을 순회하는 방법은 직접 담당하고, 각 요소를 어떻게 바꿀지는 콜백에 맡깁니다.  

```javascript
function processArray(array, callback) {
  const result = [];

  for (let index = 0; index < array.length; index += 1) {
    // 현재 요소의 변환 규칙을 callback에 위임합니다.
    result.push(callback(array[index]));
  }

  return result;
}

const numbers = [1, 2, 3, 4, 5];

const doubled = processArray(numbers, (number) => number * 2);
console.log(doubled); // 출력: [2, 4, 6, 8, 10]

const squared = processArray(numbers, (number) => number * number);
console.log(squared); // 출력: [1, 4, 9, 16, 25]
```

### 🟦 비동기 콜백

비동기 API는 작업이 끝난 뒤 호출할 함수를 인자로 받을 수 있습니다.  
아래 예제에서는 `setTimeout()`이 타이머를 등록한 뒤 즉시 반환하고, 약 1초가 지나면 콜백을 실행합니다.  

```javascript
function fetchUserData(userId, callback) {
  // 약 1초 후 데이터를 만들고 결과 콜백을 호출합니다.
  setTimeout(() => {
    const user = {
      id: userId,
      name: "홍길동",
      email: "hong@example.com",
    };

    callback(user);
  }, 1000);
}

fetchUserData(123, (user) => {
  console.log("사용자 정보:", user);
});
```

#### 🔷 에러 우선 콜백

Node.js의 전통적인 에러 우선 콜백은 첫 번째 인자에 오류를, 두 번째 이후 인자에 성공 결과를 전달합니다.  
성공하면 첫 번째 인자에 보통 `null`을 전달하고, 실패하면 `Error` 객체를 전달한 뒤 성공 결과는 생략합니다.  

```javascript
function readFileExample(filename, callback) {
  setTimeout(() => {
    if (!filename) {
      // 실패 시 Error 객체를 첫 번째 인자로 전달합니다.
      callback(new Error("파일 이름이 필요합니다."));
      return;
    }

    const data = "파일 내용입니다.";

    // 성공 시 첫 번째 인자는 null, 두 번째 인자는 결과입니다.
    callback(null, data);
  }, 1000);
}

readFileExample("data.txt", (error, data) => {
  // 오류를 먼저 검사하여 성공 데이터에 접근하기 전에 함수를 끝냅니다.
  if (error) {
    console.error("에러 발생:", error.message);
    return;
  }

  console.log("데이터:", data);
});
```

### 🟦 함수를 반환하는 고차 함수

고차 함수는 설정값을 받아 그 값을 사용하는 새 함수를 만들 수 있습니다.  
반환된 함수가 바깥 함수의 매개변수를 계속 참조하는 동작은 클로저를 통해 가능합니다.  

```javascript
function createMultiplier(multiplier) {
  // 반환된 함수는 자신이 만들어진 호출의 multiplier를 참조합니다.
  return function (number) {
    return number * multiplier;
  };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

console.log(double(5)); // 출력: 10
console.log(triple(5)); // 출력: 15
```

### 🟦 클로저

클로저(Closure)는 **함수와 그 함수가 선언된 렉시컬 환경의 조합**입니다.  
함수는 호출된 위치가 아니라 선언된 위치를 기준으로 바깥 변수에 접근합니다.  
바깥 함수가 반환된 뒤에도 안쪽 함수가 바깥 변수를 참조하고 있다면 해당 렉시컬 환경은 계속 접근 가능한 상태로 유지됩니다.  

```javascript
function outer() {
  const outerValue = "외부 변수입니다.";

  function inner() {
    // inner는 선언된 위치의 outerValue를 참조합니다.
    console.log(outerValue);
  }

  return inner;
}

let closureFunction = outer();

// outer 호출은 끝났지만 반환된 함수가 outerValue에 계속 접근합니다.
closureFunction(); // 출력: 외부 변수입니다.

// 참조를 제거하면 함수와 렉시컬 환경이 더 이상 필요하지 않을 때 GC 대상이 됩니다.
closureFunction = null;
```

변수에 `null`을 넣었다고 메모리가 즉시 해제되는 것은 아닙니다.  
클로저와 렉시컬 환경을 가리키는 참조가 모두 사라지면 가비지 컬렉터가 이후 적절한 시점에 회수할 수 있는 대상이 됩니다.  

```javascript
function runApp() {
  const closureFunction = outer();
  closureFunction();

  // runApp이 끝나고 다른 참조가 없다면 지역 변수의 참조도 사라집니다.
}

runApp();
// 실제 메모리 회수 시점은 JavaScript 엔진이 결정합니다.
```

오래 유지되는 스코프에 클로저 참조를 저장했다면 더 이상 필요하지 않을 때 명시적으로 참조를 제거할 수 있습니다.  

```javascript
let savedClosure = outer();

savedClosure();

// 다른 참조가 없다면 이후 가비지 컬렉션 대상이 될 수 있습니다.
savedClosure = null;
```

### 🟦 클로저를 이용한 메모이제이션

메모이제이션(Memoization)은 **이전에 계산한 입력의 결과를 저장하고 같은 입력이 들어오면 계산 대신 저장된 값을 반환하는 기법**입니다.  
계산 비용이 크고 같은 입력에 항상 같은 결과를 내는 순수 함수에 적합합니다.  

원문의 `if (cache[key])` 조건은 저장된 결과가 `0`, `false`, 빈 문자열이면 캐시가 없는 것으로 잘못 판단합니다.  
아래 예제는 `Map.has()`로 키의 존재 여부를 직접 확인하여 Falsy 결과도 올바르게 캐시합니다.  

```javascript
function memoize(fn) {
  // cache는 반환되는 함수만 접근할 수 있는 클로저 상태입니다.
  const cache = new Map();

  return function (...args) {
    // 학습용 예제로 인자 배열을 JSON 문자열 키로 변환합니다.
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      console.log("캐시에서 반환");
      return cache.get(key);
    }

    console.log("새로 계산");
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalculation = memoize((limit) => {
  let sum = 0;

  for (let number = 0; number < limit; number += 1) {
    sum += number;
  }

  return sum;
});

console.log(expensiveCalculation(1000000)); // 처음에는 새로 계산합니다.
console.log(expensiveCalculation(1000000)); // 두 번째에는 캐시에서 반환합니다.
```

`JSON.stringify(args)`는 간단한 직렬화 가능 인자를 설명하기 위한 방식입니다.  
함수, `undefined`, `Symbol`, 순환 참조, 객체 키 순서가 다른 값 등을 일반적으로 안전하게 구분하는 캐시 키는 아니므로 실제 요구사항에 맞는 키 생성 전략이 필요합니다.  

메모이제이션 함수의 핵심 흐름만 떼어 보면 다음과 같습니다.  

```javascript
const key = JSON.stringify(args);

if (cache.has(key)) {
  // 캐시 히트: 같은 키로 저장한 결과를 즉시 반환합니다.
  return cache.get(key);
}

// 캐시 미스: 원래 함수를 실행하고 결과를 저장합니다.
const result = fn(...args);
cache.set(key, result);
return result;
```

### 🟦 클래스로 캐시 관리

캐시를 클래스 인스턴스의 상태로 두면 조회, 초기화, 크기 제한 같은 관리 기능을 메서드로 묶을 수 있습니다.  
클로저와 클래스 중 어느 쪽이 항상 더 빠른 것은 아니며, 상태 공개 범위와 API 구조에 맞는 방식을 선택해야 합니다.  

```javascript
class Memoizer {
  constructor(fn) {
    this.fn = fn;
    this.cache = new Map();
  }

  calculate(...args) {
    const key = JSON.stringify(args);

    if (this.cache.has(key)) {
      console.log("캐시에서 반환 (Class)");
      return this.cache.get(key);
    }

    console.log("새로 계산 (Class)");
    const result = this.fn(...args);
    this.cache.set(key, result);
    return result;
  }

  clearCache() {
    // Map의 모든 캐시 항목을 제거합니다.
    this.cache.clear();
  }
}

const heavyFunction = (limit) => {
  let sum = 0;

  for (let number = 0; number < limit; number += 1) {
    sum += number;
  }

  return sum;
};

const calculator = new Memoizer(heavyFunction);
console.log(calculator.calculate(1000));
console.log(calculator.calculate(1000)); // 같은 입력이므로 캐시를 사용합니다.
```
