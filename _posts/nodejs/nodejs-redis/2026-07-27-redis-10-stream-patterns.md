---
layout: post
title: "10. Redis Stream 실습: 이벤트 로그와 비동기 작업 큐"
description: "Redis Stream을 활용해 주문 이벤트, 알림과 이메일 작업 큐, 감사 로그를 저장하고 Consumer Group과 ACK로 비동기 작업을 처리하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 10
ai_assisted: true
toc:
  - id: session-01
    title: "1. 주문 이벤트 저장하기"
  - id: session-02
    title: "2. 알림 이벤트 큐 만들기"
  - id: session-03
    title: "3. 이메일 작업 큐 구현하기"
  - id: session-04
    title: "4. 감사 로그 저장하기"
---

Redis Stream은 Redis에서 이벤트 로그와 비동기 작업 큐를 구현할 때 사용할 수 있는 자료 구조입니다.  
List와 Pub/Sub도 메시지 처리에 사용할 수 있지만, Stream은 두 자료 구조와 성격이 다릅니다.  

![Redis List, Pub/Sub과 Stream의 특징 비교](/assets/images/nodejs/nodejs-redis/redis-stream-comparison.png)

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/redis-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 주문 이벤트 저장하기 {#session-01}

주문 서비스에서는 주문 생성, 결제 완료, 배송 시작, 주문 취소 같은 이벤트가 계속 발생합니다.  
예를 들어 주문 생성 시 다음과 같은 후속 처리가 필요할 수 있습니다.  

```text
주문 생성
  ↓
주문 생성 이벤트 저장
  ↓
재고 차감
  ↓
결제 요청
  ↓
알림 발송
  ↓
감사 로그 저장
```

이때 모든 작업을 주문 생성 API 안에서 동기적으로 처리하면 API 응답이 느려지고, 중간 작업이 실패했을 때 흐름이 복잡해집니다.  
Redis Stream을 사용하면 주문 생성 자체는 DB에 저장하고, 후속 처리를 위한 이벤트는 Stream에 기록할 수 있습니다.  

```text
OrderService
  ↓
DB에 주문 저장
  ↓
stream:orders에 주문 이벤트 저장
  ↓
worker가 stream:orders를 읽어서 후속 처리
```

### 🟦 주문 생성

```typescript
// src/ch10/order-stream.service.ts

/** 주문 생성에 필요한 입력 값입니다. */
export type CreateOrderInput = {
  userId: number;
  totalPrice: number;
};

/** Redis Stream에 기록할 수 있는 주문 이벤트 종류입니다. */
export type OrderEventType =
  | 'order.created'
  | 'order.paid'
  | 'order.cancelled'
  | 'order.shipped';

/** 주문과 Stream 이벤트에서 사용할 수 있는 주문 상태입니다. */
export type OrderStatus = 'CREATED' | 'PAID' | 'CANCELLED' | 'SHIPPED';

/** Redis Stream 메시지를 애플리케이션 값으로 변환한 출력 타입입니다. */
export type OrderEventOutput = {
  id: string;
  eventType: OrderEventType;
  orderId: number;
  userId: number;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
};

/** 주문 상태와 Stream 이벤트 종류의 대응 관계를 관리합니다. */
const OrderEventTypeByStatus: Record<OrderStatus, OrderEventType> = {
  CREATED: 'order.created',
  PAID: 'order.paid',
  CANCELLED: 'order.cancelled',
  SHIPPED: 'order.shipped',
};

/**
 * 주문을 생성하고 주문 생성 이벤트를 기록합니다.
 *
 * 1. Order 테이블에 주문을 저장합니다.
 * 2. 주문 생성 결과를 기준으로 Redis Stream에 order.created 이벤트를 기록합니다.
 * 3. 생성된 주문 정보를 반환합니다.
 *
 * DB는 현재 주문 상태의 원본 저장소입니다.
 * Redis Stream은 다른 worker나 서비스가 나중에 처리할 주문 생성 이벤트를 저장합니다.
 */
async createOrder(input: CreateOrderInput) {
  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      totalPrice: input.totalPrice,
      status: 'CREATED',
    },
  });

  await this.addOrderEvent({
    eventType: 'order.created',
    orderId: order.id,
    userId: order.userId,
    status: 'CREATED',
    totalPrice: order.totalPrice,
  });

  return order;
}

/**
 * XADD로 주문 이벤트를 Stream 끝에 추가합니다.
 * `*`를 사용하면 Redis가 메시지 ID를 자동으로 생성합니다.
 */
async addOrderEvent(input: {
  eventType: OrderEventType;
  orderId: number;
  userId: number;
  status: OrderStatus;
  totalPrice: number;
}): Promise<string> {
  const key = RedisKey.stream.orders();

  // 숫자 값은 Redis Stream에 저장할 수 있도록 문자열로 변환합니다.
  const messageId = await redis.xAdd(key, '*', {
    eventType: input.eventType,
    orderId: String(input.orderId),
    userId: String(input.userId),
    status: input.status,
    totalPrice: String(input.totalPrice),
    createdAt: new Date().toISOString(),
  });

  return messageId;
}
```

Stream 메시지는 명시적으로 삭제하거나 보존 길이를 제한하지 않는 한 Redis에 로그처럼 남습니다.  
따라서 나중에 `XRANGE`로 다시 조회하거나 Consumer Group으로 처리할 수 있습니다.  
현재 구현은 `MAXLEN`을 지정하지 않으므로 운영 환경에서는 Stream의 보존 기간이나 최대 길이 정책을 별도로 정해야 합니다.  

> DB 저장 후 Stream 기록에 실패할 수 있으므로, 실무에서는 두 저장소의 정합성을 보완하는 별도의 처리가 필요합니다.  

### 🟦 Stream 이벤트 처리 예

실제로 후속 처리를 하려면 별도의 worker가 필요합니다.  
예를 들어 다음과 같은 worker를 만들 수 있습니다.  

```typescript
// 예시: order-worker.ts

async function orderWorker() {
  const orderStreamService = new OrderStreamService();

  // 주문 이벤트를 최대 10개까지 가져옵니다.
  const events = await orderStreamService.getOrderEvents(10);

  for (const event of events) {
    if (event.eventType === 'order.created') {
      console.log('재고 차감 처리:', event.orderId);
      console.log('알림 발송 처리:', event.userId);
      console.log('이메일 발송 처리:', event.userId);
      console.log('감사 로그 저장:', event.orderId);
    }
  }
}
```

이 예제는 Stream에 저장한 이벤트를 읽어 후속 처리를 수행하는 기본 흐름을 보여 줍니다.  
`getOrderEvents()`는 `XRANGE`의 `-`와 `+`를 사용해 Stream의 처음부터 끝까지 조회하고, `COUNT`로 반환할 최대 개수를 제한합니다.  
조회한 문자열 필드는 `parseOrderEvent()`에서 숫자와 허용된 이벤트 타입으로 검증하고 변환합니다.  

```typescript
async getOrderEvents(count = 10): Promise<OrderEventOutput[]> {
  const key = RedisKey.stream.orders();

  // 오래된 이벤트부터 최대 count개까지 조회합니다.
  const entries = await redis.xRange(key, '-', '+', {
    COUNT: count,
  });

  return entries.map(parseOrderEvent);
}
```

따라서 `count`는 최근 이벤트 수가 아니라 Stream의 처음부터 조회할 최대 개수입니다.  
최근 이벤트부터 확인하려면 감사 로그 예제처럼 `XREVRANGE`를 사용해야 합니다.  
여러 worker가 작업을 중복 없이 나누어 처리해야 한다면 2절에서 설명하는 Consumer Group을 사용해야 합니다.  

![주문 생성 API와 후속 worker의 Redis Stream 처리 흐름](/assets/images/nodejs/nodejs-redis/redis-stream-order-event-flow.png)

### 🟦 주문 상태 변경

Redis Stream은 이벤트 흐름을 저장하고, DB는 현재 주문 상태를 저장합니다.  
두 저장소의 역할을 구분해서 이해해야 합니다.  

```typescript
/**
 * 주문 상태를 변경하고 상태에 맞는 변경 이벤트를 기록합니다.
 * DB에는 현재 상태를 저장하고, Stream에는 변경 이력을 순서대로 남깁니다.
 */
async changeOrderStatus(
  orderId: number,
  status: OrderStatus,
): Promise<void> {
  const order = await prisma.order.update({
    where: {
      id: orderId,
    },
    data: {
      status,
    },
  });

  // 허용된 주문 상태를 대응하는 Stream 이벤트 종류로 변환합니다.
  const eventType = OrderEventTypeByStatus[status];

  await this.addOrderEvent({
    eventType,
    orderId: order.id,
    userId: order.userId,
    status,
    totalPrice: order.totalPrice,
  });
}
```

예를 들어 결제 완료 상태로 변경하려면 다음과 같이 호출합니다.  

```typescript
await orderStreamService.changeOrderStatus(1, 'PAID');
```

그러면 DB의 주문 상태가 다음과 같이 바뀝니다.  

```text
Order Table

id | status
1  | PAID
```

그리고 Stream에는 이벤트가 추가됩니다.  

```text
stream:orders

eventType order.paid
orderId   1
status    PAID
```

이 이벤트를 읽은 worker는 다음 후속 작업을 할 수 있습니다.  

```text
order.paid 이벤트 수신
  ↓
결제 완료 알림 발송
  ↓
주문 완료 이메일 발송
  ↓
배송 준비 작업 생성
  ↓
감사 로그 저장
```

따라서 현재 상태는 DB에 저장하고, 상태 변경 사실은 Stream에 기록하는 구조가 됩니다.  

## 2. 알림 이벤트 큐 만들기 {#session-02}

알림은 사용자가 직접 기다릴 필요가 없는 작업입니다.  
예를 들어 다음과 같은 알림은 API 응답과 분리해서 처리할 수 있습니다.  

- 주문 생성 알림
- 댓글 작성 알림
- 좋아요 알림
- 관리자 공지 알림

Redis Stream을 사용하면 알림 이벤트를 큐처럼 저장하고 worker가 하나씩 읽어서 처리할 수 있습니다.  

### 🟦 Consumer Group

각 worker가 `xRange()`로 Stream을 조회하면 같은 메시지를 중복해서 읽을 수 있습니다.  
Consumer Group을 사용하면 Redis가 메시지의 분배 상태와 처리 상태를 관리합니다.  

![Consumer Group 사용 전후의 메시지 분배 방식 비교](/assets/images/nodejs/nodejs-redis/redis-stream-consumer-group-comparison.png)

따라서 알림 발송, 이메일 발송, 주문 후처리처럼 여러 worker가 나누어 처리해야 하는 작업에는 Consumer Group이 적합합니다.  

### 🟦 알림 이벤트 흐름

![Redis Stream 알림 이벤트의 등록, 분배, 처리와 ACK 흐름](/assets/images/nodejs/nodejs-redis/redis-stream-notification-flow.png)

### 🟦 알림 이벤트와 Consumer Group 생성

```typescript
// src/ch10/notification-stream.service.ts

/** worker의 처리 방식을 결정할 때 사용하는 알림 종류입니다. */
export type NotificationType =
  | 'order.created'
  | 'post.liked'
  | 'comment.created'
  | 'admin.notice';

export type NotificationEventInput = {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
};

export type NotificationJob = {
  id: string;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
};

/**
 * 알림 작업을 Redis Stream에 추가합니다.
 * 사용자 ID는 Redis에 저장할 수 있도록 문자열로 변환합니다.
 */
async addNotificationEvent(input: NotificationEventInput): Promise<string> {
  const key = RedisKey.stream.notifications();

  // 알림 작업을 Stream 끝에 추가하고 자동 생성된 메시지 ID를 반환합니다.
  return redis.xAdd(key, '*', {
    userId: String(input.userId),
    type: input.type,
    title: input.title,
    message: input.message,
    createdAt: new Date().toISOString(),
  });
}

/**
 * 알림 worker가 공유할 Consumer Group을 생성합니다.
 * `$`를 시작 ID로 지정해 그룹 생성 이후에 추가된 메시지부터 처리합니다.
 */
async createConsumerGroup(): Promise<void> {
  const key = RedisKey.stream.notifications();

  try {
    // MKSTREAM은 Stream이 없을 때 새 Stream도 함께 만듭니다.
    await redis.xGroupCreate(key, this.groupName, '$', {
      MKSTREAM: true,
    });
  } catch (error) {
    // 이미 그룹이 있다는 BUSYGROUP 오류만 무시합니다.
    if (error instanceof Error && error.message.includes('BUSYGROUP')) {
      return;
    }

    throw error;
  }
}
```

Stream에 기록된 작업은 worker가 즉시 실행 중이지 않아도 나중에 Consumer Group으로 읽을 수 있습니다.  
`BUSYGROUP` 이외의 오류는 연결 장애나 잘못된 명령일 수 있으므로 호출자에게 다시 전달합니다.  
`$`는 현재 Stream의 마지막 ID를 시작점으로 사용하므로 그룹 생성 전에 저장된 알림은 읽지 않습니다.  
기존 메시지까지 처리해야 한다면 Consumer Group의 시작 ID로 `0`을 사용해야 합니다.  

### 🟦 이벤트 처리

```typescript
/**
 * Consumer Group에 아직 전달되지 않은 새 알림 작업을 읽습니다.
 * `>` ID는 다른 consumer에게 전달되지 않은 새 메시지를 의미합니다.
 */
async readNotificationJobs(
  consumerName: string,
  count = 10,
): Promise<NotificationJob[]> {
  const key = RedisKey.stream.notifications();

  // Redis 응답은 신뢰하지 않고 unknown 상태에서 구조를 확인합니다.
  const result: unknown = await redis.xReadGroup(
    this.groupName,
    consumerName,
    [
      {
        key,
        id: '>',
      },
    ],
    {
      COUNT: count,
      BLOCK: 1000,
    },
  );

  if (!Array.isArray(result)) {
    return [];
  }

  const stream: unknown = result[0];

  if (!isRecord(stream) || !Array.isArray(stream.messages)) {
    return [];
  }

  return stream.messages.map((entry: unknown) => parseNotificationJob(entry));
}

/**
 * 처리한 메시지에 ACK를 보내 pending 목록에서 제거합니다.
 * 작업이 성공한 뒤 호출해야 미완료 작업을 확인하거나 재처리할 수 있습니다.
 */
async ackNotificationJob(messageId: string): Promise<void> {
  const key = RedisKey.stream.notifications();

  await redis.xAck(key, this.groupName, messageId);
}

/** ACK되지 않은 알림 작업의 개수와 consumer별 상태를 조회합니다. */
async getPendingSummary() {
  const key = RedisKey.stream.notifications();

  return redis.xPending(key, this.groupName);
}
```

실제 구현의 `parseNotificationJob()`은 Redis 응답에 `id`와 `message`가 있는지 확인합니다.  
문자열로 저장된 `userId`는 양의 안전한 정수로 변환하고, `type`은 `NotificationType`에 정의된 값인지 검증합니다.  
잘못된 Stream 메시지를 그대로 worker에 전달하지 않기 위한 서비스 경계의 검증입니다.  

worker는 Consumer Group을 기준으로 메시지를 읽습니다.  
여기서 중요한 값은 `id: '>'`입니다.  

```text
id = '>' → 아직 어떤 consumer에게도 전달되지 않은 새 메시지만 읽음
id = '0' → 이 consumer에게 이미 전달되었지만 ACK하지 않은 메시지를 읽음
```

여러 worker가 있어도 같은 새 메시지를 동시에 가져가지 않고 나누어 처리할 수 있습니다.  

```text
stream:notifications
  ↓
notification-workers group
  ↓
worker-1 → message A
worker-2 → message B
worker-3 → message C
```

처리가 끝나면 ACK를 보냅니다.  

```typescript
await redis.xAck(key, this.groupName, messageId);
```

ACK는 해당 메시지를 정상적으로 처리했다는 표시입니다.  
ACK하지 않은 메시지는 pending 상태로 남습니다.  
`XACK`은 Consumer Group의 pending 상태만 해제하며 Stream의 원본 메시지를 삭제하지 않습니다.  
`getPendingSummary()`는 `XPENDING`으로 미완료 작업을 관찰하지만, 다른 consumer의 작업을 가져오거나 재처리하지는 않습니다.  
장애가 난 consumer의 작업을 회수하려면 `XAUTOCLAIM` 같은 별도 처리가 필요합니다.  

## 3. 이메일 작업 큐 구현하기 {#session-03}

이메일 발송은 대표적인 비동기 작업입니다.  
회원가입 직후 환영 메일을 보내거나 주문 완료 후 주문 확인 메일을 보내는 작업은 API 응답을 막지 않고 뒤에서 처리하는 것이 좋습니다.  

![Redis Stream을 사용한 이메일 작업 생성, 발송과 ACK 흐름](/assets/images/nodejs/nodejs-redis/redis-stream-email-job-flow.png)

### 🟦 이메일 작업 추가

```typescript
// src/ch10/email-stream.service.ts

/** worker가 발송 방식을 결정할 때 사용하는 이메일 작업 종류입니다. */
export type EmailJobType =
  | 'welcome'
  | 'order-completed'
  | 'password-reset'
  | 'marketing';

export type EmailJobInput = {
  to: string;
  type: EmailJobType;
  subject: string;
  body: string;
};

export type EmailJob = {
  id: string;
  to: string;
  type: EmailJobType;
  subject: string;
  body: string;
  retryCount: number;
  createdAt: string;
};

/**
 * 이메일 발송 작업을 Redis Stream에 추가합니다.
 * 최초 재시도 횟수를 0으로 설정하고 생성 시각을 기록합니다.
 */
async addEmailJob(input: EmailJobInput): Promise<string> {
  const key = RedisKey.stream.emails();

  // 실제 이메일 발송에 필요한 값을 Stream 메시지로 저장합니다.
  return redis.xAdd(key, '*', {
    to: input.to,
    type: input.type,
    subject: input.subject,
    body: input.body,
    retryCount: '0',
    createdAt: new Date().toISOString(),
  });
}

/**
 * 회원가입 환영 이메일을 공통 이메일 작업으로 구성합니다.
 */
async addWelcomeEmailJob(email: string, name: string): Promise<string> {
  return this.addEmailJob({
    to: email,
    type: 'welcome',
    subject: '회원가입을 환영합니다.',
    body: `${name}님, 회원가입을 환영합니다.`,
  });
}

/** 주문 완료 안내 이메일을 공통 이메일 작업으로 구성합니다. */
async addOrderCompletedEmailJob(
  email: string,
  orderId: number,
): Promise<string> {
  return this.addEmailJob({
    to: email,
    type: 'order-completed',
    subject: '주문이 완료되었습니다.',
    body: `주문 번호 ${orderId}의 주문이 완료되었습니다.`,
  });
}
```

이메일 발송에 필요한 정보는 다음과 같이 Stream에 저장됩니다.  

```text
stream:emails
  1710000000000-0
    to         kim@example.com
    type       welcome
    subject    회원가입을 환영합니다.
    body       Kim님, 회원가입을 환영합니다.
    retryCount 0
    createdAt  2026-06-16T00:00:00.000Z
```

### 🟦 이메일 전송

```typescript
/** 이메일 worker가 공유할 Consumer Group을 생성합니다. */
async createConsumerGroup(): Promise<void> {
  const key = RedisKey.stream.emails();

  try {
    // Stream이 없으면 빈 Stream과 Consumer Group을 함께 생성합니다.
    await redis.xGroupCreate(key, this.groupName, '$', {
      MKSTREAM: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('BUSYGROUP')) {
      return;
    }

    throw error;
  }
}

/**
 * Consumer Group에 아직 전달되지 않은 새 이메일 작업을 읽습니다.
 * 이 메서드를 호출하기 전에 Consumer Group을 준비해야 합니다.
 */
async readEmailJobs(
  consumerName: string,
  count = 5,
): Promise<EmailJob[]> {
  const key = RedisKey.stream.emails();

  // 새 작업을 기다리며, Redis 응답은 unknown 상태에서 검증합니다.
  const result: unknown = await redis.xReadGroup(
    this.groupName,
    consumerName,
    [
      {
        key,
        id: '>',
      },
    ],
    {
      COUNT: count,
      BLOCK: 1000,
    },
  );

  if (!Array.isArray(result)) {
    return [];
  }

  const stream: unknown = result[0];

  if (!isRecord(stream) || !Array.isArray(stream.messages)) {
    return [];
  }

  return stream.messages.map((entry: unknown) => parseEmailJob(entry));
}

/**
 * 발송을 완료한 이메일 작업에 ACK를 보냅니다.
 */
async ackEmailJob(messageId: string): Promise<void> {
  const key = RedisKey.stream.emails();

  await redis.xAck(key, this.groupName, messageId);
}
```

`parseEmailJob()`은 Stream 메시지의 필수 문자열 필드를 확인하고 `type`을 허용된 이메일 작업 종류와 비교합니다.  
또한 문자열인 `retryCount`를 0 이상의 안전한 정수로 변환하므로 worker는 검증된 `EmailJob`만 처리합니다.  
`createConsumerGroup()`의 시작 ID가 `$`이므로 그룹을 만들기 전에 저장된 작업은 건너뜁니다.  

이메일 worker는 `readEmailJobs()`로 작업을 가져옵니다.  

```typescript
const jobs = await emailStreamService.readEmailJobs('email-worker-1');
```

작업을 처리한 뒤 성공하면 ACK를 보냅니다.  

```typescript
await emailStreamService.ackEmailJob(job.id);
```

실패하면 기존 Stream 항목을 수정하지 않고 재시도 횟수를 늘린 새 작업을 추가합니다.  

```typescript
/** 실패한 이메일 작업을 새 Stream 메시지로 다시 등록합니다. */
async retryEmailJob(job: EmailJob): Promise<string> {
  const key = RedisKey.stream.emails();

  // 새 항목에 원본 메시지 ID를 남겨 재시도 작업의 출처를 추적합니다.
  return redis.xAdd(key, '*', {
    to: job.to,
    type: job.type,
    subject: job.subject,
    body: job.body,
    retryCount: String(job.retryCount + 1),
    createdAt: new Date().toISOString(),
    originalMessageId: job.id,
  });
}
```

`retryEmailJob()`은 원본 메시지를 ACK하지 않습니다.  
호출자는 재시도 작업이 정상적으로 등록된 뒤 원본 작업을 별도로 ACK해야 합니다.  

```typescript
await emailStreamService.retryEmailJob(job);

// 재시도 작업 등록에 성공한 뒤 원본 작업을 완료 처리합니다.
await emailStreamService.ackEmailJob(job.id);
```

처리되지 않은 이메일 작업은 `XPENDING` 요약으로 확인할 수 있습니다.  

```typescript
async getPendingSummary() {
  const key = RedisKey.stream.emails();

  return redis.xPending(key, this.groupName);
}
```

### 🟦 Stream이 이메일 큐에 적합한 이유

이메일 발송은 다음과 같은 이유로 실패할 수 있습니다.  

- SMTP 서버 장애
- 네트워크 장애
- 외부 이메일 API 장애
- 일시적인 Rate Limit

따라서 이메일 작업에는 단순히 보내고 끝내는 방식이 아니라 다음 처리가 필요합니다.  

- 작업 저장
- worker 분산 처리
- 성공 시 ACK
- 실패 시 재시도
- pending 작업 확인

Redis Stream은 이런 흐름을 학습하기에 적합합니다.  
다만 실무에서 이메일 큐를 더 안정적으로 운영하려면 지연 재시도, 최대 재시도 횟수, 실패 작업 보관과 작업 처리 제한 시간 같은 기능도 고려해야 합니다.  
이러한 기능이 필요하다면 Redis Stream을 직접 다루는 대신 BullMQ 같은 큐 라이브러리를 사용할 수 있습니다.  

## 4. 감사 로그 저장하기 {#session-04}

감사 로그는 사용자의 중요한 행위나 관리자의 작업 이력을 남기는 기능입니다.  
예를 들어 다음과 같은 이벤트를 기록할 수 있습니다.  

- 관리자 로그인
- 사용자 권한 변경
- 주문 상태 변경
- 게시글 삭제
- 결제 취소

감사 로그는 보통 DB에 최종 저장해야 합니다.  
Redis Stream을 함께 사용하면 이벤트를 먼저 기록하고 worker가 나중에 DB에 저장하는 구조를 만들 수 있습니다.  

![Redis Stream을 사용한 감사 로그 기록, DB 저장과 ACK 흐름](/assets/images/nodejs/nodejs-redis/redis-stream-audit-log-flow.png)

### 🟦 감사 로그 이벤트 처리 흐름

1. 감사 로그 이벤트를 Stream에 추가합니다.

```typescript
// src/ch10/audit-log-stream.service.ts

export type AuditLogEventInput = {
  action: string;
  target: string;
  message: string;
  actorId?: number;
};

export type AuditLogJob = {
  id: string;
  action: string;
  target: string;
  message: string;
  actorId: number | null;
  createdAt: string;
};

/** 감사 로그 이벤트를 비동기 저장 작업으로 등록합니다. */
async addAuditLogEvent(input: AuditLogEventInput): Promise<string> {
  const key = RedisKey.stream.auditLogs();

  // 행위자 ID가 없으면 빈 문자열로 저장합니다.
  return redis.xAdd(key, '*', {
    action: input.action,
    target: input.target,
    message: input.message,
    actorId: input.actorId !== undefined ? String(input.actorId) : '',
    createdAt: new Date().toISOString(),
  });
}
```

예를 들어 관리자가 주문 상태를 변경했다면 다음과 같은 메시지를 남길 수 있습니다.  

```text
stream:audit-logs
  1710000000000-0
    action    order.status.changed
    target    order:1
    message   주문 상태가 PAID로 변경되었습니다.
    actorId   10
    createdAt 2026-06-16T00:00:00.000Z
```

2. 감사 로그 worker가 공유할 Consumer Group을 만들고 작업을 읽습니다.

```typescript
/** 감사 로그 Stream과 Consumer Group을 준비합니다. */
async createConsumerGroup(): Promise<void> {
  const key = RedisKey.stream.auditLogs();

  try {
    await redis.xGroupCreate(key, this.groupName, '$', {
      MKSTREAM: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('BUSYGROUP')) {
      return;
    }

    throw error;
  }
}

/** 아직 다른 worker에게 전달되지 않은 새 감사 로그 작업을 읽습니다. */
async readAuditLogJobs(
  consumerName: string,
  count = 10,
): Promise<AuditLogJob[]> {
  const key = RedisKey.stream.auditLogs();

  // 새 작업을 최대 count개까지 1초 동안 기다립니다.
  const result: unknown = await redis.xReadGroup(
    this.groupName,
    consumerName,
    [
      {
        key,
        id: '>',
      },
    ],
    {
      COUNT: count,
      BLOCK: 1000,
    },
  );

  if (!Array.isArray(result)) {
    return [];
  }

  const stream: unknown = result[0];

  if (!isRecord(stream) || !Array.isArray(stream.messages)) {
    return [];
  }

  return stream.messages.map((entry: unknown) => parseAuditLogJob(entry));
}
```

`parseAuditLogJob()`은 필수 문자열 필드를 확인하고, 선택 값인 `actorId`를 안전한 정수 또는 `null`로 변환합니다.  
읽은 작업은 DB 저장 후 ACK하기 전까지 pending 상태로 유지됩니다.  
이 예제도 `>`로 새 작업만 읽으므로 장애가 난 worker의 pending 작업을 회수하려면 별도 처리가 필요합니다.  

3. 작업을 DB에 저장하고, 저장에 성공한 메시지만 ACK합니다.

```typescript
/** 감사 로그 작업을 DB에 저장하고 완료 처리합니다. */
async saveAuditLogToDatabase(job: AuditLogJob) {
  const auditLog = await prisma.auditLog.create({
    data: {
      action: job.action,
      target: job.target,
      message: job.message,
    },
  });

  // DB 저장에 성공한 뒤에만 ACK합니다.
  await this.ackAuditLogJob(job.id);

  return auditLog;
}

/** DB 저장이 끝난 작업을 pending 목록에서 제거합니다. */
async ackAuditLogJob(messageId: string): Promise<void> {
  const key = RedisKey.stream.auditLogs();

  await redis.xAck(key, this.groupName, messageId);
}
```

실패하면 ACK하지 않습니다.  
해당 메시지는 pending 상태로 남아 나중에 확인하거나 재처리할 수 있습니다.  
DB 저장 후 ACK가 실패하면 같은 작업을 다시 처리할 때 감사 로그가 중복 저장될 수 있습니다.  
운영 환경에서는 Stream 메시지 ID를 기준으로 같은 작업을 한 번만 반영하는 멱등 처리가 필요합니다.  

### 🟦 최근 이벤트와 pending 상태 조회

Consumer Group의 처리 상태와 관계없이 최근 감사 로그 이벤트를 확인할 때는 `XREVRANGE`를 사용합니다.  
`+`에서 `-` 방향으로 조회하므로 ID가 큰 최신 이벤트부터 반환합니다.  

```typescript
async getRecentAuditLogEvents(count = 10): Promise<AuditLogJob[]> {
  const key = RedisKey.stream.auditLogs();

  // 최신 이벤트부터 최대 count개까지 역순으로 조회합니다.
  const entries = await redis.xRevRange(key, '+', '-', {
    COUNT: count,
  });

  return entries.map(parseAuditLogJob);
}

async getPendingSummary() {
  const key = RedisKey.stream.auditLogs();

  // ACK되지 않은 작업 수와 consumer별 pending 개수를 조회합니다.
  return redis.xPending(key, this.groupName);
}
```

`getRecentAuditLogEvents()`는 메시지를 pending 상태로 만들거나 Consumer Group의 전달 위치를 바꾸지 않습니다.  
`getPendingSummary()`도 처리 상태를 조회할 뿐 작업 소유권을 이전하거나 재처리하지 않습니다.  
