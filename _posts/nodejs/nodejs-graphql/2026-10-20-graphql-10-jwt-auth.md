---
layout: post
title: "10. GraphQL JWT 인증과 인가"
description: "GraphQL에서 사용자 등록과 로그인부터 Access Token 인증·인가, Refresh Token 재발급, 로그아웃까지 이어지는 JWT 흐름을 이해합니다. Fastify, Context, Resolver, Service와 Repository가 인증 과정에서 맡는 역할도 살펴봅니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 10
ai_assisted: true
toc:
  - id: session-01
    title: "1. GraphQL JWT 인증과 인가 이해"
  - id: session-02
    title: "2. 사용자 등록과 로그인 흐름"
  - id: session-03
    title: "3. GraphQL 요청 인증·인가와 Access Token 재발급 흐름"
  - id: session-04
    title: "4. GraphQL 로그아웃과 JWT 인증 흐름 검증"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics){: target="_blank" rel="noopener noreferrer" }**  

이번 글에서는 사용자 등록부터 로그아웃까지 이어지는 JWT 인증·인가 과정을 살펴봅니다.  
![Fastify+graphql-yoga 구조](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-6.png)

```text
사용자 등록 → 로그인 → 인증 요청 → Access Token 재발급 → 로그아웃
```

Access Token을 GraphQL 응답으로 전달하고, Refresh Token은 `HttpOnly` Cookie에 저장합니다.  
Fastify는 요청의 Access Token을 검증하고, 확인된 사용자 정보를 GraphQL Context에 담아 Resolver와 Service로 전달합니다.  

## 1. GraphQL JWT 인증과 인가 이해 {#session-01}

### 🟦 인증(Authentication)과 인가(Authorization)의 차이

인증은 요청을 보낸 사용자가 누구인지 확인하는 과정입니다.  
로그인할 때 이메일과 비밀번호를 확인하고, 이후 요청에서는 Access Token을 검증해 사용자 ID를 알아냅니다.  

인가는 인증된 사용자가 요청한 작업을 수행해도 되는지 판단하는 과정입니다.  
로그인한 사용자라도 관리자 전용 사용자 목록을 조회하거나 다른 사용자의 게시글을 마음대로 수정해서는 안 됩니다.  

| 구분 | 확인할 질문 | 실습 코드 |
| --- | --- | --- |
| 인증 | 누구의 요청인가요? | Access Token 검증, `requireAuth()` |
| 역할 기반 인가 | 어떤 역할을 가진 사용자인가요? | `requireRole()` |
| 사용자 리소스 인가 | 본인이거나 관리자인가요? | `requireSelfOrRole()` |
| 게시글 리소스 인가 | 작성자이거나 관리자인가요? | `requireOwnerOrAdmin()` |

인증과 인가는 순서대로 이어집니다.  
먼저 Access Token으로 사용자 신원을 확인하고, 이어서 Resolver와 Service가 역할과 데이터 소유권을 검사합니다.  

### 🟦 JWT의 구조와 검증 원리

JWT(JSON Web Token)는 Header, Payload, Signature를 점(`.`)으로 연결한 문자열입니다.  

```text
xxxxx.yyyyy.zzzzz
  │     │     └─ Signature: 토큰이 변경되지 않았는지 확인합니다.
  │     └─────── Payload: 사용자 ID, 역할과 토큰 용도를 담습니다.
  └───────────── Header: 토큰 종류와 서명 알고리즘을 나타냅니다.
```

Header와 Payload는 Base64 URL 형식으로 인코딩될 뿐 암호화되지 않습니다.  
따라서 비밀번호, 비밀번호 해시와 민감한 개인정보를 Payload에 넣으면 안 됩니다.  

실습의 Payload에는 다음 값을 사용합니다.  

```typescript
// /src/modules/auth/auth.types.ts
export interface AuthTokenPayload {
  sub: string; // 사용자의 고유 ID입니다.
  role: UserRole; // 역할 기반 인가에 사용할 값입니다.
  type: 'access' | 'refresh'; // 토큰의 사용 목적을 구분합니다.
  jti?: string; // Refresh Token 하나를 식별하는 고유 ID입니다.
  exp?: number; // JWT 라이브러리가 기록하는 만료 시각입니다.
}
```

서버는 JWT를 사용할 때 다음 항목을 확인합니다.  

1. 서버의 비밀키로 서명이 올바른지 검증합니다.  
2. `exp`에 기록된 만료 시각이 지나지 않았는지 확인합니다.  
3. `type`이 현재 요청에서 기대하는 `access` 또는 `refresh`인지 검사합니다.  
4. `sub`, `role`과 Refresh Token의 `jti`가 올바른 형식인지 확인합니다.  

서명이 유효하더라도 현재 계정이 정상이라고 단정할 수는 없습니다.  
실습에서는 토큰을 검증한 뒤 사용자를 다시 조회하여 계정이 존재하고 `ACTIVE` 상태인지 확인합니다.  

### 🟦 Access Token과 Refresh Token의 역할

두 토큰은 사용 목적, 수명과 전달 방법이 다릅니다.  

| 구분 | Access Token | Refresh Token |
| --- | --- | --- |
| 용도 | 보호된 Query와 Mutation 호출 | 새 토큰 쌍 발급과 로그아웃 |
| 기본 만료 시간 | 15분 | 7일 |
| 클라이언트 전달 | GraphQL 응답 본문 | `Set-Cookie` 응답 헤더 |
| 요청 전달 | `Authorization: Bearer ...` | 브라우저가 Cookie로 자동 전송 |
| 서버 저장 | 저장하지 않음 | SHA-256 해시와 상태 저장 |
| 서명 비밀키 | Access Token 전용 | Refresh Token 전용 |

Access Token은 보호된 요청마다 사용하므로 유출됐을 때의 영향을 줄이기 위해 수명을 짧게 둡니다.  
Refresh Token은 Access Token을 재발급하는 데 사용하므로 더 오래 유지하는 대신, 서버에서 해시와 폐기 상태를 관리합니다.  

Refresh Token Cookie에 HttpOnly를 적용하면 클라이언트 JavaScript는 그 값을 읽을 수 없습니다.  
다만 브라우저는 도메인과 경로 등 Cookie 전송 조건이 맞는 요청에 Refresh Token을 자동으로 포함합니다.  

### 🟦 GraphQL JWT 인증 시스템의 전체 흐름

인증 흐름은 사용자 등록부터 로그아웃까지 하나의 주기로 이어집니다.  

```text
1. 관리자용 사용자 생성(createUser)
   └─ user.resolver.ts → user.service.ts → password.ts → user.repository.ts
      입력 검증 → 이메일 중복 검사 → 비밀번호 해싱 → 사용자 저장

2. 로그인
   └─ auth.resolver.ts → auth.service.ts → auth.repository.ts
      자격 증명 확인 → Access/Refresh Token 발급
      ├─ GraphQL 응답: Access Token
      └─ HttpOnly Cookie: Refresh Token

3. 인증 요청
   └─ graphql/route.ts → auth.service.ts → context.ts
      Authorization 헤더 → Access Token 검증 → Context.authUser
      └─ auth.authorization.ts / user.resolver.ts / post.service.ts
         Resolver 인증·사용자 권한 검사 → Service 게시글 소유권 검사

4. 토큰 재발급
   └─ auth.resolver.ts → auth.service.ts → auth.repository.ts
      Cookie의 Refresh Token 검증 → 기존 토큰 폐기 → 새 토큰 쌍 발급

5. 로그아웃
   └─ auth.resolver.ts → auth.service.ts → auth.repository.ts
      데이터베이스의 Refresh Token 폐기 → Cookie 삭제 → 클라이언트 인증 상태 초기화
```

## 2. 사용자 등록과 로그인 흐름 {#session-02}

### 🟦 사용자 등록

![사용자 등록](/assets/images/nodejs/nodejs-graphql/image-2026-10-20.png)

사용자 생성 로직은 `/src/modules/user/` 아래의 관리자 전용 `createUser` Mutation과 `UserService.create()`에 들어 있습니다.  
`CreateUserInput`은 이메일, 비밀번호, 표시 이름과 역할을 받습니다. 비밀번호는 GraphQL 입력으로만 전달하고, Service에서 해시한 뒤 저장합니다.  

```graphql
# /src/modules/user/user.schema.ts
input CreateUserInput {
  # role을 생략하면 일반 사용자로 생성됩니다.
  email: String!
  # Service에서 해시한 뒤 저장하며, 평문 비밀번호는 데이터베이스에 저장하지 않습니다.
  password: String!
  displayName: String
  role: UserRole = USER
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}
```

`createUser` Resolver는 먼저 `requireRole(context.authUser, 'ADMIN')`을 실행합니다.  
따라서 이 기능은 관리자만 호출할 수 있으며, 익명 사용자와 일반 사용자의 요청은 거절됩니다.  

```typescript
Mutation: {
  // 사용자 생성·수정·삭제에 필요한 검증과 업무 규칙은 Service에서 처리합니다.
  // 이메일 중복을 확인한 뒤 사용자를 생성하고, 생성된 사용자 정보를 반환합니다.
  createUser: (_parent: unknown, args: { input: CreateUserInput }, context: GraphQLContext) => {
    requireRole(context.authUser, 'ADMIN');
    return context.services.users.create(args.input);
  },
}  
```

사용자 생성 Service의 핵심 흐름은 다음과 같습니다.  

```typescript
// /src/modules/user/user.service.ts
async create(input: CreateUserInput) {
  // 데이터베이스 저장 전에 이메일 중복을 확인합니다.
  if (await this.users.findByEmail(input.email)) {
    throw new BusinessError(
      ErrorCode.EMAIL_ALREADY_EXISTS,
      '이미 사용 중인 이메일입니다.',
      409,
    );
  }

  // 지나치게 짧거나 긴 비밀번호를 거절합니다.
  if (input.password.length < 8 || input.password.length > 128) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      '비밀번호는 8자 이상 128자 이하여야 합니다.',
    );
  }

  // 평문 비밀번호 대신 scrypt로 만든 해시를 저장합니다.
  const passwordHash = await hashPassword(input.password);
  return this.users.create({
    email: input.email,
    displayName: input.displayName ?? undefined,
    role: input.role ?? undefined,
    passwordHash,
  });
}
```

`hashPassword()`는 16바이트의 무작위 Salt를 만들고 Node.js의 `scrypt`로 비밀번호를 해싱합니다.  
Salt가 매번 달라지므로 같은 비밀번호를 사용해도 저장되는 해시값은 달라집니다.  

```typescript
// /src/common/security/password.ts
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}
```

Repository는 Service가 만든 `passwordHash`를 Prisma에 전달합니다.  

```typescript
// /src/modules/user/user.repository.ts
create(input: CreateUserData) {
  return this.prisma.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? null,
      role: input.role ?? 'USER',
    },
  });
}
```

### 🟦 로그인 처리와 JWT 발급·저장

로그인과 토큰 발급을 구현하려면 Cookie와 JWT 플러그인을 설치해야 합니다.  

```bash
npm install @fastify/cookie@11.1.2 @fastify/jwt@10.2.2
```

| 패키지 | 역할 |
| --- | --- |
| `@fastify/cookie` | Refresh Token Cookie를 설정하고 요청에서 읽거나 삭제합니다. |
| `@fastify/jwt` | Access Token과 Refresh Token을 발급하고 검증합니다. |

설치한 플러그인은 이를 사용하는 GraphQL Route보다 먼저 등록합니다.  
Prisma, Cookie와 JWT를 차례로 준비한 뒤 `/api` 하위 Route를 등록합니다.  

```typescript
// /src/app.ts
import cookie from '@fastify/cookie';

// 사용자와 Refresh Token 데이터를 조회·저장할 수 있게 합니다.
app.register(prismaPlugin);

// Refresh Token Cookie를 읽고 설정하거나 삭제할 수 있게 합니다.
app.register(cookie);

// Access Token과 Refresh Token의 발급·검증 기능을 등록합니다.
app.register(jwtPlugin);

// 앞에서 등록한 기능을 사용하는 GraphQL Route는 마지막에 등록합니다.
app.register(routes, { prefix: '/api' });
```

![로그인 처리](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-1.png)

로그인은 이메일과 비밀번호를 확인하고, 계정이 정상일 때만 토큰을 발급합니다.  
GraphQL Schema는 로그인 정보를 `LoginInput` 객체로 받습니다.  

```graphql
# /src/modules/auth/auth.schema.ts
input LoginInput {
  email: String!
  password: String!
}

type AuthPayload {
  accessToken: String!
}

extend type Mutation {
  login(input: LoginInput!): AuthPayload!
}
```

Auth Service는 이메일로 사용자를 조회하고 다음 조건을 함께 검사합니다.  

- 사용자가 존재해야 합니다.  
- 계정 상태가 `ACTIVE`여야 합니다.  
- 입력한 비밀번호가 저장된 해시와 일치해야 합니다.  

존재하지 않는 이메일과 잘못된 비밀번호에는 같은 오류를 반환합니다.  
가입된 이메일을 외부에서 구분하기 어렵게 하기 위해서입니다.  

```typescript
// /src/modules/auth/auth.service.ts
async login(input: LoginInput): Promise<AuthTokens> {
  const user = await this.auth.findUserByEmail(input.email);

  if (
    user == null ||
    user.status !== 'ACTIVE' ||
    !(await verifyPassword(input.password, user.passwordHash))
  ) {
    tokenError(
      ErrorCode.INVALID_CREDENTIALS,
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
  }

  return this.issueTokens(user);
}
```

Access Token과 Refresh Token은 서로 다른 비밀키와 만료 시간을 사용합니다.  
이를 위해 `@fastify/jwt`를 `access`와 `refresh` 두 Namespace로 등록합니다.  

```typescript
// /src/plugins/jwt.plugin.ts
const jwtPlugin: FastifyPluginAsync = async (app) => {
  // 보호된 GraphQL 요청에서 사용할 수명이 짧은 토큰입니다.
  await app.register(fastifyJwt, {
    namespace: 'access',
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
  });

  // Access Token 재발급에 사용할 수명이 긴 토큰입니다.
  await app.register(fastifyJwt, {
    namespace: 'refresh',
    secret: env.JWT_REFRESH_SECRET,
    sign: { expiresIn: env.JWT_REFRESH_TTL_SECONDS },
  });
};
```

토큰을 만들 때 두 Payload에 사용자 ID, 역할과 토큰 종류를 넣습니다.  
Refresh Token에는 개별 토큰을 조회하고 폐기하기 위한 무작위 `jti`도 넣습니다.  

```typescript
// /src/modules/auth/auth.service.ts
private createTokenPair(user: User) {
  const jti = randomUUID();

  const accessToken = this.jwt.access.sign({
    sub: String(user.id),
    role: user.role,
    type: 'access',
  } satisfies AuthTokenPayload);

  const refreshToken = this.jwt.refresh.sign({
    sub: String(user.id),
    role: user.role,
    type: 'refresh',
    jti,
  } satisfies AuthTokenPayload);

  return {
    tokens: { accessToken, refreshToken },
    refreshData: {
      id: jti,
      // Refresh Token 원문 대신 SHA-256 해시를 저장합니다.
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(
        Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1_000,
      ),
    },
  };
}
```

`issueTokens()`는 Refresh Token의 해시와 만료 시각을 저장한 뒤 두 토큰을 Resolver에 반환합니다.  

```typescript
// /src/modules/auth/auth.service.ts
private async issueTokens(user: User): Promise<AuthTokens> {
  const pair = this.createTokenPair(user);
  await this.auth.createRefreshToken(pair.refreshData);
  return pair.tokens;
}
```

Resolver는 Access Token만 GraphQL 응답에 담습니다.  
Refresh Token은 `HttpOnly` Cookie로 설정하므로 GraphQL 응답 본문에 노출되지 않습니다.  

```typescript
// /src/modules/auth/auth.resolver.ts
const refreshCookieOptions = {
  path: '/api/graphql',
  httpOnly: true,
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: env.JWT_REFRESH_TTL_SECONDS,
};

login: async (_parent, args, context: GraphQLContext) => {
  const tokens = await context.services.auth.login(args.input);

  // 브라우저가 이후 GraphQL 요청에 자동으로 보낼 Cookie를 설정합니다.
  context.reply.setCookie(
    env.AUTH_REFRESH_COOKIE_NAME,
    tokens.refreshToken,
    refreshCookieOptions,
  );

  return { accessToken: tokens.accessToken };
},
```

### 🟦 GraphQL 사용자 준비 및 로그인 실습

현재 실습에는 공개 `register` Mutation이 없습니다. 따라서 Seed 관리자로 로그인한 뒤, 관리자 전용 `createUser`로 일반 사용자를 생성합니다.  
먼저 `/prisma/seed.ts`에 정의된 관리자 계정으로 로그인합니다.  

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
  }
}
```

```json
{
  "input": {
    "email": "user1@example.com",
    "password": "Password123!"
  }
}
```

응답으로 받은 관리자 Access Token을 GraphiQL의 Headers 영역에 설정합니다.  

```json
{
  "Authorization": "Bearer ADMIN_ACCESS_TOKEN"
}
```

이제 역할을 생략한 `createUser` Mutation으로 일반 사용자를 생성합니다.  

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    displayName
    role
  }
}
```

```json
{
  "input": {
    "email": "jwt-user@example.com",
    "password": "Password123!",
    "displayName": "JWT 실습 사용자"
  }
}
```

![사용자 등록](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-2.png)

`role`을 생략했으므로 생성된 사용자의 역할은 `USER`입니다. 평문 비밀번호는 응답이나 데이터베이스에 나타나지 않고 `passwordHash`만 저장됩니다.  

이제 Headers에서 관리자 Access Token을 제거하고, 생성한 사용자 계정으로 `login` Mutation을 다시 실행합니다. 응답에는 새 사용자의 Access Token만 나타나며, Refresh Token은 새 `HttpOnly` Cookie로 교체됩니다.  

```json
{
  "input": {
    "email": "jwt-user@example.com",
    "password": "Password123!"
  }
}
```

![Cookie 예시](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-3.png)

브라우저 개발자 도구에서 `refreshToken` Cookie가 저장됐는지 확인합니다.  
Cookie의 `HttpOnly`가 활성화되어 있으면 JavaScript에서 값을 읽을 수 없지만 같은 경로의 요청에는 자동으로 포함됩니다.  

## 3. GraphQL 요청 인증·인가와 Access Token 재발급 흐름 {#session-03}

### 🟦 GraphQL 요청 인증과 권한 검증

![인증과권한검증처리](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-4.png)

GraphQL 요청의 인증과 인가는 다음 순서로 이어집니다.  

```text
Authorization 헤더
  └─ Auth Service: Access Token과 계정 상태 검증
       └─ GraphQL Context: authUser 전달
            ├─ Resolver: 인증·역할·사용자 본인 여부 검사
            └─ Service: 게시글 소유권 검사
```

클라이언트는 보호된 Query와 Mutation을 호출할 때 Access Token을 HTTP `Authorization` 헤더에 넣습니다.  

```http
POST /api/graphql HTTP/1.1
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

Auth Service는 먼저 `Bearer` 형식을 확인합니다.  
그다음 Access Token 전용 비밀키로 서명과 만료 시각을 검증하고 Payload가 `access` 용도인지 검사합니다. 마지막으로 사용자를 조회해 현재 계정 상태를 확인합니다.  

```typescript
// /src/modules/auth/auth.service.ts
async authenticateAuthorization(authorization: string | undefined) {
  // 헤더가 없으면 공개 작업을 실행할 수 있도록 익명 요청으로 처리합니다.
  if (authorization == null) return undefined;

  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  if (match?.[1] == null) {
    tokenError(
      ErrorCode.TOKEN_INVALID,
      'Authorization 헤더가 올바르지 않습니다.',
    );
  }

  let payload: AuthTokenPayload;
  try {
    // Access Token의 서명과 만료 시각을 함께 확인합니다.
    payload = this.jwt.access.verify<AuthTokenPayload>(match[1]);
  } catch {
    tokenError(
      ErrorCode.TOKEN_INVALID,
      'Access Token이 유효하지 않거나 만료되었습니다.',
    );
  }

  const tokenUser = parsePayload(payload, 'access');
  const user = await this.auth.findUserById(tokenUser.id);

  if (user == null || user.status !== 'ACTIVE') {
    tokenError(
      ErrorCode.UNAUTHORIZED,
      '사용할 수 없는 사용자 계정입니다.',
    );
  }

  return { id: user.id, role: user.role } satisfies AuthUser;
}
```

GraphQL Route는 검증을 통과한 사용자만 `authUser`로 Context에 넣습니다.  
헤더가 없는 공개 요청에는 이 속성이 없습니다.  

```typescript
// /src/graphql/route.ts
handler: async (req, reply) => {
  const loaders = createLoaders(app.prisma);

  // 요청마다 Access Token을 확인해 현재 사용자를 만듭니다.
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

  return reply.send(response.body);
},
```

Context에는 JWT 문자열 대신 검증이 끝난 사용자 ID와 역할만 들어갑니다.  
따라서 Resolver가 토큰을 다시 해석할 필요가 없습니다.  

여기까지가 요청을 보낸 사용자를 확인하는 인증 과정입니다.  
이제 Resolver와 Service는 `Context.authUser`를 사용해 요청한 작업과 데이터에 접근할 권한이 있는지 검사합니다.  

`requireAuth()`는 Context에 인증 사용자가 있는지 확인합니다.  
익명 요청이면 `UNAUTHORIZED` 오류를 반환하고, 인증된 요청이면 사용자 정보를 그대로 돌려줍니다.  

```typescript
// /src/modules/auth/auth.authorization.ts
export function requireAuth(
  authUser: AuthUser | undefined,
): AuthUser {
  if (authUser == null) {
    throw new BusinessError(
      ErrorCode.UNAUTHORIZED,
      '로그인이 필요합니다.',
      401,
    );
  }
  return authUser;
}
```

`me`, `myPosts`와 게시글 생성·수정·삭제 Resolver는 `requireAuth()`를 사용합니다.  
게시글 생성 시 작성자 ID를 입력으로 받지 않고 인증 사용자의 ID를 사용하므로 다른 사용자를 작성자로 지정할 수 없습니다.  

```typescript
// /src/modules/post/post.resolver.ts
myPosts: (_parent, _args, context: GraphQLContext) =>
  context.services.posts.listMine(
    requireAuth(context.authUser),
  ),

createPost: (_parent, args, context: GraphQLContext) =>
  context.services.posts.create(
    requireAuth(context.authUser),
    args.input,
  ),
```

관리자 전용 작업은 `requireRole()`로 역할까지 확인합니다.  
`requireRole()`은 내부에서 `requireAuth()`를 먼저 호출하므로 익명 사용자와 권한이 부족한 사용자를 구분할 수 있습니다.  

```typescript
// /src/modules/auth/auth.authorization.ts
export function requireRole(
  authUser: AuthUser | undefined,
  role: UserRole,
): AuthUser {
  const user = requireAuth(authUser);

  if (user.role !== role) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '이 작업을 수행할 권한이 없습니다.',
      403,
    );
  }

  return user;
}
```

사용자 수정과 삭제는 관리자뿐 아니라 대상 사용자 본인에게도 허용합니다.  
`requireSelfOrRole()`은 인증 사용자 ID와 Mutation의 대상 사용자 ID가 같거나, 인증 사용자가 지정된 역할을 가졌을 때만 요청을 통과시킵니다.  

```typescript
// /src/modules/auth/auth.authorization.ts
export function requireSelfOrRole(
  authUser: AuthUser | undefined,
  targetUserId: string | number,
  role: UserRole,
): AuthUser {
  const user = requireAuth(authUser);
  const targetId = Number(targetUserId);

  if (!Number.isInteger(targetId) || targetId < 1) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      'ID는 양의 정수여야 합니다.',
    );
  }

  if (user.id !== targetId && user.role !== role) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '본인 또는 관리자만 수행할 수 있습니다.',
      403,
    );
  }

  return user;
}
```

`updateUser`에서는 본인 여부를 통과한 일반 사용자라도 `role`과 `status`를 바꿀 수 없습니다.  
일반 사용자는 자신의 이메일과 표시 이름만 수정할 수 있으며 역할과 계정 상태는 관리자만 변경할 수 있습니다.  

```typescript
// /src/modules/user/user.resolver.ts
updateUser: (_parent, args, context: GraphQLContext) => {
  const authUser = requireSelfOrRole(
    context.authUser,
    args.id,
    'ADMIN',
  );

  if (
    authUser.role !== 'ADMIN' &&
    inputChangesRoleOrStatus(args.input)
  ) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '역할과 계정 상태는 관리자만 변경할 수 있습니다.',
      403,
    );
  }

  return context.services.users.update(args.id, args.input);
},

deleteUser: (_parent, args, context: GraphQLContext) => {
  requireSelfOrRole(context.authUser, args.id, 'ADMIN');
  return context.services.users.delete(args.id);
},
```

게시글 수정과 삭제에서는 로그인 여부만으로 충분하지 않습니다.  
Post Service의 `requireOwnerOrAdmin()`은 게시글 작성자이거나 `ADMIN`인 경우에만 변경을 허용합니다.  

```typescript
// /src/modules/post/post.service.ts
private async requireOwnerOrAdmin(authUser: AuthUser, id: number) {
  const post = await this.posts.findById(id);

  if (post == null) {
    throw new BusinessError(
      ErrorCode.POST_NOT_FOUND,
      '게시글을 찾을 수 없습니다.',
      404,
    );
  }

  if (post.authorId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new BusinessError(
      ErrorCode.POST_FORBIDDEN,
      '이 게시글을 변경할 권한이 없습니다.',
      403,
    );
  }

  return post;
}
```

Resolver는 작업 단위의 접근 권한을 검사하고, Service는 데이터에 관한 업무 규칙을 적용합니다.  
Repository는 검증된 조건을 바탕으로 데이터를 조회하고 저장합니다.  

### 🟦 Access Token 만료와 재발급

![Access Token 재발급](/assets/images/nodejs/nodejs-graphql/image-2026-10-20-5.png)

Access Token이 만료되면 `@fastify/jwt`의 검증이 실패하고 서버는 `TOKEN_INVALID` 오류를 반환합니다.  
클라이언트는 보호된 요청에서 인증 오류를 받으면 실패한 작업을 곧바로 반복하지 않고 `refreshToken` Mutation을 먼저 호출합니다.  

```graphql
mutation RefreshToken {
  refreshToken {
    accessToken
  }
}
```

이 Mutation에는 Refresh Token 인자가 없습니다.  
브라우저가 `/api/graphql` 요청에 `HttpOnly` Refresh Token Cookie를 자동으로 포함하면 Resolver가 `context.req.cookies`에서 값을 읽습니다.  

```typescript
// /src/modules/auth/auth.resolver.ts
refreshToken: async (_parent, _args, context: GraphQLContext) => {
  const refreshToken =
    context.req.cookies[env.AUTH_REFRESH_COOKIE_NAME] ?? '';

  const tokens = await context.services.auth.refresh(refreshToken);

  // 회전으로 새로 발급한 Refresh Token Cookie를 덮어씁니다.
  setRefreshCookie(context, tokens.refreshToken);
  return { accessToken: tokens.accessToken };
},
```

Auth Service는 다음 순서로 Refresh Token을 검증합니다.  

1. Refresh Token 전용 비밀키로 서명과 만료 시각을 확인합니다.  
2. Payload의 `type`, `sub`, `role`과 `jti`를 검사합니다.  
3. `jti`로 데이터베이스의 Refresh Token 레코드를 찾습니다.  
4. 사용자 ID, 폐기 여부, 만료 시각과 토큰 해시를 확인합니다.  
5. 현재 사용자 계정이 `ACTIVE` 상태인지 확인합니다.  
6. 기존 토큰 폐기와 새 토큰 저장을 하나의 Transaction으로 실행합니다.  

```typescript
// /src/modules/auth/auth.repository.ts
rotateRefreshToken(
  currentId: string,
  replacement: RefreshTokenData,
) {
  return this.prisma.$transaction(async (tx) => {
    // 아직 폐기되지 않은 토큰 하나만 사용 처리합니다.
    const revoked = await tx.refreshToken.updateMany({
      where: { id: currentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) return false;

    // 기존 토큰 폐기와 새 토큰 저장이 함께 성공해야 반영됩니다.
    await tx.refreshToken.create({ data: replacement });
    return true;
  });
}
```

이처럼 재발급할 때 Refresh Token까지 교체하는 방식을 Token Rotation이라고 합니다.  
기존 Refresh Token은 첫 번째 재발급 요청에서 폐기되므로 다시 사용하면 `TOKEN_REVOKED` 오류가 발생합니다.  

재발급이 성공하면 클라이언트는 새 Access Token으로 기존 요청의 헤더를 바꿔 한 번만 다시 실행합니다.  
여러 요청이 동시에 인증 오류를 받았다면 하나의 재발급 작업을 공유하여 같은 Refresh Token으로 여러 번 갱신하지 않도록 해야 합니다.  

Refresh Token 자체가 만료됐거나 유효하지 않으면 `TOKEN_INVALID` 오류가 발생합니다.  
데이터베이스 레코드가 없거나 이미 폐기됐거나 해시가 다르면 `TOKEN_REVOKED` 오류가 발생합니다. 이때는 Access Token과 사용자 상태를 지우고 로그인 화면으로 이동해야 합니다.  

### 🟦 GraphQL 인증·인가 및 토큰 재발급 실습

로그인 응답에서 받은 Access Token을 GraphiQL의 Headers 영역에 넣습니다.  

```json
{
  "Authorization": "Bearer ACCESS_TOKEN"
}
```

현재 사용자를 조회합니다.  

```graphql
query Me {
  me {
    id
    email
    displayName
    role
  }
}
```

인증 사용자가 작성한 게시글만 조회합니다.  

```graphql
query MyPosts {
  myPosts {
    id
    title
    published
    authorId
  }
}
```

`me` 응답의 사용자 ID를 사용해 자신의 표시 이름을 수정합니다.  

```graphql
mutation UpdateMyUser($id: ID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    id
    email
    displayName
    status
    role
  }
}
```

```json
{
  "id": "NEW_USER_ID",
  "input": {
    "displayName": "수정한 JWT 실습 사용자"
  }
}
```

자신의 ID로 이메일이나 표시 이름을 수정하면 요청이 성공합니다. 다른 사용자의 ID를 넣으면 `FORBIDDEN` 오류가 발생합니다. 자신의 ID를 사용하더라도 `role`이나 `status`를 변경하려 하면 관리자 전용 필드 검사에서 요청을 거절합니다.  

사용자 삭제도 같은 본인 또는 관리자 규칙을 사용합니다.  

```graphql
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id)
}
```

자신의 계정을 삭제하면 연결된 Refresh Token과 게시글도 연쇄 삭제됩니다. 계정을 삭제한 뒤에는 인증·재발급 실습을 계속할 수 없으므로 이 검증은 로그아웃까지 모두 확인한 후 마지막에 실행합니다.  

## 4. GraphQL 로그아웃과 JWT 인증 흐름 검증 {#session-04}

### 🟦 로그아웃(`logout`) 처리

로그아웃 Mutation은 Refresh Token을 인자로 받지 않습니다.  
브라우저가 Refresh Token Cookie를 자동으로 보내면 Resolver가 이 값을 Auth Service에 전달합니다.  

```graphql
mutation Logout {
  logout
}
```

```typescript
// /src/modules/auth/auth.resolver.ts
logout: async (_parent, _args, context: GraphQLContext) => {
  const refreshToken =
    context.req.cookies[env.AUTH_REFRESH_COOKIE_NAME] ?? '';

  const loggedOut = await context.services.auth.logout(refreshToken);

  // 설정할 때와 같은 Path로 Cookie를 삭제합니다.
  context.reply.clearCookie(env.AUTH_REFRESH_COOKIE_NAME, {
    path: '/api/graphql',
  });

  return loggedOut;
},
```

Auth Service는 Refresh Token의 서명과 Payload를 검증하고 데이터베이스에 저장된 토큰과 비교합니다.  
Repository는 아직 사용할 수 있는 토큰에만 `revokedAt`을 기록합니다.  

```typescript
// /src/modules/auth/auth.repository.ts
async revokeRefreshToken(id: string) {
  const result = await this.prisma.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count === 1;
}
```

서버의 로그아웃 처리가 성공하면 브라우저의 Refresh Token Cookie도 삭제됩니다.  
클라이언트는 보관 중인 Access Token과 현재 사용자 상태를 지운 뒤 로그인 화면으로 이동해야 합니다.  

### 🟦 JWT 로그아웃의 특성과 보안 고려사항

클라이언트에 전달한 JWT 문자열은 서버가 로그아웃 과정에서 직접 삭제할 수 없습니다.  
실습처럼 Access Token을 서버에 저장하지 않는 구조에서는 로그아웃 후에도 기존 Access Token이 만료될 때까지 유효할 수 있습니다. 기본 수명을 15분으로 짧게 설정해 남은 위험 시간을 제한합니다.  

즉시 모든 Access Token을 무효화해야 한다면 현재 구조 외에 다음과 같은 정책이 필요합니다.  

- 사용자별 토큰 버전을 두고 요청마다 확인합니다.  
- Access Token의 `jti`를 차단 목록에 저장합니다.  
- Access Token 수명을 더 짧게 설정합니다.  

Refresh Token은 서버에서 상태를 관리하므로 로그아웃, 만료와 Token Rotation을 통해 재사용을 막을 수 있습니다.  
데이터베이스에는 원문 대신 SHA-256 해시만 저장하며, 비교할 때는 `timingSafeEqual()`을 사용합니다.  

Cookie를 자동 전송하는 방식은 Refresh Token을 JavaScript에서 숨길 수 있지만 CSRF를 함께 고려해야 합니다.  
실습의 Cookie 옵션은 다음과 같습니다.  

| 옵션 | 실습 설정 | 역할 |
| --- | --- | --- |
| `HttpOnly` | `true` | JavaScript에서 Refresh Token을 읽지 못하게 합니다. |
| `Secure` | 운영 환경에서 `true` | HTTPS 요청에서만 Cookie를 전송합니다. |
| `SameSite` | `Lax` | 일부 교차 사이트 요청의 Cookie 전송을 제한합니다. |
| `Path` | `/api/graphql` | GraphQL 엔드포인트로 Cookie 범위를 제한합니다. |
| `Max-Age` | Refresh Token TTL | Cookie의 유지 시간을 토큰 수명과 맞춥니다. |

운영 환경에서는 HTTPS를 사용해야 합니다. 프런트엔드와 API의 출처가 다르면 CORS 허용 출처와 Credential 설정도 명시해야 합니다.  
서비스의 배포 구조와 요청 방식에 따라 CSRF Token이나 Origin 검증 같은 추가 방어 수단도 검토해야 합니다.  
