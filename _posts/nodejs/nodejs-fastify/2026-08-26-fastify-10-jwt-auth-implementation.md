---
layout: post
title: "[Fastify] 10. JWT 인증과 권한 관리 구현 예시"
description: "앞에서 살펴본 JWT 인증 흐름을 Fastify 프로젝트에 구현합니다. Access JWT 발급과 검증, Refresh Session 회전, 인증·인가 Guard, 로그아웃까지 실제 프로젝트 코드로 완성합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 10
ai_assisted: true
toc:
  - id: session-01
    title: "1. JWT 인증 구현 준비"
  - id: session-02
    title: "2. 로그인과 두 토큰 발급 구현"
  - id: session-03
    title: "3. 보호 API의 인증과 인가 구현"
  - id: session-04
    title: "4. 토큰 재발급과 회전 구현"
  - id: session-05
    title: "5. 로그아웃과 전체 흐름 확인"
---

## 1. JWT 인증 구현 준비 {#session-01}

 `fastify-basics` 프로젝트에서 구현한 인증 api 흐름은 다음과 같습니다.  

1. 로그인할 때 Access JWT와 Refresh Token을 발급합니다.  
2. 보호 API에서는 Access JWT로 사용자를 인증하고 권한을 확인합니다.  
3. Access JWT가 만료되면 Refresh Token으로 두 토큰을 재발급합니다.  
4. 로그아웃할 때 서버의 Refresh Session을 삭제합니다.  

Access Token은 서명된 JWT로 만들고 서버에 저장하지 않습니다.  
Refresh Token은 예측하기 어려운 난수로 만들며, 원문 대신 해시를 DB에 저장합니다.  

### 🟦 인증 패키지와 환경 변수

Cookie, JWT와 요청 횟수 제한 기능을 설치합니다.  

```bash
# Refresh Token 쿠키, Access JWT, Rate Limit 기능을 설치합니다.
npm install @fastify/cookie @fastify/jwt @fastify/rate-limit
```

| 패키지 | 프로젝트에서 사용하는 기능 |
| --- | --- |
| `@fastify/cookie` | `request.cookies`, `setCookie()`, `clearCookie()` |
| `@fastify/jwt` | `fastify.jwt.sign()`, `request.jwtVerify()` |
| `@fastify/rate-limit` | 로그인·재발급 Route의 IP 기준 요청 제한 |

JWT 비밀키와 토큰 유효 시간은 `src/config/env.ts`에서 관리합니다.  

```typescript
// src/config/env.ts - 인증 설정에 필요한 부분입니다.

const nodeEnv = process.env.NODE_ENV?.trim() ?? 'production';

function positiveInteger(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  const parsedValue = Number(value ?? defaultValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name}은 1 이상의 정수여야 합니다.`);
  }
  return parsedValue;
}

export const env = {
  NODE_ENV: nodeEnv,

  // 개발 환경에서만 기본 비밀키를 사용합니다.
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET?.trim() ??
    (nodeEnv === 'production'
      ? ''
      : 'local-development-jwt-secret-change-me'),

  // Access JWT는 기본 15분 동안 사용합니다.
  AUTH_ACCESS_TOKEN_TTL_SECONDS: positiveInteger(
    'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    15 * 60,
  ),

  // Refresh Token과 Session은 기본 7일 동안 유지합니다.
  AUTH_REFRESH_TOKEN_TTL_SECONDS: positiveInteger(
    'AUTH_REFRESH_TOKEN_TTL_SECONDS',
    process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    7 * 24 * 60 * 60,
  ),

  AUTH_REFRESH_COOKIE_NAME:
    process.env.AUTH_REFRESH_COOKIE_NAME?.trim() || 'refreshToken',
};
```

운영 비밀키는 소스 코드에 넣지 않고 배포 환경에서 주입해야 합니다.  
운영 환경에서 비밀키가 없으면 빈 문자열이 들어가며, 인증 플러그인이 서버 시작 단계에서 이를 거부합니다.  

### 🟦 인증 플러그인 등록

먼저 JWT 발급 입력과 검증 결과를 프로젝트의 타입에 맞게 보강합니다.  

```typescript
// src/plugins/authentication.plugin.ts

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // fastify.jwt.sign()에 전달할 사용자 정보입니다.
    payload: AccessTokenPayload;
    // jwtVerify() 성공 후 request.user에서 읽을 정보입니다.
    user: AuthenticatedUser;
  }
}
```

이 선언은 런타임 객체를 만들지 않습니다.  
TypeScript가 JWT 발급 입력과 검증 결과의 타입을 검사하게 합니다.  

```typescript
// src/plugins/authentication.plugin.ts - 플러그인 등록 부분입니다.

const authenticationPlugin: FastifyPluginAsync<AuthenticationPluginOptions>
= async (fastify, options) => {
  const secret = options.secret ?? env.JWT_ACCESS_SECRET;

  // 비어 있거나 짧은 비밀키로 JWT를 발급하지 못하게 합니다.
  if (secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET은 32자 이상으로 설정해야 합니다.');
  }

  // @fastify/cookie는 request.cookies 읽기와 reply.setCookie()/clearCookie()를 추가합니다.
  await fastify.register(cookie);

  // @fastify/jwt는 발급용 fastify.jwt.sign()과 검증용 request.jwtVerify()를 추가합니다.
  await fastify.register(jwt, { secret });

  // global: false이면 모든 요청을 자동으로 제한하지 않고,
  // 라우트에 config.rateLimit 설정이 있는 민감한 엔드포인트에만 제한을 적용합니다.
  await fastify.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      success: false,
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: '요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.',
    }),
  });
};

// fastify-plugin으로 감싸 플러그인에서 추가한 데코레이터가 캡슐화되지 않도록 하고,
// 이후 등록되는 인증·사용자 라우트에서도 사용할 수 있게 합니다.
export default fp<AuthenticationPluginOptions>(authenticationPlugin, {
  // 이름은 Fastify가 플러그인을 식별하고 의존 관계나 중복 등록 문제를 표시할 때 사용합니다.
  name: 'authentication-plugin',
});
```

Prisma와 인증 플러그인은 이를 사용하는 Route보다 먼저 등록합니다.  

```typescript
// src/app.ts

// Repository가 사용할 Prisma Client를 먼저 등록합니다.
app.register(prismaPlugin);

// 이후 Route에서 Cookie, JWT와 Rate Limit을 사용할 수 있게 합니다.
app.register(authenticationPlugin);

// 플러그인 등록이 끝난 뒤 실제 API를 연결합니다.
app.register(routes, { prefix: '/api' });
```

이 순서를 지켜야 Route에서 `fastify.prisma`, `fastify.jwt`, `request.cookies`를 사용할 수 있습니다.  

## 2. 로그인과 두 토큰 발급 구현 {#session-02}

앞 글의 로그인 흐름에서는 이메일과 비밀번호를 검증한 뒤 두 토큰을 발급했습니다.  
이를 구현하려면 Refresh Session 모델, 토큰 생성기, 로그인 Service와 쿠키 응답이 필요합니다.  

### 🟦 Refresh Session 모델

Prisma의 `Session`에는 Refresh Token 해시, 소유자와 만료 시각을 저장합니다.  

```prisma
// prisma/schema.prisma

model Session {
  id        String   @id @default(cuid())

  // Refresh Token 원문 대신 해시만 저장합니다.
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  // 사용자가 삭제되면 연결된 Session도 함께 삭제합니다.
  userId Int  @map("user_id")
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```

`tokenHash`는 Session 조회 키이므로 `@unique`로 지정합니다.  
`userId` 인덱스는 전체 로그아웃처럼 사용자의 Session을 모두 삭제할 때 사용합니다.  

### 🟦 Access JWT 발급

Access JWT에는 보호 API에서 필요한 최소한의 사용자 정보만 담습니다.  

```typescript
// src/modules/auth/auth.types.ts

export interface AccessTokenPayload {
  // JWT 표준 Subject Claim에 사용자 ID를 문자열로 저장합니다.
  sub: string;
  email: string;
  role: UserRole;
  // 다른 종류의 JWT가 Access Token으로 사용되는 것을 막습니다.
  type: 'access';
}

export interface AuthenticatedUser extends AccessTokenPayload {
  // 발급 과정에서 JWT 플러그인이 추가하는 시각입니다.
  iat?: number;
  exp?: number;
}
```

Service가 Fastify 구현에 직접 의존하지 않도록 JWT 발급 기능을 클래스로 감쌉니다.  

```typescript
// src/common/security/access-token-issuer.ts

export class FastifyAccessTokenIssuer implements AccessTokenIssuer {
  constructor(
    private readonly jwt: FastifyInstance['jwt'],
    private readonly expiresIn: number,
  ) {}

  // payload에 만료 시각을 추가하고 서버 비밀키로 서명합니다.
  issue(payload: AccessTokenPayload): Promise<string> {
    return Promise.resolve(
      this.jwt.sign(payload, { expiresIn: this.expiresIn }),
    );
  }
}
```

### 🟦 Refresh Token 생성과 해시

Refresh Token은 48바이트 난수를 `base64url` 문자열로 바꿔 만듭니다.  
브라우저에는 원문을 보내지만 DB에는 SHA-256 해시만 저장합니다.  

```typescript
// src/common/security/refresh-token-manager.ts

export class Sha256RefreshTokenManager
  implements RefreshTokenManager
{
  // URL과 쿠키에 안전한 예측하기 어려운 원문을 만듭니다.
  generate(): string {
    return randomBytes(48).toString('base64url');
  }

  // DB 저장과 Session 조회에 사용할 고정 길이 해시입니다.
  hash(token: string): string {
    return createHash('sha256')
      .update(token, 'utf8')
      .digest('base64url');
  }
}
```

Refresh Token은 충분히 긴 난수입니다.  
따라서 비밀번호에는 느린 `scrypt`를 사용하고, Session 조회 키에는 빠른 SHA-256을 사용합니다.  

### 🟦 로그인 Service와 쿠키 응답

로그인 Service는 이메일, 비밀번호와 계정 상태를 차례로 확인합니다.  

```typescript
// src/modules/auth/auth.service.ts

async login(
  emailInput: string,
  password: string,
): Promise<AuthTokenResult> {
  const email = emailInput.trim().toLowerCase();
  const user = await this.authRepository.findUserByEmail(email);

  // 사용자 없음과 비밀번호 불일치에 같은 오류를 반환합니다.
  if (
    user === null ||
    !(await this.passwordHasher.verify(password, user.passwordHash))
  ) {
    throw new BusinessError(
      ErrorCode.INVALID_CREDENTIALS,
      '이메일 또는 비밀번호가 올바르지 않습니다.',
      401,
    );
  }

  // 정지 또는 탈퇴 사용자는 토큰을 발급받을 수 없습니다.
  this.assertActiveUser(user);
  return this.createLoginSession(user);
}
```

사용자 없음과 비밀번호 불일치에 같은 메시지를 사용하면 이메일 가입 여부의 노출을 줄일 수 있습니다.  

```typescript
// src/modules/auth/auth.service.ts - Session 저장과 토큰 발급입니다.

private async createLoginSession(
  user: AuthUserResult,
): Promise<AuthTokenResult> {
  const refreshToken = this.refreshTokenManager.generate();
  const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

  // 원문은 쿠키로 보내고 해시만 DB에 저장합니다.
  await this.authRepository.createSession({
    userId: user.id,
    tokenHash: this.refreshTokenManager.hash(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return this.createTokenResult(
    user,
    refreshToken,
    refreshTokenExpiresAt,
  );
}

private async createTokenResult(
  user: AuthUserResult,
  refreshToken: string,
  refreshTokenExpiresAt: Date,
): Promise<AuthTokenResult> {
  const accessToken = await this.accessTokenIssuer.issue({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    type: 'access',
  });

  return {
    accessToken,
    accessTokenExpiresIn: this.options.accessTokenExpiresIn,
    refreshToken,
    refreshTokenExpiresAt,
    user: { id: user.id, email: user.email, role: user.role },
  };
}
```

Controller는 Access Token만 JSON 본문에 넣고 Refresh Token은 `HttpOnly` 쿠키로 전달합니다.  

```typescript
// src/modules/auth/auth.controller.ts

private setRefreshCookie(
  reply: FastifyReply,
  result: AuthTokenResult,
): void {
  // DB Session의 남은 시간을 쿠키 유효 시간으로 변환합니다.
  const maxAge = Math.max(
    1,
    Math.floor(
      (result.refreshTokenExpiresAt.getTime() - Date.now()) / 1_000,
    ),
  );

  reply.setCookie(
    this.options.refreshCookieName,
    result.refreshToken,
    {
      httpOnly: true,
      secure: this.options.secureCookie,
      sameSite: 'strict',
      // Refresh Token이 인증 API에만 전송되도록 제한합니다.
      path: '/api/auth',
      maxAge,
    },
  );
}
```

내부 `AuthTokenResult`에는 쿠키 설정을 위한 Refresh Token이 들어 있습니다.  
공개 응답을 만드는 `toAuthTokenResponse()`는 이 값을 제외하므로 JSON에는 노출되지 않습니다.  

## 3. 보호 API의 인증과 인가 구현 {#session-03}

로그인으로 받은 Access JWT는 보호 API의 `Authorization` 헤더에 사용합니다.  
서버는 Route 핸들러보다 먼저 인증과 인가 Guard를 실행합니다.  

### 🟦 Access JWT 인증 Guard

`authenticate`는 JWT의 서명과 만료 시각을 검증합니다.  

```typescript
// src/common/security/auth.guard.ts

export async function authenticate(
  request: FastifyRequest,
): Promise<void> {
  try {
    // 검증된 payload는 request.user에 저장됩니다.
    await request.jwtVerify();
  } catch (error) {
    const code = readErrorCode(error);

    if (code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      throw new BusinessError(
        ErrorCode.TOKEN_EXPIRED,
        'Access Token이 만료되었습니다.',
        401,
      );
    }

    if (code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      throw new BusinessError(
        ErrorCode.UNAUTHORIZED,
        '인증이 필요합니다.',
        401,
      );
    }

    throw new BusinessError(
      ErrorCode.TOKEN_INVALID,
      '유효하지 않은 Access Token입니다.',
      401,
    );
  }

  // 서명이 유효해도 Access 용도로 발급한 JWT인지 확인합니다.
  if (request.user.type !== 'access') {
    throw new BusinessError(
      ErrorCode.TOKEN_INVALID,
      '유효하지 않은 토큰 종류입니다.',
      401,
    );
  }
}
```

토큰이 없거나 유효하지 않으면 `401`을 반환합니다.  
서명이 유효하더라도 `type`이 `access`가 아니면 보호 API에 사용할 수 없습니다.  

### 🟦 역할과 소유권 인가 Guard

인증을 마친 뒤에는 요청한 작업을 수행할 권한이 있는지 확인합니다.  

```typescript
// src/common/security/auth.guard.ts

export function requireAdmin(request: FastifyRequest): void {
  if (request.user.role !== UserRole.ADMIN) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '관리자 권한이 필요합니다.',
      403,
    );
  }
}

export function requireSelf(request: FastifyRequest): void {
  if (request.user.sub !== String(readUserIdParam(request.params))) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '본인의 사용자 정보만 변경할 수 있습니다.',
      403,
    );
  }
}

export function requireSelfOrAdmin(request: FastifyRequest): void {
  // 관리자는 URL의 사용자 ID를 비교하지 않고 통과합니다.
  if (
    request.user.role !== UserRole.ADMIN &&
    request.user.sub !== String(readUserIdParam(request.params))
  ) {
    throw new BusinessError(
      ErrorCode.FORBIDDEN,
      '접근 권한이 없습니다.',
      403,
    );
  }
}
```

인증 실패는 `401 Unauthorized`, 인증 후 권한 부족은 `403 Forbidden`으로 구분합니다.  

### 🟦 사용자 Route에 Guard 적용

`preHandler` 배열은 왼쪽부터 실행되므로 항상 `authenticate`를 먼저 둡니다.  

| API | `preHandler` | 허용 대상 |
| --- | --- | --- |
| `POST /api/users` | 없음 | 회원가입 전 사용자 |
| `GET /api/users/:id` | `authenticate`, `requireSelfOrAdmin` | 본인 또는 관리자 |
| `PATCH /api/users/:id/password` | `authenticate`, `requireSelf` | 본인 |
| `PATCH /api/users/:id/status` | `authenticate`, `requireAdmin` | 관리자 |
| `DELETE /api/users/:id` | `authenticate`, `requireSelf` | 본인 |

```typescript
// src/modules/user/user.routes.ts

fastify.get(
  '/:id',
  {
    schema: GetUserRouteSchema,
    // 인증한 뒤 본인 또는 관리자인지 확인합니다.
    preHandler: [authenticate, requireSelfOrAdmin],
  },
  (request, reply) =>
    userController.getById(request.params, reply),
);

fastify.patch(
  '/:id/password',
  {
    schema: UpdateUserPasswordRouteSchema,
    // 비밀번호는 본인만 변경할 수 있습니다.
    preHandler: [authenticate, requireSelf],
  },
  (request, reply) =>
    userController.updatePassword(request.params, request.body, reply),
);

fastify.patch(
  '/:id/status',
  {
    schema: UpdateUserStatusRouteSchema,
    // 계정 상태는 관리자만 변경할 수 있습니다.
    preHandler: [authenticate, requireAdmin],
  },
  (request, reply) =>
    userController.updateStatus(request.params, request.body, reply),
);
```

보호 API를 호출할 때마다 DB의 Refresh Session을 조회하지는 않습니다.  
짧은 수명의 Access JWT는 서명과 Claim으로 검증하고, 폐기할 필요가 있는 로그인 상태는 Refresh Session으로 관리합니다.  

## 4. 토큰 재발급과 회전 구현 {#session-04}

Access JWT가 만료되면 `/api/auth/refresh`를 호출합니다.  
브라우저가 보낸 Refresh Token 쿠키를 검증하고 두 토큰을 모두 새로 발급합니다.  

### 🟦 Session 조회와 조건부 회전

Repository는 Refresh Token 해시로 Session과 현재 사용자 상태를 함께 조회합니다.  

```typescript
// src/modules/auth/auth.repository.ts

findSessionByTokenHash(tokenHash: string) {
  return this.prisma.session.findUnique({
    where: { tokenHash },
    // Session과 현재 사용자 상태를 함께 확인합니다.
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      expiresAt: true,
      user: { select: authUserSelect },
    },
  });
}

async rotateSession(
  sessionId: string,
  currentTokenHash: string,
  newTokenHash: string,
  expiresAt: Date,
): Promise<boolean> {
  const result = await this.prisma.session.updateMany({
    // id와 현재 해시가 모두 일치할 때만 회전합니다.
    where: { id: sessionId, tokenHash: currentTokenHash },
    data: { tokenHash: newTokenHash, expiresAt },
  });

  return result.count === 1;
}
```

`findUnique()` 뒤에 조건 없는 `update()`를 사용하면 같은 토큰으로 들어온 두 요청이 모두 성공할 수 있습니다.  
기존 해시까지 조건에 넣으면 먼저 회전한 한 요청만 성공합니다.  

### 🟦 Refresh Token 검증과 재발급

Service는 Session 존재 여부, 만료 시각과 현재 사용자 상태를 확인합니다.  

```typescript
// src/modules/auth/auth.service.ts

async refresh(refreshToken: string): Promise<AuthTokenResult> {
  const currentTokenHash =
    this.refreshTokenManager.hash(refreshToken);
  const session =
    await this.authRepository.findSessionByTokenHash(currentTokenHash);

  if (session === null) {
    throw new BusinessError(
      ErrorCode.TOKEN_REVOKED,
      '폐기된 인증 토큰입니다.',
      401,
    );
  }

  if (session.expiresAt.getTime() <= this.now().getTime()) {
    // 만료된 Session은 다시 사용할 수 없도록 삭제합니다.
    await this.authRepository.deleteSessionByTokenHash(
      currentTokenHash,
    );
    throw new BusinessError(
      ErrorCode.TOKEN_EXPIRED,
      '인증 토큰이 만료되었습니다.',
      401,
    );
  }

  try {
    this.assertActiveUser(session.user);
  } catch (error) {
    // 정지·탈퇴 사용자의 모든 Refresh Session을 폐기합니다.
    await this.authRepository.deleteSessionsByUserId(session.userId);
    throw error;
  }

  const nextRefreshToken = this.refreshTokenManager.generate();
  const nextTokenHash =
    this.refreshTokenManager.hash(nextRefreshToken);
  const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

  const rotated = await this.authRepository.rotateSession(
    session.id,
    currentTokenHash,
    nextTokenHash,
    refreshTokenExpiresAt,
  );

  if (!rotated) {
    throw new BusinessError(
      ErrorCode.TOKEN_REVOKED,
      '이미 사용된 인증 토큰입니다.',
      401,
    );
  }

  return this.createTokenResult(
    session.user,
    nextRefreshToken,
    refreshTokenExpiresAt,
  );
}
```

성공하면 이전 Refresh Token은 즉시 사용할 수 없습니다.  
새 Access JWT는 응답 본문으로, 새 Refresh Token은 같은 이름의 쿠키로 전달됩니다.  

로그인과 재발급 Route에는 IP 기준 Rate Limit도 적용합니다.  

```typescript
// src/modules/auth/auth.routes.ts

fastify.post(
  '/login',
  {
    schema: LoginRouteSchema,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  },
  (request, reply) => authController.login(request.body, reply),
);

fastify.post(
  '/refresh',
  {
    schema: RefreshRouteSchema,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  },
  (request, reply) => authController.refresh(request, reply),
);
```

## 5. 로그아웃과 전체 흐름 확인 {#session-05}

로그아웃은 Access JWT 자체를 삭제하는 작업이 아닙니다.  
서버의 Refresh Session을 삭제하여 새 Access JWT를 발급받지 못하게 합니다.  

### 🟦 현재 기기와 모든 기기 로그아웃

```typescript
// src/modules/auth/auth.service.ts

async logout(refreshToken: string | undefined): Promise<void> {
  // 쿠키가 이미 없어도 최종 상태가 같으므로 성공으로 종료합니다.
  if (refreshToken === undefined || refreshToken.length === 0) {
    return;
  }

  const tokenHash = this.refreshTokenManager.hash(refreshToken);
  await this.authRepository.deleteSessionByTokenHash(tokenHash);
}

async logoutAll(userId: number): Promise<void> {
  // 인증된 사용자의 모든 Refresh Session을 삭제합니다.
  await this.authRepository.deleteSessionsByUserId(userId);
}
```

전체 로그아웃은 사용자를 식별해야 하므로 유효한 Access JWT가 필요합니다.  

```typescript
// src/modules/auth/auth.routes.ts

fastify.post(
  '/logout-all',
  {
    schema: LogoutAllRouteSchema,
    // 검증된 JWT의 sub로 사용자 ID를 결정합니다.
    preHandler: [authenticate],
  },
  (request, reply) => authController.logoutAll(request, reply),
);
```

Controller는 로그아웃 뒤 설정할 때와 같은 옵션으로 쿠키를 지웁니다.  

```typescript
// src/modules/auth/auth.controller.ts

private clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(this.options.refreshCookieName, {
    httpOnly: true,
    secure: this.options.secureCookie,
    sameSite: 'strict',
    path: '/api/auth',
  });
}
```

이미 발급된 Access JWT는 로그아웃 직후에도 자체 만료 시각까지 유효할 수 있습니다.  
Access JWT의 수명을 짧게 두고 Refresh Session을 삭제하는 이유가 여기에 있습니다.  
비밀번호 변경, 계정 정지와 회원 탈퇴에서도 기존 Refresh Session을 모두 삭제합니다.  

### 🟦 로그인과 보호 API 확인

사용자를 등록하고 로그인합니다.  
`curl`의 `-c` 옵션은 응답의 Refresh Token 쿠키를 파일에 저장합니다.  

```bash
# 로그인에 사용할 사용자를 등록합니다.
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "Password1!",
    "displayName": "Fastify 사용자"
  }'

# 로그인하고 Refresh Token 쿠키를 저장합니다.
curl -i -c cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "Password1!"
  }'
```

응답 본문에는 Access Token과 공개 가능한 사용자 정보만 들어 있습니다.  

```json
{
  "accessToken": "ACCESS_TOKEN",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "USER"
  }
}
```

Access Token을 보호 API의 `Authorization` 헤더에 넣습니다.  

```bash
# authenticate와 requireSelfOrAdmin을 차례로 통과합니다.
curl -i http://localhost:3000/api/users/1 \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

Access Token이 없으면 `401 UNAUTHORIZED`가 반환됩니다.  
일반 사용자 토큰으로 다른 사용자를 조회하면 인가에 실패하여 `403 FORBIDDEN`이 반환됩니다.  

### 🟦 재발급과 로그아웃 확인

`-b`는 쿠키를 전송하고 `-c`는 회전된 쿠키를 다시 저장합니다.  
이전 Refresh Token의 재사용도 확인할 수 있도록 재발급 전 쿠키 파일을 복사해 둡니다.  

```bash
# 재발급 전 Refresh Token을 별도 파일에 보관합니다.
cp cookies.txt cookies-before-refresh.txt

# 기존 Refresh Token을 보내고 새 쿠키를 저장합니다.
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:3000/api/auth/refresh

# 재발급 전 Refresh Token은 폐기되었으므로 401 TOKEN_REVOKED가 반환됩니다.
curl -i -b cookies-before-refresh.txt \
  -X POST http://localhost:3000/api/auth/refresh
```

재발급 전 Refresh Token을 다시 보내면 다음과 같이 `401 TOKEN_REVOKED`가 반환되어야 정상입니다.  

```json
{
  "success": false,
  "code": "TOKEN_REVOKED",
  "message": "폐기된 인증 토큰입니다."
}
```

다만 토큰을 재발급한 뒤에도 기존 Access JWT로 보호 API를 호출하면 만료 전까지 `200 OK`가 반환됩니다.  
재발급은 기존 Access JWT를 폐기하는 작업이 아니라, 기존 Refresh Token을 폐기하고 새로운 Refresh Token과 Access JWT를 발급하는 작업이기 때문입니다.  

Access JWT는 서버에 저장하지 않고 서명과 `exp`를 검증하는 방식이므로, 현재 설정에서는 발급 후 900초 동안 유효합니다.  
따라서 재발급 직후에는 기존 Access JWT와 새 Access JWT를 모두 사용할 수 있습니다.  
Access JWT의 유효 시간을 짧게 두고 Refresh Token만 회전하는 현재 방식은 일반적인 설계입니다.  

기존 Access JWT도 재발급 즉시 무효화해야 한다면 JWT denylist, 사용자별 `tokenVersion`, 또는 요청마다 Session을 조회하는 구조가 추가로 필요합니다.  
이 방법들은 즉시 무효화를 지원하는 대신 서버 상태와 조회 비용을 늘리므로, 서비스의 보안 요구사항에 맞게 선택합니다.  
