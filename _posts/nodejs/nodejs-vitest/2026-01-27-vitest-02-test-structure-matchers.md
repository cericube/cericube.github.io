---
layout: post
title: "02. Vitest 테스트 구조와 Assertion, Matcher 이해하기"
description: "Vitest의 describe와 it으로 테스트 구조를 설계하고, expect와 주요 Matcher를 사용하여 값, 객체, 예외, 비동기 처리와 함수 호출을 검증하는 방법을 알아봅니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. 테스트 선언 API: 테스트 구조 설계 이해하기"
  - id: session-02
    title: "2. Assertion 진입점 API: expect() 이해하기"
  - id: session-03
    title: "3. 주요 Matcher API 이해하기: 값, 구조, 행위 검증"
---

## 1. 테스트 선언 API: 테스트 구조 설계 이해하기 {#session-01}

### 🟦 테스트 계층 구조: describe와 it 또는 test

Vitest에서는 관련된 테스트를 하나의 그룹으로 묶고, 그 안에 개별 테스트를 작성합니다.  
이때 `describe`는 테스트 그룹을 만들고, `it` 또는 `test`는 그룹 안에서 확인할 하나의 동작을 정의합니다.  

### 🔷 1) describe

`describe`는 같은 대상이나 상황을 검증하는 테스트를 한곳에 묶을 때 사용합니다.  
그룹 이름을 읽는 것만으로 무엇을 테스트하는지 쉽게 파악할 수 있어 테스트 코드와 실행 결과가 한눈에 들어옵니다.  

예를 들어 다음과 같은 기준으로 테스트를 묶을 수 있습니다.  

- 특정 클래스
- 특정 함수 또는 메서드
- 특정 시나리오(로그인 실패, 권한 오류 처리 등)

```typescript
describe('UserService', () => {
  // UserService와 관련된 테스트를 이 그룹에 작성합니다.
});
```

### 🔷 2) it 또는 test

`it`과 `test`는 하나의 동작이나 결과를 확인하는 개별 테스트를 만들 때 사용합니다.  
콜백 함수 안에서 테스트할 코드를 실행하고, 그 결과가 예상과 일치하는지 검증합니다.  

```typescript
it('200 상태 코드를 반환합니다', () => {
  // 실행 결과가 기대한 조건을 만족하는지 검증합니다.
});
```

`it`과 `test`의 기능은 같습니다.  
프로젝트의 작성 방식이나 테스트 이름이 자연스럽게 읽히는 형태에 맞춰 하나를 선택하면 됩니다.  

### 🟦 중첩(Nesting) 전략

테스트를 단순히 나열하기보다 상태와 맥락을 중심으로 중첩하면 구조를 이해하고 유지보수하기 쉽습니다.  

```text
describe(테스트 대상)
└─ describe(기능 또는 메서드)
   └─ describe(특정 상황 또는 조건)
      └─ it(기대 결과)

Top-level: 서비스 또는 모듈
Mid-level: 특정 메서드
Low-level: 입력 조건, 상태, 예외 사례
it: 기대 결과
```

다음 예제는 회원 등급에 따른 할인율을 중첩된 테스트 그룹으로 표현합니다.  

```typescript
// ProductService 전체에 대한 테스트 그룹입니다.
describe('ProductService', () => {
  // calculateDiscount() 메서드를 검증하는 그룹입니다.
  describe('calculateDiscount()', () => {
    // VIP 회원인 상황을 정의합니다.
    describe('when the user is a VIP', () => {
      it('20% 할인율을 적용해야 합니다', () => {
        // Arrange: 테스트에 필요한 데이터를 준비합니다.
        // Act: calculateDiscount()를 실행합니다.
        // Assert: 결과가 20% 할인인지 검증합니다.
      });
    });

    // 일반 회원인 상황을 정의합니다.
    describe('when the user is a regular member', () => {
      it('10% 할인율을 적용해야 합니다', () => {
        // Arrange: 테스트에 필요한 데이터를 준비합니다.
        // Act: calculateDiscount()를 실행합니다.
        // Assert: 결과가 10% 할인인지 검증합니다.
      });
    });
  });
});
```

### 🟦 병렬 실행(Parallel Execution)의 기본 원리

테스트 실행 속도는 개발 생산성과 밀접하게 연결됩니다.  
Vitest는 기본적으로 여러 테스트 파일을 여러 worker에서 병렬로 실행합니다.  

### 🔷 1) 서로 다른 테스트 파일은 병렬로 실행

각 테스트 파일은 설정된 pool에 따라 별도의 프로세스 또는 worker thread에서 실행될 수 있습니다.  
파일마다 실행 환경이 격리되지만, 데이터베이스처럼 외부 자원을 함께 사용한다면 테스트 간 충돌이 생기지 않도록 주의해야 합니다.  

```text
auth.test.ts   ─▶ Worker A
user.test.ts   ─▶ Worker B
order.test.ts  ─▶ Worker C
```

### 🔷 2) 파일 내부는 기본적으로 순차 실행

하나의 파일 안에서 정의한 `describe`와 `it`은 기본적으로 선언한 순서에 따라 실행됩니다.  
필요한 경우 `test.concurrent` 또는 `describe.concurrent`를 사용하여 파일 내부 테스트를 동시에 실행할 수 있습니다.  

## 2. Assertion 진입점 API: expect() 이해하기 {#session-02}

### 🟦 expect()는 무엇인가요?

`expect()`는 테스트에서 검증할 실제 값(Actual 또는 Received)을 Assertion 체인에 전달하는 함수입니다.  

- 함수 반환값, API 응답과 객체 상태처럼 검증할 값을 `expect()`에 전달합니다.  
- 이어서 `.toBe()`, `.toEqual()`, `.toThrow()` 같은 Matcher를 연결하여 검증 방식을 선언합니다.  

```typescript
expect(actual).toBe(expected);
```

1. **actual(실제 값)**: 함수 호출 결과나 변수처럼 검증할 대상입니다.  
2. **expect()**: 실제 값을 Matcher로 검증할 수 있는 Assertion 객체로 만듭니다.  
3. **Matcher(.toBe 등)**: 실제 값과 기대 값을 비교하는 규칙입니다.  
4. **expected(기대 값)**: 테스트에서 예상하는 결과입니다.  

### 🟦 Assertion 실패 메시지 해석

테스트가 실패하면 Vitest는 실패 원인을 찾을 수 있는 정보를 표시합니다.  

1. 어떤 Assertion이 실패했는지 보여 줍니다.  
2. 어떤 Matcher를 사용했는지 보여 줍니다.  
3. Expected와 Received의 차이를 보여 줍니다.  

다음 코드는 실패 메시지를 확인하기 위해 의도적으로 잘못된 기대 값을 사용합니다.  

```typescript
test('더하기 테스트', () => {
  const result = 1 + 1;

  // 실제 결과는 2이므로 이 Assertion은 실패합니다.
  expect(result).toBe(3);
});
```

![Vitest toBe Assertion 실패 결과](/assets/images/nodejs/nodejs-vitest/vitest-assertion-failure.png)

### 🔷 1) expect(received).toBe(expected)

어떤 형태의 Assertion이 실패했는지 알려 줍니다.  
Received와 Expected를 `toBe`로 비교했다는 뜻입니다.  

### 🔷 2) Object.is equality

`toBe`가 사용하는 비교 규칙을 보여 줍니다.  
이 예제에서는 `Object.is` 기반의 동일성 비교가 수행되었습니다.  

### 🔷 3) Expected와 Received

- Expected: 테스트 작성자가 기대한 값입니다.  
- Received: 실제 코드가 반환한 값입니다.  

### 🔷 4) 코드 위치 표시

실패한 파일과 줄, 열의 위치를 함께 보여 줍니다.  

```text
❯ tests/ch01/math.test.ts:12:20
   10|   test('더하기 테스트', () => {
   11|     const result = 1 + 1;
   12|     expect(result).toBe(3); // 일부러 틀린 기댓값을 넣었습니다.
     |                    ^
   13|   });
```

## 3. 주요 Matcher API 이해하기: 값, 구조, 행위 검증 {#session-03}

Matcher의 전체 목록은 [Vitest expect API 문서](https://vitest.dev/api/expect){: target="_blank" rel="noopener noreferrer" }에서 확인할 수 있습니다.  

### 🟦 1. 값의 일치 여부 확인(Equality)

가장 기본이 되는 Matcher입니다.  
값 또는 객체 구조를 어느 수준까지 비교할지에 따라 적절한 Matcher를 선택합니다.  

| Matcher | 설명 | 예시 |
| --- | --- | --- |
| `toBe()` | 원시 값 또는 객체의 참조 동일성을 `Object.is`로 비교합니다. | 숫자, 문자열, boolean, 동일 객체 비교 |
| `toEqual()` | 객체와 배열의 구조와 값을 재귀적으로 비교합니다. | API 응답 객체, DTO 구조 검증 |
| `toStrictEqual()` | 구조뿐 아니라 타입, `undefined` 속성과 클래스 인스턴스 등의 차이도 엄격하게 검사합니다. | 클래스 인스턴스, 정밀한 데이터 구조 검증 |

```typescript
it('Equality Matcher를 사용합니다', () => {
  const user = { name: 'Gemini' };
  const sameUser = user;
  const anotherUser = { name: 'Gemini' };

  // toBe는 객체의 참조가 같아야 통과합니다.
  expect(user).toBe(sameUser);
  // expect(user).toBe(anotherUser); // 내용은 같지만 참조가 달라 실패합니다.

  // toEqual은 객체의 구조와 값이 같으면 통과합니다.
  expect(user).toEqual(anotherUser);

  // toStrictEqual은 클래스 인스턴스와 일반 객체의 차이도 검사합니다.
  class User {
    name = 'Gemini';
  }

  expect(new User()).toEqual({ name: 'Gemini' });
  // expect(new User()).toStrictEqual({ name: 'Gemini' }); // 타입이 달라 실패합니다.
});
```

### 🟦 2. 참과 거짓 및 상태 검증(Truthiness)

| Matcher | 설명 |
| --- | --- |
| `toBeNull()` | 값이 `null`인 경우에만 통과합니다. |
| `toBeUndefined()` | 값이 `undefined`인 경우에만 통과합니다. |
| `toBeDefined()` | 값이 `undefined`가 아니면 통과합니다. |
| `toBeTruthy()` | boolean으로 변환했을 때 `true`가 되는 값이면 통과합니다. |
| `toBeFalsy()` | boolean으로 변환했을 때 `false`가 되는 값이면 통과합니다. |

```typescript
describe('1. Truthiness 실습', () => {
  test('null 값의 상태를 검증합니다', () => {
    const value = null;

    expect(value).toBeNull();
    expect(value).toBeDefined(); // null은 undefined가 아니므로 정의된 값입니다.
    expect(value).not.toBeUndefined();
    expect(value).not.toBeTruthy(); // null은 Truthy가 아닙니다.
    expect(value).toBeFalsy();
  });

  test('undefined 값의 상태를 검증합니다', () => {
    const value = undefined;

    expect(value).toBeUndefined();
    expect(value).not.toBeNull();
    expect(value).not.toBeTruthy();
    expect(value).toBeFalsy();
  });

  test('일반 값의 Truthy와 Falsy 여부를 검증합니다', () => {
    // 빈 문자열과 숫자 0은 Falsy입니다.
    expect('').toBeFalsy();
    expect(0).toBeFalsy();

    // 내용이 있는 문자열, 0이 아닌 숫자, 배열과 객체는 Truthy입니다.
    expect('Hello').toBeTruthy();
    expect(1).toBeTruthy();
    expect([]).toBeTruthy();
    expect({}).toBeTruthy();
  });
});
```

### 🟦 3. 숫자 검증(Numbers)

| Matcher | 기준 | 설명 |
| --- | --- | --- |
| `toBeGreaterThan(n)` | `>` | 값이 `n`보다 큰지 검증합니다. |
| `toBeGreaterThanOrEqual(n)` | `>=` | 값이 `n`보다 크거나 같은지 검증합니다. |
| `toBeLessThan(n)` | `<` | 값이 `n`보다 작은지 검증합니다. |
| `toBeLessThanOrEqual(n)` | `<=` | 값이 `n`보다 작거나 같은지 검증합니다. |
| `toBeCloseTo(expected, precision?)` | 근삿값 비교 | 부동 소수점 오차를 허용하여 비교합니다. |

```typescript
describe('2. Numbers 실습', () => {
  it('숫자의 크기를 비교합니다', () => {
    const weight = 75 + 5;

    expect(weight).toBeGreaterThan(70);
    expect(weight).toBeGreaterThanOrEqual(80);
    expect(weight).toBeLessThan(100);
    expect(weight).toBeLessThanOrEqual(80);

    // 정확한 값의 일치 여부를 확인합니다.
    expect(weight).toBe(80);
    expect(weight).toEqual(80);
  });

  it('부동 소수점 오차를 고려하여 검증합니다', () => {
    const result = 0.1 + 0.2; // 실제 값은 0.30000000000000004입니다.

    // expect(result).toBe(0.3); // 부동 소수점 오차로 실패합니다.

    // 소수점 이하 5자리 정밀도로 0.3에 가까운지 확인합니다.
    expect(result).toBeCloseTo(0.3, 5);
  });

  it('금액과 수량의 경계 값을 검증합니다', () => {
    const balance = 1500.55;

    // 최소 잔액 기준을 확인합니다.
    expect(balance).toBeGreaterThan(1000);
    // 소수점 금액이 기대 값에 가까운지 확인합니다.
    expect(balance).toBeCloseTo(1500.55, 2);
  });
});
```

### 🟦 4. 문자열과 배열 검증(Strings & Arrays)

| Matcher | 용도 | 설명 |
| --- | --- | --- |
| `toMatch(regex)` | 문자열 패턴 검사 | 문자열이 정규 표현식이나 부분 문자열과 일치하는지 확인합니다. |
| `toContain(item)` | 배열·문자열 포함 여부 | 배열에 특정 요소가 있거나 문자열에 특정 부분 문자열이 있는지 확인합니다. |
| `toContainEqual(obj)` | 배열 안의 객체 검사 | 배열 안에 같은 값을 가진 객체가 있는지 참조와 무관하게 확인합니다. |
| `toHaveLength(len)` | 길이 검사 | 배열의 요소 개수나 문자열의 길이를 확인합니다. |

```typescript
import { describe, expect, it } from 'vitest';

describe('데이터 컬렉션과 문자열 검증', () => {
  it('배열에 항목이 포함되어 있는지 검증합니다', () => {
    const shoppingList = ['Apple', 'Banana', 'Orange'];

    // 특정 항목이 포함되어 있는지 확인합니다.
    expect(shoppingList).toContain('Banana');

    // 배열의 전체 길이를 확인합니다.
    expect(shoppingList).toHaveLength(3);

    // 객체 배열에서는 같은 값을 가진 객체가 있는지 확인합니다.
    const users = [
      { id: 1, name: 'Kim' },
      { id: 2, name: 'Lee' },
    ];
    expect(users).toContainEqual({ id: 1, name: 'Kim' });
  });

  it('문자열의 내용과 형식을 검증합니다', () => {
    const welcomeMessage = '안녕하세요, Vitest의 세계에 오신 것을 환영합니다!';
    const email = 'test-user@google.com';

    // 특정 문구가 포함되어 있는지 확인합니다.
    expect(welcomeMessage).toContain('Vitest');

    // 정규 표현식으로 이메일 형식을 확인합니다.
    expect(email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);

    // 문자열이 특정 단어로 끝나는지 확인합니다.
    expect(email).toMatch(/com$/);
  });
});
```

### 🟦 5. 객체의 구조 매칭(Partial Matching)

| Matcher | 설명 |
| --- | --- |
| `toMatchObject(obj)` | 실제 객체에 기대 객체의 키와 값이 모두 포함되어 있으면 통과합니다. 다른 속성이 더 있어도 됩니다. |
| `toHaveProperty(path, value?)` | 특정 속성이나 중첩 경로가 있는지 확인하며, 두 번째 인자를 전달하면 값도 함께 검증합니다. |

```typescript
import { describe, expect, it } from 'vitest';

describe('객체 부분 매칭과 속성 검증', () => {
  const userResponse = {
    id: 1,
    name: 'Gemini',
    email: 'ai@google.com',
    settings: {
      theme: 'dark',
      notifications: true,
    },
    lastLogin: new Date().toISOString(),
  };

  it('toMatchObject로 중요한 필드만 검증합니다', () => {
    // id와 lastLogin의 값과 관계없이 이름과 이메일을 검증합니다.
    expect(userResponse).toMatchObject({
      name: 'Gemini',
      email: 'ai@google.com',
    });

    // 중첩된 객체의 일부도 검증할 수 있습니다.
    expect(userResponse).toMatchObject({
      settings: { theme: 'dark' },
    });
  });

  it('toHaveProperty로 속성의 존재 여부와 값을 검증합니다', () => {
    // 속성이 존재하는지 확인합니다.
    expect(userResponse).toHaveProperty('id');

    // 점 표기법으로 중첩된 속성의 값을 확인합니다.
    expect(userResponse).toHaveProperty('settings.theme', 'dark');

    // 비대칭 Matcher를 사용하여 값의 타입만 확인합니다.
    expect(userResponse).toHaveProperty('lastLogin', expect.any(String));
  });
});
```

### 🟦 6. 비대칭 매칭(Asymmetric Matchers)

비대칭 매칭은 전체 객체를 비교할 때 특정 필드의 정확한 값 대신 조건을 검증하는 방법입니다.  

| Matcher | 의미 | 사례 |
| --- | --- | --- |
| `expect.any(Type)` | 특정 타입 또는 생성자의 인스턴스인지 검증합니다. | Number, String, Date, Function 검사 |
| `expect.anything()` | `null`과 `undefined`가 아닌 값인지 검증합니다. | 값의 존재 여부 확인 |
| `expect.stringContaining(str)` | 문자열에 특정 문구가 포함되어 있는지 검증합니다. | 로그와 오류 메시지 일부 확인 |
| `expect.stringMatching(regex)` | 문자열이 정규 표현식과 일치하는지 검증합니다. | 토큰, UUID, 해시 패턴 검사 |
| `expect.arrayContaining(items)` | 배열이 특정 요소를 포함하는지 검증합니다. | 순서와 무관하게 핵심 항목 확인 |
| `expect.objectContaining(obj)` | 객체가 특정 속성 집합을 포함하는지 검증합니다. | API 응답의 일부 필드 검증 |

```typescript
import { describe, expect, it } from 'vitest';

describe('비대칭 Matcher 실습', () => {
  it('무작위 값이 포함된 API 응답을 검증합니다', () => {
    const apiResponse = {
      id: 42,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      username: 'vitest_tester',
      roles: ['admin', 'editor', 'viewer'],
      metadata: {
        lastLogin: new Date(),
        ip: '127.0.0.1',
      },
    };

    expect(apiResponse).toEqual({
      // id는 어떤 숫자든 허용합니다.
      id: expect.any(Number),

      // uuid는 지정한 정규 표현식과 일치해야 합니다.
      uuid: expect.stringMatching(/^[a-f0-9-]{36}$/),

      // username은 정확히 일치해야 합니다.
      username: 'vitest_tester',

      // roles에 지정한 항목이 순서와 관계없이 포함되어야 합니다.
      roles: expect.arrayContaining(['admin', 'editor']),

      // metadata의 일부 필드와 타입을 검증합니다.
      metadata: expect.objectContaining({
        lastLogin: expect.any(Date),
        ip: expect.anything(),
      }),
    });
  });

  it('관심 있는 필드만 부분적으로 검증합니다', () => {
    const user = { id: 1, name: 'John', email: 'john@example.com' };

    expect(user).toEqual(
      expect.objectContaining({
        email: 'john@example.com',
      }),
    );
  });
});
```

### 🟦 7. 예외 및 비동기 처리(Errors & Promises)

| 상황 | 패턴 | Matcher |
| --- | --- | --- |
| 동기 함수가 오류를 던지는 경우 | `expect(() => fn())` | `.toThrow()` |
| 비동기 함수가 성공하는 경우 | `await expect(fn())` | `.resolves.toBe(...)` |
| 비동기 함수가 오류를 던지는 경우 | `await expect(fn())` | `.rejects.toThrow()` |

### 🔷 핵심 주의 사항: 함수로 감싸기

동기 함수의 오류를 검증할 때 `expect(failGracefully())`처럼 함수를 먼저 실행하면 Vitest가 오류를 확인하기 전에 예외가 발생합니다.  
반드시 `() => failGracefully()`처럼 함수로 감싸서 전달해야 Vitest가 실행 중 발생한 오류를 확인할 수 있습니다.  

다음 예제는 `toThrow`로 동기 함수의 오류를 검증합니다.  

```typescript
const withdrawMoney = (amount: number) => {
  if (amount < 0) {
    throw new Error('음수 금액은 출금할 수 없습니다.');
  }
};

it('출금 오류를 검증합니다', () => {
  // 오류 발생 여부를 확인합니다.
  expect(() => withdrawMoney(-100)).toThrow();

  // 오류 메시지에 특정 문자열이 포함되는지 확인합니다.
  expect(() => withdrawMoney(-100)).toThrow('음수 금액');

  // 특정 Error 클래스의 인스턴스인지 확인합니다.
  expect(() => withdrawMoney(-100)).toThrow(Error);
});
```

다음 예제는 `resolves`와 `rejects`로 Promise의 성공과 실패를 검증합니다.  

```typescript
const fetchUser = async (id: number) => {
  if (id <= 0) {
    throw new Error('Invalid ID');
  }

  return { id, name: 'User' + id };
};

it('비동기 성공과 실패를 검증합니다', async () => {
  // Promise가 기대한 값으로 이행되는지 확인합니다.
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'User1' });

  // Promise가 기대한 오류로 거부되는지 확인합니다.
  await expect(fetchUser(0)).rejects.toThrow('Invalid ID');
});
```

Promise의 결과를 먼저 `await`한 뒤 일반 Matcher로 검증할 수도 있습니다.  

```typescript
it('await로 비동기 결과를 직접 검증합니다', async () => {
  const result = await fetchUser(10);

  expect(result.id).toBe(10);
  expect(result.name).toContain('User');
});
```

### 🟦 8. 호출 여부 검증(Spies & Mocks)

상태나 결과 값이 아니라 함수가 어떻게 호출되었는지 검증합니다.  
외부 API 호출, 로그 기록과 이벤트 핸들러 실행 여부 등을 확인할 때 사용합니다.  

| Matcher | 설명 |
| --- | --- |
| `toHaveBeenCalled()` | 함수가 한 번 이상 호출되었는지 검증합니다. |
| `toHaveBeenCalledTimes(n)` | 함수가 정확히 `n`번 호출되었는지 검증합니다. |
| `toHaveBeenCalledWith(...args)` | 함수에 전달된 인자가 기대 값과 일치하는지 검증합니다. |
| `toHaveBeenLastCalledWith(...args)` | 마지막 호출에 전달된 인자를 검증합니다. |

```typescript
import { describe, expect, it, vi } from 'vitest';

describe('함수 호출 행위 검증', () => {
  it('Spy와 Mock을 활용하여 호출 정보를 검증합니다', () => {
    // 호출 여부와 인자를 기록하는 Mock 함수를 생성합니다.
    const sendNotification = vi.fn((message: string, code?: number) => true);

    // 실제 비즈니스 로직에서 호출되는 상황을 표현합니다.
    sendNotification('결제가 완료되었습니다.', 200);
    sendNotification('배송이 시작되었습니다.', 300);

    expect(sendNotification).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledTimes(2);

    // 특정 인자로 호출되었는지 확인합니다.
    expect(sendNotification).toHaveBeenCalledWith(
      '결제가 완료되었습니다.',
      expect.any(Number),
    );

    // 마지막 호출의 인자를 확인합니다.
    expect(sendNotification).toHaveBeenLastCalledWith(
      '배송이 시작되었습니다.',
      300,
    );
  });

  it('객체 인자를 부분적으로 검증합니다', () => {
    const updateUser = vi.fn();

    updateUser({ id: 1, name: 'Alice', role: 'admin' });

    // 객체의 모든 속성을 나열하지 않고 관심 있는 속성만 확인합니다.
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice' }),
    );
  });
});
```
