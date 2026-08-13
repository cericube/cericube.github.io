---
layout: post
title: "03. Vitest Lifecycle, Async, 실행 제어 API"
description: "Vitest의 Lifecycle Hook과 비동기 테스트 작성법을 알아보고, 테스트 실행 범위를 제어하는 방법을 예제로 익힙니다."
category_id: nodejs-vitest
categories: [nodejs, nodejs-vitest]
series: vitest
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. Lifecycle Hook API"
  - id: session-02
    title: "2. 비동기 테스트 패턴(async/await)"
  - id: session-03
    title: "3. 테스트 실행 제어 API"
---

## 1. Lifecycle Hook API {#session-01}

Lifecycle Hook은 테스트를 실행하기 전이나 실행한 후에 특정 작업을 처리하는 API입니다.  
서버 시작, 데이터베이스 초기화와 Mock 초기화 등에 자주 사용합니다.  

### 🟦 1. Lifecycle 실행 순서

#### 🔷 beforeAll과 afterAll

- `beforeAll`은 현재 파일 또는 `describe` 범위의 테스트를 시작하기 전에 한 번 실행합니다.  
- `afterAll`은 해당 범위의 모든 테스트를 마친 후 한 번 실행합니다.  
- 여러 테스트가 함께 사용하는 리소스를 준비하고 정리할 때 적합합니다.  

#### 🔷 beforeEach와 afterEach

- `beforeEach`는 각 테스트를 시작하기 전에 실행합니다.  
- `afterEach`는 각 테스트가 끝난 후 실행합니다.  
- 테스트마다 상태를 초기화하고 정리하여 서로 영향을 주지 않게 합니다.  

```text
1. beforeAll: 현재 범위가 시작될 때 한 번 실행합니다.
   2. beforeEach: 테스트 A를 시작하기 전에 실행합니다.
      3. it/test: 테스트 A를 실행합니다.
   4. afterEach: 테스트 A가 끝난 후 실행합니다.
   5. beforeEach: 테스트 B를 시작하기 전에 실행합니다.
      6. it/test: 테스트 B를 실행합니다.
   7. afterEach: 테스트 B가 끝난 후 실행합니다.
8. afterAll: 현재 범위가 끝날 때 한 번 실행합니다.
```

일반적으로 공통 환경 준비는 `beforeAll`, 각 테스트의 상태 초기화는 `beforeEach`로 나누면 안정적으로 관리할 수 있습니다.  

### 🟦 2. Lifecycle Hook 예제

```typescript
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

const mockDb = {
  users: [] as string[],
  connect: async () => console.log('DB 연결 성공'),
  disconnect: async () => console.log('DB 연결 종료'),
  clear: () => {
    mockDb.users = [];
  },
};

describe('Lifecycle 테스트', () => {
  // 이 describe의 테스트를 시작하기 전에 DB에 한 번 연결합니다.
  beforeAll(async () => {
    await mockDb.connect();
  });

  // 이 describe의 모든 테스트를 마친 후 연결을 한 번 종료합니다.
  afterAll(async () => {
    await mockDb.disconnect();
  });

  // 각 테스트가 같은 초기 상태에서 시작하도록 데이터를 비웁니다.
  beforeEach(() => {
    mockDb.clear();
    console.log('테스트 데이터 초기화');
  });

  // 각 테스트가 남긴 데이터를 정리합니다.
  afterEach(() => {
    mockDb.clear();
    console.log('테스트 데이터 정리');
  });

  it('새로운 사용자를 추가할 수 있습니다', () => {
    mockDb.users.push('Alice');

    expect(mockDb.users.length).toBe(1);
    expect(mockDb.users).toContain('Alice');
  });

  it('각 테스트는 독립된 상태에서 시작합니다', () => {
    expect(mockDb.users.length).toBe(0);
  });
});
```

![Vitest Lifecycle Hook 실행 결과 예시](/assets/images/nodejs/nodejs-vitest/vitest-lifecycle-output.png)

### 🟦 3. 중첩된 describe의 실행 순서

`describe`가 중첩되면 바깥쪽 `beforeEach`부터 안쪽 `beforeEach` 순서로 실행한 뒤 테스트 본문을 실행합니다.  
정리 Hook이 있다면 기본 설정에서는 안쪽 정리 Hook부터 바깥쪽 정리 Hook 순서로 실행합니다.  

```typescript
describe('outer', () => {
  beforeEach(() => console.log('outer beforeEach'));

  describe('inner', () => {
    beforeEach(() => console.log('inner beforeEach'));

    it('test', () => {
      console.log('test case body');
    });
  });
});
```

실행 결과는 다음과 같습니다.  

```text
outer beforeEach
inner beforeEach
test case body
```

## 2. 비동기 테스트 패턴(async/await) {#session-02}

데이터베이스 조회와 API 호출 같은 비동기 작업은 완료되는 데 시간이 걸립니다.  
따라서 Vitest가 비동기 작업이 끝날 때까지 기다릴 수 있도록 테스트를 작성해야 합니다.  

### 🟦 1. async/await 패턴

`async`와 `await`를 사용하면 비동기 테스트도 위에서 아래로 읽을 수 있어 이해하기 쉽습니다.  

```typescript
interface User {
  id: number;
  name: string;
  role: string;
}

// 비동기 데이터베이스 조회 상황을 표현한 함수입니다.
async function getUserById(id: number): Promise<User> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ id, name: 'Alice', role: 'admin' });
    }, 100);
  });
}

it('[ASYNC] 존재하는 사용자의 정보를 반환합니다', async () => {
  // Promise가 처리될 때까지 기다린 뒤 반환 값을 검증합니다.
  const user = await getUserById(1);

  expect(user.name).toBe('Alice');
  expect(user.role).toBe('admin');
});
```

### 🟦 2. resolves와 rejects

`resolves`와 `rejects`를 사용하면 Promise의 성공과 실패를 직접 검증할 수 있습니다.  
두 Matcher가 반환하는 Promise를 반드시 `await`해야 Vitest가 검증이 끝날 때까지 기다립니다.  

```typescript
it('[RESOLVES] 성공하면 사용자 이름을 포함합니다', async () => {
  await expect(getUserById(1)).resolves.toMatchObject({ name: 'Alice' });
});

it('[REJECTS] 잘못된 ID를 입력하면 오류를 던집니다', async () => {
  const failJob = () => Promise.reject(new Error('Invalid ID'));

  await expect(failJob()).rejects.toThrow('Invalid ID');
});
```

### 🟦 3. Timeout 제어: 기본값 5초

Timeout은 네트워크 지연이나 끝나지 않는 비동기 작업 때문에 테스트가 무한정 기다리는 상황을 방지합니다.  

- 개별 테스트 설정은 특정 작업이 평소보다 오래 걸릴 것으로 예상할 때 사용합니다.  
- 전역 설정은 프로젝트 전체 테스트의 기본 제한 시간을 정할 때 사용합니다.  

```typescript
// 세 번째 인자로 개별 테스트의 제한 시간을 밀리초 단위로 지정합니다.
it(
  '[TIMEOUT] 3초 이내에 외부 API 응답을 받아야 합니다',
  async () => {
    const user = await getUserById(1);
    expect(user.name).toBe('Alice');
  },
  3_000,
);
```

`vitest.config.ts`에서 프로젝트 전체의 기본 Timeout도 설정할 수 있습니다.  

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 모든 테스트의 기본 제한 시간을 10초로 설정합니다.
    testTimeout: 10_000,
  },
});
```

### 🟦 4. Promise 반환 패턴

`async`와 `await` 대신 테스트 함수에서 Promise를 직접 반환할 수도 있습니다.  
Vitest는 반환된 Promise가 처리될 때까지 기다립니다.  

```typescript
it('[PROMISE] Promise를 반환하여 비동기 작업을 제어합니다', () => {
  // return을 생략하면 Vitest가 이 Promise를 기다리지 못할 수 있습니다.
  return getUserById(1).then((user) => {
    expect(user.id).toBe(1);
  });
});
```

## 3. 테스트 실행 제어 API {#session-03}

필요한 테스트만 골라 실행하면 현재 작업과 관련된 결과에 집중할 수 있습니다.  

### 🟦 1. only와 skip: 집중 실행과 제외

복잡한 오류를 수정하거나 한 기능만 확인할 때는 특정 테스트만 선택하여 실행하는 것이 효율적입니다.  
Vitest에서는 `it.only`, `describe.only`, `it.skip`, `describe.skip`으로 실행 대상을 제어할 수 있습니다.  

```typescript
class Cart {
  items: Record<string, number> = {};

  add(name: string, quantity: number) {
    if (quantity < 0) {
      throw new Error('상품 수량은 음수가 될 수 없습니다.');
    }

    this.items[name] = (this.items[name] ?? 0) + quantity;
  }
}

describe('장바구니 기능 테스트', () => {
  // .only를 붙인 테스트에 집중하여 실행합니다.
  it.only('상품을 추가하면 수량이 증가해야 합니다', () => {
    const cart = new Cart();
    cart.add('Apple', 1);

    expect(cart.items.Apple).toBe(1);
  });

  it('상품 수량은 음수가 될 수 없습니다', () => {
    const cart = new Cart();

    // 같은 파일에 .only가 있으므로 현재 실행에서는 건너뜁니다.
    expect(() => cart.add('Apple', -1)).toThrow();
  });

  // .skip은 구현 중이거나 잠시 실행하지 않을 테스트에 사용합니다.
  it.skip('할인 쿠폰 적용 로직', () => {
    // 구현이 끝나면 .skip을 제거합니다.
  });
});
```

> `.only`를 커밋하면 다른 테스트가 실행되지 않을 수 있습니다.  
> Vitest는 기본적으로 CI 환경에서 `.only`를 발견하면 전체 테스트 실행을 실패로 처리하지만, 커밋하기 전에 제거하는 습관이 중요합니다.  

### 🟦 2. describe.concurrent: 파일 내부 병렬 실행

Vitest는 기본적으로 테스트 파일을 병렬로 실행합니다.  
`describe.concurrent`를 사용하면 한 파일 안의 테스트도 동시에 실행할 수 있습니다.  
Race Condition, 데이터 충돌과 불안정한 테스트가 생길 수 있으므로 각 테스트가 독립적일 때만 사용하는 것이 안전합니다.  

```typescript
const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

describe.concurrent('병렬 실행 테스트', () => {
  it('테스트 A', async () => {
    console.log('[A] start:', Date.now());
    await delay(1_000);
    console.log('[A] end:', Date.now());
    expect(true).toBe(true);
  });

  it('테스트 B', async () => {
    console.log('[B] start:', Date.now());
    await delay(500);
    console.log('[B] end:', Date.now());
    expect(true).toBe(true);
  });
});
```

### 🟦 3. 파일과 테스트 이름으로 실행

CLI에서는 특정 파일이나 테스트 이름을 기준으로 실행 대상을 좁힐 수 있습니다.  

특정 파일만 실행합니다.  

```bash
npx vitest tests/services/user.service.test.ts
```

파일 경로에 `auth`가 포함된 테스트 파일만 실행합니다.  

```bash
npx vitest auth
```

UI 모드로 실행합니다.  

```bash
npx vitest --ui
```

### 🟦 4. 테스트 이름 규칙을 활용한 분류

프로젝트가 커지면 테스트 이름에 `[SMOKE]`, `[SLOW]` 같은 분류 표시를 붙여 실행 대상을 구분할 수 있습니다.  
이 방식은 Vitest의 태그 API가 아니라 테스트 이름을 `-t` 또는 `--testNamePattern`으로 검색하는 규칙입니다.  

```typescript
import { it } from 'vitest';

it('[SMOKE] 결제 승인 API를 호출합니다', () => {
  // 핵심 비즈니스 로직을 검증합니다.
});

it('[SLOW] 대량 결제 내역을 내려받습니다', () => {
  // 실행 시간이 오래 걸리는 작업을 검증합니다.
});
```

```bash
# 이름에 SMOKE가 포함된 테스트만 실행합니다.
npx vitest -t SMOKE

# 이름에 SLOW가 포함되지 않은 테스트만 실행합니다.
npx vitest --testNamePattern='^(?!.*SLOW).*'
```

`-t` 또는 `--testNamePattern`은 테스트 이름 전체를 정규 표현식으로 검색합니다.  

![Vitest 테스트 이름 필터 실행 예시](/assets/images/nodejs/nodejs-vitest/vitest-name-filter-output.png)

이름 규칙은 다음과 같이 정할 수 있습니다.  

| 이름 표시 | 목적 |
| --- | --- |
| `[SMOKE]` | 핵심 기능을 빠르게 검증합니다. |
| `[SLOW]` | 실행 시간이 긴 테스트를 구분합니다. |
| `[E2E]` | 전체 흐름을 확인하는 시나리오 테스트를 구분합니다. |
| `[DB]` | 데이터베이스에 의존하는 테스트를 구분합니다. |
| `[FLAKY]` | 실행 결과가 불안정한 테스트를 관리합니다. |
