---
layout: post
title: "03. HTTP, Fastify, Prisma 자동 계측과 Jaeger Trace 분석"
description: "HttpInstrumentation, FastifyOtelInstrumentation, PrismaInstrumentation을 적용해 HTTP 요청부터 Fastify Route와 Prisma Query까지 자동으로 계측합니다. Jaeger에서 하나의 Trace로 연결된 Span을 확인하고 각 처리 구간을 분석합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. 자동 계측 실습 환경과 전체 구성"
  - id: session-02
    title: "2. HttpInstrumentation으로 HTTP 요청 Trace 계측"
  - id: session-03
    title: "3. FastifyOtelInstrumentation으로 Route Trace 계측"
  - id: session-04
    title: "4. PrismaInstrumentation으로 DB 구간 계측과 Trace 확인"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

웹 API의 응답이 느려졌을 때 전체 응답 시간만 확인해서는 어느 구간에서 시간이 오래 걸렸는지 알기 어렵습니다.  
HTTP 요청을 받은 구간, Fastify가 Route를 실행한 구간, Prisma가 데이터베이스 작업을 수행한 구간을 함께 살펴봐야 원인을 좁힐 수 있습니다.  

OpenTelemetry의 Instrumentation을 사용하면 각 라이브러리의 코드를 직접 수정하지 않고도 주요 처리 구간을 자동으로 계측할 수 있습니다.  
계측은 애플리케이션의 작업을 Span으로 기록하는 과정이며, 같은 요청에서 만들어진 Span은 하나의 Trace 안에서 부모·자식 관계로 연결됩니다.  

이번 글에서는 다음 세 Instrumentation을 사용합니다.  

| Instrumentation | 자동으로 측정하는 구간 |
| --- | --- |
| `HttpInstrumentation` | Node.js가 HTTP 요청을 받고 응답하는 전체 구간 |
| `FastifyOtelInstrumentation` | Fastify가 요청과 Route handler를 처리하는 구간 |
| `PrismaInstrumentation` | Prisma Client operation과 내부 DB 작업 구간 |

세 Instrumentation을 함께 적용하면 다음과 같은 흐름을 하나의 Trace에서 확인할 수 있습니다.  

```text
Client
  │ GET /api/ch03/posts?limit=5
  ▼
Node.js HTTP                 HttpInstrumentation
  ▼
Fastify Route                FastifyOtelInstrumentation
  ▼
Prisma Client                PrismaInstrumentation
  ▼
SQLite
  │ OTLP/HTTP
  ▼
Jaeger
```

## 1. 자동 계측 실습 환경과 전체 구성 {#session-01}

### 🟦 실습 프로젝트 구조

실습은 `nodejs-workbook/observability-basics` 프로젝트의 공통 코드와 `src/ch03` 코드를 사용합니다.  
공통 코드는 OpenTelemetry 초기화, Fastify 서버, Prisma Client와 공통 Route 등록을 담당합니다.  
`src/ch03` 코드는 자동 계측 결과를 확인할 게시글 목록 API를 제공합니다.  

```text
observability-basics/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── ch03/
│   │   ├── post.controller.ts
│   │   ├── post.repository.ts
│   │   ├── post.routes.ts
│   │   ├── post.schema.ts
│   │   ├── post.service.ts
│   │   └── post.types.ts
│   ├── config/
│   │   └── env.ts
│   ├── plugins/
│   │   └── prisma.plugin.ts
│   ├── app.ts
│   ├── instrumentation.ts
│   ├── route.ts
│   └── server.ts
├── package.json
└── prisma.config.ts
```

주요 파일의 역할은 다음과 같습니다.  

| 파일 | 역할 |
| --- | --- |
| `src/instrumentation.ts` | 세 Instrumentation과 OTLP exporter를 설정하고 OpenTelemetry SDK를 시작합니다. |
| `src/app.ts` | Fastify 인스턴스에 Prisma 플러그인과 공통 Route를 등록합니다. |
| `src/route.ts` | `ch03` Route에 `/ch03` prefix를 지정합니다. |
| `src/plugins/prisma.plugin.ts` | Prisma Client를 생성하고 Fastify 인스턴스에서 공유합니다. |
| `src/ch03/post.routes.ts` | 게시글 목록 API를 등록합니다. |
| `src/ch03/post.repository.ts` | Prisma Client로 게시글과 관계 데이터를 조회합니다. |

### 🟦 자동 계측 패키지 확인

실습에 필요한 패키지를 `observability-basics` 워크스페이스에 설치합니다.  
Fastify와 TypeBox는 API를 구성하고, OpenTelemetry와 Prisma 관련 패키지는 HTTP 요청부터 DB 작업까지 자동으로 계측합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics

# Fastify API, OpenTelemetry 자동 계측과 Prisma 실행 패키지를 설치합니다.
npm install fastify@5.6.2 \
  fastify-plugin@6.0.0 \
  @fastify/otel@0.21.0 \
  @fastify/type-provider-typebox@6.1.0 \
  typebox@1.3.34 \
  @opentelemetry/api@1.9.1 \
  @opentelemetry/exporter-trace-otlp-http@0.222.0 \
  @opentelemetry/instrumentation-http@0.222.0 \
  @opentelemetry/sdk-node@0.222.0 \
  @prisma/adapter-better-sqlite3@7.10.0 \
  @prisma/client@7.10.0 \
  @prisma/instrumentation@7.10.0 \
  better-sqlite3@13.0.3

# Prisma CLI와 better-sqlite3 타입 패키지는 개발 의존성으로 설치합니다.
npm install -D prisma@7.10.0 \
  @types/better-sqlite3@9.6.0
```

설치가 끝나면 워크스페이스에 추가된 최상위 패키지와 버전을 확인합니다.  

```bash
npm list -w observability-basics --depth=0
```

다음과 같이 설치한 패키지와 버전이 표시됩니다.  

```text
nodejs-workbook@1.0.0 /home/ubuntu/blog-workspaces/nodejs-workbook
└─┬ observability-basics@1.0.0 -> ./observability-basics
  ├── @fastify/otel@0.21.0
  ├── @fastify/type-provider-typebox@6.1.0
  ├── @opentelemetry/api@1.9.1
  ├── @opentelemetry/exporter-trace-otlp-http@0.222.0
  ├── @opentelemetry/instrumentation-http@0.222.0
  ├── @opentelemetry/sdk-node@0.222.0
  ├── @prisma/adapter-better-sqlite3@7.10.0
  ├── @prisma/client@7.10.0
  ├── @prisma/instrumentation@7.10.0
  ├── @types/better-sqlite3@9.6.0
  ├── better-sqlite3@13.0.3
  ├── fastify-plugin@6.0.0
  ├── fastify@5.6.2
  ├── prisma@7.10.0
  └── typebox@1.3.34
```

`tsx --import ./src/instrumentation.ts`가 중요한 부분입니다.  
자동 계측은 대상 라이브러리가 로드되기 전에 준비되어야 하므로 `instrumentation.ts`를 `server.ts`보다 먼저 실행합니다.  

```text
npm run ch03
  ▼
instrumentation.ts           OpenTelemetry SDK 시작
  ▼
server.ts                    Fastify 애플리케이션 실행
  ▼
app.ts                       Prisma 플러그인과 Route 등록
```

### 🟦 환경 변수 설정

`src/config/env.ts`는 계측에 사용할 서비스 이름과 OTLP/HTTP 전송 주소를 환경 변수에서 읽습니다.  
값을 지정하지 않으면 각각 `observability-basics`와 `http://localhost:4318/v1/traces`를 사용합니다.  

```typescript
export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  HOST: process.env.HOST ?? '0.0.0.0',
  PORT: Number(process.env.PORT ?? 3_000),

  // 실행 환경을 지정하지 않으면 운영 환경으로 처리합니다.
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
  LOG_PATH: process.env.LOG_PATH ?? './logs/app.log',

  // Jaeger 또는 OpenTelemetry Collector가 Trace를 받을 주소입니다.
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? 'observability-basics',
};
```

로컬 실습용 `.env`는 다음 항목을 준비합니다.  

```dotenv
DATABASE_URL="file:./path/to/database.db"
HOST="0.0.0.0"
PORT="3000"
LOG_LEVEL="debug"
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
OTEL_SERVICE_NAME="observability-basics"
```

### 🟦 데이터베이스와 Jaeger 준비

Prisma 스키마를 SQLite에 반영하고 Client를 생성한 뒤 실습 데이터를 추가합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics

# Prisma 스키마를 DB에 반영하고 Client를 생성합니다.
npx prisma migrate dev
npx prisma generate

# 사용자, 게시글과 좋아요 실습 데이터를 생성합니다.
npm run seed
또는
npx tsx ./src/post.seed.ts
```

다음으로 OpenTelemetry가 보낸 Trace를 저장하고 조회할 Jaeger를 실행합니다.  

```bash
docker run --rm \
  --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  cr.jaegertracing.io/jaegertracing/jaeger:2.21.0
```

| 포트 | 역할 |
| --- | --- |
| `4318` | Jaeger가 OTLP/HTTP Trace를 받습니다. |
| `16686` | Jaeger UI를 제공합니다. |

## 2. HttpInstrumentation으로 HTTP 요청 Trace 계측 {#session-02}

### 🟦 OpenTelemetry SDK 초기화

`src/instrumentation.ts`에서 OTLP exporter와 세 Instrumentation을 `NodeSDK`에 등록합니다.  

```typescript
// src/instrumentation.ts

import 'dotenv/config';

import FastifyOtelInstrumentation from '@fastify/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

import { env } from './config/env.js';

// 완성된 Span을 Jaeger의 OTLP/HTTP 수신 주소로 전송합니다.
const traceExporter = new OTLPTraceExporter({
  // http://localhost:4318/v1/traces
  url: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
});

const sdk = new NodeSDK({
  // Jaeger의 Service 목록에서 사용할 애플리케이션 이름입니다.
  // observability-basics
  serviceName: env.OTEL_SERVICE_NAME,
  traceExporter,
  instrumentations: [
    // Node.js HTTP 요청과 응답 구간을 자동으로 계측합니다.
    new HttpInstrumentation(),
    // Fastify 요청과 Route 처리 구간을 자동으로 계측합니다.
    new FastifyOtelInstrumentation({
      registerOnInitialization: true,
    }),
    // Prisma Client operation과 내부 DB 구간을 자동으로 계측합니다.
    new PrismaInstrumentation(),
  ],
});

// Fastify와 Prisma 모듈보다 먼저 자동 계측을 시작합니다.
sdk.start();
```

`OTLPTraceExporter`는 메모리에 생성된 Span을 Jaeger의 OTLP/HTTP endpoint로 보냅니다.  
`serviceName`은 여러 애플리케이션의 Trace를 구분하는 이름이며 Jaeger의 Service 선택 목록에도 표시됩니다.  

### 🟦 HttpInstrumentation의 역할

`HttpInstrumentation`은 Node.js의 HTTP 계층을 자동으로 계측합니다.  
Fastify 코드에 Span 생성 코드를 추가하지 않아도 서버가 요청을 받은 시점부터 응답을 마친 시점까지의 구간이 기록됩니다.  

HTTP 서버 Span에서는 일반적으로 다음 정보를 확인할 수 있습니다.  

- 요청 method와 URL 정보
- 응답 status code
- 서버 주소와 포트
- 요청 시작부터 응답 완료까지 걸린 시간
- 다른 계층의 Span을 연결할 Trace context

자동 계측이 시작되기 전에 HTTP 또는 Fastify 모듈이 먼저 로드되면 필요한 부분을 감싸지 못할 수 있습니다.  
따라서 프로젝트는 `--import` 옵션으로 계측 파일을 먼저 실행합니다.  

```json
{
  "scripts": {
    "dev": "tsx --import ./src/instrumentation.ts ./src/server.ts"
  }
}
```

### 🟦 서버 실행과 HTTP 요청 보내기

Jaeger를 실행한 터미널은 그대로 두고 새 터미널에서 Fastify 서버를 시작합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm run dev
```

`dev` 스크립트를 등록하지 않았다면 다음 명령으로 직접 실행합니다.  

```bash
npx tsx --import ./src/instrumentation.ts ./src/server.ts
```

다른 터미널에서 게시글 목록 API를 호출합니다.  

```bash
curl "http://localhost:3000/api/ch03/posts?limit=5"
```

요청 URL은 다음 세 prefix가 합쳐진 결과입니다.  

```text
app.ts          /api
route.ts        /ch03
post.routes.ts  /posts
─────────────────────
최종 URL        /api/ch03/posts
```

이 요청이 들어오면 `HttpInstrumentation`이 가장 바깥쪽 HTTP 서버 Span을 만듭니다.  
이 Span은 이후 Fastify와 Prisma가 자동으로 만든 Span의 부모가 되어 요청 전체 시간을 보여 줍니다.  

## 3. FastifyOtelInstrumentation으로 Route Trace 계측 {#session-03}

### 🟦 Fastify 자동 계측 등록

`FastifyOtelInstrumentation`에는 `registerOnInitialization: true`를 설정합니다.  
Fastify 인스턴스가 초기화될 때 계측 플러그인을 자동으로 등록하기 위한 옵션입니다.  

```typescript
new FastifyOtelInstrumentation({
  registerOnInitialization: true,
});
```

`HttpInstrumentation`이 Node.js HTTP 요청 전체를 측정한다면 `FastifyOtelInstrumentation`은 그 안에서 Fastify가 요청을 받고 Route handler를 실행하는 구간을 보여 줍니다.  
두 계측 결과를 함께 보면 HTTP 요청 전체 시간과 애플리케이션 Route 처리 시간을 구분할 수 있습니다.  

### 🟦 공통 앱에서 Prisma와 Route 등록

`src/app.ts`는 Prisma 플러그인을 먼저 등록한 뒤 `/api` prefix 아래에 공통 Route를 등록합니다.  
이 순서 덕분에 `ch03` Route에서 `fastify.prisma`를 사용할 수 있습니다.  

```typescript
// src/app.ts

export function createApp() {
  const app = Fastify({
    logger: loggerOptions,
  });

  // Prisma를 사용하는 Route보다 먼저 공통 Prisma Client를 준비합니다.
  app.register(prismaPlugin);

  // 모든 비즈니스 API 앞에 /api prefix를 붙입니다.
  app.register(routes, { prefix: '/api' });

  return app;
}
```

`src/route.ts`에서는 3편의 Route에 `/ch03` prefix를 추가합니다.  

```typescript
// src/route.ts

export function routes(fastify: FastifyInstance) {
  // 최종 URL 앞부분은 /api/ch03이 됩니다.
  fastify.register(ch03PostRoutes, { prefix: '/ch03' });
}
```

### 🟦 ch03 게시글 Route 실행

`src/ch03/post.routes.ts`는 Repository, Service와 Controller를 조립하고 `GET /posts`를 등록합니다.  
이 코드에는 OpenTelemetry API나 수동 Span 생성 코드가 없습니다.  

```typescript
// src/ch03/post.routes.ts

const postRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // 공통 Prisma Client를 Repository에 전달하고 애플리케이션 계층을 조립합니다.
  const postRepository = new PostRepository(fastify.prisma);
  const postService = new PostService(postRepository);
  const postController = new PostController(postService);

  // /api와 /ch03 prefix가 더해져 GET /api/ch03/posts가 됩니다.
  fastify.get('/posts', { schema: ListPostsRouteSchema }, (request, reply) =>
    postController.findAll(request.query, reply),
  );
};
```

Route가 실행되면 요청은 다음 계층을 차례로 통과합니다.  

```text
GET /api/ch03/posts?limit=5
    ▼
Post Route
    ▼
PostController.findAll
    ▼
PostService.findAll
    ▼
PostRepository.findAll
```

Service는 별도의 Span을 만들지 않고 Repository에 조회를 요청합니다.  
따라서 이번 글에서는 HTTP와 Fastify 자동 계측 뒤에 Prisma 자동 계측이 어떻게 이어지는지 분명하게 확인할 수 있습니다.  

```typescript
// src/ch03/post.service.ts

const DEFAULT_PAGE_SIZE = 20;

export class PostService {
  constructor(private readonly postRepository: PostRepository) {}

  /** limit이 없으면 기본값 20으로 게시글을 조회합니다. */
  async findAll(query: PostListQueryDto): Promise<PostResult[]> {
    // 수동 Span 없이 Repository를 호출하여 자동 계측 결과에 집중합니다.
    return this.postRepository.findAll(query.limit ?? DEFAULT_PAGE_SIZE);
  }
}
```

## 4. PrismaInstrumentation으로 DB 구간 계측과 Trace 확인 {#session-04}

### 🟦 Prisma Client 자동 계측

공통 Prisma 플러그인은 애플리케이션이 함께 사용할 Prisma Client를 만들고 Fastify 인스턴스에 등록합니다.  
`PrismaInstrumentation`은 이 Client가 실행하는 operation과 내부 DB 처리 구간을 자동으로 기록합니다.  

```typescript
// src/plugins/prisma.plugin.ts

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // Prisma 7이 better-sqlite3를 통해 SQLite에 접근하도록 어댑터를 만듭니다.
  const adapter = new PrismaBetterSqlite3({
    url: env.DATABASE_URL,
    timeout: 5_000,
  });

  // Fastify 애플리케이션에서 공유할 Prisma Client를 생성합니다.
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();
  fastify.decorate('prisma', prisma);

  // Fastify가 종료될 때 DB 연결도 함께 정리합니다.
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};
```

### 🟦 Repository에서 게시글과 관계 데이터 조회

`src/ch03/post.repository.ts`는 게시글과 작성자, 좋아요 수를 조회합니다.  
Prisma 호출을 별도의 계측 함수로 감싸지 않아도 활성화된 HTTP·Route context 아래에 Prisma Span이 연결됩니다.  

```typescript
// src/ch03/post.repository.ts

export class PostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 작성자와 좋아요 수를 포함한 게시글을 ID 오름차순으로 조회합니다. */
  async findAll(limit: number): Promise<PostResult[]> {
    const posts = await this.prisma.post.findMany({
      // 요청한 수만큼만 조회하고 결과의 순서를 일정하게 유지합니다.
      take: limit,
      orderBy: { id: 'asc' },
      include: {
        // 응답에 필요한 작성자의 공개 필드만 선택합니다.
        author: {
          select: { id: true, name: true },
        },
        // 좋아요 행 전체 대신 관계 개수만 집계합니다.
        _count: {
          select: { likes: true },
        },
      },
    });

    // Prisma의 관계 집계 결과를 API에서 사용할 likeCount로 변환합니다.
    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      author: post.author,
      likeCount: post._count.likes,
    }));
  }
}
```

`post.findMany()`를 실행하면 Prisma Client operation과 그 내부 처리 단계가 Span으로 만들어집니다.  
세부 Span의 이름과 개수는 Prisma 버전, 데이터베이스와 Driver Adapter에 따라 달라질 수 있습니다.  
따라서 고정된 이름을 외우기보다 HTTP에서 시작한 부모·자식 관계와 각 Span의 duration을 중심으로 확인합니다.  

### 🟦 Jaeger에서 전체 Trace 확인

여러 Trace를 비교할 수 있도록 같은 API를 몇 번 호출합니다.  

```bash
for index in {1..5}; do
  curl -s "http://localhost:3000/api/ch03/posts?limit=5"
  echo
done
```

브라우저에서 `http://localhost:16686`에 접속합니다.  
왼쪽 검색 조건의 **Service**에서 `observability-basics`를 선택하고, **Span Name**에서 `GET /api/ch03/posts`를 선택한 뒤 **Find Traces**를 누릅니다.  

#### 🟦 Trace 목록 화면 해석

![GET /api/ch03/posts Trace 목록](/assets/images/nodejs/nodejs-observability/03-jaeger-list.png)

목록 화면은 검색 조건에 맞는 여러 Trace를 비교하는 화면입니다.  
위쪽 분포도에서 가로축은 요청이 시작된 시각이고 세로축은 각 요청의 전체 실행 시간입니다.  
점이 위쪽에 있을수록 처리 시간이 긴 요청이므로, 평소보다 느린 요청을 먼저 찾을 수 있습니다.  

이미지에는 최근 5분 동안 수집된 Trace가 표시되어 있습니다.  
각 행의 **Trace Name**은 `observability-basics: GET /api/ch03/posts`이며, **Spans**는 모두 7개입니다.  
**Duration**은 대부분 약 2~4ms 범위이므로 요청마다 전체 실행 시간에는 조금씩 차이가 있음을 알 수 있습니다.  

목록 화면에서는 다음 순서로 확인합니다.  

1. **Trace Name**에서 분석하려는 API 요청이 맞는지 확인합니다.  
2. **Spans**에서 같은 요청끼리 Span 개수가 일정한지 비교합니다.  
3. **Duration**으로 전체 요청 시간을 비교하고 상대적으로 느린 Trace를 찾습니다.  
4. **Start Time**으로 문제가 발생한 시각의 요청을 찾습니다.  

Span 개수가 갑자기 늘었다면 같은 요청에서 DB 작업이나 내부 호출이 반복되었을 가능성이 있습니다.  
Span 개수는 같지만 Duration만 길다면 특정 Span의 실행 시간이 늘었는지 상세 화면에서 확인해야 합니다.  
이 이미지에서는 가장 위의 요청을 선택해 상세 구조를 살펴봅니다.  

#### 🟦 Trace 상세 화면 해석

![GET /api/ch03/posts Trace 상세 정보](/assets/images/nodejs/nodejs-observability/03-jaeger-detail.png)

상세 화면 상단에는 선택한 Trace의 전체 정보가 표시됩니다.  
이미지의 요청은 전체 Duration이 `2.4ms`이고, 하나의 Service에서 깊이 5단계의 Span 7개가 생성되었습니다.  
왼쪽의 **Service & Span Name**은 부모·자식 관계를 나타내고, 오른쪽 막대는 각 Span의 시작 시점과 실행 시간을 나타냅니다.  

화면에 표시된 Span은 다음과 같이 연결됩니다.  

```text
GET /api/ch03/posts                  HttpInstrumentation
└─ request                           FastifyOtelInstrumentation
   └─ handler - postRoutes           FastifyOtelInstrumentation
      └─ prisma:client:operation     PrismaInstrumentation
         ├─ prisma:client:serialize
         ├─ prisma:client:db_query
         └─ prisma:client:db_query
```

`HttpInstrumentation`이 만든 최상위 Span에는 `GET`과 상태 코드 `200`이 표시됩니다.  
이 Span의 Duration은 클라이언트 요청을 받은 시점부터 응답을 마칠 때까지 걸린 전체 시간입니다.  
따라서 Fastify와 Prisma를 포함한 모든 서버 작업의 기준 시간이 됩니다.  

`FastifyOtelInstrumentation`이 만든 `request`는 Fastify가 요청을 처리한 범위를 보여 줍니다.  
`handler - postRoutes`는 이번 요청을 실제로 처리한 Route handler의 실행 구간입니다.  
HTTP Span은 정상인데 handler의 비중이 크다면 Controller, Service 또는 Repository로 이어지는 애플리케이션 처리 구간을 더 살펴봐야 합니다.  

`PrismaInstrumentation`이 만든 Span은 이름이 `prisma:client:`로 시작합니다.  
이미지에서 선택한 `prisma:client:operation`의 attribute에는 `method = findMany`, `model = Post`, `name = Post.findMany`가 표시됩니다.  
이를 통해 코드에서 실행한 `this.prisma.post.findMany()`와 해당 Span을 연결할 수 있습니다.  

`prisma:client:serialize`은 Prisma 요청을 DB 작업으로 준비하는 구간입니다.  
`prisma:client:db_query`은 SQLite에서 실행된 실제 Query 구간이며, 상세 attribute의 `db.query.text`에서 SQL을 확인할 수 있습니다.  
이미지에는 게시글 조회와 작성자 관계 조회에 해당하는 DB Query Span이 각각 `362μs`, `147μs`로 표시됩니다.  

여기서 Prisma Client operation 한 번과 실제 DB Query 한 번을 같은 의미로 해석하면 안 됩니다.  
이번 요청은 `Post.findMany`를 한 번 호출했지만, 관계 데이터를 가져오는 과정에서 두 개의 `prisma:client:db_query` Span이 생성되었습니다.  
Prisma operation 수는 애플리케이션이 Prisma Client 메서드를 호출한 횟수이고, DB Query Span 수는 내부에서 실제 DB 작업이 실행된 횟수입니다.  

#### 🟦 Trace 분석 순서

Trace는 바깥 Span에서 안쪽 Span으로 좁혀 가며 분석합니다.  

1. HTTP Span의 status code와 Duration으로 요청의 성공 여부와 전체 시간을 확인합니다.  
2. Fastify의 `request`와 `handler` Span을 비교해 Route 처리 구간이 차지하는 비중을 확인합니다.  
3. Prisma operation의 `model`과 `method`로 실행된 Prisma 코드를 찾습니다.  
4. `db_query` Span의 개수, Duration과 SQL을 확인해 반복 Query나 느린 DB 작업이 있는지 살펴봅니다.  
5. 같은 API의 여러 Trace를 비교해 특정 요청에서만 나타나는 현상인지 반복되는 경향인지 확인합니다.  

처음 실행한 요청은 Prisma Client와 데이터베이스 준비 비용의 영향을 받을 수 있습니다.  
한 번의 Duration만으로 성능을 판단하지 말고 같은 요청을 반복한 뒤 Span 개수와 각 구간의 실행 시간을 함께 비교하는 것이 좋습니다.  

자동 계측은 프레임워크와 라이브러리가 수행한 작업을 빠르게 보여 줍니다.  
하지만 어떤 조회 전략을 사용했는지, 결과가 몇 건인지와 같은 애플리케이션의 의미까지 자동으로 알 수는 없습니다.  
