---
layout: post
title: "04. 자동·수동 계측과 Prisma Query 분석"
description: "자동 계측으로 만든 HTTP, Fastify, Prisma Span 사이에 사용자 정의 Service Span을 추가합니다. 조회 전략과 Query 횟수를 attribute로 기록하고 정상 조회, N+1 조회와 여러 Query의 실행 흐름을 비교합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. 자동 계측에 수동 계측 추가하기"
  - id: session-02
    title: "2. 수동 Service Span과 attribute 기록"
  - id: session-03
    title: "3. 정상 조회와 N+1 Query 비교"
  - id: session-04
    title: "4. 여러 Query의 실행 흐름과 N+1 구분"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

`HttpInstrumentation`, `FastifyOtelInstrumentation`, `PrismaInstrumentation`을 사용해 HTTP 요청부터 DB 작업까지 자동으로 계측할 수 있습니다.  
자동 계측만으로도 요청 시간, Route 처리 구간, Prisma operation과 실제 DB Query를 확인할 수 있습니다.  

하지만 자동 계측은 애플리케이션이 왜 그 작업을 실행했는지까지 알지는 못합니다.  
Prisma Span만 보면 `findMany`와 `count`가 실행되었다는 사실은 알 수 있지만, 정상 조회인지 N+1 재현인지, 몇 건을 요청했는지, 몇 번의 operation을 예상했는지는 알기 어렵습니다.  

수동 계측은 이 빈 부분을 채웁니다.  
Service의 유스케이스를 사용자 정의 Span으로 감싸고 조회 전략, 요청 개수와 예상 operation 수를 attribute로 기록하면 자동 계측 결과에 애플리케이션의 의미를 더할 수 있습니다.  

```text
자동 계측                         수동 계측                      자동 계측

HTTP 요청 → Fastify Route → PostService 유스케이스 → Prisma Client → SQLite
                              │
                              ├─ 조회 전략
                              ├─ 요청·결과 개수
                              ├─ 예상 operation 수
                              └─ 오류 정보
```

이번 글에서는 다음 세 Service 메서드를 비교합니다.  

| Service 메서드 | 목적 | Prisma Client operation 수 |
| --- | --- | ---: |
| `listOptimized` | 관계와 집계를 포함한 정상 목록 조회 | 1회 |
| `listWithNPlusOne` | 게시글마다 작성자와 좋아요 수를 다시 조회 | `1 + 2N`회 |
| `getStats` | 서로 독립된 세 통계 Query를 함께 실행 | 3회 |

## 1. 자동 계측에 수동 계측 추가하기 {#session-01}

### 🟦 ch04 소스 구조

`src/ch04`는 정상 조회, N+1 조회와 통계 조회를 나누고 Service에서 각 유스케이스를 수동 Span으로 감쌉니다.  

```text
observability-basics/
├── src/
│   ├── ch04/
│   │   ├── post.controller.ts
│   │   ├── post.repository.ts
│   │   ├── post.routes.ts
│   │   ├── post.schema.ts
│   │   ├── post.service.ts
│   │   └── post.types.ts
│   ├── plugins/
│   │   └── prisma.plugin.ts
│   ├── instrumentation.ts
│   ├── route.ts
│   └── server.ts
└── tests/
    └── ch04/
        └── post.service.test.ts
```

| 파일 | 역할 |
| --- | --- |
| `src/instrumentation.ts` | HTTP, Fastify와 Prisma 자동 계측을 시작합니다. |
| `src/ch04/post.routes.ts` | 비교할 세 API Route를 등록합니다. |
| `src/ch04/post.service.ts` | 유스케이스를 수동 Span으로 감싸고 attribute와 오류를 기록합니다. |
| `src/ch04/post.repository.ts` | 비교 대상인 Prisma Client operation을 실행합니다. |
| `tests/ch04/post.service.test.ts` | 조회 전략별 Repository 호출 횟수와 결과를 검증합니다. |

### 🟦 세 API 연결

공통 `src/route.ts`는 `ch04` Route에 `/ch04` prefix를 지정합니다.  
`src/app.ts`의 `/api` prefix와 합쳐지므로 최종 URL은 `/api/ch04`로 시작합니다.  

```typescript
// src/route.ts
export function routes(fastify: FastifyInstance) {
  fastify.register(ch03PostRoutes, { prefix: '/ch03' });
  fastify.register(ch04PostRoutes, { prefix: '/ch04' });
}
```

`src/ch04/post.routes.ts`는 세 Service 메서드를 각각 다른 URL에 연결합니다.  

```typescript
const postRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // 공통 Prisma Client를 Repository에 주입하고 계층을 조립합니다.
  const postRepository = new PostRepository(fastify.prisma);
  const postService = new PostService(postRepository);
  const postController = new PostController(postService);

  // 관계와 집계를 포함한 정상 조회입니다.
  fastify.get('/', { schema: ListPostsRouteSchema }, (request, reply) =>
    postController.listOptimized(request.query, reply),
  );

  // 게시글마다 관계 Query를 반복하는 N+1 조회입니다.
  fastify.get('/n-plus-one', { schema: ListPostsWithNPlusOneRouteSchema }, (request, reply) =>
    postController.listWithNPlusOne(request.query, reply),
  );

  // 서로 독립된 세 통계 Query를 함께 실행합니다.
  fastify.get('/stats', { schema: PostStatsRouteSchema }, (_request, reply) =>
    postController.getStats(reply),
  );
};
```

| 요청 URL | Service 메서드 | 확인할 내용 |
| --- | --- | --- |
| `GET /api/ch04?limit=5` | `listOptimized` | 수동 Service Span과 하나의 Prisma operation |
| `GET /api/ch04/n-plus-one?limit=5` | `listWithNPlusOne` | 입력 크기에 따라 반복되는 Prisma operation |
| `GET /api/ch04/stats` | `getStats` | 거의 동시에 시작하는 세 Prisma operation |

## 2. 수동 Service Span과 attribute 기록 {#session-02}

### 🟦 자동 계측만으로 알기 어려운 정보

자동 Prisma Span은 `Post.findMany`가 실행된 시점과 소요 시간을 알려 줍니다.  
그러나 다음 정보는 애플리케이션만 알고 있습니다.  

- `optimized`와 `n_plus_one` 가운데 어떤 조회 전략을 선택했는지
- 사용자가 게시글을 몇 건 요청했는지
- 실제로 몇 건을 반환했는지
- Service가 몇 번의 Prisma Client operation을 실행하도록 설계되었는지

이 정보를 수동 Service Span의 attribute로 기록합니다.  
attribute는 Span에 붙이는 key-value 정보이며 Jaeger에서 같은 유스케이스의 실행 조건을 비교할 때 사용할 수 있습니다.  

### 🟦 Tracer와 활성 Span

`trace.getTracer()`로 수동 Span을 만들 Tracer를 가져옵니다.  
인수로 전달한 이름은 Service 이름을 바꾸는 값이 아니라 이 Span을 만든 계측 범위를 구분하는 이름입니다.  
Jaeger에서는 `otel.scope.name = observability-basics.posts`로 확인할 수 있습니다.  

```typescript
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

const tracer = trace.getTracer('observability-basics.posts');
```

Service 메서드에서는 `startActiveSpan()`으로 사용자 정의 Span을 시작합니다.  
새 Span을 현재 context에서 활성화하기 때문에 콜백 안에서 생성되는 Prisma 자동 Span이 Service Span의 자식으로 연결됩니다.  

```text
GET /api/ch04                          HTTP 자동 Span
└─ request                             Fastify 자동 Span
   └─ handler - postRoutes             Fastify 자동 Span
      └─ PostService.findAllOptimized
         └─ prisma:client:operation    Prisma 자동 Span
```

### 🟦 정상 조회를 Service Span으로 감싸기

`listOptimized()`는 관계 데이터와 집계를 하나의 Prisma Client operation으로 요청합니다.  
Service의 시작부터 결과 반환까지를 `PostService.findAllOptimized` Span으로 감쌉니다.  

```typescript
/** 관계와 집계를 포함한 정상 조회를 사용자 정의 Service Span으로 감쌉니다. */
async listOptimized(query: PostListQueryDto): Promise<PostListResult> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;

  return tracer.startActiveSpan('PostService.findAllOptimized', async (span) => {
    try {
      span.setAttributes({
        // Trace만 보고도 실행한 전략과 입력 조건을 알 수 있게 기록합니다.
        'app.posts.strategy': 'optimized',
        'app.posts.limit': limit,

        // Service 코드에서 실행할 Prisma Client 메서드의 예상 횟수입니다.
        'app.db.operation_count': 1,
      });

      const posts = await this.postRepository.findManyOptimized(limit);

      // 요청한 limit보다 데이터가 적을 수 있으므로 실제 결과 수도 기록합니다.
      span.setAttribute('app.posts.count', posts.length);

      return { strategy: 'optimized', posts } satisfies PostListResult;
    } catch (error) {
      recordSpanError(span, error);
      throw error;
    } finally {
      // 성공과 실패에 관계없이 Span을 끝내야 실행 시간이 확정됩니다.
      span.end();
    }
  });
}
```

각 attribute는 다음 질문에 답합니다.  

| attribute | 의미 |
| --- | --- |
| `app.posts.strategy` | 어떤 조회 전략을 실행했는지 알려 줍니다. |
| `app.posts.limit` | 사용자가 요청한 최대 게시글 수입니다. |
| `app.posts.count` | 실제로 조회한 게시글 수입니다. |
| `app.db.operation_count` | Service가 실행한 Prisma Client operation 수입니다. |

`app.db.operation_count`는 Prisma가 자동으로 계산한 값이 아닙니다.  
Service가 알고 있는 실행 규칙을 개발자가 직접 기록한 값이므로 실제 Prisma operation Span 수와 함께 확인해야 합니다.  

Repository에서는 게시글과 작성자, 좋아요 수를 하나의 `findMany()` 호출에 포함합니다.  

```typescript
/** 작성자와 좋아요 수를 하나의 Prisma Client operation에 포함해 조회합니다. */
async findManyOptimized(limit: number): Promise<PostResult[]> {
  const posts = await this.prisma.post.findMany({
    // 두 조회 전략에서 같은 게시글을 비교할 수 있도록 개수와 순서를 고정합니다.
    take: limit,
    orderBy: { id: 'asc' },
    include: {
      // 응답에 필요한 작성자 공개 필드만 선택합니다.
      author: { select: { id: true, name: true } },
      // 좋아요 행 전체 대신 관계 개수만 집계합니다.
      _count: { select: { likes: true } },
    },
  });

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt,
    author: post.author,
    likeCount: post._count.likes,
  }));
}
```

Prisma Client operation 한 번과 실제 SQL 한 번은 같은 뜻이 아닙니다.  
애플리케이션에서는 `post.findMany()`를 한 번 호출해도 Prisma가 관계를 불러오는 과정에서 여러 DB Query Span을 만들 수 있습니다.  

### 🟦 오류와 Span 종료 처리

예외를 기록하는 것과 Span을 오류 상태로 표시하는 것은 서로 다른 작업입니다.  
`recordException()`은 예외 내용을 event로 남기고, `setStatus()`는 Span이 실패했음을 표시합니다.  
오류를 기록한 뒤 다시 던져야 공통 Fastify 오류 처리 흐름도 그대로 동작합니다.  

```typescript
/** 예외 event와 실패 상태를 사용자 정의 Span에 함께 기록합니다. */
function recordSpanError(span: Span, error: unknown): void {
  const exception = error instanceof Error ? error : new Error(String(error));

  // 예외 종류, 메시지와 stack trace를 Span event로 기록합니다.
  span.recordException(exception);

  // Jaeger에서 실패한 Span으로 구분할 수 있도록 상태를 설정합니다.
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: exception.message,
  });
}
```

`span.end()`는 `finally`에서 호출합니다.  
이렇게 하면 성공과 실패 모두 Span을 종료하며 시작부터 종료까지의 시간이 확정됩니다.  

서버를 실행하고 정상 조회 Trace를 만듭니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm run dev
```

```bash
curl "http://localhost:3000/api/ch04?limit=20"
```

![정상 조회 GET /api/ch04 Trace](/assets/images/nodejs/nodejs-observability/04-api-posts.png)

**실무 해석:** 요청·결과가 20건이어도 `app.db.operation_count=1`이므로 Service의 Prisma 호출 횟수는 일정합니다.  
하위 `db_query`가 두 개여도 하나의 Prisma operation 안에서 관계를 조회한 것이므로 N+1로 판단하지 않습니다.  

**확인할 점:** 이 Trace를 정상 기준으로 삼고 같은 `limit`에서 Service와 `db_query` 시간이 증가하는지 비교합니다.  
operation 수는 그대로인데 DB 시간이 길어진다면 실행 계획이나 인덱스를 먼저 확인합니다.  

## 3. 정상 조회와 N+1 Query 비교 {#session-03}

### 🟦 같은 응답, 다른 내부 실행

정상 조회와 N+1 조회는 같은 형태의 게시글 목록을 반환합니다.  
응답만 확인하면 두 구현의 차이를 알기 어렵지만 Trace에서는 Prisma operation의 개수와 실행 순서가 다르게 나타납니다.  

```text
정상 조회

PostService.findAllOptimized
└─ Post.findMany                         1회


N+1 조회

PostService.findAllWithNPlusOne
├─ Post.findMany                         1회
├─ User.findUniqueOrThrow                N회
└─ PostLike.count                        N회
```

이 예제는 게시글 목록을 한 번 가져온 뒤 각 게시글의 작성자와 좋아요 수를 따로 조회합니다.  
게시글이 N건이면 전체 Prisma Client operation 수는 `1 + 2N`회입니다.  

| 게시글 수 | 목록 조회 | 작성자 조회 | 좋아요 수 조회 | 전체 operation |
| ---: | ---: | ---: | ---: | ---: |
| 1건 | 1회 | 1회 | 1회 | 3회 |
| 5건 | 1회 | 5회 | 5회 | 11회 |
| 20건 | 1회 | 20회 | 20회 | 41회 |

### 🟦 반복 Query 만들기

Repository는 게시글 목록, 작성자와 좋아요 수를 각각 조회하는 메서드를 제공합니다.  

```typescript
/** 관계 데이터를 제외한 게시글 목록만 조회합니다. */
findMany(limit: number) {
  return this.prisma.post.findMany({
    take: limit,
    orderBy: { id: 'asc' },
  });
}

/** 반복마다 게시글 작성자 한 명을 별도로 조회합니다. */
findAuthor(authorId: number) {
  return this.prisma.user.findUniqueOrThrow({
    where: { id: authorId },
    select: { id: true, name: true },
  });
}

/** 반복마다 게시글 한 건의 좋아요 수를 별도로 집계합니다. */
countLikes(postId: number): Promise<number> {
  return this.prisma.postLike.count({
    where: { postId },
  });
}
```

Service는 게시글을 순회하면서 두 Query가 끝날 때까지 하나씩 기다립니다.  
의도적으로 순차 실행하므로 Trace에서는 Prisma operation Span이 시간순으로 이어집니다.  

```typescript
async listWithNPlusOne(query: PostListQueryDto): Promise<PostListResult> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;

  return tracer.startActiveSpan('PostService.findAllWithNPlusOne', async (span) => {
    try {
      span.setAttributes({
        'app.posts.strategy': 'n_plus_one',
        'app.posts.limit': limit,
      });

      const posts = await this.postRepository.findMany(limit);
      const result: PostResult[] = [];

      // 게시글마다 두 Query를 순차 실행해 반복과 누적 지연을 관찰합니다.
      for (const post of posts) {
        const author = await this.postRepository.findAuthor(post.authorId);
        const likeCount = await this.postRepository.countLikes(post.id);

        result.push({
          id: post.id,
          title: post.title,
          content: post.content,
          createdAt: post.createdAt,
          author,
          likeCount,
        });
      }

      span.setAttributes({
        'app.posts.count': posts.length,
        // 목록 조회 1회와 게시글마다 반복한 두 operation을 합산합니다.
        'app.db.operation_count': 1 + posts.length * 2,
      });

      return { strategy: 'n_plus_one', posts: result } satisfies PostListResult;
    } catch (error) {
      recordSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### 🟦 같은 조건으로 Trace 비교

두 API를 같은 `limit`으로 호출합니다.  

```bash
curl "http://localhost:3000/api/ch04?limit=5"
curl "http://localhost:3000/api/ch04/n-plus-one?limit=5"
```

![N+1 조회 GET /api/ch04/n-plus-one Trace](/assets/images/nodejs/nodejs-observability/04-api-posts-nplusone.png)

**실무 해석:** 게시글 5건에 operation이 11회이고 타임라인에도 짧은 DB 작업이 순차적으로 반복됩니다.  
결과 건수와 함께 operation 수가 `1 + 2N`으로 증가하는 전형적인 N+1 신호입니다.  

**확인할 점:** `limit`을 늘려 operation 수와 Service 시간이 함께 증가하는지 비교합니다.  
실제 서비스에서는 반복 조회를 `include`, 집계 또는 일괄 조회로 합칠 수 있는지 검토합니다.  

Jaeger에서는 다음 항목을 순서대로 비교합니다.  

1. `app.posts.strategy`로 실행한 조회 전략을 구분합니다.  
2. `app.posts.count`와 `app.posts.limit`으로 두 요청의 입력과 결과 조건이 같은지 확인합니다.  
3. `app.db.operation_count`와 실제 `prisma:client:operation` Span 수를 비교합니다.  
4. Prisma operation이 한 구간에 모이는지 시간순으로 반복되는지 확인합니다.  
5. Service Span에서 Prisma Span을 제외한 나머지 시간이 큰지도 확인합니다.  

| 비교 항목 | 정상 조회 | N+1 조회 |
| --- | --- | --- |
| 조회 전략 | `optimized` | `n_plus_one` |
| 게시글 5건의 operation 수 | 1회 | 11회 |
| 게시글 20건의 operation 수 | 1회 | 41회 |
| Prisma Span 모양 | 하나의 operation 아래에 DB 작업이 연결됩니다. | 짧은 operation이 순차적으로 반복됩니다. |
| 입력 크기가 커질 때 | Client operation 수가 일정합니다. | Client operation 수가 함께 증가합니다. |

Prisma operation 안에는 `serialize`, `compile`, `db_query` 같은 하위 Span이 생길 수 있습니다.  
따라서 Jaeger에 보이는 전체 Span 수는 `app.db.operation_count`보다 많을 수 있습니다.  
비교할 때는 전체 Span 수보다 `prisma:client:operation`의 수와 각 operation의 model, method를 기준으로 확인하는 편이 정확합니다.  

한 번 측정한 응답 시간만으로 두 구현의 성능을 단정해서는 안 됩니다.  
첫 요청의 초기화 비용과 실행 시점의 시스템 상태가 영향을 줄 수 있으므로 두 API를 먼저 워밍업하고 같은 조건으로 여러 번 비교합니다.  
로컬 SQLite에서는 Query 시간이 매우 짧지만 원격 DB에서는 반복할 때마다 네트워크 왕복 시간이 추가될 수 있습니다.  

### 🟦 테스트로 호출 횟수 검증

Trace는 실제 실행 순서와 시간을 보여 주고, 단위 테스트는 코드가 의도한 호출 횟수를 검증합니다.  

```typescript
it('최적화 조회는 관계와 집계를 한 번의 Prisma operation으로 요청한다', async () => {
  await service.listOptimized({ limit: 20 });

  expect(findMany).toHaveBeenCalledOnce();
});

it('N+1 조회는 게시글마다 작성자와 좋아요 수를 다시 조회한다', async () => {
  await service.listWithNPlusOne({ limit: 20 });

  // 테스트의 모의 게시글이 2건이므로 두 관계 메서드도 각각 두 번 호출됩니다.
  expect(findMany).toHaveBeenCalledOnce();
  expect(findUniqueOrThrow).toHaveBeenCalledTimes(2);
  expect(count).toHaveBeenCalledTimes(2);
});
```

테스트와 Trace의 역할은 서로 다릅니다.  
테스트는 호출 횟수가 코드의 의도와 맞는지 빠르게 확인하고, Trace는 실제 요청에서 operation의 부모·자식 관계와 시간 분포를 보여 줍니다.  

## 4. 여러 Query의 실행 흐름과 N+1 구분 {#session-04}

### 🟦 Query가 여러 개면 모두 N+1일까

하나의 요청에서 Query를 여러 번 실행한다고 해서 모두 N+1 문제는 아닙니다.  
입력 크기에 따라 같은 Query가 반복되는지, 필요한 서로 다른 Query를 정해진 횟수만큼 실행하는지를 구분해야 합니다.  

`getStats()`는 다음 세 값을 계산합니다.  

```text
GET /api/ch04/stats
└─ PostService.getStats
   ├─ Post.count             전체 게시글 수
   ├─ PostLike.count         전체 좋아요 수
   └─ Post.findMany          최근 게시글 다섯 건
```

세 Query는 서로의 결과에 의존하지 않으므로 `Promise.all()`로 함께 시작하고 모든 결과를 기다립니다.  

```typescript
/** 서로 독립된 세 operation을 하나의 Service Span 아래에서 함께 실행합니다. */
async getStats(): Promise<PostStatsResult> {
  return tracer.startActiveSpan('PostService.getStats', async (span) => {
    try {
      const [totalPosts, totalLikes, recentPosts] = await Promise.all([
        this.postRepository.countPosts(),
        this.postRepository.countAllLikes(),
        this.postRepository.findRecent(),
      ]);

      span.setAttributes({
        'app.posts.count': totalPosts,
        'app.likes.count': totalLikes,
        'app.db.operation_count': 3,
      });

      return { totalPosts, totalLikes, recentPosts };
    } catch (error) {
      recordSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

통계 API를 호출해 Trace를 만듭니다.  

```bash
curl "http://localhost:3000/api/ch04/stats"
```

![통계 조회 GET /api/ch04/stats Trace](/assets/images/nodejs/nodejs-observability/04-api-posts-stats.png)

### 🟦 겹치는 Span 해석

**실무 해석:** 데이터 건수와 관계없이 operation 수가 3회로 고정되고 세 막대가 겹쳐 있으므로 N+1이 아니라 독립된 통계 작업을 함께 시작한 흐름입니다.  

**확인할 점:** 응답이 느리다면 세 operation 중 가장 오래 걸린 Span부터 확인합니다.  
막대가 겹쳐도 DB의 물리적 병렬 실행을 보장하지 않으므로 운영 환경에서는 연결 풀 대기와 DB 부하도 함께 살펴봅니다.  

### 🟦 N+1과 고정된 복수 Query 비교

`getStats`와 `listWithNPlusOne`은 모두 여러 Prisma operation을 만들지만 실행 목적과 증가 방식이 다릅니다.  

| 비교 항목 | `getStats` | `listWithNPlusOne` |
| --- | --- | --- |
| Query 목적 | 서로 다른 통계 세 가지를 계산합니다. | 게시글마다 같은 관계 데이터를 조회합니다. |
| operation 수 | 항상 3회입니다. | `1 + 2N`회입니다. |
| 입력 크기의 영향 | 게시글 수와 관계없이 operation 수가 일정합니다. | 게시글 수에 따라 operation 수도 증가합니다. |
| 실행 형태 | 세 작업을 함께 시작하고 결과를 기다립니다. | 반복 안에서 두 작업을 순차적으로 기다립니다. |
| Trace 모양 | 세 operation의 막대가 겹쳐 보일 수 있습니다. | 짧은 operation이 시간순으로 이어집니다. |

`Query가 많다`는 사실만으로 문제라고 판단해서는 안 됩니다.  
각 Query가 응답에 필요한지, 입력 크기에 따라 반복되는지, 순차 대기로 전체 시간이 늘어나는지를 함께 살펴봐야 합니다.  

### 🟦 수동 계측으로 확인하는 분석 순서

자동 Span과 수동 Span을 함께 볼 때는 바깥쪽부터 안쪽으로 범위를 좁힙니다.  

1. HTTP Span에서 상태 코드와 전체 요청 시간을 확인합니다.  
2. Fastify handler Span에서 Route 처리 범위를 확인합니다.  
3. 수동 Service Span의 이름과 `app.*` attribute로 유스케이스와 실행 조건을 확인합니다.  
4. Service Span 아래의 Prisma operation 수와 model, method를 확인합니다.  
5. 각 operation 아래의 DB Query 수와 실행 시간을 확인합니다.  
6. 오류가 있다면 Service Span의 status와 exception event를 확인합니다.  

자동 계측은 프레임워크와 라이브러리가 수행한 작업을 보여 줍니다.  
수동 계측은 그 작업이 어떤 유스케이스에 속하고 어떤 조건으로 실행되었는지 설명합니다.  
두 방식을 함께 사용하면 단순히 느린 Query를 찾는 데서 그치지 않고, 어떤 조회 전략과 애플리케이션 판단이 그 실행 흐름을 만들었는지까지 추적할 수 있습니다.  
