---
layout: post
title: "03. Redis 자료 구조와 메시징 기본 명령어"
description: "redis-cli로 String, Hash, List, Set과 Sorted Set에서 자주 사용하는 명령어를 익힙니다. Stream과 Pub/Sub의 차이와 기본 메시지 처리 방법도 예제로 설명합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis 자료 구조 기본 명령어"
  - id: session-02
    title: "2. Stream과 Pub/Sub 기본 명령어"
---

각 자료 구조는 잘하는 일이 다릅니다.  
데이터의 모양뿐만 아니라 자주 수행할 조회·추가·삭제 연산도 함께 고려하면 알맞은 자료 구조를 선택하기 쉽습니다.  
이 글은 전체 명령어를 나열하기보다 실습과 애플리케이션 개발에서 자주 사용하는 명령어를 중심으로 설명합니다.  

## 1. Redis 자료 구조 기본 명령어 {#session-01}

Redis는 사용 목적에 맞는 여러 자료 구조를 제공합니다.  
여기서는 자주 사용하는 String, Hash, List, Set과 Sorted Set의 기본 명령어를 살펴봅니다.  

### 🟦 String 기본 명령어

String은 Redis에서 가장 기본적인 자료 구조입니다.  
이름은 String이지만 단순 문자열뿐만 아니라 숫자, JSON 문자열, 토큰, 인증 코드, 카운터 값 등을 저장할 때 자주 사용합니다.  

- 사용자 조회 결과 캐시
- 이메일 인증 코드
- Access Token 또는 Refresh Token
- 게시글 조회수 카운터
- 로그인 실패 횟수
- Rate Limiting
- 분산 락의 기본 구조

> `SET key value NX`만으로 안전한 분산 락이 완성되는 것은 아닙니다. 실제 분산 락에는 만료 시간, 락 소유자를 구분하는 고유 값과 소유자만 락을 해제하도록 보장하는 원자적 연산이 함께 필요합니다.  

| 명령어 | 설명 |
| --- | --- |
| `SET key value` | 문자열 값 저장 |
| `GET key` | 문자열 값 조회 |
| `SET key value EX seconds` | 값을 저장하면서 TTL 설정 |
| `SET key value NX` | Key가 없을 때만 저장 |
| `MSET key value key value` | 여러 Key-Value를 한 번에 저장 |
| `MGET key key` | 여러 Key의 값을 한 번에 조회 |
| `INCR key` | 숫자 값을 1 증가 |
| `INCRBY key number` | 숫자 값을 지정한 수만큼 증가 |

```console
127.0.0.1:6379> SET greeting "Hello Redis"
OK

127.0.0.1:6379> GET greeting
"Hello Redis"

127.0.0.1:6379> SET auth-code:kim@example.com "123456" EX 180
OK

127.0.0.1:6379> TTL auth-code:kim@example.com
(integer) 175

127.0.0.1:6379> INCR post:1:view-count
(integer) 1

127.0.0.1:6379> INCR post:1:view-count
(integer) 2
```

### 🟦 Hash 기본 명령어

Hash는 하나의 Redis Key 안에 여러 Field-Value를 저장하는 자료 구조입니다.  
JavaScript 객체나 JSON 객체와 비슷하게 생각할 수 있습니다.  

- 사용자 프로필
- 세션 정보
- 상품 재고 상태
- 사용자 설정
- 카운터가 포함된 객체 데이터

예를 들어 사용자 프로필은 다음과 같이 표현할 수 있습니다.  

```text
key: hash:user-profile:1

field: id      value: 1
field: name    value: Kim
field: email   value: kim@example.com
field: status  value: ACTIVE
```

| 명령어 | 설명 |
| --- | --- |
| `HSET key field value` | Hash에 Field-Value 저장 |
| `HGET key field` | 특정 Field 값 조회 |
| `HGETALL key` | 모든 Field-Value 조회 |
| `HMGET key field field` | 여러 Field 값 조회 |
| `HDEL key field` | 특정 Field 삭제 |
| `HEXISTS key field` | 특정 Field 존재 여부 확인 |
| `HINCRBY key field number` | 특정 Field의 숫자 값 증가 |

```console
127.0.0.1:6379> HSET hash:user-profile:1 id 1 name "Kim" email "kim@example.com" status "ACTIVE"
(integer) 4

127.0.0.1:6379> HGET hash:user-profile:1 name
"Kim"

127.0.0.1:6379> HGETALL hash:user-profile:1
1) "id"
2) "1"
3) "name"
4) "Kim"
5) "email"
6) "kim@example.com"
7) "status"
8) "ACTIVE"
```

### 🟦 List 기본 명령어

List는 순서가 있는 문자열 목록입니다.  
Redis List는 왼쪽과 오른쪽 양쪽에서 데이터를 넣고 뺄 수 있습니다.  

```text
왼쪽  <---- List ---->  오른쪽
LPUSH                   RPUSH
LPOP                    RPOP
```

- 최근 본 게시글 목록
- 최근 검색어 목록
- 간단한 작업 큐
- 최근 로그 버퍼

중요한 작업 큐를 안정적으로 운영해야 한다면 단순 List보다 Redis Stream처럼 메시지 처리 상태를 관리할 수 있는 자료 구조를 고려하는 것이 좋습니다.  

| 명령어 | 설명 |
| --- | --- |
| `LPUSH key value` / `RPUSH key value` | List의 왼쪽 또는 오른쪽에 값 추가 |
| `LPOP key` / `RPOP key` | List의 왼쪽 또는 오른쪽 값을 꺼내고 제거 |
| `LRANGE key start stop` | List의 지정 범위 조회 |
| `LLEN key` | List 길이 조회 |
| `LTRIM key start stop` | 지정 범위만 남기고 나머지 제거 |
| `BLPOP key timeout` / `BRPOP key timeout` | 값이 들어올 때까지 기다렸다가 꺼냄 |

```console
127.0.0.1:6379> LPUSH list:user:1:recent-posts 101
(integer) 1

127.0.0.1:6379> LPUSH list:user:1:recent-posts 102
(integer) 2

127.0.0.1:6379> LPUSH list:user:1:recent-posts 103
(integer) 3

127.0.0.1:6379> LRANGE list:user:1:recent-posts 0 -1
1) "103"
2) "102"
3) "101"

127.0.0.1:6379> LTRIM list:user:1:recent-posts 0 9
OK
```

### 🟦 Set 기본 명령어

Set은 중복을 허용하지 않는 집합입니다.  
같은 값을 여러 번 넣어도 한 번만 저장됩니다.  

- 게시글 좋아요 사용자 목록
- 일일 방문자 중복 제거
- 온라인 사용자 관리
- 중복 요청 방지
- 사용자 관심 태그
- 권한 목록

| 명령어 | 설명 |
| --- | --- |
| `SADD key member` | Set에 Member 추가 |
| `SREM key member` | Set에서 Member 제거 |
| `SMEMBERS key` | Set의 모든 Member 조회 |
| `SISMEMBER key member` | 특정 Member 존재 여부 확인 |
| `SCARD key` | Set에 저장된 Member 개수 조회 |
| `SINTER key key` / `SUNION key key` / `SDIFF key key` | 교집합·합집합·차집합 조회 |

```console
127.0.0.1:6379> SADD set:post-likes:100 1
(integer) 1

127.0.0.1:6379> SADD set:post-likes:100 2
(integer) 1

127.0.0.1:6379> SADD set:post-likes:100 1
(integer) 0

127.0.0.1:6379> SISMEMBER set:post-likes:100 1
(integer) 1

127.0.0.1:6379> SCARD set:post-likes:100
(integer) 2
```

### 🟦 Sorted Set 기본 명령어

Sorted Set은 Set에 Score가 추가된 자료 구조입니다.  
Member는 중복되지 않고 각각 Score를 가지며, Redis는 이 Score를 기준으로 데이터를 정렬합니다.  

- 인기 게시글 랭킹
- 검색어 순위
- 사용자 포인트 랭킹
- 게임 랭킹
- 우선순위 큐

| 명령어 | 설명 |
| --- | --- |
| `ZADD key score member` | Sorted Set에 Score와 Member 저장 |
| `ZINCRBY key increment member` | Member의 Score 증가 |
| `ZRANGE key start stop [REV] [WITHSCORES]` | 범위를 조회하고 필요하면 역순·Score 포함 옵션 적용 |
| `ZRANK key member` / `ZREVRANK key member` | 낮은 Score 또는 높은 Score 기준 순위 조회 |
| `ZSCORE key member` | 특정 Member의 Score 조회 |
| `ZREM key member` | 특정 Member 제거 |

```console
127.0.0.1:6379> ZADD zset:post-ranking 10 101
(integer) 1

127.0.0.1:6379> ZADD zset:post-ranking 20 102
(integer) 1

127.0.0.1:6379> ZINCRBY zset:post-ranking 5 101
"15"

127.0.0.1:6379> ZRANGE zset:post-ranking 0 2 REV WITHSCORES
1) "102"
2) "20"
3) "101"
4) "15"
```

## 2. Stream과 Pub/Sub 기본 명령어 {#session-02}

Redis는 여러 클라이언트 사이에서 메시지를 전달하는 기능도 제공합니다.  
메시지를 저장하고 처리 상태를 관리해야 한다면 Stream을 사용하고, 현재 접속한 구독자에게 바로 전달하는 기능이 필요하다면 Pub/Sub을 사용할 수 있습니다.  

### 🟦 Stream 기본 명령어

Redis Stream은 메시지를 저장할 수 있는 로그형 자료 구조입니다.  
Pub/Sub과 달리 메시지가 Redis에 남습니다.  
또한 Consumer Group을 사용하면 여러 Worker가 메시지를 나누어 처리할 수 있습니다.  

```text
Producer -> Stream -> Consumer Group -> Consumer
```

- 주문 이벤트 저장
- 알림 이벤트 큐
- 이메일 작업 큐
- 감사 로그
- 비동기 작업 처리

| 명령어 | 설명 |
| --- | --- |
| `XADD key * field value` | Stream에 메시지 추가 |
| `XRANGE key start end` | 오래된 순서로 메시지 조회 |
| `XREAD STREAMS key id` | Stream에서 메시지 읽기 |
| `XGROUP CREATE key group 0 MKSTREAM` / `XGROUP CREATE key group $ MKSTREAM` | 기존 메시지 또는 새 메시지부터 읽는 Consumer Group 생성 |
| `XREADGROUP GROUP group consumer STREAMS key >` | 다른 Consumer에게 전달되지 않은 새 메시지 읽기 |
| `XACK key group id` | 처리한 메시지를 해당 Group의 Pending 목록에서 제거 |
| `XPENDING key group` | 읽었지만 ACK되지 않은 메시지 확인 |

```console
127.0.0.1:6379> XADD stream:orders * orderId 1 userId 10 status CREATED
"1780000000000-0"

127.0.0.1:6379> XADD stream:orders * orderId 2 userId 11 status CREATED
"1780000001000-0"

127.0.0.1:6379> XRANGE stream:orders - +
1) 1) "1780000000000-0"
   2) 1) "orderId"
      2) "1"
      3) "userId"
      4) "10"
      5) "status"
      6) "CREATED"
2) 1) "1780000001000-0"
   2) 1) "orderId"
      2) "2"
      3) "userId"
      4) "11"
      5) "status"
      6) "CREATED"
```

> Stream ID는 실행 시각에 따라 자동으로 생성되므로 실제 출력값은 예시와 다를 수 있습니다.  

Consumer Group을 사용하면 여러 Consumer가 메시지를 나누어 처리할 수 있습니다.  
다음 예제는 앞에서 만든 `stream:orders`의 기존 메시지부터 읽도록 Group을 생성합니다.  

```console
# 0은 Stream의 기존 메시지부터 읽겠다는 의미입니다.
# MKSTREAM은 Stream이 없을 때 빈 Stream을 함께 생성합니다.
127.0.0.1:6379> XGROUP CREATE stream:orders order-workers 0 MKSTREAM
OK

# worker-1이 아직 다른 Consumer에게 전달되지 않은 메시지 한 개를 읽습니다.
127.0.0.1:6379> XREADGROUP GROUP order-workers worker-1 COUNT 1 STREAMS stream:orders >
1) 1) "stream:orders"
   2) 1) 1) "1780000000000-0"
         2) 1) "orderId"
            2) "1"
            3) "userId"
            4) "10"
            5) "status"
            6) "CREATED"

# 처리가 끝난 메시지를 ACK하여 이 Group의 Pending 목록에서 제거합니다.
127.0.0.1:6379> XACK stream:orders order-workers 1780000000000-0
(integer) 1
```

Group 생성 시 `0` 대신 `$`를 사용하면 Group을 만든 이후에 추가된 메시지부터 읽습니다.  
`XREADGROUP`의 `>`는 아직 어떤 Consumer에게도 전달되지 않은 새 메시지를 요청한다는 의미입니다.  
`XACK`은 해당 Consumer Group의 Pending Entries List에서 메시지 ID를 제거하지만 Stream에 저장된 메시지 자체는 삭제하지 않습니다.  
Stream에서 메시지를 직접 삭제해야 할 때는 `XDEL key id`를 별도로 사용합니다.  

### 🟦 Pub/Sub 기본 명령어

Pub/Sub은 메시지를 발행하고 구독하는 기능입니다.  
하나의 클라이언트가 특정 채널을 구독하고 있으면 다른 클라이언트가 해당 채널로 메시지를 발행할 수 있습니다.  

```text
Publisher -> Redis Channel -> Subscriber
```

- 실시간 알림
- 캐시 무효화
- 채팅 브로드캐스트
- 관리자 공지
- 서버 간 간단한 이벤트 전달

Pub/Sub은 메시지를 저장하지 않습니다.  
따라서 구독자가 없는 동안 발행된 메시지는 나중에 받을 수 없습니다.  
메시지를 저장하고 처리 상태를 관리하거나 실패한 메시지를 다시 처리해야 한다면 Pub/Sub보다 Redis Stream이 더 적합합니다.  

| 명령어 | 설명 |
| --- | --- |
| `SUBSCRIBE channel` | 특정 채널 구독 |
| `PSUBSCRIBE pattern` | 패턴에 맞는 여러 채널 구독 |
| `PUBLISH channel message` | 특정 채널에 메시지 발행 |
| `UNSUBSCRIBE channel` / `PUNSUBSCRIBE pattern` | 채널 또는 패턴 구독 해제 |

첫 번째 터미널에서 채널을 구독합니다.  

```console
$ sudo docker exec -it local-redis redis-cli
127.0.0.1:6379> SUBSCRIBE channel:notification
1) "subscribe"
2) "channel:notification"
3) (integer) 1
```

대화형 `redis-cli`는 구독 상태에서 일반 명령을 입력받지 않으므로 실습을 마치려면 `Ctrl+C`로 종료합니다.  
`UNSUBSCRIBE`와 `PUNSUBSCRIBE`는 애플리케이션의 Redis 클라이언트에서 구독을 제어할 때 사용할 수 있습니다.  

두 번째 터미널에서 메시지를 발행합니다.  

```console
$ sudo docker exec -it local-redis redis-cli
127.0.0.1:6379> PUBLISH channel:notification "new notification"
(integer) 1
```

첫 번째 터미널에서는 다음과 같이 메시지를 받을 수 있습니다.  

```text
1) "message"
2) "channel:notification"
3) "new notification"
```
