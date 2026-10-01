---
layout: post
title: "06. Prometheus와 Grafana로 Node.js Metrics 분석"
description: "Prometheus에서 HTTP 요청률·에러율·Latency와 Node.js Runtime Metrics를 조회합니다. Grafana Dashboard에서 CPU·Memory·Heap·GC·Event Loop를 함께 시각화하고 이상 구간을 Jaeger Trace 분석으로 연결합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prometheus에서 Metrics 조회와 기본 분석"
  - id: session-02
    title: "2. Histogram과 Request Latency 분석"
  - id: session-03
    title: "3. Grafana Dashboard 구성"
  - id: session-04
    title: "4. Metrics 종합 분석과 Trace 연계"
---

5편에서는 Fastify HTTP 요청과 Node.js Runtime 상태를 OpenTelemetry Metrics로 수집하고 `/metrics` endpoint에 노출했습니다.  
이번 글에서는 Prometheus로 수집 상태를 확인하고 PromQL로 요청률, 에러율과 Latency를 계산합니다.  
Grafana에서는 HTTP와 Runtime Metrics를 같은 시간축에 배치하고, 이상 징후가 나타난 구간을 Jaeger Trace 분석으로 연결합니다.  

```text
OpenTelemetry /metrics
        │ Scrape
        ▼
Prometheus
        │ PromQL
        ▼
Grafana Dashboard
        │ 이상 시간대와 Route 확인
        ▼
Jaeger Trace
```

## 1. Prometheus에서 Metrics 조회와 기본 분석 {#session-01}

### 🟦 Prometheus, Grafana와 Jaeger 실행 환경

Node.js 애플리케이션은 Host에서 실행하고 Prometheus, Grafana와 Jaeger는 Docker Compose로 실행합니다.  

```text
Host
├─ Fastify API       :3000
└─ OpenTelemetry     :9464/metrics

Docker Compose
├─ Prometheus        :9090
├─ Grafana           :3001
└─ Jaeger            :16686, :4317, :4318
```

`/home/ubuntu/runtimes/observability/docker-compose.metrics.yml`에 세 서비스를 구성합니다.  

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.15.0
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    extra_hosts:
      # Linux Container에서 Host의 :9464 endpoint에 접근합니다.
      - 'host.docker.internal:host-gateway'

  grafana:
    image: grafana/grafana:13.2.2
    ports:
      - '3001:3000'
    depends_on:
      - prometheus
      - jaeger

  jaeger:
    image: jaegertracing/jaeger:2.21.0
    ports:
      - '16686:16686'
      - '4317:4317'
      - '4318:4318'
```

Prometheus는 5초마다 Host의 Metrics endpoint를 읽습니다.  

```yaml
# /home/ubuntu/runtimes/observability/prometheus/prometheus.yml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: observability-basics
    static_configs:
      - targets:
          - host.docker.internal:9464
```

`host.docker.internal`은 Container에서 Host를 가리키는 이름입니다.  
Compose의 `extra_hosts`는 Linux 환경에서도 이 이름을 Docker Host의 Gateway 주소로 해석할 수 있게 합니다.  

### 🟦 서비스와 애플리케이션 실행

Prometheus, Grafana와 Jaeger를 Docker Compose로 실행합니다.  

```bash
cd /home/ubuntu/runtimes/observability
docker compose -f docker-compose.metrics.yml up -d
docker compose -f docker-compose.metrics.yml ps
```

세 서비스의 기본 접속 주소는 다음과 같습니다.  

| 도구 | 주소 | 역할 |
| --- | --- | --- |
| Prometheus | `http://localhost:9090` | Metrics 수집과 PromQL 조회 |
| Grafana | `http://localhost:3001` | Metrics Dashboard 구성 |
| Jaeger | `http://localhost:16686` | 요청별 Trace 조회 |

애플리케이션도 별도 Terminal에서 실행합니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/observability-basics
npm run dev
```

### 🟦 Prometheus Target과 수집 상태 확인

Prometheus의 **Status → Target health** 화면에서 `observability-basics` Target을 확인합니다.  
상태가 `UP`이면 Prometheus가 `host.docker.internal:9464/metrics`를 정상적으로 읽고 있다는 뜻입니다.  

![Prometheus Target 상태 화면](/assets/images/nodejs/nodejs-observability/image-2026-09-29.png)

Target이 `DOWN`이면 다음 순서로 범위를 좁힙니다.  

1. Host에서 `http://localhost:9464/metrics`가 열리는지 확인합니다.  
2. `npm run dev`가 `instrumentation.ts`를 먼저 불러오는지 확인합니다.  
3. `prometheus.yml`의 Target이 `host.docker.internal:9464`인지 확인합니다.  
4. Linux 환경에서 Compose의 `extra_hosts`가 설정되어 있는지 확인합니다.  

Prometheus Expression Browser에서 `up`을 실행해도 수집 상태를 확인할 수 있습니다.  

```promql
up{job="observability-basics"}
```

결과가 `1`이면 Scrape가 성공한 상태이고 `0`이면 Target에 연결하지 못한 상태입니다.  

### 🟦 HTTP Request Rate 분석

Counter는 Process가 시작된 뒤의 누적 요청 수입니다.  
현재 누적값보다 일정 시간 동안 증가한 속도를 보는 편이 서비스 상태를 해석하기 쉽습니다.  

```promql
sum(rate(http_requests_total[1m]))
```

`rate(...[1m])`은 최근 1분 동안 Counter가 초당 얼마나 증가했는지 계산합니다.  
결과가 `12.5`라면 최근 1분의 변화량을 기준으로 초당 약 12.5건을 처리했다는 뜻입니다.  

Route별 요청률은 `route` label을 유지해서 집계합니다.  

```promql
sum by (method, route) (
  rate(http_requests_total[1m])
)
```

전체 Request Rate가 증가해도 특정 Route만 증가했을 수 있으므로 전체 값과 Route별 값을 함께 확인합니다.  

### 🟦 HTTP 5xx Error Rate 분석

`status_code`가 `5`로 시작하는 요청률을 전체 요청률로 나누면 최근 5분의 5xx 비율을 계산할 수 있습니다.  

```promql
sum(
  rate(http_requests_total{status_code=~"5.."}[5m])
)
/
sum(
  rate(http_requests_total[5m])
)
```

결과가 `0.05`이면 최근 5분 동안 전체 요청의 약 5%가 5xx 응답으로 끝났다는 의미입니다.  
Grafana에서는 Unit을 `Percent (0.0-1.0)`으로 지정하면 `5%`로 표시할 수 있습니다.  

전체 요청이 없는 구간에서는 분모가 0이 되어 값이 표시되지 않을 수 있습니다.  
이는 에러율이 0이라는 뜻과 다르므로 같은 시간대의 Request Rate를 함께 확인합니다.  

### 🟦 Runtime Metrics 조회

먼저 Prometheus의 Metric 자동 완성이나 `/metrics` 출력에서 실제 이름을 확인합니다.  
OpenTelemetry Runtime Instrumentation 버전과 Exporter의 단위 변환에 따라 suffix가 달라질 수 있습니다.  

예제 환경에서는 다음 계열을 중심으로 조회합니다.  

```promql
process_cpu_utilization
```

```promql
process_resident_memory_bytes
```

Heap Space별 사용량을 모두 더하면 V8 Heap의 전체 사용량을 확인할 수 있습니다.  

```promql
sum(v8js_memory_heap_used_bytes)
```

Heap Space별 변화를 따로 보려면 이름 attribute를 유지합니다.  
Prometheus Exporter가 attribute의 점을 밑줄로 변환하므로 실제 label 이름은 `/metrics` 출력에서 확인합니다.  

```promql
sum by (v8js_heap_space_name) (
  v8js_memory_heap_used_bytes
)
```

Event Loop Delay p99는 다음과 같이 조회합니다.  

```promql
nodejs_eventloop_delay_p99_seconds
```

GC는 Histogram이므로 최근 GC 횟수와 평균 정지 시간을 나누어 확인합니다.  

```promql
sum(rate(v8js_gc_duration_seconds_count[5m]))
```

```promql
sum(rate(v8js_gc_duration_seconds_sum[5m]))
/
sum(rate(v8js_gc_duration_seconds_count[5m]))
```

첫 번째 Query는 초당 GC 실행 횟수이고 두 번째 Query는 최근 5분 동안 관측한 평균 GC Duration입니다.  
GC가 없는 구간에는 평균값이 표시되지 않을 수 있으므로 실행 횟수와 함께 해석합니다.  

## 2. Histogram과 Request Latency 분석 {#session-02}

### 🟦 Histogram Bucket 구조

Histogram은 개별 응답 시간을 모두 저장하지 않고, 미리 정한 경계 이하에 들어온 요청 수를 누적합니다.  

![Histogram Bucket 경계와 누적값 해석](/assets/images/nodejs/nodejs-observability/05-histogram-bucket-cumulative.png)

예를 들어 `80ms` 요청 한 건은 다음 Bucket에 함께 포함됩니다.  

```text
le="0.05"    포함되지 않음
le="0.075"   포함되지 않음
le="0.1"     포함됨
le="0.25"    포함됨
le="0.5"     포함됨
le="+Inf"    포함됨
```

`le="0.25"` 값이 `92`라면 100~250ms 구간에 92건이 있다는 뜻이 아닙니다.  
250ms 이하에서 처리된 누적 요청 수가 92건이라는 의미입니다.  

```text
http_request_duration_seconds_bucket  경계별 누적 요청 수
http_request_duration_seconds_count   전체 관측 수
http_request_duration_seconds_sum     관측한 응답 시간의 합
```

Bucket 경계가 실제 서비스의 Latency 범위를 충분히 나누는지도 확인해야 합니다.  
대부분의 요청이 50~500ms인데 경계가 100ms와 1초뿐이면 그 사이의 분포를 세밀하게 구분하기 어렵습니다.  

### 🟦 평균과 Percentile 차이

평균 응답 시간은 `_sum`을 `_count`로 나누어 계산합니다.  

```promql
sum(rate(http_request_duration_seconds_sum[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))
```

평균만 보면 일부 요청에서 발생하는 큰 지연이 가려질 수 있습니다.  
예를 들어 대부분의 요청이 100ms에 끝나고 소수의 요청만 2초가 걸리면 평균은 두 집단의 차이를 충분히 보여 주지 못할 수 있습니다.  

Percentile은 요청을 빠른 순서로 정렬했을 때 일정 비율의 요청이 해당 값 이하에서 끝났음을 나타냅니다.  

| Percentile | 의미 |
| --- | --- |
| p50 | 전체 요청의 약 50%가 이 시간 이하에 끝납니다. |
| p95 | 전체 요청의 약 95%가 이 시간 이하에 끝납니다. |
| p99 | 전체 요청의 약 99%가 이 시간 이하에 끝납니다. |

p95는 가장 느린 5% 요청의 평균이 아닙니다.  
p95가 0.8초라면 약 95%가 0.8초 이하에 끝나고 나머지 약 5%가 이를 초과했다는 의미입니다.  

### 🟦 p50, p95와 p99 계산

Prometheus는 누적 Bucket의 증가율에 `histogram_quantile()`을 적용해 Percentile을 추정합니다.  

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

`sum by (le)`는 Percentile 계산에 필요한 Bucket 상한을 유지하면서 Route, 상태 코드와 Instance를 합칩니다.  
특정 Route의 Latency를 보고 싶다면 `route`도 유지합니다.  

```promql
histogram_quantile(
  0.95,
  sum by (route, le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

### 🟦 Tail Latency 해석

p95와 p99처럼 분포의 느린 끝부분을 Tail Latency라고 합니다.  

- p50·p95·p99가 모두 증가하면 공통 DB 지연, 외부 의존성이나 전체 부하 증가를 먼저 확인합니다.  
- p50은 비슷하고 p99만 증가하면 일부 요청에서 발생하는 DB Lock, GC 정지, Event Loop 정체나 재시도를 확인합니다.  
- 특정 Route의 p95만 증가하면 해당 Route의 Service와 DB Span으로 범위를 좁힙니다.  

Percentile은 Bucket 분포로 추정한 값이므로 개별 요청을 직접 정렬한 정확한 값과 차이가 있을 수 있습니다.  
짧은 시간의 한 점만으로 결론을 내리지 않고 같은 조건에서 여러 번 관찰합니다.  

## 3. Grafana Dashboard 구성 {#session-03}

### 🟦 Prometheus Data Source 연결

Grafana는 Metrics를 직접 수집하지 않고 Prometheus의 PromQL 결과를 시각화합니다.  
`http://localhost:3001`에 로그인한 뒤 다음 순서로 Data Source를 추가합니다.  

1. **Connections → Data sources**로 이동합니다.  
2. **Add new data source**를 선택합니다.  
3. **Prometheus**를 선택합니다.  
4. Prometheus Server URL에 `http://prometheus:9090`을 입력합니다.  
5. **Save & test**를 선택합니다.  

Grafana도 Container 안에서 실행되므로 `localhost:9090`이 아니라 Compose 서비스 이름인 `prometheus`를 사용합니다.  

### 🟦 Request Rate와 Error Rate Panel

새 Dashboard에서 **Add visualization**을 선택하고 다음 Panel을 구성합니다.  

| Panel | PromQL | 권장 Unit |
| --- | --- | --- |
| Request Rate | `sum(rate(http_requests_total[1m]))` | `req/s` |
| Error Rate | 5xx 요청률 ÷ 전체 요청률 | `Percent (0.0-1.0)` |

Error Rate Panel에는 다음 Query를 입력합니다.  

```promql
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

Panel 이름, 범례와 단위를 함께 지정하면 값의 의미를 다시 확인하지 않고도 Dashboard를 읽을 수 있습니다.  

### 🟦 p50, p95와 p99 Latency Panel

Request Latency Panel 하나에 p50, p95와 p99 Query를 각각 추가합니다.  
세 Query의 구조는 같고 `histogram_quantile()`의 첫 번째 값만 다릅니다.  

```promql
histogram_quantile(
  0.50,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

```promql
histogram_quantile(
  0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

Legend를 각각 `p50`, `p95`, `p99`로 지정하고 Unit은 `seconds (s)`를 사용합니다.  

![HTTP Request Rate, Error Rate와 Latency Panel 예시](/assets/images/nodejs/nodejs-observability/image-2026-09-29-2.png)

### 🟦 CPU, Memory와 Heap Panel

Runtime 상태는 HTTP Panel과 같은 시간 범위에 배치해야 서로의 변화를 비교하기 쉽습니다.  

| Panel | PromQL | 권장 Unit |
| --- | --- | --- |
| Process CPU | `process_cpu_utilization` | `Percent (0.0-1.0)` |
| Process RSS | `process_resident_memory_bytes` | `bytes (IEC)` |
| V8 Heap Used | `sum(v8js_memory_heap_used_bytes)` | `bytes (IEC)` |

Heap Space별 변화를 보고 싶다면 다음 Query를 사용하고 Legend에 Heap Space label을 표시합니다.  

```promql
sum by (v8js_heap_space_name) (
  v8js_memory_heap_used_bytes
)
```

RSS와 Heap Used가 함께 증가하는지, Heap은 감소하는데 RSS가 높은 상태로 유지되는지를 비교합니다.  
두 값의 차이만으로 Memory Leak을 단정하지 않고 충분한 시간 범위와 GC 이후의 기준선을 확인합니다.  

### 🟦 GC와 Event Loop Panel

GC와 Event Loop는 Tail Latency가 증가한 이유를 좁힐 때 유용합니다.  

| Panel | PromQL | 권장 Unit |
| --- | --- | --- |
| GC Rate | `sum(rate(v8js_gc_duration_seconds_count[5m]))` | `ops/s` |
| Average GC Duration | GC Duration Sum 증가율 ÷ Count 증가율 | `seconds (s)` |
| Event Loop Delay p99 | `nodejs_eventloop_delay_p99_seconds` | `seconds (s)` |
| Event Loop Utilization | `nodejs_eventloop_utilization` | `Percent (0.0-1.0)` |

Average GC Duration Panel에는 다음 Query를 사용합니다.  

```promql
sum(rate(v8js_gc_duration_seconds_sum[5m]))
/
sum(rate(v8js_gc_duration_seconds_count[5m]))
```

Runtime Metric 이름은 설치한 Instrumentation과 Exporter 버전에 따라 달라질 수 있습니다.  
Panel Query가 결과를 반환하지 않으면 `/metrics` 출력과 Prometheus의 Metric 자동 완성에서 실제 이름을 먼저 확인합니다.  

## 4. Metrics 종합 분석과 Trace 연계 {#session-04}

### 🟦 테스트 요청과 부하 발생

응답 시간이 다른 요청과 오류 요청을 만들어 HTTP Metrics의 변화를 확인합니다.  

```bash
for delay in 50 50 50 300 300 1000; do
  curl -s "http://localhost:3000/api/ch05/posts?delay=${delay}" > /dev/null
done

curl -s "http://localhost:3000/api/ch05/error" > /dev/null
```

동시 요청을 만들어 요청량이 증가한 구간도 관찰합니다.  

```bash
seq 1 100 \
  | xargs -P10 -I{} \
    curl -s "http://localhost:3000/api/ch05/posts?delay=300" -o /dev/null
```

`sleep()`으로 만든 지연은 Event Loop를 막지 않으므로 Event Loop Delay나 CPU가 반드시 증가하지는 않습니다.  
이 실습은 HTTP 부하와 Runtime Metrics를 같은 시간축에서 비교하는 방법에 초점을 둡니다.  

### 🟦 Latency와 CPU·Memory·Heap 비교

Dashboard를 다음 순서로 확인합니다.  

1. Request Rate에서 부하가 시작된 시점을 찾습니다.  
2. p50·p95·p99에서 일반 지연과 Tail Latency 변화를 확인합니다.  
3. 같은 시간대의 Process CPU와 RSS를 확인합니다.  
4. V8 Heap Used의 증가와 감소 패턴을 확인합니다.  

Latency와 CPU가 함께 증가해도 CPU 사용이 지연의 원인이라고 바로 단정할 수는 없습니다.  
트래픽 증가가 CPU와 Latency를 동시에 높였을 수도 있으므로 Route별 Latency와 Trace의 내부 Span을 함께 확인합니다.  

Heap은 객체가 할당되면서 증가하고 GC 뒤에 감소하는 톱니 모양을 보일 수 있습니다.  
GC 뒤에도 기준선이 장시간 계속 높아지는지, RSS도 함께 증가하는지를 반복해서 관찰합니다.  

### 🟦 Latency와 GC·Event Loop Delay 비교

p50은 안정적인데 p99만 증가했다면 같은 시간대의 GC Duration과 Event Loop Delay를 확인합니다.  

```text
HTTP p99 증가
├─ GC Duration도 증가
│  └─ GC 정지와 Heap 변화 확인
├─ Event Loop Delay도 증가
│  └─ CPU를 오래 점유하는 동기 작업 확인
└─ Runtime Metrics 변화 없음
   └─ DB, 외부 API와 Network Span 확인
```

같은 시점에 값이 움직였다는 사실은 원인과 결과를 확정하지 않습니다.  
Metrics는 조사할 시간대와 구성 요소를 좁히고, Trace와 Profile 같은 세부 자료로 가설을 확인하는 출발점입니다.  

### 🟦 Grafana 이상 구간에서 Jaeger Trace로 이동

Grafana에서 이상 구간을 찾으면 시간 범위와 느린 Route를 기록합니다.  
그다음 Jaeger에서 `observability-basics` Service와 같은 시간대를 선택해 Trace를 조회합니다.  

```text
Grafana
└─ 14:05~14:10 /api/ch05/posts p99 증가
       │
       ▼
Jaeger
└─ observability-basics, 같은 시간대의 느린 Trace 조회
       │
       ▼
HTTP → Fastify → Service → Prisma Span 비교
```

Trace에서는 다음 순서로 확인합니다.  

1. HTTP Span의 전체 요청 시간과 상태 코드를 확인합니다.  
2. Fastify handler가 요청 시간의 대부분을 차지하는지 확인합니다.  
3. Service와 Prisma Span에서 반복되거나 오래 걸린 작업을 찾습니다.  
4. 오류가 있다면 실패한 Span의 status와 exception event를 확인합니다.  
5. 같은 Route의 정상 Trace와 느린 Trace를 비교합니다.  

Metric label에는 Cardinality가 큰 `traceId`를 넣지 않았으므로 이 예제에서는 시간대와 Route를 기준으로 Jaeger 검색 범위를 좁힙니다.  
Grafana와 Trace Backend를 연결하거나 Exemplar를 별도로 구성하면 Dashboard에서 특정 Trace로 직접 이동하는 흐름도 만들 수 있습니다.  

Metrics와 Trace의 역할은 서로 다릅니다.  
Metrics는 서비스 전체에서 이상이 발생한 시점과 범위를 보여 주고, Trace는 특정 요청 안에서 시간이 오래 걸린 구간을 보여 줍니다.  
HTTP와 Runtime Metrics를 함께 관찰한 뒤 Trace로 이동하면 단순히 느린 요청을 찾는 데서 그치지 않고 애플리케이션, Runtime과 DB 가운데 어디를 먼저 조사해야 하는지 결정할 수 있습니다.  
