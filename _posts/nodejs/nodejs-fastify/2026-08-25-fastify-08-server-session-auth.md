---
layout: post
title: "[Fastify] 08. Server Session과 HttpOnly Cookie 인증 이해하기"
description: "Fastify에서 Server Session과 HttpOnly Cookie로 로그인 상태를 유지하는 원리를 알아봅니다. @fastify/session 설정부터 로그인, 보호 API, 새 탭의 로그인 유지, 로그아웃과 Redis 운영 기준까지 실제 요청 흐름으로 정리합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. Server Session과 HttpOnly Cookie 이해"
  - id: session-02
    title: "2. Fastify 세션 인증 설정"
  - id: session-03
    title: "3. 로그인·보호 API·로그아웃 구현"
  - id: session-04
    title: "4. 운영 환경 구성과 JWT 방식 선택"
---

## 1. Server Session과 HttpOnly Cookie 이해 {#session-01}

웹 서비스의 로그인 상태는 Server Session이나 JWT 같은 여러 방식으로 관리할 수 있습니다.  
이 글에서는 브라우저 웹 하나를 운영할 때 비교적 단순하게 적용할 수 있는 Server Session 방식을 먼저 살펴봅니다.  

Server Session 방식은 실제 로그인 상태를 서버가 보관하고, 브라우저에는 해당 상태를 찾기 위한 Session ID만 쿠키로 전달합니다.  
이 글에서 다루는 `@fastify/session`도 같은 구조입니다.  

![브라우저의 HttpOnly 쿠키와 Fastify 및 Redis의 Server Session 관계](/assets/images/nodejs/nodejs-fastify/fastify-server-session-cookie-flow.svg)

### 🟦 로그인할 때 세션이 만들어지는 과정

사용자가 로그인하면 서버는 이메일과 비밀번호를 검증한 뒤 새로운 Session ID를 만듭니다.  
Session Store에는 Session ID와 연결된 사용자 식별자 등을 저장하고, 브라우저에는 Session ID만 쿠키로 내려줍니다.  

```text
로그인 성공
  ↓
서버가 Session ID 생성
  ↓
Session Store
abc123 → { userId: 100, expiresAt: ... }
  ↓
브라우저에 Session ID 쿠키 설정
Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax
```

여기서 `HttpOnly`, `Secure`, `SameSite`는 Session ID 쿠키가 노출되거나 의도하지 않은 요청에 사용될 위험을 줄이는 보안 속성입니다.  

이후 브라우저가 보호 API를 요청하면 같은 사이트에 해당하는 쿠키를 자동으로 보냅니다.  

```http
GET /api/me HTTP/1.1
Host: example.com
Cookie: session_id=abc123
```

Fastify는 쿠키에서 Session ID를 읽고 Session Store를 조회합니다.  
유효한 세션에서 `userId=100`을 찾으면 로그인한 사용자로 요청을 처리합니다.  

### 🟦 HttpOnly, Secure, SameSite가 보호하는 범위

`HttpOnly` 쿠키는 브라우저 JavaScript가 `document.cookie`로 Session ID를 읽지 못하게 합니다.  
XSS가 발생했을 때 공격자가 Session ID 문자열을 직접 읽어 외부로 가져가는 위험을 줄일 수 있습니다.  
다만 브라우저가 해당 쿠키를 HTTP 요청에 자동으로 포함하는 동작은 막지 않습니다.  

> XSS(Cross-Site Scripting)는 공격자가 XSS = 악성 JavaScript를 다른 사용자의 브라우저에서 실행시키는 공격  

`Secure`는 HTTPS 연결에서만 쿠키를 전송하게 합니다.  
네트워크 구간에서 평문 HTTP로 Session ID가 노출되는 위험을 줄이므로 운영 환경에서는 HTTPS와 함께 `Secure` 설정을 사용해야 합니다.  
로컬 HTTP 개발 환경에서 `Secure` 쿠키가 전송되지 않는 것은 정상적인 동작입니다.  

`SameSite`는 다른 사이트에서 시작된 요청에 쿠키를 포함할지 정합니다.  
브라우저가 쿠키를 자동 전송하는 점을 악용하는 CSRF 공격을 완화하는 데 도움이 됩니다.  

| 설정 | 동작 | 주로 사용하는 경우 |
| --- | --- | --- |
| `Strict` | 다른 사이트에서 시작된 요청에는 쿠키를 보내지 않습니다. | 외부 링크로 접속했을 때 로그인 상태가 즉시 필요하지 않은 서비스 |
| `Lax` | 주소창 이동 같은 상위 수준의 안전한 탐색에는 쿠키를 보낼 수 있지만, 일반적인 교차 사이트 `POST`, `fetch`, `iframe` 요청에는 보내지 않습니다. | 외부 링크 접속과 CSRF 완화를 함께 고려하는 일반적인 웹 서비스 |
| `None` | 교차 사이트 요청에도 쿠키를 보냅니다. `Secure`를 반드시 함께 설정해야 합니다. | 다른 사이트에서 삽입되거나 호출되는 서비스 |

`SameSite=Lax`는 외부 사이트에서 오는 요청에 세션 쿠키 전송을 제한해 CSRF 위험을 줄입니다. 다만 모든 CSRF를 막는 것은 아니므로 필요하면 Origin 검사나 CSRF Token을 함께 사용합니다.  

> CSRF(Cross-Site Request Forgery)는 사용자가 로그인된 상태를 악용해서, 공격자가 원하지 않는 요청을 대신 보내게 하는 공격입니다.  

HttpOnly는 JavaScript가 세션 쿠키를 직접 읽지 못하게 해 XSS 시 쿠키 탈취 위험을 줄입니다. 하지만 XSS 자체를 막지는 못합니다  

세션 쿠키의 서명은 Session ID가 클라이언트에서 변조되지 않았는지 확인하는 기능이며,  
쿠키 값을 암호화하거나 서버의 Session 데이터를 브라우저에 저장한다는 뜻은 아닙니다.  

## 2. Fastify 세션 인증 설정 {#session-02}

Fastify에서는 `@fastify/cookie`와 `@fastify/session`을 조합하면 Session ID 생성, 서명, Store 조회와 `request.session` 구성을 직접 구현하지 않아도 됩니다.  
`@fastify/session`은 Cookie 플러그인에 의존하므로 Cookie를 먼저 등록해야 합니다.  

### 🟦 패키지 설치

```bash
# 쿠키 파싱과 서버 측 세션 관리 플러그인을 설치합니다.
npm install @fastify/cookie @fastify/session
```

`fastify-basics` 프로젝트는 Fastify 5를 사용하므로 Fastify 5와 호환되는 플러그인 버전을 선택해야 합니다.  
패키지 버전을 변경할 때는 각 플러그인의 호환성 표를 함께 확인하는 편이 안전합니다.  

### 🟦 Session 플러그인 등록

```typescript
// /src/ch08/app.ts
import { fastifyCookie } from '@fastify/cookie';
import { fastifySession } from '@fastify/session';
import Fastify from 'fastify';

// @fastify/session의 cookie.maxAge는 밀리초 단위입니다.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const SESSION_COOKIE_NAME = 'session_id';

// 플러그인이 요구하는 32자 이상의 예제용 서명 비밀키입니다.
// 소스에 포함된 고정 비밀키이므로 실제 서비스에서는 환경 변수나 비밀 관리 도구로 주입해야 합니다.
const SESSION_SECRET = 'local-ch08-session-secret-change-me-1234';

/**
 * 외부 DB나 Redis 없이 세션 인증의 전체 요청 흐름을 실행하는 Fastify 앱을 만듭니다.
 * 기본 Memory Store는 학습과 테스트에만 사용하며 운영에서는 Redis 같은 공용 Store로 교체해야 합니다.
 */
export function buildCh08App() {
  const app = Fastify({ logger: true });

  // @fastify/session이 요청 쿠키를 읽을 수 있도록 Cookie 플러그인을 먼저 등록합니다.
  app.register(fastifyCookie);

  // Session 플러그인은 세션 데이터를 서버의 Store에 보관하고, 브라우저에는 서명된 Session ID만 보냅니다.
  // store를 생략하면 기본 Memory Store를 사용하므로 서버를 재시작하면 세션이 사라집니다.
  app.register(fastifySession, {
    // secret은 Session ID 쿠키의 변조 여부를 확인하는 서명에 사용합니다.
    secret: SESSION_SECRET,

    // store는 세션 데이터를 보관할 저장소를 지정하는 옵션이며, 생략하면 기본 Memory Store를 사용합니다.
    // 아래는 connect-redis로 만든 Redis Store를 지정하는 예시입니다.
    // store: redisStore,

    cookieName: SESSION_COOKIE_NAME,

    // 세션에 아무 값도 저장하지 않았다면 세션 저장소에 세션을 만들지 않고, 세션 쿠키도 발급하지 않습니다.
    saveUninitialized: false,

    // 유효한 요청이 이어지는 동안 쿠키 만료 시각을 SESSION_TTL_MS만큼 다시 연장합니다.
    // 마지막 요청 이후 SESSION_TTL_MS 동안 요청이 없으면 만료됨
    rolling: true,
    cookie: {
      // JavaScript에서 쿠키를 읽지 못하게 하여 쿠키 탈취 위험을 줄입니다.
      httpOnly: true,

      // secure가 true인 쿠키는 HTTPS에서만 전송됩니다.
      secure: false,

      // 일반적인 외부 사이트 요청에는 쿠키 전송을 제한하면서 같은 사이트 탐색은 허용합니다.
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    },
  });

  return app;
}
```

📌 `maxAge` 단위는 사용하는 API에 따라 다릅니다.  
위의 `@fastify/session` 초기 설정에서는 밀리초를 사용하지만, `reply.setCookie()`에서 직접 지정하는 `@fastify/cookie`의 `maxAge`는 초 단위입니다.  

### 🟦 TypeScript Session 타입 확장

Session에 저장할 값을 TypeScript가 알 수 있도록 `fastify` 모듈의 `Session` 인터페이스를 확장합니다.  

```typescript
declare module 'fastify' {
  // 선언 병합으로 request.session에 저장할 사용자 정의 필드의 타입을 추가합니다.
  // 비밀번호나 전체 사용자 객체 대신 인증에 필요한 최소 정보만 세션에 보관합니다.
  interface Session {
    userId?: number;
    role?: 'USER' | 'ADMIN';
  }
}
```

일반적으로 사용자를 다시 조회할 수 있는 `userId`만 저장하고, 자주 필요한 권한 정보를 함께 저장한다면 역할 변경 시 기존 세션을 폐기하거나 갱신하는 정책이 필요합니다.  

### 🟦 Session Store의 역할

Store는 최소한 다음 동작을 제공해야 합니다.  

| Store 동작 | 역할 |
| --- | --- |
| `set(sessionId, session, callback)` | 세션 생성 또는 변경 내용 저장 |
| `get(sessionId, callback)` | Session ID로 데이터 조회 |
| `destroy(sessionId, callback)` | 로그아웃하거나 폐기할 세션 삭제 |

기본 메모리 Store는 학습과 로컬 확인에는 사용할 수 있지만 운영 환경에는 적합하지 않습니다.  
운영에서는 보통 Redis 같은 외부 공용 Session Store를 둡니다.  

여러 Fastify 인스턴스가 같은 Redis를 조회하면 요청을 어느 서버가 받아도 동일한 로그인 상태를 확인할 수 있습니다.  

connect-redis는 Express용 Redis session store입니다. Fastify 전용 store는 아닙니다.  
다만, `@fastify/session`은 Express Session용 Store와 호환되므로 `connect-redis`를 `store` 옵션에 연결할 수 있습니다.  

```bash
# Redis Session Store를 설치합니다.
npm install connect-redis

# peer dependency가 자동 설치되지 않는 환경에서는 직접 설치합니다.
npm install redis connect-redis express-session
```

`REDIS_URL`은 `redis://user:password@host:6379/0` 형식으로 주입하고, `SESSION_SECRET`은 32자 이상의 안전한 값을 비밀 관리 도구에서 주입합니다.  

```typescript
export async function registerRedisSession(app: FastifyInstance) {
  const sessionSecret = process.env.SESSION_SECRET;
  const redisUrl = process.env.REDIS_URL;

  // 운영에서는 접속 정보를 환경 변수나 비밀 관리 도구로 주입합니다.
  const redisClient = createClient({
    url: redisUrl,
  });

  // Redis 연결 오류가 프로세스의 미처리 예외로 이어지지 않도록 리스너를 등록합니다.
  redisClient.on('error', (error) => {
    app.log.error(error, 'Redis session client error');
  });

  // Store를 등록하기 전에 Redis 연결을 완료합니다.
  await redisClient.connect();

  const redisStore = new RedisStore({
    client: redisClient,
    // 다른 Redis 데이터와 세션 키를 구분합니다.
    prefix: 'fastify:session:',
    // connect-redis의 ttl은 cookie.expires가 없을 때 사용하는 초 단위 fallback입니다.
    ttl: SESSION_TTL_SECONDS,
  });

  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: sessionSecret,
    cookieName: 'session_id',

    // 기본 Memory Store 대신 Redis Store에 세션을 저장합니다.
    store: redisStore,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',

      // @fastify/session의 cookie.maxAge는 밀리초 단위입니다.
      maxAge: SESSION_TTL_MS,
    },
  });

  // Fastify가 종료될 때 Redis 연결도 함께 정리합니다.
  app.addHook('onClose', async () => {
    if (redisClient.isOpen) {
      await redisClient.close();
    }
  });
}
```

`prefix`는 하나의 Redis를 공유하는 다른 서비스의 키와 세션 키가 섞이지 않게 합니다.  
`connect-redis`는 세션에 `cookie.expires`가 있으면 그 시각을 Redis TTL 계산에 우선 사용하고, 없을 때만 `ttl` 옵션을 사용합니다.  
위 설정에서는 `cookie.maxAge`로 만료 시각이 생성되므로 `ttl` 값은 만료 시각이 없는 세션을 위한 fallback입니다.  
`rolling: true`인 `@fastify/session`은 유효한 요청의 세션을 응답 시점에 다시 저장합니다.  
`connect-redis`는 세션의 쿠키 만료 시각을 기준으로 Redis TTL을 갱신하므로, 배포 후에는 요청이 이어질 때 쿠키와 Redis 키의 만료 시각이 함께 연장되는지 확인합니다.  

## 3. 로그인·보호 API·로그아웃 구현 {#session-03}

세션 인증에서는 JWT를 발급하는 대신 로그인에 성공한 사용자의 식별자를 `request.session`에 넣습니다.  
이후 보호 API는 `request.session.userId`가 있는지 확인합니다.  

### 🟦 로그인 처리

로그인 직전에 Session ID를 다시 만들면 로그인 전부터 알고 있던 Session ID를 로그인 후에도 그대로 사용하는 Session Fixation 공격을 줄일 수 있습니다.  
`regenerate()`는 새로운 Session ID를 만들고 Store에 저장하는 메서드입니다.  

```typescript
// /src/ch08/app.ts
app.post<{ Body: LoginBody }>('/api/login', async (request, reply) => {
  const { email, password } = request.body ?? {};

  // LoginBody는 컴파일 시점의 타입일 뿐이므로 외부 요청 값은 실행 중에도 검사해야 합니다.
  if (typeof email !== 'string' || typeof password !== 'string') {
    return reply.code(400).send({
      code: 'INVALID_REQUEST',
      message: 'email과 password 문자열이 필요합니다.',
    });
  }

  const user = authenticateUser(email, password);

  if (!user || user.status !== 'ACTIVE') {
    return reply.code(401).send({
      code: 'INVALID_CREDENTIALS',
      message: '이메일 또는 비밀번호를 확인해 주세요.',
    });
  }

  // 로그인 전부터 공격자가 알고 있던 Session ID를 인증 후에 재사용하지 않습니다.
  await request.session.regenerate();

  // 응답이 끝날 때 플러그인이 변경된 값을 Store에 저장하고 서명된 Session ID 쿠키를 보냅니다.
  request.session.userId = user.id;
  request.session.role = user.role;

  return { user: toPublicUser(user) };
});
```

브라우저에는 서명된 Session ID 쿠키가 설정되고, 실제 `userId`와 `role`은 Session Store에 저장됩니다.  

다음 `curl` 요청은 로그인하면서 서버가 응답한 Session ID 쿠키를 `cookies.txt`에 저장합니다.  
`-c cookies.txt` 옵션은 응답의 `Set-Cookie` 값을 쿠키 파일에 기록하며, 저장한 쿠키는 이후 보호 API 요청에서 다시 사용합니다.  

```bash
curl -si \
  -c cookies.txt \
  -X POST http://127.0.0.1:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
      "email": "learner@example.com",
      "password": "Fastify12!"
     }'
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: session_id=SIGNED_SESSION_ID; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 03 Sep 2026 04:36:53 GMT

{
  "user": {
    "id": 100,
    "email": "learner@example.com",
    "role": "USER"
  }
}
```

### 🟦 공통 인증 훅과 보호 API

보호 API마다 같은 검사를 반복하지 않도록 `preHandler`에서 사용할 인증 훅을 만듭니다.  

```typescript
// /src/ch08/auth.ts
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * 보호 API 앞에서 로그인 세션의 존재를 검사합니다.
 * 응답을 직접 끝내므로 인증에 실패한 요청은 뒤의 Route Handler까지 진행하지 않습니다.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.userId) {
    // 비동기 Fastify 훅에서 reply를 반환하면 응답을 보낸 뒤 요청 생명주기를 종료할 수 있습니다.
    return reply.code(401).send({
      code: 'UNAUTHORIZED',
      message: '로그인이 필요합니다.',
    });
  }

  return;
}
```

보호할 Route의 `preHandler`에 인증 훅을 연결합니다.  

```typescript
app.get('/api/me', { preHandler: [requireAuth] }, async (request, reply) => {
  // preHandler가 userId의 존재를 먼저 확인하므로 여기서는 non-null 단언 연산자(!)를 사용할 수 있습니다.
  // 세션에는 ID만 저장하고 계정 정지 여부처럼 바뀔 수 있는 정보는 요청할 때마다 사용자 저장소에서 확인합니다.
  const user = findUserById(request.session.userId!);

  if (!user || user.status !== 'ACTIVE') {
    // 삭제되거나 정지된 사용자의 기존 세션도 즉시 무효화합니다.
    await request.session.destroy();

    return reply.code(401).send({
      code: 'UNAUTHORIZED',
      message: '유효한 로그인 세션이 아닙니다.',
    });
  }

  return { user: toPublicUser(user) };
});
```

먼저 로그인 요청에서 저장한 `cookies.txt`를 `-b` 옵션으로 읽어 `/api/me`에 함께 보냅니다.  
`cookies.txt`에 유효한 `session_id`가 있다면 Fastify가 Session Store에서 로그인 상태를 찾을 수 있습니다.  

```bash
curl -si \
  -b cookies.txt \
  http://127.0.0.1:3000/api/me
```

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
set-cookie: session_id=SESSION_ID; Path=/; Expires=Thu, 03 Sep 2026 04:48:16 GMT; HttpOnly; SameSite=Lax

{"user":{"id":100,"email":"learner@example.com","role":"USER"}}
```

`200 OK`와 사용자 정보가 반환되면 Session ID 쿠키 전송, Store 조회와 보호 API 인증이 모두 정상적으로 동작한 것입니다.  
`rolling: true`이므로 응답의 `Set-Cookie`는 세션 쿠키의 만료 시각이 다시 연장됐음을 보여줍니다.  

다음 요청은 `-b cookies.txt` 옵션을 빼고 같은 API를 호출합니다.  
요청에 Session ID 쿠키가 없으므로 `requireAuth` 훅은 로그인하지 않은 요청으로 판단합니다.  

```bash
curl -si http://127.0.0.1:3000/api/me
```

```http
HTTP/1.1 401 Unauthorized
content-type: application/json; charset=utf-8

{"code":"UNAUTHORIZED","message":"로그인이 필요합니다."}
```

`401 Unauthorized`가 반환되면 쿠키가 없는 요청이 Route Handler까지 진행하지 않고 인증 훅에서 차단된 것입니다.  

### 🟦 새 탭과 브라우저 재실행

새 탭은 같은 브라우저 프로필의 쿠키를 공유합니다.  
따라서 새 탭에서 `/api/me` 같은 보호 API를 호출하면 Session ID 쿠키가 자동 전송되고 로그인한 사용자로 처리됩니다.  

```text
새 탭에서 앱 시작
  ↓
GET /api/me
  ↓
브라우저가 session_id 쿠키 자동 전송
  ↓
Fastify가 Session Store 조회
  ├─ 유효함 → 사용자 정보 반환 → 로그인 화면 복원
  └─ 없음·만료 → 401 → 로그인 화면 표시
```

JWT 방식처럼 Access Token이 메모리에 있는지 검사하고 `/refresh`로 토큰을 회전할 필요는 없습니다.  
다만 화면에 이름과 권한을 표시하려면 앱 시작 시 `/api/me`를 호출하여 서버의 로그인 상태를 클라이언트 상태로 가져오는 과정은 필요합니다.  

브라우저를 종료한 뒤에도 로그인 상태를 유지할지는 쿠키 정책에 따라 달라집니다.  
`maxAge`가 설정된 영속 쿠키는 만료 전까지 남을 수 있지만, `maxAge`와 `expires`가 없는 세션 쿠키는 브라우저 정책에 따라 종료할 때 제거될 수 있습니다.  

### 🟦 로그아웃 처리

로그아웃할 때는 Session Store의 레코드와 브라우저 쿠키를 함께 없앱니다.  
다음은 `fastify-basics/src/ch08/app.ts`의 로그아웃 Route를 발췌한 코드입니다.  

```typescript
/** 서버의 세션 데이터와 브라우저의 Session ID 쿠키를 함께 지우는 로그아웃 API입니다. */
app.post('/api/logout', async (request, reply) => {
  // 현재 Session ID의 실제 로그인 상태를 Store에서 먼저 삭제합니다.
  await request.session.destroy();

  // 생성할 때와 같은 이름과 Path로 브라우저의 Session ID 쿠키도 만료시킵니다.
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

  return { success: true as const };
});
```

한 탭에서 로그아웃하면 다른 탭의 화면이 즉시 바뀌지는 않을 수 있습니다.  
그러나 다른 탭이 다음 API를 호출할 때 Session Store에서 레코드를 찾지 못하므로 `401`을 받고 로그인 상태를 정리하게 됩니다.  

## 4. 운영 환경 구성과 JWT 방식 선택 {#session-04}

Server Session은 클라이언트 코드를 단순하게 만들지만 서버가 모든 로그인 상태를 보관해야 합니다.  
여러 대의 Fastify 서버를 운영한다면 각 프로세스의 메모리가 아니라 Redis 같은 공용 Session Store를 사용해야 합니다.  

### 🟦 여러 서버가 Session을 공유하는 구조

```text
Browser
  │ Cookie: session_id=abc123
  ↓
Load Balancer
  ├─ Fastify 1 ─┐
  ├─ Fastify 2 ─┼─ Redis Session Store
  └─ Fastify 3 ─┘     abc123 → userId=100
```

어느 Fastify 인스턴스가 요청을 받아도 같은 Redis에서 세션을 조회하므로 로그인 상태가 유지됩니다.  
Redis 장애가 인증 장애로 이어질 수 있으므로 연결 실패 처리, 모니터링, 만료 정책과 백업 필요성을 서비스 수준에 맞게 정해야 합니다.  

쿠키와 Store의 만료 시각도 함께 관리해야 합니다.  
브라우저 쿠키만 남고 Store 레코드가 먼저 사라지면 다음 요청에서 `401`이 발생하며, Store 레코드만 남으면 사용되지 않는 세션 데이터가 쌓일 수 있습니다.  

### 🟦 동일 Origin과 서로 다른 Origin

다음처럼 화면과 API가 같은 Scheme, Host와 Port를 사용하면 같은 Origin입니다.  

```text
https://example.com/page
https://example.com/api/orders
```

이 구조에서는 Session 쿠키 사용이 가장 단순합니다.  
브라우저가 같은 Origin 요청에 쿠키를 자동으로 보내므로 프런트엔드가 `Authorization` 헤더를 직접 조립할 필요가 없습니다.  

`https://app.example.com`과 `https://api.example.com`은 서로 다른 Origin입니다.  
두 주소가 같은 Site로 판단될 수는 있지만, 브라우저 요청에는 CORS의 `credentials` 허용, 정확한 Origin 허용과 쿠키의 `SameSite`, `Secure`, `Domain` 또는 Host 범위를 함께 설계해야 합니다.  
서브도메인이 다르다는 이유만으로 세션 인증을 사용할 수 없는 것은 아니지만 설정과 배포 구성이 더 복잡해집니다.  

### 🟦 Server Session과 JWT 비교

두 방식 중 하나가 항상 더 좋은 것은 아닙니다.  
서비스에서 사용하는 클라이언트와 서버 운영 구조에 맞춰 선택해야 합니다.  

| 기준 | Server Session + Cookie | Access/Refresh Token |
| --- | --- | --- |
| 로그인 상태 위치 | Redis·DB 등 서버 Store | Access JWT와 Refresh Session으로 분산 |
| 보호 API 인증 | 매 요청마다 Session Store 조회 | Access JWT 서명과 만료 검증 |
| 브라우저 요청 | 쿠키 자동 전송 | Access Token을 헤더에 추가 |
| 로그인 연장 | 세션과 쿠키 만료 연장 | `/refresh`와 토큰 회전 |
| 로그아웃·강제 폐기 | Store 레코드 삭제 즉시 반영 | 이미 발급된 Access JWT는 만료까지 남을 수 있음 |
| 서버 여러 대 운영 | 공용 Session Store 필요 | Access JWT 검증은 각 서버에서 가능 |
| 잘 맞는 환경 | 같은 서비스의 브라우저 웹, MPA | 웹·모바일·외부 API 등 다양한 클라이언트 |

JSP 같은 MPA 또는 같은 서비스의 웹 프런트 하나가 Fastify API를 호출한다면 Server Session 방식이 이해하고 운영하기 쉬운 선택일 수 있습니다.  
반대로 iOS, Android, 외부 파트너와 여러 API 소비자가 같은 인증 규약을 사용해야 한다면 Access Token과 Refresh Token 방식이 더 자연스러울 수 있습니다.  

📌 실무 적용 전에 다음 항목을 확인합니다.  

1. 운영 Session Store로 Redis 또는 DB를 사용합니다.  
2. 로그인 시 Session ID를 재생성하고 로그아웃 시 Store와 쿠키를 함께 삭제합니다.  
3. 운영 쿠키에는 `HttpOnly`, `Secure`와 서비스에 맞는 `SameSite`를 설정합니다.  
4. 세션 쿠키와 Store 레코드의 만료 정책을 일치시킵니다.  
5. XSS 방어와 CSRF 방어를 별도로 적용합니다.  
6. 사용자 정지, 비밀번호 변경과 권한 변경 시 기존 세션을 어떻게 폐기할지 정합니다.  

Server Session의 핵심은 브라우저가 로그인 정보를 직접 보관하는 것이 아니라 Session ID만 보관한다는 점입니다.  
서버가 실제 로그인 상태를 통제하기 때문에 새 탭의 로그인 유지와 즉시 로그아웃 처리가 단순해지는 대신, 안정적인 공용 Session Store 운영이 중요해집니다.  
