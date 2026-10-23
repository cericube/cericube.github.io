---
layout: post
title: "11. GraphQL Subscription과 SSE·WebSocket 실시간 통신"
description: "GraphQL Subscription의 PubSub 이벤트 흐름을 이해하고, Fastify와 GraphQL Yoga에서 SSE와 WebSocket 통신을 구현합니다. JWT 인증과 Prisma 게시글 생성을 연결해 실시간 이벤트를 받고 두 전송 방식을 비교합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 11
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL Subscription 개념과 동작 원리"
  - id: session-02
    title: "2. GraphQL over SSE 이해와 구현"
  - id: session-03
    title: "3. GraphQL over WebSocket 이해와 구현"
  - id: session-04
    title: "4. GraphQL Subscription 실습 및 동작 검증"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

Query와 Mutation은 클라이언트가 요청하면 서버가 결과를 한 번 반환합니다.  
반면 Subscription은 연결을 유지하면서 서버에 이벤트가 발생할 때마다 새로운 결과를 전달합니다.  
이번 글에서는 새 게시글이 만들어지면 `postCreated` 이벤트를 발행하고, SSE와 WebSocket 클라이언트가 이 이벤트를 실시간으로 받는 과정을 구현합니다.  

```text
createPost Mutation
  → JWT 인증
  → Prisma 게시글 저장
  → PubSub 이벤트 발행
  → postCreated Subscription
      ├─ SSE 클라이언트로 전송
      └─ WebSocket 클라이언트로 전송
```

다음 패키지가 추가로 필요합니다. `@types/ws`는 실행 코드가 아닌 TypeScript 타입 선언이므로 개발 의존성으로 설치합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm install graphql-sse@2.6.3 graphql-ws@6.4.1 ws@8.22.0
npm install --save-dev @types/ws@8.18.2
```

## 1. GraphQL Subscription 개념과 동작 원리 {#session-01}

### 🟦 Query·Mutation·Subscription의 차이

GraphQL 작업은 목적과 결과를 전달하는 방식에 따라 Query, Mutation, Subscription으로 나뉩니다.  

| 작업 | 주요 목적 | 결과 전달 | 연결 특성 |
| --- | --- | --- | --- |
| Query | 데이터 조회 | 결과를 한 번 반환 | 응답 후 종료 |
| Mutation | 데이터 변경 | 결과를 한 번 반환 | 응답 후 종료 |
| Subscription | 이벤트 구독 | 이벤트가 발생할 때마다 반환 | 구독을 해제할 때까지 유지 |

Subscription이 직접 데이터를 저장하는 것은 아닙니다. 게시글 생성은 Mutation과 Service가 담당합니다.  
Subscription은 게시글 생성 이벤트를 기다렸다가 구독자에게 전달합니다.  

```graphql
# 새 게시글이 생성될 때마다 해당 게시글의 ID, 제목, 작성자 이름을 전달받습니다.
subscription PostCreated {
  postCreated {
    id
    title
    author {
      displayName
    }
  }
}
```

클라이언트가 이 작업을 실행하면 요청이 바로 끝나지 않고 새 게시글 이벤트를 기다립니다.  
이후 서버가 이벤트를 발행할 때마다 요청에서 선택한 필드가 GraphQL 결과로 전달됩니다.  

### 🟦 Subscription Resolver와 PubSub 기반 이벤트 처리 구조

PubSub(Publish/Subscribe)은 이벤트를 발행하는 코드와 받아서 처리하는 코드를 분리하는 방식입니다.  
발행자는 구독자가 누구인지 알 필요가 없으며, 두 코드는 `post:created`라는 이벤트 이름으로 연결됩니다.  

실습의 `postPubSub`은 서버 프로세스 전체에서 하나만 생성합니다.  
요청마다 새 인스턴스를 만들면 Mutation의 발행자와 Subscription의 구독자가 서로 다른 PubSub을 사용하므로 이벤트가 전달되지 않습니다.  

```typescript
// /src/modules/post/post.pubsub.ts
export const postPubSub = createPubSub<{
  // post.resolver.ts에서 postPubSub.publish('post:created', post)로 발행하면
  // postCreated Subscription의 구독자에게 post 객체가 전달됩니다.
  'post:created': [Post];
}>();
```

GraphQL Schema에는 클라이언트가 구독할 필드를 선언합니다.  

```graphql
# /src/modules/post/post.schema.ts
type Subscription {
  # 로그인한 구독자에게 새 게시글을 전달합니다.
  postCreated: Post!
}
```

Subscription Resolver는 `subscribe`와 `resolve`를 이용해 이벤트를 처리합니다.  

- `subscribe`: 클라이언트가 구독을 시작할 때 한 번 실행됩니다.  
- `resolve`: 새 게시글 이벤트가 발생할 때마다 실행됩니다. 이벤트에 담긴 게시글을 `postCreated`의 결과로 반환합니다.  

즉, `subscribe`가 이벤트를 기다리고 있다가 새 게시글을 받으면, `resolve`가 그 게시글을 클라이언트에 전달합니다.  

```typescript
// /src/modules/post/post.resolver.ts
Subscription: {
  postCreated: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // 구독을 시작할 때 인증된 사용자인지 먼저 확인합니다.
      requireAuth(context.authUser);
      return postPubSub.subscribe('post:created');
    },
    resolve: (post: Post) => post,
  },
},
```

이 구조에서는 이벤트 처리 로직과 전송 프로토콜이 서로 분리됩니다. 따라서 같은 `postCreated` Resolver를 SSE와 WebSocket에서 함께 사용할 수 있습니다.  

> `createPubSub()`은 하나의 Node.js 프로세스 안에서만 이벤트를 전달합니다. 서버를 여러 인스턴스로 운영한다면 Redis Pub/Sub이나 메시지 브로커처럼 모든 인스턴스가 공유할 수 있는 이벤트 전달 수단이 필요합니다.  

## 2. GraphQL over SSE 이해와 구현 {#session-02}

### 🟦 SSE 기반 실시간 통신 원리

SSE(Server-Sent Events)는 HTTP 연결을 유지하면서 서버가 클라이언트에 이벤트를 계속 보내는 방식입니다.  
GraphQL over SSE에서는 클라이언트가 HTTP로 Subscription 작업을 요청하고, 서버는 `text/event-stream` 형식의 응답으로 GraphQL 결과를 계속 보냅니다.  

```text
클라이언트 ── HTTP Subscription 요청 ──→ 서버
클라이언트 ←── event: next ───────────── 서버
클라이언트 ←── event: next ───────────── 서버
클라이언트 ←── event: complete ───────── 서버
```

SSE는 서버가 클라이언트에 결과를 보내는 단방향 스트림입니다. 클라이언트가 새로운 Query나 Mutation을 실행하려면 별도의 HTTP 요청을 보내야 합니다. 기존 HTTP 환경을 그대로 활용하기 쉽지만, 프록시의 응답 버퍼링과 유휴 연결 제한은 함께 점검해야 합니다.  

### 🟦 Fastify + GraphQL Yoga의 SSE Subscription 구현

실습의 HTTP GraphQL 요청은 Fastify의 `/api/graphql` 라우트를 거쳐 Yoga로 전달됩니다.  
Yoga는 같은 엔드포인트에서 일반 GraphQL 응답과 SSE Subscription 응답을 처리합니다.  

```typescript
// /src/graphql/yoga.ts
export const yoga = createYoga<GraphQLContext>({
  schema,
  // app.ts의 /api 접두사와 합쳐져 /api/graphql이 됩니다.
  graphqlEndpoint: '/graphql',
  graphiql: true,
});
```

Fastify 라우트는 Access Token을 검증한 뒤 `authUser`를 Context에 넣습니다.  
따라서 SSE Subscription도 일반 HTTP Query·Mutation처럼 `Authorization` 헤더로 인증합니다.  

```typescript
// /src/graphql/route.ts
handler: async (req, reply) => {
  const loaders = createLoaders(app.prisma);
  const authUser = await services.auth.authenticateAuthorization(
    req.headers.authorization,
  );

  const response = await yoga.handleNodeRequestAndResponse(req, reply, {
    req,
    reply,
    services,
    loaders,
    ...(authUser == null ? {} : { authUser }),
  });

  // Yoga의 상태 코드와 헤더를 Fastify 응답으로 옮깁니다.
  response.headers.forEach((value, key) => reply.header(key, value));
  reply.status(response.status);
  return reply.send(response.body);
},
```

SSE 연결은 이벤트가 없는 동안에도 계속 열려 있습니다.  
Fastify가 이 연결을 유휴 상태로 판단해 종료하지 않도록 실습에서는 `connectionTimeout`을 `0`으로 설정합니다.  
운영 환경에서는 로드 밸런서와 리버스 프록시의 타임아웃 및 버퍼링 설정도 확인해야 합니다.  

```typescript
// /src/app.ts
const app = Fastify({
  // 이벤트를 기다리는 SSE 연결에 Fastify의 유휴 제한을 적용하지 않습니다.
  connectionTimeout: 0,
  keepAliveTimeout: 5_000,
  requestTimeout: 30_000,
});
```

Node.js SSE 클라이언트는 `graphql-sse`의 `createClient()`를 사용합니다.  
로그인 Mutation에서 받은 Access Token은 HTTP 헤더에 넣습니다.  

```typescript
// /examples/sse-client.ts
import { createClient } from 'graphql-sse';

const accessToken = process.env.ACCESS_TOKEN;
const client = createClient({
  url: 'http://localhost:3000/api/graphql',
  headers: accessToken == null
    ? {}
    : { authorization: `Bearer ${accessToken}` },
});

const dispose = client.subscribe(
  { query: 'subscription { postCreated { id title author { displayName } } }' },
  {
    next: (result) => console.log('SSE event:', JSON.stringify(result)),
    error: (error) => console.error('SSE error:', error),
    complete: () => console.log('SSE subscription completed'),
  },
);

process.once('SIGINT', () => {
  // 진행 중인 HTTP 스트림을 닫습니다.
  dispose();
  process.exit(0);
});
```

## 3. GraphQL over WebSocket 이해와 구현 {#session-03}

### 🟦 WebSocket 기반 양방향 통신 원리

WebSocket은 HTTP Upgrade 요청으로 연결을 시작합니다. 연결이 만들어진 뒤에는 클라이언트와 서버가 하나의 연결을 통해 서로 메시지를 보낼 수 있습니다.  
GraphQL 작업을 WebSocket으로 주고받으려면 별도의 전송 규약이 필요하며, 실습에서는 `graphql-transport-ws` 프로토콜을 구현한 `graphql-ws`를 사용합니다.  

```text
클라이언트 ── HTTP Upgrade ─────────────→ 서버
클라이언트 ── ConnectionInit ──────────→ 서버
클라이언트 ←─ ConnectionAck ──────────── 서버
클라이언트 ── Subscribe(postCreated) ──→ 서버
클라이언트 ←─ Next(GraphQL 결과) ─────── 서버
클라이언트 ── Complete ────────────────→ 서버
```

WebSocket에서는 하나의 연결로 Subscription뿐 아니라 Query와 Mutation도 실행할 수 있습니다.  
다만 이 실습에서는 로그인과 토큰 재발급 과정에서 Refresh Token Cookie를 HTTP 응답에 설정해야 하므로, 두 작업은 HTTP GraphQL 요청으로만 실행할 수 있습니다.  

| 비교 항목 | SSE | WebSocket |
| --- | --- | --- |
| 기반 연결 | HTTP 응답 스트림 | HTTP에서 Upgrade한 WebSocket |
| 통신 방향 | 서버 → 클라이언트 스트림 | 양방향 메시지 |
| 인증 전달 | HTTP `Authorization` 헤더 | `ConnectionInit`의 `connectionParams` |
| 실습 서버 | GraphQL Yoga | `graphql-ws` + `ws` |
| 실습 주소 | `http://localhost:3000/api/graphql` | `ws://localhost:3000/api/graphql` |

### 🟦 graphql-ws를 활용한 WebSocket Subscription 구현

`ws`의 `WebSocketServer`를 Fastify가 사용하는 HTTP 서버에 연결합니다. HTTP GraphQL과 경로는 같지만 WebSocket Upgrade 요청만 별도로 처리합니다.  

```typescript
// /src/graphql/websocket.ts
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';

// HTTP GraphQL과 같은 포트와 경로를 사용하며 WebSocket Upgrade 요청만 따로 받습니다.
const webSocketServer = new WebSocketServer({
  server: app.server,
  path: '/api/graphql',
});

// useServer가 GraphQL 메시지 해석, 작업 실행과 Subscription 결과 전송을 담당합니다.
// 반환된 cleanup 객체는 서버 종료 시 활성 작업을 정리하는 데 사용합니다.
const cleanup = useServer(
  {
    // SSE와 WebSocket이 같은 실행 가능한 Schema를 공유합니다.
    schema,
    context: async (socketContext) => {
    // HTTP 헤더 대신 ConnectionInit 메시지의 connectionParams로 Access Token을 받습니다.
      const authUser = await services.auth.authenticateAuthorization(
        authorizationFrom(socketContext.connectionParams),
      );

      return {
        services,
        // Loader 캐시는 연결 전체가 아닌 GraphQL 작업별로 격리합니다.
        loaders: createLoaders(app.prisma),
        ...(authUser == null ? {} : { authUser }),
      };
    },
  },
  webSocketServer,
);
```

브라우저의 WebSocket API에서는 `Authorization` 헤더를 직접 설정할 수 없습니다. 따라서 `graphql-ws` 클라이언트는 연결을 초기화할 때 Access Token을 `connectionParams`에 담습니다. 서버는 이 값을 읽어 사용자를 인증합니다.  

```typescript
// /src/graphql/websocket.ts
function authorizationFrom(params: ConnectionParams) {
  if (params == null) return undefined;
  const authorization = params.authorization ?? params.Authorization;
  return typeof authorization === 'string' ? authorization : undefined;
}
```

서버가 종료될 때는 진행 중인 GraphQL 작업과 WebSocket 서버도 정리해야 합니다.  

```typescript
// /src/graphql/websocket.ts
app.addHook('onClose', async () => {
    try {
      await cleanup.dispose();
    } finally {
      webSocketServer.close();
    }
});
```

WebSocket 플러그인은 JWT와 HTTP 라우트를 등록한 뒤에 추가합니다.  

```typescript
// /src/app.ts
app.register(jwtPlugin);
app.register(routes, { prefix: '/api' });
app.register(graphqlWebSocketPlugin);
```

Node.js 클라이언트에서는 `ws` 구현을 `graphql-ws`에 전달합니다.  

```typescript
// /examples/websocket-client.ts
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const accessToken = process.env.ACCESS_TOKEN;
const client = createClient({
  url: 'ws://localhost:3000/api/graphql',
  webSocketImpl: WebSocket,
  connectionParams: accessToken == null
    ? {}
    : { authorization: `Bearer ${accessToken}` },
});

const dispose = client.subscribe(
  { query: 'subscription { postCreated { id title author { displayName } } }' },
  {
    next: (result) => console.log('WebSocket event:', JSON.stringify(result)),
    error: (error) => console.error('WebSocket error:', error),
    complete: () => console.log('WebSocket subscription completed'),
  },
);

process.once('SIGINT', () => {
  dispose();
  void client.dispose();
});
```

## 4. GraphQL Subscription 실습 및 동작 검증 {#session-04}

### 🟦 현재 실습 구조의 데이터 처리 흐름

![Subscripttion 흐름](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-7.png)
현재 실습에서는 다음 순서로 게시글 생성 결과를 구독자에게 전달합니다.  

1. **Repository**는 게시글을 저장하고 `authorId`가 포함된 `post`를 반환합니다.  
2. **Service**는 반환받은 `post`를 Mutation Resolver에 전달합니다.  
3. **Mutation Resolver**는 `post`를 Payload로 담아 게시글 생성 이벤트를 한 번 발행합니다.  
4. **Subscription**은 이벤트를 받은 뒤 각 구독자가 요청한 필드를 처리합니다.  
5. 구독자가 `author`를 요청했다면 **`Post.author` Field Resolver**가 `posts.author(parent.id)`를 호출해 작성자를 조회합니다.  
6. GraphQL은 게시글과 요청한 작성자 정보를 각 클라이언트에 전달합니다.  

게시글 저장과 이벤트 발행은 한 번만 실행됩니다. 그러나 `author` 조회는 해당 필드를 요청한 구독마다 실행됩니다.  
예를 들어 SSE 구독자와 WebSocket 구독자가 모두 `author`를 요청하면 같은 작성자를 데이터베이스에서 각각 조회할 수 있습니다.  

```text
게시글 저장 1회 → 이벤트 발행 1회
                    ├─ SSE 구독 처리 → Post.author → 작성자 조회
                    └─ WebSocket 구독 처리 → Post.author → 작성자 조회
```

### 🟦 이벤트 Payload에 작성자 정보를 포함하는 개선안

핵심 개선점은 구독마다 반복되는 작성자 데이터베이스 조회를 줄이는 것입니다.  
Repository가 게시글을 생성할 때 `author.displayName`도 함께 조회하고, Mutation Resolver가 작성자 정보가 포함된 `post`를 이벤트로 발행하도록 바꿀 수 있습니다.  

```typescript
// /src/modules/post/post.repository.ts
create(authorId: number, input: CreatePostInput) {
  return this.prisma.post.create({
    data: {
      authorId,
      title: input.title,
      content: input.content ?? null,
      published: input.published ?? false,
    },
    // 이벤트를 처리할 때 다시 조회하지 않도록 작성자 이름도 가져옵니다.
    include: {
      author: {
        select: { displayName: true },
      },
    },
  });
}
```

Mutation Resolver의 이벤트 발행 방식은 그대로입니다. 다만 이제 `post` 안에 작성자 정보도 들어 있으므로 구독자별 Field Resolver가 이를 재사용할 수 있습니다.  

```typescript
// /src/modules/post/post.resolver.ts
type PostWithAuthor = Post & {
  author?: { displayName: string };
};

author: (
  parent: PostWithAuthor,
  _args: unknown,
  context: GraphQLContext,
) =>
  // 이벤트 Payload에 작성자가 있으면 사용하고, 없을 때만 조회합니다.
  parent.author ?? context.services.posts.author(parent.id),
```

이렇게 바꾸면 구독마다 `Post.author` Field Resolver 자체는 실행되지만, 같은 작성자를 데이터베이스에서 반복해서 조회하지 않습니다.  
다만 클라이언트가 작성자의 `id`처럼 다른 필드도 요청할 수 있다면 `displayName`뿐 아니라 응답에 필요한 작성자 필드를 Repository에서 함께 준비해야 합니다.  

### 🟦 JWT 인증과 Prisma를 연동한 게시글 생성 Mutation 구현

실시간 이벤트는 인증된 사용자가 `createPost` Mutation을 실행하면서 시작됩니다. 게시글 입력에는 작성자 ID를 받지 않습니다. 대신 Access Token으로 확인한 사용자 ID를 사용하므로 다른 사용자의 ID를 작성자로 지정할 수 없습니다.  

```typescript
// /src/modules/post/post.service.ts
create(authUser: AuthUser, input: CreatePostInput) {
  this.validateTitle(input.title);
  // 인증 사용자 ID를 Prisma Repository에 전달합니다.
  return this.posts.create(authUser.id, input);
}
```

Repository는 인증 사용자 ID를 `authorId`에 넣어 게시글을 저장합니다.  

```typescript
// /src/modules/post/post.repository.ts
create(authorId: number, input: CreatePostInput) {
  return this.prisma.post.create({
    data: {
      authorId,
      title: input.title,
      content: input.content ?? null,
      published: input.published ?? false,
    },
  });
}
```

### 🟦 Mutation 실행 후 PubSub 이벤트 발행

Resolver는 Prisma가 게시글을 저장할 때까지 기다린 뒤 `post:created` 이벤트를 발행합니다. 저장 전에 이벤트를 발행하면 데이터베이스 작업이 실패하더라도 구독자에게 게시글이 만들어졌다는 잘못된 알림이 전달될 수 있습니다.  

```typescript
// /src/modules/post/post.resolver.ts
Mutation: {
  createPost: async (
    _parent: unknown,
    args: { input: CreatePostInput },
    context: GraphQLContext,
  ) => {
    const authUser = requireAuth(context.authUser);
    const post = await context.services.posts.create(authUser, args.input);

    // 저장에 성공한 게시글만 구독자에게 알립니다.
    postPubSub.publish('post:created', post);
    return post;
  },
},
```

### 🟦 SSE와 WebSocket 클라이언트에서 Subscription 실행

먼저 데이터베이스와 서버를 준비합니다. Seed 사용자의 비밀번호는 모두 `Password123!`이며, `user1@example.com`은 관리자 계정입니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npx prisma migrate dev
npx prisma db seed
npm run dev
```

GraphiQL에서 로그인 Mutation을 실행하고 응답의 `accessToken`을 복사합니다.  

```graphql
mutation Login {
  login(
    input: {
      email: "user1@example.com"
      password: "Password123!"
    }
  ) {
    accessToken
  }
}
```

새 터미널을 열고 Access Token을 환경 변수에 넣은 뒤 SSE 클라이언트를 실행합니다.  

```bash
ACCESS_TOKEN='로그인으로 받은 Access Token' 
npx tsx ./examples/sse-client.ts
```

터미널을 하나 더 열어 같은 방법으로 WebSocket 클라이언트를 실행합니다.  

```bash
ACCESS_TOKEN='로그인으로 받은 Access Token'
npx tsx ./examples/websocket-client.ts
```

두 클라이언트는 이제 `postCreated` 이벤트를 기다립니다. Access Token을 생략하거나 잘못된 토큰을 전달하면 `requireAuth()`가 구독 시작을 거절합니다.  

### 🟦 게시글 생성 시 실시간 이벤트 수신 및 동작 비교

GraphiQL의 Headers 영역에 Access Token을 설정합니다.  

```json
{
  "Authorization": "Bearer 로그인으로 받은 Access Token"
}
```

그다음 게시글 생성 Mutation을 실행합니다.  

```graphql
mutation CreatePost {
  createPost(
    input: {
      title: "Subscription 실습 게시글"
      content: "SSE와 WebSocket에서 같은 이벤트를 확인합니다."
      published: true
    }
  ) {
    id
    title
    author {
      displayName
    }
  }
}
```

![게시글 생성 화면](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-8.png)
Mutation이 성공하면 SSE와 WebSocket 클라이언트를 실행한 터미널에 같은 게시글 정보가 출력됩니다. 전송 방식은 다르지만 두 클라이언트는 같은 Schema, Resolver, PubSub 이벤트를 사용합니다.  

SSE 클라이언트에 게시글 정보가 출력되는 예시 화면입니다.  

![SSE 응답 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-9.png)

WebSocket 클라이언트에 게시글 정보가 출력되는 예시 화면입니다.  

![WS 응답 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-10.png)

SSE는 서버 알림처럼 서버에서 클라이언트로만 데이터를 보낼 때 간단하게 사용할 수 있습니다. WebSocket은 하나의 연결에서 양방향 메시지를 주고받거나 여러 GraphQL 작업을 처리할 때 유용합니다. 어떤 방식을 선택하더라도 Resolver와 PubSub을 전송 계층에서 분리하면 업무 로직을 바꾸지 않고 알맞은 통신 방식을 선택할 수 있습니다.  

### 🟦 GraphQL Yoga + Redis Pub/Sub + SSE 아키텍처

![다중서버 알림 구성](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-11.png)

위 개념도는 여러 대의 GraphQL Yoga 서버에서 Redis Pub/Sub으로 이벤트를 공유하고, SSE(Server-Sent Events)를 통해 클라이언트에 실시간으로 전달하는 구조를 나타냅니다.  

지금까지 사용한 `createPubSub()`은 한 서버 프로세스의 메모리 안에서만 이벤트를 전달합니다. 따라서 서버가 여러 대라면 한 서버에서 발행한 이벤트를 다른 서버가 알 수 없습니다. 예를 들어 클라이언트는 1번 서버에 SSE로 연결되어 있는데, 게시글 생성 Mutation이 2번 서버에서 처리되면 1번 서버의 인메모리 PubSub에는 이벤트가 도착하지 않습니다.  

이때 Redis Pub/Sub을 서버들이 함께 사용하는 이벤트 통로로 둘 수 있습니다. 전체 흐름은 다음과 같습니다.  

1. 클라이언트가 로드 밸런서를 거쳐 GraphQL Yoga 서버에 SSE Subscription을 연결합니다.  
2. 각 Yoga 서버는 Redis의 게시글 생성 채널을 구독합니다.  
3. 어느 서버에서든 게시글 생성 Mutation이 성공하면 해당 서버가 Redis 채널에 이벤트를 발행합니다.  
4. Redis는 같은 채널을 구독 중인 모든 Yoga 서버에 이벤트를 전달합니다.  
5. 각 Yoga 서버는 자신에게 SSE로 연결된 클라이언트의 요청 필드에 맞춰 GraphQL 결과를 만들고 전송합니다.  

```text
게시글 생성 Mutation
  → Redis 채널에 이벤트 발행
  → 여러 GraphQL Yoga 서버가 같은 이벤트 수신
  → 각 서버가 자신에게 연결된 SSE 클라이언트에 결과 전송
```

이 구조에서는 클라이언트가 어느 Yoga 서버에 연결되어 있든 같은 실시간 이벤트를 받을 수 있습니다. GraphQL Resolver는 이벤트 처리에 집중하고, Redis는 서버 사이의 이벤트 공유를, SSE는 서버에서 클라이언트로 결과를 전송하는 역할을 담당합니다.  
