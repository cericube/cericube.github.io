---
layout: post
title: "[Fastify] 09. JWT 인증 흐름과 Access Token / Refresh Token 이해하기"
description: "Fastify의 로그인, 보호 API, 토큰 재발급과 로그아웃 호출을 따라가며 Access Token과 Refresh Token의 역할을 알아봅니다. 각 요청에서 토큰이 어떻게 전달·검증·저장·폐기되는지 실제 HTTP 흐름으로 이해합니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 9
ai_assisted: true
toc:
  - id: session-01
    title: "1. JWT 인증에 사용하는 두 토큰 이해"
  - id: session-02
    title: "2. 로그인 API에서 두 토큰 발급"
  - id: session-03
    title: "3. 보호 API에서 Access Token 사용"
  - id: session-04
    title: "4. 재발급 API에서 두 토큰 교체"
  - id: session-05
    title: "5. 로그아웃 API에서 Refresh Session 폐기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. JWT 인증에 사용하는 두 토큰 이해 {#session-01}

다양한 클라이언트가 공통 API를 사용할 때 활용할 수 있는 JWT 인증과 인가 흐름을 알아봅니다.  

로그인에 성공한 사용자가 보호된 API를 호출할 때마다 이메일과 비밀번호를 다시 보낼 수는 없습니다.  
서버는 로그인에 성공했다는 사실을 증명하는 토큰을 발급하고, 클라이언트는 이후 요청에 이 토큰을 사용합니다.  

### 🟦 식별, 인증과 인가의 차이

보안 개념을 나누면 보통 다음과 같이 구분합니다.  

- **식별(Identification)**: "나는 누구다"라고 신원을 제시하는 단계
  - 예: 이메일, 아이디, 사번 입력

- **인증(Authentication)**: 제시한 신원이 실제로 맞는지 검증하는 단계
  - 예: 비밀번호, OTP, 인증서, 생체정보 검증

- **인가(Authorization)**: 인증된 주체가 무엇을 할 수 있는지 판단하는 단계
  - 예: 관리자 API에 접근할 수 있는지 확인

이 글의 로그인 요청에서는 이메일 입력이 식별에 해당하고, 비밀번호 검증이 인증에 해당합니다.  
보호된 API에서는 Access Token의 `sub`로 사용자를 식별하고, 토큰의 서명·만료 시각·종류를 검사하여 요청을 인증합니다.  
인증을 마치면 `sub`와 `role`을 바탕으로 본인 정보나 관리자 API에 접근할 권한이 있는지 확인합니다.  

인증에 실패하면 서버는 일반적으로 `401 Unauthorized`를 반환합니다.  
인증에는 성공했지만 권한이 부족하면 `403 Forbidden`을 반환합니다.  

### 🟦 JWT의 구조와 서명 검증

예제 프로젝트의 Access Token은 JWT 형식을 사용합니다.  
JWT(JSON Web Token)는 사용자 인증 정보를 JSON 형태로 담아 전달하는 토큰 형식입니다.  
JWT는 마침표로 구분된 `Header.Payload.Signature` 구조입니다.  

| 구성 | 담는 내용 |
| --- | --- |
| Header | 토큰 종류와 서명 알고리즘 정보 |
| Payload | 사용자 ID, 이메일, 역할, 토큰 종류와 만료 시각 |
| Signature | Header와 Payload의 위조·변조를 확인하는 서명 |

![JWT Access Token의 구조와 발급 및 검증 흐름](/assets/images/nodejs/nodejs-fastify/jwt-access-token-concept-flow.svg)

서버는 JWT를 발급할 때 인코딩된 Header와 Payload에 서버만 알고 있는 비밀키를 사용하여 Signature를 만듭니다.  
나중에 JWT를 받으면 같은 입력과 비밀키로 Signature를 다시 계산하고 JWT 안의 Signature와 비교합니다.  
두 값이 같으면 비밀키를 모르는 누군가가 JWT 내용을 중간에 바꾸지 않았다고 판단할 수 있습니다.  

JWT의 Header와 Payload는 암호화된 값이 아니라 Base64URL로 인코딩된 값입니다.  
토큰을 가진 사람은 Payload의 내용을 읽을 수 있으므로 비밀번호나 비밀번호 해시처럼 노출되어서는 안 되는 값을 넣으면 안 됩니다.  

예제 Access Token의 payload에는 다음 정보만 담습니다.  

```json
{
  "sub": "123",
  "email": "user@example.com",
  "role": "USER",
  "type": "access",
  "iat": 1787673600,
  "exp": 1787674500
}
```

`sub`는 Subject의 약자이며, 토큰의 주체가 누구인지 나타내는 식별자입니다.  
이 예제에서는 사용자 ID인 `"123"`을 넣어 토큰이 어느 사용자를 대상으로 발급되었는지 구분합니다.  
`sub`는 `iat`, `exp`와 함께 JWT 표준입니다.  

`iat`와 `exp`는 JWT 플러그인이 발급 시각과 만료 시각으로 추가합니다.  
`email`, `role`, `type`처럼 애플리케이션이 목적에 맞게 추가한 Claim의 이름과 처리 규칙은 토큰을 발급하고 사용하는 쪽에서 함께 정해야 합니다.  

### 🟦 Fastify 인증 구성 요소

예제 프로젝트는 Cookie·JWT·Rate Limit 플러그인을 함께 사용합니다.  

| 구성 요소 | 역할 |
| --- | --- |
| `@fastify/jwt` | Access Token을 서명하고 요청에서 검증합니다. |
| `@fastify/cookie` | Refresh Token 쿠키를 읽고 설정하거나 삭제합니다. |
| `@fastify/rate-limit` | 로그인과 토큰 재발급의 과도한 반복 요청을 제한합니다. |

JWT 플러그인은 `fastify.jwt.sign()`과 `request.jwtVerify()`를 제공합니다.  
`@fastify/cookie` 플러그인은 `request.cookies`, `reply.setCookie()`와 `reply.clearCookie()`를 사용할 수 있게 합니다.  
Route에서 이 기능을 사용하려면 인증 플러그인을 API Route보다 먼저 등록해야 합니다.  

### 🟦 서버에서 관리할 인증 설정

토큰 비밀키와 만료 시간은 코드에 직접 작성하지 않고 환경 변수나 비밀 저장소에서 주입합니다.  
예제 프로젝트의 기본 설정은 다음과 같습니다.  

| 설정 | 기본값 | 의미 |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | 개발 환경 전용 문자열 | Access JWT의 서명과 검증에 사용하는 비밀키 |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | 15분 | Access Token을 사용할 수 있는 시간 |
| `AUTH_REFRESH_TOKEN_TTL_SECONDS` | 7일 | Refresh Token과 DB의 Session 레코드 유지 시간 |
| `AUTH_REFRESH_COOKIE_NAME` | `refreshToken` | 브라우저와 서버가 사용할 쿠키 이름 |

운영 환경의 비밀키는 소스 저장소에 포함하면 안 됩니다.  
비밀키가 유출되면 공격자가 서버가 발급한 것처럼 보이는 JWT를 만들 수 있기 때문입니다.  

### 🟦 Access Token과 Refresh Token의 역할

Access Token은 보호된 API에 들어갈 때 제시하는 수명이 짧은 출입증과 같습니다.  
Refresh Token은 만료된 출입증을 새로 발급받을 때 사용하는 재발급 수단과 같습니다.  
Refresh Token 자체로 사용자 조회나 상태 변경 같은 일반 API를 호출하지는 않습니다.  

| 구분 | Access Token | Refresh Token |
| --- | --- | --- |
| 형식 | 서명된 JWT | 48바이트 난수 기반 문자열 |
| 기본 유효 시간 | 15분 | 7일 |
| 로그인 응답 | 응답 본문(JSON) | `Set-Cookie` 응답 헤더 |
| 이후 요청 | `Authorization` 요청 헤더 | `/api/auth` 요청의 쿠키 |
| 서버 저장 | 저장하지 않음 | SHA-256 해시를 DB의 `sessions` 테이블에 저장 |
| 주된 용도 | 보호 API 인증·인가 | 새 Access Token 발급과 현재 Session 식별 |

Access Token은 브라우저가 자동으로 `Authorization` 헤더에 넣어 주지 않습니다.  
클라이언트 애플리케이션이 로그인 또는 재발급 응답에서 받은 값을 보관하고 필요한 요청마다 직접 헤더에 추가해야 합니다.  

Refresh Token은 `Path=/api/auth`로 설정한 쿠키입니다.  
브라우저는 `/api/auth` 아래의 경로로 요청할 때 쿠키를 자동으로 전송하지만, `/api/users/123`과 같은 보호 API에는 전송하지 않습니다.  

### 🟦 API별 토큰 전달과 서버 처리

토큰이 요청에 포함되는지와 서버가 실제 인증 근거로 사용하는지는 구분해서 봐야 합니다.  

| API | Access Token | Refresh Token | 서버의 핵심 처리 |
| --- | --- | --- | --- |
| 로그인 `/api/auth/login` | 사용하지 않음 | 기존 쿠키가 있으면 전송될 수 있지만 사용하지 않음 | 이메일·비밀번호 검증 후 두 토큰 발급 |
| 보호 API `/api/users/123` | 헤더로 전송하고 인증·인가에 사용 | 쿠키 경로가 달라 전송되지 않음(/users ≠ /auth) | JWT 검증 후 요청 처리 |
| 재발급 `/api/auth/refresh` | 사용하지 않음 | 쿠키로 자동 전송하고 검증에 사용 | Refresh Token 회전 후 두 토큰 재발급 |
| 현재 기기 로그아웃 `/api/auth/logout` | 사용하지 않음 | 쿠키가 있으면 자동 전송하고 Session 식별에 사용 | 현재 Session 삭제와 쿠키 제거 |
| 전체 로그아웃 `/api/auth/logout-all` | 헤더로 전송하고 사용자 식별에 사용 | 자동 전송될 수 있지만 사용자 식별에는 사용하지 않음 | 사용자의 모든 Session 삭제와 현재 쿠키 제거 |

이제 로그인부터 로그아웃까지 실제 API 호출 순서에 따라 각 토큰이 어떻게 움직이는지 살펴보겠습니다.  

## 2. 로그인 API에서 두 토큰 발급 {#session-02}

로그인 API는 아직 토큰이 없는 사용자가 이메일과 비밀번호로 자신을 증명하는 시작점입니다.  
인증에 성공하면 서버는 이후 요청에서 사용할 Access Token과 Refresh Token을 함께 발급합니다.  

### 🟦 로그인 요청

클라이언트는 토큰 대신 이메일과 비밀번호를 보냅니다.  

```http
POST /api/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password1!"
}
```

이미 Refresh Token 쿠키가 남아 있다면 브라우저가 로그인 요청에도 쿠키를 자동으로 포함할 수 있습니다.  
하지만 로그인 처리는 이 쿠키를 인증 근거로 사용하지 않고 이메일과 비밀번호를 확인합니다.  

### 🟦 서버의 토큰 발급과 Session 저장

로그인 요청이 들어오면 서버는 다음 순서로 두 토큰을 만듭니다.  

1. 이메일을 정규화하고 DB에서 사용자를 조회합니다.  
2. 입력한 비밀번호가 저장된 비밀번호 해시와 일치하는지 검증합니다.  
3. 사용자가 `ACTIVE` 상태이고 탈퇴하지 않았는지 확인합니다.  
4. `sub`, `email`, `role`, `type`을 담은 Access JWT를 15분 유효 시간으로 서명합니다.  
5. 암호학적으로 안전한 48바이트 난수로 Refresh Token 원문을 만듭니다.  
6. Refresh Token 원문을 SHA-256으로 해시합니다.  
7. 사용자 ID, 토큰 해시와 만료 시각을 DB의 `sessions` 테이블에 Session 레코드로 저장합니다.  
8. Access Token은 응답 본문으로, Refresh Token 원문은 `HttpOnly` 쿠키로 반환합니다.  

![로그인할 때 서버가 Access Token과 Refresh Token을 만드는 과정](/assets/images/nodejs/nodejs-fastify/jwt-login-token-issuance-flow.svg)

DB에는 Refresh Token 원문이 아니라 해시만 저장합니다.  
DB가 노출되더라도 저장된 해시를 Refresh Token 원문처럼 바로 사용할 수 없게 하기 위해서입니다.  

`sessions` 테이블의 각 Session 레코드에는 다음 정보가 저장됩니다.  

| 필드 | 저장 예시 | 용도 |
| --- | --- | --- |
| `id` | `cm...` | Session 레코드 식별자 |
| `userId` | `123` | Session 레코드 소유자 |
| `tokenHash` | `SHA-256 결과` | 요청 토큰과 일치하는 레코드 조회 |
| `expiresAt` | 로그인 시각 + 7일 | Refresh Token 만료 판단 |
| `createdAt` | 레코드 생성 시각 | 생성 기록 |

### 🟦 로그인 응답과 토큰 보관

로그인에 성공하면 Access Token은 JSON 응답에 들어가고 Refresh Token은 `Set-Cookie` 헤더로 전달됩니다.  

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: refreshToken=REFRESH_TOKEN; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Strict

{
  "accessToken": "ACCESS_TOKEN",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "USER"
  }
}
```

클라이언트 애플리케이션은 응답 본문의 Access Token을 보관합니다.  
브라우저는 `Set-Cookie` 헤더를 처리하여 Refresh Token을 쿠키 저장소에 보관합니다.  

`HttpOnly` 쿠키는 브라우저 JavaScript로 읽을 수 없지만 조건에 맞는 요청에는 자동으로 포함됩니다.  
운영 환경에서는 `Secure` 옵션도 추가하여 HTTPS 요청에만 Refresh Token 쿠키를 보내야 합니다.  

## 3. 보호 API에서 Access Token 사용 {#session-03}

로그인 후 사용자 조회나 상태 변경 같은 보호 API에는 Access Token을 사용합니다.  
Refresh Token은 이 요청을 처리하기 위한 자격 증명이 아니며 쿠키 경로도 일치하지 않아 전송되지 않습니다.  

![Fastify 프로젝트의 JWT 인증과 권한 처리 전체 흐름](/assets/images/nodejs/nodejs-fastify/fastify-authentication-authorization-flow.svg)

### 🟦 보호 API 요청과 Access Token 검증

클라이언트는 로그인 응답에서 받은 Access Token을 `Authorization` 헤더에 직접 추가합니다.  

```http
GET /api/users/123 HTTP/1.1
Host: localhost:3000
Authorization: Bearer ACCESS_TOKEN
```

서버는 다음 순서로 요청을 처리합니다.  

1. Route 본문보다 먼저 `authenticate`를 실행합니다.  
2. `request.jwtVerify()`가 Signature와 `exp`를 검사합니다.  
3. `type`이 `access`인지 확인합니다.  
4. 검증된 payload를 `request.user`에 저장합니다.  
5. `requireSelfOrAdmin`이 `sub`와 요청 URL의 사용자 ID 또는 `role`을 확인합니다.  
6. 인증과 인가를 모두 통과하면 Controller와 Service가 사용자 정보를 조회합니다.  

이 과정에서 Access Token은 검증할 계정의 식별자와 인가에 사용할 역할 Claim을 전달합니다.  
서버는 보호 API를 호출할 때마다 DB의 Session 레코드를 조회하지 않고 JWT의 서명과 Claim을 검증합니다.  

### 🟦 보호 API의 인가 Guard

인증에 성공한 뒤에는 Route의 목적에 맞는 인가 Guard가 권한을 확인합니다.  

| Guard | 통과 조건 | 적용 예시 |
| --- | --- | --- |
| `requireSelf` | JWT의 `sub`와 URL의 사용자 ID가 같음 | 본인 비밀번호 변경, 회원 탈퇴 |
| `requireAdmin` | JWT의 `role`이 `ADMIN` | 사용자 상태 변경 |
| `requireSelfOrAdmin` | 본인이거나 관리자임 | 사용자 상세 조회 |

### 🟦 인증 실패와 인가 실패

Access Token을 보내지 않으면 서버는 요청을 인증할 수 없으므로 `401 Unauthorized`를 반환합니다.  

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

유효한 일반 사용자 토큰으로 관리자 API를 요청하면 인증은 성공하지만 권한이 부족하므로 `403 Forbidden`을 반환합니다.  

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "success": false,
  "code": "FORBIDDEN",
  "message": "관리자 권한이 필요합니다."
}
```

Access Token의 15분 유효 시간이 지나면 보호 API는 `401 TOKEN_EXPIRED`를 반환합니다.  

```http
GET /api/users/123 HTTP/1.1
Authorization: Bearer EXPIRED_ACCESS_TOKEN
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "code": "TOKEN_EXPIRED",
  "message": "Access Token이 만료되었습니다."
}
```

클라이언트는 모든 `401`에 재발급을 시도하면 안 됩니다.  
Access Token 만료를 나타내는 `TOKEN_EXPIRED`일 때만 원래 요청을 보류하고 `/api/auth/refresh`를 호출합니다.  
토큰 형식이 잘못된 `TOKEN_INVALID`나 로그인이 필요한 `UNAUTHORIZED`는 인증 상태를 정리하고 다시 로그인하도록 처리합니다.  

## 4. 재발급 API에서 두 토큰 교체 {#session-04}

재발급 API는 유효한 Refresh Token을 확인한 뒤 Access Token과 Refresh Token을 모두 새로 발급하는 경로입니다.  
Access Token이 만료되었거나 브라우저 메모리에서 사라진 상황에도 호출할 수 있어야 하므로, 재발급 요청을 인증할 때는 Access Token을 사용하지 않습니다.  

### 🟦 재발급 요청과 Refresh Token 검증

클라이언트가 `/api/auth/refresh`를 호출하면 브라우저가 `HttpOnly` Refresh Token 쿠키를 자동으로 전송합니다.  

![Refresh Token 검증과 Access Token 및 Refresh Token 교체 흐름](/assets/images/nodejs/nodejs-fastify/jwt-refresh-token-rotation-flow.svg)

```http
POST /api/auth/refresh HTTP/1.1
Host: localhost:3000
Cookie: refreshToken=REFRESH_TOKEN
```

서버는 쿠키로 받은 Refresh Token을 다음 순서로 검증하고 교체합니다.  

1. 요청 쿠키에서 Refresh Token 원문을 읽습니다.  
2. 원문을 SHA-256으로 해시합니다.  
3. `sessions` 테이블에서 같은 `tokenHash`를 가진 Session 레코드와 사용자를 조회합니다.  
4. Session 레코드의 `expiresAt`이 현재 시각보다 나중인지 확인합니다.  
5. 사용자가 `ACTIVE` 상태이고 탈퇴하지 않았는지 확인합니다.  
6. 새 Access Token과 Refresh Token을 만들고, 새 Refresh Token을 SHA-256으로 해시합니다.  
7. Session 레코드의 기존 `tokenHash`가 아직 일치할 때만 새 해시와 만료 시각으로 갱신합니다.  
8. Access Token은 응답 본문으로 보내고, Refresh Token 원문은 쿠키로 설정합니다.  

Repository가 조회한 Session 레코드는 현재 요청을 처리하는 동안 `session`이라는 JavaScript 객체로 Service에 전달됩니다.  
여기서 `session`은 별도의 로그인 저장소가 아니라, DB 조회 결과를 서버 메모리에 잠시 담아 둔 값입니다.  

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: refreshToken=NEW_REFRESH_TOKEN; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Strict

{
  "accessToken": "NEW_ACCESS_TOKEN",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "role": "USER"
  }
}
```

재발급에 성공하는 순간 Session 레코드의 `tokenHash`가 새 값으로 바뀝니다.  
따라서 이전 Refresh Token을 다시 보내면 현재 해시와 일치하지 않아 `401 TOKEN_REVOKED`가 반환됩니다.  

### 🟦 Access Token 만료 후 원래 요청 재시도

Access Token이 만료되면 클라이언트는 재발급을 마친 뒤 실패했던 보호 API를 한 번만 다시 요청합니다.  

![Access Token 만료 후 Refresh Token 재발급과 원래 요청 재시도 흐름](/assets/images/nodejs/nodejs-fastify/jwt-access-token-expiration-flow.svg)

1. 클라이언트가 만료된 Access Token으로 보호 API를 호출합니다.  
2. 서버의 `authenticate`가 만료를 확인하고 `401 TOKEN_EXPIRED`를 반환합니다.  
3. 클라이언트가 원래 요청을 잠시 보류합니다.  
4. 클라이언트가 `/api/auth/refresh`를 호출하고, 브라우저는 Refresh Token 쿠키를 자동으로 보냅니다.  
5. 서버가 앞에서 살펴본 검증과 교체 과정을 거쳐 두 토큰을 새로 발급합니다.  
6. 클라이언트가 새 Access Token으로 보류했던 보호 API를 한 번 다시 요청합니다.  
7. 재시도한 요청이 인증과 인가를 통과하면 정상 응답을 처리합니다.  

재발급 요청 자체가 `401`로 실패했다면 원래 요청을 반복해서는 안 됩니다.  
클라이언트는 저장한 Access Token과 사용자 정보를 제거하고 로그인 화면으로 이동해야 합니다.  

### 🟦 앱 시작 시 로그인 상태 복원

Access Token을 브라우저 메모리에만 보관하면 페이지를 새로고침하거나 새 탭을 열었을 때 값이 남아 있지 않습니다.  
이때 바로 로그인 화면을 표시하는 대신, 앱을 시작할 때 `/api/auth/refresh`를 한 번 호출하여 로그인 상태를 복원할 수 있습니다.  

![앱 시작 시 Refresh Token으로 로그인 상태를 복원하는 흐름](/assets/images/nodejs/nodejs-fastify/jwt-app-auth-state-restoration-flow.svg)

Refresh Token 쿠키는 `HttpOnly`이므로 클라이언트 JavaScript가 `document.cookie`로 존재 여부를 확인할 수 없습니다.  
따라서 쿠키를 먼저 확인하지 않고 재발급 API의 응답으로 복원 가능 여부를 판단합니다.  
재발급에 성공하면 새 Access Token과 사용자 정보를 저장하고, 실패하면 인증 상태를 비운 뒤 로그인 화면을 표시합니다.  

로그인 상태를 복원할 수 있는지는 Refresh Token 쿠키와 Session 레코드가 모두 유효한지에 따라 달라집니다.  

| 상황 | Refresh Token 상태 | 로그인 자동 복원 |
| --- | --- | --- |
| 새 탭 열기 | 같은 브라우저의 쿠키를 공유함 | 유효하면 가능 |
| 브라우저 다시 실행 | `Max-Age` 또는 `Expires`가 남은 영속 쿠키 | 유효하면 가능 |
| 브라우저 다시 실행 | 수명 설정이 없는 세션 쿠키 | 브라우저 종료 시 삭제됐다면 불가능 |
| 명시적 로그아웃 | Session 레코드 삭제와 쿠키 만료 처리 | 불가능 |
| 쿠키 직접 삭제·시크릿 모드 종료 | Refresh Token 쿠키 없음 | 불가능 |
| 서버에서 만료·폐기 | 유효한 Session 레코드 없음 | 불가능 |

현재 예제는 Refresh Token 쿠키에 7일의 `Max-Age`를 설정합니다.  
사용자가 로그아웃하지 않았고 쿠키와 Session 레코드가 모두 유효하다면 브라우저를 다시 실행해도 로그인 상태를 복원할 수 있습니다.  
다만 브라우저 설정, 시크릿 모드 또는 사용자의 쿠키 삭제에 따라 쿠키가 더 일찍 사라질 수 있습니다.  

클라이언트는 복원 요청이 끝날 때까지 인증 상태를 `확인 중`으로 두는 편이 좋습니다.  
그렇지 않으면 로그인 화면을 잠깐 표시했다가 다시 본 화면으로 이동하는 깜빡임이 생길 수 있습니다.  

### 🟦 동시 재발급 요청 처리

같은 브라우저 프로필의 여러 탭은 도메인과 `Path` 조건이 일치하면 같은 Refresh Token 쿠키를 사용합니다.  
현재 예제의 쿠키 경로는 `/api/auth`이므로 각 탭에서 `/api/auth/refresh`를 호출하면 브라우저가 동일한 쿠키를 자동으로 전송합니다.  

두 탭이 거의 동시에 재발급을 요청하면 다음과 같이 같은 Refresh Token으로 Session 교체를 시도할 수 있습니다.  

```text
탭 A ── POST /api/auth/refresh ─┐
                                ├─ 같은 Refresh Token으로 교체 시도
탭 B ── POST /api/auth/refresh ─┘
                  ↓
          한 요청만 교체 성공
                  ↓
     나머지 요청은 TOKEN_REVOKED 가능
```

서버는 기존 `tokenHash`가 일치할 때만 Session 레코드를 갱신합니다.  
따라서 먼저 처리된 요청이 Refresh Token을 교체하면, 뒤늦게 도착한 요청의 이전 토큰은 현재 해시와 일치하지 않아 `TOKEN_REVOKED`를 받을 수 있습니다.  
이 조건부 교체는 같은 Refresh Token이 여러 번 사용되는 것을 막아 주지만, 동시에 발생한 요청을 클라이언트에서 조정해 주지는 않습니다.  

같은 탭 안에서는 진행 중인 재발급 Promise를 하나만 저장하고 모든 요청이 그 결과를 기다리게 할 수 있습니다.  
이렇게 하면 여러 보호 API가 동시에 `TOKEN_EXPIRED`를 받아도 재발급 요청은 한 번만 전송됩니다.  

하지만 JavaScript 메모리는 탭마다 분리되어 있으므로 한 탭이 저장한 Promise를 다른 탭에서 공유할 수는 없습니다.  
탭 사이의 경쟁도 제어해야 한다면 Web Locks API에서 같은 이름의 배타적 잠금을 사용하여 재발급 요청을 순서대로 처리할 수 있습니다.  

Web Locks API의 역할은 새 토큰 값을 탭끼리 자동으로 공유하는 것이 아닙니다.  
한 탭이 재발급하는 동안 다른 탭을 기다리게 하여, 같은 Refresh Token으로 동시에 교체를 시도하지 않도록 만드는 역할입니다.  
잠금을 얻은 탭은 재발급이 여전히 필요한지 다시 확인하거나, 필요한 경우 자신의 재발급 요청을 순서대로 실행해야 합니다.  

### 🟦 Refresh Token 만료와 재발급 실패

Refresh Token 쿠키와 DB의 Session 레코드는 기본적으로 같은 7일 동안 유효합니다.  
둘 중 하나라도 없거나 유효하지 않으면 토큰을 재발급할 수 없으며, 클라이언트는 재시도하지 않고 다시 로그인하도록 안내해야 합니다.  

재발급이 실패하는 대표적인 상황과 처리 방법은 다음과 같습니다.  

| 상황 | 서버 처리 | 응답 코드 | 클라이언트 처리 |
| --- | --- | --- | --- |
| Refresh Token 쿠키 없음 | Controller에서 요청 거절 | `UNAUTHORIZED` | 인증 상태 제거 후 로그인 이동 |
| Session 레코드 없음 | 이미 폐기된 토큰으로 판단 | `TOKEN_REVOKED` | 재시도하지 않고 로그인 이동 |
| Session 레코드 만료 | DB에서 만료 레코드 삭제 | `TOKEN_EXPIRED` | 재시도하지 않고 로그인 이동 |
| 이전 Refresh Token 재사용 | 현재 `tokenHash`와 불일치 | `TOKEN_REVOKED` | 토큰 탈취 가능성을 고려해 로그인 이동 |
| 동시 재발급에서 교체 실패 | 먼저 처리된 요청만 성공 | `TOKEN_REVOKED` | 성공한 단일 재발급 결과 공유 |
| 사용자 정지·탈퇴 | 사용자의 모든 Session 레코드 삭제 | `FORBIDDEN` | 서비스 이용 중단 상태 표시 |

예를 들어 Session 레코드가 만료되었다면 서버는 해당 레코드를 삭제하고 다음과 같이 `401 TOKEN_EXPIRED`를 반환합니다.  

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "code": "TOKEN_EXPIRED",
  "message": "인증 토큰이 만료되었습니다."
}
```

Access Token 만료는 Refresh Token으로 복구할 수 있지만 Refresh Token 만료·폐기는 재로그인이 필요합니다.  

## 5. 로그아웃 API에서 Refresh Session 폐기 {#session-05}

로그아웃은 새 토큰을 발급하지 못하도록 DB의 Session 레코드를 삭제하는 과정입니다.  
현재 기기 로그아웃과 전체 로그아웃은 삭제 범위와 사용자를 식별하는 토큰이 다릅니다.  

![현재 기기 로그아웃과 전체 로그아웃의 토큰 및 Session 삭제 범위 비교](/assets/images/nodejs/nodejs-fastify/jwt-logout-session-revocation-flow.svg)

### 🟦 현재 기기 로그아웃 `/api/auth/logout`

현재 기기 로그아웃은 Refresh Token 쿠키로 현재 Session 하나를 찾습니다.  
Access Token은 이 요청에서 사용하지 않습니다.  

```http
POST /api/auth/logout HTTP/1.1
Host: localhost:3000
Cookie: refreshToken=REFRESH_TOKEN
```

서버는 다음 순서로 처리합니다.  

1. 쿠키에 Refresh Token이 있으면 원문을 SHA-256으로 해시합니다.  
2. 같은 `tokenHash`를 가진 Session 레코드 하나를 삭제합니다.  
3. 응답에서 Refresh Token 쿠키를 만료시켜 브라우저에서도 제거합니다.  
4. 응답 본문 없이 `204 No Content`를 반환합니다.  

쿠키가 이미 없거나 일치하는 Session이 없어도 로그아웃된 최종 상태는 같습니다.  
따라서 이 예제는 오류 대신 `204 No Content`를 반환하여 같은 요청을 반복해도 결과가 달라지지 않게 처리합니다.  

### 🟦 전체 로그아웃 `/api/auth/logout-all`

전체 로그아웃은 인증된 사용자의 모든 기기에서 Refresh Session을 폐기합니다.  
서버는 Access Token의 `sub`로 사용자를 식별하므로 유효한 Access Token이 필요합니다.  

```http
POST /api/auth/logout-all HTTP/1.1
Host: localhost:3000
Authorization: Bearer ACCESS_TOKEN
Cookie: refreshToken=REFRESH_TOKEN
```

`Path=/api/auth` 조건 때문에 현재 브라우저의 Refresh Token 쿠키도 자동으로 전송될 수 있습니다.  
하지만 전체 로그아웃의 사용자 식별에는 이 쿠키가 아니라 검증된 Access Token의 `sub`를 사용합니다.  

1. `authenticate`가 Access Token의 서명과 만료 시각을 검증합니다.  
2. 검증된 payload의 `sub`에서 사용자 ID를 읽습니다.  
3. `sessions` 테이블에서 해당 사용자의 모든 Session 레코드를 삭제합니다.  
4. 현재 브라우저의 Refresh Token 쿠키도 제거합니다.  
5. 응답 본문 없이 `204 No Content`를 반환합니다.  

다른 기기의 브라우저에는 Refresh Token 쿠키 문자열이 남아 있을 수 있습니다.  
하지만 서버의 Session 레코드가 삭제되었으므로 해당 쿠키로 재발급을 요청하면 `401 TOKEN_REVOKED`가 반환됩니다.  

### 🟦 Session 삭제 범위와 Access Token 처리

로그아웃 외에도 보안상 기존 로그인을 종료해야 하는 작업은 사용자의 Session 레코드를 삭제합니다.  

| 작업 | `sessions` 테이블 처리 |
| --- | --- |
| 현재 기기 로그아웃 | 현재 Refresh Token의 Session 레코드만 삭제 |
| 전체 로그아웃 | 해당 사용자의 모든 Session 레코드 삭제 |
| 비밀번호 변경 | 해당 사용자의 모든 Session 레코드 삭제 |
| 계정 정지 | 해당 사용자의 모든 Session 레코드 삭제 |
| 회원 탈퇴 | 상태 변경과 모든 Session 레코드 삭제를 함께 처리 |

Session 레코드를 삭제하면 해당 Refresh Token으로 새 Access Token을 발급받을 수 없습니다.  
하지만 이미 발급된 Access JWT는 자체 만료 시각까지 서명 검증에 성공할 수 있습니다.  
현재 브라우저의 클라이언트는 로그아웃 응답을 받으면 보관 중인 Access Token과 사용자 정보도 제거해야 합니다.  
다른 기기에 남은 Access Token은 만료될 때까지 사용할 수 있으므로 예제 프로젝트는 Access Token의 수명을 15분으로 짧게 설정합니다.  

📌 API 호출 흐름을 정리하면 다음과 같습니다.  

1. `/api/auth/login`이 Access Token과 Refresh Token을 발급합니다.  
2. 보호 API는 Access Token을 검증해 요청을 인증하고 Claim을 바탕으로 권한을 확인합니다.  
3. `/api/auth/refresh`는 Refresh Token을 검증·회전하고 두 토큰을 새로 발급합니다.  
4. `/api/auth/logout`은 현재 Refresh Session 하나를 삭제합니다.  
5. `/api/auth/logout-all`은 Access Token의 `sub`에 해당하는 모든 Refresh Session을 삭제합니다.  
