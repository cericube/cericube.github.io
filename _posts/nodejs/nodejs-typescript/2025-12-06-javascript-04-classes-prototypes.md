---
layout: post
title: "04. JavaScript 클래스와 프로토타입 이해하기"
description: "JavaScript 클래스가 프로토타입을 통해 메서드를 공유하는 원리를 살펴보고, 캡슐화, static 멤버, 상속과 믹스인까지 예제로 익힙니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: javascript
series_order: "04"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 클래스와 인스턴스"
  - id: session-02
    title: "2. 프로토타입과 프로토타입 체인"
  - id: session-03
    title: "3. 캡슐화: private 필드와 접근자"
  - id: session-04
    title: "4. static 멤버와 객체 생성 패턴"
  - id: session-05
    title: "5. 상속과 믹스인"
---

## 1. 클래스와 인스턴스 {#session-01}

클래스는 인스턴스가 가질 초기 상태와 동작을 한곳에 정의합니다.  
`new ClassName()`을 호출하면 새 객체를 만든 뒤 `constructor()`를 실행하여 전달받은 값으로 상태를 초기화합니다.  
클래스를 통해 실제로 만들어진 객체를 인스턴스라고 합니다.  

### 🟦 클래스 정의와 인스턴스 생성

`constructor()` 안에서 `this.name = name`처럼 값을 할당하면 각 인스턴스가 자신의 프로퍼티를 갖습니다.  
같은 클래스로 만든 인스턴스라도 각각 별도의 객체이므로 서로 다른 값을 저장할 수 있습니다.  

```javascript
class Person {
  // new Person()에 전달된 값으로 새 인스턴스를 초기화합니다.
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
}

// 같은 클래스로 서로 다른 상태를 가진 두 인스턴스를 만듭니다.
const person1 = new Person("김철수", 30);
const person2 = new Person("이영희", 25);

console.log(person1.name); // 출력: 김철수
console.log(person2.age); // 출력: 25
console.log(person1 === person2); // 출력: false
```

### 🟦 메서드 추가와 `prototype` 저장 구조

클래스 본문에 작성한 일반 메서드는 `ClassName.prototype`에 저장됩니다.  
인스턴스에서 메서드를 호출하면 JavaScript가 프로토타입에서 메서드를 찾아 실행하므로, 같은 클래스로 만든 여러 인스턴스가 하나의 메서드를 공유합니다.  
이 구조는 인스턴스를 만들 때마다 같은 메서드를 새로 생성하지 않아도 된다는 장점이 있습니다.  

```javascript
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  // 클래스의 일반 메서드는 Person.prototype에 저장됩니다.
  sayHello() {
    console.log(`안녕하세요, 저는 ${this.name}입니다.`);
  }

  getAgeInTenYears() {
    return this.age + 10;
  }
}

const person1 = new Person("박민수", 40);
const person2 = new Person("최지민", 35);

person1.sayHello(); // 출력: 안녕하세요, 저는 박민수입니다.

// 두 인스턴스는 Person.prototype에 저장된 같은 함수를 사용합니다.
console.log(person1.sayHello === person2.sayHello); // 출력: true
console.log(Person.prototype.sayHello === person1.sayHello); // 출력: true
```

### 🟦 생성자 함수로 살펴보는 메서드 공유

클래스 문법을 사용하지 않고 생성자 함수와 `prototype`으로도 같은 공유 구조를 만들 수 있습니다.  
생성자 안에서 `this.method = function () {}`을 실행하면 인스턴스를 만들 때마다 새로운 함수 객체가 생성됩니다.  
반대로 `Constructor.prototype.method`에 메서드를 한 번 정의하면 모든 인스턴스가 그 함수를 공유합니다.  

```javascript
function Person(name, age) {
  this.name = name;
  this.age = age;

  // 생성자를 호출할 때마다 별도의 함수 객체가 만들어집니다.
  this.getAgeInTenYears = function () {
    return this.age + 10;
  };
}

// prototype에 정의한 함수는 모든 Person 인스턴스가 공유합니다.
Person.prototype.sayHello = function () {
  console.log(`안녕하세요, 저는 ${this.name}입니다.`);
};

const person1 = new Person("김철수", 30);
const person2 = new Person("이영희", 25);

// 인스턴스에 직접 만든 함수는 서로 다른 함수 객체입니다.
console.log(person1.getAgeInTenYears === person2.getAgeInTenYears); // false

// prototype에서 가져오는 메서드는 같은 함수 객체입니다.
console.log(person1.sayHello === person2.sayHello); // true
```

## 2. 프로토타입과 프로토타입 체인 {#session-02}

JavaScript 객체는 `[[Prototype]]`이라는 내부 연결을 통해 다른 객체 또는 `null`을 가리킵니다.  
객체에서 프로퍼티를 찾지 못하면 JavaScript가 이 연결을 따라 다음 객체에서 같은 키를 검색합니다.  
프로퍼티를 찾거나 `null`에 도달할 때까지 이어지는 검색 경로를 프로토타입 체인이라고 합니다.  

### 🟦 프로토타입에 메서드와 기본값 추가

생성자 함수의 `prototype`에 프로퍼티를 추가하면 해당 생성자로 만든 인스턴스가 그 프로퍼티를 사용할 수 있습니다.  
문자열처럼 변경 불가능한 기본값을 두는 것은 단순하지만, 배열이나 객체처럼 변경 가능한 값을 두면 모든 인스턴스가 같은 값을 공유하므로 주의해야 합니다.  

```javascript
function Item(id) {
  this.id = id;
}

// 모든 Item 인스턴스가 공유할 메서드를 prototype에 추가합니다.
Item.prototype.getDescription = function () {
  return `ID: ${this.id}, Type: ${this.type}`;
};

// 인스턴스에 type이 없으면 prototype의 기본값을 사용합니다.
Item.prototype.type = "General";

const item1 = new Item(101);
const item2 = new Item(102);

console.log(item1.type); // 출력: General
console.log(item2.getDescription()); // 출력: ID: 102, Type: General
```

### 🟦 `prototype`과 `[[Prototype]]` 구분하기

`prototype`은 생성자로 사용할 수 있는 함수가 가진 일반 프로퍼티입니다.  
새 인스턴스에 연결할 프로토타입 객체가 무엇인지 이 프로퍼티를 통해 정합니다.  

`[[Prototype]]`은 각 객체가 다음 검색 대상으로 가리키는 객체 또는 `null`을 담는 내부 슬롯입니다.  
`new Constructor()`로 만든 인스턴스의 `[[Prototype]]`은 기본적으로 `Constructor.prototype`을 가리킵니다.  
내부 슬롯은 코드에서 직접 읽지 않고 `Object.getPrototypeOf()`로 확인합니다.  

```text
Constructor.prototype
  생성자 함수가 새 인스턴스에 연결할 객체

instance.[[Prototype]]
  인스턴스가 프로퍼티를 찾을 다음 객체를 가리키는 내부 연결
```

### 🟦 프로토타입 체인의 검색 순서

JavaScript는 프로퍼티를 현재 객체에서 가장 먼저 찾습니다.  
현재 객체에 없으면 `[[Prototype]]`으로 연결된 객체로 이동하며, 가까운 곳에서 같은 키를 발견하면 그 값을 사용하고 검색을 끝냅니다.  

```javascript
class Person {
  constructor(name) {
    this.name = name;
  }

  sayHello() {
    console.log(`Hello, ${this.name}`);
  }
}

const person = new Person("Minho");

// sayHello는 person이 직접 소유한 프로퍼티가 아닙니다.
console.log(Object.hasOwn(person, "sayHello")); // 출력: false

// person에 없으므로 Person.prototype에서 sayHello를 찾아 실행합니다.
person.sayHello(); // 출력: Hello, Minho

// toString은 더 위에 연결된 Object.prototype에서 찾습니다.
console.log(person.toString()); // 출력: [object Object]
console.log(Object.hasOwn(Object.prototype, "toString")); // 출력: true
```

위 예제의 검색 경로를 간단히 그리면 다음과 같습니다.  

```text
person
  ↓ [[Prototype]]
Person.prototype (sayHello)
  ↓ [[Prototype]]
Object.prototype (toString)
  ↓ [[Prototype]]
null
```

### 🟦 `__proto__` 대신 표준 API 사용하기

`Object.prototype.__proto__`는 웹 호환성을 위해 남아 있는 레거시 접근자입니다.  
새 코드에서 프로토타입을 확인할 때는 `Object.getPrototypeOf()`를 사용하는 것이 명확합니다.  
원하는 프로토타입을 가진 새 객체가 필요하다면 생성 시점에 `Object.create()`를 사용할 수 있습니다.  
`Object.create(null)`로 만든 객체처럼 `Object.prototype`을 상속하지 않는 객체에는 `__proto__` 접근자도 없습니다.  

| 구분 | `prototype` | `[[Prototype]]` |
| --- | --- | --- |
| 위치 | 생성자 함수의 프로퍼티 | 객체의 내부 슬롯 |
| 역할 | 새 인스턴스에 연결할 객체 제공 | 다음 프로퍼티 검색 대상 연결 |
| 확인 | `Constructor.prototype` | `Object.getPrototypeOf(object)` |

```javascript
class Parent {}
class Child extends Parent {}

const instance = new Child();

// Child 인스턴스는 Child.prototype과 직접 연결됩니다.
console.log(Object.getPrototypeOf(instance) === Child.prototype); // true

// Child.prototype은 Parent.prototype과 연결됩니다.
console.log(
  Object.getPrototypeOf(Child.prototype) === Parent.prototype,
); // true
```

## 3. 캡슐화: private 필드와 접근자 {#session-03}

캡슐화는 객체의 내부 상태를 외부에서 직접 변경하지 못하게 하고, 공개된 메서드나 접근자를 통해서만 다루도록 제한하는 방식입니다.  
JavaScript 클래스에서는 private 필드와 메서드, getter와 setter를 사용해 접근 범위를 설계할 수 있습니다.  

### 🟦 private 필드와 메서드

필드나 메서드 이름 앞에 `#`을 붙이면 해당 클래스 본문 안에서만 접근할 수 있는 private 요소가 됩니다.  
private 이름은 일반 문자열 프로퍼티와 다르며 클래스 외부에서 접근하는 코드는 실행 전에 `SyntaxError`가 발생합니다.  

```javascript
class UserAccount {
  #balance = 0;

  constructor(initialDeposit) {
    // 클래스 내부에서는 private 메서드를 호출할 수 있습니다.
    this.#deposit(initialDeposit);
  }

  #deposit(amount) {
    if (amount <= 0) {
      console.log("0원 이하는 입금할 수 없습니다.");
      return;
    }

    this.#balance += amount;
    console.log(`입금: ${amount}, 잔액: ${this.#balance}`);
  }

  getBalance() {
    // 외부에는 필요한 값만 공개 메서드로 제공합니다.
    return this.#balance;
  }
}

const account = new UserAccount(1000);
console.log(account.getBalance()); // 출력: 1000

// 클래스 외부의 private 요소 접근은 SyntaxError가 발생하므로 실행하지 않습니다.
// account.#balance = 100000;
// account.#deposit(500);
```

### 🟦 getter와 setter

getter는 프로퍼티를 읽을 때 호출되고 setter는 프로퍼티에 값을 할당할 때 호출됩니다.  
외부에서는 일반 프로퍼티처럼 사용하지만 클래스 내부에서는 값을 검사하거나 변환하는 규칙을 적용할 수 있습니다.  

```javascript
class Product {
  #price;

  constructor(price) {
    // this.price 할당은 아래의 price setter를 호출합니다.
    this.price = price;
  }

  get price() {
    // 가격을 읽을 때 10% 할인한 값을 계산하여 반환합니다.
    return this.#price * 0.9;
  }

  set price(newPrice) {
    if (newPrice <= 0) {
      console.error("가격은 0보다 커야 합니다.");
      return;
    }

    this.#price = newPrice;
  }
}

const item = new Product(10000);

// private 필드는 클래스 외부에서 읽을 수 없으므로 다음 코드는 실행하지 않습니다.
// console.log(item.#price);

console.log(`판매 가격: ${item.price}`); // 출력: 판매 가격: 9000

item.price = -500; // 검증에 실패하므로 기존 가격을 유지합니다.
item.price = 15000; // 유효한 값이므로 내부 가격을 변경합니다.

console.log(`새 판매 가격: ${item.price}`); // 출력: 새 판매 가격: 13500
```

### 🟦 내부 객체를 안전하게 반환하기

private 필드에 객체를 저장해도 getter가 그 객체의 참조를 그대로 반환하면 외부에서 내부 상태를 변경할 수 있습니다.  
외부 변경이 내부로 전달되지 않게 하려면 상황에 맞는 복사본을 반환해야 합니다.  

원문의 `JSON.parse(JSON.stringify(value))` 방식은 `Date`, `Map`, `undefined` 같은 값을 온전히 보존하지 못합니다.  
아래 예제는 지원되는 값을 재귀적으로 복제하는 `structuredClone()`을 사용하지만, 함수처럼 복제할 수 없는 값이 포함되면 오류가 발생할 수 있습니다.  

```javascript
class Config {
  #settings = {
    theme: "dark",
    editor: { fontSize: 16 },
  };

  get settings() {
    // 중첩 객체까지 복제하여 외부에 별도의 객체를 반환합니다.
    return structuredClone(this.#settings);
  }
}

const config = new Config();
const userSettings = config.settings;

// 복사본을 변경해도 private 원본 객체에는 영향을 주지 않습니다.
userSettings.theme = "light";
userSettings.editor.fontSize = 20;

console.log(config.settings.theme); // 출력: dark
console.log(config.settings.editor.fontSize); // 출력: 16
```

## 4. static 멤버와 객체 생성 패턴 {#session-04}

`static` 필드와 메서드는 인스턴스가 아니라 클래스 자체에 저장됩니다.  
따라서 인스턴스를 만들지 않고 `ClassName.member` 형태로 사용하며, 일반 인스턴스에서는 직접 접근할 수 없습니다.  
인스턴스 상태가 필요 없는 유틸리티, 생성 횟수, 객체 생성 규칙처럼 클래스 단위로 관리할 기능에 적합합니다.  

### 🟦 static 필드와 메서드

공개 static 멤버는 클래스 이름으로 접근하고, `#`을 붙인 private static 멤버는 클래스 본문 안에서만 접근합니다.  

```javascript
class Calculator {
  // 공개 static 필드는 Calculator.PI로 접근합니다.
  static PI = 3.141592;

  // private static 필드는 클래스 내부에서만 접근할 수 있습니다.
  static #count = 0;

  constructor() {
    Calculator.#count += 1;
  }

  static add(a, b) {
    return a + b;
  }

  static getCount() {
    return Calculator.#count;
  }
}

console.log(Calculator.PI); // 출력: 3.141592
console.log(Calculator.add(5, 3)); // 출력: 8

const calculator1 = new Calculator();
const calculator2 = new Calculator();

// static 멤버는 인스턴스의 프로토타입 체인에 없습니다.
console.log(calculator1.PI); // 출력: undefined
console.log(Calculator.getCount()); // 출력: 2
```

### 🟦 싱글턴 패턴

싱글턴 패턴은 특정 클래스의 인스턴스를 하나만 만들고 모든 요청에 같은 객체를 반환합니다.  
JavaScript에는 private 생성자 문법이 없으므로 아래 예제는 클래스 내부의 private 토큰으로 외부의 직접 생성을 제한합니다.  
단순히 객체 하나를 공유하려는 목적이라면 모듈에서 객체를 한 번 생성해 내보내는 방식이 더 간단할 수 있습니다.  

```javascript
class ConfigManager {
  static #instance = null;
  static #constructionToken = Symbol("ConfigManager");

  constructor(token) {
    // getInstance()만 알고 있는 토큰이 없으면 직접 생성할 수 없습니다.
    if (token !== ConfigManager.#constructionToken) {
      throw new Error("ConfigManager.getInstance()를 사용하세요.");
    }

    this.settings = { logLevel: "info", port: 3000 };
  }

  static getInstance() {
    // 아직 인스턴스가 없을 때만 한 번 생성합니다.
    if (ConfigManager.#instance === null) {
      ConfigManager.#instance = new ConfigManager(
        ConfigManager.#constructionToken,
      );
    }

    return ConfigManager.#instance;
  }
}

// 토큰 없이 직접 생성하면 오류가 발생합니다.
// const invalidManager = new ConfigManager();

const manager1 = ConfigManager.getInstance();
const manager2 = ConfigManager.getInstance();

console.log(manager1 === manager2); // 출력: true
console.log(manager1.settings.logLevel); // 출력: info
```

### 🟦 팩토리 패턴

팩토리 메서드는 입력값을 확인하고 조건에 맞는 객체를 생성하여 반환합니다.  
객체 생성 규칙을 한곳에 모으므로 호출하는 코드에서 가격 계산이나 생성 조건을 반복하지 않아도 됩니다.  

```javascript
class Product {
  constructor(type, price) {
    this.type = type;
    this.price = price;
  }
}

class ProductFactory {
  static create(productType) {
    const basePrice = 10000;

    // 상품 종류에 따라 가격을 계산하여 Product 인스턴스를 반환합니다.
    switch (productType) {
      case "Premium":
        return new Product(productType, basePrice * 1.5);
      case "Standard":
        return new Product(productType, basePrice);
      case "Discount":
        return new Product(productType, basePrice * 0.8);
      default:
        throw new Error("유효하지 않은 상품 타입입니다.");
    }
  }
}

const premiumProduct = ProductFactory.create("Premium");
const standardProduct = ProductFactory.create("Standard");

console.log(premiumProduct);
// 출력: Product { type: 'Premium', price: 15000 }

console.log(standardProduct);
// 출력: Product { type: 'Standard', price: 10000 }
```

## 5. 상속과 믹스인 {#session-05}

`extends`는 자식 클래스가 부모 클래스의 동작을 찾을 수 있도록 프로토타입 체인을 연결합니다.  
자식 클래스는 부모 메서드를 그대로 사용하거나 같은 이름의 메서드를 재정의하여 동작을 확장할 수 있습니다.  

### 🟦 `super`와 메서드 재정의

자식 클래스가 자체 `constructor()`를 정의하면 `this`를 사용하기 전에 `super()`를 호출해야 합니다.  
`super()`는 부모 생성자를 실행하여 부모가 정의한 상태를 먼저 초기화합니다.  
자식 메서드에서 `super.method()`를 호출하면 부모의 동작을 실행한 뒤 자식만의 동작을 이어서 추가할 수 있습니다.  

```javascript
class Animal {
  constructor(name) {
    this.name = name;
    this.speed = 0;
  }

  move(speed) {
    this.speed = speed;
    console.log(`${this.name}: ${this.speed}km/h로 움직입니다.`);
  }

  stop() {
    this.speed = 0;
    console.log(`${this.name}: 멈춥니다.`);
  }
}

class Rabbit extends Animal {
  constructor(name, earLength) {
    // 부모 생성자를 먼저 호출하여 name과 speed를 초기화합니다.
    super(name);
    this.earLength = earLength;
  }

  hide() {
    console.log(`${this.name}: 숨었습니다.`);
  }

  move(speed) {
    // 부모의 move를 실행한 뒤 Rabbit만의 정보를 출력합니다.
    super.move(speed);
    console.log(`움직이는 중인 토끼의 귀 길이: ${this.earLength}cm`);
  }
}

const rabbit = new Rabbit("토순이", 15);

rabbit.move(10);
// 출력: 토순이: 10km/h로 움직입니다.
// 출력: 움직이는 중인 토끼의 귀 길이: 15cm

rabbit.stop(); // 출력: 토순이: 멈춥니다.
```

### 🟦 `extends`가 만드는 두 연결

`class Rabbit extends Animal`은 인스턴스 메서드와 static 멤버를 위한 두 연결을 만듭니다.  
`Rabbit.prototype`은 `Animal.prototype`과 연결되어 부모의 인스턴스 메서드를 찾습니다.  

```javascript
// Rabbit 인스턴스가 Animal의 인스턴스 메서드를 찾게 하는 연결입니다.
Object.getPrototypeOf(Rabbit.prototype) === Animal.prototype; // true
```

`Rabbit` 클래스 자체는 `Animal`과 연결되어 부모의 공개 static 멤버를 찾습니다.  

```javascript
// Rabbit 클래스가 Animal의 공개 static 멤버를 찾게 하는 연결입니다.
Object.getPrototypeOf(Rabbit) === Animal; // true
```

두 연결을 함께 확인하면 다음과 같습니다.  

```javascript
console.log(
  Object.getPrototypeOf(Rabbit.prototype) === Animal.prototype,
); // 출력: true

console.log(Object.getPrototypeOf(Rabbit) === Animal); // 출력: true
```

### 🟦 커스텀 오류 클래스

기본 `Error`를 상속하면 상황에 맞는 이름과 추가 정보를 가진 오류를 만들 수 있습니다.  
호출하는 쪽에서는 `instanceof`로 오류 종류를 확인하고 각 오류에 맞는 처리를 실행할 수 있습니다.  

```javascript
class InvalidInputError extends Error {
  constructor(message, fieldName) {
    // Error 생성자를 호출하여 message와 stack 정보를 초기화합니다.
    super(message);
    this.name = "InvalidInputError";
    this.fieldName = fieldName;
  }
}

function validateForm(value) {
  if (value === "") {
    throw new InvalidInputError(
      "필수 입력값이 누락되었습니다.",
      "username",
    );
  }

  return true;
}

try {
  validateForm("");
} catch (error) {
  if (error instanceof InvalidInputError) {
    console.error(`[${error.name}] ${error.message}`);
    console.error(`누락 필드: ${error.fieldName}`);
  } else {
    // 예상하지 못한 오류는 삼키지 않고 다시 던집니다.
    throw error;
  }
}
```

### 🟦 믹스인으로 기능 조합하기

JavaScript 클래스는 하나의 부모 클래스만 `extends`할 수 있습니다.  
믹스인은 상속 계층을 늘리지 않고 필요한 메서드 묶음을 여러 클래스에 추가하는 패턴입니다.  

아래 예제에서는 재사용할 메서드를 객체에 정의한 뒤 `Object.assign()`으로 각 클래스의 `prototype`에 복사합니다.  
`Object.assign()`은 소스 객체가 직접 소유한 열거 가능한 프로퍼티의 값을 복사하며 같은 키가 있으면 기존 값을 덮어씁니다.  
getter와 setter의 프로퍼티 설명자까지 유지해야 한다면 `Object.getOwnPropertyDescriptors()`와 `Object.defineProperties()`를 사용해야 합니다.  

```javascript
const logMixin = {
  log(message) {
    console.log(`[${this.name}] ${message}`);
  },

  logError(message) {
    console.error(`[${this.name}] ERROR: ${message}`);
  },
};

class User {
  constructor(name) {
    this.name = name;
  }
}

class ProductItem {
  constructor(name) {
    this.name = name;
  }
}

// 같은 믹스인 메서드를 두 클래스의 prototype에 복사합니다.
Object.assign(User.prototype, logMixin);
Object.assign(ProductItem.prototype, logMixin);

const user = new User("Alice");
const item = new ProductItem("Laptop");

user.log("로그인 성공"); // 출력: [Alice] 로그인 성공
item.logError("재고 부족"); // 출력: [Laptop] ERROR: 재고 부족

// 두 prototype에 복사된 log의 값은 같은 함수 객체입니다.
console.log(user.log === item.log); // 출력: true
```
