---
layout: post
title: "13. Redis Replication 설정과 장애 테스트"
description: "Redis 7.2에서 Primary와 Replica의 복제 구조를 이해하고, Docker Compose로 1 Primary·2 Replica 환경을 구성해 데이터 복제, 읽기 전용 동작과 장애 상황을 테스트합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 13
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis Primary·Replica 구조와 복제 동작 원리"
  - id: session-02
    title: "2. Primary와 Replica의 redis.conf 구성하기"
  - id: session-03
    title: "3. Docker Compose로 1 Primary·2 Replica 환경 구축하기"
  - id: session-04
    title: "4. 데이터 복제와 장애 상황 테스트하기"
---

Redis Replication은 하나의 Redis Primary 데이터를 하나 이상의 Replica로 복제하는 기능입니다.  
애플리케이션의 쓰기 작업은 Primary에서 수행하고, Replica는 Primary의 데이터를 복제하여 같은 데이터 세트를 유지합니다.  

```text
                 ┌─────────────────┐
                 │  Redis Primary  │
                 │     :6379       │
                 └────────┬────────┘
                          │
                     Replication
                    ┌─────┴─────┐
                    │           │
                    ▼           ▼
          ┌──────────────┐ ┌──────────────┐
          │   Replica 1  │ │   Replica 2  │
          │    :6379     │ │    :6379     │
          └──────────────┘ └──────────────┘
```

Redis Replication 자체에는 Primary 장애 시 Replica를 자동으로 Primary로 승격하는 기능이 없습니다.  
자동 장애 감지와 Failover가 필요하다면 Redis Sentinel이나 Redis Cluster를 함께 사용해야 합니다.  

## 1. Redis Primary·Replica 구조와 복제 동작 원리 {#session-01}

### 🟦 Redis Replication이란?

Redis Replication은 Primary의 데이터를 하나 이상의 Replica로 전달하는 기능입니다.  
기본적인 데이터 흐름은 다음과 같습니다.  

```text
Client
  │
  │ SET / DEL / INCR ...
  ▼
Primary
  │
  ├─────────────┐
  │             │
  ▼             ▼
Replica 1    Replica 2
```

Primary에서 데이터 변경이 발생하면 해당 변경 내용이 Replica로 전달됩니다.  
예를 들어 Primary에서 다음 명령을 실행합니다.  

```text
SET user:1:name "Kim"
```

복제가 완료된 뒤에는 Replica에서도 같은 데이터를 조회할 수 있습니다.  

```text
GET user:1:name
"Kim"
```

Redis의 일반적인 Primary·Replica 구성에서는 쓰기 작업을 Primary에서 수행하고 Replica를 읽기 용도로 사용합니다.  
Replica는 기본적으로 읽기 전용이므로 Replica에서 `SET`이나 `DEL` 같은 쓰기 명령을 실행하면 오류가 발생합니다.  

### 🟦 Replication을 사용하는 이유

Redis Replication을 사용하는 대표적인 이유는 다음과 같습니다.  

| 목적 | 설명 |
| --- | --- |
| 데이터 복제 | Primary 데이터를 다른 Redis 서버에도 유지 |
| 읽기 분산 | Replica를 조회 용도로 활용 |
| 장애 대응 기반 | Primary 장애 시 Replica를 승격할 수 있는 기반 제공 |
| Sentinel 구성 | Sentinel Failover에 필요한 복제 구조 제공 |
| Cluster 구성 | 각 Primary에 Replica를 배치해 장애 대응 기반 제공 |

다만 Replication을 구성했다고 해서 자동 Failover가 제공되는 것은 아닙니다.  
Primary가 중지되더라도 Replica가 자동으로 Primary가 되지는 않습니다.  

```text
             X
          Primary
             │
      ┌──────┴──────┐
      ▼             ▼
 Replica 1       Replica 2
 Read-Only       Read-Only
```

Replication은 데이터를 복제하는 기능입니다.  
장애를 감지하고 Replica를 자동으로 승격하는 역할은 Sentinel 같은 별도의 구성 요소가 담당합니다.  

### 🟦 Redis Replication의 기본 동작

Replica는 Primary와 연결된 뒤 데이터를 동기화합니다.  
정상 상태에서는 Primary에서 발생한 변경 사항이 Replica에 계속 전달됩니다.  

```text
Primary                         Replica

SET key1 value1
   │
   ├──────────────────────────▶ key1=value1
   │
INCR count
   │
   ├──────────────────────────▶ count 증가
   │
DEL key2
   │
   └──────────────────────────▶ key2 삭제
```

Redis Replication은 기본적으로 비동기 방식입니다.  
따라서 Primary의 명령 처리와 Replica의 적용 사이에는 짧은 지연이 생길 수 있습니다.  
쓰기 직후 반드시 최신 값을 읽어야 하는 로직에서는 이 점을 고려해야 합니다.  

네트워크 단절 등으로 Replica와 Primary의 연결이 일시적으로 끊겼다가 복구되면 Redis는 가능한 경우 변경된 부분만 다시 동기화하는 Partial Resynchronization을 시도합니다.  
필요한 복제 이력을 사용할 수 없으면 전체 데이터 동기화가 수행될 수 있습니다.  

실습에서는 내부 동기화 과정을 자세히 분석하기보다 `INFO replication`으로 연결 상태와 복제 결과를 확인합니다.  

## 2. Primary와 Replica의 redis.conf 구성하기 {#session-02}

### 🟦 프로젝트 디렉터리 구성

다음과 같이 프로젝트 디렉터리를 구성합니다.  

```text
redis-replication/
├── docker-compose.yml
├── master/
│   └── redis.conf
├── replica1/
│   └── redis.conf
└── replica2/
    └── redis.conf
```

디렉터리를 만들고 프로젝트 루트로 이동합니다.  

```bash
# Primary와 두 Replica의 설정 파일을 분리해서 관리합니다.
mkdir -p ~/runtimes/redis-replication/{master,replica1,replica2}
cd ~/runtimes/redis-replication

# 현재 작업 경로를 확인합니다.
pwd
```

실행 환경에 따라 다음과 같은 경로가 출력됩니다.  

```text
/home/ubuntu/runtimes/redis-replication
```

### 🟦 Primary redis.conf 작성

먼저 `master/redis.conf`를 작성합니다.  

```properties
# --------------------------------------------------
# Network
# --------------------------------------------------

# Docker 네트워크에서 Replica의 연결을 받습니다.
# 호스트 포트는 Compose에서 127.0.0.1에만 공개합니다.
bind 0.0.0.0

# Redis 기본 포트입니다.
port 6379

# --------------------------------------------------
# Authentication
# --------------------------------------------------

# 실습용 비밀번호입니다.
# 운영 환경에서는 충분히 복잡한 비밀번호나 ACL을 사용해야 합니다.
requirepass mypassword

# Primary와 Replica 모두 동일한 maxmemory 및 maxmemory-policy 설정을 적용하는 것이 원칙입니다
maxmemory 256mb
maxmemory-policy allkeys-lru


# --------------------------------------------------
# Persistence
# --------------------------------------------------

# 다음 조건은 실습용 RDB 저장 조건입니다.
save 900 1
save 300 10

# AOF를 활성화하고 약 1초마다 디스크와 동기화합니다.
appendonly yes
appendfsync everysec

# AOF Rewrite의 Base 파일을 RDB 형식으로 저장합니다.
aof-use-rdb-preamble yes

# 영속성 파일을 Docker Volume이 연결된 경로에 저장합니다.
dir /data
```

Primary에는 별도의 `replicaof` 설정이 필요하지 않습니다.  
Replica가 Primary의 주소와 포트를 지정하여 연결하기 때문입니다.  

### 🟦 Replica redis.conf 작성

`replica1/redis.conf`에 다음 설정을 작성합니다.  

```properties
# --------------------------------------------------
# Network
# --------------------------------------------------

bind 0.0.0.0
port 6379

# --------------------------------------------------
# Authentication
# --------------------------------------------------

# 클라이언트가 이 Replica에 접속할 때 사용하는 비밀번호입니다.
requirepass mypassword

# Replica가 Primary에 복제 연결할 때 사용하는 비밀번호입니다.
# Primary redis.confg 의 requirepass 값
masterauth mypassword

# --------------------------------------------------
# Replication
# --------------------------------------------------

# Docker Compose의 서비스 이름과 Redis 포트로 Primary를 지정합니다.
replicaof redis-master 6379

# Replica에서 쓰기 명령을 금지합니다.
# Redis 7.2의 기본값도 yes이지만 실습에서는 명시적으로 작성합니다.
replica-read-only yes

# Primary와 Replica 모두 동일한 maxmemory 및 maxmemory-policy 설정을 적용하는 것이 원칙입니다
maxmemory 256mb
maxmemory-policy allkeys-lru

# --------------------------------------------------
# Persistence
# --------------------------------------------------

save 900 1
save 300 10

appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes

dir /data
```

이번 실습에서 두 Replica는 같은 설정을 사용합니다.  
따라서 Replica 1 설정을 Replica 2 설정으로 복사합니다.  

```bash
# 두 Replica는 서로 다른 컨테이너와 Volume을 사용하지만 설정 내용은 같습니다.
cp replica1/redis.conf replica2/redis.conf
```

### 🟦 replicaof 설정

Replica 구성에서 가장 중요한 설정은 다음과 같습니다.  

```properties
replicaof redis-master 6379
```

형식은 다음과 같습니다.  

```text
replicaof <Primary 주소> <Primary 포트>
```

Docker Compose에서는 같은 네트워크에 속한 서비스끼리 서비스 이름으로 접근할 수 있습니다.  
이번 Compose 설정에서 Primary의 서비스 이름은 `redis-master`입니다.  
따라서 변경될 수 있는 컨테이너 IP를 직접 지정하지 않고 `redis-master:6379`를 사용합니다.  

### 🟦 requirepass와 masterauth 설정

Primary에는 다음과 같이 접속 비밀번호를 설정했습니다.  

```properties
requirepass mypassword
```

Replica도 Primary에 연결할 때 인증해야 합니다.  
이때 Replica에서 사용하는 설정이 `masterauth`입니다.  

```properties
masterauth mypassword
```

두 설정의 역할은 다음과 같습니다.  

| 설정 | 역할 |
| --- | --- |
| `requirepass` | 클라이언트가 현재 Redis에 접속할 때 사용할 비밀번호 |
| `masterauth` | Replica가 Primary에 복제 연결할 때 사용할 비밀번호 |

Redis 7.2에서 `requirepass`는 기본 사용자의 비밀번호를 지정하는 ACL 호환 설정입니다.  
운영 환경에서 복제 전용 ACL 사용자를 구성한다면 `masteruser`와 `masterauth`를 함께 설정할 수 있습니다.  
이번 실습에서는 인증 흐름을 단순하게 확인하기 위해 같은 비밀번호를 사용합니다.  

### 🟦 replica-read-only 설정

Redis Replica는 기본적으로 읽기 전용으로 동작합니다.  
실습에서는 이 동작을 명확히 보여 주기 위해 다음 설정을 작성합니다.  

```properties
replica-read-only yes
```

따라서 Replica에서 다음과 같은 쓰기 명령을 실행하면 `READONLY` 오류가 발생합니다.  

```text
SET test value
```

일반적인 Replication 구성에서는 Replica에 직접 쓰지 않고 Primary를 통해 데이터를 변경합니다.  

## 3. Docker Compose로 1 Primary·2 Replica 환경 구축하기 {#session-03}

### 🟦 docker-compose.yml 작성

프로젝트 루트의 `docker-compose.yml`에 다음 내용을 작성합니다.  

```yaml
name: redis-replication

services:
  redis-master:
    # 같은 실습 환경을 재현할 수 있도록 Redis 7.2 패치 버전을 고정합니다.
    image: redis:7.2
    container_name: redis-master
    restart: unless-stopped

    ports:
      # Primary는 호스트의 6379 포트로 접근합니다.
      - "127.0.0.1:6379:6379"

    volumes:
      # Primary 설정 파일을 읽기 전용으로 연결합니다.
      - ./master/redis.conf:/usr/local/etc/redis/redis.conf:ro

      # Primary 영속성 데이터를 별도의 Named Volume에 저장합니다.
      - master_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

  redis-replica1:
    image: redis:7.2
    container_name: redis-replica1
    restart: unless-stopped

    ports:
      # Replica 1은 호스트의 6380 포트로 접근합니다.
      - "127.0.0.1:6380:6379"

    volumes:
      - ./replica1/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - replica1_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    # 컨테이너 생성 순서만 지정하며 복제 연결 완료까지 보장하지는 않습니다.
    depends_on:
      - redis-master

  redis-replica2:
    image: redis:7.2
    container_name: redis-replica2
    restart: unless-stopped

    ports:
      # Replica 2는 호스트의 6381 포트로 접근합니다.
      - "127.0.0.1:6381:6379"

    volumes:
      - ./replica2/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - replica2_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    depends_on:
      - redis-master

volumes:
  master_data:
  replica1_data:
  replica2_data:
```

호스트에서 접근하는 포트는 다음과 같습니다.  

| Redis | Docker 서비스 | 호스트 포트 | 컨테이너 포트 |
| --- | --- | ---: | ---: |
| Primary | `redis-master` | 6379 | 6379 |
| Replica 1 | `redis-replica1` | 6380 | 6379 |
| Replica 2 | `redis-replica2` | 6381 | 6379 |

호스트에서는 각기 다른 포트를 사용하지만 Docker 네트워크 안에서는 모두 Redis 기본 포트인 `6379`를 사용합니다.  
Replica가 Primary에 연결할 때도 호스트 포트가 아닌 `redis-master:6379`를 사용합니다.  

```text
Host

127.0.0.1:6379 ──▶ redis-master:6379
127.0.0.1:6380 ──▶ redis-replica1:6379
127.0.0.1:6381 ──▶ redis-replica2:6379

Docker Network

redis-replica1 ──┐
                 ├──▶ redis-master:6379
redis-replica2 ──┘
```

### 🟦 Redis Replication 환경 실행

설정 파일이 모두 준비되었는지 확인합니다.  

```bash
# 프로젝트 경로와 파일 구성을 확인합니다.
pwd
~/runtimes/redis-replication
find . -maxdepth 2 -type f -print
```

다음 파일이 출력되어야 합니다.  

```text
./docker-compose.yml
./master/redis.conf
./replica1/redis.conf
./replica2/redis.conf
```

Docker Compose를 실행하고 컨테이너 상태를 확인합니다.  

```bash
# 세 Redis 컨테이너를 백그라운드에서 실행합니다.
sudo docker compose up -d

# 모든 컨테이너가 실행 중인지 확인합니다.
sudo docker compose ps
```

정상적으로 실행되면 다음과 비슷하게 출력됩니다.  

```text
NAME              IMAGE          STATUS
redis-master      redis:7.2      Up
redis-replica1    redis:7.2      Up
redis-replica2    redis:7.2      Up
```

복제 연결 과정은 각 서비스의 로그에서 확인할 수 있습니다.  

```bash
# Primary와 두 Replica의 로그를 함께 확인합니다.
sudo docker compose logs redis-master redis-replica1 redis-replica2
```

전체 로그를 계속 확인하려면 `sudo docker compose logs -f`를 실행하고, 종료할 때 `Ctrl+C`를 누릅니다.  

### 🟦 Primary Replication 상태 확인

Primary에서 `INFO replication`을 실행합니다.  

```bash
# 비밀번호가 명령 기록에 남을 수 있으므로 이 방식은 실습 환경에서만 사용합니다.
sudo docker exec -it redis-master redis-cli -a mypassword INFO replication
```

두 Replica의 연결이 완료되면 주요 항목은 다음과 비슷하게 출력됩니다.  

```text
# Replication
role:master
connected_slaves:2
slave0:ip=172.x.x.x,port=6379,state=online,...
slave1:ip=172.x.x.x,port=6379,state=online,...
```

Redis 7.2의 `INFO replication` 출력에는 호환성을 위해 `master`, `slave`와 같은 기존 필드 이름이 남아 있습니다.  
이 글에서는 설명할 때 Primary와 Replica라는 용어를 사용합니다.  

| 항목 | 의미 |
| --- | --- |
| `role:master` | 현재 Redis가 Primary 역할임 |
| `connected_slaves:2` | 연결된 Replica가 2개임 |
| `state=online` | 해당 Replica가 정상 연결된 상태임 |

### 🟦 Replica Replication 상태 확인

Replica 1에서도 `INFO replication`을 실행합니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword INFO replication
```

주요 출력은 다음과 같습니다.  

```text
# Replication
role:slave
master_host:redis-master
master_port:6379
master_link_status:up
master_sync_in_progress:0
```

| 항목 | 의미 |
| --- | --- |
| `role:slave` | 현재 Redis가 Replica 역할임 |
| `master_host` | 연결된 Primary 주소 |
| `master_port` | Primary 포트 |
| `master_link_status:up` | Primary와 연결된 상태임 |
| `master_sync_in_progress:0` | 현재 전체 동기화가 진행 중이 아님 |

Replica 2도 같은 방법으로 확인합니다.  

```bash
sudo docker exec -it redis-replica2 redis-cli -a mypassword INFO replication
```

복제가 준비된 상태에서는 두 Replica 모두 `master_link_status:up`이어야 합니다.  

## 4. 데이터 복제와 장애 상황 테스트하기 {#session-04}

### 🟦 테스트 1: Primary에서 데이터 저장

Primary에 접속하여 테스트 데이터를 저장합니다.  

```bash
sudo docker exec -it redis-master redis-cli -a mypassword
```

```text
127.0.0.1:6379> SET replication:test "primary-data"
OK

127.0.0.1:6379> SET user:1:name "Kim"
OK

127.0.0.1:6379> INCR visit:count
(integer) 1

127.0.0.1:6379> INCR visit:count
(integer) 2

127.0.0.1:6379> MGET replication:test user:1:name visit:count
1) "primary-data"
2) "Kim"
3) "2"
```

### 🟦 테스트 2: 두 Replica에서 복제 데이터 확인

Replica 1과 Replica 2에서 같은 키를 조회합니다.  

```bash
# Replica 1에서 복제된 데이터를 조회합니다.
sudo docker exec -it redis-replica1 \
  redis-cli -a mypassword MGET replication:test user:1:name visit:count

# Replica 2에서도 같은 데이터를 조회합니다.
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword MGET replication:test user:1:name visit:count
```

두 명령 모두 다음과 같은 결과를 출력합니다.  

```text
1) "primary-data"
2) "Kim"
3) "2"
```

Primary에서 값을 변경한 뒤 두 Replica에 변경 내용이 전달되는지도 확인합니다.  

```bash
# Primary의 값과 카운터를 변경합니다.
sudo docker exec -it redis-master redis-cli -a mypassword SET user:1:name "Lee"
sudo docker exec -it redis-master redis-cli -a mypassword INCR visit:count

# 두 Replica에서 변경된 값을 확인합니다.
sudo docker exec -it redis-replica1 redis-cli -a mypassword MGET user:1:name visit:count
sudo docker exec -it redis-replica2 redis-cli -a mypassword MGET user:1:name visit:count
```

복제가 완료되면 두 Replica에서 다음 결과를 확인할 수 있습니다.  

```text
1) "Lee"
2) "3"
```

복제는 비동기 방식이므로 실행 환경에 따라 변경 내용이 Replica에 도착하기까지 짧은 시간이 걸릴 수 있습니다.  

### 🟦 테스트 3: Replica의 읽기 전용 동작 확인

Replica 1에서 직접 쓰기 명령을 실행합니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword
```

```text
127.0.0.1:6379> SET replica:test "data"
(error) READONLY You can't write against a read only replica.
```

`replica-read-only yes`가 적용되어 있으므로 쓰기 명령이 거부됩니다.  
일반적인 애플리케이션에서는 쓰기를 Primary로 보내고 Replica를 읽기에 사용합니다.  

```text
                    Application
                         │
              ┌──────────┴──────────┐
              │                     │
            WRITE                  READ
              │                     │
              ▼                     ▼
           Primary              Replica
```

Replica를 읽기 분산에 사용하면 복제 지연으로 인해 최신 값이 아직 보이지 않을 수 있습니다.  
쓰기 직후 최신 데이터를 반드시 읽어야 하는 로직은 Primary에서 조회하는 등의 일관성 전략이 필요합니다.  

### 🟦 테스트 4: Replica 중지 후 재동기화 확인

Replica 1을 중지한 상태에서 Primary의 데이터를 변경합니다.  

```bash
# Replica 1의 연결을 끊습니다.
sudo docker stop redis-replica1

# Replica 1이 중지된 동안 Primary에 새 데이터를 저장합니다.
sudo docker exec -it redis-master \
  redis-cli -a mypassword SET sync:test "created-while-replica-down"
sudo docker exec -it redis-master redis-cli -a mypassword INCR visit:count

# Replica 1을 다시 실행합니다.
sudo docker start redis-replica1
```

Replica 1이 Primary와 다시 연결되었는지 확인합니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword INFO replication
```

정상적으로 연결되면 다음 값을 확인할 수 있습니다.  

```text
role:slave
master_link_status:up
```

중지 중에 Primary에 추가한 데이터도 조회합니다.  

```bash
sudo docker exec -it redis-replica1 \
  redis-cli -a mypassword GET sync:test
```

```text
"created-while-replica-down"
```

Replica는 재연결할 때 가능한 경우 부분 재동기화를 수행하고, 필요하면 전체 데이터를 다시 동기화합니다.  

Primary의 연결된 Replica 수도 확인할 수 있습니다.  

```bash
sudo docker exec -it redis-master redis-cli -a mypassword INFO replication
```

Replica 1이 중지된 동안에는 잠시 후 `connected_slaves:1`이 되고, 다시 연결되면 `connected_slaves:2`로 돌아옵니다.  

### 🟦 테스트 5: Primary 장애 상황 확인

Primary 컨테이너를 중지합니다.  

```bash
sudo docker stop redis-master
sudo docker ps
```

Replica 1의 복제 상태를 확인합니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword INFO replication
```

Primary와 연결이 끊어지면 다음과 같은 상태가 됩니다.  

```text
role:slave
master_link_status:down
```

Primary가 중지되어도 이미 Replica에 복제된 데이터는 읽을 수 있습니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword MGET user:1:name replication:test
```

```text
1) "Lee"
2) "primary-data"
```

다만 Primary 장애 직전의 변경이 Replica에 아직 도착하지 않았다면 최신 데이터가 아닐 수 있습니다.  
Replica의 역할도 여전히 `role:slave`이므로 쓰기 명령은 다음과 같이 실패합니다.  

```text
127.0.0.1:6379> SET failover:test "data"
(error) READONLY You can't write against a read only replica.
```

```text
                  Primary
                     X
                   DOWN
                   /  \
                  /    \
                 ▼      ▼
           Replica 1  Replica 2
           Read-Only  Read-Only
```

즉 Replication만 구성한 환경에서는 Primary 장애가 발생해도 쓰기 가능한 Redis가 자동으로 만들어지지 않습니다.  

Primary를 다시 실행하면 두 Replica가 기존 Primary에 다시 연결합니다.  

```bash
sudo docker start redis-master

# Primary에 두 Replica가 다시 연결되었는지 확인합니다.
sudo docker exec -it redis-master redis-cli -a mypassword INFO replication

# Replica 1의 Primary 연결 상태도 확인합니다.
sudo docker exec -it redis-replica1 redis-cli -a mypassword INFO replication
```

정상적으로 복구되면 Primary에서는 `connected_slaves:2`, Replica에서는 `master_link_status:up`을 확인할 수 있습니다.  

### 🟦 Replica를 수동으로 Primary로 전환하기

Redis에서는 실행 중인 Replica에 `REPLICAOF NO ONE`을 실행해 복제 연결을 해제하고 독립적인 Primary로 전환할 수 있습니다.  
수동 전환 동작을 확인하기 위해 Primary를 다시 중지합니다.  

```bash
sudo docker stop redis-master

# 전환 전 Replica 1의 역할을 확인합니다.
sudo docker exec -it redis-replica1 redis-cli -a mypassword ROLE

# Replica 1을 독립적인 Primary로 전환합니다.
sudo docker exec -it redis-replica1 \
  redis-cli -a mypassword REPLICAOF NO ONE
```

명령이 성공하면 `OK`가 출력됩니다.  
역할과 쓰기 가능 여부를 확인합니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a mypassword INFO replication
sudo docker exec -it redis-replica1 \
  redis-cli -a mypassword SET manual:failover "success"
```

Replica 1의 역할은 `role:master`로 바뀌고 쓰기 명령도 성공합니다.  
하지만 이것은 자동 Failover가 아니라 관리자가 직접 수행한 수동 전환입니다.  

### 🔷 Replica 2의 복제 대상 확인

`REPLICAOF NO ONE`은 명령을 실행한 Replica 1의 역할만 변경합니다.  
Replica 2에 새로운 Primary 정보를 자동으로 전달하지는 않습니다.  
따라서 Replica 2는 여전히 중지된 기존 Primary인 `redis-master:6379`에 다시 연결하려고 시도합니다.  

```bash
# Replica 2가 어느 Primary를 바라보는지 확인합니다.
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword INFO replication
```

주요 상태는 다음과 같습니다.  

```text
role:slave
master_host:redis-master
master_port:6379
master_link_status:down
```

Replica 2의 로그에서도 기존 Primary에 연결하지 못하는 상황을 확인할 수 있습니다.  

```bash
# 최근 로그만 확인하여 반복되는 연결 실패 메시지를 찾습니다.
sudo docker compose logs --tail=20 redis-replica2
```

실행 환경에 따라 `Connection refused` 또는 `Error condition on socket for SYNC`와 비슷한 메시지가 반복될 수 있습니다.  
로그 문구는 Redis와 운영체제 버전에 따라 다를 수 있으므로 `master_link_status:down`도 함께 확인합니다.  

Replica 2는 Replica 1에 새로 기록되는 데이터를 아직 복제받지 못합니다.  
Redis 7.2의 기본값인 `replica-serve-stale-data yes` 상태에서는 Primary 연결이 끊겨도 허용된 읽기 명령으로 기존 데이터를 조회할 수 있지만, 그 데이터는 과거 상태일 수 있습니다.  

```bash
# 새 Primary에만 저장한 Key가 Replica 2에는 아직 없는지 확인합니다.
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword GET manual:failover
```

```text
(nil)
```

### 🔷 Replica 2가 새로운 Primary를 따르도록 변경

Replica 2의 복제 대상을 승격된 Replica 1로 수동 변경합니다.  
Docker 네트워크에서는 Replica 1의 서비스 이름인 `redis-replica1`을 사용할 수 있습니다.  

```bash
# Replica 2가 승격된 Replica 1을 새로운 Primary로 복제하도록 변경합니다.
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword REPLICAOF redis-replica1 6379
```

명령이 성공하면 `OK`가 출력됩니다.  
Replica 2가 새로운 Primary와 동기화를 마칠 때까지 기다린 뒤 상태를 확인합니다.  

```bash
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword INFO replication
```

정상적으로 연결되면 다음 값을 확인할 수 있습니다.  

```text
role:slave
master_host:redis-replica1
master_port:6379
master_link_status:up
master_sync_in_progress:0
```

새 Primary에 기록했던 데이터가 Replica 2에도 동기화되었는지 확인합니다.  

```bash
sudo docker exec -it redis-replica2 \
  redis-cli -a mypassword GET manual:failover
```

```text
"success"
```

현재 복제 구조는 다음과 같이 변경되었습니다.  

```text
       기존 Primary
       redis-master
             X

       새로운 Primary
      redis-replica1
             │
             │ Replication
             ▼
      redis-replica2
```

### 🔷 설정 파일과 실행 중 설정의 차이

앞에서 실행한 두 `REPLICAOF` 명령은 실행 중인 Redis의 복제 설정만 변경합니다.  
`replica1/redis.conf`와 `replica2/redis.conf`에는 여전히 다음 설정이 남아 있습니다.  

```properties
replicaof redis-master 6379
```

컨테이너를 설정 파일로 다시 시작하면 두 인스턴스 모두 원래 Primary인 `redis-master`를 다시 따릅니다.  
수동 전환 구성을 재시작 후에도 유지하려면 Replica 1의 `replicaof` 설정을 제거하고, Replica 2의 설정을 `replicaof redis-replica1 6379`로 변경해야 합니다.  
수동 승격 후 기존 Primary를 그대로 재실행하면 서로 다른 쓰기를 받은 두 Primary가 생길 수 있으므로 주의해야 합니다.  
운영 환경에서 장애조치를 수행할 때는 기존 Primary를 안전하게 격리하고, 다른 Replica와 애플리케이션의 연결 대상도 새로운 Primary에 맞게 재구성해야 합니다.  

### 🟦 실습 환경 원상 복구

수동 승격 테스트를 마쳤다면 다음 실습을 위해 환경을 원래 상태로 복구합니다.  

```bash
# 컨테이너와 네트워크를 종료합니다.
sudo docker compose down

# redis.conf에 기록된 역할 구성으로 다시 실행합니다.
sudo docker compose up -d

# Primary에 두 Replica가 연결되었는지 확인합니다.
sudo docker exec -it redis-master redis-cli -a mypassword INFO replication
```

Named Volume까지 삭제하여 데이터를 완전히 초기화하려면 다음 명령을 사용할 수 있습니다.  

```bash
# Primary와 Replica의 영속성 데이터까지 삭제합니다.
sudo docker compose down -v
```

> `-v` 옵션은 세 Redis의 RDB와 AOF 파일이 들어 있는 Named Volume을 삭제합니다. 필요한 데이터가 없는지 확인한 뒤 사용해야 하며, 삭제한 Volume은 일반적으로 복구할 수 없습니다.  

### 🟦 주요 Replication 확인 명령어

Replication 실습에서 자주 사용하는 명령은 다음과 같습니다.  

| 명령어 | 설명 |
| --- | --- |
| `INFO replication` | 현재 Replication 연결과 역할 확인 |
| `ROLE` | 현재 Redis의 Primary 또는 Replica 역할 확인 |
| `CONFIG GET replicaof` | 설정된 Primary 정보 확인 |
| `CONFIG GET replica-read-only` | Replica 읽기 전용 설정 확인 |
| `REPLICAOF host port` | 실행 중인 Redis를 특정 Primary의 Replica로 변경 |
| `REPLICAOF NO ONE` | 현재 Replica를 독립적인 Primary로 변경 |
