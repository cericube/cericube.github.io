---
layout: post
title: "11. Redis Pub/Sub 실습: 실시간 메시지 전달"
description: "Redis Pub/Sub을 활용해 실시간 알림, 캐시 무효화, 채팅 메시지와 관리자 공지를 여러 서버에 전달하는 방법을 알아봅니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 11
ai_assisted: true
toc:
  - id: session-01
    title: "1. 실시간 알림 발행하기"
  - id: session-02
    title: "2. 캐시 무효화 메시지 발행하기"
  - id: session-03
    title: "3. 채팅 메시지 브로드캐스트하기"
  - id: session-04
    title: "4. 관리자 공지 발행하기"
---

![Redis Pub/Sub의 메시지 발행과 구독 흐름](/assets/images/nodejs/nodejs-redis/redis-pubsub-publish-subscribe-flow.png)

Redis Pub/Sub은 발행자가 채널에 메시지를 보내면 현재 채널을 구독 중인 모든 구독자에게 실시간으로 전달하는 기능입니다.  
메시지를 저장하거나 다시 전송하지 않으므로, 구독자가 연결되어 있지 않거나 메시지 처리에 실패하면 해당 메시지를 다시 받을 수 없습니다.  

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/redis-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 실시간 알림 발행하기 {#session-01}

실시간 알림은 Pub/Sub을 설명하기 좋은 예제입니다.  
예를 들어 다음 상황을 생각해 볼 수 있습니다.  

- 게시글에 좋아요가 눌림
- 댓글이 작성됨
- 주문 상태가 변경됨
- 관리자 메시지가 도착함

이런 이벤트는 DB에 저장할 수도 있지만, 현재 접속 중인 사용자에게 즉시 알려야 할 때는 Pub/Sub이 유용합니다.  

전체 흐름은 다음과 같습니다.  

```text
NotificationService
  ↓
Redis PUBLISH channel:notification
  ↓
Notification Subscriber
  ↓
WebSocket / SSE / Console Log
```

### 🟦 실시간 알림 발행

`pubsub-message.ts`의 공통 함수는 JSON 문자열을 일반 객체로 변환하고 필수 문자열, 양의 정수, 허용된 문자열과 ISO 8601 날짜를 확인합니다.  

```typescript
// src/ch11/pubsub-message.ts

/** null과 배열을 제외한 일반 JSON 객체인지 확인합니다. */
export function requireRecord(
  value: unknown,
  messageName: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${messageName} must be a JSON object`);
  }

  return value as Record<string, unknown>;
}

/** JSON 문자열을 파싱하고 최상위 값이 일반 객체인지 확인합니다. */
export function parseJsonObject(
  rawMessage: string,
  messageName: string,
): Record<string, unknown> {
  const value = JSON.parse(rawMessage) as unknown;
  return requireRecord(value, messageName);
}

/** 필수 문자열 필드를 읽으며 공백으로만 구성된 값도 거부합니다. */
export function requireString(
  value: Record<string, unknown>,
  field: string,
  messageName: string,
): string {
  const fieldValue = value[field];

  if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0) {
    throw new TypeError(`${messageName}.${field} must be a non-empty string`);
  }

  return fieldValue;
}

/** ID 필드가 양의 안전한 정수인지 확인합니다. */
export function requirePositiveInteger(
  value: Record<string, unknown>,
  field: string,
  messageName: string,
): number {
  const fieldValue = value[field];

  if (!Number.isSafeInteger(fieldValue) || (fieldValue as number) <= 0) {
    throw new TypeError(
      `${messageName}.${field} must be a positive safe integer`,
    );
  }

  return fieldValue as number;
}

/** 문자열 필드가 허용된 리터럴 목록에 포함되는지 확인합니다. */
export function requireEnum<const T extends readonly string[]>(
  value: Record<string, unknown>,
  field: string,
  allowedValues: T,
  messageName: string,
): T[number] {
  const fieldValue = value[field];

  if (typeof fieldValue !== 'string' || !allowedValues.includes(fieldValue)) {
    throw new TypeError(`${messageName}.${field} has an unsupported value`);
  }

  return fieldValue;
}

/** Date#toISOString()과 같은 UTC ISO 8601 형식인지 확인합니다. */
export function requireIsoDate(
  value: Record<string, unknown>,
  field: string,
  messageName: string,
): string {
  const fieldValue = requireString(value, field, messageName);
  const date = new Date(fieldValue);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== fieldValue) {
    throw new TypeError(
      `${messageName}.${field} must be an ISO 8601 UTC date`,
    );
  }

  return fieldValue;
}
```

각 서비스는 이 공통 함수를 조합해 자신의 메시지 구조를 검증합니다.  

```typescript
// src/ch11/notification-pubsub.service.ts

const NOTIFICATION_TYPES = [
  'POST_LIKED',
  'COMMENT_CREATED',
  'ORDER_STATUS_CHANGED',
] as const;

/** 알림 payload를 런타임에서 검증하고 도메인 메시지로 변환합니다. */
function parseNotification(value: unknown): RealtimeNotificationMessage {
  const message = requireRecord(value, 'RealtimeNotificationMessage');

  return {
    type: requireEnum(
      message,
      'type',
      NOTIFICATION_TYPES,
      'RealtimeNotificationMessage',
    ),
    userId: requirePositiveInteger(
      message,
      'userId',
      'RealtimeNotificationMessage',
    ),
    title: requireString(message, 'title', 'RealtimeNotificationMessage'),
    message: requireString(message, 'message', 'RealtimeNotificationMessage'),
    createdAt: requireIsoDate(
      message,
      'createdAt',
      'RealtimeNotificationMessage',
    ),
  };
}

/**
 * 실시간 알림을 공용 알림 채널에 발행합니다.
 *
 * 1. 알림 메시지를 JSON 문자열로 변환합니다.
 * 2. 알림 채널을 구독 중인 모든 구독자에게 문자열을 발행합니다.
 * 3. 메시지를 전달받은 구독자 수를 반환합니다.
 */
async publishNotification(
  message: RealtimeNotificationMessage,
): Promise<number> {
  const channel = RedisKey.channel.notification();
  // 타입 검사를 우회한 잘못된 값도 발행 전에 거부합니다.
  const payload = JSON.stringify(parseNotification(message));

  // 반환값은 알림 처리 성공 수가 아니라 메시지를 전달받은 구독자 수입니다.
  return redis.publish(channel, payload);
}

/** 게시글 좋아요 정보를 실시간 알림 메시지로 구성해 발행합니다. */
async publishPostLikedNotification(input: {
  receiverUserId: number;
  postId: number;
  likedByUserName: string;
}): Promise<number> {
  return this.publishNotification({
    type: 'POST_LIKED',
    userId: input.receiverUserId,
    title: '게시글 좋아요 알림',
    message: `${input.likedByUserName}님이 ${input.postId}번 게시글을 좋아합니다.`,
    createdAt: new Date().toISOString(),
  });
}

/** 댓글 작성 정보를 실시간 알림 메시지로 구성해 발행합니다. */
async publishCommentCreatedNotification(input: {
  receiverUserId: number;
  postId: number;
  commentAuthorName: string;
}): Promise<number> {
  return this.publishNotification({
    type: 'COMMENT_CREATED',
    userId: input.receiverUserId,
    title: '댓글 알림',
    message: `${input.commentAuthorName}님이 ${input.postId}번 게시글에 댓글을 작성했습니다.`,
    createdAt: new Date().toISOString(),
  });
}
```

알림 발행의 핵심 코드는 다음과 같습니다.  

```typescript
const channel = RedisKey.channel.notification();
const payload = JSON.stringify(parseNotification(message));
return redis.publish(channel, payload);
```

Redis Pub/Sub의 메시지 payload는 문자열로 전달할 수 있습니다.  
따라서 객체 메시지는 `JSON.stringify()`로 문자열로 변환한 뒤 발행합니다.  

```json
{
  "type": "POST_LIKED",
  "userId": 1,
  "title": "게시글 좋아요 알림",
  "message": "Kim님이 10번 게시글을 좋아합니다.",
  "createdAt": "2026-07-27T00:00:00.000Z"
}
```

위 메시지는 `channel:notification` 채널로 전달됩니다.  
`redis.publish()`의 반환값은 메시지를 전달받은 subscriber 수입니다.  
예를 들어 채널을 구독 중인 subscriber가 2개라면 반환값은 `2`입니다.  

### 🟦 실시간 알림 채널 구독

```typescript
/**
 * 실시간 알림 채널을 구독하고 구독 종료 함수를 반환합니다.
 * Pub/Sub 구독은 일반 명령과 분리한 전용 연결에서 처리합니다.
 */
async subscribeNotification(
  onMessage: (
    message: RealtimeNotificationMessage,
  ) => void | Promise<void>,
): Promise<() => Promise<void>> {
  const channel = RedisKey.channel.notification();

  // Pub/Sub 구독은 일반 명령 처리와 분리된 전용 연결에서 수행합니다.
  const subscriber = redis.duplicate();
  subscriber.on('error', (error) => {
    console.error('[NotificationPubSub] Subscriber error:', error);
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel, async (rawMessage) => {
      let message: RealtimeNotificationMessage;

      // JSON과 필수 필드, enum, 날짜 형식을 먼저 검증합니다.
      try {
        message = parseNotification(
          parseJsonObject(rawMessage, 'RealtimeNotificationMessage'),
        );
      } catch (error) {
        console.error('[NotificationPubSub] Invalid message:', error);
        return;
      }

      // 업무 콜백 실패가 구독 루프를 종료하지 않도록 별도로 처리합니다.
      try {
        await onMessage(message);
      } catch (error) {
        console.error('[NotificationPubSub] Handler failed:', error);
      }
    });
  } catch (error) {
    // 연결이나 구독 등록에 실패하면 열린 전용 연결을 정리합니다.
    if (subscriber.isOpen) {
      await subscriber.quit().catch((closeError: unknown) => {
        console.error('[NotificationPubSub] Failed to close subscriber:', closeError);
      });
    }
    throw error;
  }

  // 종료 함수를 여러 번 호출해도 정리 작업은 한 번만 수행합니다.
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;

    if (!subscriber.isOpen) return;

    try {
      await subscriber.unsubscribe(channel);
    } finally {
      if (subscriber.isOpen) await subscriber.quit();
    }
  };
}
```

구독 코드에서는 다음 부분이 중요합니다.  

```typescript
const subscriber = redis.duplicate();
await subscriber.connect();
```

Pub/Sub에서는 구독용 Redis 연결을 일반 Redis 명령용 연결과 분리하는 것이 좋습니다.  
일반 Redis client는 다음 명령을 처리합니다.  

```text
GET
SET
HGETALL
INCR
PUBLISH
```

Subscriber client는 다음과 같이 채널 구독을 유지합니다.  

```text
SUBSCRIBE channel:notification
```

따라서 일반적으로 다음과 같이 역할을 나눕니다.  

```text
일반 Redis client  → GET, SET, PUBLISH
Subscriber client → SUBSCRIBE
```

수신한 JSON은 `parseJsonObject()`와 `parseNotification()`을 통과한 뒤에만 업무 콜백으로 전달됩니다.  
메시지 형식 오류와 업무 콜백 오류를 구분해 처리하므로 잘못된 메시지나 한 번의 콜백 실패가 구독 자체를 종료하지 않습니다.  
연결 또는 구독 등록이 실패했을 때는 열린 전용 연결을 닫고 오류를 호출자에게 다시 전달합니다.  

### 🟦 실행 예시

```typescript
const service = new NotificationPubSubService();

// 메시지를 받을 때 실행할 콜백을 등록합니다.
const unsubscribe = await service.subscribeNotification((message) => {
  console.log('[알림 수신]', message);
});

await service.publishPostLikedNotification({
  receiverUserId: 1,
  postId: 10,
  likedByUserName: 'Kim',
});

// 실습이 끝나면 구독과 전용 연결을 정리합니다.
await unsubscribe();
```

## 2. 캐시 무효화 메시지 발행하기 {#session-02}

Pub/Sub은 실시간 알림뿐 아니라 서버 간 캐시 무효화 전파에도 자주 사용됩니다.  
예를 들어 API 서버가 여러 대 있다고 가정해 보겠습니다.  

```text
API Server A
API Server B
API Server C
```

각 서버는 사용자 정보를 Redis 또는 메모리 캐시에 가지고 있을 수 있습니다.  
이때 Server A에서 사용자 정보가 변경되면 다른 서버도 기존 캐시를 지워야 합니다.  

```text
Server A에서 사용자 정보 수정
  ↓
DB update
  ↓
channel:cache-invalidation publish
  ↓
Server B, Server C subscriber가 메시지 수신
  ↓
각 서버에서 해당 캐시 삭제
```

### 🟦 캐시 무효화 메시지 발행

```typescript
// src/ch11/cache-invalidation-pubsub.service.ts

const CACHE_INVALIDATION_TYPES = [
  'USER_CACHE_INVALIDATED',
  'POST_CACHE_INVALIDATED',
  'CUSTOM_KEY_INVALIDATED',
] as const;

/** 수신 값을 검증하고 삭제가 허용된 캐시 메시지로 변환합니다. */
function parseCacheInvalidation(
  value: unknown,
): CacheInvalidationMessage {
  const message = requireRecord(value, 'CacheInvalidationMessage');
  const key = requireString(message, 'key', 'CacheInvalidationMessage');

  // 위조한 메시지가 세션이나 일반 데이터 키를 삭제하지 못하게 합니다.
  if (!key.startsWith('cache:')) {
    throw new TypeError(
      'CacheInvalidationMessage.key must use the cache: namespace',
    );
  }

  return {
    type: requireEnum(
      message,
      'type',
      CACHE_INVALIDATION_TYPES,
      'CacheInvalidationMessage',
    ),
    key,
    reason: requireString(message, 'reason', 'CacheInvalidationMessage'),
    createdAt: requireIsoDate(
      message,
      'createdAt',
      'CacheInvalidationMessage',
    ),
  };
}

/**
 * 캐시 무효화 메시지를 공용 채널에 발행합니다.
 * 반환값은 현재 메시지를 전달받은 구독 서버 수입니다.
 */
async publishCacheInvalidation(
  message: CacheInvalidationMessage,
): Promise<number> {
  const channel = RedisKey.channel.cacheInvalidation();
  // 발행 단계에서도 키 네임스페이스와 메시지 필드를 검증합니다.
  const validatedMessage = parseCacheInvalidation(message);

  return redis.publish(channel, JSON.stringify(validatedMessage));
}

/** 사용자 캐시 무효화 메시지를 구성해 발행합니다. */
async publishUserCacheInvalidation(userId: number): Promise<number> {
  const key = RedisKey.cache.user(userId);

  return this.publishCacheInvalidation({
    type: 'USER_CACHE_INVALIDATED',
    key,
    reason: `User ${userId} updated`,
    createdAt: new Date().toISOString(),
  });
}

/** 지정한 캐시 키와 사유로 사용자 정의 무효화 메시지를 발행합니다. */
async publishCustomKeyInvalidation(
  key: string,
  reason: string,
): Promise<number> {
  return this.publishCacheInvalidation({
    type: 'CUSTOM_KEY_INVALIDATED',
    key,
    reason,
    createdAt: new Date().toISOString(),
  });
}
```

캐시 무효화 메시지는 다음 구조를 가집니다.  

```typescript
export type CacheInvalidationMessage = {
  type:
    | 'USER_CACHE_INVALIDATED'
    | 'POST_CACHE_INVALIDATED'
    | 'CUSTOM_KEY_INVALIDATED';
  key: string;
  reason: string;
  createdAt: string;
};
```

가장 중요한 필드는 `key`입니다.  
예를 들어 사용자 캐시를 삭제하려면 다음 키가 메시지에 포함됩니다.  

```text
cache:user:1
```

### 🟦 캐시 무효화 메시지 구독

```typescript
/**
 * 캐시 무효화 채널을 구독하고 대상 캐시를 삭제합니다.
 * 필요하면 삭제 후 실행할 콜백도 함께 전달받습니다.
 */
async subscribeCacheInvalidation(
  onInvalidated?: (
    message: CacheInvalidationMessage,
  ) => void | Promise<void>,
): Promise<() => Promise<void>> {
  const channel = RedisKey.channel.cacheInvalidation();

  const subscriber = redis.duplicate();
  subscriber.on('error', (error) => {
    console.error('[CacheInvalidationPubSub] Subscriber error:', error);
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel, async (rawMessage) => {
      let message: CacheInvalidationMessage;

      // JSON과 모든 필드를 검증한 뒤에만 삭제 명령을 실행합니다.
      try {
        message = parseCacheInvalidation(
          parseJsonObject(rawMessage, 'CacheInvalidationMessage'),
        );
      } catch (error) {
        console.error('[CacheInvalidationPubSub] Invalid message:', error);
        return;
      }

      try {
        // 키가 없어도 DEL은 오류 없이 0을 반환합니다.
        await redis.del(message.key);
        if (onInvalidated) await onInvalidated(message);
      } catch (error) {
        console.error('[CacheInvalidationPubSub] Handler failed:', error);
      }
    });
  } catch (error) {
    if (subscriber.isOpen) {
      await subscriber.quit().catch((closeError: unknown) => {
        console.error(
          '[CacheInvalidationPubSub] Failed to close subscriber:',
          closeError,
        );
      });
    }
    throw error;
  }

  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;

    if (!subscriber.isOpen) return;

    try {
      await subscriber.unsubscribe(channel);
    } finally {
      if (subscriber.isOpen) await subscriber.quit();
    }
  };
}
```

캐시 키를 메시지에서 받아 바로 삭제하면 잘못되거나 위조된 메시지가 다른 Redis 데이터까지 삭제할 수 있습니다.  
따라서 예제에서는 삭제 대상을 `cache:` 네임스페이스로 제한합니다.  
실제 `ch11` 코드는 발행과 수신 양쪽에서 `type`, `key`, `reason`, `createdAt`을 모두 검증합니다.  
검증 오류와 `DEL` 또는 후처리 콜백 오류를 따로 기록하여 원인을 구분합니다.  

### 🟦 캐시 무효화에 Pub/Sub을 사용하는 이유

캐시 무효화는 단일 서버에서는 단순합니다.  

```text
DB update
  ↓
Redis DEL
```

하지만 서버가 여러 대이면 문제가 생길 수 있습니다.  

```text
Server A는 캐시를 지웠지만
Server B, C는 아직 오래된 로컬 캐시를 가지고 있을 수 있음
```

이때 Pub/Sub을 사용하면 캐시 삭제 이벤트를 여러 서버에 동시에 전파할 수 있습니다.  

```text
Server A
  ↓ publish
channel:cache-invalidation
  ↓ subscribe
Server B
Server C
```

단, Pub/Sub 메시지는 저장되거나 재전송되지 않습니다.  
캐시 무효화 메시지를 놓치면 일부 서버에 오래된 로컬 캐시가 남을 수 있습니다.  
이 문제를 줄이려면 로컬 캐시에도 짧은 TTL을 두거나 중요한 데이터는 Redis 또는 DB를 기준으로 다시 검증하는 전략이 필요합니다.  

## 3. 채팅 메시지 브로드캐스트하기 {#session-03}

Pub/Sub은 채팅 메시지 브로드캐스트에도 사용할 수 있습니다.  
채팅방 사용자가 여러 WebSocket 서버에 나뉘어 접속해 있다고 가정해 보겠습니다.  

```text
User A → WebSocket Server 1
User B → WebSocket Server 2
User C → WebSocket Server 3
```

User A가 메시지를 보내면 처음에는 Server 1만 이 메시지를 알고 있습니다.  
Server 2와 Server 3에도 전달해야 다른 사용자가 같은 채팅방의 메시지를 받을 수 있습니다.  

```text
User A 메시지 전송
  ↓
WebSocket Server 1
  ↓
Redis PUBLISH channel:chat:{roomId}
  ↓
WebSocket Server 2, 3 수신
  ↓
User B, User C에게 전달
```

### 🟦 사용하는 Redis 채널

```typescript
RedisKey.channel.chat(roomId);
```

실제 채널 이름은 다음과 같습니다.  

```text
channel:chat:room-1
channel:chat:room-2
```

### 🟦 채팅방 메시지 발행

```typescript
// src/ch11/chat-pubsub.service.ts

/** 외부 입력을 검증하여 처리 가능한 채팅 메시지로 변환합니다. */
function parseChatMessage(value: unknown): ChatMessage {
  const message = requireRecord(value, 'ChatMessage');

  return {
    roomId: requireString(message, 'roomId', 'ChatMessage'),
    senderUserId: requirePositiveInteger(
      message,
      'senderUserId',
      'ChatMessage',
    ),
    senderName: requireString(message, 'senderName', 'ChatMessage'),
    message: requireString(message, 'message', 'ChatMessage'),
    createdAt: requireIsoDate(message, 'createdAt', 'ChatMessage'),
  };
}

/**
 * 채팅 메시지를 해당 채팅방 채널에 발행합니다.
 * 반환값은 현재 메시지를 전달받은 subscriber 수입니다.
 */
async publishChatMessage(message: ChatMessage): Promise<number> {
  // roomId를 채널 이름에 사용하기 전에 전체 메시지를 검증합니다.
  const validatedMessage = parseChatMessage(message);
  const channel = RedisKey.channel.chat(validatedMessage.roomId);

  return redis.publish(channel, JSON.stringify(validatedMessage));
}

/** 입력값으로 채팅 메시지를 구성해 발행합니다. */
async sendMessage(input: {
  roomId: string;
  senderUserId: number;
  senderName: string;
  message: string;
}): Promise<number> {
  return this.publishChatMessage({
    roomId: input.roomId,
    senderUserId: input.senderUserId,
    senderName: input.senderName,
    message: input.message,
    createdAt: new Date().toISOString(),
  });
}
```

채팅방 채널은 `roomId`를 기준으로 분리합니다.  

```typescript
const validatedMessage = parseChatMessage(message);
const channel = RedisKey.channel.chat(validatedMessage.roomId);
```

예를 들어 `roomId`가 `room-1`이면 다음 채널을 사용합니다.  

```text
channel:chat:room-1
```

채팅 메시지를 발행하는 핵심 코드는 다음과 같습니다.  

```typescript
return redis.publish(channel, JSON.stringify(validatedMessage));
```

### 🟦 채팅방 메시지 구독

```typescript
/**
 * 특정 채팅방 채널을 구독하고 메시지를 콜백에 전달합니다.
 * WebSocket 서버는 콜백에서 접속 중인 사용자에게 메시지를 전송할 수 있습니다.
 */
async subscribeChatRoom(
  roomId: string,
  onMessage: (message: ChatMessage) => void | Promise<void>,
): Promise<() => Promise<void>> {
  // 빈 roomId가 채널 이름에 포함되지 않도록 구독 요청을 검증합니다.
  const validatedRoomId = requireString(
    { roomId },
    'roomId',
    'ChatSubscription',
  );
  const channel = RedisKey.channel.chat(validatedRoomId);

  const subscriber = redis.duplicate();
  subscriber.on('error', (error) => {
    console.error('[ChatPubSub] Subscriber error:', error);
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel, async (rawMessage) => {
      let message: ChatMessage;

      // payload가 유효하고 실제 구독 채널의 방 ID와 같은지 확인합니다.
      try {
        message = parseChatMessage(parseJsonObject(rawMessage, 'ChatMessage'));
        if (message.roomId !== validatedRoomId) {
          throw new TypeError(
            'ChatMessage.roomId does not match the subscribed channel',
          );
        }
      } catch (error) {
        console.error('[ChatPubSub] Invalid message:', error);
        return;
      }

      try {
        await onMessage(message);
      } catch (error) {
        console.error('[ChatPubSub] Handler failed:', error);
      }
    });
  } catch (error) {
    if (subscriber.isOpen) {
      await subscriber.quit().catch((closeError: unknown) => {
        console.error('[ChatPubSub] Failed to close subscriber:', closeError);
      });
    }
    throw error;
  }

  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;

    if (!subscriber.isOpen) return;

    try {
      await subscriber.unsubscribe(channel);
    } finally {
      if (subscriber.isOpen) await subscriber.quit();
    }
  };
}
```

구독자는 발행자와 같은 채널을 구독합니다.  

```typescript
await subscriber.subscribe(channel, async (rawMessage) => {
  const message = parseChatMessage(parseJsonObject(rawMessage, 'ChatMessage'));
  await onMessage(message);
});
```

채팅 메시지는 필수 문자열, 양의 정수인 `senderUserId`, ISO 8601 날짜를 검증합니다.  
또한 payload의 `roomId`가 실제 구독 채널의 방 ID와 같은지 확인하여 잘못된 채널의 메시지가 전달되지 않도록 합니다.  

이 구조를 사용하면 여러 WebSocket 서버가 같은 Redis 채널을 구독할 수 있습니다.  

```text
WebSocket Server 1 subscribe channel:chat:room-1
WebSocket Server 2 subscribe channel:chat:room-1
WebSocket Server 3 subscribe channel:chat:room-1
```

어떤 서버에서 메시지를 발행하더라도 현재 같은 채널을 구독 중인 모든 서버가 메시지를 받을 수 있습니다.  

### 🟦 채팅에서 Pub/Sub 사용 시 주의할 점

Pub/Sub은 메시지를 저장하지 않습니다.  
따라서 다음 기능을 Pub/Sub만으로 처리하면 안 됩니다.  

- 이전 채팅 내역 조회
- 안 읽은 메시지 계산
- 메시지 재전송
- 장애 발생 후 메시지 복구

따라서 일반적으로 다음과 같이 역할을 나눕니다.  

```text
DB 또는 Stream
  → 채팅 메시지 저장

Redis Pub/Sub
  → 현재 접속 중인 사용자에게 실시간 전달
```

즉 Pub/Sub은 채팅 저장소가 아니라 실시간 전달 경로입니다.  

## 4. 관리자 공지 발행하기 {#session-04}

관리자 공지는 Pub/Sub의 특징을 보여 주기 좋은 예제입니다.  
예를 들어 관리자가 전체 사용자에게 다음 메시지를 보내야 한다고 가정합니다.  

```text
오늘 23시에 서버 점검이 있습니다.
```

이 메시지는 공지 채널을 구독하는 모든 서버에 즉시 전달되어야 합니다.  
각 서버는 WebSocket이나 SSE 등을 사용해 현재 접속 중인 사용자에게 공지를 표시할 수 있습니다.  

```text
Admin API
  ↓
Redis PUBLISH channel:admin-notice
  ↓
모든 Subscriber 수신
  ↓
접속 중인 사용자에게 공지 표시
```

### 🟦 사용하는 채널

```typescript
RedisKey.channel.adminNotice();
```

실제 채널 이름은 다음과 같습니다.  

```text
channel:admin-notice
```

### 🟦 공지 발행

```typescript
// src/ch11/admin-notice-pubsub.service.ts

const ADMIN_NOTICE_LEVELS = ['INFO', 'WARNING', 'URGENT'] as const;

/** 외부 값을 검증하여 안전한 관리자 공지 메시지로 변환합니다. */
function parseAdminNotice(value: unknown): AdminNoticeMessage {
  const message = requireRecord(value, 'AdminNoticeMessage');

  return {
    noticeId: requireString(message, 'noticeId', 'AdminNoticeMessage'),
    title: requireString(message, 'title', 'AdminNoticeMessage'),
    content: requireString(message, 'content', 'AdminNoticeMessage'),
    level: requireEnum(
      message,
      'level',
      ADMIN_NOTICE_LEVELS,
      'AdminNoticeMessage',
    ),
    createdAt: requireIsoDate(message, 'createdAt', 'AdminNoticeMessage'),
  };
}

/**
 * 관리자 공지를 공용 공지 채널에 발행합니다.
 * 반환값은 메시지를 전달받은 subscriber 수입니다.
 */
async publishAdminNotice(message: AdminNoticeMessage): Promise<number> {
  const channel = RedisKey.channel.adminNotice();
  // 타입 검사를 우회한 값도 직렬화하기 전에 다시 검증합니다.
  const validatedMessage = parseAdminNotice(message);

  return redis.publish(channel, JSON.stringify(validatedMessage));
}

/** 입력값으로 일반 공지를 구성해 발행합니다. */
async publishInfoNotice(input: {
  noticeId: string;
  title: string;
  content: string;
}): Promise<number> {
  return this.publishAdminNotice({
    noticeId: input.noticeId,
    title: input.title,
    content: input.content,
    level: 'INFO',
    createdAt: new Date().toISOString(),
  });
}

/** 입력값으로 긴급 공지를 구성해 발행합니다. */
async publishUrgentNotice(input: {
  noticeId: string;
  title: string;
  content: string;
}): Promise<number> {
  return this.publishAdminNotice({
    noticeId: input.noticeId,
    title: input.title,
    content: input.content,
    level: 'URGENT',
    createdAt: new Date().toISOString(),
  });
}
```

관리자 공지 메시지는 다음 구조를 가집니다.  

```typescript
export type AdminNoticeMessage = {
  noticeId: string;
  title: string;
  content: string;
  level: 'INFO' | 'WARNING' | 'URGENT';
  createdAt: string;
};
```

공지 레벨은 다음과 같이 구분합니다.  

```text
INFO    → 일반 공지
WARNING → 주의 공지
URGENT  → 긴급 공지
```

공지 발행의 핵심 코드는 다음과 같습니다.  

```typescript
const channel = RedisKey.channel.adminNotice();
const validatedMessage = parseAdminNotice(message);

return redis.publish(channel, JSON.stringify(validatedMessage));
```

`channel:admin-notice`를 현재 구독 중인 서버는 모두 같은 메시지를 받습니다.  

### 🟦 관리자 공지 구독

```typescript
/** 관리자 공지 채널을 구독하고 공지 메시지를 콜백에 전달합니다. */
async subscribeAdminNotice(
  onMessage: (message: AdminNoticeMessage) => void | Promise<void>,
): Promise<() => Promise<void>> {
  const channel = RedisKey.channel.adminNotice();

  const subscriber = redis.duplicate();
  subscriber.on('error', (error) => {
    console.error('[AdminNoticePubSub] Subscriber error:', error);
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(channel, async (rawMessage) => {
      let message: AdminNoticeMessage;

      // JSON 구문과 모든 공지 필드를 먼저 검증합니다.
      try {
        message = parseAdminNotice(
          parseJsonObject(rawMessage, 'AdminNoticeMessage'),
        );
      } catch (error) {
        console.error('[AdminNoticePubSub] Invalid message:', error);
        return;
      }

      try {
        await onMessage(message);
      } catch (error) {
        console.error('[AdminNoticePubSub] Handler failed:', error);
      }
    });
  } catch (error) {
    if (subscriber.isOpen) {
      await subscriber.quit().catch((closeError: unknown) => {
        console.error('[AdminNoticePubSub] Failed to close subscriber:', closeError);
      });
    }
    throw error;
  }

  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;

    if (!subscriber.isOpen) return;

    try {
      await subscriber.unsubscribe(channel);
    } finally {
      if (subscriber.isOpen) await subscriber.quit();
    }
  };
}
```

수신한 공지는 `parseAdminNotice()`에서 `noticeId`, `title`, `content`, `level`, `createdAt`을 검증한 뒤 사용합니다.  
발행 단계에서도 같은 검증을 적용하므로 TypeScript 타입을 우회한 잘못된 값이 채널에 전달되지 않습니다.  

### 🟦 관리자 공지에 Pub/Sub을 사용하는 이유

관리자 공지는 일반적으로 다음 요구사항을 가집니다.  

- 접속 중인 사용자에게 즉시 전달
- 여러 서버에 동시에 전파
- 단순한 메시지 구조
- 유실되더라도 이후 공지 목록 API로 보완 가능

이런 경우에는 Pub/Sub이 적합합니다.  
다만 공지 자체를 보관해야 한다면 Pub/Sub만 사용하면 안 됩니다.  

```text
DB
  → 공지 이력 저장

Redis Pub/Sub
  → 현재 접속 중인 사용자에게 실시간 전달
```
