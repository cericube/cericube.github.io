---
layout: post
title: "01. Observability 개념 이해"
description: "Observability의 개념과 Monitoring과의 차이를 살펴봅니다. Logs, Metrics, Traces가 각각 어떤 정보를 제공하는지 이해하고, Fastify와 Prisma로 구성된 API에서 장애 감지와 원인 추적이 어떻게 다른지 알아봅니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. Observability란 무엇인가"
  - id: session-02
    title: "2. Monitoring과 Observability의 차이"
  - id: session-03
    title: "3. Logs, Metrics, Traces의 역할"
  - id: session-04
    title: "4. 장애 감지와 원인 추적의 차이"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. Observability란 무엇인가 {#session-01}

웹 서비스를 운영하다 보면 개발 환경에서는 발견하지 못했던 문제가 발생합니다.  
예를 들어 Fastify로 API를 만들고 Prisma를 통해 데이터베이스를 사용한다고 가정합니다.  
처음에는 모든 API가 정상적으로 동작합니다.  
하지만 서비스가 운영되면서 어느 순간 사용자가 다음과 같은 문제를 제보할 수 있습니다.

```text
"게시글 목록이 가끔 너무 늦게 조회됩니다."
```

개발자는 먼저 로컬에서 API를 직접 호출해 봅니다.

```bash
curl -i http://localhost:3000/api/posts
```

응답 헤더에는 정상 상태 코드가 표시됩니다.

```text
HTTP/1.1 200 OK
```

여기서 중요한 문제가 생깁니다.  
**정상적으로 응답했다는 사실과 시스템이 정상적인 상태라는 것은 같은 의미가 아닙니다.**  
응답 시간이 평소 100ms였는데 현재 3초가 걸리고 있을 수도 있습니다.  
특정 사용자에게만 문제가 발생할 수도 있고, 특정 DB 쿼리에서만 지연이 발생할 수도 있습니다.  
따라서 운영 중인 시스템에서는 단순히 요청의 성공과 실패만 확인해서는 부족합니다.  

### 🟦 시스템 내부에서는 여러 작업이 실행된다

사용자가 보는 것은 하나의 HTTP 요청이지만 서버 내부에서는 여러 작업이 연결되어 실행됩니다.  

![API 요청의 내부 처리 구조](/assets/images/nodejs/nodejs-observability/01-api-request-flow.png)

예시 프로젝트에서는 요청이 Fastify Route를 통해 들어오고 Service와 Repository를 거쳐 Prisma가 데이터베이스에 접근합니다.  
게시글을 조회하는 경우 `Post`는 작성자인 `User`, 좋아요인 `PostLike`, 첨부파일인 `PostAttachment`와 연결되어 있습니다.

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  authorId Int  @map("author_id")
  author   User @relation(
    fields: [authorId],
    references: [id],
    onDelete: Cascade
  )

  likes       PostLike[]
  attachments PostAttachment[]

  @@index([authorId])
  @@map("posts")
}
```

따라서 게시글 목록 API 하나를 처리하는 과정에서도 여러 DB 쿼리와 내부 로직이 실행될 수 있습니다.  
만약 API 응답 시간이 2초라면 다음과 같은 질문이 필요합니다.  

```text
- Fastify 처리 시간이 긴 것인가?
- Service의 비즈니스 로직이 느린 것인가?
- Prisma 쿼리가 느린 것인가?
- DB에 문제가 있는 것인가?
- 특정 쿼리가 반복해서 실행되고 있는 것인가?
```

HTTP 상태 코드만으로는 이러한 질문에 답할 수 없습니다.

### 🟦 Observability의 목적

Observability는 서비스에 문제가 생겼을 때 Logs, Metrics, Traces 같은 정보를 통해 시스템 내부에서 무슨 일이 일어나고 있는지 파악할 수 있는 능력​을 의미합니다.  
대표적으로 다음 세 가지 신호를 사용합니다.  

- `Logs` - 어떤 일이 발생했는지 기록합니다.
- `Metrics` - 시스템 상태가 시간에 따라 어떻게 변하는지 측정합니다.
- `Traces` - 하나의 요청이 어떤 경로를 거쳐 처리되는지 추적합니다.

예를 들어 `/api/posts`의 응답이 느려졌다면 Metrics에서 응답 시간 증가를 발견하고, Trace에서 느린 처리 구간을 찾은 뒤, Log에서 해당 요청의 구체적인 상황을 확인할 수 있습니다.  
즉 Observability의 목적은 단순히 데이터를 많이 저장하는 것이 아닙니다.  
**문제가 발생했을 때 시스템 내부 상태를 설명할 수 있도록 충분한 정보를 확보하는 것**이 핵심입니다.  

---

## 2. Monitoring과 Observability의 차이 {#session-02}

Monitoring과 Observability는 함께 사용되지만 관점에는 차이가 있습니다.  
Monitoring은 주로 **미리 정의한 상태를 지속적으로 측정하고 이상 여부를 확인하는 것**에 초점을 둡니다.  
예를 들어 다음 항목을 모니터링할 수 있습니다.

```text
CPU 사용률
Memory 사용률
API 요청 수
HTTP 5xx 비율
API 평균 응답 시간
DB Connection 수
```

Grafana와 같은 도구의 대시보드에서는 다음과 같은 상태를 확인할 수 있습니다.  

```text
Request Rate       1,250 req/min
Error Rate         0.2%
p95 Latency        180ms
CPU                43%
Memory              61%
```

이러한 데이터는 서비스가 정상적인 범위에서 동작하는지 판단하는 데 유용합니다.  

### 🟦 Monitoring은 문제를 감지한다

운영자가 다음과 같은 기준을 정했다고 가정합니다.  

```text
5xx Error Rate > 5%
```

실제 오류율이 `7.3%`까지 증가하면 Alert를 발생시킬 수 있습니다.  
Monitoring은 이처럼 미리 측정할 항목과 기준을 정의하고 시스템이 해당 조건을 벗어나는지 지속적으로 확인하는 데 적합합니다.  
하지만 Alert가 발생하면 새로운 질문이 생깁니다.  

```text
왜 오류율이 증가했는가?
```

오류율이라는 숫자만으로는 원인을 알기 어렵습니다.  

### 🟦 Observability는 원인을 탐색한다

Monitoring과 Observability의 차이는 다음 그림처럼 생각할 수 있습니다.  

![Monitoring과 Observability의 차이](/assets/images/nodejs/nodejs-observability/01-monitoring-vs-observability.png)  

예를 들어 `POST /api/posts`의 오류율이 갑자기 증가했다고 가정합니다.  

```text
Error Rate
0.2% → 8.7%
```

Monitoring을 통해 문제가 발생했다는 사실은 발견했습니다.  
하지만 원인을 찾으려면 추가적인 질문이 필요합니다.  

```text
- 어떤 요청에서 오류가 발생했는가?
- 모든 사용자의 요청에서 발생하는가?
- 특정 API에서만 발생하는가?
- DB 쿼리에서 실패했는가?
- 외부 시스템 호출에서 실패했는가?
- 어떤 입력에서 오류가 발생했는가?
```

Observability는 이러한 질문을 탐색할 수 있도록 시스템에서 충분한 정보를 수집하고 연결합니다.  
개념적으로 다음과 같이 구분할 수 있습니다.  

| 구분 | Monitoring | Observability |
| --- | --- | --- |
| 주요 목적 | 상태 확인과 이상 감지 | 내부 상태 이해와 원인 분석 |
| 대표 질문 | 문제가 발생했는가? | 왜 문제가 발생했는가? |
| 접근 방식 | 미리 정의한 지표와 조건 확인 | 여러 신호를 이용한 탐색 |
| 대표 데이터 | Metrics, Alert | Logs, Metrics, Traces |
| 사용 예 | Error Rate가 5%를 넘었는가? | 어떤 요청의 어느 구간에서 오류가 발생했는가? |

둘 중 하나를 선택하는 관계는 아닙니다.  
실제 운영에서는 **Monitoring으로 이상 징후를 발견하고 Observability 데이터를 이용하여 원인을 추적**하는 경우가 많습니다.

---

## 3. Logs, Metrics, Traces의 역할 {#session-03}

Observability를 구성하는 대표적인 신호는 Logs, Metrics, Traces입니다.  
세 신호는 같은 시스템을 서로 다른 관점에서 보여줍니다.  

![Observability의 Logs Metrics Traces](/assets/images/nodejs/nodejs-observability/01-observability-signals.png)  

간단하게 구분하면 다음과 같습니다.  

| Signal | 역할 | 대표 질문 |
| --- | --- | --- |
| `Logs` | 개별 사건의 상세 정보 | 무슨 일이 발생했는가? |
| `Metrics` | 시간에 따른 수치 변화 | 얼마나 많이, 얼마나 자주 발생하는가? |
| `Traces` | 하나의 요청이 지나간 경로 | 어느 구간에서 문제가 발생했는가? |

각각의 역할을 Fastify API를 기준으로 살펴보겠습니다.

### 🟦 Logs - 어떤 일이 발생했는가

Log는 특정 시점에 발생한 사건을 기록합니다.  
Fastify는 기본 Logger로 Pino를 사용할 수 있습니다.  
API 요청이 들어오면 다음과 같은 정보를 남길 수 있습니다.  

```json
{
  "level": 30,
  "time": 1789707600000,
  "reqId": "req-10",
  "method": "GET",
  "url": "/api/posts",
  "msg": "incoming request"
}
```

DB 처리 중 문제가 발생하면 다음과 같은 Log를 남길 수도 있습니다.

```json
{
  "level": 50,
  "reqId": "req-10",
  "error": "Database query failed",
  "msg": "게시글 조회 실패"
}
```

Log의 장점은 구체적인 상황을 기록할 수 있다는 것입니다.  
어떤 API에서 어떤 오류가 발생했는지, 어느 요청과 관련되어 있는지와 같은 상세한 정보를 확인할 수 있습니다.  
반면 Log만 가지고 서비스 전체 상태를 파악하기는 어렵습니다.  
예를 들어 수백만 건의 Log가 있을 때 다음 질문에 바로 답하기는 어렵습니다.  

```text
- 지난 30분 동안 API 오류율은 몇 %인가?
- p95 응답 시간은 어떻게 변했는가?
- 분당 요청 수가 증가했는가?
```

이러한 질문에는 Metrics가 더 적합합니다.

### 🟦 Metrics - 시스템 상태가 어떻게 변하고 있는가

Metrics는 시스템 상태를 숫자로 표현하고 시간에 따른 변화를 관찰합니다.  
API 서버에서는 대표적으로 다음과 같은 값을 측정할 수 있습니다.  

```text
Request Count
Error Count
Error Rate
Response Time
CPU Usage
Memory Usage
```

예를 들어 요청 수를 시간별로 기록하면 다음과 같은 형태가 됩니다.

```text
14:00    1,020 requests
14:01    1,130 requests
14:02    1,280 requests
14:03    1,950 requests
```

응답 시간 역시 Metrics로 수집할 수 있습니다.

```text
p50    80ms
p95   320ms
p99  1.8s
```

`p50`, `p95`, `p99`는 응답 시간의 **백분위수(percentile)**입니다.  
각 값은 **응답 시간을 빠른 순서대로 정렬했을 때, 전체 요청 중 몇 %가 그 시간 이내에 끝났는지** 알려줍니다.  
요청 100개를 정렬한 아래 그림에서 색 칸 하나는 요청 한 건입니다.

![응답 시간순으로 정렬한 100개 API 요청: p50은 앞의 50개, p95는 앞의 95개, p99는 앞의 99개를 포함](/assets/images/nodejs/nodejs-observability/observability-latency-percentiles.svg)

- **p50 = 80ms:** 파란색 50칸, 즉 요청의 약 50%가 80ms 이내에 끝납니다. p50은 중앙값입니다.
- **p95 = 320ms:** 파란색과 초록색을 합친 95칸, 즉 요청의 약 95%가 320ms 이내에 끝납니다.
- **p99 = 1.8s:** 여기에 주황색까지 합친 99칸, 즉 요청의 약 99%가 1.8초 이내에 끝납니다. 빨간색 마지막 1칸은 1.8초보다 오래 걸립니다.

**p95의 95%에는 p50의 50%도 포함됩니다.** 이 값들은 느린 요청들의 평균이 아닙니다.  
p50으로 일반적인 응답 시간을 보고, p95와 p99로 일부 요청의 지연과 매우 느린 꼬리 구간(tail latency)을 확인할 수 있습니다.  
평균 응답 시간만 보면 소수의 매우 느린 요청을 놓칠 수 있습니다.

예를 들어 p95 Latency가 평소 `200ms` 수준이었다가 `2.1s`까지 증가했다면 느린 쪽 요청의 응답 시간이 크게 늘었다는 사실을 발견할 수 있습니다.  
하지만 Metrics는 다음 질문에는 답하기 어렵습니다.  

```text
2.1초가 걸린 요청에서는 정확히 어느 코드가 느렸는가?
```

이때 Trace가 필요합니다.

### 🟦 Traces - 요청이 어디에서 시간을 사용했는가

Trace는 하나의 요청이 시스템 내부를 통과하는 과정을 추적합니다.  
예를 들어 `GET /api/posts` 요청의 전체 응답 시간이 850ms라고 가정합니다.  
Trace를 이용하면 시간을 다음처럼 구간별로 나누어 확인할 수 있습니다.  

```text
GET /api/posts                         850ms
│
├── authenticate                       10ms
│
├── PostService.findAll               820ms
│    │
│    ├── prisma.post.findMany         120ms
│    ├── prisma.user.findMany          80ms
│    └── prisma.postLike.findMany     600ms
│
└── response serialization             20ms
```

단순히

```text
"API가 850ms 걸렸다."
```

에서 끝나는 것이 아니라,

```text
"850ms 중 약 600ms가
좋아요 정보를 조회하는 구간에서 사용됐다."
```

까지 범위를 좁힐 수 있습니다.  
하나의 요청에 대한 전체 실행 흐름을 `Trace`, 그 안의 각 작업 구간을 `Span`이라고 합니다.  

```text
Trace: GET /api/posts                 ← 요청 전체의 실행 흐름
│
├── Span: authenticate                ← 하나의 작업  
├── Span: PostService.findAll         ← 하나의 작업 
├── Span: prisma.post.findMany        ← 하나의 작업
└── Span: prisma.postLike.findMany    ← 하나의 작업 
```

**Trace**: 하나의 요청이 시작해서 끝날 때까지 전체 처리 과정을 추적한 기록입니다.  
**Span**: Trace 안에서 수행되는 개별 작업 단위입니다. 각 Span에는 시작/종료 시간, 실행 시간, 성공/실패 여부 등의 정보를 기록할 수 있습니다.  

Trace와 Span은 이후 OpenTelemetry와 Jaeger를 사용할 때 핵심 개념이 됩니다.

### 🟦 세 신호는 서로 연결해서 사용한다

Logs, Metrics, Traces 중 하나만 선택하는 것은 아닙니다.  
각각 다른 질문에 적합하며 서로 연결했을 때 더 많은 정보를 얻을 수 있습니다.  

```text
Metrics
"응답 시간이 증가했다."

Trace
"느린 요청의 Prisma 구간에서 대부분의 시간이 사용됐다."

Logs
"해당 요청에서 어떤 상황과 오류가 발생했는지 확인한다."
```

실제 분석 순서가 항상 고정되는 것은 아닙니다.  
Log에서 문제를 먼저 발견할 수도 있고 Trace에서 이상 요청을 먼저 발견할 수도 있습니다.  
중요한 것은 **각 신호가 서로 다른 관점의 정보를 제공하며 서로 연결할수록 시스템 내부 상태를 더 정확하게 이해할 수 있다는 점**입니다.  

---

## 4. 장애 감지와 원인 추적의 차이 {#session-04}

Observability를 이해할 때 중요한 구분 중 하나는 **장애를 발견하는 것과 장애의 원인을 찾는 것은 다른 문제**라는 점입니다.  
게시글 API의 평상시 응답 시간이 다음과 같다고 가정합니다.  

```text
정상 상태

GET /api/posts

p50   70ms
p95  180ms
p99  350ms
```

어느 순간 다음과 같이 변했습니다.

```text
장애 발생

GET /api/posts

p50    90ms
p95  1.8s
p99  4.2s
```

이 데이터만으로도 문제가 있다는 사실은 알 수 있습니다.

```text
p95 Latency
180ms → 1.8s
```

하지만 아직 원인은 모릅니다.

### 🟦 첫 번째 단계 - Metrics로 이상 감지

먼저 Metrics에서 응답 시간 증가를 확인합니다.

```text
Request Rate    정상
Error Rate      정상
CPU             정상
Memory          정상
p95 Latency     비정상 ↑
```

여기서 알 수 있는 것은 서비스가 완전히 실패하고 있지는 않지만 일부 요청의 응답 시간이 크게 증가했다는 사실입니다.  
이 단계에서는 **문제를 발견했지만 원인을 찾지는 못했습니다.**  

### 🟦 두 번째 단계 - Trace로 느린 요청 확인

다음으로 느린 요청의 Trace를 확인합니다.

```text
GET /api/posts                        1.82s
│
├── Fastify                           20ms
│
└── PostService.findAll              1.78s
     │
     ├── prisma.post.findMany        120ms
     └── 좋아요 조회                 1.61s
```

이제 문제 범위를 좁힐 수 있습니다.  
Fastify 자체나 게시글 기본 조회보다 좋아요 데이터를 조회하는 구간에서 대부분의 시간이 사용되고 있다는 사실을 알 수 있습니다.  

### 🟦 세 번째 단계 - 반복 쿼리 문제 확인

현재 DB에는 게시글과 좋아요의 다대다 관계를 표현하는 `PostLike`가 있습니다.

```prisma
model PostLike {
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(
    fields: [userId],
    references: [id],
    onDelete: Cascade
  )

  post Post @relation(
    fields: [postId],
    references: [id],
    onDelete: Cascade
  )

  @@id([userId, postId])
  @@index([postId])
  @@map("post_likes")
}
```

구현을 잘못하여 게시글마다 좋아요를 별도로 조회한다고 가정합니다.

```text
게시글 목록 조회
│
├── SELECT posts ...
│
├── SELECT post_likes WHERE post_id = 1
├── SELECT post_likes WHERE post_id = 2
├── SELECT post_likes WHERE post_id = 3
├── SELECT post_likes WHERE post_id = 4
│
...
└── SELECT post_likes WHERE post_id = 100
```

게시글이 늘어날수록 쿼리 수도 증가합니다.

```text
게시글 10개
→ 11 Queries

게시글 100개
→ 101 Queries

게시글 1,000개
→ 1,001 Queries
```

대표적인 N+1 형태의 문제입니다.  
API 상태 코드만 확인했다면 모든 요청은 여전히 `200 OK`로 보일 수 있습니다.  
그러나 실제 시스템 내부에서는 심각한 성능 문제가 발생하고 있습니다.  
Observability가 필요한 이유가 여기에 있습니다.  

### 🟦 네 번째 단계 - Log로 구체적인 상황 확인

Trace ID를 Log에 함께 기록하면 특정 Trace와 관련된 Log를 찾을 수 있습니다.

```json
{
  "level": 30,
  "traceId": "4fd0a93b...",
  "method": "GET",
  "url": "/api/posts",
  "msg": "게시글 목록 조회 시작"
}
```

같은 `traceId`를 이용하면 하나의 요청에 대한 Trace와 Log를 연결할 수 있습니다.

```text
Trace: 4fd0a93b...
        │
        └── Log: traceId=4fd0a93b...
```

이를 이용하면 문제를 발견하는 단계에서 실제 원인을 분석하는 단계까지 이어갈 수 있습니다.  

![Metrics Trace Logs 장애 분석 흐름](/assets/images/nodejs/nodejs-observability/01-troubleshooting-flow.png)  

이 흐름을 세 단계로 기억하면 이해하기 쉽습니다.  

```text
Detect
  ↓
Metrics
문제를 발견한다.

Locate
  ↓
Trace
문제가 발생한 요청과 구간을 좁힌다.

Explain
  ↓
Logs
해당 시점의 구체적인 상황을 확인한다.
```

즉 하나의 장애를 서로 다른 관점에서 점점 좁혀가며 분석합니다.

### 🟦 Observability의 핵심은 도구가 아니라 질문이다

Observability를 처음 접하면 많은 도구 이름을 만나게 됩니다.

```text
OpenTelemetry
Jaeger
Prometheus
Grafana
Loki
Tempo
```

하지만 도구부터 외우기 시작하면 각각의 역할을 이해하기 어렵습니다.  
먼저 다음 질문을 구분하는 것이 중요합니다.

```text
1. 지금 서비스에 문제가 있는가?
2. 언제부터 문제가 발생했는가?
3. 어떤 API에서 문제가 발생했는가?
4. 특정 요청의 어느 구간이 느린가?
5. 그 구간에서는 실제로 어떤 일이 발생했는가?
```

그리고 질문에 따라 Metrics, Traces, Logs를 사용합니다.  
**Metrics는 시스템 전체를 넓게 보고, Trace는 특정 요청으로 범위를 좁히며, Log는 해당 요청에서 발생한 구체적인 상황을 확인하는 데 사용합니다.**  
따라서 Observability를 단순히 로그를 많이 남기거나 모니터링 도구를 설치하는 것으로 이해해서는 안 됩니다.  
핵심은 **운영 중 발생한 문제에 대해 시스템이 충분한 답을 제공할 수 있도록 만드는 것**입니다.  
