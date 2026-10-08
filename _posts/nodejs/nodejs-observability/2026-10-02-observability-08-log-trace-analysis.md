---
layout: post
title: "08. Grafana 통합 Observability: Log 수집과 Trace 기반 장애 분석"
description: "기존 Metrics·Traces 환경에 Pino, Grafana Alloy와 Loki를 추가합니다. Grafana에서 Prometheus Metrics로 이상을 찾고 Jaeger Trace와 구조화 Log를 연결해 장애 원인을 분석합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 8
ai_assisted: true
toc:
  - id: session-01
    title: "1. 통합 Observability 환경 확장"
  - id: session-02
    title: "2. Pino 구조화 Log와 Trace Context 연계"
  - id: session-03
    title: "3. Grafana Alloy·Loki Log 수집 환경 구성"
  - id: session-04
    title: "4. Grafana Explore에서 Trace 기반 장애 분석"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

앞선 실습에서는 OpenTelemetry와 Jaeger로 Trace를 분석하고, Prometheus와 Grafana로 HTTP·Runtime Metrics를 관찰했습니다.  
이번에는 이 환경에 Log 수집 파이프라인을 추가하고 Grafana를 세 가지 관측 신호의 공통 분석 화면으로 사용합니다.  

```text
Metrics ─▶ 이상이 발생한 시간과 Route 확인
             ▼
Traces ─▶ 느리거나 실패한 Span과 Trace ID 확인
             ▼
Logs    ─▶ 같은 Trace ID의 오류 원인과 실행 정보 확인
```

Metric은 영향 범위를 보여 주고, Trace는 한 요청의 실행 경로를 보여 주며, Log는 오류 메시지와 당시의 값을 보여 줍니다.  
세 신호를 연결하면 많은 Log를 처음부터 읽지 않고 **이상 탐지 → 실행 경로 확인 → 원인 확인** 순서로 조사 범위를 좁힐 수 있습니다.  

## 1. 통합 Observability 환경 확장 {#session-01}

기존 환경에는 Metrics를 저장하는 Prometheus와 Trace를 저장하는 Jaeger가 있습니다.  
이번 실습에서는 Pino가 만든 JSON Log File을 Grafana Alloy가 읽어 Loki로 보내는 흐름을 더합니다.  

```text
Fastify
├─ HTTP·Runtime Metrics ─────────────▶ Prometheus ─┐
├─ OpenTelemetry Traces ─────────────▶ Jaeger ─────┼─▶ Grafana
└─ Pino JSON Log File ─▶ Alloy ──────▶ Loki ───────┘
```

| 구성 요소 | Host 주소 또는 경로 | 역할 |
| --- | --- | --- |
| Fastify | `http://localhost:3000` | 요청 처리와 JSON Log 기록 |
| Prometheus | `http://localhost:9090` | HTTP·Runtime Metrics 저장 |
| Jaeger | `http://localhost:16686` | OpenTelemetry Trace 저장과 조회 |
| Loki | `http://localhost:3100` | Log 저장과 LogQL Query 처리 |
| Grafana Alloy | `http://localhost:12345` | Log File 수집, 처리와 Loki 전달 |
| Grafana | `http://localhost:3001` | Metrics·Traces·Logs 통합 조회 |
| Pino Log File | `./logs/observability-basics.log` | 줄 단위 JSON Log 저장 |

### 🟦 ch08 장애 시나리오와 코드 구성

`src/ch08`은 같은 처리 흐름에 정상, 지연과 오류 조건을 적용해 세 신호의 차이를 관찰하도록 구성되어 있습니다.  
Fastify 구현 자체가 이번 글의 주제는 아니므로 각 파일의 역할만 확인합니다.  

```text
src/ch08/
├─ post.routes.ts       # 정상·장애 Endpoint 등록과 객체 조립
├─ post.controller.ts   # Service 호출과 HTTP 응답 처리
├─ post.service.ts      # 지연·오류 재현, Span과 Log 기록
├─ post.repository.ts   # Prisma 게시글 조회
├─ post.schema.ts       # Query와 응답 Schema
└─ post.types.ts        # 내부 조회·결과 Type
```

Route는 `/api/ch08` 아래에 등록되며, 다음 요청을 사용합니다.  

| 요청 | 동작 | 관찰할 결과 |
| --- | --- | --- |
| `GET /api/ch08` | DB 조회 후 50ms 대기, 성공 | 정상 Latency와 Info Log |
| `GET /api/ch08/incident?delay=1000&fail=false` | 1초 대기 후 성공 | 높은 Latency와 Warn Log |
| `GET /api/ch08/incident?delay=1000&fail=true` | 1초 대기 후 오류 | 높은 Latency, 5xx, Error Span과 Error Log |

`delay`는 `0`부터 `5000`까지 지정할 수 있습니다.  
`fail`을 생략하면 `true`가 적용되므로 `/incident`는 기본적으로 1초 뒤 실패하는 요청을 만듭니다.  

### 🟦 Docker Compose 전체 구성

Docker Compose는 기존 Prometheus, Jaeger와 Grafana에 Loki와 Alloy를 더해 전체 Observability Backend를 한 번에 실행합니다.  
Prometheus는 Host의 Metrics Endpoint를 수집하고, Jaeger는 Trace를 받습니다. Alloy는 Host의 Log File을 Loki로 전달하며, Grafana는 세 Data Source를 하나의 화면에서 조회합니다.  

```yaml
# /home/ubuntu/runtimes/observability/docker-compose.metrics.yml
services:
  prometheus:
    image: prom/prometheus:v3.15.0
    ports:
      # Host의 9090번 Port로 Prometheus Web UI에 접속할 수 있도록 연결
      - '9090:9090'
    volumes:
      # Host의 Prometheus 설정 파일을 Container 내부에 읽기 전용으로 연결
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      # 수집한 Metrics를 Docker Named Volume에 저장하여 Container 재생성 후에도 유지
      - prometheus-data:/prometheus
    # Container에서 host.docker.internal 이름으로 Docker Host에 접근할 수 있도록 설정
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    # 장애로 종료되거나 Docker 재시작 시 Container를 자동 재시작
    # 단, 사용자가 명시적으로 중지한 경우에는 자동 재시작하지 않음
    # restart: unless-stopped

  grafana:
    image: grafana/grafana:13.2.2
    ports:
      # Host의 3001번 Port로 Grafana Web UI에 접속할 수 있도록 연결
      - '3001:3000'
    # Grafana Jaeger Data Source의 실험적인 gRPC 조회 기능 활성화
    environment:
      - GF_FEATURE_TOGGLES_ENABLE=jaegerEnableGrpcEndpoint
    volumes:
      # Grafana의 Dashboard와 설정을 Docker Named Volume에 저장
      - grafana-data:/var/lib/grafana
      # Host의 Provisioning 설정 디렉터리를 Container 내부에 읽기 전용으로 연결
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    # 의존 서비스의 Container를 Grafana보다 먼저 시작
    # 단, 서비스가 요청을 처리할 준비까지 완료되었다는 의미는 아님
    depends_on:
      - prometheus
      - jaeger
      - loki
    # 장애로 종료되거나 Docker 재시작 시 Container를 자동 재시작
    # 단, 사용자가 명시적으로 중지한 경우에는 자동 재시작하지 않음
    # restart: unless-stopped

  jaeger:
    image: jaegertracing/jaeger:2.21.0
    ports:
      # Host의 16686번 Port로 Jaeger Web UI에 접속할 수 있도록 연결
      - '16686:16686'
      # Host에서 실행하는 애플리케이션의 OTLP gRPC Trace 수신
      - '4317:4317'
      # Host에서 실행하는 애플리케이션의 OTLP HTTP Trace 수신
      - '4318:4318'
    # 장애로 종료되거나 Docker 재시작 시 Container를 자동 재시작
    # 단, 사용자가 명시적으로 중지한 경우에는 자동 재시작하지 않음
    # restart: unless-stopped

  loki:
    image: grafana/loki:3.7.0
    # 지정한 설정 파일을 사용하여 Loki 실행
    command: -config.file=/etc/loki/config.yaml
    ports:
      # Host의 3100번 Port로 Loki API에 접근할 수 있도록 연결
      - '3100:3100'
    volumes:
      # Host의 Loki 설정 파일을 Container 내부에 읽기 전용으로 연결
      - ./loki/config.yaml:/etc/loki/config.yaml:ro
      # Loki의 저장 데이터를 Docker Named Volume에 보관
      # 실제 저장 경로는 loki/config.yaml 설정과 일치해야 함
      - loki-data:/loki
    # 장애로 종료되거나 Docker 재시작 시 Container를 자동 재시작
    # 단, 사용자가 명시적으로 중지한 경우에는 자동 재시작하지 않음
    # restart: unless-stopped

  alloy:
    image: grafana/alloy:latest
    command:
      # 지정한 설정 파일을 사용하여 Alloy 실행
      - run
      # Container의 모든 Network Interface에서 Alloy 관리 UI에 접근하도록 설정
      - --server.http.listen-addr=0.0.0.0:12345
      # Log File의 마지막 읽기 위치 등 Alloy 내부 상태를 저장할 경로
      - --storage.path=/var/lib/alloy/data
      # Alloy 설정 파일 경로
      - /etc/alloy/config.alloy
    ports:
      # Host의 12345번 Port로 Alloy 관리 UI에 접속할 수 있도록 연결
      - '12345:12345'
    volumes:
      # Host의 Alloy 설정 파일을 Container 내부에 읽기 전용으로 연결
      - ./alloy/config.alloy:/etc/alloy/config.alloy:ro
      # Host의 Pino Log 디렉터리를 Container 내부의 Log 수집 경로에 읽기 전용으로 연결
      - ${OBSERVABILITY_LOG_DIR:-/home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics/logs}:/var/log/observability-basics:ro
      # Log File의 마지막 읽기 위치 등 Alloy 내부 상태를 Docker Named Volume에 저장
      - alloy-data:/var/lib/alloy/data
    # Loki Container를 Alloy보다 먼저 시작
    # 단, Loki가 Log를 수신할 준비까지 완료되었다는 의미는 아님
    depends_on:
      - loki
    # 장애로 종료되거나 Docker 재시작 시 Container를 자동 재시작
    # 단, 사용자가 명시적으로 중지한 경우에는 자동 재시작하지 않음
    # restart: unless-stopped

volumes:
  # Container를 재생성해도 데이터를 유지하도록 Docker Named Volume 선언
  prometheus-data:
  grafana-data:
  loki-data:
  alloy-data:
```

### 🟦 Loki Log 저장 설정

Compose의 Loki Service는 Host의 `loki/config.yaml`을 Container 내부의 `/etc/loki/config.yaml`로 연결해 사용합니다.  
이 파일에는 Loki가 Log를 어떤 형식으로, 어디에 저장할지 지정합니다.  

![Loki 구성예시](/assets/images/nodejs/nodejs-observability/image-2026-10-02-2.png)

```yaml
# /home/ubuntu/runtimes/observability/loki/config.yaml
# 로컬 실습이므로 Loki의 멀티테넌시 인증 기능을 사용하지 않습니다.
auth_enabled: false

server:
  # Alloy가 Log를 보내고 Grafana가 Log를 조회할 때 사용하는 HTTP Port
  http_listen_port: 3100

common:
  # Loki가 Index와 내부 데이터를 저장할 기본 디렉터리
  path_prefix: /loki
  # Loki가 하나만 실행되므로 Log를 다른 Ingester에 복제하지 않습니다.
  replication_factor: 1
  ring:
    # Loki가 하나만 실행되므로 자기 자신의 주소를 Ring에 등록합니다.
    # Ring은 Log를 처리할 Ingester의 위치와 상태를 관리합니다.
    instance_addr: 127.0.0.1
    kvstore:
      # 다른 Loki와 Ring 정보를 공유할 필요가 없어 메모리에서 관리합니다.
      # 실제 Log 데이터를 메모리에 저장한다는 의미는 아닙니다.
      store: inmemory

# Log의 Index 형식과 저장 방식을 설정합니다.
schema_config:
  configs:
    # 2024-01-01부터 수집되는 Log에 아래 설정을 적용합니다.
    - from: 2024-01-01
      # Log를 빠르게 검색할 수 있도록 Index를 TSDB 방식으로 관리합니다.
      store: tsdb
      # 외부 저장소 대신 Loki Container의 File System에 데이터를 저장합니다.
      object_store: filesystem
      # Log 데이터와 Index를 관리할 때 Loki Schema v13을 사용합니다.
      schema: v13
      index:
        # 생성되는 Index 이름 앞에 붙일 문자열
        prefix: index_
        # Index를 날짜별(24시간 단위)로 구분하여 관리합니다.
        period: 24h

# Loki가 수집한 Log 데이터를 저장할 위치를 설정합니다.
storage_config:
  filesystem:
    # 실제 Log 내용이 담긴 Chunk를 저장할 디렉터리
    directory: /loki/chunks

analytics:
  # Loki의 익명 사용 통계를 Grafana Labs에 전송하지 않습니다.
  reporting_enabled: false
```

`/loki`는 Compose의 `loki-data:/loki`와 연결되어 있습니다.  
따라서 Loki Container를 다시 만들어도 `loki-data` Named Volume을 삭제하지 않는 한 저장된 Log는 유지됩니다.  

Fastify는 Host에서 실행하지만 Alloy는 Container에서 실행합니다.  
따라서 Host의 `observability-basics/logs` 디렉터리를 Alloy Container의 `/var/log/observability-basics`에 Bind Mount해야 합니다.  
프로젝트 경로가 다르면 Compose 실행 전에 실제 절대 경로를 지정합니다.  

```bash
export OBSERVABILITY_LOG_DIR=/실제/프로젝트/경로/observability-basics/logs
```

애플리케이션의 `LOG_PATH`와 Bind Mount의 Host 경로가 다르면 Alloy가 파일을 찾을 수 없습니다.  

### 🟦 실행 환경 준비

애플리케이션의 `.env`에는 Log Level과 출력 경로가 필요합니다.  

```dotenv
LOG_LEVEL=info
LOG_PATH=./logs/observability-basics.log
```

`LOG_LEVEL=info`이면 Info, Warn과 Error Log를 모두 기록합니다.  
`LOG_PATH`는 애플리케이션을 실행하는 프로젝트 루트를 기준으로 해석됩니다.  

Docker Compose를 실행하기 전에 Host에서 `logs` 디렉터리를 먼저 만듭니다.  
디렉터리가 없는 상태에서 Compose를 실행하면 Docker가 Bind Mount에 필요한 경로를 `root` 소유로 만들 수 있습니다.  
이 경우 `ubuntu` 계정으로 실행한 Pino가 Log File을 생성하지 못하고 `EACCES` 오류가 발생합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics

# 현재 사용자인 ubuntu 소유로 Log 디렉터리를 먼저 만듭니다.
mkdir -p logs
```

이미 `logs` 디렉터리가 있다면 소유자를 확인합니다.  
소유자가 `root`라면 애플리케이션을 실행하는 `ubuntu` 계정이 Log File을 만들 수 있도록 소유권을 변경합니다.  

```bash
ls -ld ./logs
sudo chown -R ubuntu:ubuntu ./logs
```

Log 디렉터리를 준비한 뒤 Observability Backend를 실행합니다.  

```bash
cd /home/ubuntu/runtimes/observability
docker compose -f docker-compose.metrics.yml up -d
docker compose -f docker-compose.metrics.yml ps
```

그다음 애플리케이션을 실행하고 정상 요청으로 Log File을 만듭니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm run dev
```

```bash
curl -i http://localhost:3000/api/ch08
ls -l ./logs/observability-basics.log
tail -n 5 ./logs/observability-basics.log
```

![로그 예시](/assets/images/nodejs/nodejs-observability/image-2026-10-02.png)  

## 2. Pino 구조화 Log와 Trace Context 연계 {#session-02}

Trace와 Log를 연결하려면 두 신호에 같은 식별자가 있어야 합니다.  
현재 요청의 `traceId`와 `spanId`를 Pino JSON Log에 넣으면 Jaeger의 Trace와 Loki의 Log를 같은 값으로 비교할 수 있습니다.  

| 식별자 | 범위 | 용도 |
| --- | --- | --- |
| `requestId` | Fastify 요청 하나 | 애플리케이션 내부의 요청 Log를 묶습니다. |
| `traceId` | 분산 요청 전체 | 한 Trace에 포함된 모든 Span과 Log를 묶습니다. |
| `spanId` | Trace 안의 작업 하나 | Log가 어느 실행 단계에서 기록됐는지 구분합니다. |

`requestId`는 Fastify가 관리하는 애플리케이션 식별자이고, `traceId`와 `spanId`는 OpenTelemetry가 관리하는 추적 식별자입니다.  
서비스가 여러 개로 늘어나면 공통 `traceId`가 서비스 경계를 넘어 요청을 연결하는 기준이 됩니다.  

### 🟦 활성 Span에서 Trace Context 추출

OpenTelemetry는 현재 비동기 실행 흐름의 Context에 활성 Span을 보관합니다.  
다음 함수는 활성 Span이 유효할 때만 Log에 넣을 식별 정보를 반환합니다.  

```typescript
// src/common/observability/trace-context.ts
import { context, trace } from '@opentelemetry/api';

/**
 * 현재 실행 중인 요청의 Trace 정보를 찾아 Pino Log에 넣을 객체로 반환합니다.
 *
 * OpenTelemetry는 비동기 작업마다 현재 Context를 보관합니다. 이 함수는 그 Context에서
 * 활성 Span을 찾고, Span이 가진 traceId와 spanId를 꺼냅니다. 서버 시작 Log처럼 HTTP 요청과
 * 관계없는 위치에서 호출하면 활성 Span이 없으므로 undefined를 반환합니다.
 */
export function getActiveTraceContext(): TraceLogContext | undefined {
  // 1. context.active()로 현재 비동기 작업의 Context를 가져옵니다.
  // 2. trace.getSpan()으로 그 Context에 연결된 Span을 찾습니다.
  // 3. Span이 있을 때만 ?. 뒤의 spanContext()를 호출해 Trace 식별 정보를 가져옵니다.
  const spanContext = trace.getSpan(context.active())?.spanContext();

  // 활성 Span이 없거나 Trace ID 또는 Span ID가 유효하지 않으면 반환하지 않습니다.
  if (spanContext === undefined || !trace.isSpanContextValid(spanContext)) return undefined;

  // Log에 추가할 Trace 정보를 반환합니다.
  return {
    traceId: spanContext.traceId, // 요청 전체를 구분하는 ID
    spanId: spanContext.spanId, // 현재 작업(Span)을 구분하는 ID
    traceSampled: (spanContext.traceFlags & 0x01) === 0x01, // Trace 수집 대상 여부
  };
}
```

서버 시작처럼 HTTP 요청 밖에서 남긴 Log에는 활성 Span이 없을 수 있습니다.  
따라서 모든 Log에 `traceId`가 있다고 가정하지 않고 값이 있을 때만 연결에 사용합니다.  

### 🟦 Pino 공통 Logger 설정

Fastify는 Logger로 Pino를 사용하므로 별도의 Logger Instance를 만들 필요가 없습니다.  
`mixin()`은 Log가 기록되는 순간의 활성 Span을 읽어 모든 `request.log` 호출에 Trace Context를 자동으로 추가합니다.  

```typescript
// src/config/logger.ts
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { getActiveTraceContext } from '../common/observability/trace-context';
import { env } from './env';

/** Fastify가 사용할 Pino 옵션을 만들고 JSON 로그 파일의 상위 디렉터리를 준비합니다. */
export function createLoggerOptions() {
  // Pino는 없는 디렉터리를 자동으로 만들지 않으므로 Logger 생성 전에 준비해야 합니다.
  mkdirSync(dirname(env.LOG_PATH), { recursive: true });

  return {
    level: env.LOG_LEVEL,
    file: env.LOG_PATH,
    // redact는 로그가 파일에 기록되기 전에 민감한 값을 대체합니다.
    redact: {
      paths: [
        'req.headers.authorization', // Fastify 요청의 인증 헤더
        'req.headers.cookie', //Fastify 요청의 쿠키
        'request.headers.authorization', // Fastify 요청의 인증 헤더
        'request.headers.cookie', // Fastify 요청의 쿠키
        'password', // 일반적인 password 필드
        '*.password', // password 필드가 있는 객체
      ],
      // Pino가 redact.paths에 지정된 민감한 값을 발견했을 때, 원래 값을 어떤 문자열로 대체할지 정하는 설정입니다.
      censor: '[REDACTED]',
    },
    // Pino가 로그를 남길 때마다 현재 요청의 Trace 정보를 로그에 자동으로 추가합니다.
    // mixin은 로그가 기록되는 순간의 OpenTelemetry Context를 읽습니다.
    // HTTP 요청 밖에서 기록한 시작·종료 로그에는 Trace 필드가 추가되지 않습니다.
    mixin() {
      return getActiveTraceContext() ?? {};
    },
  };
}
```

이 옵션을 Fastify 생성 시 적용하면 `request.log.info()`, `warn()`, `error()`가 같은 출력 경로와 Redaction 규칙을 사용합니다.  
예를 들어 다음처럼 비밀번호와 인증 Header가 포함된 객체를 기록한다고 가정합니다.  

```json
{"password":"1234","req":{"headers":{"authorization":"Bearer secret-token"}}}
```

Pino는 `redact.paths`와 일치하는 값을 Log File에 쓰기 전에 다음처럼 가립니다.  

```json
{"password":"[REDACTED]","req":{"headers":{"authorization":"[REDACTED]"}}}
```

```typescript
// src/app.ts
export function createApp() {
  const app = Fastify({
    // 모든 요청 Log에 파일 출력과 Trace Context 규칙을 적용합니다.
    logger: createLoggerOptions(),
  });

  app.setErrorHandler(errorHandler);
  // 기존 Plugin과 Route 등록은 그대로 유지합니다.
  return app;
}
```

오류 내용을 한 문장으로 합치지 않고, 오류 정보와 요청 정보를 각각 이름이 있는 값으로 기록합니다.  
이렇게 기록하면 Loki에서 오류 코드, 요청 ID와 URL을 기준으로 필요한 Log를 쉽게 찾을 수 있습니다.  
Error 객체를 `err`에 넣으면 Pino가 오류 종류, 메시지와 Stack Trace를 JSON으로 자동 변환합니다.  

```typescript
// src/common/errors/error.handler.ts
request.log.error(
  {
    // 실제 오류와 오류가 발생한 요청 정보를 함께 기록합니다.
    err: error,
    code: errorCode,
    requestId: request.id,
    method: request.method,
    url: request.url,
  },
  // Log를 한눈에 알아볼 수 있는 메시지를 함께 기록합니다.
  'Request failed',
);
```

### 🟦 장애 시나리오에서 Span과 Log 연결

`startActiveSpan()`의 Callback 안에서는 새 Span이 활성 Span이 됩니다.  
따라서 Callback에서 Logger를 호출하면 `mixin()`이 바로 그 Span의 `traceId`와 `spanId`를 읽습니다.  

```typescript
// src/ch08/post.service.ts
// HTTP 자동 계측 Span 아래에 전체 처리 시간을 나타내는 Service Span을 만듭니다.
return tracer.startActiveSpan('PostService.runScenario', async (span) => {
  // 같은 Attribute 이름을 사용하면 Jaeger에서 시나리오와 지연 조건을 검색하기 쉽습니다.
  span.setAttributes({
    'app.incident.scenario': scenario,
    'app.incident.delay_ms': options.delay,
    'app.incident.fail': options.fail,
  });

  // mixin이 현재 Service Span의 traceId와 spanId를 Log에 자동으로 추가합니다.
  logger.info({ event: 'incident.started', scenario, ...options }, 'Incident scenario started');

  try {
    // Service Span 안에서 DB 조회 시간을 별도의 자식 Span으로 측정합니다.
    const posts = await tracer.startActiveSpan('database.loadPosts', async (databaseSpan) => {
      try {
        const result = await this.postRepository.findPosts();
        // 조회한 게시글 수를 기록해 데이터 양과 처리 시간을 함께 확인합니다.
        databaseSpan.setAttribute('app.posts.count', result.length);
        return result;
      } catch (error) {
        // DB 조회가 실패하면 해당 Span에도 오류 정보를 기록합니다.
        recordSpanError(databaseSpan, error);
        throw error;
      } finally {
        // 성공하거나 실패해도 Span을 종료해 실행 시간을 확정합니다.
        databaseSpan.end();
      }
    });

    // sleep으로 느린 외부 추천 서비스를 호출하는 상황을 재현합니다.
    await tracer.startActiveSpan('recommendation.calculateScores', async (operationSpan) => {
      try {
        operationSpan.setAttribute('app.operation.delay_ms', options.delay);
        await sleep(options.delay);

        if (options.delay >= SLOW_DEPENDENCY_THRESHOLD_MS) {
          // 오래 걸렸지만 성공할 수 있는 상황은 Warn Log로 기록합니다.
          logger.warn(
            { event: 'dependency.slow', dependency: 'recommendation', delayMs: options.delay },
            'Recommendation dependency responded slowly',
          );
        }

        // fail이 true이면 지연된 뒤 외부 서비스 오류를 발생시킵니다.
        if (options.fail) throw new Error('추천 점수 계산 서비스가 응답하지 않습니다.');
      } catch (error) {
        // 가장 안쪽 Span에 원인을 기록한 뒤 상위 Span으로 오류를 전달합니다.
        recordSpanError(operationSpan, error);
        throw error;
      } finally {
        operationSpan.end();
      }
    });

    // DB 조회와 추천 작업이 모두 성공하면 완료 정보와 결과를 반환합니다.
    span.setAttribute('app.posts.count', posts.length);
    logger.info(
      { event: 'incident.completed', scenario, postsCount: posts.length },
      'Incident scenario completed',
    );

    return {
      status: 'ok',
      postsCount: posts.length,
      delayMs: options.delay,
    } satisfies PostScenarioResult;
  } catch (error) {
    // 자식 Span의 오류를 Service Span에도 기록해 전체 작업이 실패했음을 표시합니다.
    recordSpanError(span, error);

    // err를 사용하면 Pino가 오류 메시지와 Stack Trace를 JSON으로 기록합니다.
    logger.error(
      { err: error, event: 'incident.failed', scenario },
      'Incident scenario failed',
    );
    // 공통 Error Handler가 500 응답과 최종 오류 Log를 만들도록 다시 던집니다.
    throw error;
  } finally {
    // 성공과 실패에 관계없이 Service Span을 종료합니다.
    span.end();
  }
});
```

상위 Service Span과 `database.loadPosts`, `recommendation.calculateScores` 자식 Span은 같은 `traceId`를 공유하지만 `spanId`는 각각 다릅니다.  
Jaeger에서는 실패한 실행 단계를 찾고, Loki에서는 같은 `traceId`의 오류 메시지와 주변 Event를 확인합니다.  

### 🟦 응답과 JSON Log에서 Trace ID 확인

성공 응답에는 현재 HTTP 요청의 Trace ID를 Header와 Body에 전달합니다.  

```typescript
// src/ch08/post.controller.ts
private sendResult(result: PostScenarioResult, reply: FastifyReply) {
  const traceId = getActiveTraceContext()?.traceId ?? null;

  // 자동 계측 없이 실행한 테스트에는 활성 Span이 없으므로 Header를 생략합니다.
  if (traceId !== null) reply.header('x-trace-id', traceId);

  return reply.code(200).send({ ...result, traceId });
}
```

느리지만 성공하는 요청을 보내 응답의 `x-trace-id`와 JSON Log를 비교합니다.  

```bash
curl -i 'http://localhost:3000/api/ch08/incident?delay=1000&fail=false'
tail -n 10 ./logs/observability-basics.log
```

![지연 로그 예시](/assets/images/nodejs/nodejs-observability/image-2026-10-02-1.png)

실패 요청은 성공 응답 코드까지 도달하지 않으므로 `x-trace-id`가 포함되지 않습니다.  
이 경우 Grafana Explore에서 장애 시간과 Service로 Trace를 찾거나 Loki에서 `incident.failed` Event를 먼저 검색합니다.  

## 3. Grafana Alloy·Loki Log 수집 환경 구성 {#session-03}

Loki는 애플리케이션의 파일을 직접 읽지 않습니다.  
Alloy가 새 Log Line을 읽고 JSON Field를 처리한 뒤 Loki의 Push API로 전달합니다.  

```text
local.file_match
       │ 수집할 Log File 경로와 Label 지정(service_name, environment)
       ▼
loki.source.file
       │ Log File 읽기, 새 Log Line
       ▼
loki.process
       │ JSON Parsing, level 값을 Loki의 검색용 Label로 등록
       ▼
loki.write ─▶ Loki 서버로 Log 전송
```

### 🟦 Alloy Log File 수집 설정

실습에서 사용하는 전체 Alloy 설정은 다음과 같습니다.  

```alloy
// /home/ubuntu/runtimes/observability/alloy/config.alloy
// 1. 수집할 Log File 경로와 기본 Label을 지정합니다.
local.file_match "observability_basics" {
  path_targets = [{
    // Alloy Container 내부에서 수집할 Log File 경로 (*.log는 모든 .log 파일)
    "__path__"     = "/var/log/observability-basics/*.log",
    "service_name" = "observability-basics", // Log를 생성한 서비스 이름
    "environment"  = "local", // Log가 발생한 실행 환경
  }]
}

// 2. 지정한 Log File을 읽어 다음 처리 단계로 전달합니다.
loki.source.file "observability_basics" {
  // local.file_match에서 지정한 파일을 수집합니다.
  targets = local.file_match.observability_basics.targets

  // 수집한 Log를 loki.process로 전달합니다.
  forward_to = [loki.process.observability_basics.receiver]
}

// 3. 수집한 JSON Log에서 필요한 값을 추출하고 Loki Label을 설정합니다.
loki.process "observability_basics" {

  // JSON Log에서 level, traceId, spanId, event 값을 추출합니다.
  stage.json {
    expressions = {
      level   = "level",    // Log Level (예: 30=INFO, 50=ERROR)
      traceId = "traceId",  // 요청 전체를 구분하는 Trace ID
      spanId  = "spanId",   // 개별 작업을 구분하는 Span ID
      event   = "event",    // Log가 발생한 이벤트 이름
    }
  }

  // JSON Log에서 추출한 level 값을 Loki의 검색용 Label로 등록합니다.
  // 예: level 값이 50이면 level="50"이라는 Label이 생성됩니다.
  stage.labels {
    values = {
      level = "", // 앞에서 추출한 level 값을 같은 이름의 Label로 등록
    }
  }

  // 요청마다 값이 달라지는 Trace ID를 Label로 등록하면
  // Loki의 Log Stream이 지나치게 많아질 수 있습니다.

  // 처리한 Log를 loki.write로 전달합니다.
  forward_to = [loki.write.local.receiver]
}

// 4. 처리한 Log를 Loki 서버로 전송합니다.
loki.write "local" {
  endpoint {
    // Docker Network 내부에서 접근하는 Loki의 Log 수신 API 주소
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

- `local.file_match`는 Container 안의 수집 경로와 모든 Log Stream에 붙일 기본 Label을 정의합니다.  
- `loki.source.file`은 대상 파일의 새 줄을 읽고 다음 Component로 전달합니다.  
- `loki.process`의 `stage.json`은 Pino JSON에서 검색할 Field를 추출합니다.  
- `stage.labels`는 추출한 값 중 일부를 Loki Label로 등록합니다.  
- `loki.write`는 처리한 Log를 Compose Network의 Loki Push Endpoint로 전송합니다.  

Alloy는 읽은 파일 위치를 `alloy-data` Volume에 저장합니다.  
따라서 Container를 다시 시작해도 매번 파일 전체를 처음부터 보내지 않고 마지막 위치부터 이어서 읽습니다.  

### 🟦 Loki Label과 JSON Field 설계

Loki는 Label 조합마다 별도의 Stream을 만듭니다.  
요청마다 달라지는 값을 Label로 만들면 Stream 수가 급증하는 High Cardinality 문제가 생겨 Index와 Query 비용이 커집니다.  

| 값 | 저장 방식 | 이유 |
| --- | --- | --- |
| `service_name` | Label | 서비스별로 검색 범위를 줄입니다. |
| `environment` | Label | 실행 환경별로 Log를 구분합니다. |
| `level` | Label | 값의 종류가 적어 Stream 분리에 적합합니다. |
| `traceId`, `spanId` | JSON Field | 요청과 작업마다 달라 Label 수가 급증할 수 있습니다. |
| `event`, `delayMs`, `err` | JSON Field | 상세 조건 검색과 원인 확인에 사용합니다. |

`service_name`과 `environment`는 `local.file_match`에서 기본 Label로 붙고, `level`은 JSON Parsing 뒤 Label이 됩니다.  
`traceId`와 `spanId`는 원본 JSON Field로 유지한 뒤 LogQL의 `| json`으로 검색합니다.  

### 🟦 Grafana Data Source Provisioning

Grafana가 시작할 때 Prometheus, Jaeger와 Loki를 자동 등록하도록 다음 파일을 전체 구성합니다.  

```yaml
# /home/ubuntu/runtimes/observability/grafana/provisioning/datasources/datasources.yaml
# Grafana Data Source Provisioning 설정 파일의 버전
apiVersion: 1

# 설정 파일에서 제거된 Data Source는 Grafana에서도 삭제합니다.
prune: true

# Grafana에 자동으로 등록할 Data Source 목록
datasources:

  # 1. Prometheus: HTTP 및 Runtime Metrics 조회
  - name: Prometheus
    uid: prometheus                 # Data Source를 구분하는 고유 ID
    type: prometheus                # 연결할 Data Source 종류
    access: proxy                   # Grafana Server가 Prometheus에 직접 요청
    url: http://prometheus:9090     # Docker Network 내부의 Prometheus 주소
    isDefault: true                 # Grafana의 기본 Data Source로 지정
    editable: true                  # Grafana UI에서 설정 변경 허용

  # 2. Jaeger: 요청별 Trace와 Span 조회
  - name: Jaeger
    uid: jaeger                     # Loki에서 Trace 링크를 연결할 때 사용하는 ID
    type: jaeger                    # Jaeger Data Source 사용
    access: proxy                   # Grafana Server가 Jaeger에 직접 요청
    url: http://jaeger:16686        # Docker Network 내부의 Jaeger 조회 API 주소
    editable: true                  # Grafana UI에서 설정 변경 허용

  # 3. Loki: 애플리케이션 Log 검색 및 분석
  - name: Loki
    uid: loki                       # Data Source를 구분하는 고유 ID
    type: loki                      # Loki Data Source 사용
    access: proxy                   # Grafana Server가 Loki에 직접 요청
    url: http://loki:3100           # Docker Network 내부의 Loki API 주소
    editable: true                  # Grafana UI에서 설정 변경 허용

    # Loki Log에 기록된 Trace ID를 Jaeger Trace와 연결합니다.
    jsonData:
      derivedFields:
        # Log에서 Trace ID를 추출하여 클릭 가능한 링크를 생성합니다.
        - name: TraceID
          # JSON Log의 traceId 필드에서 32자리 16진수 ID를 추출합니다.
          matcherRegex: '"traceId":"([a-f0-9]{32})"'

          # 추출한 Trace ID를 전달할 Jaeger Data Source의 UID
          datasourceUid: jaeger

          # 추출한 Trace ID 원본 값을 Jaeger 조회에 사용합니다.
          # $$는 Grafana가 설정 파일을 읽을 때 $를 변수로 치환하지 않도록 합니다.
          url: '$${__value.raw}'
```

`datasourceUid: jaeger`는 그 값을 Jaeger Data Source에 전달하며, `url: '$${__value.raw}'`는 추출한 원본 값을 Trace 조회 값으로 사용합니다.  
YAML의 `$$`는 Grafana Provisioning에서 `$`를 문자 그대로 보존하기 위한 표기입니다.  

Compose의 다음 Volume Mount가 Host의 Provisioning 파일을 Grafana Container에 제공합니다.  

```yaml
- ./grafana/provisioning:/etc/grafana/provisioning:ro
```

### 🟦 수집 상태와 LogQL 확인

먼저 Container와 Backend 준비 상태를 확인합니다.  

```bash
cd /home/ubuntu/runtimes/observability
docker compose -f docker-compose.metrics.yml ps prometheus jaeger grafana loki alloy
docker compose -f docker-compose.metrics.yml logs --tail=100 alloy
curl -s http://localhost:3100/ready
```

`ready`가 반환되면 `http://localhost:3001`의 **Connections → Data sources**에서 Prometheus, Jaeger와 Loki가 모두 등록됐는지 확인합니다.  
각 Data Source를 열어 **Save & test**가 성공하는지도 확인합니다.  

Grafana의 **Explore**에서 Loki를 선택하고 상황에 맞는 Query를 실행합니다.  
특정 서비스의 Log를 전체 조회합니다. 장애가 발생한 시간대의 Log 흐름을 처음 확인할 때 사용합니다.  

```logql
{service_name="observability-basics", environment="local"}
```

![Grafana Loki 로그 예시](/assets/images/nodejs/nodejs-observability/image-2026-10-02-3.png)

Warn과 Error Log만 조회합니다. Pino의 기본 숫자 Level에서 `40`은 Warn, `50`은 Error입니다.  

```logql
{service_name="observability-basics", environment="local", level=~"40|50"}
| json
```

오류 메시지에 `Request failed`가 포함된 Log를 검색합니다. 정확한 Field를 모를 때 간단히 문자열로 찾을 수 있습니다.  

```logql
{service_name="observability-basics", environment="local"}
|= "Request failed"
```

구조화 Log의 `event` Field로 특정 오류 Event만 조회합니다.  

```logql
{service_name="observability-basics", environment="local"}
| json
| event="incident.failed"
```

Jaeger에서 확보한 Trace ID로 한 요청에서 발생한 Log만 모아 봅니다.  

```logql
{service_name="observability-basics", environment="local"}
| json
| traceId="0123456789abcdef0123456789abcdef"
```

`event`와 `traceId`는 Label이 아니라 JSON Field이므로 `| json`으로 값을 꺼낸 뒤 비교합니다.  
결과가 없다면 Grafana 시간 범위, Host Log File, Bind Mount 경로와 Alloy Log를 순서대로 확인합니다.  

## 4. Grafana Explore에서 Trace 기반 장애 분석 {#session-04}

Grafana Explore에서는 별도의 Jaeger UI를 열지 않고도 Trace를 검색하고 Span 상세 정보를 확인할 수 있습니다.  
이번 장에서는 Jaeger Data Source의 연결 범위를 확인한 뒤, 오류 요청을 만들고 첨부한 분석 화면처럼 실패 원인을 찾습니다.  

Grafana의 **Connections → Data sources → Jaeger**에서 **Save & test**를 실행해 연결 상태를 확인합니다.  

실습시 Grafana `13.2.2`에서 Jaeger v2 `2.21.0`을 연결했을 때는 Grafana Jaeger Data Source에서 Service 목록을 가져오는 요청이 `404 page not found`로 실패했습니다.  

따라서 연결 Grafana에서 jaeger 연결 테스트를 위해 임시로 Jaeger v1 All-in-One 이미지인 `jaegertracing/all-in-one:1.60.0`을 사용하여 별도로 테스트 했습니다.  

### 🟦 오류 요청 생성

다음 요청은 추천 점수 계산을 1초 동안 지연시킨 뒤 오류를 발생시킵니다.  

```bash
# 정상 요청 20건 + 오류 요청 10건
# 총 30건 중 10건 오류 → 예상 Error Rate 33.33%

for i in {1..10}; do
  # 정상 요청 2건
  curl -s 'http://localhost:3000/api/ch08' >/dev/null
  curl -s 'http://localhost:3000/api/ch08' >/dev/null

  # 1초 지연 후 5xx 오류 요청 1건
  curl -s 'http://localhost:3000/api/ch08/incident?delay=1000&fail=true' >/dev/null
done
```

### 🟦 Explore에서 오류 Trace 찾기

Grafana의 **Explore** 메뉴에서 Jaeger Data Source를 선택하고 다음 조건으로 Trace를 검색합니다.  

- **Service Name**: `observability-basics`
- **Operation Name**: `GET /api/ch08/incident`
- **Tags**: `error=true`

검색 결과에서 실행 시간이 약 1초인 Trace를 선택하면 오른쪽에 전체 Span Timeline과 상세 정보가 표시됩니다.  

![Trace 연계 예시](/assets/images/nodejs/nodejs-observability/image-2026-10-02-4.png)

화면에서는 다음 순서로 오류 원인을 확인합니다.  

1. 가장 위의 HTTP Span에서 요청 경로, 응답 상태와 전체 처리 시간을 확인합니다.  
2. `PostService.runScenario` 아래에서 실행 시간이 긴 자식 Span을 찾습니다.  
3. `recommendation.calculateScores` Span의 `app.operation.delay_ms` 값으로 설정한 지연 시간을 확인합니다.  
4. **Events** 영역에서 예외 메시지와 Stack Trace를 확인해 실제 오류가 발생한 코드 위치를 찾습니다.  

이 예시에서는 추천 점수 계산 Span이 약 1초를 사용한 뒤 오류로 끝납니다.  
따라서 전체 요청이 느려진 원인과 실패 원인이 `recommendation.calculateScores` 작업임을 알 수 있습니다.  

### 🟦 같은 요청의 Log 확인

Jaeger에서 확인한 Trace ID를 복사한 뒤 Loki Data Source에서 다음 LogQL Query를 실행합니다.  
그러면 여러 요청의 Log가 섞여 있어도 해당 Trace에서 발생한 Log만 확인할 수 있습니다.  

```logql
{service_name="observability-basics", environment="local"}
| json
| traceId="Jaeger에서_복사한_Trace_ID"
```

이 흐름을 사용하면 Jaeger에서 느리거나 실패한 Span을 찾고, 같은 Trace ID를 가진 Loki Log에서 오류 메시지와 애플리케이션 상태를 이어서 분석할 수 있습니다.  
