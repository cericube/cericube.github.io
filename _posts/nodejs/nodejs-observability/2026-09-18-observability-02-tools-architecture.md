---
layout: post
title: "02. Observability 도구 구조의 이해"
description: "Fastify에서 생성한 Logs, Metrics, Traces가 OpenTelemetry를 거쳐 각 Backend에 저장되고 Jaeger와 Grafana에서 분석되는 흐름을 살펴봅니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. Observability 데이터의 흐름"
  - id: session-02
    title: "2. 데이터를 수집하고 전달하는 OpenTelemetry"
  - id: session-03
    title: "3. 데이터를 저장하는 Prometheus, Loki, Tempo"
  - id: session-04
    title: "4. 데이터를 분석하는 Jaeger와 Grafana"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

## 1. Observability 데이터의 흐름 {#session-01}

Observability를 구성하려면 애플리케이션에서 발생하는 **Logs, Metrics, Traces를 수집하고 저장한 뒤 조회할 수 있는 구조**가 필요합니다.  
예를 들어 게시글 목록 API에 문제가 발생했다고 가정해 보겠습니다.  

```text
사용자 ── GET /api/posts ──→ Fastify
                              │
                              ├─ 요청 수와 응답 시간 → Metrics
                              ├─ 요청의 처리 과정   → Traces
                              └─ 오류와 사건        → Logs
```

문제의 원인을 파악하려면 요청이 얼마나 발생했는지, 어느 작업이 오래 걸렸는지, 어떤 오류가 발생했는지 확인해야 합니다.  
하지만 Fastify에서 이러한 데이터를 기록하는 것만으로는 충분하지 않습니다.  
데이터를 외부로 전달하고 저장해야 나중에 조회하고 분석할 수 있습니다.  

전체 과정은 다음과 같이 구분할 수 있습니다.  

```text
생성 → 수집·전달 → 저장·조회 → 분석·시각화
```

![Fastify에서 Observability Backend와 분석 도구로 이어지는 데이터 흐름](/assets/images/nodejs/nodejs-observability/02-observability-flow.png)

그림은 Fastify에서 생성한 Telemetry가 OpenTelemetry를 거쳐 신호별 Backend에 저장되고, Jaeger와 Grafana에서 분석되는 흐름을 보여 줍니다.  

각 단계에서 사용하는 대표적인 도구는 다음과 같습니다.  

| 단계 | 도구 | 주요 역할 |
| --- | --- | --- |
| 생성·수집 | OpenTelemetry SDK | 애플리케이션을 계측하고 Telemetry 생성 |
| 처리·전달 | OpenTelemetry Collector | 여러 곳에서 받은 데이터를 처리하여 Backend로 전달 |
| 저장·조회 | Prometheus, Loki, Tempo | Metrics, Logs, Traces를 각각 저장하고 조회 |
| 분석·시각화 | Jaeger, Grafana | 요청 흐름을 분석하거나 여러 데이터를 화면에 표시 |

각 도구가 하나의 역할만 담당하는 것은 아닙니다.  
예를 들어 Jaeger는 Trace를 저장하는 동시에 검색하고 시각화하는 기능도 제공합니다.  
따라서 기능을 엄격하게 나누기보다 **전체 데이터 흐름에서 주로 어떤 역할을 담당하는지** 이해하는 것이 중요합니다.  

## 2. 데이터를 수집하고 전달하는 OpenTelemetry {#session-02}

**OpenTelemetry**는 Logs, Metrics, Traces와 같은 Telemetry 데이터를 생성하고 수집하여 외부 시스템으로 전달하기 위한 표준과 도구 모음입니다.  
데이터를 장기간 보관하는 저장 시스템은 아닙니다.  

### 🟦 SDK는 애플리케이션에서 무엇을 할까

Fastify에 **OpenTelemetry SDK**를 적용하면 애플리케이션 내부의 작업을 계측할 수 있습니다.  
예를 들어 하나의 요청이 다음 작업을 거친다고 가정해 보겠습니다.  

```text
GET /api/posts
└── Fastify 요청 처리
    └── PostService.findAll
        └── Prisma 쿼리
```

요청 전체의 처리 과정을 묶은 기록이 **Trace**이고, 그 안의 개별 작업을 기록한 것이 **Span**입니다.  

```text
Trace: GET /api/posts
├── Span: Fastify 요청 처리
├── Span: PostService.findAll
└── Span: Prisma Query
```

OpenTelemetry SDK는 Span을 생성하고 Trace ID 같은 추적 정보를 기록하여 외부로 전달합니다.  
Prisma 쿼리처럼 특정 작업까지 Trace에 포함하려면 해당 라이브러리의 자동 계측을 사용하거나 직접 계측해야 할 수도 있습니다.  
SDK가 만든 데이터는 Jaeger나 Tempo 같은 Backend로 보내야 나중에 검색할 수 있습니다.  

### 🟦 Collector를 중간에 두는 이유

애플리케이션은 데이터를 Backend로 직접 보내거나 **OpenTelemetry Collector**를 거쳐 보낼 수 있습니다.  

```text
직접 전송
Fastify + SDK ─────────────────────→ Jaeger / Tempo

Collector를 통한 전송
Fastify + SDK → Collector ─────────→ Jaeger / Tempo
                    └──────────────→ 기타 Backend
```

서비스가 적고 구성이 단순하다면 직접 전송할 수 있습니다.  
서비스가 많아지면 Collector가 여러 애플리케이션의 데이터를 한곳에서 받아 가공하고 필요한 목적지로 전달할 수 있습니다.  

| 구성 | 위치 | 주요 역할 |
| --- | --- | --- |
| OpenTelemetry SDK | 애플리케이션 내부 | Telemetry 생성·수집·전송 |
| OpenTelemetry Collector | 애플리케이션과 Backend 사이 | 데이터 수신·가공·전달 |

Collector가 처음부터 반드시 필요한 것은 아닙니다.  
중요한 점은 **애플리케이션에서 데이터를 만드는 단계와 Backend에 저장하는 단계가 분리되어 있다는 것**입니다.  

## 3. 데이터를 저장하는 Prometheus, Loki, Tempo {#session-03}

Logs, Metrics, Traces는 성격과 조회 방식이 다르므로 각각에 특화된 Backend를 사용할 수 있습니다.  

### 🟦 Metrics를 수집하고 저장하는 Prometheus

Trace가 요청 하나의 처리 과정을 보여 준다면 **Metrics**는 서비스 전체의 상태 변화를 숫자로 보여 줍니다.  
Fastify에서는 다음과 같은 값을 측정할 수 있습니다.  

```text
요청 도착 → 요청 수 증가
응답 완료 → 응답 시간 기록
오류 발생 → 오류 수 증가
```

이 값에는 `http_requests_total`, `http_request_duration_seconds`와 같은 이름을 붙일 수 있습니다.  
Metric 이름은 예시이며 실제 이름은 계측 설정에 따라 달라집니다.  

Prometheus의 대표적인 수집 방식은 **Pull 방식**입니다.  
Fastify나 별도의 수집 도구가 `/metrics` endpoint를 제공하면 Prometheus가 주기적으로 요청하여 값을 가져갑니다.  

```text
Prometheus ── GET /metrics ──→ Application 또는 수집 도구
Prometheus ←── Metrics ─────── Application 또는 수집 도구
```

이 과정을 **스크레이핑(scraping)**이라고 합니다.  
OpenTelemetry를 함께 사용한다면 SDK나 Collector가 Prometheus가 읽을 수 있는 endpoint를 제공하도록 구성할 수 있습니다.  
즉 개념적으로는 OpenTelemetry가 Metric을 준비하지만, 실제 수집 방향은 Prometheus에서 endpoint를 향합니다.  

Prometheus는 수집한 Metric을 시계열 데이터로 저장합니다.  
응답 시간의 분포를 수집하고 있다면 다음과 같은 변화를 확인할 수 있습니다.  

```text
14:00  GET /api/posts  p95 응답 시간  180ms
14:05  GET /api/posts  p95 응답 시간  1.8s
```

p95는 관측된 요청 중 약 95%가 해당 시간 이내에 완료됐다는 의미입니다.  
이 값의 변화를 통해 서비스가 언제부터 느려졌는지 찾을 수 있습니다.  

### 🟦 Logs를 저장하고 검색하는 Loki

Fastify가 로그를 출력했다고 해서 로그가 자동으로 Loki에 저장되는 것은 아닙니다.  
일반적으로 애플리케이션의 로그를 읽어 전달하는 수집 계층이 필요합니다.  

```text
Fastify → 로그 수집 계층 → Loki
                         [저장·검색]
```

예를 들어 Post Service에서 DB 오류가 발생하면 오류 메시지와 함께 Trace ID를 기록할 수 있습니다.  

```text
traceId=abc123
message="database query failed"
```

Trace에도 같은 `abc123`이라는 ID가 있다면 특정 요청의 처리 과정과 관련 로그를 연결해서 찾을 수 있습니다.  

### 🟦 Traces를 저장하고 조회하는 Tempo

**Tempo**는 Trace를 저장하고 조회하기 위한 Trace Backend입니다.  
OpenTelemetry가 보낸 Trace를 Tempo에 저장하고, Grafana를 데이터 소스로 연결하여 검색할 수 있습니다.  

```text
OpenTelemetry → Tempo ← Grafana
               Trace    조회·시각화
```

Tempo와 Jaeger는 모두 Trace를 다룹니다.  
이 글에서는 Tempo를 Grafana와 연결하는 Trace Backend로, Jaeger를 자체 UI를 통해 Trace를 분석할 수 있는 분산 추적 시스템으로 구분합니다.  
실제 구성에서는 요구 사항에 따라 둘 중 하나를 선택할 수도 있습니다.  

## 4. 데이터를 분석하는 Jaeger와 Grafana {#session-04}

데이터를 저장하는 목적은 서비스에서 무슨 일이 일어났는지 확인하고 문제의 원인을 찾는 것입니다.  
Jaeger와 Grafana는 저장된 데이터를 개발자가 탐색할 수 있는 형태로 보여 줍니다.  

### 🟦 Jaeger에서 느린 구간을 찾는다

**Jaeger**는 분산 Trace를 저장하고 검색하며 요청의 처리 과정을 시각화합니다.  
예를 들어 `GET /api/posts` 요청이 총 850ms 걸렸다고 가정해 보겠습니다.  

```text
GET /api/posts                   850ms
├── 요청 처리                     20ms
├── PostService.findAll          810ms
│   ├── 게시글 조회               180ms
│   └── 좋아요 조회               600ms
└── 응답 생성                     20ms
```

전체 응답 시간만으로는 어느 부분이 느린지 알기 어렵습니다.  
Jaeger에서 각 Span을 살펴보면 `좋아요 조회`에 600ms가 걸렸다는 사실을 확인할 수 있습니다.  
부모 Span의 시간에는 자식 Span의 시간이 포함될 수 있으므로 표시된 시간을 모두 더하지는 않습니다.  

### 🟦 여러 서비스의 작업을 하나의 Trace로 연결한다

하나의 요청이 API Server와 Post Service처럼 여러 서비스를 거칠 수 있습니다.  
각 서비스가 Span을 생성하기만 해서는 두 기록이 같은 요청에서 시작됐는지 알기 어렵습니다.  
그래서 다른 서비스를 호출할 때 **Trace Context**를 함께 전달합니다.  

```text
Trace ID: abc123

GET /api/posts
└── Span: API Server
    └── Span: Post Service
        └── Span: DB Query
```

Post Service는 전달받은 Trace Context를 이어받아 자신의 Span을 기록합니다.  
이처럼 하나의 요청이 여러 서비스에서 처리되는 과정을 연결해 추적하는 것을 **분산 추적(Distributed Tracing)**이라고 합니다.  

DB 서버가 서비스처럼 Trace Context를 받아 직접 Span을 만드는 것은 아닙니다.  
일반적으로 DB 쿼리를 실행한 서비스의 계측 코드가 `DB Query` Span을 기록합니다.  

### 🟦 Grafana에서 여러 신호를 함께 살펴본다

**Grafana**는 Prometheus, Loki, Tempo 같은 Backend를 데이터 소스로 연결하고 결과를 대시보드나 탐색 화면에 표시합니다.  
Grafana 자체가 이 데이터를 모두 저장하는 것은 아닙니다.  

```text
Prometheus ── Metrics ─┐
Loki       ── Logs ────┼──→ Grafana
Tempo      ── Traces ──┘
```

게시글 API가 갑자기 느려졌다면 다음 순서로 원인을 좁혀 갈 수 있습니다.  

```text
Prometheus / Grafana
└── 응답 시간이 증가한 시점 확인
    └── Jaeger / Tempo에서 느린 Span 확인
        └── Loki에서 같은 Trace ID의 오류 Log 확인
```

Metrics는 **문제가 발생한 사실과 시점**을 보여 줍니다.  
Trace는 **어느 작업이 오래 걸렸는지** 보여 주고, Log는 **그때 어떤 사건이나 오류가 발생했는지** 알려 줍니다.  
Trace ID 같은 공통 식별자를 기록하고 조회 화면을 연결하면 세 신호를 오가며 원인을 추적하기 쉬워집니다.  
