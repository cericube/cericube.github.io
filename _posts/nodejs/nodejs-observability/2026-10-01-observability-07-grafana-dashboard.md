---
layout: post
title: "07. Grafana로 Node.js Metrics Dashboard 구성"
description: "앞에서 검증한 PromQL을 Grafana Dashboard에 배치합니다. HTTP RED와 Node.js Runtime Panel을 구성하고 변수, 조회 구간, 단위, 범례, 임계값과 배포 Annotation을 실무 기준으로 설정합니다."
category_id: nodejs-observability
categories: [nodejs, nodejs-observability]
series: observability
series_order: 07
ai_assisted: true
toc:
  - id: session-01
    title: "1. Grafana와 Prometheus 연결"
  - id: session-02
    title: "2. Dashboard 기본 설정과 변수"
  - id: session-03
    title: "3. Overview와 HTTP RED Panel"
  - id: session-04
    title: "4. Node.js Runtime Panel"
  - id: session-05
    title: "5. Dashboard 운영과 장애 조사"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/observability-basics){: target="_blank" rel="noopener noreferrer" }**  

6편에서 검증한 HTTP와 Node.js Runtime PromQL을 Grafana Panel에 배치해 운영 Dashboard를 구성합니다.  
장애가 발생하면 다음 질문에 따라 서비스 영향과 원인을 위에서 아래로 좁혀 갑니다.  

```text
수집과 서비스가 정상인가?
├─ Target Health
├─ Request Rate
├─ 5xx Error Rate
└─ p99 Latency
        │
        ▼
어디에서 문제가 발생하는가?
├─ Route별 Request와 Error
├─ Route별 Latency
└─ Instance별 지표
        │
        ▼
Node.js Runtime과 관련이 있는가?
├─ CPU
├─ RSS와 V8 Heap
├─ GC
└─ Event Loop
        │
        ▼
Trace · Profile · Log로 원인 조사
```

## 1. Grafana와 Prometheus 연결 {#session-01}

Grafana는 Metric을 직접 수집하지 않습니다.  
Prometheus에 PromQL Query를 보내고 그 결과를 Panel로 시각화합니다.  

| 도구 | Host 주소 | 역할 |
| --- | --- | --- |
| Prometheus | `http://localhost:9090` | Metric 저장과 PromQL 실행 |
| Grafana | `http://localhost:3001` | Dashboard 시각화 |
| Jaeger | `http://localhost:16686` | 요청별 Trace 조회 |

### 🟦 Prometheus Data Source 추가

`http://localhost:3001`에서 Grafana에 로그인한 뒤 Prometheus를 연결합니다.  

1. **Connections → Data sources**로 이동합니다.  
2. **Add new data source → Prometheus**를 선택합니다.  
3. Prometheus Server URL에 `http://prometheus:9090`을 입력합니다.  
4. Scrape interval을 Prometheus 설정과 같은 `5s`로 지정합니다.  
5. **Save & test**를 선택합니다.  

Grafana Container에서 `localhost`는 Grafana 자신을 가리킵니다.  
같은 Compose Network의 Prometheus에는 서비스 이름인 `prometheus`로 접근합니다.  

Prometheus의 실제 Scrape 주기와 다르면 Rate Query가 너무 짧거나 길게 계산될 수 있으므로 두 값을 일치시킵니다.  
![Data Source 연결](/assets/images/nodejs/nodejs-observability/image-2026-10-01.png)
연결에 실패하면 다음 항목을 확인합니다.  

- `docker compose ps`에서 Prometheus와 Grafana가 실행 중인지 확인합니다.  
- Browser 주소인 `http://localhost:9090`과 Container 내부 주소인 `http://prometheus:9090`을 구분합니다.  
- 두 서비스가 같은 Docker Compose Network에 속하는지 확인합니다.  
- Prometheus에서 `up{job="observability-basics"}`가 `1`인지 확인합니다.  

## 2. Dashboard 기본 설정과 변수 {#session-02}

새 Dashboard를 만든 뒤 기본 시간 범위는 **Last 30 minutes**, 자동 새로 고침은 **10s**로 설정합니다.  
예제의 Scrape 주기가 5초이므로 이보다 빠르게 새로 고쳐도 새로운 Sample이 생기지 않습니다.  

### 🟦 Row 구성

Grafana Row는 관련 Panel을 장애 조사 단계별로 묶어, 운영자가 Dashboard를 위에서 아래로 보면서 문제 범위를 빠르게 좁힐 수 있도록 구성합니다  

| Row | Panel | 확인할 내용 |
| --- | --- | --- |
| Overview | Target, Request Rate, 5xx Rate, p99 | 현재 서비스 영향 |
| HTTP RED | Route별 Request, Error, Latency | 문제가 집중된 Route |
| Process and Memory | CPU, RSS, Heap | Instance와 Memory 상태 |
| GC and Event Loop | GC Rate·Duration, Event Loop | Node.js Runtime 지연 |

Overview에는 즉시 판단할 지표만 둡니다.  
Route나 Heap Space처럼 Series가 많은 지표는 아래 Row에 배치해 첫 화면이 복잡해지지 않도록 합니다.  

### 🟦 Instance 변수 추가

`instance` 변수는 여러 실행 환경 중 어떤 Instance의 Metric을 볼 것인지 Dashboard에서 선택하는 필터입니다.  

- Dashboard에서 **Edit**을 선택합니다.  
- **Dashboard options → Variables**로 이동합니다.  
- **Add variable**을 선택하고 Type을 `Query`로 지정합니다.  
- 변수 이름을 `instance`로 입력합니다.  
- **Open variable editor**를 선택하고 다음과 같이 설정합니다.  

```text  
Data source : Prometheus
Query type  : Label values
Label       : instance
Metric      : up
Label filters: job = observability-basics
```

- Selection options에서 **Multi-value**와 **Include All value**를 활성화합니다.  

이제 Dashboard 상단에서 하나 이상의 Instance 또는 All을 선택할 수 있습니다.  
Panel Query에는 다음과 같이 변수를 적용할 수 있습니다.  

```promql
process_cpu_utilization{
  job="observability-basics",
  instance=~"${instance:regex}"
}
```

`=` 대신 `=~`를 사용하면 여러 Instance와 `All` 선택을 처리할 수 있습니다.  
`${instance:regex}`는 선택한 값을 Prometheus 정규 표현식에 안전하게 사용할 수 있도록 변환합니다.  

Route 수가 많거나 특정 Route를 반복해서 조사한다면 같은 방식으로 `route` 변수를 추가할 수 있습니다.  
모든 Label을 변수로 만들기보다는 실제로 자주 변경하는 조회 조건만 추가합니다.  

### 🟦 조회 구간 선택

Grafana에서는 목적에 따라 `$__rate_interval`과 `$__range`를 구분해서 사용합니다.  
두 값은 사용자가 직접 만드는 변수가 아니라 Grafana가 자동으로 제공하는 내장 변수입니다.  

| 목적 | 사용 구간 | 예시 |
| --- | --- | --- |
| 초당 변화율 | `$__rate_interval` | `rate(http_requests_total[$__rate_interval])` |
| 선택한 전체 시간의 증가량 | `$__range` | `increase(http_requests_total[$__range])` |

`$__rate_interval`은 Request Rate나 Error Rate처럼 시간에 따라 값이 얼마나 변하는지 계산할 때 사용합니다.  
Grafana가 Dashboard 해상도와 Prometheus Scrape 주기를 고려해 적절한 계산 구간을 자동으로 정합니다.  

반면 `$__range`는 Dashboard에서 선택한 전체 시간 동안 요청이나 오류가 얼마나 증가했는지 계산할 때 사용합니다.  
예를 들어 Dashboard에서 `Last 30 minutes`를 선택했다면 `$__range`는 최근 30분 전체 범위를 의미합니다.  

선택한 전체 시간의 누적 결과를 하나의 값으로 보고 싶다면 Table이나 Stat Panel에서 Query Type을 `Instant`로 설정합니다.  

## 3. Overview와 HTTP RED Panel {#session-03}

HTTP 지표는 Request Rate, Error와 Duration을 같은 시간축에서 비교합니다.  
모든 Query에는 `job`과 `instance` 조건을 적용해 다른 서비스의 Metric이 섞이지 않도록 합니다.  

### 🟦 Overview Panel

Overview는 서비스에 현재 문제가 있는지 빠르게 판단하는 영역입니다.  
먼저 Target 수집 상태, 요청량, 오류율과 느린 요청을 확인합니다. 이상이 보이면 아래 HTTP RED Panel이나 Runtime Panel에서 원인을 좁혀 갑니다.  
![Overview](/assets/images/nodejs/nodejs-observability/image-2026-10-01-2.png)

#### Target Health

Prometheus가 선택한 Instance의 Metric을 정상적으로 수집하고 있는지 확인합니다.  

```promql
min(
  up{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Stat`
- Type: `Instant`
- Value mapping: `1 → UP`, `0 → DOWN`
- Color: `UP → Green`, `DOWN → Red`

여러 Instance를 선택한 경우 min()을 사용하므로 하나라도 0이면 DOWN으로 표시됩니다.  

`No data`는 `DOWN`과 다릅니다.  
DOWN은 Target이 존재하지만 수집에 실패한 상태입니다. Application 자체뿐 아니라 Prometheus Target 설정과 Network 연결에도 문제가 없는지 확인합니다.  
반면 No data는 Query 조건에 맞는 Series가 없거나 Query 설정이 잘못된 경우에도 발생할 수 있습니다.  

#### Request Rate

현재 서비스가 초당 몇 건의 요청을 처리하는지 확인합니다.  
평소보다 갑자기 증가하면 Traffic 급증을, 급격히 감소하면 Application이나 외부 Traffic 흐름의 이상을 의심할 수 있습니다.  

```promql
sum(
  rate(
    http_requests_total{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
```

- Visualization: `Stat`
- Type: `Range`
- Calculation: `Last* (not null)`
- Unit: `requests/sec`

#### 5xx Error Rate

전체 요청 가운데 5xx 응답이 차지하는 비율을 확인합니다.  
비율이 증가하면 아래의 선택 구간 5xx 오류 건수 Panel에서 오류가 집중된 Route와 Status Code를 찾습니다.  

```promql
sum(
  rate(
    http_requests_total{
      job="observability-basics",
      instance=~"${instance}",
      status_code=~"5.."
    }[$__rate_interval]
  )
)
/
sum(
  rate(
    http_requests_total{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
```

- Visualization: `Stat`
- Type: `Range`
- Calculation: `Last* (not null)`
- Unit: `Percent (0.0-1.0)`

요청이 전혀 없는 구간에는 분모가 0이 되어 값이 표시되지 않을 수 있습니다.  
이를 정상으로 단정하지 말고 Request Rate와 함께 확인합니다.  

#### HTTP p99

전체 요청 중 가장 느린 구간의 응답 시간을 확인합니다.  
p99가 증가하면 일부 요청에서 심한 지연이 발생하고 있다는 의미입니다. 이때 Route별 p95 Latency와 Runtime 지표를 함께 확인합니다.  

```promql
histogram_quantile(
  0.99,
  sum by (le) (
    rate(
      http_request_duration_seconds_bucket{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

- Visualization: `Stat`
- Type: `Range`
- Calculation: `Last* (not null)`
- Unit: `seconds (s)`

### 🟦 HTTP RED Panel

HTTP RED Panel에서는 Overview에서 발견한 이상이 어떤 Route에 집중되어 있는지 확인합니다.  
Request, Error, Duration을 Route 기준으로 나누어 문제 범위를 좁힙니다.  
![HTTP RED](/assets/images/nodejs/nodejs-observability/image-2026-10-01-3.png)  

#### Route별 Request Rate

어떤 Route에 Traffic이 집중되는지 확인합니다.  
특정 Route의 Request Rate가 급격히 증가했다면 해당 API가 전체 부하 증가의 원인인지 살펴봅니다.  

```promql
topk(
  5,
  sum by (method, route) (
    rate(
      http_requests_total{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `requests/sec`
- {% raw %}Legend: `Custom → {{method}} {{route}}`{% endraw %}

Route 수가 많으면 모든 Series를 한 번에 표시하지 말고 `topk()`나 `route` 변수로 범위를 줄입니다.  

#### 선택 구간의 5xx 오류 건수

선택한 시간 범위에서 어떤 Route와 Status Code의 5xx 오류가 많았는지 확인합니다.  
Overview의 5xx Error Rate가 증가했을 때 실제 오류가 집중된 API를 찾는 데 사용합니다.  

```promql
sum by (method, route, status_code) (
  increase(
    http_requests_total{
      job="observability-basics",
      instance=~"${instance}",
      status_code=~"5.."
    }[$__range]
  )
)
```

- Visualization: `Table`
- Type: `Instant`
- Format: `Table`

정렬을 Query 결과에 고정하려면 **Transform → Sort by**에서 Field를 `Value`로 선택하고 **Reverse**를 활성화합니다.  
Transformations → Sort by → Field에는 현재 Query 결과에 실제로 존재하는 Field만 선택할 수 있습니다.  

`increase()`는 Counter의 시작과 끝을 보정하므로 결과가 소수일 수 있습니다.  
정수형 Event Log가 아니라 선택 구간의 Counter 증가량을 추정한 값으로 이해합니다.  

#### p50 · p95 · p99 Latency

하나의 Time series Panel에 세 Query를 추가해 일반적인 응답 시간과 느린 요청의 응답 시간을 함께 비교합니다.  

```promql
# Query A · p50
histogram_quantile(
  0.50,
  sum by (le) (
    rate(
      http_request_duration_seconds_bucket{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

```promql
# Query B · p95
histogram_quantile(
  0.95,
  sum by (le) (
    rate(
      http_request_duration_seconds_bucket{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

```promql
# Query C · p99
histogram_quantile(
  0.99,
  sum by (le) (
    rate(
      http_request_duration_seconds_bucket{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `seconds (s)`
- Legend: 각 Query에서 `Custom → p50`, `p95`, `p99`

평균만 보면 일부 느린 요청이 가려질 수 있습니다.  
`p50`은 일반적인 요청의 응답 시간을, `p95`는 느린 요청의 변화를, `p99`는 매우 느린 요청인 Tail Latency를 확인하는 데 사용합니다.  
p50은 안정적인데 p95와 p99만 증가한다면 일부 요청에서만 지연이 발생하고 있을 가능성이 있습니다.  

#### Route별 p95 Latency

어떤 Route에서 응답 지연이 발생하는지 확인합니다.  
전체 p95나 p99가 증가했을 때 느린 Route를 찾고, 이후 해당 Route의 Trace를 확인하는 데 사용합니다.  

```promql
# Request Rate가 높은 Route 상위 5개를 찾는 Query입니다.
topk(
  5,
  histogram_quantile(
    0.95,
    sum by (le, method, route) (
      rate(
        http_request_duration_seconds_bucket{
          job="observability-basics",
          instance=~"${instance}"
        }[$__rate_interval]
      )
    )
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `seconds (s)`
- {% raw %}Legend: `Custom → {{method}} {{route}}`{% endraw %}

호출량이 매우 적은 Route의 p95는 Sample 수가 부족해 크게 흔들릴 수 있습니다.  
Route별 Request Rate와 함께 확인합니다.  

## 4. Node.js Runtime Panel {#session-04}

Runtime Row에서는 HTTP 이상 구간과 CPU, Memory, GC, Event Loop 변화를 같은 시간대에서 비교합니다.  
Instance별 차이가 보이도록 `instance` Label을 남깁니다.  

### 🟦 CPU와 Memory

CPU와 Memory Panel에서는 HTTP 지연이나 오류가 Node.js Process의 자원 부족과 관련 있는지 확인합니다.  
Instance별 사용량을 비교해 전체 서비스의 문제인지 특정 Instance에 집중된 문제인지 구분합니다.  
![CPU Memory](/assets/images/nodejs/nodejs-observability/image-2026-10-01-4.png)  

#### CPU 사용량

Node.js Process가 CPU Core를 얼마나 사용하고 있는지 Instance별로 확인합니다.  
HTTP Latency와 CPU 사용량이 같은 시간대에 함께 증가한다면 계산량이 많은 코드나 동기 작업이 요청 처리를 지연시키는지 조사합니다.  

```promql
avg by (instance) (
  avg_over_time(
    process_cpu_utilization{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: 직접 입력 `suffix: cores`
- {% raw %}Legend: `Custom → {{instance}}`{% endraw %}

이 글의 `process_cpu_utilization`은 전체 Host CPU 백분율이 아니라 Process가 사용한 CPU 시간 비율입니다.  
값 `0.7`은 약 `0.7` CPU Core를 사용한다는 의미이며, Multi-core 작업에서는 `1`을 넘을 수 있습니다.  
따라서 `Percent (0.0-1.0)` Unit을 사용하지 않습니다.  

#### RSS

Node.js Process가 실제 Memory에 올려 사용하는 전체 크기를 Instance별로 확인합니다.  
Memory 사용량이 특정 Instance에서만 증가하는지, 시간이 지나도 계속 증가하는지도 함께 살펴봅니다.  

```promql
max by (instance) (
  process_resident_memory_bytes{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `bytes (IEC)`
- {% raw %}Legend: `Custom → {{instance}}`{% endraw %}

RSS는 V8 Heap뿐 아니라 Native Memory, Buffer와 Runtime 영역도 포함합니다.  
Heap이 안정적인데 RSS만 계속 증가한다면 V8 Heap 밖의 Memory도 조사합니다.  

#### V8 Heap 전체 상태

V8이 확보한 Heap 가운데 실제로 사용하는 크기와 남은 여유 공간을 확인합니다.  
하나의 Panel에 Heap Used, Heap Size와 Available Size를 함께 표시해 Heap이 얼마나 차 있고 더 사용할 공간이 남아 있는지 비교합니다.  

```promql
# Query A · Heap Used
sum by (instance) (
  v8js_memory_heap_used{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

```promql
# Query B · Heap Size
sum by (instance) (
  v8js_memory_heap_space_size{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

```promql
# Query C · Heap Available
sum by (instance) (
  v8js_memory_heap_space_available_size{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `bytes (IEC)`
- {% raw %}Legend: 각 Query에서 `Custom → Used {{instance}}`, `Size {{instance}}`, `Available {{instance}}`{% endraw %}

Heap Used가 GC 이후에도 이전 수준으로 돌아오지 않고 기준선이 계속 상승하는지 확인합니다.  
기준선이 계속 상승하면서 Available Size가 줄어든다면 객체가 해제되지 않고 누적되는지 조사합니다. 짧은 구간의 증가만으로 Memory Leak으로 판단하지 않습니다.  

#### Heap Space별 사용량

전체 Heap 증가가 V8의 어떤 Heap Space에 집중되는지 확인합니다.  
특히 오래 살아남은 객체가 저장되는 Space가 계속 증가한다면 장기 객체나 해제되지 않는 참조를 조사할 단서로 사용합니다.  

```promql
sum by (instance, v8js_heap_space_name) (
  v8js_memory_heap_used{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `bytes (IEC)`
- {% raw %}Legend: `Custom → {{instance}} {{v8js_heap_space_name}}`{% endraw %}

Series가 많아지면 한 Instance만 선택해서 조사합니다.  

### 🟦 GC

GC Panel에서는 Garbage Collection이 얼마나 자주 발생하고 한 번 실행될 때 얼마나 오래 걸리는지 확인합니다.  
Heap과 HTTP Latency를 같은 시간대에서 비교해 객체 정리 작업이 요청 지연과 관련 있는지 판단합니다.  
![GC](/assets/images/nodejs/nodejs-observability/image-2026-10-01-5.png)  

#### GC Rate

Instance와 GC 유형별로 Garbage Collection이 초당 몇 번 발생하는지 확인합니다.  
Rate가 갑자기 증가하면 짧은 시간에 객체가 많이 생성되거나 Heap 여유가 줄어 GC가 자주 실행되는지 살펴봅니다.  

```promql
sum by (instance, v8js_gc_type) (
  rate(
    v8js_gc_duration_count{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `ops/sec`
- {% raw %}Legend: `Custom → {{instance}} {{v8js_gc_type}}`{% endraw %}

GC Rate만 증가하고 Duration과 HTTP Latency가 안정적이라면 즉시 장애로 판단할 필요는 없습니다.  

#### GC 평균 Duration

각 GC 유형이 한 번 실행될 때 평균적으로 얼마나 오래 걸리는지 확인합니다.  
평균 Duration이 증가하면 GC가 Event Loop를 멈추는 시간이 길어지고 있는지 HTTP Latency와 함께 비교합니다.  

```promql
sum by (instance, v8js_gc_type) (
  rate(
    v8js_gc_duration_sum{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
/
sum by (instance, v8js_gc_type) (
  rate(
    v8js_gc_duration_count{
      job="observability-basics",
      instance=~"${instance}"
    }[$__rate_interval]
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `seconds (s)`
- {% raw %}Legend: `Custom → avg {{instance}} {{v8js_gc_type}}`{% endraw %}

평균값에는 일부 긴 GC가 가려질 수 있으므로 아래의 GC p95 Duration도 함께 확인합니다.  

#### GC p95 Duration

GC 실행 중 느린 상위 구간의 소요 시간을 확인합니다.  
평균 Duration은 안정적인데 p95만 증가한다면 일부 GC에서만 긴 정지가 발생하고 있을 가능성이 있습니다.  

```promql
histogram_quantile(
  0.95,
  sum by (le, instance, v8js_gc_type) (
    rate(
      v8js_gc_duration_bucket{
        job="observability-basics",
        instance=~"${instance}"
      }[$__rate_interval]
    )
  )
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `seconds (s)`
- {% raw %}Legend: `Custom → p95 {{instance}} {{v8js_gc_type}}`{% endraw %}

GC Rate 증가만으로 문제라고 판단하지 않습니다.  
Heap 기준선, GC Duration과 HTTP Latency가 같은 시간대에 함께 증가한다면 Heap 압박이나 객체 할당 패턴을 조사합니다.  

### 🟦 Event Loop

Event Loop Panel에서는 Node.js가 Callback과 요청 처리 작업을 제시간에 실행하고 있는지 확인합니다.  
HTTP Latency가 증가했을 때 Event Loop가 직접 막힌 것인지, DB나 외부 API처럼 Process 밖의 대기 시간이 길어진 것인지 구분하는 데 사용합니다.  
![Event Loop](/assets/images/nodejs/nodejs-observability/image-2026-10-01-6.png)  

#### Event Loop Delay

예약된 작업이 실제로 실행되기까지 얼마나 지연되었는지 확인합니다.  
하나의 Panel에서 p50, p99와 최대 Delay를 비교해 일반적인 지연과 일부 심한 지연을 구분합니다.  

```promql
# Query A · p50
max by (instance) (
  nodejs_eventloop_delay_p50{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

```promql
# Query B · p99
max by (instance) (
  nodejs_eventloop_delay_p99{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

```promql
# Query C · Maximum
max by (instance) (
  nodejs_eventloop_delay_max{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `seconds (s)`
- {% raw %}Legend: 각 Query에서 `Custom → p50 {{instance}}`, `p99 {{instance}}`, `max {{instance}}`{% endraw %}

Maximum은 짧은 Spike에 민감하므로 p99와 함께 봅니다.  
p99가 지속해서 증가하면 일시적인 한 번의 지연보다 반복되는 Event Loop 지연일 가능성이 큽니다.  

#### Event Loop Utilization

Event Loop가 전체 시간 중 실제 작업을 수행한 비율을 확인합니다.  
Delay와 함께 비교하면 Event Loop가 계속 바빠서 지연되는 상황과 짧은 Spike만 발생한 상황을 구분하는 데 도움이 됩니다.  

```promql
max by (instance) (
  nodejs_eventloop_utilization{
    job="observability-basics",
    instance=~"${instance}"
  }
)
```

- Visualization: `Time series`
- Type: `Range`
- Unit: `Percent (0.0-1.0)`
- {% raw %}Legend: `Custom → {{instance}}`{% endraw %}

Utilization이 1에 가까우면 Event Loop가 대부분의 시간을 작업에 사용하고 있다는 의미입니다.  
CPU, Event Loop Delay와 HTTP Latency가 함께 증가하는지 확인합니다.  

## 5. Dashboard 운영과 장애 조사 {#session-05}

Dashboard를 운영 환경에서 사용하려면 그래프를 구성하는 것만으로는 충분하지 않습니다.  
경고 기준과 데이터가 없는 상태를 일관되게 해석하고, 배포 시점을 기록한 뒤 실제 요청으로 각 Panel의 동작을 검증해야 합니다.  
문제가 발생했을 때 어떤 순서로 원인을 좁힐지도 함께 정리합니다.  

### 🟦 임계값 설정

임계값(Threshold)은 지표가 정상 범위를 벗어났는지 색상으로 빠르게 구분하는 기준입니다.  
모든 Panel에 일괄적으로 적용하지 않고, Overview처럼 상태를 즉시 판단해야 하는 Panel에만 설정합니다.  
임계값은 다음과 같이 서비스의 운영 조건을 근거로 정합니다.  

- Error Rate와 Latency: 서비스 SLO와 Alert 기준  
- Memory: Container Limit과 정상 구간의 기준선  
- CPU: 할당된 CPU Core와 평소 사용량  
- Event Loop: 정상 Traffic에서 측정한 기준선  

Grafana의 기본값이나 다른 서비스에서 사용하는 숫자를 그대로 가져오지 않습니다.  
먼저 정상 구간의 지표를 관찰한 뒤 서비스의 SLO, 자원 한도와 Alert 기준에 맞게 조정합니다.  

### 🟦 `No data` 해석

`No data`는 Query 결과가 없다는 뜻이며, 지표에 따라 원인이 다릅니다.  

- `up`의 No data: Target이나 Label 조건을 찾지 못했을 수 있습니다.  
- Error Rate의 No data: 요청이 없어 분모가 0일 수 있습니다.  
- GC의 No data: 조회 구간에 해당 GC Type이 발생하지 않았을 수 있습니다.  

모든 `No data`를 편의상 `0`으로 바꾸면 수집 중단과 정상 상태를 구분하기 어렵습니다.  
먼저 Target Health와 Request Rate를 확인하고, 실제 요청이나 GC가 없었던 것인지 Metric 수집이 중단된 것인지 구분합니다.  

### 🟦 배포 시점 표시

Grafana Annotation은 그래프 위에 특정 시점을 표시하는 기능입니다.  
배포 시점을 Annotation으로 남기면 지표 변화가 코드 배포 직후 시작되었는지 빠르게 비교할 수 있습니다.  
처음에는 Grafana에서 직접 추가하고, 배포 Pipeline이 준비되면 Grafana HTTP API를 사용해 자동으로 등록할 수 있습니다.  

Annotation에는 다음 정보를 포함합니다.  

- 배포한 서비스와 버전  
- 배포 환경  
- Commit 또는 배포 작업 링크  
- 배포 시작과 완료 시각  

시간 범위를 넓혀 조사할 때도 배포 시점을 놓치지 않도록 Annotation을 HTTP와 Runtime Row에 함께 표시합니다.  

### 🟦 Dashboard 동작 검증

Dashboard 구성을 마쳤다면 정상 요청, 오류 요청과 느린 요청을 직접 발생시킵니다.  
그런 다음 각 Panel의 값이 요청 유형에 맞게 변하는지 확인합니다.  

```bash
echo "=== 50ms requests ==="
for i in $(seq 1 30); do
  curl -s "http://localhost:3000/api/ch05/posts?delay=50" > /dev/null
done

echo "=== 300ms requests ==="
for i in $(seq 1 15); do
  curl -s "http://localhost:3000/api/ch05/posts?delay=300" > /dev/null
done

echo "=== 1000ms requests ==="
for i in $(seq 1 5); do
  curl -s "http://localhost:3000/api/ch05/posts?delay=1000" > /dev/null
done

echo "=== 500 errors ==="
for i in $(seq 1 5); do
  curl -s "http://localhost:3000/api/ch05/error" > /dev/null
done

echo "=== concurrent load ==="
seq 1 100 \
  | xargs -P10 -I{} \
    curl -s "http://localhost:3000/api/ch05/posts?delay=300" -o /dev/null

echo "=== done ==="
```

### 🟦 장애 조사 순서

실제 장애가 발생하면 Dashboard 위쪽에서 아래쪽으로 이동하며 조사 범위를 좁힙니다.  

1. **Target Health**에서 수집 중단이나 Instance Down 여부를 확인합니다.  
2. **Request Rate**에서 Traffic 급증이나 급감을 확인합니다.  
3. **5xx Error Rate와 p99**에서 사용자 영향을 확인합니다.  
4. **Route별 Panel**에서 문제가 집중된 요청을 찾습니다.  
5. **Instance별 Panel**에서 특정 Instance만 다른지 확인합니다.  
6. **CPU, Heap, GC, Event Loop**를 같은 시간대에서 비교합니다.  
7. 문제가 시작된 시각과 Route를 기준으로 Trace, Profile과 Log를 조사합니다.  

대표적인 패턴은 다음과 같습니다.  

| 함께 변한 지표 | 먼저 의심할 항목 |
| --- | --- |
| Request Rate 증가 + Latency 증가 | Traffic 증가, 외부 의존성, 자원 포화 |
| CPU 증가 + Event Loop Delay 증가 | 동기식 CPU 작업, 큰 직렬화, 반복 계산 |
| Heap 기준선 증가 + GC 증가 | 객체 Retention, Cache 증가, Memory Leak 가능성 |
| RSS만 지속 증가 | Buffer, Native Memory, Runtime 영역 |
| 특정 Instance만 Latency 증가 | 배포 버전, Host 상태, Traffic 편중 |
| Error Rate 증가 + Runtime 정상 | Application 오류, DB나 외부 API 실패 |

Metric은 문제가 발생한 시각과 범위를 찾는 데 유용하지만, 개별 요청이 실패하거나 느려진 정확한 원인까지 보여주지는 않습니다.  
이상 구간을 찾았다면 Jaeger에서 같은 시간대와 Route의 느리거나 실패한 Trace를 확인합니다.  
CPU와 Event Loop Delay가 함께 높다면 CPU Profile에서 오래 실행된 함수를 조사합니다. 오류 메시지와 전후 상황이 필요하다면 Log를 확인합니다.  

이렇게 구성하면 Dashboard는 단순한 그래프 모음이 아니라 **상태 확인 → 범위 축소 → 원인 조사 도구 선택**으로 이어지는 운영 화면이 됩니다.  
