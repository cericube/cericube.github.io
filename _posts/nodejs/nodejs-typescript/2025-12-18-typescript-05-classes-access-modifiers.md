---
layout: post
title: "05. TypeScript 클래스와 접근 제어자 이해하기"
description: "TypeScript 클래스의 속성·생성자·메서드에 타입을 적용하고, 인터페이스 구현과 접근 제어자, getter·setter, 상속과 추상 클래스를 예제로 이해합니다."
category_id: nodejs-typescript
categories: [nodejs, nodejs-typescript]
series: typescript
series_order: "05"
ai_assisted: true
toc:
  - id: session-01
    title: "1. 클래스에 타입 적용하기: 클래스 정의와 구현"
  - id: session-02
    title: "2. 접근 제어자: 캡슐화의 핵심(public, private, protected)"
  - id: session-03
    title: "3. 클래스 속성을 안전하게 다루기: getter와 setter"
  - id: session-04
    title: "4. 상속과 추상 클래스: 코드 재사용성과 구조 설계"
---

## 1. 클래스에 타입 적용하기: 클래스 정의와 구현 {#session-01}

TypeScript에서는 클래스(Class)를 통해 객체를 만들 수 있으며, 클래스의 속성(Property), 생성자(Constructor), 메서드(Method)에 타입을 명확히 지정하여 안정적인 코드를 작성할 수 있습니다.  
또한 클래스는 인터페이스(Interface)를 구현하여 일관된 구조를 갖추도록 할 수 있습니다.  

| JavaScript | TypeScript |
| --- | --- |
| 정적 타입 주석 없이 동적으로 타입이 결정됩니다. | 프로퍼티, 매개변수, 반환값에 타입을 지정할 수 있습니다. |
| `public`, `private`, `protected` 접근 제어자 키워드가 없습니다. 단, `#`을 사용하는 비공개 필드는 지원합니다. | `public`, `private`, `protected` 접근 제어자를 지원합니다. |
| `readonly` 키워드를 지원하지 않습니다. | `readonly`로 읽기 전용 프로퍼티를 선언할 수 있습니다. |
| `abstract class` 문법을 지원하지 않습니다. | 추상 클래스와 추상 멤버를 지원합니다. |
| `interface`와 `implements` 문법이 없습니다. | 인터페이스와 인터페이스 구현을 지원합니다. |
| 언어 자체에서 컴파일 단계의 정적 타입 검사를 수행하지 않습니다. | 컴파일 단계에서 정적 타입을 검사하여 일부 오류를 미리 발견합니다. |


### 🟦 클래스 선언과 속성 타입 지정

클래스를 정의할 때는 각 속성의 타입을 명확하게 지정하는 것이 중요합니다.  
생성자의 매개변수에도 정확한 타입을 작성해야 합니다.  
클래스 속성에 잘못된 타입의 값을 할당하면 TypeScript가 컴파일 단계에서 오류를 알려 주므로 일부 런타임 오류를 미리 방지할 수 있습니다.

```typescript
class Book {
  // 1) 속성에 타입을 지정합니다.
  title: string;
  author: string;
  pages: number;
  isPublished: boolean;

  // 2) 생성자 매개변수에도 타입을 지정합니다.
  constructor(title: string, author: string, pages: number, isPublished: boolean) {
    this.title = title;
    this.author = author;
    this.pages = pages;
    this.isPublished = isPublished;
  }

  // 3) 문자열을 반환하는 메서드입니다.
  getSummary(): string {
    return `${this.title} - ${this.author} (${this.pages}쪽) / 출간 여부: ${
      this.isPublished ? "출간됨" : "미출간"
    }`;
  }

  // 4) 반환값이 없는 메서드는 void를 사용합니다.
  publish(): void {
    this.isPublished = true;
    console.log(`"${this.title}"가 출간 상태로 변경되었습니다.`);
  }
}

// 사용 예제입니다.
const book1 = new Book("타입스크립트 완벽 가이드", "홍길동", 350, false);
console.log(book1.getSummary());

book1.publish();
console.log(book1.getSummary());

// 잘못된 타입을 할당하면 컴파일 오류가 발생합니다.
// book1.pages = "많이";
```

### 🟦 클래스와 인터페이스 결합하기(implements)

클래스는 인터페이스를 `implements` 키워드로 구현할 수 있습니다.  
이는 클래스가 해당 인터페이스에서 정의한 모든 속성과 메서드를 갖추도록 하는 약속이며, 구조적 일관성을 확보하는 데 도움이 됩니다.

```typescript
// 이동 가능한 객체가 따라야 할 구조입니다.
interface Drivable {
  drive(distance: number): void;
}

// 충전 가능한 객체가 따라야 할 구조입니다.
interface Chargeable {
  charge(amount: number): void;
}

// Drivable과 Chargeable을 모두 구현하는 전기차입니다.
class ElectricCar implements Drivable, Chargeable {
  private battery: number = 100; // 배터리 잔량(%)입니다.
  private odometer: number = 0; // 총 주행 거리(km)입니다.

  drive(distance: number): void {
    if (this.battery <= 0) {
      console.log("배터리가 없어 운행할 수 없습니다.");
      return;
    }

    this.odometer += distance;
    this.battery -= distance * 0.5; // 1km 주행할 때 0.5%를 소모한다고 가정합니다.

    if (this.battery < 0) {
      this.battery = 0;
    }

    console.log(
      `${distance}km 주행 완료 (총 주행 거리: ${this.odometer}km, 배터리: ${this.battery.toFixed(
        1,
      )}%)`,
    );
  }

  charge(amount: number): void {
    this.battery += amount;

    if (this.battery > 100) {
      this.battery = 100;
    }

    console.log(`충전 완료: 현재 배터리 ${this.battery.toFixed(1)}%`);
  }
}

// 사용 예제입니다.
const tesla = new ElectricCar();
tesla.drive(50);
tesla.drive(80);
tesla.charge(30);
tesla.drive(40);

// 인터페이스에 선언된 메서드를 구현하지 않으면 컴파일 오류가 발생합니다.
// class Bike implements Drivable {}
```

## 2. 접근 제어자: 캡슐화의 핵심(public, private, protected) {#session-02}

객체 지향 프로그래밍(Object-Oriented Programming, OOP)의 중요한 개념 중 하나는 캡슐화(Encapsulation)입니다.  
캡슐화는 클래스의 내부 상태를 외부에서 직접 다루지 못하도록 제한하고, 정해진 메서드를 통해 접근하거나 변경하도록 하여 코드의 안정성과 유지보수성을 높입니다.

TypeScript는 캡슐화를 구현할 수 있도록 세 가지 접근 제어자(Access Modifier)를 제공합니다.  
접근 제어자는 클래스의 속성과 메서드에 모두 사용할 수 있습니다.

| 제어자 | 설명 | 접근 가능 범위 |
| --- | --- | --- |
| `public` | 어디에서든 접근할 수 있으며 생략할 때 적용되는 기본값 | 클래스 내부, 자식 클래스, 외부 코드 |
| `private` | 해당 클래스 내부에서만 접근 가능 | 클래스 내부 |
| `protected` | 해당 클래스와 자식 클래스 내부에서 접근 가능 | 클래스 내부, 자식 클래스 내부 |

### 🟦 private 사용 예제: 외부 접근 제한하기

```typescript
class BankAccount {
  public ownerName: string; // 어디에서든 접근할 수 있습니다.
  protected accountNumber: string; // 클래스와 자식 클래스에서 접근할 수 있습니다.
  private balance: number; // BankAccount 클래스 내부에서만 접근할 수 있습니다.

  constructor(ownerName: string, accountNumber: string, initialBalance: number) {
    this.ownerName = ownerName;
    this.accountNumber = accountNumber;
    this.balance = initialBalance;
  }

  // private 속성의 값을 외부에 제공하는 public 메서드입니다.
  public getBalance(): number {
    return this.balance;
  }

  public deposit(amount: number): void {
    if (amount <= 0) {
      console.log("입금액은 0보다 커야 합니다.");
      return;
    }

    this.balance += amount;
    console.log(
      `${amount.toLocaleString()}원 입금 완료. 현재 잔액: ${this.balance.toLocaleString()}원`,
    );
  }

  public withdraw(amount: number): void {
    if (amount <= 0) {
      console.log("출금액은 0보다 커야 합니다.");
      return;
    }

    if (amount > this.balance) {
      console.log("잔액이 부족합니다.");
      return;
    }

    this.balance -= amount;
    console.log(
      `${amount.toLocaleString()}원 출금 완료. 현재 잔액: ${this.balance.toLocaleString()}원`,
    );
  }
}

const account = new BankAccount("김철수", "123-456-7890", 1_000_000);

console.log(account.ownerName); // public이므로 접근할 수 있습니다.
// console.log(account.accountNumber); // 오류: protected 속성은 외부에서 접근할 수 없습니다.
// console.log(account.balance); // 오류: private 속성은 외부에서 접근할 수 없습니다.

account.deposit(500_000);
account.withdraw(200_000);
console.log("잔액 조회:", account.getBalance());
```

`balance` 속성은 외부에서 직접 접근할 수 없지만 `getBalance()` 메서드를 통해 값을 조회할 수 있습니다.  
이는 정보 은닉과 캡슐화의 전형적인 예입니다.

### 🟦 protected 사용 예제: 상속 관계에서 접근 허용하기

```typescript
class SafeBankAccount extends BankAccount {
  // 부모 클래스의 protected 속성인 accountNumber에 접근할 수 있습니다.
  public printMaskedAccount(): void {
    // 마지막 네 자리를 제외한 계좌번호를 별표로 표시합니다.
    const masked = this.accountNumber.replace(/.(?=.{4})/g, "*");
    console.log(`계좌번호(마스킹): ${masked}`);
  }
}

const safeAccount = new SafeBankAccount("이영희", "987-654-3210", 3_000_000);
safeAccount.printMaskedAccount();

// 외부에서는 protected 속성에 직접 접근할 수 없습니다.
// console.log(safeAccount.accountNumber);
```

`protected`는 외부에서는 접근할 수 없지만 자식 클래스에서는 사용할 수 있는 보호 방식입니다.

### 🟦 생성자 매개변수 속성 선언(Parameter Property)

TypeScript에서는 생성자의 매개변수에 접근 제어자를 붙이면 해당 매개변수를 클래스 속성으로 자동 선언하고 초기화합니다.

```typescript
class Product {
  constructor(
    public name: string,
    private price: number,
    public category: string = "일반",
  ) {}

  public getPriceWithTax(): number {
    // private 속성인 price는 클래스 내부에서 사용할 수 있습니다.
    const taxRate = 0.1;
    return this.price * (1 + taxRate);
  }

  public getLabel(): string {
    return `[${this.category}] ${this.name}`;
  }
}

const product = new Product("게이밍 마우스", 50_000, "전자기기");

console.log(product.name);
console.log(product.getLabel());
console.log(product.getPriceWithTax());

// private 속성인 price에는 외부에서 직접 접근할 수 없습니다.
// console.log(product.price);
```

## 3. 클래스 속성을 안전하게 다루기: getter와 setter {#session-03}

TypeScript에서는 클래스 속성을 간접적으로 읽고 수정할 수 있도록 getter와 setter를 제공합니다.

| 구분 | 설명 |
| --- | --- |
| `get` | 속성처럼 값을 읽는 접근자 |
| `set` | 속성처럼 값을 변경하는 접근자 |
| 내부 변수 | 주로 `_name`처럼 밑줄을 붙여 getter와 setter가 다루는 실제 데이터와 구분 |
| 유효성 검사 | `set` 안에서 조건을 검사하여 잘못된 값 방지 |

`get`과 `set`은 접근자 메서드이지만 호출할 때는 일반 속성처럼 사용합니다.

### 🟦 기본 예제: 이름(name) 속성 관리하기

```typescript
class UserName {
  private _firstName: string;
  private _lastName: string;

  constructor(firstName: string, lastName: string) {
    this._firstName = firstName;
    this._lastName = lastName;
  }

  // 읽기용 getter는 user.fullName 형식으로 사용합니다.
  public get fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  // 쓰기용 setter는 "이름 성" 형식의 문자열을 받아 내부 값을 나눕니다.
  public set fullName(value: string) {
    const parts = value.trim().split(/\s+/);

    if (parts.length !== 2) {
      throw new Error("fullName은 '이름 성' 형식으로 입력해야 합니다.");
    }

    this._firstName = parts[0];
    this._lastName = parts[1];
  }
}

// 사용 예제입니다.
const userName = new UserName("Jimin", "Park");
console.log(userName.fullName); // getter가 호출되어 "Jimin Park"를 반환합니다.

userName.fullName = "Minji Kim"; // setter가 호출됩니다.
console.log(userName.fullName); // "Minji Kim"

// 잘못된 형식은 setter에서 오류가 발생합니다.
// userName.fullName = "잘못된형식";
```

### 🟦 응용 예제: 숫자 범위를 제한하는 setter

```typescript
class Temperature {
  private _celsius: number = 0;

  public get celsius(): number {
    return this._celsius;
  }

  public set celsius(value: number) {
    if (value < -273.15) {
      throw new Error("절대영도보다 낮은 온도는 설정할 수 없습니다.");
    }

    this._celsius = value;
  }
}

const temp = new Temperature();

temp.celsius = 25; // setter를 사용합니다.
console.log(temp.celsius); // getter를 사용하며 25를 출력합니다.

// 절대영도보다 낮은 값은 오류가 발생합니다.
// temp.celsius = -300;
```

## 4. 상속과 추상 클래스: 코드 재사용성과 구조 설계 {#session-04}

### 🟦 상속(Inheritance): 기존 기능 재사용하기

상속은 기존 클래스의 속성과 메서드를 자식 클래스가 물려받아 재사용하는 기능입니다.  
TypeScript에서는 `extends` 키워드를 사용하여 상속을 구현합니다.  
이를 통해 중복 코드를 줄이고 클래스 간의 관계를 명확하게 설계할 수 있습니다.

```typescript
// EmployeeBase 클래스를 상속하는 Developer와 Manager 예제입니다.
class EmployeeBase {
  constructor(
    public name: string,
    protected baseSalary: number,
  ) {}

  // 자식 클래스가 함께 사용하는 동작입니다.
  work(): void {
    console.log(`${this.name}이(가) 회사에서 일하고 있습니다.`);
  }

  // 공통 급여 계산 메서드입니다.
  getMonthlySalary(): number {
    return this.baseSalary;
  }
}

class Developer extends EmployeeBase {
  constructor(
    name: string,
    baseSalary: number,
    public mainLanguage: string,
  ) {
    super(name, baseSalary);
  }

  // 부모 클래스의 메서드를 재정의합니다.
  work(): void {
    console.log(`${this.name}이(가) ${this.mainLanguage}로 기능을 개발하고 있습니다.`);
  }
}

class Manager extends EmployeeBase {
  constructor(
    name: string,
    baseSalary: number,
    private teamSize: number,
  ) {
    super(name, baseSalary);
  }

  // 부모 클래스의 메서드를 재정의합니다.
  work(): void {
    console.log(`${this.name}이(가) ${this.teamSize}명의 팀을 관리하고 있습니다.`);
  }

  // 팀원 수에 따라 관리 수당을 계산합니다.
  getMonthlySalary(): number {
    const bonus = this.teamSize * 100_000;
    return this.baseSalary + bonus;
  }
}

// 부모 클래스 타입으로 서로 다른 자식 클래스를 다루는 다형성 예제입니다.
const employees: EmployeeBase[] = [
  new Developer("개발자A", 4_000_000, "TypeScript"),
  new Manager("매니저B", 5_000_000, 5),
];

for (const employee of employees) {
  employee.work(); // 실제 인스턴스에 맞게 재정의된 메서드가 호출됩니다.
  console.log("월 급여:", employee.getMonthlySalary().toLocaleString(), "원");
}
```

### 🟦 추상 클래스(Abstract Class): 공통 구조를 설계하는 틀

추상 클래스는 직접 인스턴스를 만들 수 없으며, 상속을 통해 구체적인 클래스를 만드는 용도로 사용합니다.  
추상 클래스는 `abstract` 키워드로 선언하며 추상 메서드(Abstract Method)를 가질 수 있습니다.

추상 메서드는 선언부만 있고 구현부가 없는 메서드입니다.  
추상 클래스를 상속하는 구체적인 자식 클래스는 모든 추상 멤버를 구현해야 합니다.  
이를 통해 자식 클래스가 따라야 할 공통 규칙과 구조를 정의할 수 있습니다.

```typescript
// ShapeBase를 상속하는 Circle2, Rectangle2, Triangle2 예제입니다.
abstract class ShapeBase {
  abstract name: string;

  // 도형마다 넓이 계산 방식이 다르므로 추상 메서드로 선언합니다.
  abstract getArea(): number;

  // 모든 도형이 함께 사용하는 메서드입니다.
  display(): void {
    console.log(`도형: ${this.name}, 넓이: ${this.getArea().toFixed(2)}`);
  }
}

class Circle2 extends ShapeBase {
  name: string = "원";

  constructor(private radius: number) {
    super();
  }

  getArea(): number {
    return Math.PI * this.radius * this.radius;
  }
}

class Rectangle2 extends ShapeBase {
  name: string = "직사각형";

  constructor(
    private width: number,
    private height: number,
  ) {
    super();
  }

  getArea(): number {
    return this.width * this.height;
  }
}

class Triangle2 extends ShapeBase {
  name: string = "삼각형";

  constructor(
    private base: number,
    private height: number,
  ) {
    super();
  }

  getArea(): number {
    return (this.base * this.height) / 2;
  }
}

// 추상 클래스는 직접 인스턴스화할 수 없습니다.
// const shape = new ShapeBase();

// ShapeBase 타입 배열로 서로 다른 자식 클래스를 함께 처리합니다.
const shapes: ShapeBase[] = [new Circle2(5), new Rectangle2(4, 6), new Triangle2(10, 3)];

for (const shape of shapes) {
  shape.display(); // 각 인스턴스에 맞는 getArea()가 호출됩니다.
}
```
