---
layout: post
title: "05. OpenTelemetry로 Node.js HTTP와 Runtime Metrics 수집"
description: "OpenTelemetry Meter와 Instrument를 이해하고 Fastify HTTP 요청 수·응답 시간과 Node.js CPU·Memory·V8 Heap·GC·Event Loop Metrics를 수집해 Prometheus endpoint에서 확인합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. 수집할 Metrics와 전체 흐름"
  - id: session-02
    title: "2. OpenTelemetry Metrics 구성과 수집 환경"
  - id: session-03
    title: "3. HTTP Metrics 수집 구현"
  - id: session-04
    title: "4. Node.js Runtime Metrics 수집 구현"
---

Trace가 요청 한 건의 내부 실행 흐름을 보여 준다면 Metrics는 여러 요청과 Runtime 상태를 시간의 흐름에 따라 집계해서 보여 줍니다.  
이번 글에서는 Fastify 요청의 수와 응답 시간을 직접 기록하고, Node.js Process와 Runtime 상태를 함께 수집합니다.  
수집한 값을 Prometheus가 읽을 수 있도록 `/metrics` endpoint에 노출하는 과정까지 살펴봅니다.  

PromQL로 요청률과 Percentile을 계산하는 방법은 다음 6편에서, Grafana Dashboard로 시각화하는 방법은 7편에서 이어서 다룹니다.  

## 1. 수집할 Metrics와 전체 흐름 {#session-01}

### 🟦 HTTP Metrics와 Runtime Metrics 구분

HTTP Metrics와 Runtime Metrics는 서로 다른 질문에 답합니다.  

| 구분 | 관찰 대상 | 답할 수 있는 질문 |
| --- | --- | --- |
| HTTP Metrics | 애플리케이션이 처리한 요청 | 요청이 얼마나 들어오고, 얼마나 실패하며, 얼마나 오래 걸리는가 |
| Runtime Metrics | 요청을 처리하는 Node.js Process와 V8 | CPU·Memory 사용량과 GC·Event Loop 상태가 정상인가 |

HTTP 응답 시간이 증가했을 때 HTTP Metrics만 보면 어떤 Route가 느린지는 알 수 있습니다.  
하지만 CPU 사용률, Heap 사용량이나 Event Loop Delay를 함께 보면 지연이 Runtime 자원과 같은 시점에 발생했는지 비교할 수 있습니다.  

![Metrics 수집과 분석의 전체 흐름](/assets/images/nodejs/nodejs-observability/image-2026-09-29-3.png)

### 🟦 Request Count와 Request Duration

HTTP 요청에서는 다음 두 Metric을 직접 정의합니다.  

| Metric | Instrument | 기록하는 값 | 기본 확인 항목 |
| --- | --- | --- | --- |
| `http_requests` | Counter | 완료된 요청 수 | Request Rate와 5xx Error Rate |
| `http_request_duration_seconds` | Histogram | 요청 한 건의 응답 시간 | 평균과 p50·p95·p99 Latency |

http_requests는 서비스에 요청이 얼마나 들어오고 있는지, 그리고 그중 에러가 얼마나 발생하는지를 확인하기 위해 수집합니다.  
트래픽이 갑자기 증가했는지, 특정 API에 요청이 몰리는지, 5xx 비율이 높아지는지를 보는 데 사용합니다.  

http_request_duration_seconds는 요청 처리 속도가 얼마나 느려졌는지 확인하기 위한 Metric입니다.  
평균뿐 아니라 p95, p99를 함께 보면 일부 느린 요청이 사용자 체감 성능을 악화시키고 있는지도 확인할 수 있습니다.  

두 Metric에는 `method`, `route`, `status_code` attribute를 공통으로 기록합니다.  
따라서 전체 요청을 집계할 수도 있고 GET 요청, 특정 Route나 5xx 응답만 나누어 볼 수도 있습니다.  

### 🟦 CPU, Memory와 Heap

CPU와 Memory는 현재 Node.js Process가 요청을 처리할 여유가 있는지 판단하는 기본 자료입니다.  

| Metric | 의미 |
| --- | --- |
| `process_cpu_utilization` | 이전 관측 이후 Process가 사용한 CPU 시간의 비율 |
| `process_resident_memory_bytes` | Process가 실제 RAM에 올려 사용 중인 RSS 크기 |
| `v8js.memory.heap.used` | V8 Heap Space별로 사용 중인 Memory 크기 |

process_cpu_utilization은 Node.js Process가 CPU를 얼마나 많이 사용하고 있는지 확인하기 위해 수집합니다.  
CPU 사용률이 지속적으로 높으면서 Latency도 증가한다면 CPU 연산이 많은 작업이나 Event Loop Blocking을 의심할 수 있습니다.  

process_resident_memory_bytes는 Node.js Process 전체가 실제 RAM을 얼마나 사용하고 있는지 확인할 때 사용합니다.  
RSS가 계속 증가한다면 Memory Leak이나 Native Memory 증가 가능성을 살펴볼 수 있습니다.  

v8js.memory.heap.used는 JavaScript 객체가 사용하는 V8 Heap 상태를 보기 위한 Metric입니다.  
Heap 사용량이 계속 증가하고 GC 이후에도 줄어들지 않는다면 객체가 해제되지 않고 계속 남아 있는지 확인할 수 있습니다.

> **RSS(Resident Set Size):** 현재 Node.js Process가 실제 물리 메모리(RAM)에 올려서 사용하는 Memory 크기입니다.  

### 🟦 GC Duration과 Event Loop Delay

V8은 더 이상 사용하지 않는 JavaScript 객체를 Garbage Collection으로 정리합니다.  
GC가 자주 실행되거나 정지 시간이 길어지면 일부 요청의 응답 시간도 함께 증가할 수 있습니다.  

Event Loop Delay는 예약된 작업이 실제로 실행되기까지 밀린 시간을 나타냅니다.  
CPU를 오래 점유하는 동기 작업이 있으면 Event Loop가 다음 작업을 제때 처리하지 못해 Delay가 증가할 수 있습니다.  

| Metric | 기본 확인 항목 |
| --- | --- |
| `v8js.gc.duration` | GC 유형별 실행 횟수와 정지 시간 분포 |
| `nodejs.eventloop.delay.p99` | 관측 구간에서 느린 Event Loop Delay |
| `nodejs.eventloop.utilization` | Event Loop가 작업을 수행한 시간의 비율 |

v8js.gc.duration은 Garbage Collection이 요청 처리 성능에 영향을 주고 있는지 확인하기 위해 수집합니다.  
GC가 너무 자주 발생하거나 한 번의 GC 시간이 길어지면 애플리케이션이 JavaScript 코드를 실행하지 못하는 시간이 증가할 수 있습니다.  

nodejs.eventloop.delay.p99는 Event Loop가 제시간에 작업을 처리하지 못하고 밀리고 있는지 확인할 때 사용합니다.  
p99가 크게 증가하면 일부 작업이 상당히 늦게 실행되고 있다는 의미입니다.  

nodejs.eventloop.utilization은 Event Loop가 얼마나 바쁘게 동작하고 있는지를 보기 위한 Metric입니다.  
값이 지속적으로 높다면 Event Loop가 쉴 틈 없이 작업을 처리하고 있을 가능성이 있습니다.

## 2. OpenTelemetry Metrics 구성과 수집 환경 {#session-02}

### 🟦 Meter와 Metric Instrument

Meter는 Counter, Histogram과 ObservableGauge 같은 Metric Instrument를 만드는 객체입니다.  
`metrics.getMeter()`에 전달하는 이름과 버전은 Metric 이름이 아니라 Instrument를 만든 코드의 계측 범위를 구분합니다.  

```typescript
import { metrics } from '@opentelemetry/api';

// HTTP Metrics를 정의할 계측 범위를 만듭니다.
const meter = metrics.getMeter('observability-basics.http', '1.0.0');
```

Instrument는 값의 성격에 맞게 선택합니다.  

| Instrument | 값 기록 방식 | 이 글의 사용 예시 |
| --- | --- | --- |
| Counter | 발생할 때마다 증가량을 더합니다. | 완료된 HTTP 요청 수 |
| Histogram | 관측값을 분포로 기록합니다. | HTTP 응답 시간과 GC Duration |
| ObservableGauge | 수집 시점에 Callback으로 현재 값을 관측합니다. | CPU, RSS, Heap과 Event Loop 상태 |

HTTP 요청은 완료 시점이 분명하므로 Counter와 Histogram에 직접 값을 기록합니다.  
CPU와 Memory처럼 현재 상태를 읽는 값은 Prometheus가 수집할 때 Callback을 실행하는 ObservableGauge가 적합합니다.  

### 🟦 실습 프로젝트 구조

`src/ch05`에는 HTTP와 Process Metrics를 나누어 정의합니다.  
V8 Heap, GC와 Event Loop Metrics는 `instrumentation.ts`에서 Runtime Instrumentation으로 등록합니다.  

```text
observability-basics/
├── src/
│   ├── ch05/
│   │   ├── http.metrics.ts
│   │   ├── process.metrics.ts
│   │   ├── metrics.plugin.ts
│   │   └── metrics.routes.ts
│   ├── config/
│   │   └── env.ts
│   ├── app.ts
│   ├── instrumentation.ts
│   ├── route.ts
│   └── server.ts
└── package.json
```

| 파일 | 역할 |
| --- | --- |
| `src/ch05/http.metrics.ts` | HTTP 요청 수 Counter와 응답 시간 Histogram을 정의합니다. |
| `src/ch05/process.metrics.ts` | Process CPU와 RSS Memory ObservableGauge를 등록합니다. |
| `src/ch05/metrics.plugin.ts` | Fastify Hook에서 HTTP Metric 값을 기록합니다. |
| `src/ch05/metrics.routes.ts` | 응답 시간과 오류를 재현할 테스트 API를 제공합니다. |
| `src/instrumentation.ts` | Prometheus Exporter와 Runtime Instrumentation을 시작합니다. |
| `src/config/env.ts` | Metrics endpoint와 Runtime 관측 주기를 설정합니다. |

### 🟦 필요한 패키지 설치

Prometheus Exporter와 Node.js Runtime Instrumentation을 설치합니다.  
예제는 프로젝트의 `package.json`과 같은 버전을 사용합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm install @opentelemetry/exporter-prometheus@0.222.0
npm install @opentelemetry/instrumentation-runtime-node@0.35.0
```

`PrometheusExporter`는 애플리케이션 내부의 Metrics를 Prometheus 형식으로 변환하고 기본 `/metrics` endpoint를 제공합니다.  
`RuntimeNodeInstrumentation`은 Node.js의 `perf_hooks`와 V8 정보를 이용해 Heap, GC와 Event Loop Metrics를 자동으로 등록합니다.  

### 🟦 Prometheus Exporter와 Runtime Instrumentation 등록

```typescript
// src/instrumentation.ts
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import FastifyOtelInstrumentation from '@fastify/otel';
import { PrismaInstrumentation } from '@prisma/instrumentation';

import { registerProcessMetrics } from './ch05/process.metrics';
import { env } from './config/env.js';

const traceExporter = new OTLPTraceExporter({
  url: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
});

// Prometheus가 이 Process의 Metrics를 읽을 endpoint를 엽니다.
const metricReader = new PrometheusExporter({
  host: env.OTEL_EXPORTER_PROMETHEUS_HOST,
  port: env.OTEL_EXPORTER_PROMETHEUS_PORT,
});

const sdk = new NodeSDK({
  serviceName: env.OTEL_SERVICE_NAME,
  traceExporter,
  metricReaders: [metricReader],
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyOtelInstrumentation({ registerOnInitialization: true }),
    new PrismaInstrumentation(),

    // V8 Heap, GC Duration과 Event Loop 상태를 자동으로 수집합니다.
    new RuntimeNodeInstrumentation({
      monitoringPrecision: env.OTEL_RUNTIME_MONITORING_PRECISION_MS,
    }),
  ],
});

// sdk.start()는 OpenTelemetry가 실제 Metric을 저장하고 수집할 수 있도록 MeterProvider를 활성화합니다.
// MeterProvider는 Meter와 Metric 도구를 관리하는 중심 객체입니다.
sdk.start();

// MeterProvider가 등록된 뒤 ObservableGauge를 만들어야 실제 Metric이 수집됩니다.
// ObservableGauge에는 “Metric을 읽을 때 CPU와 Memory 값을 어떻게 가져올지”를 알려주는 콜백 함수가 등록됩니다.
registerProcessMetrics();
```

`monitoringPrecision`은 Event Loop Delay를 관측하는 간격이며 단위는 ms입니다.  
값을 작게 하면 더 촘촘하게 관측하지만 그만큼 측정 비용이 늘어날 수 있습니다.  

```dotenv
OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0
OTEL_EXPORTER_PROMETHEUS_PORT=9464
OTEL_RUNTIME_MONITORING_PRECISION_MS=10
OTEL_SERVICE_NAME=observability-basics
```

여기까지 구성하면 애플리케이션에서 HTTP와 Runtime Metrics를 수집해 `/metrics` endpoint로 노출할 준비가 끝납니다.  
Prometheus에서 수집 결과를 분석하는 과정은 다음 6편에서, Grafana로 시각화하고 Jaeger 조사로 이어 가는 과정은 7편에서 살펴봅니다.  

## 3. HTTP Metrics 수집 구현 {#session-03}

### 🟦 http_requests Counter 정의

Meter와 HTTP attribute 타입을 정의합니다.  

```typescript
// src/ch05/http.metrics.ts
import { metrics, type Attributes } from '@opentelemetry/api';

const meter = metrics.getMeter('observability-basics.http', '1.0.0');

export type HttpMetricAttributes = Attributes & {
  method: string;
  route: string;
  status_code: string;
};

/**
 * 완료된 HTTP 요청의 전체 개수를 기록합니다.
 * Counter는 값을 줄이지 않고 요청이 끝날 때마다 1씩 더합니다.
 * 나중에 일정 시간 동안 얼마나 증가했는지 계산하면 초당 요청 수를 구할 수 있습니다.
 */
export const httpRequests = meter.createCounter('http_requests', {
  description: 'Total number of HTTP requests',
  unit: '{request}',
});
```

Counter는 요청이 완료될 때마다 `1`을 더합니다.  
Prometheus 형식에서는 Counter 이름에 `_total` suffix가 붙으므로 `http_requests_total`로 조회합니다.  

```text
http_requests_total   //완료된 HTTP 요청의 전체 개수
```

### 🟦 http_request_duration_seconds Histogram 정의

응답 시간은 요청마다 값이 달라지므로 Histogram으로 분포를 기록합니다.  

```typescript
// src/ch05/http.metrics.ts
/**
 * 요청 한 건을 처리하는 데 걸린 시간을 초 단위로 기록합니다.
 * Histogram은 시간을 여러 구간으로 나누어 요청 수를 세므로 평균뿐 아니라
 * p50, p95, p99처럼 대부분의 요청이 어느 시간 안에 끝났는지도 계산할 수 있습니다.
 */
export const httpRequestDuration = meter.createHistogram(
  'http_request_duration_seconds',
  {
    description: 'HTTP request duration in seconds',
    unit: 's',
    advice: {
      // 아래 숫자는 응답시간을 나누는 경계이며 단위는 초입니다.
      // 예를 들어 0.1 경계에는 0.1초(100ms) 안에 끝난 요청 수가 쌓입니다.
      // 이렇게 구간별로 쌓인 요청 수를 이용해 응답시간 분포와 백분위 값을 계산합니다.
      explicitBucketBoundaries: [
        0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
      ],
    },
  },
);
```

Prometheus에서는 하나의 Histogram이 다음 Time Series로 노출됩니다.  

```text
http_request_duration_seconds_bucket   // 응답 시간이 특정 시간 이하인 요청 수를 Bucket별로 누적 집계
http_request_duration_seconds_count    // Histogram에 기록된 전체 요청 수
http_request_duration_seconds_sum      // 모든 요청의 응답 시간 합계
```

![Histogram Bucket 경계와 누적값 해석](/assets/images/nodejs/nodejs-observability/05-histogram-bucket-cumulative.png)  

그림은 Bucket 경계를 정하고 응답 시간 한 건을 기록한 뒤, 누적값을 해석하는 흐름을 보여 줍니다.  

1. `0.05`, `0.075`, `0.1`, `0.25`, `0.5`, `1`처럼 관찰할 응답 시간의 상한을 초 단위로 정합니다.  
2. `80ms` 요청은 `0.08초`이므로 `le="0.1"` Bucket과 그보다 큰 모든 Bucket에 함께 포함됩니다.  
3. 각 Bucket 값은 해당 구간에만 속한 요청 수가 아니라 그 경계 이하에서 처리된 누적 요청 수입니다.  

여기서 `le`는 *less than or equal*, 즉 해당 값 이하라는 뜻입니다.  
예를 들어 `le="0.25"`의 값이 `92`라면 100~250ms 구간에 92건이 있다는 의미가 아니라, 250ms 이하에서 완료된 요청이 모두 92건이라는 의미입니다.  
Prometheus는 이 누적 분포를 이용해 p50·p95·p99를 계산하며, 계산 방법은 6편에서 자세히 살펴봅니다.  

### 🟦 Fastify Hook에서 요청 수와 응답 시간 기록

`onRequest`에서 시작 시각을 저장하고 `onResponse`에서 요청 수와 경과 시간을 기록합니다.  
동시에 처리되는 요청의 시간이 섞이지 않도록 각 `FastifyRequest`를 key로 사용하는 `WeakMap`에 저장합니다.  

```typescript
// src/ch05/metrics.plugin.ts
import { performance } from 'node:perf_hooks';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import {
  httpRequestDuration,
  httpRequests,
  type HttpMetricAttributes,
} from './http.metrics';

const requestStartTimes = new WeakMap<FastifyRequest, number>();

export function createHttpMetricAttributes(
  request: FastifyRequest,
  statusCode: number,
): HttpMetricAttributes {
  return {
    method: request.method,
    // 실제 URL 대신 Route pattern을 사용해 Cardinality 증가를 막습니다.
    route: request.routeOptions.url ?? 'unmatched',
    status_code: String(statusCode),
  };
}

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    // 시스템 시각 변경의 영향을 받지 않는 단조 증가 시계를 사용합니다.
    requestStartTimes.set(request, performance.now());
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartTimes.get(request);
    const attributes = createHttpMetricAttributes(request, reply.statusCode);

    // 최종 상태 코드가 정해진 다음 완료된 요청 한 건을 기록합니다.
    httpRequests.add(1, attributes);

    if (startedAt !== undefined) {
      // performance.now()의 ms 값을 Histogram의 초 단위로 변환합니다.
      const durationSeconds = (performance.now() - startedAt) / 1_000;
      httpRequestDuration.record(durationSeconds, attributes);
    }

    requestStartTimes.delete(request);
  });
};

export default fp(metricsPlugin, { name: 'metrics-plugin' });
```

`onResponse`는 응답 전송이 끝난 뒤 실행되므로 200, 404와 500 같은 최종 상태 코드를 기록할 수 있습니다.  
시작 시각을 찾지 못해도 요청 수는 기록하고, 응답 시간만 생략하도록 방어적으로 처리합니다.  

### 🟦 method, route, status_code Attribute와 Cardinality

OpenTelemetry의 attribute는 Prometheus에서 label로 표현됩니다.  

```text
http_requests_total{
  method="GET",
  route="/api/ch05/posts",
  status_code="200"
}
```

Metric label 값의 가능한 조합 수를 Cardinality라고 합니다.  
요청마다 달라지는 URL, `userId`, `email`, `requestId`나 `traceId`를 label에 넣으면 Time Series가 계속 증가합니다.  

```text
# 사용하지 않는 형태
route="/api/posts/1"
route="/api/posts/2"

# 사용하는 형태
route="/api/posts/:id"
```

예제는 Query String이 포함된 실제 URL 대신 `request.routeOptions.url`의 Route pattern을 기록합니다.  
등록되지 않은 URL은 경로별로 나누지 않고 `unmatched`라는 고정값으로 기록합니다.  

### 🟦 테스트 Route와 Plugin 연결

Route를 등록합니다.  

```typescript
// metrics.routes.ts
const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/posts',
    {
      schema: {
        querystring: MetricsPostQuerySchema,
        response: {
          200: MetricsPostResponseSchema,
          default: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const delay = request.query.delay ?? 50;
      // Event Loop를 막지 않고 이 요청만 지정한 시간 동안 기다립니다.
      await sleep(delay);
      return {
        posts: [{ id: 1, title: 'Observability 시작하기' }],
        delayMs: delay,
      };
    },
  );

  // 공통 Error Handler가 Error를 500 응답으로 변환합니다.
  fastify.get('/error', async () => {
    throw new Error('Metrics 테스트 오류');
  });
};
```

Metrics Plugin은 측정할 Route보다 먼저 등록합니다.  

```typescript
// src/app.ts
export function createApp() {
  const app = Fastify({ logger: loggerOptions });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // 이후 등록하는 모든 비즈니스 Route의 요청을 측정합니다.
  app.register(metricsPlugin);
  app.register(prismaPlugin);
  app.register(routes, { prefix: '/api' });

  return app;
}
```

## 4. Node.js Runtime Metrics 수집 구현 {#session-04}

### 🟦 Process CPU 수집

현재 실행 중인 Node.js 프로세스의 CPU 사용률과 Memory 사용량을 수집합니다.  
요청이 끝날 때 값을 기록하는 HTTP Metrics와 달리, ObservableGauge는 Metric을 읽는 시점마다 콜백 함수를 실행해 그때의 값을 가져옵니다.  

```typescript
// src/ch05/process.metrics.ts

// `process.hrtime.bigint()`는 나노초, `process.cpuUsage()`는 마이크로초를 사용합니다.
// 두 시간을 계산할 때 단위를 맞추기 위해 나노초를 마이크로초로 바꿉니다.
const NANOSECONDS_PER_MICROSECOND = 1_000;

// CPU 사용률을 구하려면 이전 값과 현재 값을 비교해야 합니다.
// 비교에 필요한 누적 CPU 시간과 측정 시각을 한 묶음으로 보관합니다.
export interface CpuSample {
  cpuUsage: NodeJS.CpuUsage;
  timestampNs: bigint;
}

/**
 * 이전 측정 이후 현재까지 프로세스가 사용한 CPU 비율을 계산합니다.
 *
 * `process.cpuUsage()`는 프로세스가 시작된 뒤 사용한 CPU 시간을 계속 더해서 반환합니다.
 * 따라서 현재 누적값에서 이전 누적값을 빼고, 그 값을 실제로 흐른 시간으로 나눕니다.
 * 예를 들어 1초 동안 CPU를 0.2초 사용했다면 결과는 0.2입니다.
 */
export function calculateCpuUtilization(
  previous: CpuSample,
  current: CpuSample,
): number {
  // 실제로 흐른 시간을 CPU 시간과 같은 마이크로초 단위로 바꿉니다.
  const elapsedMicroseconds =
    Number(current.timestampNs - previous.timestampNs) /
    NANOSECONDS_PER_MICROSECOND;

  if (elapsedMicroseconds <= 0) return 0;

  // user는 애플리케이션 코드를 실행한 시간이고, system은 운영체제 작업에 사용한 시간입니다.
  // 프로세스가 사용한 전체 CPU 시간을 구하려면 두 값의 증가량을 더해야 합니다.
  const usedMicroseconds =
    current.cpuUsage.user - previous.cpuUsage.user +
    (current.cpuUsage.system - previous.cpuUsage.system);

  if (usedMicroseconds <= 0) return 0;

  return usedMicroseconds / elapsedMicroseconds;
}

/** 현재 CPU 누적 사용 시간과 경과 시간 측정값을 한 묶음으로 만듭니다. */
function takeCpuSample(): CpuSample {
  return {
    cpuUsage: process.cpuUsage(),
    // hrtime은 날짜나 시각 설정의 영향을 받지 않고 계속 증가하므로 경과 시간 계산에 알맞습니다.
    timestampNs: process.hrtime.bigint(),
  };
}
```

`registerProcessMetrics()`는 여러 번 호출되더라도 같은 Callback이 중복 등록되지 않도록 먼저 확인합니다.  
그다음 Process Metrics용 Meter를 만들고 CPU와 RSS ObservableGauge를 차례로 등록합니다.  

```typescript
// src/ch05/process.metrics.ts
let processMetricsRegistered = false;

export function registerProcessMetrics(): void {
  if (processMetricsRegistered) return;
  processMetricsRegistered = true;

  const meter = metrics.getMeter(
    'observability-basics.process',
    '1.0.0',
  );

  // 다음 코드에서 CPU와 RSS ObservableGauge를 등록합니다.
}
```

이후에 나오는 CPU와 RSS 코드는 모두 이 함수 안에서 `meter`를 사용해 등록하는 부분입니다.  
CPU 사용률은 이전 값과 비교해야 하므로 첫 Callback 전에 기준 Sample을 저장합니다.  

```typescript
// src/ch05/process.metrics.ts
// registerProcessMetrics() 내부
// CPU 사용률은 두 값을 비교해야 하므로 첫 수집 전에 비교 기준이 될 값을 미리 저장합니다.
let previousCpuSample = takeCpuSample();

// ObservableGauge는 값을 미리 쌓아 두지 않고 Metric을 읽을 때 콜백 함수로 현재 값을 가져옵니다.
// 단위 `1`은 0.2처럼 별도의 단위가 없는 비율이라는 뜻입니다.
const cpuUtilization = meter.createObservableGauge(
  ' ',
  {
    description: 'Process CPU utilization since the previous observation',
    unit: '1',
  },
);

// addCallback()은 여기서 CPU 값을 바로 읽는 함수가 아니라, 나중에 실행할 함수를 등록하는 메서드입니다.
// Prometheus가 `/metrics`를 요청하면 OpenTelemetry가 이 콜백 함수를 호출해 그 시점의 값을 가져갑니다.
// result는 이번 수집 결과를 전달하는 객체이며, observe()에 넘긴 값이 현재 Gauge 값으로 기록됩니다.
cpuUtilization.addCallback((result) => {
  const currentCpuSample = takeCpuSample();
  const utilization = calculateCpuUtilization(
    previousCpuSample,
    currentCpuSample,
  );

  // 다음 수집 때 이번 값과 비교할 수 있도록 현재 값을 새로운 기준으로 저장합니다.
  previousCpuSample = currentCpuSample;
  result.observe(utilization);
});
```

값 `0.2`는 관측 구간의 실제 경과 시간에 대해 약 20%에 해당하는 CPU 시간을 사용했다는 의미입니다.  

### 🟦 Process Memory 수집

RSS는 현재 Process가 실제 RAM에 올려 사용 중인 Memory 크기입니다.  
현재 상태를 그대로 관측하므로 이전 값과 비교할 필요가 없습니다.  

```typescript
// src/ch05/process.metrics.ts
// registerProcessMetrics() 내부
/**
 * RSS는 Resident Set Size의 약자
 * 현재 Node.js 프로세스가 실제 물리 메모리(RAM)에 올려서 사용 중인 메모리 크기인 RSS를 byte로 반환합니다.
 * RSS에는 JavaScript 객체가 저장되는 V8 Heap뿐 아니라 실행 코드, Stack 등의 Memory도 포함됩니다.
 * 따라서 RSS와 V8 Heap은 서로 다른 값으로 보고 비교해야 합니다.
 */
export function getResidentMemoryBytes(): number {
  return process.memoryUsage().rss;
}

// RSS는 계속 더하는 값이 아니라 현재 크기이므로 이전 값과 비교할 필요가 없습니다.
// OpenTelemetry에서는 byte 단위를 `By`로 표시합니다.
const residentMemory = meter.createObservableGauge(
  'process_resident_memory_bytes',
  {
    description: 'Resident set size of the Node.js process',
    unit: 'By',
  },
);

// addCallback()에 등록한 함수는 Metric을 수집할 때마다 실행됩니다.
// 실행 시점의 RSS를 다시 읽고, observe()로 이번 수집에서 사용할 Memory 값을 전달합니다.
// RSS는 현재 상태를 나타내는 Gauge이므로 이전 값에 더하지 않고 새 값으로 관측합니다.
residentMemory.addCallback((result) => {
  result.observe(getResidentMemoryBytes());
});
```

### 🟦 V8 Heap과 GC Duration 수집

`RuntimeNodeInstrumentation`은 V8 Heap Space별 크기와 사용량을 자동으로 수집합니다.  
`v8js.heap.space.name` attribute로 `new_space`, `old_space` 같은 영역을 나누어 볼 수 있습니다.  

```text
v8js.memory.heap.space.size            // V8이 현재 확보한 전체 크기
v8js.memory.heap.used                  // 메모리 사용량
v8js.memory.heap.space.available_size  // 추가로 사용할 수 있는 여유 공간
v8js.memory.heap.space.physical_size   // OS에서 실제로 물리적으로 할당된 메모리 크기
```

GC Duration은 Histogram이며 `v8js.gc.type`으로 GC 유형을 구분합니다.  

```text
v8js.gc.duration
└─ v8js.gc.type = major | minor | incremental | weakcb
```

`v8js.memory.heap.used`는 각 Heap Space에서 현재 사용 중인 Memory 크기를 보여 줍니다.  
`v8js.gc.duration`은 한 번의 GC 작업에 걸린 시간을 기록하며, `v8js.gc.type`으로 GC 유형을 구분합니다.  
Heap과 GC의 시간대별 변화 및 HTTP Latency와의 관계는 6편에서 자세히 살펴봅니다.  

### 🟦 Event Loop Delay 수집

Runtime Instrumentation은 Event Loop의 사용률과 Delay 통계를 수집합니다.  

```text
nodejs.eventloop.utilization // Event Loop가 실제 작업을 수행하며 활성 상태였던 비율
                             // 1에 가까울수록 Event Loop가 계속 바쁘게 동작하고 있음을 의미
nodejs.eventloop.delay.min   // Event Loop Delay 중 최소 지연 시간
nodejs.eventloop.delay.max   // Event Loop Delay 중 최대 지연 시간
nodejs.eventloop.delay.mean  // Event Loop Delay의 평균값
nodejs.eventloop.delay.p50   // 전체 Delay 측정값의 50%가 이 값 이하
nodejs.eventloop.delay.p90   // 전체 Delay 측정값의 90%가 이 값 이하
nodejs.eventloop.delay.p99   // 전체 Delay 측정값의 99%가 이 값 이하
```

`nodejs.eventloop.utilization`은 Event Loop가 얼마나 바쁘게 동작하는지를 보여 줍니다.  
값이 지속적으로 높다면 CPU 연산이 많은 동기 작업이나 과도한 Callback 처리 등으로 Event Loop가 여유 없이 동작하고 있을 가능성을 확인해 볼 수 있습니다.  

Event Loop Delay는 Timer나 Callback이 실행될 예정이었던 시점과 실제 실행된 시점 사이의 지연을 나타냅니다.  
특히 `nodejs.eventloop.delay.p99`가 증가한다면 전체 관측 구간 중 일부에서 Event Loop가 제때 실행되지 못하고 비교적 큰 지연이 발생했다는 의미입니다.  

### 🟦 /metrics에서 수집 결과 확인

서버를 실행하고 정상·느린·오류 요청을 만듭니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm run dev
```

```bash
curl "http://localhost:3000/api/ch05/posts?delay=50"
curl "http://localhost:3000/api/ch05/posts?delay=300"
curl "http://localhost:3000/api/ch05/posts?delay=1000"
curl "http://localhost:3000/api/ch05/error"
```

Prometheus Exporter의 endpoint를 확인합니다.  

```bash
curl "http://localhost:9464/metrics"
```

필요한 Metric 계열만 빠르게 확인할 수도 있습니다.  

```bash
curl -s "http://localhost:9464/metrics" \
  | grep -E 'http_requests|http_request_duration|process_|v8js_|nodejs_'
```

![메트릭 조회 예시](/assets/images/nodejs/nodejs-observability/image-2026-09-29-4.png)  
OpenTelemetry의 점(`.`)은 Prometheus 형식에서 밑줄(`_`)로 바뀝니다.  
단위가 초나 byte인 Runtime Metric에는 Exporter가 `_seconds`, `_bytes` suffix를 붙일 수 있으므로 실제 조회 이름은 `/metrics` 출력에서 확인합니다.  

| 확인할 Metric 계열 | 의미 |
| --- | --- |
| `http_requests_total` | 완료된 HTTP 요청 수 |
| `http_request_duration_seconds_*` | 응답 시간 Bucket, Count와 Sum |
| `process_cpu_utilization` | Process CPU 사용 비율 |
| `process_resident_memory_bytes` | Process RSS Memory |
| `v8js_memory_heap_*` | V8 Heap Space별 크기와 사용량 |
| `v8js_gc_duration_*` | GC Duration Histogram |
| `nodejs_eventloop_*` | Event Loop 사용률과 Delay |

이제 애플리케이션은 HTTP 요청과 Node.js Runtime 상태를 함께 노출합니다.  
다음 6편에서는 Prometheus가 이 값을 정상적으로 수집하는지 확인하고 PromQL로 요청 Latency와 Runtime 변화를 분석합니다.  
7편에서는 같은 Query를 Grafana Dashboard에 배치해 HTTP와 Runtime Metrics를 같은 시간축에서 비교합니다.  
