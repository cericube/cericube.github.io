---
layout: post
title: "01. Redis 설치 및 기본 명령어 정리"
description: "Docker와 Docker Compose로 Redis 8.6을 실행하고 주요 설정을 적용한 뒤 redis-cli 기본 명령어를 익히는 방법을 설명합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker로 Redis 설치 및 실행하기"
  - id: session-02
    title: "2. Redis 기본 설정 이해하기"
  - id: session-03
    title: "3. redis-cli와 기본 명령어 정리"
---

## 1. Docker로 Redis 설치 및 실행하기 {#session-01}

### 🟦 Redis 설치

다음 명령은 Redis 8.6 이미지를 내려받아 `redis`라는 이름의 컨테이너로 실행합니다.  

```bash
# 로컬에 이미지가 없으면 Redis 8.6 이미지를 자동으로 내려받습니다.
sudo docker run -d --name redis -p 6379:6379 redis:8.6

# 컨테이너가 실행 중인지 확인합니다.
sudo docker ps

# 컨테이너 안에서 Redis CLI를 실행합니다.
sudo docker exec -it redis redis-cli

# Redis 컨테이너를 중지합니다.
sudo docker stop redis
```

![Docker로 Redis 8.6 이미지 설치 및 실행](/assets/images/nodejs/nodejs-redis/redis-docker-install.png)

접속한 뒤 `PING` 명령을 실행합니다.  
`PONG`이 출력되면 Redis 서버가 정상적으로 동작하는 것입니다.  

![redis-cli에서 Redis 실행 상태 확인](/assets/images/nodejs/nodejs-redis/redis-cli-ping.png)

### 🟦 docker-compose.yml로 Redis 구성하기

Docker는 컨테이너를 만들고 실행하는 기본 도구입니다.  
Docker Compose는 여러 컨테이너를 하나의 애플리케이션처럼 묶어서 실행하고 관리하는 도구입니다.  

```yaml
services:
  redis:
    image: redis:8.6
    container_name: local-redis
    ports:
      - "6379:6379"
    volumes:
      # Docker 볼륨을 Redis 컨테이너의 /data 디렉터리에 연결합니다.
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

위 설정은 Redis를 `local-redis`라는 이름의 컨테이너로 실행합니다.  
`redis_data:/data`는 Docker 볼륨을 Redis 컨테이너의 `/data` 디렉터리에 연결하는 설정입니다.  
Redis는 기본적으로 메모리에 데이터를 저장하지만, RDB 또는 AOF Persistence를 사용하면 데이터를 디스크에도 저장할 수 있습니다.  

### 🟦 Docker Compose 실행 및 확인

```bash
# Redis를 백그라운드에서 실행합니다.
sudo docker compose up -d

# 컨테이너 상태를 확인합니다.
sudo docker compose ps

# Redis CLI에 접속합니다.
sudo docker exec -it local-redis redis-cli

# Docker 볼륨 목록을 확인합니다.
sudo docker volume ls

# Docker Named Volume이 실제로 저장된 위치를 확인합니다.
# workspace 부분은 Docker Compose 프로젝트 이름에 맞게 바꿉니다.
sudo docker volume inspect workspace_redis_data

# 실행 중인 컨테이너와 네트워크를 종료합니다.
sudo docker compose down
```

`docker volume inspect` 결과의 `Mountpoint`에서 실제 저장 경로를 확인할 수 있습니다.  

```text
"Mountpoint": "/var/lib/docker/volumes/workspace_redis_data/_data"
```

![Docker Compose로 Redis 실행 및 볼륨 확인](/assets/images/nodejs/nodejs-redis/redis-compose-run.png)

## 2. Redis 기본 설정 이해하기 {#session-02}

### 🟦 redis.conf 주요 설정

Redis 설정은 보통 `redis.conf` 파일에서 관리합니다.  
대표적인 설정은 다음과 같습니다.  

```conf
bind 127.0.0.1
port 6379
requirepass your_password
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
```

| 설정 | 의미 |
| --- | --- |
| `bind` | Redis가 바인딩할 네트워크 인터페이스 |
| `port` | Redis 서버 포트 |
| `requirepass` | Redis 접속 비밀번호 |
| `maxmemory` | Redis가 사용할 최대 메모리 |
| `maxmemory-policy` | 메모리 초과 시 Key 제거 정책 |
| `appendonly` | AOF Persistence 사용 여부 |

### 🟦 비밀번호 설정과 접속 방법

Redis에 비밀번호를 설정하려면 `requirepass` 옵션을 사용합니다.  

```conf
requirepass mypassword
```

Docker Compose에서 직접 설정하려면 다음과 같이 `command` 옵션에 추가할 수 있습니다.  

```yaml
services:
  redis:
    image: redis:8.6
    container_name: local-redis
    ports:
      - "6379:6379"
    command: redis-server --requirepass mypassword --appendonly yes
```

비밀번호가 설정된 Redis에 접속하면 인증하기 전에는 명령을 사용할 수 없습니다.  

```console
$ docker exec -it local-redis redis-cli
127.0.0.1:6379> PING
(error) NOAUTH Authentication required.

# AUTH 명령으로 인증합니다.
127.0.0.1:6379> AUTH mypassword
OK
127.0.0.1:6379> PING
PONG
```

처음부터 비밀번호를 전달하려면 `-a` 옵션을 사용할 수 있습니다.  

```bash
docker exec -it local-redis redis-cli -a mypassword
```

> `-a` 옵션에 비밀번호를 직접 작성하면 셸 기록이나 프로세스 정보에 노출될 수 있습니다. 실제 환경에서는 비밀번호 관리 방식과 Redis ACL 적용을 함께 검토해야 합니다.  

### 🟦 maxmemory와 Eviction Policy

`maxmemory`로 Redis가 데이터 저장에 사용할 수 있는 메모리 한도를 설정할 수 있습니다.  

```conf
maxmemory 256mb
```

Redis가 `maxmemory`에 도달했을 때 어떤 데이터를 제거할지 결정하는 정책을 Eviction Policy라고 합니다.  
LRU(Least Recently Used)는 가장 오랫동안 사용되지 않은 데이터를 우선 제거하는 방식입니다.  

```conf
maxmemory-policy allkeys-lru
```

| 정책 | 설명 |
| --- | --- |
| `noeviction` | 메모리가 가득 차면 새 데이터를 쓰는 요청에 오류를 반환 |
| `allkeys-lru` | 전체 Key 중 LRU 기준으로 제거 |
| `volatile-lru` | 만료 시간이 설정된 Key 중 LRU 기준으로 제거 |
| `allkeys-random` | 전체 Key 중 무작위로 제거 |
| `volatile-random` | 만료 시간이 설정된 Key 중 무작위로 제거 |
| `volatile-ttl` | 만료 시간이 설정된 Key 중 TTL이 짧은 Key부터 제거 |

캐시 서버로 Redis를 사용할 때는 `allkeys-lru` 계열을 자주 고려합니다.  
반대로 중요한 임시 데이터나 큐 데이터를 저장한다면 Key가 임의로 제거되는 정책은 위험할 수 있습니다.  

### 🟦 RDB와 AOF Persistence

Redis는 기본적으로 메모리에 데이터를 저장하지만, 설정에 따라 디스크에도 데이터를 저장할 수 있습니다.  
이를 Persistence라고 하며, 대표적인 방식은 RDB와 AOF입니다.  

| 구분 | RDB | AOF |
| --- | --- | --- |
| 저장 방식 | 특정 시점의 데이터를 스냅샷 파일로 저장 | Redis에 들어온 쓰기 명령을 로그 형태로 계속 기록 |
| 저장 단위 | 데이터 전체 상태 | 실행된 쓰기 명령 |
| 대표 설정 | `save 900 1`<br>`save 300 10`<br>`save 60 10000` | `appendonly yes`<br>`appendfsync everysec` |
| 장점 | 파일 크기가 비교적 작음<br>복구 속도가 빠른 편<br>백업 파일로 관리하기 좋음 | 데이터 유실 가능성이 상대적으로 낮음<br>쓰기 명령을 기반으로 복구 가능<br>운영 환경의 안정성 확보에 유리 |
| 단점 | 마지막 스냅샷 이후 데이터는 유실될 수 있음 | RDB보다 파일 크기가 커질 수 있음<br>`fsync` 정책에 따라 성능에 영향을 줄 수 있음 |
| 적합한 경우 | 캐시처럼 일부 데이터 유실이 허용되는 경우<br>빠른 백업과 복구가 중요한 경우 | 세션, 큐, 중요한 임시 데이터처럼 유실을 줄여야 하는 경우 |
| 개발 환경 추천 | 기본 설정으로도 충분히 실습 가능 | 데이터 유지 실습을 위해 `appendonly yes` 설정 권장 |
| 운영 환경 고려 사항 | 스냅샷 주기와 데이터 유실 허용 범위를 검토해야 함 | `appendfsync everysec`를 많이 사용하며 성능과 안정성의 균형을 고려해야 함 |

RDB 설정 예시는 다음과 같습니다.  

| 설정 | 의미 |
| --- | --- |
| `save 900 1` | 900초 동안 한 번 이상 변경되면 스냅샷 저장 |
| `save 300 10` | 300초 동안 열 번 이상 변경되면 스냅샷 저장 |
| `save 60 10000` | 60초 동안 10,000번 이상 변경되면 스냅샷 저장 |

AOF의 `appendfsync` 옵션은 다음과 같습니다.  

| 옵션 | 설명 | 특징 |
| --- | --- | --- |
| `always` | 쓰기 명령마다 디스크에 동기화 | 데이터 안정성은 가장 높지만 성능 저하 가능성이 큼 |
| `everysec` | 1초마다 디스크에 동기화 | 성능과 안정성의 균형이 좋아 일반적으로 많이 사용 |
| `no` | 운영체제가 디스크 동기화 시점을 결정 | 성능은 좋지만 장애 발생 시 데이터 유실 가능성이 큼 |

개발 실습에서는 `appendonly yes` 정도만 설정해도 충분합니다.  

### 🟦 redis.conf를 Docker에 적용하는 방법

Docker에서 Redis 설정을 바꾸는 대표적인 방법은 세 가지입니다.  

1. `redis-server` 실행 옵션으로 설정 전달
2. 호스트의 `redis.conf` 파일을 컨테이너에 마운트
3. `docker-compose.yml`에서 `redis.conf` 파일을 마운트

#### 🔷 방법 1: docker run에서 설정 옵션 직접 전달

간단한 테스트라면 `redis-server` 실행 옵션으로 설정을 전달할 수 있습니다.  

```bash
# 메모리 제한과 Eviction Policy를 지정합니다.
sudo docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:8.6 \
  redis-server \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru
```

#### 🔷 방법 2: 호스트의 redis.conf를 Docker 컨테이너에 마운트

프로젝트 구조는 다음과 같이 구성합니다.  

```text
my-project/
├── docker-compose.yml
└── redis/
    └── redis.conf
```

`redis/redis.conf` 파일을 작성합니다.  

```conf
# 컨테이너 외부의 Docker 포트 포워딩 연결을 받습니다.
bind 0.0.0.0
port 6379

requirepass mypassword

maxmemory 256mb
maxmemory-policy allkeys-lru

appendonly yes
appendfsync everysec
dir /data
```

현재 프로젝트의 설정 파일과 Named Volume을 컨테이너에 연결하여 실행합니다.  

```bash
sudo docker run -d \
  --name redis-conf \
  -p 6379:6379 \
  -v "$PWD/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro" \
  -v redis_data:/data \
  redis:8.6 \
  redis-server /usr/local/etc/redis/redis.conf
```

> `bind 0.0.0.0`은 컨테이너 밖의 연결을 받을 때 필요합니다. 외부에 노출되는 환경에서는 방화벽, 포트 바인딩, 인증 또는 ACL을 함께 설정해야 합니다.  

#### 🔷 방법 3: docker-compose.yml에서 redis.conf 마운트

프로젝트 구조는 방법 2와 같습니다.  

```text
my-project/
├── docker-compose.yml
└── redis/
    └── redis.conf
```

`redis/redis.conf` 파일을 작성합니다.  

```conf
# 컨테이너 외부의 Docker 포트 포워딩 연결을 받습니다.
bind 0.0.0.0
port 6379

requirepass mypassword

maxmemory 256mb
maxmemory-policy allkeys-lru

appendonly yes
appendfsync everysec
dir /data
```

`docker-compose.yml` 파일을 작성합니다.  

```yaml
services:
  redis:
    image: redis:8.6
    container_name: local-redis
    ports:
      - "6379:6379"
    volumes:
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_data:/data
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped

volumes:
  redis_data:
```

다음 명령으로 Redis를 실행하고 설정을 확인합니다.  

```bash
# Redis를 실행합니다.
docker compose up -d

# Redis 로그를 확인합니다. 종료하려면 Ctrl+C를 누릅니다.
docker compose logs -f redis

# Redis CLI에 접속합니다.
docker exec -it local-redis redis-cli
```

```console
127.0.0.1:6379> AUTH mypassword
OK
127.0.0.1:6379> PING
PONG
```

![redis.conf 적용 후 Redis 설정 확인](/assets/images/nodejs/nodejs-redis/redis-config-check.png)

## 3. redis-cli와 기본 명령어 정리 {#session-03}

### 🟦 redis-cli 접속 명령어

`redis-cli`는 Redis 서버에 명령을 직접 입력할 수 있는 터미널 도구입니다.  

| 명령어 | 설명 |
| --- | --- |
| `redis-cli` | 로컬 Redis에 기본 접속 |
| `redis-cli -h 127.0.0.1 -p 6379` | 호스트와 포트를 지정하여 접속 |
| `redis-cli -a mypassword` | 비밀번호가 설정된 Redis에 접속 |
| `AUTH mypassword` | CLI 접속 후 비밀번호 인증 |
| `docker exec -it local-redis redis-cli` | Docker 컨테이너 안에서 Redis CLI 실행 |
| `docker compose exec redis redis-cli` | Docker Compose 서비스 안에서 Redis CLI 실행 |
| `PING` | Redis 서버 응답 확인 |

```bash
# 비밀번호가 없는 경우
docker exec -it local-redis redis-cli

# 비밀번호가 있는 경우
docker exec -it local-redis redis-cli -a mypassword
```

### 🟦 서버 상태 확인 명령어

| 명령어 | 설명 |
| --- | --- |
| `PING` | Redis 서버와 정상적으로 통신하는지 확인 |
| `INFO` | Redis 서버의 전체 상태 정보 출력 |
| `INFO server` | Redis 버전, 운영체제, 프로세스 정보 확인 |
| `INFO memory` | Redis 메모리 사용량 확인 |
| `INFO clients` | 현재 연결된 클라이언트 정보 확인 |
| `INFO stats` | 명령 처리량과 Hit/Miss 등의 통계 확인 |
| `INFO persistence` | RDB와 AOF 저장 상태 확인 |
| `DBSIZE` | 현재 DB에 저장된 Key 개수 확인 |
| `TIME` | Redis 서버의 현재 시간 확인 |
| `CLIENT LIST` | 현재 Redis에 연결된 클라이언트 목록 확인 |
| `CONFIG GET <pattern>` | Redis 설정값 조회 |

```console
127.0.0.1:6379> INFO memory
127.0.0.1:6379> DBSIZE
(integer) 0
127.0.0.1:6379> CONFIG GET maxmemory
```

### 🟦 Key 관리 명령어

Redis의 모든 데이터는 Key를 기준으로 저장됩니다.  
따라서 Redis를 사용할 때는 Key 조회, 삭제, TTL 설정, 타입 확인 명령에 익숙해야 합니다.  

실무에서는 Key 이름을 다음과 같이 계층적으로 설계하는 경우가 많습니다.  

```text
# 일반적인 계층 구조 규칙
용도:도메인:식별자:속성

# 예시
cache:user:1
string:auth-code:kim@example.com
hash:user-profile:1
list:user:1:recent-posts
set:post-likes:100
zset:post-ranking
stream:orders
```

| 명령어 | 설명 |
| --- | --- |
| `EXISTS key` | Key가 존재하는지 확인 |
| `TYPE key` | Key에 저장된 데이터 타입 확인 |
| `DEL key` | Key 삭제 |
| `UNLINK key` | Key를 비동기 방식으로 삭제 |
| `EXPIRE key seconds` | Key에 만료 시간 설정 |
| `TTL key` | Key의 남은 만료 시간 확인 |
| `PERSIST key` | Key의 만료 시간 제거 |
| `RENAME oldKey newKey` | Key 이름 변경 |
| `KEYS pattern` | 패턴에 맞는 Key 목록 조회 |
| `SCAN cursor` | Key를 Cursor 방식으로 점진적으로 조회 |

```console
127.0.0.1:6379> SET user:1:name "Kim"
OK

127.0.0.1:6379> EXISTS user:1:name
(integer) 1

127.0.0.1:6379> GET user:1:name
"Kim"

127.0.0.1:6379> TYPE user:1:name
string

127.0.0.1:6379> EXPIRE user:1:name 60
(integer) 1

127.0.0.1:6379> TTL user:1:name
(integer) 52

127.0.0.1:6379> PERSIST user:1:name
(integer) 1

127.0.0.1:6379> TTL user:1:name
(integer) -1

127.0.0.1:6379> UNLINK user:1:name
(integer) 1
```

운영 환경에서는 `KEYS *` 명령을 주의해야 합니다.  
`KEYS`는 전체 Key를 한 번에 조회하므로 Key가 많은 Redis에서는 성능에 영향을 줄 수 있습니다.  
운영 환경에서는 `SCAN`을 사용하는 것이 좋습니다.  

```console
127.0.0.1:6379> SCAN 0
```

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

| 명령어 | 설명 |
| --- | --- |
| `SET key value` | 문자열 값 저장 |
| `GET key` | 문자열 값 조회 |
| `SET key value EX seconds` | 값을 저장하면서 TTL 설정 |
| `SET key value NX` | Key가 없을 때만 저장 |
| `SET key value XX` | Key가 이미 있을 때만 저장 |
| `MSET key value key value` | 여러 Key-Value를 한 번에 저장 |
| `MGET key key` | 여러 Key의 값을 한 번에 조회 |
| `INCR key` | 숫자 값을 1 증가 |
| `DECR key` | 숫자 값을 1 감소 |
| `INCRBY key number` | 숫자 값을 지정한 수만큼 증가 |
| `DECRBY key number` | 숫자 값을 지정한 수만큼 감소 |

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
| `HKEYS key` | Field 목록 조회 |
| `HVALS key` | Value 목록 조회 |
| `HLEN key` | Field 개수 조회 |

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
| `LPUSH key value` | List 왼쪽에 값 추가 |
| `RPUSH key value` | List 오른쪽에 값 추가 |
| `LPOP key` | List 왼쪽 값을 꺼내고 제거 |
| `RPOP key` | List 오른쪽 값을 꺼내고 제거 |
| `LRANGE key start stop` | List의 지정 범위 조회 |
| `LLEN key` | List 길이 조회 |
| `LINDEX key index` | 특정 Index의 값 조회 |
| `LTRIM key start stop` | 지정 범위만 남기고 나머지 제거 |
| `BLPOP key timeout` | 값이 들어올 때까지 기다렸다가 왼쪽에서 꺼냄 |
| `BRPOP key timeout` | 값이 들어올 때까지 기다렸다가 오른쪽에서 꺼냄 |

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
| `SRANDMEMBER key count` | 무작위 Member 조회 |
| `SPOP key` | 무작위 Member를 꺼내고 제거 |
| `SINTER key key` | 교집합 |
| `SUNION key key` | 합집합 |
| `SDIFF key key` | 차집합 |
| `SSCAN key cursor` | 큰 Set을 Cursor 방식으로 조회 |

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
| `ZRANGE key start stop` | Score가 낮은 순서로 조회 |
| `ZRANGE key start stop REV` | Score가 높은 순서로 조회 |
| `ZRANGE key start stop WITHSCORES` | Score와 함께 낮은 순서로 조회 |
| `ZRANGE key start stop REV WITHSCORES` | Score와 함께 높은 순서로 조회 |
| `ZRANK key member` | 낮은 Score 기준 순위 조회 |
| `ZREVRANK key member` | 높은 Score 기준 순위 조회 |
| `ZSCORE key member` | 특정 Member의 Score 조회 |
| `ZCARD key` | Member 개수 조회 |
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
| `XREVRANGE key end start` | 최신 순서로 메시지 조회 |
| `XLEN key` | Stream 메시지 개수 조회 |
| `XREAD STREAMS key id` | Stream에서 메시지 읽기 |
| `XGROUP CREATE key group id` | Consumer Group 생성 |
| `XREADGROUP GROUP group consumer STREAMS key id` | Consumer Group 기준으로 메시지 읽기 |
| `XACK key group id` | 메시지 처리 완료 표시 |
| `XPENDING key group` | 읽었지만 ACK되지 않은 메시지 확인 |
| `XDEL key id` | 특정 메시지 삭제 |

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
| `UNSUBSCRIBE channel` | 채널 구독 해제 |
| `PUNSUBSCRIBE pattern` | 패턴 구독 해제 |
| `PUBSUB CHANNELS` | 현재 활성화된 Pub/Sub 채널 목록 조회 |
| `PUBSUB NUMSUB channel` | 특정 채널의 구독자 수 조회 |

첫 번째 터미널에서 채널을 구독합니다.  

```console
$ docker exec -it local-redis redis-cli
127.0.0.1:6379> SUBSCRIBE channel:notification
```

두 번째 터미널에서 메시지를 발행합니다.  

```console
$ docker exec -it local-redis redis-cli
127.0.0.1:6379> PUBLISH channel:notification "new notification"
(integer) 1
```

첫 번째 터미널에서는 다음과 같이 메시지를 받을 수 있습니다.  

```text
1) "message"
2) "channel:notification"
3) "new notification"
```
