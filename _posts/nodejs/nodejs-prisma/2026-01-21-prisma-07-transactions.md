---
layout: post
title: "07. Prisma 트랜잭션과 데이터 정합성"
description: "Prisma 7의 배열·대화형 트랜잭션과 중첩 쓰기를 살펴보고, 시간 제한·격리 수준·롤백으로 데이터 정합성을 지키는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 07
ai_assisted: true
toc:
  - id: session-01
    title: "1. 트랜잭션의 역할과 데이터 정합성 전략"
  - id: session-02
    title: "2. Prisma 트랜잭션의 종류와 사용 시점"
  - id: session-03
    title: "3. 트랜잭션 고급 제어 옵션과 성능 최적화 전략"
  - id: session-04
    title: "4. 트랜잭션 기반 다중 CRUD 처리 실습"
---

## 1. 트랜잭션의 역할과 데이터 정합성 전략 {#session-01}

트랜잭션(Transaction)은 여러 데이터베이스 작업을 하나의 논리적인 작업 단위로 묶어 처리하는 기능입니다.  
트랜잭션은 다음 두 가지 결과 중 하나를 보장합니다.  

- 모든 작업이 성공하면 변경 사항을 모두 반영합니다(Commit).
- 하나라도 실패하면 변경 사항을 모두 취소합니다(Rollback).

관계형 데이터베이스에서 트랜잭션은 데이터 정합성을 지키는 핵심 기능이며, Prisma도 데이터베이스가 제공하는 트랜잭션을 활용합니다.  

### 🟦 왜 트랜잭션이 필요한가요?

서로 연관된 데이터베이스 작업은 모두 성공하거나 모두 실패해야 합니다.  
트랜잭션 없이 다음과 같이 코드를 작성하면 데이터 정합성이 깨질 수 있습니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

// ❌ 위험한 코드: 두 작업이 각각 실행되므로 원자성을 보장하지 못합니다.
const user = await prisma.user.create({
  data: { email: 'a@test.com' },
});

// 이 작업이 실패해도 앞에서 생성한 User는 데이터베이스에 남습니다.
await prisma.post.create({
  data: {
    title: '첫 게시글',
    authorId: user.id,
  },
});
```

`user.create()`가 완료된 뒤 `post.create()`가 실패하면 게시글이 없는 사용자만 남습니다.  
두 데이터가 항상 함께 생성되어야 하는 상황이라면 불완전한 상태가 됩니다.  

### 🟦 최적화 팁: 중첩 쓰기(Nested Writes)

관계가 정의된 데이터를 함께 생성하는 단순한 작업이라면 `$transaction()`을 직접 호출하기보다 중첩 쓰기를 사용할 수 있습니다.  
중첩 쓰기는 한 번의 Prisma Client 호출로 관계 데이터를 저장하며, 전체 작업의 원자성을 보장합니다.  
실제 `src/ch07/nested-write-examples.ts` 코드는 4절에서 살펴봅니다.  
다만 한 번의 Prisma Client 호출이라는 뜻이며, 데이터베이스에 항상 SQL 한 문장만 전달된다는 뜻은 아닙니다.  

## 2. Prisma 트랜잭션의 종류와 사용 시점 {#session-02}

### 🟦 배열 기반 트랜잭션(Batch Transaction)

배열 기반 트랜잭션은 Prisma가 제공하는 가장 간단한 트랜잭션 방식입니다.  
서로의 결과에 의존하지 않는 여러 쿼리를 하나의 작업 단위로 묶을 때 사용합니다.  
다음 커밋과 롤백 예제는 `src/ch07/batch-transaction-examples.ts`의 코드를 따릅니다.  

- **원자성 보장**: 배열 안의 쿼리를 하나의 트랜잭션으로 묶습니다.  
- **자동 롤백**: 쿼리 하나라도 실패하면 트랜잭션 안의 변경 사항을 모두 취소합니다.  
- **간결한 코드**: 쿼리 순서와 개수가 고정된 단순 작업을 알아보기 쉽게 표현합니다.  
- **중간 결과 사용 불가**: 앞 쿼리에서 생성한 식별자를 뒤 쿼리에 전달할 수 없습니다.  
- **조건 분기 불가**: 배열 안에서 중간 결과에 따른 `if` 문이나 반복문을 사용할 수 없습니다.  

앞 작업에서 생성한 식별자를 다음 작업에서 사용해야 한다면 중첩 쓰기나 대화형 트랜잭션을 선택해야 합니다.  

#### 🔷 COMMIT 예시: 사용자 두 명을 함께 생성하기

다음 두 사용자 생성 작업은 서로의 결과에 의존하지 않습니다.  
두 작업이 모두 성공하면 결과가 데이터베이스에 반영됩니다.  

```typescript
import { prisma } from '../shared/database';

export async function runBatchCreateUsers(firstEmail: string, secondEmail: string) {
  // 배열의 PrismaPromise는 같은 트랜잭션에서 순서대로 실행됩니다.
  const [firstUser, secondUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: firstEmail,
        displayName: '첫 번째 트랜잭션 사용자',
      },
    }),
    prisma.user.create({
      data: {
        email: secondEmail,
        displayName: '두 번째 트랜잭션 사용자',
      },
    }),
  ]);

  const result = { firstUser, secondUser };
  console.log(result);
  return result;
}
```

#### 🔷 ROLLBACK 예시: 고유 제약 조건 위반하기

`User.email`은 고유한 값이어야 합니다.  
같은 이메일을 두 번 저장하면 두 번째 작업에서 `P2002` 오류가 발생하고 첫 번째 생성도 롤백됩니다.  

```typescript
export async function runBatchRollbackByDuplicateEmail(email: string) {
  // 두 번째 create()에서 P2002가 발생하면 첫 번째 create()도 롤백됩니다.
  return prisma.$transaction([
    prisma.user.create({
      data: {
        email,
        displayName: '롤백 대상 사용자 1',
      },
    }),
    prisma.user.create({
      data: {
        email,
        displayName: '롤백 대상 사용자 2',
      },
    }),
  ]);
}
```

### 🟦 대화형 트랜잭션(Interactive Transactions)

대화형 트랜잭션은 트랜잭션 도중에 데이터를 조회하거나 결과에 따라 다음 작업을 결정해야 할 때 사용합니다.  
단순 작업에는 중첩 쓰기나 배열 기반 트랜잭션이 더 간결하며, 조건 분기와 연쇄 작업이 필요할 때 대화형 트랜잭션이 알맞습니다.  

```typescript
await prisma.$transaction(async (tx) => {
  // 이 블록 안의 데이터베이스 작업에는 트랜잭션 전용 tx 객체를 사용합니다.
});
```

`tx`는 트랜잭션 범위 안에서만 사용하는 Prisma Client입니다.  
콜백이 정상적으로 끝나면 자동으로 커밋하고, 오류가 밖으로 전달되면 자동으로 롤백합니다.  

대화형 트랜잭션의 주요 특징은 다음과 같습니다.  

- 쿼리 결과에 따라 `if` 문으로 다음 작업을 결정할 수 있습니다.  
- 반복문을 사용하여 여러 데이터를 순서대로 처리할 수 있습니다.  
- 앞 쿼리에서 생성한 식별자를 다음 쿼리의 입력값으로 사용할 수 있습니다.  
- 오류를 던져 비즈니스 규칙에 맞지 않는 작업을 롤백할 수 있습니다.  

트랜잭션 안에서 오류를 잡은 뒤 정상 종료하면 커밋될 수 있습니다.  
롤백해야 하는 오류라면 처리한 뒤 반드시 다시 던져야 합니다.  

#### 🔷 예제: 사용자 생성 후 결과에 따라 로직 제어하기

다음은 `src/ch07/interactive-transaction-examples.ts`의 첫 번째 예제입니다.  
사용자를 생성한 뒤 이메일 도메인을 확인합니다.  
허용하지 않은 도메인이면 오류를 던지므로 이미 실행한 사용자 생성도 롤백됩니다.  

```typescript
const ALLOWED_EMAIL_DOMAIN = '@example.com';

function isAllowedEmailDomain(email: string): boolean {
  return email.endsWith(ALLOWED_EMAIL_DOMAIN);
}

export async function runInteractiveCreateUserWithPost(email: string, postTitle: string) {
  const result = await prisma.$transaction(async (tx) => {
    // 첫 번째 작업에서 사용자를 생성하고 다음 작업에 필요한 id를 받습니다.
    const user = await tx.user.create({
      data: {
        email,
        displayName: email.split('@')[0] || null,
      },
      // select는 반환할 필드만 제한하며 저장되는 컬럼에는 영향을 주지 않습니다.
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    // 데이터베이스 오류가 아닌 서비스의 가입 정책을 검사합니다.
    if (!isAllowedEmailDomain(user.email)) {
      // 이 오류가 콜백 밖으로 전달되면 user.create()도 롤백됩니다.
      throw new Error('example.com 도메인 이메일만 가입할 수 있습니다.');
    }

    // 앞에서 생성한 user.id를 게시글의 외래 키로 사용합니다.
    const post = await tx.post.create({
      data: {
        title: postTitle,
        authorId: user.id,
      },
    });

    return { user, post };
  });

  console.dir(result, { depth: null });
  return result;
}
```

### 🟦 트랜잭션 형태 선택 기준과 주의 사항

상황에 맞는 트랜잭션 선택 기준은 다음과 같습니다.  

| 구분 | 배열 기반 트랜잭션 | 대화형 트랜잭션 |
| --- | --- | --- |
| 핵심 개념 | 정해진 쿼리를 한 번에 실행합니다. | 로직에 따라 쿼리를 유연하게 실행합니다. |
| 적합한 상황 | 쿼리 순서와 개수가 고정된 독립 작업 | 비즈니스 규칙과 조건 분기가 필요한 작업 |
| 로직 제어 | 중간 결과를 이용할 수 없습니다. | 중간 결과에 조건문과 반복문을 적용할 수 있습니다. |
| 실무 예시 | 독립적인 여러 레코드의 일괄 변경 | 재고 확인 후 주문 생성과 같은 연쇄 작업 |
| 장점 | 코드가 간결하고 의도가 명확합니다. | 복잡한 로직과 오류 처리를 유연하게 구성합니다. |
| 단점 | 앞 쿼리의 결과를 다음 쿼리에 전달할 수 없습니다. | 코드가 길어지고 트랜잭션이 오래 유지될 수 있습니다. |

대화형 트랜잭션에서 자주 하는 실수는 `tx` 대신 전역 `prisma` 객체를 사용하는 것입니다.  

#### 🔷 잘못된 코드

전역 `prisma`로 실행한 쿼리는 대화형 트랜잭션에 포함되지 않으므로 콜백에서 오류가 발생해도 함께 롤백되지 않습니다.  

```typescript
await prisma.$transaction(async () => {
  // ❌ 전역 prisma로 실행하므로 현재 대화형 트랜잭션에 포함되지 않습니다.
  await prisma.user.create({
    data: { email: 'outside@example.com' },
  });

  throw new Error('트랜잭션 롤백 테스트');
});
```

#### 🔷 올바른 코드

트랜잭션에 포함할 모든 데이터베이스 작업은 매개변수로 받은 `tx` 객체로 실행합니다.  

```typescript
await prisma.$transaction(async (tx) => {
  // ✅ tx로 실행한 작업은 아래 오류가 발생하면 함께 롤백됩니다.
  await tx.user.create({
    data: { email: 'inside@example.com' },
  });

  throw new Error('트랜잭션 롤백 테스트');
});
```

## 3. 트랜잭션 고급 제어 옵션과 성능 최적화 전략 {#session-03}

대화형 트랜잭션에는 실행 시간, 커넥션 대기 시간과 격리 수준을 조절하는 옵션이 있습니다.  
서비스 환경과 데이터베이스 설정을 살펴본 뒤 필요한 값만 조정합니다.  
다음은 `src/ch07/transaction-options-examples.ts`의 첫 번째 예제입니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTransactionWithOptions(userId: number, displayName: string) {
  const result = await prisma.$transaction(
    async (tx) => {
      // User를 수정한 뒤 같은 트랜잭션에서 게시글 수를 조회합니다.
      const user = await tx.user.update({
        where: { id: userId },
        data: { displayName },
      });

      const postCount = await tx.post.count({
        where: { authorId: user.id },
      });

      return { user, postCount };
    },
    {
      maxWait: 2_000,
      timeout: 5_000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    },
  );

  console.log(result);
  return result;
}
```

| 옵션 | 설명 |
| --- | --- |
| `timeout` | 대화형 트랜잭션 콜백이 완료될 때까지 허용하는 최대 시간입니다. |
| `maxWait` | 트랜잭션을 시작할 수 있을 때까지 기다리는 최대 시간입니다. |
| `isolationLevel` | 동시에 실행되는 트랜잭션 사이의 데이터 가시성 규칙을 지정합니다. |

`timeout`과 `maxWait`의 기본값은 각각 5,000ms와 2,000ms이지만, 적절한 값은 서비스 환경에 따라 다릅니다.  
너무 긴 트랜잭션은 데이터베이스 커넥션을 오래 점유하므로 필요한 쿼리만 포함하는 편이 좋습니다.  

### 🟦 트랜잭션 옵션: `timeout`과 `maxWait`

트랜잭션은 실행되는 동안 데이터베이스 커넥션을 점유합니다.  
커넥션은 한정된 자원이므로 트랜잭션을 짧게 유지해야 합니다.  

- **`timeout`**: 대화형 트랜잭션 콜백을 실행할 수 있는 최대 시간입니다.  
- **`maxWait`**: 트랜잭션을 시작할 수 있을 때까지 기다리는 최대 시간입니다.  

#### 🔷 예제: `timeout` 초과로 롤백 확인하기

다음은 같은 파일의 `runTransactionTimeoutRollback()` 예제입니다.  
기본 인자로 실행하면 50ms의 `timeout`보다 긴 100ms 동안 기다리므로, 트랜잭션이 실패하고 User 생성도 롤백됩니다.  

```typescript
export async function runTransactionTimeoutRollback(
  email: string,
  delayMs = 100,
  timeoutMs = 50,
) {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          displayName: 'timeout 롤백 사용자',
        },
      });

      await delay(delayMs);

      // timeout 이후 쿼리는 만료된 트랜잭션 오류를 발생시킵니다.
      return tx.post.create({
        data: {
          title: 'timeout 이후 생성 시도',
          authorId: user.id,
        },
      });
    },
    {
      maxWait: 2_000,
      timeout: timeoutMs,
    },
  );
}
```

이 코드는 동작 확인을 위한 예제이므로 실제 서비스에 강제 지연 코드를 넣으면 안 됩니다.  

### 🟦 격리 수준(Isolation Level)의 적용

격리 수준은 동시에 실행되는 트랜잭션이 서로의 변경 사항을 어느 범위까지 볼 수 있는지 정하는 규칙입니다.  
PostgreSQL에서 주로 사용하는 격리 수준은 다음과 같습니다.  

| 격리 수준 | 설명 |
| --- | --- |
| `ReadCommitted` | 각 쿼리는 실행을 시작할 때 이미 커밋된 데이터만 읽습니다. PostgreSQL의 기본 격리 수준입니다. |
| `RepeatableRead` | 트랜잭션이 보는 데이터 스냅샷을 유지하여 같은 데이터를 다시 읽어도 일관된 값을 확인할 수 있습니다. |
| `Serializable` | 트랜잭션이 순서대로 실행된 것과 같은 결과를 목표로 하며, 충돌 시 재시도가 필요할 수 있습니다. |

Prisma Client가 별도의 격리 수준을 지정하지 않으면 데이터베이스에 설정된 기본값을 사용합니다.  
격리 수준을 높이면 모든 동시성 문제가 자동으로 해결되는 것은 아니며, 충돌 오류와 재시도 전략도 함께 고려해야 합니다.  

#### 🔷 예제: `ReadCommitted`와 `RepeatableRead` 비교하기

다음은 `src/ch07/isolation-level-examples.ts`의 예제입니다.  
읽기 트랜잭션이 같은 User를 두 번 조회하는 사이 외부 쿼리가 `displayName`을 변경합니다.  
`ReadCommitted`는 두 번째 조회에서 커밋된 새 값을 볼 수 있지만, `RepeatableRead`는 첫 조회의 스냅샷을 유지합니다.  

```typescript
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../shared/database';

const INITIAL_DISPLAY_NAME = '격리 수준 초기 이름';
const UPDATED_DISPLAY_NAME = '외부 트랜잭션 변경 이름';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIsolationExperiment(
  email: string,
  isolationLevel: Prisma.TransactionIsolationLevel,
) {
  // 반복 실행할 수 있도록 초기 상태를 맞춥니다.
  await prisma.user.upsert({
    where: { email },
    update: { displayName: INITIAL_DISPLAY_NAME },
    create: {
      email,
      displayName: INITIAL_DISPLAY_NAME,
    },
  });

  const readerTransaction = prisma.$transaction(
    async (tx) => {
      const firstRead = await tx.user.findUniqueOrThrow({
        where: { email },
      });

      await delay(100);

      const secondRead = await tx.user.findUniqueOrThrow({
        where: { email },
      });

      return { firstRead, secondRead };
    },
    { isolationLevel },
  );

  const writerTransaction = (async () => {
    await delay(25);
    return prisma.user.update({
      where: { email },
      data: { displayName: UPDATED_DISPLAY_NAME },
    });
  })();

  const [reads, committedUser] = await Promise.all([readerTransaction, writerTransaction]);

  const result = { ...reads, committedUser };
  console.dir(result, { depth: null });
  return result;
}

export function runReadCommitted(email: string) {
  return runIsolationExperiment(email, Prisma.TransactionIsolationLevel.ReadCommitted);
}

export function runRepeatableRead(email: string) {
  return runIsolationExperiment(email, Prisma.TransactionIsolationLevel.RepeatableRead);
}
```

이 예제는 실행 순서를 쉽게 확인하기 위해 짧은 지연 시간을 사용합니다.  
실제 동시성 테스트에서는 여러 번 반복하고 데이터베이스 로그도 함께 확인해야 합니다.  

### 🟦 트랜잭션 최소화: 짧고 단순하게 유지하기

트랜잭션 안에서 이미지 업로드나 알림 발송 같은 외부 API를 호출하면 응답을 기다리는 동안 데이터베이스 커넥션도 계속 점유합니다.  
이런 작업은 가능한 한 트랜잭션 밖으로 분리합니다.  

#### 🔷 나쁜 예시

```typescript
declare const snsService: {
  share(postId: number): Promise<boolean>;
};

await prisma.$transaction(async (tx) => {
  const post = await tx.post.create({
    data: {
      title: 'Hello',
      authorId: 1,
    },
  });

  // ❌ 외부 API가 늦어지면 트랜잭션과 DB 커넥션도 오래 유지됩니다.
  await snsService.share(post.id);
});
```

#### 🔷 좋은 예시

```typescript
declare const snsService: {
  share(postId: number): Promise<boolean>;
};

// 1. 게시글을 비공개 상태로 먼저 저장합니다.
const post = await prisma.post.create({
  data: {
    title: 'Hello',
    authorId: 1,
    published: false,
  },
});

// 2. 데이터베이스 트랜잭션 밖에서 외부 API를 호출합니다.
const isShared = await snsService.share(post.id);

// 3. 외부 작업에 성공했을 때만 게시글 상태를 변경합니다.
if (isShared) {
  await prisma.post.update({
    where: { id: post.id },
    data: { published: true },
  });
}
```

이 구조에서는 외부 API 호출에 실패해도 비공개 게시글이 남을 수 있습니다.  
서비스 요구 사항에 따라 재시도 작업이나 실패 상태 기록을 별도로 설계해야 합니다.  

### 🟦 중첩 쓰기: `$transaction()`의 대안

Prisma 스키마에 관계가 정의되어 있다면 중첩 쓰기로 여러 관계 작업을 하나의 원자적인 작업으로 처리할 수 있습니다.  
명시적인 `$transaction()`보다 코드가 짧고 관계도 분명하게 드러납니다.  

`src/ch07/nested-write-examples.ts`에서는 User와 Post를 함께 생성하는 예제와 Post와 첫 좋아요를 함께 생성하는 예제를 제공합니다.  
두 예제의 전체 코드는 다음 실습 절에서 확인합니다.  

## 4. 트랜잭션 기반 다중 CRUD 처리 실습 {#session-04}

### 🟦 예제 1: 사용자와 첫 게시글 함께 생성하기

사용자가 가입할 때 첫 게시글도 반드시 함께 생성해야 하는 상황입니다.  
게시글 생성에 실패하면 사용자 데이터도 남지 않아야 합니다.  
다음은 `src/ch07/nested-write-examples.ts`의 첫 번째 예제입니다.  

```typescript
import { prisma } from '../shared/database';

export async function runNestedCreateUserWithPost(email: string, firstPostTitle: string) {
  const user = await prisma.user.create({
    data: {
      email,
      displayName: email.split('@')[0] || null,
      posts: {
        // 생성된 User의 id가 Post.authorId에 자동으로 연결됩니다.
        create: {
          title: firstPostTitle,
          published: false,
        },
      },
    },
    // include는 반환 결과에 생성된 Post를 추가합니다.
    include: {
      posts: true,
    },
  });

  console.dir(user, { depth: null });
  return user;
}
```

이 예제는 관계가 정의된 단순 생성이므로 대화형 트랜잭션 대신 중첩 쓰기를 사용합니다.  
`authorId`를 직접 전달하지 않아도 생성된 User와 Post가 자동으로 연결됩니다.  

### 🟦 예제 2: 게시글 등록과 첫 좋아요 삽입하기

운영진이 게시글을 등록하면서 작성자의 첫 좋아요도 함께 저장하는 상황입니다.  
두 작업 중 하나라도 실패하면 게시글과 좋아요를 모두 롤백합니다.  
다음은 같은 파일의 두 번째 예제입니다.  

```typescript
export async function runNestedCreatePostWithInitialLike(authorId: number, title: string) {
  const post = await prisma.post.create({
    data: {
      title,
      content: '트랜잭션과 중첩 쓰기 예제입니다.',
      published: true,
      author: {
        // 기존 User를 새 Post의 작성자로 연결합니다.
        connect: { id: authorId },
      },
      likes: {
        create: {
          user: {
            // 같은 User를 첫 좋아요 관계에도 연결합니다.
            connect: { id: authorId },
          },
        },
      },
    },
    include: {
      author: true,
      likes: true,
    },
  });

  console.dir(post, { depth: null });
  return post;
}
```

### 🟦 예제 3: 오류 발생 시 롤백하고 예외 처리하기

트랜잭션 도중 비즈니스 규칙에 따라 오류를 던져 변경을 롤백하는 방법을 확인합니다.  
다음은 `src/ch07/interactive-transaction-examples.ts`의 두 번째 예제입니다.  

```typescript
export async function runPublishPostSafely(postId: number) {
  const post = await prisma.$transaction(async (tx) => {
    const currentPost = await tx.post.findUnique({
      where: { id: postId },
    });

    if (!currentPost) {
      throw new Error('POST_NOT_FOUND');
    }

    if (currentPost.published) {
      throw new Error('ALREADY_PUBLISHED_POST');
    }

    return tx.post.update({
      where: { id: currentPost.id },
      data: {
        title: `[공개] ${currentPost.title}`,
        published: true,
      },
    });
  });

  console.log(post);
  return post;
}
```

발생한 오류는 이 함수에서 삼키지 않고 호출한 곳으로 전달하여 실패 여부를 처리할 수 있게 합니다.  
트랜잭션에서는 어떤 작업을 한 단위로 묶을지 먼저 정하고, 그 범위 안의 쿼리에는 반드시 `tx` 객체를 사용해야 합니다.  
