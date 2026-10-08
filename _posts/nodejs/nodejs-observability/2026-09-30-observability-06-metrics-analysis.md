---
layout: post
title: "06. Prometheus와 PromQL로 Node.js Metrics 분석"
description: "OpenTelemetry로 수집한 HTTP와 Node.js Runtime Metrics를 Prometheus에서 검증하고 PromQL로 분석합니다. 요청률·에러율·응답 시간과 CPU·Memory·Heap·GC·Event Loop를 함께 살펴보고, 이상 징후를 발견했을 때 원인을 좁히고 대응하는 방법을 알아봅니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prometheus 수집 상태와 Metric 확인"
  - id: session-02
    title: "2. HTTP Request Rate와 Error 분석"
  - id: session-03
    title: "3. HTTP Latency와 Percentile 분석"
  - id: session-04
    title: "4. Process CPU와 Memory 분석"
  - id: session-05
    title: "5. GC와 Event Loop 분석"
  - id: session-06
    title: "6. HTTP와 Runtime Metrics 연계 분석"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

이번 글에서는 Prometheus가 값을 정상적으로 수집하는지 확인하고, PromQL을 이용해 서비스 상태를 분석합니다.  
실무에서는 Metric 하나만 보고 문제의 원인을 판단하지 않습니다.  
먼저 HTTP Request Rate, Error Rate와 응답 시간을 확인하고, 같은 시간대의 CPU, Memory, GC와 Event Loop 상태를 함께 비교합니다.  

이렇게 여러 Metric의 움직임을 연결해서 보면 문제가 다음 중 어디에 가까운지 범위를 좁힐 수 있습니다.  

- 갑작스러운 트래픽 증가
- 특정 API의 오류
- Node.js Process 내부의 CPU 작업
- Memory와 GC 문제
- Event Loop 지연
- DB 또는 외부 API 지연

전체 분석 흐름은 다음과 같습니다.  

```text
OpenTelemetry /metrics
        │ Scrape
        ▼
Prometheus
        │ PromQL
        ▼
HTTP Metrics 확인
Request Rate → Error Rate → Latency
        │
        ▼
Route / Instance로 범위 좁히기
        │
        ▼
Node.js Runtime Metrics 확인
CPU → Memory → GC → Event Loop
        │
        ▼
원인 가설
        │
        ▼
Trace · Profile · Log로 확인
```

Prometheus Metrics는 **문제가 언제 발생했고 어느 영역과 관련 있는지 범위를 좁히는 데 사용하는 관측 정보**라고 생각하면 이해하기 쉽습니다.  
Metric에서 이상 패턴을 찾은 뒤 실제 원인은 Trace, CPU Profile, Heap Snapshot과 Log를 이용해 확인합니다.  
Grafana에 이번 글의 Query를 배치해 Dashboard를 구성하는 방법은 다음 7편에서 이어서 살펴봅니다.  

## 1. Prometheus 수집 상태와 Metric 확인 {#session-01}

PromQL 분석을 시작하기 전에 먼저 Prometheus가 Metrics를 정상적으로 수집하고 있는지 확인해야 합니다.  
Query 결과가 없다고 해서 바로 애플리케이션 문제라고 판단하면 안 됩니다.  
실제로는 Target 설정, Network 또는 Metric 이름이 잘못된 단순한 설정 문제일 수도 있기 때문입니다.  

### 🟦 Prometheus 수집 환경

이번 실습에서는 Node.js 애플리케이션은 Host에서 실행하고 Prometheus는 Docker Container에서 실행합니다.  

```text
Host
├─ Fastify API       :3000
└─ OpenTelemetry     :9464/metrics

Docker Compose
└─ Prometheus        :9090
```

Prometheus는 5초마다 OpenTelemetry의 `/metrics` endpoint를 읽습니다.  

```yaml
# /home/ubuntu/runtimes/observability/prometheus/prometheus.yml

global:
  scrape_interval: 5s

scrape_configs:
  - job_name: observability-basics
    static_configs:
      - targets:
          # Prometheus가 Host의 9464 포트에 접속해서 Metrics를 수집
          - host.docker.internal:9464
```

Linux에서 `host.docker.internal`을 사용하려면 Prometheus Container에 Host Gateway를 연결합니다.  

```yaml
# /home/ubuntu/runtimes/observability/docker-compose.metrics.yml

services:
  prometheus:
    image: prom/prometheus:v3.15.0
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    # Linux에서도 컨테이너가 Host의 :9464 Metrics endpoint에 접근할 수 있게 합니다.
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    # restart: unless-stopped

  grafana:
    image: grafana/grafana:13.2.2
    ports:
      - '3001:3000'
    volumes:
      # Grafana의 Data Source, Dashboard, 사용자 설정 등을 유지합니다.
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
      - jaeger
    # restart: unless-stopped

  jaeger:
    image: jaegertracing/jaeger:2.21.0
    ports:
      - '16686:16686' # Jaeger UI
      - '4317:4317'   # OpenTelemetry OTLP gRPC
      - '4318:4318'   # OpenTelemetry OTLP HTTP
    # restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

Prometheus와 Node.js 애플리케이션을 각각 실행합니다.  

```bash
cd /home/ubuntu/runtimes/observability

docker compose -f docker-compose.metrics.yml up -d
```

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics

npm run dev
```

### 🟦 `up`으로 Target 상태 확인

Prometheus의 **Status → Target health**에서 `observability-basics` Target이 `UP`인지 먼저 확인합니다.  
![Prometheus Target 상태 화면](/assets/images/nodejs/nodejs-observability/image-2026-09-29.png)
PromQL에서도 같은 상태를 확인할 수 있습니다.  

```promql
up{job="observability-basics"}
```

결과는 다음처럼 해석합니다.  

| 값 | 의미 | 우선 확인할 내용 |
| --- | --- | --- |
| `1` | 마지막 Scrape에 성공했습니다. | 필요한 Metric이 실제로 들어오는지 확인합니다. |
| `0` | Target은 있지만 마지막 Scrape에 실패했습니다. | 애플리케이션, `/metrics`, Network와 Target 설정을 확인합니다. |
| 결과 없음 | 해당 label과 일치하는 Target이 없습니다. | `job` 이름과 `prometheus.yml` 적용 여부를 확인합니다. |

Scrape 자체가 느려지거나 수집되는 Sample 수가 갑자기 달라지는지도 확인할 수 있습니다.  

```promql
# 한 번 Metrics를 수집하는 데 걸린 시간
scrape_duration_seconds{job="observability-basics"}
```

```promql
# 한 번 Scrape할 때 Prometheus가 읽어온 Metric Sample 개수
scrape_samples_scraped{job="observability-basics"}
```

`scrape_duration_seconds`가 Scrape 주기인 5초에 가까워지면 Metrics 수집 자체가 밀릴 수 있습니다.  
`scrape_samples_scraped`가 갑자기 줄었다면 애플리케이션이 일부 Metric을 더 이상 노출하지 않는지도 확인합니다.  

### 🟦 실제 Metric 이름과 label 확인

이번 글에서 사용할 주요 Metric은 다음과 같습니다.  

| 영역 | Prometheus Metric | 주요 label |
| --- | --- | --- |
| HTTP 요청 수 | `http_requests_total` | `method`, `route`, `status_code`, `instance` |
| HTTP 응답 시간 | `http_request_duration_seconds_bucket` | `method`, `route`, `status_code`, `le`, `instance` |
| Process CPU | `process_cpu_utilization` | `instance` |
| Process RSS | `process_resident_memory_bytes` | `instance` |
| V8 Heap 사용량 | `v8js_memory_heap_used` | `v8js_heap_space_name`, `instance` |
| V8 Heap 확보 크기 | `v8js_memory_heap_space_size` | `v8js_heap_space_name`, `instance` |
| V8 Heap 여유 공간 | `v8js_memory_heap_space_available_size` | `v8js_heap_space_name`, `instance` |
| GC 실행 시간 | `v8js_gc_duration_bucket` | `v8js_gc_type`, `le`, `instance` |
| Event Loop Delay | `nodejs_eventloop_delay_p50`, `nodejs_eventloop_delay_p90`, `nodejs_eventloop_delay_p99` | `instance` |
| Event Loop 사용률 | `nodejs_eventloop_utilization` | `instance` |

OpenTelemetry Metric 이름의 점(`.`)은 Prometheus에서는 일반적으로 밑줄(`_`)로 변환됩니다.  
여러 서비스를 함께 수집하는 운영 환경에서는 다른 서비스의 값이 섞이지 않도록 각 Metric Selector에 `job="observability-basics"` 또는 환경에서 사용하는 서비스 식별 label을 추가합니다.  

## 2. HTTP Request Rate와 Error 분석 {#session-02}

HTTP 서비스는 먼저 **RED** 관점으로 살펴보면 이해하기 쉽습니다.  

![Http Metrics 실무 Query](/assets/images/nodejs/nodejs-observability/image-2026-09-30-4.png)

| 항목 | 확인할 질문 | 대표 Metric |
| --- | --- | --- |
| Rate | 요청량이 평소보다 늘거나 줄었는가 | `http_requests_total` |
| Errors | 실패 비율과 실제 오류 건수가 증가했는가 | `http_requests_total{status_code=~"5.."}` |
| Duration | 일반 요청과 느린 요청의 응답 시간이 증가했는가 | `http_request_duration_seconds_*` |

HTTP Metrics에서는 단순히 값을 보는 것보다 다음 순서로 문제 범위를 좁히는 것이 중요합니다.  

```text
전체 서비스
   ↓
Route
   ↓
Instance
   ↓
Runtime Metrics 또는 Trace
```

### 🟦 Request Rate 분석

`http_requests_total`은 Process가 시작된 뒤 처리한 HTTP 요청 수를 계속 누적하는 Counter입니다.  
따라서 현재 트래픽을 확인할 때는 누적된 전체 값보다 **일정 시간 동안 요청 수가 얼마나 빠르게 증가했는지**를 봅니다.  
서비스 전체 Request Rate는 다음과 같이 계산합니다.  

```promql
sum(
  rate(http_requests_total[1m])
)
```

`rate(...[1m])`은 최근 1분 동안 Counter가 증가한 속도를 초당 값으로 계산합니다.  
예를 들어 결과가 `12.5`라면 최근 1분 동안 평균적으로 초당 약 12.5건의 요청을 처리했다는 뜻입니다.  
Process가 재시작되면 Counter는 다시 `0`부터 시작하지만, `rate()`는 일반적인 Counter Reset을 고려해서 증가율을 계산합니다.  
Range는 Prometheus Scrape 주기보다 충분히 길게 잡아야 합니다.  
이번 환경의 Scrape 주기는 5초이므로 `1m`과 `5m` 모두 여러 Sample을 포함합니다.  

- `1m`은 최근 변화에 빠르게 반응하지만 값이 자주 흔들릴 수 있습니다.  
- `5m`은 값이 더 안정적이지만 짧은 Spike는 덜 두드러져 보일 수 있습니다.  
- 장애 상황에서는 `1m`과 `5m`을 함께 보면 순간적인 변화인지 지속적인 변화인지 구분하기 쉽습니다.  

![HTTP Request Rate 예시](/assets/images/nodejs/nodejs-observability/image-2026-09-30.png)

전체 Request Rate가 평소와 다르다면 다음으로 **어떤 API에서 변화가 생겼는지** 확인합니다.  

```promql
sum by (method, route) (
  rate(http_requests_total[1m])
)
```

이 Query는 다음과 같이 API별 Request Rate를 구분해서 보여 줍니다.  

```text
GET  /posts
POST /users
GET  /search
```

그다음 특정 Instance에 요청이 몰렸는지도 확인합니다.  

```promql
sum by (instance) (
  rate(http_requests_total[1m])
)
```

`instance`는 같은 서비스를 실행하는 각각의 실행 단위를 의미합니다.  
환경에 따라 서버, Process, Container 또는 Pod가 될 수 있습니다.  

### 예시 1. 여러 API의 Request Rate가 함께 증가하고 Latency와 Error Rate가 안정적이라면

이벤트나 광고로 **실제 사용자 유입이 증가했을 가능성**이 큽니다. 현재 요청을 정상적으로 처리하고 있다면 즉시 조치할 필요는 없습니다.  

- 요청 분산: Instance별 Request Rate가 고른지
- CPU: 높은 사용률이 지속되는지
- Latency: HTTP p95와 p99가 증가하는지
- 처리 용량: 추가 트래픽을 처리할 여유가 있는지

자원 여유가 계속 줄어든다면 Scale-out이나 Instance 증설을 검토합니다.  

### 예시 2. 특정 API의 Request Rate만 크게 증가한다면

특정 기능의 **정상적인 사용 증가인지 비정상적인 반복 호출인지** 구분합니다.  

- 실제 사용량: 이벤트나 신규 기능으로 호출이 늘었는지
- Crawler·Bot: 자동화된 요청이 집중되는지
- Client Retry: 실패한 요청을 과도하게 재시도하는지
- Frontend: 반복 호출이나 잘못된 Polling 주기가 있는지

비정상 호출이라면 Rate Limit과 Cache를 적용하거나 Retry·Polling 정책과 Crawler·Bot 제어를 조정합니다.  

### 예시 3. 전체 Request Rate는 비슷한데 특정 Instance만 높다면

정상 Instance와 비교하여 **특정 Instance에만 요청이 몰리는 이유**를 확인합니다.  

- Load Balancer: 요청을 고르게 분배하는지
- Health Check: 다른 Instance가 정상적으로 요청을 받는지
- 배포 버전: Instance마다 버전이나 설정이 다른지
- Host 상태: CPU와 Memory에 차이가 있는지

### 예시 4. 평소 요청이 들어오던 서비스의 Request Rate가 갑자기 `0`이 된다면

사용자 요청이 사라졌다고 판단하기 전에 **Metrics 수집과 실제 요청 경로를 구분**하여 확인합니다.  

- `up`: Prometheus가 Target을 정상적으로 수집하는지
- `/metrics`: 애플리케이션이 Metrics를 노출하는지
- Load Balancer: 요청을 애플리케이션으로 전달하는지
- Routing: 서비스 경로가 올바른지
- 배포 상태: 애플리케이션이 정상 실행 중인지

Metrics만 끊겼다면 Prometheus 수집 문제를 해결하고, 실제 요청이 끊겼다면 Load Balancer나 Routing을 복구합니다.  

### 🟦 5xx Error Rate와 오류 건수 분석

서버 오류는 단순히 5xx 요청 수만 보기보다 **전체 요청 중 5xx가 차지하는 비율**을 함께 보는 것이 좋습니다.  
최근 5분의 5xx Error Rate는 다음처럼 계산합니다.  

```promql
sum(
  rate(http_requests_total{status_code=~"5.."}[5m])
)
/
sum(
  rate(http_requests_total[5m])
)
```

![에러율 예시](/assets/images/nodejs/nodejs-observability/image-2026-09-30-1.png)

결과가 `0.032`라면 최근 5분 요청의 약 3.2%가 5xx 응답으로 끝났다는 의미입니다.  
전체 Error Rate가 높아졌다면 다음으로 어떤 API에서 오류가 발생했는지 확인합니다.  

```promql
sum by (method, route) (
  rate(http_requests_total{status_code=~"5.."}[5m])
)
/
sum by (method, route) (
  rate(http_requests_total[5m])
)
```

하지만 Error Rate만 보면 상황을 잘못 판단할 수도 있습니다.  
예를 들어 어떤 Route에 요청이 2건 들어왔는데 그중 1건이 실패했다면 Error Rate는 50%입니다.  
숫자만 보면 매우 높아 보이지만 실제 오류는 1건입니다.  
따라서 같은 시간대의 실제 5xx 발생 건수도 함께 확인합니다.  

```promql
sum by (method, route, status_code) (
  increase(http_requests_total{status_code=~"5.."}[5m])
)
```

![에러율 예시-increase](/assets/images/nodejs/nodejs-observability/image-2026-09-30-2.png)

`rate()`와 `increase()`는 용도가 조금 다릅니다.  

- `rate()`는 지정한 시간 구간을 기준으로 1초당 평균 몇 번 발생했는지 보여 줍니다.
- `increase()`는 지정한 시간 동안 총 몇 번 발생했는지 보여 줍니다

`increase()`는 Prometheus가 수집한 Sample을 이용해 구간의 증가량을 추정하기 때문에 `5`, `10`처럼 정확한 정수가 아니라 `5.08`과 같은 소수로 표시될 수도 있습니다.  

### 예시 1. Error Rate와 실제 오류 건수가 함께 증가한다면

**실제 장애일 가능성이 높으므로** 실패가 집중된 Route부터 조사 범위를 좁힙니다.  

- 실패 Route: 오류가 집중된 API를 찾습니다.  
- 최근 배포: 오류 발생 시점과 배포 시점이 겹치는지 확인합니다.  
- Application Log: Exception과 오류 메시지를 확인합니다.  
- Trace: 실패한 요청의 실행 경로를 확인합니다.  
- 공통 의존성: DB, 외부 API와 Middleware 상태를 확인합니다.  

### 예시 2. 배포 직후 특정 Route의 5xx만 증가한다면

오류 발생 시점이 배포와 겹친다면 **해당 Route의 최근 변경 사항**부터 확인합니다.  

- Application Code: 오류가 발생한 처리 로직이 바뀌었는지
- 환경 변수: 새 설정이 누락되거나 잘못 적용됐는지
- DB: Query나 Schema가 함께 변경됐는지
- 외부 API: 호출 방식이나 응답 형식이 달라졌는지
- 입력 데이터: 새 입력값을 올바르게 처리하는지

배포와 오류 발생 시점이 명확하게 일치하고 영향 범위가 크다면 Rollback 또는 Hotfix를 검토합니다.  

### 예시 3. 여러 Route에서 동시에 5xx가 증가한다면

여러 Route가 동시에 실패한다면 개별 코드보다 **여러 요청이 공유하는 의존성**을 먼저 확인합니다.  

- DB: 장애나 Connection Pool 고갈이 발생했는지
- 인증 서비스: 인증 요청이 정상적으로 처리되는지
- 외부 API: 공통으로 호출하는 서비스에 장애가 있는지
- Middleware: 인증·로깅 같은 공통 처리가 실패하는지
- Network: 서비스 간 연결에 문제가 있는지

외부 의존성이 원인이라면 Timeout, Retry와 Circuit Breaker 정책도 함께 점검합니다.  
> Circuit Breaker: 특정 외부 서비스의 실패가 계속될 때 일정 시간 호출을 차단하는 방식입니다.  

### 예시 4. Error Rate는 높지만 실제 오류 건수가 한두 건이라면

요청량이 적으면 오류 한두 건만으로도 비율이 크게 오를 수 있으므로 **Error Rate만 보고 장애로 판단하지 않습니다.**  

- 시간 범위: `5m`에서 `15m`, `30m`으로 넓혀 추세를 확인합니다.  
- 오류 건수: 전체 요청 수와 실제 오류 건수를 함께 확인합니다.  
- 상태 코드: 인증 실패나 잘못된 입력처럼 정상적으로 발생할 수 있는 4xx를 구분합니다.  

필요하면 상태 코드별 Request Rate를 확인합니다.  

```promql
sum by (status_code) (
  rate(http_requests_total[5m])
)
```

이 Query를 사용하면 `200`, `400`, `404`, `500`처럼 각 상태 코드가 어느 정도 발생하고 있는지 흐름을 확인할 수 있습니다.  

## 3. HTTP Latency와 Percentile 분석 {#session-03}

평균 응답 시간은 Histogram의 `_sum` 증가율을 `_count` 증가율로 나누어 계산합니다.  

```promql
sum(
  rate(http_request_duration_seconds_sum[5m])
)
/
sum(
  rate(http_request_duration_seconds_count[5m])
)
```

평균 응답 시간만으로는 일부 느린 요청을 놓칠 수 있습니다.  
예를 들어 대부분의 요청은 100ms 안에 끝나지만 일부 요청만 2초가 걸린다고 가정해 보겠습니다.  
이 경우 평균값의 변화는 생각보다 크지 않을 수 있습니다.  
그래서 운영 환경에서는 p50, p95와 p99를 함께 확인합니다.  

| Percentile | 의미 | 주로 확인하는 내용 |
| --- | --- | --- |
| p50 | 요청의 약 50%가 이 시간 이하에 완료됩니다. | 일반적인 사용자 경험 |
| p95 | 요청의 약 95%가 이 시간 이하에 완료됩니다. | 비교적 느린 요청 |
| p99 | 요청의 약 99%가 이 시간 이하에 완료됩니다. | Tail Latency와 일부 긴 요청 |

p95는 가장 느린 5% 요청의 평균값이 아닙니다.  
p95가 `0.8초`라면 전체 요청의 약 95%가 0.8초 안에 끝났다는 의미입니다.  
`histogram_quantile()`을 이용해 Percentile을 계산합니다.  

```promql
# p50

histogram_quantile(
  0.50,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

```promql
# p95

histogram_quantile(
  0.95,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

```promql
# p99

histogram_quantile(
  0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

`le`는 Histogram Bucket 경계를 나타내는 label입니다.  
Classic Histogram에서 Percentile을 계산할 때 반드시 유지해야 합니다.  
느린 Route를 찾을 때는 `route`도 함께 유지합니다.  

```promql
histogram_quantile(
  0.95,
  sum by (method, route, le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

특정 Instance에서만 느려지는지도 확인할 수 있습니다.  

```promql
histogram_quantile(
  0.95,
  sum by (instance, le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

![Instance p95 응답시간 예시](/assets/images/nodejs/nodejs-observability/image-2026-09-30-3.png)

Percentile은 Histogram Bucket 사이의 값을 이용해 추정한 결과입니다.  
Bucket 간격이 넓으면 실제 응답 시간 분포와 차이가 생길 수 있으므로 지나치게 정밀한 숫자로 해석하지 않는 것이 좋습니다.  

### 예시 1. 평균과 p50, p95, p99가 모두 증가한다면

**서비스 전체가 느려졌을 가능성**이 높습니다. 같은 시간대의 CPU와 Event Loop를 확인하고, Runtime Metrics가 정상이라면 DB나 외부 API Trace로 조사 범위를 넓힙니다.  

### 예시 2. p50은 안정적인데 p95와 p99만 증가한다면

**일부 요청만 느려지고 있을 가능성**이 큽니다. Route별 p95와 p99로 느린 API를 찾은 뒤 Trace에서 다음 항목을 확인합니다.  

- DB: 느린 Query나 Lock이 발생했는지
- Cache: Cache Miss로 처리 시간이 길어졌는지
- 외부 API: 응답 지연이나 Retry가 발생했는지
- 입력 데이터: 특정 입력에서만 무거운 처리가 실행되는지

### 예시 3. 특정 Route만 느리다면

서비스 전체를 튜닝하기보다 **해당 Route 내부의 병목**을 먼저 확인합니다. DB Query가 원인이라면 Index나 Query 구조를 개선하고, 반복 조회 데이터에는 Cache 적용을 검토합니다.  

### 예시 4. 한 Instance에서만 Latency가 높다면

특정 Instance에서만 Latency가 높다면 **정상 Instance와 비교하여 무엇이 다른지** 확인합니다.  

- CPU: 해당 Instance만 사용률이 높은지
- Heap·GC: 메모리 사용량과 GC 빈도·시간이 증가했는지
- Event Loop Delay: Node.js 처리 지연이 발생하고 있는지
- 배포 버전: 다른 Instance와 버전이나 설정이 다른지
- Host 상태: 메모리, 디스크 I/O, 네트워크에 문제가 있는지
- Load Balancer: 해당 Instance에 요청이 과도하게 몰리고 있는지

문제가 특정 Instance에 집중되어 있고 서비스 영향이 크다면 해당 Instance를 **Traffic에서 먼저 제외한 뒤 원인을 조사**할 수 있습니다.  

### 예시 5. Request Rate와 Latency가 함께 증가한다면

현재 시스템이 **처리 용량의 한계에 가까워지고 있을 가능성**이 있습니다. CPU와 Event Loop뿐 아니라 다음 Resource Pool도 확인합니다.  

- DB Connection Pool: Query를 기다리는 요청이 늘어나는지
- HTTP Connection Pool: 외부 요청의 연결 대기가 발생하는지
- Worker Pool: 처리할 작업이 대기하는지
- Queue: 처리 속도보다 작업 유입이 빠른지

처리량 증가에 따라 특정 자원이 포화되고 있다면 Scale-out이나 Pool 설정 조정을 검토합니다.  

## 4. Process CPU와 Memory 분석 {#session-04}

HTTP Metrics가 사용자에게 나타나는 현상을 보여 준다면, Runtime Metrics는 그 문제가 Node.js Process 내부 상태와 관련 있는지 확인하는 데 도움을 줍니다.  
절대값 하나보다 **HTTP Metrics가 변한 같은 시간대에 Runtime Metric도 함께 변했는지** 보는 것이 중요합니다.  

![Runtime Metrics Query](/assets/images/nodejs/nodejs-observability/image-2026-09-30-5.png)

Runtime Metrics는 다음 흐름으로 살펴볼 수 있습니다.  

```text
HTTP Latency 또는 Error 증가
        │
        ├─ CPU 확인
        │
        ├─ Memory / Heap 확인
        │
        ├─ GC 확인
        │
        └─ Event Loop 확인
```

Runtime Metrics가 모두 안정적이라면 Node.js 내부보다 DB, 외부 API와 Network 쪽으로 조사 범위를 넓힐 수 있습니다.  

### 🟦 Process CPU 분석

`process_cpu_utilization`은 Process가 CPU를 얼마나 사용하고 있는지 보여 주는 Gauge Metric입니다.  

```promql
process_cpu_utilization
```

예를 들어 값이 0.7이면, 관측 구간 동안 평균적으로 CPU 코어 1개의 70% 정도를 사용했다고 이해하면 됩니다.

```text
0.5 → CPU 코어 0.5개 사용 ≈ 코어 1개의 50%
1.0 → CPU 코어 1개를 거의 100% 사용
2.0 → CPU 코어 2개를 합쳐 100%씩 사용한 것과 비슷한 수준
```

다만 실제 label 구성은 사용 중인 OpenTelemetry Instrumentation 버전에 따라 달라질 수 있으므로 `/metrics` 출력을 먼저 확인하는 것이 좋습니다.  
최근 5분 동안 CPU가 지속적으로 높았는지 확인하려면 다음처럼 시간 평균을 사용할 수 있습니다.  

```promql
avg_over_time(
  process_cpu_utilization[5m]
)
```

여러 Time Series가 같은 `instance`에 존재하는 환경이라면 실제 label 구성을 확인한 뒤 필요한 경우 다음처럼 Instance 기준으로 집계할 수 있습니다.  

```promql
avg by (instance) (
  avg_over_time(process_cpu_utilization[5m])
)
```

CPU 경고 기준은 Core 수, Container CPU Limit과 평소 사용량에 따라 달라집니다.  
따라서 `70%`, `80%` 같은 숫자 하나만 기준으로 삼기보다 **평소 기준선과 높은 상태가 얼마나 지속되는지**를 함께 보는 것이 좋습니다.  

### 예시 1. Request Rate와 CPU가 함께 증가하지만 Latency가 안정적이라면

증가한 트래픽을 **현재 시스템이 정상적으로 처리하고 있을 가능성**이 큽니다. CPU가 높다는 이유만으로 바로 장애라고 판단할 필요는 없습니다.  

- CPU 분산: Instance별 사용률이 고른지
- Latency: HTTP p95와 p99가 안정적인지
- Event Loop Delay: Node.js 처리 지연이 증가하지 않는지
- 처리 용량: 추가 트래픽을 처리할 CPU 여유가 있는지

CPU 여유가 계속 줄어드는 추세라면 Scale-out 기준이나 Container CPU Limit을 검토합니다.  

### 예시 2. Request Rate는 비슷한데 CPU와 HTTP p99가 함께 증가한다면

트래픽 변화 없이 CPU와 p99가 함께 증가하면 **CPU를 오래 점유하는 코드**가 실행되고 있을 수 있습니다.  

- 데이터 변환: 큰 JSON 직렬화·역직렬화나 대량 배열 처리
- 계산 작업: 암호화, 이미지 처리 또는 긴 반복문
- 정규 표현식: 복잡하거나 입력에 따라 오래 걸리는 패턴
- 동기 작업: Event Loop를 막는 CPU 작업

Route별 HTTP p99로 느린 API를 찾은 뒤 CPU Profile에서 오래 실행되는 함수를 확인합니다.  

CPU를 오래 점유하는 작업이 확인되면 알고리즘과 반복 계산을 개선하고, Cache나 Worker Thread를 적용하거나 별도 Worker·Queue로 분리합니다.  

### 예시 3. 한 Instance의 CPU만 높다면

애플리케이션 전체보다 **해당 Instance나 Host에만 있는 차이**를 확인합니다.  

- Load Balancer: 요청이 특정 Instance에 몰리는지
- Process: 해당 Process만 별도 작업을 수행하는지
- 배포 버전: 다른 Instance와 코드나 설정이 다른지
- Host CPU: Host 자체의 CPU 사용률이 높은지
- 다른 Process: 같은 Host의 다른 Process가 자원을 점유하는지

### 🟦 RSS와 V8 Heap 분석

RSS는 Node.js Process가 실제 RAM에 올려 사용하는 전체 메모리입니다.  
V8 Heap뿐 아니라 다음 영역도 포함합니다.  

- 실행 코드
- Stack
- `Buffer`
- Native Memory
- Native Module이 사용하는 Memory

RSS는 다음 Metric으로 확인합니다.  

```promql
process_resident_memory_bytes
```

V8 Heap Space별 사용량을 합하면 Instance의 전체 Heap Used를 확인할 수 있습니다.  

```promql
sum by (instance) (
  v8js_memory_heap_used
)
```

`v8js_memory_heap_used`는 Heap Space별 Time Series로 수집됩니다.  
`sum by (instance)`를 사용하면 Heap Space 값을 합치면서 Instance 구분은 유지합니다.  

Heap Space별 상태를 확인하려면 `v8js_heap_space_name`을 유지합니다.  

```promql
sum by (instance, v8js_heap_space_name) (
  v8js_memory_heap_used
)
```

이를 이용하면 `new_space`, `old_space`와 같은 영역의 변화를 각각 볼 수 있습니다.  

#### GC 이후 Heap 기준선 확인

Memory Leak을 살펴볼 때는 순간적인 최고값보다 **GC 이후에도 Heap 사용량의 기준선이 계속 높아지는지**를 보는 것이 중요합니다.  
먼저 Instance별 전체 Heap Used를 합산한 뒤 최근 30분의 최저점을 확인합니다.  

```promql
min_over_time(
  (
    sum by (instance) (
      v8js_memory_heap_used
    )
  )[30m:]
)
```

이 Query의 순서는 다음과 같습니다.  

```text
Heap Space별 Heap Used
        ↓
Instance별 전체 Heap Used 합산
        ↓
최근 30분 구간 확인
        ↓
최저점 계산
```

Heap Space별 최저점을 먼저 계산한 뒤 합산하면 서로 다른 시점의 최저값이 더해질 수 있습니다.  
따라서 전체 Heap 기준선을 보고 싶다면 먼저 Heap Space를 합산하고 그 결과의 최저점을 확인하는 편이 더 적절합니다.  
이 Query 역시 정확한 GC 직후의 값만 선택하는 것은 아닙니다.  
최근 구간의 낮은 Heap 수준이 반복해서 높아지는지를 살펴보는 **보조 지표**로 사용하는 것이 좋습니다.  

#### Heap 확보 크기와 여유 공간 확인

V8이 현재 확보한 Heap Space 크기는 다음처럼 확인합니다.  

```promql
sum by (instance) (
  v8js_memory_heap_space_size
)
```

Heap Space에서 추가로 사용할 수 있는 여유 공간도 확인합니다.  

```promql
sum by (instance) (
  v8js_memory_heap_space_available_size
)
```

운영체제가 Heap Space에 실제로 할당한 크기는 다음처럼 확인합니다.  

```promql
sum by (instance) (
  v8js_memory_heap_space_physical_size
)
```

### 예시 1. Heap Used가 증가했다가 다시 이전 수준으로 내려온다면

객체가 생성된 뒤 GC로 정리되는 **일반적인 메모리 사용 패턴**일 수 있습니다. HTTP Latency와 GC Duration도 안정적이라면 특별한 조치가 필요하지 않습니다.  

### 예시 2. Heap의 낮은 수준이 시간이 지나면서 계속 높아진다면

GC 이후의 낮은 수준이 계속 높아진다면 **해제되지 않는 객체가 누적되는지** 확인합니다.  

- Cache: 크기 제한이나 만료 정책이 없는지
- Event Listener·Timer: 사용 후 해제되는지
- 전역 객체: 데이터가 계속 추가되고 있는지
- Closure: 불필요한 객체 참조를 유지하는지
- 요청 데이터: 요청이 끝난 뒤에도 객체가 남아 있는지

Memory Leak이 의심된다면 시간차를 두고 Heap Snapshot을 수집해서 비교합니다.  
Retained Size가 계속 증가하는 객체를 찾고 어떤 코드가 해당 객체를 계속 참조하고 있는지 확인합니다.  

### 예시 3. `old_space`가 계속 증가하고 major GC도 함께 늘어난다면

**오래 살아남는 객체가 많아지고 있을 가능성**이 있습니다. Cache와 장기 객체의 수명을 확인하고 불필요한 참조를 제거합니다.  

### 예시 4. Heap은 안정적인데 RSS만 계속 증가한다면

RSS만 계속 증가한다면 **V8 Heap 밖의 Memory 사용량**을 확인합니다.  

- `Buffer`: 대용량 데이터가 계속 남아 있는지
- Native Module·Library: Native Memory를 과도하게 사용하는지
- 파일 처리: 읽은 데이터를 제때 해제하는지
- Network 처리: 송수신 Buffer가 누적되는지

이 경우 V8 Heap Limit만 늘리는 것은 근본적인 해결책이 아닐 수 있습니다.  

### 예시 5. Heap Used가 확보 크기에 가까워지고 Available Size가 계속 감소한다면

**Heap 압박이 발생하고 있을 가능성**이 있습니다.  

- 객체 누적: 불필요한 객체가 해제되지 않는 원인을 먼저 제거합니다.  
- 정상 Workload: 실제로 많은 Memory가 필요하다면 Instance Memory와 V8 Heap Limit을 조정합니다.  
- RSS: V8이 확보한 Memory를 즉시 반환하지 않을 수 있으므로 GC 직후 RSS만으로 Memory Leak을 판단하지 않습니다.  

## 5. GC와 Event Loop 분석 {#session-05}

GC Duration은 Histogram Metric입니다.  
`v8js_gc_type` label을 통해 다음과 같은 GC 유형을 구분할 수 있습니다.  

- `minor`
- `major`
- `incremental`
- `weakcb`

먼저 최근 5분 동안 각 GC 유형이 초당 얼마나 실행됐는지 확인합니다.  

```promql
sum by (instance, v8js_gc_type) (
  rate(v8js_gc_duration_count[5m])
)
```

이 값은 GC 실행 횟수 자체가 아니라 **초당 GC 실행률**입니다.  
예를 들어 결과가 `0.2`라면 평균적으로 약 5초에 한 번 GC가 실행된 것으로 볼 수 있습니다.  
GC 유형별 평균 Duration은 실행 시간 증가율을 실행 횟수 증가율로 나누어 계산합니다.  

```promql
sum by (instance, v8js_gc_type) (
  rate(v8js_gc_duration_sum[5m])
)
/
sum by (instance, v8js_gc_type) (
  rate(v8js_gc_duration_count[5m])
)
```

평균값에 가려지는 긴 GC를 확인하려면 p95도 확인합니다.  

```promql
histogram_quantile(
  0.95,
  sum by (instance, v8js_gc_type, le) (
    rate(v8js_gc_duration_bucket[5m])
  )
)
```

### 예시 1. `minor` GC Rate만 증가하고 Duration이 짧다면

**수명이 짧은 객체가 많이 생성되고 있을 가능성**이 있습니다. HTTP Latency가 안정적이라면 바로 장애로 판단할 필요는 없지만, GC가 매우 빈번하다면 임시 객체 생성을 확인합니다.  

- 배열: 반복적으로 복사하는지
- 배열 함수: `map`, `filter`, `reduce`를 과도하게 중첩하는지
- 데이터 변환: 큰 JSON 변환이나 문자열 조합이 반복되는지
- 요청 처리: 요청마다 많은 임시 객체를 만드는지

CPU Profile이나 Allocation Profile을 이용해 객체 생성이 많은 코드를 찾고, 불필요한 중간 객체와 배열 생성을 줄입니다.  

### 예시 2. `major` GC Rate와 GC p95가 함께 증가하고 Heap 여유 공간이 감소한다면

**Heap 압박이 발생하고 있을 가능성**이 있습니다. 다음 순서로 오래 살아남는 객체가 증가하는지 확인합니다.  

- Available Size: 사용할 수 있는 Heap 공간이 계속 감소하는지
- `old_space`: 오래 살아남는 객체가 증가하는지
- Heap 기준선: GC 이후의 낮은 수준이 계속 높아지는지
- Heap Snapshot: 어떤 객체와 참조가 Memory를 유지하는지

특히 크기 제한이 없는 Cache, 해제되지 않은 Event Listener, 전역 객체와 요청 종료 후에도 남는 참조를 확인합니다.  
단순히 `--max-old-space-size`를 늘리는 것은 근본적인 해결책이 아닐 수 있습니다.  
Memory Leak 때문인지, 정상적으로 많은 Memory가 필요한 Workload인지 먼저 구분합니다.  

### 예시 3. GC Rate와 GC p95, HTTP p99가 같은 시간대에 증가한다면

세 Metric이 함께 증가하면 **GC와 객체 할당이 요청 지연에 영향을 주는지** 확인합니다.  

- Instance 비교: GC p95와 HTTP p99가 같은 Instance에서 증가하는지
- Route 비교: HTTP p99가 높은 API가 무엇인지
- Trace: 느린 요청에서 시간이 오래 걸린 구간이 어디인지
- Allocation·Heap Profile: 객체를 많이 생성하거나 유지하는 코드가 무엇인지

대량 객체 생성이나 JSON 처리가 원인으로 확인된다면 해당 로직을 최적화합니다.  
다만 Metric이 같은 시점에 움직였다는 사실만으로 GC가 HTTP 지연의 직접적인 원인이라고 단정하면 안 됩니다.  
Trace와 Profile로 실제 실행 흐름을 확인하는 것이 중요합니다.  

### 🟦 GC가 없는 구간의 No data와 0 구분

GC가 발생하지 않은 구간에서는 평균 Duration이나 p95가 표시되지 않을 수 있습니다.  

먼저 같은 구간의 GC Count가 실제로 증가했는지 확인합니다.  

```promql
sum by (instance, v8js_gc_type) (
  rate(v8js_gc_duration_count[5m])
)
```

결과는 다음처럼 구분해서 봅니다.  

```text
GC Count 증가 없음
→ 해당 구간에 실제 GC가 없었을 가능성이 높음

Duration Query가 No data 또는 NaN
→ Percentile을 계산할 유효한 GC 관측값이 없는지 확인

GC Count는 증가
Duration Query만 비정상
→ Histogram Bucket, label과 PromQL 집계 조건 확인
```

`No data`와 `Duration = 0`은 같은 의미가 아닙니다.  

Grafana에서도 값이 없는 상태를 임의로 `0 ms`로 표현하지 않도록 Panel 설정을 확인하는 것이 좋습니다.  

### 🟦 Event Loop Delay와 Utilization 분석

Event Loop Delay는 예정된 Timer나 Callback이 실제로 실행될 때까지 추가로 기다린 시간을 의미합니다.  
p50은 일반적인 지연을 확인할 때 사용합니다.  

```promql
nodejs_eventloop_delay_p50
```

p99는 일부 구간에서 발생하는 큰 지연을 확인하는 데 유용합니다.  

```promql
nodejs_eventloop_delay_p99
```

가장 큰 지연값도 확인할 수 있습니다.  

```promql
nodejs_eventloop_delay_max
```

Max는 한 번의 Spike에도 크게 영향을 받습니다.  
따라서 Max 하나만 보고 판단하기보다 p99와 지연이 얼마나 지속됐는지를 함께 보는 것이 좋습니다.  
Event Loop Utilization은 Event Loop가 실제 작업을 수행한 시간의 비율입니다.  

```promql
nodejs_eventloop_utilization
```

### 예시 1. Event Loop Utilization, Delay p99와 CPU가 함께 증가한다면

**CPU 집약적인 동기 작업이 Event Loop를 오래 점유하고 있을 가능성**이 있습니다.  

- Route: HTTP p99가 높은 API를 찾습니다.  
- CPU Profile: 오래 실행되는 함수가 무엇인지 확인합니다.  
- 계산 작업: 긴 반복문, 암호화나 이미지 처리가 있는지 확인합니다.  
- 데이터 처리: 큰 JSON 직렬화나 복잡한 정규 표현식이 있는지 확인합니다.  
- 동기 I/O: 동기식 파일 처리가 Event Loop를 막는지 확인합니다.  

원인이 확인되면 알고리즘과 불필요한 연산을 개선하고, Worker Thread나 별도 Worker Process·Queue로 작업을 분리합니다.  

### 예시 2. Event Loop Utilization은 높지만 Delay와 HTTP Latency가 안정적이라면

Event Loop가 바쁘더라도 Latency가 안정적이라면 **아직 요청을 제시간에 처리하고 있는 상태**일 수 있습니다. 즉시 장애로 판단하기보다 현재 처리량과 남은 용량을 확인합니다.  

### 예시 3. HTTP p99는 높지만 Event Loop Delay가 안정적이라면

Node.js 내부 CPU 작업보다 **Process 밖의 응답을 기다리는 상황**을 먼저 확인합니다.  

- DB Query·Lock: Query 실행이나 Lock 대기가 길어지는지
- DB Connection Pool: Connection을 얻기 위해 대기하는지
- 외부 API: 호출한 서비스의 응답이 느린지
- Network: 서비스 간 통신이 지연되는지

같은 시간대의 느린 Trace에서 DB Span과 HTTP Client Span을 비교하면 어디에서 시간이 오래 걸렸는지 확인하기 쉽습니다.  

### 예시 4. p50은 안정적인데 p99와 Max만 증가한다면

대부분의 요청은 정상이지만 **일부 요청에서만 긴 동기 작업이나 Callback 폭주가 발생할 가능성**이 있습니다. Route별 p99와 Trace를 이용해 특정 입력이나 코드 경로에 문제가 집중되는지 확인합니다.  

## 6. HTTP와 Runtime Metrics 연계 분석 {#session-06}

실무에서는 Runtime Metric 하나만 보고 조치하기보다 HTTP Metrics와 같은 시간대의 움직임을 함께 봅니다.  
다음 패턴을 기억해 두면 장애 원인을 좁히는 데 도움이 됩니다.  

| 관측한 변화 | 가능한 상황 | 우선 확인할 내용 | 대응 방향 |
| --- | --- | --- | --- |
| Request Rate·CPU 증가, Latency 안정 | 트래픽 증가를 정상 처리 | Instance별 부하, 남은 CPU | 필요하면 Scale-out 준비 |
| 5xx Error Rate·오류 건수 증가 | 실제 서버 오류 증가 | 실패 Route, Log, 최근 배포 | Rollback, Hotfix 또는 의존성 복구 |
| CPU·Event Loop Delay·HTTP p99 증가 | 동기 작업이 Event Loop 점유 | 느린 Route, CPU Profile | 코드 최적화, Worker 분리 |
| Heap 기준선·major GC·HTTP p99 증가 | Heap 압박 가능성 | `old_space`, Heap Snapshot | Cache와 객체 참조 정리 |
| RSS 증가, Heap 안정 | Heap 밖 Memory 증가 | `Buffer`, Native Module | 외부 Memory 사용 원인 확인 |
| HTTP p99 증가, Runtime 안정 | Process 외부 지연 | DB, 외부 API, Network Trace | Query와 외부 의존성 최적화 |
| 한 Instance만 Rate·Latency 증가 | 요청 분배 또는 개별 Process 문제 | LB, 배포, Host 상태 | 분배 조정 또는 Instance 격리 |

예를 들어 Request Rate는 비슷한데 CPU, Event Loop Delay와 HTTP p99가 함께 증가했다고 가정해 보겠습니다.  
이 경우 큰 JSON 처리나 긴 반복문 같은 동기 작업이 Event Loop를 막고 있을 가능성을 생각할 수 있습니다.  
Route별 HTTP p99로 느린 API를 찾고 CPU Profile에서 오래 실행되는 함수를 확인합니다.  
반대로 HTTP p99는 증가했지만 CPU, Heap, GC와 Event Loop가 모두 안정적이라면 Node.js Process 내부보다 DB나 외부 API를 기다리는 시간이 길어진 상황일 가능성이 높습니다.  
이 경우 Runtime을 계속 조사하기보다 Trace에서 DB Query와 외부 요청 Span을 확인하는 편이 더 빠릅니다.  

전체 흐름을 단순하게 정리하면 다음과 같습니다.  

```text
HTTP p99 증가
│
├─ CPU + Event Loop Delay 증가
│   └─ 동기 작업 확인
│      → CPU Profile
│      → 코드 최적화
│
├─ Heap 기준선 + major GC 증가
│   └─ Heap 압박 확인
│      → Heap Snapshot
│      → Cache / 객체 참조 확인
│
└─ Runtime Metrics 변화 없음
    └─ Process 외부 지연 확인
       → DB
       → 외부 API
       → Network Trace
```

Prometheus에서 Metric이 같은 시점에 움직였다는 사실만으로 원인과 결과가 확정되지는 않습니다.  
Metrics의 역할은 **문제가 발생한 시간과 구성 요소를 빠르게 좁히는 것**입니다.  
그다음 단계에서는 Trace, CPU Profile, Heap Snapshot과 Log를 이용해 실제 원인을 확인합니다.  

다음 7편에서는 이번 글에서 사용한 PromQL을 Grafana Panel에 배치하고, HTTP와 Node.js Runtime 상태를 한 화면에서 비교할 수 있는 Dashboard를 구성해 보겠습니다.  
