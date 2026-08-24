---
layout: post
title: "[Fastify] 06. TypeBox 기본 문법 이해하기"
description: "Fastify의 요청과 응답 스키마를 작성할 때 사용하는 TypeBox의 기본 타입, 조합 타입, 스키마 유틸리티와 Static 타입 추출 방법을 알아봅니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. 기본 타입과 Object 스키마"
  - id: session-02
    title: "2. 선택 필드와 컬렉션(Optional & Collections) 타입"
  - id: session-03
    title: "3. 조합 타입(Union, Literal, Enum, Nullable)"
  - id: session-04
    title: "4. 스키마 유틸리티(Partial, Pick, Omit)"
  - id: session-05
    title: "5. TypeScript 타입 추출(Static)"
---

## 1. 기본 타입과 Object 스키마 {#session-01}

가장 기본이 되는 원시 타입과 데이터의 뼈대가 되는 Object 구조를 정의합니다.  

### 🟦 기본 타입 정의와 제약 조건

TypeBox는 JSON Schema의 표준 타입을 제공하며, 두 번째 인자로 세부 유효성 검사 옵션을 전달할 수 있습니다.  
이 옵션들은 Fastify의 Ajv를 통해 런타임 유효성 검사에 사용됩니다.  

| 타입 | 옵션 | 설명 |
| --- | --- | --- |
| String | `minLength`, `maxLength` | 문자열의 최소·최대 길이를 제한합니다. |
| String | `pattern` | 정규 표현식으로 문자열을 검사합니다. 예: `^[a-z]+$` |
| String | `format` | `email`, `date-time`, `uuid` 같은 형식을 검사합니다. |
| Number / Integer | `minimum`, `maximum` | 숫자의 최솟값과 최댓값을 제한합니다. |
| Number / Integer | `exclusiveMinimum` | 값이 반드시 초과해야 하는 숫자 기준값을 지정합니다. |
| Number / Integer | `multipleOf` | 특정 수의 배수인지 검사합니다. |

#### 🔷 자주 사용하는 String format

Fastify가 기본으로 사용하는 Ajv 구성에서는 `ajv-formats`가 제공하는 다음 형식을 사용할 수 있습니다.  

| `format` | 예시 | 설명 |
| --- | --- | --- |
| `email` | `user@example.com` | 이메일 주소 형식을 검사합니다. |
| `date-time` | `2023-10-27T10:00:00Z` | 날짜와 시간을 포함한 형식을 검사합니다. |
| `date` | `2023-10-27` | 날짜 형식을 검사합니다. |
| `time` | `10:30:00Z` | 시간 형식을 검사합니다. |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` | UUID 형식을 검사합니다. |
| `ipv4` | `192.168.0.1` | IPv4 주소 형식을 검사합니다. |
| `ipv6` | `2001:0db8:85a3:0000:0000:8a2e:0370:7334` | IPv6 주소 형식을 검사합니다. |
| `uri` | `https://example.com/file` | URI 형식을 검사합니다. |
| `uri-reference` | `/api/v1/users` | 상대 경로를 포함한 URI 참조 형식을 검사합니다. |
| `hostname` | `api.example.com` | 호스트 이름 형식을 검사합니다. |
| `regex` | `^[a-z]+$` | 정규 표현식 자체가 유효한지 검사합니다. |
| `json-pointer` | `/data/attributes/name` | JSON Pointer 형식을 검사합니다. |
| 비밀번호 | `P@ssw0rd!` | `password` format은 값을 검증하지 않으므로 길이와 `pattern`으로 검사합니다. |

#### 🔷 기본 타입 정의 예시

```typescript
import { Type } from 'typebox';

// 기본 타입 예시입니다.
const Name = Type.String({ minLength: 2 });
const Age = Type.Integer({ minimum: 0, maximum: 120 });
const Score = Type.Number({ minimum: 0, maximum: 100 });
const IsActive = Type.Boolean({ default: true });

// API 입력값에 필요한 유효성 검사 조건을 지정합니다.
const UserEmail = Type.String({
  format: 'email',
  description: '사용자 주 이메일',
});

const Password = Type.String({
  minLength: 8,
  maxLength: 20,
  // 영문 대문자와 소문자, 숫자를 하나 이상 포함합니다.
  pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$',
});

const CreatedAt = Type.String({ format: 'date-time' });
```

### 🟦 객체(Object) 스키마: `Type.Object()`

대부분의 API는 객체 형태의 데이터를 주고받습니다.  
`Type.Object()`는 속성 이름과 해당 TypeBox 스키마를 연결하여 객체 구조를 정의합니다.  

```typescript
const UserSchema = Type.Object(
  {
    id: Type.Integer({ description: '사용자 고유 ID' }),
    name: Type.String(),
    email: Type.String({ format: 'email' }),

    // 프로필 정보를 중첩 객체로 정의합니다.
    profile: Type.Object({
      bio: Type.String({ maxLength: 200 }),
      avatarUrl: Type.String({ format: 'uri' }),
      settings: Type.Object({
        theme: Type.Union([
          Type.Literal('light'),
          Type.Literal('dark'),
        ]),
        notifications: Type.Boolean(),
      }),
    }),
  },
  {
    // 스키마에 정의하지 않은 속성을 허용하지 않습니다.
    additionalProperties: false,
    description: '사용자 정보 통합 스키마',
  },
);
```

`additionalProperties: false`는 스키마에 없는 속성을 허용하지 않는다는 계약입니다.  
Fastify의 기본 Ajv 설정에서는 이러한 추가 속성을 요청 데이터에서 제거합니다.  

## 2. 선택 필드와 컬렉션(Optional & Collections) 타입 {#session-02}

API를 설계하다 보면 특정 데이터가 들어오지 않아도 되는 경우나 여러 데이터를 묶어서 처리해야 하는 경우가 생깁니다.  

### 🟦 선택 필드(Optional)

TypeBox 객체의 필드는 기본적으로 필수입니다.  
전달하지 않아도 되는 필드는 `Type.Optional()`로 감싸야 합니다.  
이는 TypeScript의 `?` 속성과 대응하며, 런타임에서도 해당 필드가 없어도 검사를 통과하게 합니다.  
다만 `Optional`은 속성의 생략을 허용할 뿐, `null`까지 허용하지는 않습니다.  

```typescript
const UserSchema = Type.Object({
  username: Type.String(),
  // nickname은 전달하지 않아도 유효성 검사 오류가 발생하지 않습니다.
  nickname: Type.Optional(Type.String()), // 선택 속성: nickname?: string
});
```

`nickname` 속성을 읽을 때의 타입은 `string | undefined`입니다.  

### 🟦 배열(Array)

동일한 타입의 데이터가 여러 개 나열되는 형태를 정의합니다.  
최소 항목 수와 중복 허용 여부 등을 옵션으로 제어할 수 있습니다.  

```typescript
// 최소 한 개 이상의 태그를 포함해야 하는 문자열 배열입니다.
const Tags = Type.Array(Type.String(), {
  minItems: 1,
  uniqueItems: true, // 중복된 값을 허용하지 않습니다.
});

// 객체로 이루어진 배열입니다.
const UsersSchema = Type.Array(
  Type.Object({
    id: Type.Integer(),
    name: Type.String(),
  }),
);
```

### 🟦 레코드(Record)

키 이름을 미리 알 수 없지만 값의 타입은 고정된 경우에 사용합니다.  
사전(Dictionary) 형태의 데이터를 정의할 때 유용합니다.  

```typescript
// 키는 문자열이고 값은 정수인 구조입니다.
const Inventory = Type.Record(Type.String(), Type.Integer());

// 예시 데이터: { "apple": 10, "banana": 25 }
```

## 3. 조합 타입(Union, Literal, Enum, Nullable) {#session-03}

단순한 타입을 넘어 여러 조건을 결합하거나 특정 값으로 범위를 제한할 때 사용합니다.  

### 🟦 Literal과 Union

`Literal`은 단 하나의 구체적인 문자열이나 숫자만 허용합니다.  
`Union`은 여러 스키마 중 하나를 허용하며 TypeScript의 `|`와 대응합니다.  

```typescript
// PENDING, COMPLETED, FAILED 가운데 한 값만 허용합니다.
const Status = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('COMPLETED'),
  Type.Literal('FAILED'),
]);

// 문자열 ID와 숫자 ID를 모두 허용합니다.
const IdSchema = Type.Union([
  Type.String(),
  Type.Integer(),
]);
```

### 🟦 Enum(열거형 데이터 매핑)

TypeScript의 `enum`을 런타임 유효성 검사에도 사용하고 싶을 때 유용합니다.  
코드의 가독성을 높이고 상숫값을 한곳에서 관리하기 좋습니다.  
앞의 `Union` 예제를 `Enum`으로 구현하면 다음과 같습니다.  

```typescript
import type { Static } from 'typebox';

// TypeScript Enum을 정의합니다.
enum TaskStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

// Enum을 이용하여 TypeBox 스키마를 생성합니다.
const StatusSchema = Type.Enum(TaskStatus);

// 스키마에서 TypeScript 타입을 추출합니다.
type StatusType = Static<typeof StatusSchema>;
```

### 🟦 Nullable 표현

데이터베이스에서 `NULL`을 허용하는 필드를 처리할 때 필요합니다.  
TypeBox에서는 `Union`에 `Type.Null()`을 포함하여 표현합니다.  

```typescript
// 값이 문자열이거나 명시적으로 null일 수 있습니다.
const NullableString = Type.Union([Type.String(), Type.Null()]);

// 프로필 사진이 등록되지 않은 경우 null을 허용합니다.
const Profile = Type.Object({
  photoUrl: Type.Union([
    Type.String({ format: 'uri' }),
    Type.Null(),
  ]),
});
```

## 4. 스키마 유틸리티(Partial, Pick, Omit) {#session-04}

이미 만든 스키마를 바탕으로 상황에 맞는 새 스키마를 빠르고 안전하게 생성합니다.  
코드 중복을 줄이고 데이터 전송 객체를 설계할 때 유용합니다.  

| 유틸리티 | 설명 | 활용 사례 |
| --- | --- | --- |
| `Type.Partial` | 기존 객체의 최상위 필드를 선택 필드로 변경합니다. | 일부 필드만 수정하는 `PATCH` API에 사용합니다. |
| `Type.Pick` | 기존 객체에서 원하는 필드만 골라 새 스키마를 생성합니다. | 전체 사용자 정보 중 `id`, `email` 등 일부 필드만 사용할 때 유용합니다. |
| `Type.Omit` | 특정 필드를 제외한 나머지 필드로 새 스키마를 생성합니다. | 응답 스키마에서 비밀번호와 토큰 같은 민감 정보 필드를 제외할 때 사용합니다. |

```typescript
// 모든 정보가 담긴 기본 사용자 스키마입니다.
const UserBaseSchema = Type.Object({
  id: Type.Integer(),
  email: Type.String(),
  password: Type.String(),
  createdAt: Type.String(),
});

// 모든 최상위 필드를 선택 필드로 변경합니다.
const UserUpdateSchema = Type.Partial(UserBaseSchema);

// password 필드를 제거하고 나머지 필드로 구성합니다.
const UserPublicSchema = Type.Omit(UserBaseSchema, ['password']);

// id와 email 필드만 선택하여 구성합니다.
const UserSimpleSchema = Type.Pick(UserBaseSchema, ['id', 'email']);
```

응답 스키마에서 민감한 필드를 제외하는 것만으로 데이터 조회 단계까지 안전해지는 것은 아닙니다.  
Prisma로 데이터를 조회할 때도 `select`를 사용하여 비밀번호와 토큰을 가져오지 않는 편이 안전합니다.  

## 5. TypeScript 타입 추출(Static) {#session-05}

TypeBox의 장점은 한 번의 정의로 런타임 스키마와 TypeScript 타입을 함께 얻을 수 있다는 점입니다.  
정의한 스키마에서 컴파일할 때 사용할 정적 타입을 추출할 수 있습니다.  

```typescript
import { Type, type Static } from 'typebox';

// 런타임 유효성 검사를 위한 스키마를 정의합니다.
const UserSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  roles: Type.Array(
    Type.Union([
      Type.Literal('admin'),
      Type.Literal('user'),
    ]),
  ),
});

// 스키마에서 정적 타입을 추출합니다.
type User = Static<typeof UserSchema>;

/* 추출된 User 타입의 모습입니다.
type User = {
  id: number;
  name: string;
  roles: ('admin' | 'user')[];
}
*/

const newUser: User = {
  id: 1,
  name: '홍길동',
  roles: ['admin'], // 타입 자동 완성과 검사를 지원합니다.
};
```

### 🟦 Fastify 적용 예시

```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { Static } from 'typebox';

const userRoute: FastifyPluginAsync = async (fastify) => {
  // 스키마에서 추출한 타입을 요청 Body 제네릭에 지정합니다.
  fastify.post<{ Body: Static<typeof UserSchema> }>(
    '/register',
    {
      schema: {
        // 실제 요청은 UserSchema를 기준으로 검사합니다.
        body: UserSchema,
      },
    },
    async (request, reply) => {
      // request.body는 Static으로 추출한 타입으로 검사됩니다.
      const { name } = request.body;

      return reply.status(201).send({
        message: `${name}님 환영합니다.`,
      });
    },
  );
};
```
