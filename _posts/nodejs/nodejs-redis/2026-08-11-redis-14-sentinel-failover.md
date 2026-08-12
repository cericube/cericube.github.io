---
layout: post
title: "14. Redis Sentinel 구성과 자동 Failover 테스트"
description: "Redis Replication 환경에 Sentinel 3개를 구성하고, Primary 장애 감지부터 Replica 자동 승격과 기존 Primary 재편입까지 자동 Failover 전 과정을 테스트합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 14
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis Sentinel 구조와 Failover 동작 이해하기"
  - id: session-02
    title: "2. 고정 IP 기반 Redis와 sentinel.conf 설정하기"
  - id: session-03
    title: "3. Docker Compose로 Redis와 Sentinel 구축하기"
  - id: session-04
    title: "4. Primary 장애와 자동 Failover 검증하기"
---

Redis Sentinel은 Primary와 Replica의 상태를 감시하고 Primary 장애 시 자동 Failover를 수행하는 기능입니다.  
여러 Sentinel이 Primary의 장애에 동의하면 Replica 하나를 새로운 Primary로 승격하고 나머지 Replica의 복제 대상도 변경합니다.  

이번 글에서는 `1 Primary + 2 Replica` 구성에 Sentinel 3개를 추가합니다.  
Primary 장애 감지부터 Replica 승격, 기존 Primary 재편입까지 전체 Failover 과정을 확인합니다.  

![Redis Primary와 Replica를 Sentinel 3개가 감시하는 구성](/assets/images/nodejs/nodejs-redis/redis-sentinel-failover.png)

Sentinel은 현재 Primary 주소도 제공하므로 Sentinel을 지원하는 클라이언트는 Failover 이후 새로운 Primary를 찾아 다시 연결할 수 있습니다.  

## 1. Redis Sentinel 구조와 Failover 동작 이해하기 {#session-01}

### 🟦 Sentinel의 역할

Redis Sentinel의 주요 역할은 다음과 같습니다.  

| 역할 | 설명 |
| --- | --- |
| Monitoring | Primary와 Replica의 상태를 지속해서 확인 |
| Failure Detection | 여러 Sentinel의 판단을 모아 Primary 장애 여부 결정 |
| Automatic Failover | Replica 하나를 새로운 Primary로 승격하고 복제 구조 재구성 |
| Configuration Provider | 클라이언트가 연결할 현재 Primary 주소 제공 |

Sentinel을 사용하는 애플리케이션은 특정 Redis 서버가 항상 Primary라고 가정해서는 안 됩니다.  
Failover가 발생하면 Primary가 변경될 수 있기 때문입니다.  

![Redis Failover 전후의 Primary와 Replica 역할 변화](/assets/images/nodejs/nodejs-redis/redis-sentinel-failover-before-after.png)

Sentinel을 지원하는 Redis 클라이언트는 특정 컨테이너에 고정 연결하지 않습니다.  
대신 Sentinel에 현재 Primary 주소를 질의한 뒤 해당 Redis에 연결합니다.  
실습에서는 `SENTINEL GET-MASTER-ADDR-BY-NAME` 명령으로 이 과정을 직접 확인합니다.  

### 🟦 Sentinel을 3개 구성하는 이유

Sentinel도 하나의 프로세스이므로 하나만 구성하면 그 Sentinel 자체가 단일 장애 지점이 됩니다.  
Redis 공식 문서는 안정적인 배포를 위해 최소 3개의 Sentinel을 서로 독립적으로 장애가 발생할 수 있는 서버나 VM에 배치하도록 권장합니다.  

이번 실습에서는 Sentinel 3개와 quorum `2`를 사용합니다.  

```properties
#                [그룹 이름]   [Primary IP]  [포트]  [quorum]
sentinel monitor mymaster      172.30.0.10  6379    2
```

`mymaster`는 Sentinel이 감시할 Primary와 Replica 묶음을 식별하는 그룹 이름입니다.  
마지막 값 `2`는 quorum입니다.  
Sentinel 두 개 이상이 Primary에 문제가 있다고 판단해야 해당 Primary를 ODOWN 상태로 전환할 수 있다는 뜻입니다.  

`quorum`과 실제 Failover 승인은 서로 다른 개념입니다.  
`quorum`은 ODOWN 판단 기준이며, 실제 Failover를 수행할 Sentinel은 전체 Sentinel 과반수의 승인을 받아야 합니다.  
Sentinel 3개를 사용하면 적어도 2개의 Sentinel이 서로 통신할 수 있어야 Failover를 진행할 수 있습니다.  

```text
Sentinel 1 ──┐
             │
Sentinel 2 ──┼── Primary 장애 판단
             │
Sentinel 3 ──┘

quorum = 2, Failover 승인도 과반수 필요
```

### 🟦 SDOWN과 ODOWN

Sentinel은 장애 상태를 SDOWN과 ODOWN으로 구분합니다.  

| 상태 | 의미 |
| --- | --- |
| SDOWN | 개별 Sentinel이 주관적으로 Primary가 응답하지 않는다고 판단한 상태 |
| ODOWN | quorum 이상의 Sentinel이 Primary 장애에 동의하여 객관적 장애로 판단한 상태 |

Sentinel 하나의 SDOWN 판단만으로는 Failover를 수행하지 않습니다.  
다른 Sentinel의 판단을 확인해 quorum을 충족하면 ODOWN으로 전환하고 Failover 절차를 시작합니다.  

```text
Sentinel 1 ── Down
Sentinel 2 ── Down
Sentinel 3 ── 확인 중

quorum = 2
      │
      ▼
    ODOWN
```

### 🟦 Sentinel Failover 흐름

Failover 과정은 다음과 같이 진행됩니다.  

```text
1. Primary 응답 없음
          ↓
2. 각 Sentinel이 SDOWN 판단
          ↓
3. quorum 충족 후 ODOWN 판단
          ↓
4. Failover를 수행할 Sentinel 선출
          ↓
5. 승격할 Replica 선택
          ↓
6. 선택된 Replica를 Primary로 승격
          ↓
7. 나머지 Replica를 새로운 Primary에 연결
          ↓
8. 기존 Primary가 복구되면 새 Primary의 Replica로 재구성
```

Redis Replication은 비동기 방식이므로 Failover가 데이터 무손실을 보장하지는 않습니다.  
Primary 장애 직전의 쓰기가 Replica에 도착하지 않았다면 새 Primary에서 해당 데이터가 누락될 수 있습니다.  

## 2. 고정 IP 기반 Redis와 sentinel.conf 설정하기 {#session-02}

### 🟦 실습에서 고정 IP를 사용하는 이유

Docker Compose의 사용자 정의 네트워크에서는 `redis-master` 같은 컨테이너 이름을 hostname으로 사용할 수 있습니다.  
하지만 Primary 컨테이너가 중지되어 hostname 해석이 실패하거나 지연되면 Sentinel의 장애 확인과 Failover도 영향을 받을 수 있습니다.  

이때 Sentinel 로그에는 다음과 같은 메시지가 나타날 수 있습니다.  

```text
Failed to resolve hostname 'redis-master'
```

이번 실습에서는 DNS 문제를 제외하고 Failover 흐름에 집중하기 위해 Redis와 Sentinel에 고정 IP를 할당합니다.  

Sentinel의 hostname 지원은 기본적으로 비활성화되어 있습니다.  
이번 IP 기반 실습에서는 `sentinel resolve-hostnames yes`와 `sentinel announce-hostnames yes`를 사용하지 않습니다.  

| 구성 요소 | 컨테이너 이름 | 고정 IP |
| --- | --- | --- |
| Primary | `redis-master` | `172.30.0.10` |
| Replica 1 | `redis-replica1` | `172.30.0.11` |
| Replica 2 | `redis-replica2` | `172.30.0.12` |
| Sentinel 1 | `redis-sentinel1` | `172.30.0.21` |
| Sentinel 2 | `redis-sentinel2` | `172.30.0.22` |
| Sentinel 3 | `redis-sentinel3` | `172.30.0.23` |

Primary가 중지되면 Sentinel은 hostname을 다시 해석하지 않고 `172.30.0.10:6379`의 연결 실패를 직접 감지합니다.  
이후 `SDOWN → ODOWN → Replica 승격` 순서로 Failover를 진행합니다.  

### 🟦 프로젝트 디렉터리 구성

다음과 같이 프로젝트 디렉터리를 구성합니다.  

```text
redis-sentinel/
├── docker-compose.yml
├── master/
│   └── redis.conf
├── replica1/
│   └── redis.conf
├── replica2/
│   └── redis.conf
├── sentinel1/
│   └── sentinel.conf
├── sentinel2/
│   └── sentinel.conf
└── sentinel3/
    └── sentinel.conf
```

디렉터리를 만들고 프로젝트 루트로 이동합니다.  

```bash
# Redis 3개와 Sentinel 3개의 설정 디렉터리를 만듭니다.
mkdir -p ~/runtimes/redis-sentinel/{master,replica1,replica2,sentinel1,sentinel2,sentinel3}
cd ~/runtimes/redis-sentinel

# 현재 작업 경로를 확인합니다.
pwd
```

실행 환경에 따라 다음과 같은 경로가 출력됩니다.  

```text
/home/ubuntu/runtimes/redis-sentinel
```

### 🟦 Primary redis.conf 작성

`master/redis.conf`에 다음 설정을 작성합니다.  

```properties
# Docker 네트워크에서 Replica와 Sentinel의 연결을 받습니다.
bind 0.0.0.0
port 6379

# 실습용 비밀번호입니다.
# 운영 환경에서는 충분히 복잡한 비밀번호나 ACL을 사용해야 합니다.
requirepass dnqnsxn

# Failover 후 이 Redis가 Replica가 되었을 때 사용할 Primary 비밀번호입니다.
masterauth dnqnsxn

# Redis가 사용할 수 있는 최대 메모리를 256MB로 제한합니다.
maxmemory 256mb
# 메모리가 가득 차면 모든 키 중 가장 오래 사용하지 않은 키부터 제거합니다.
maxmemory-policy allkeys-lru

# 900초 동안 키가 1개 이상 변경되면 RDB 스냅샷을 저장합니다.
save 900 1
# 300초 동안 키가 10개 이상 변경되면 RDB 스냅샷을 저장합니다.
save 300 10

# 모든 쓰기 명령을 AOF 파일에도 기록합니다.
appendonly yes
# AOF 내용을 약 1초마다 디스크에 동기화합니다.
appendfsync everysec
# AOF 재작성 시 앞부분을 RDB 형식으로 저장해 로딩 속도와 파일 크기를 개선합니다.
aof-use-rdb-preamble yes

# 영속성 파일을 Docker Volume이 연결된 경로에 저장합니다.
dir /data
```

Sentinel 환경에서는 Primary와 Replica의 역할이 바뀔 수 있습니다.  
따라서 모든 Redis에 클라이언트 인증용 `requirepass`와 복제 인증용 `masterauth`를 함께 설정합니다.  
Sentinel 자체의 설정은 Redis 서버의 `redis.conf`가 아닌 별도의 `sentinel.conf`에서 관리합니다.  

### 🟦 Replica redis.conf 작성

`replica1/redis.conf`에 다음 설정을 작성합니다.  

```properties
# Docker 네트워크의 모든 인터페이스에서 연결을 받습니다.
bind 0.0.0.0
port 6379

# 클라이언트와 Sentinel이 Replica에 접속할 때 사용하는 비밀번호입니다.
requirepass dnqnsxn

# 이 Redis가 Replica 역할일 때 Primary에 복제 연결하는 비밀번호입니다.
masterauth dnqnsxn

# 시작할 때 연결할 초기 Primary의 고정 IP를 지정합니다.
replicaof 172.30.0.10 6379

# Replica의 기본 읽기 전용 동작을 명시합니다.
replica-read-only yes

# Redis가 사용할 수 있는 최대 메모리를 256MB로 제한합니다.
maxmemory 256mb
# 메모리가 가득 차면 모든 키 중 가장 오래 사용하지 않은 키부터 제거합니다.
maxmemory-policy allkeys-lru

# 900초 동안 키가 1개 이상 변경되면 RDB 스냅샷을 저장합니다.
save 900 1
# 300초 동안 키가 10개 이상 변경되면 RDB 스냅샷을 저장합니다.
save 300 10

# 모든 쓰기 명령을 AOF 파일에도 기록합니다.
appendonly yes
# AOF 내용을 약 1초마다 디스크에 동기화합니다.
appendfsync everysec
# AOF 재작성 시 앞부분을 RDB 형식으로 저장해 로딩 속도와 파일 크기를 개선합니다.
aof-use-rdb-preamble yes

# RDB와 AOF 영속성 파일을 Docker Volume이 연결된 경로에 저장합니다.
dir /data
```

이번 실습에서 두 Replica는 같은 초기 설정을 사용합니다.  
Replica 1 설정을 Replica 2 설정으로 복사합니다.  

```bash
# 두 Replica는 서로 다른 컨테이너와 Volume을 사용하지만 초기 설정은 같습니다.
cp replica1/redis.conf replica2/redis.conf
```

두 Replica는 시작할 때 `172.30.0.10:6379`를 초기 Primary로 사용합니다.  
장애가 발생하면 Sentinel이 Replica 하나를 승격하고, 나머지 노드에 새로운 Primary 주소를 전달해 복제 구조를 다시 구성합니다.  

### 🟦 sentinel.conf 작성

Sentinel 1의 `sentinel1/sentinel.conf`에 다음 설정을 작성합니다.  

```properties
# Sentinel의 기본 포트입니다.
port 26379

# Sentinel 프로세스의 작업 디렉터리입니다.
dir "/tmp"

# Primary 그룹 이름, 고정 IP, 포트와 quorum을 지정합니다.
sentinel monitor mymaster 172.30.0.10 6379 2

# Sentinel이 Primary와 Replica에 인증할 때 사용하는 비밀번호입니다.
sentinel auth-pass mymaster dnqnsxn

# 5초 동안 정상 응답을 받지 못하면 해당 Sentinel이 SDOWN으로 판단합니다.
sentinel down-after-milliseconds mymaster 5000

# Failover 재시도와 관련된 시간 기준을 60초로 지정합니다.
sentinel failover-timeout mymaster 60000

# Failover 후 한 번에 하나의 Replica를 새 Primary와 동기화합니다.
sentinel parallel-syncs mymaster 1
```

같은 초기 설정을 Sentinel 2와 Sentinel 3에 복사합니다.  
각 Sentinel은 시작할 때 고유 ID를 생성하고 발견한 토폴로지를 자신의 설정 파일에 기록합니다.  

```bash
cp sentinel1/sentinel.conf sentinel2/sentinel.conf
cp sentinel1/sentinel.conf sentinel3/sentinel.conf
```

핵심 Sentinel 설정은 다음과 같습니다.  

| 설정 | 의미 |
| --- | --- |
| `port 26379` | Sentinel 기본 포트 |
| `sentinel monitor` | 감시할 Primary의 고정 IP와 quorum 지정 |
| `sentinel auth-pass` | Redis 서버에 접속할 인증 비밀번호 지정 |
| `down-after-milliseconds` | 개별 Sentinel이 SDOWN으로 판단할 시간 |
| `failover-timeout` | Failover 재시도 등에서 사용하는 시간 기준 |
| `parallel-syncs` | Failover 후 동시에 재동기화할 Replica 수 |

`down-after-milliseconds`의 `5000`은 5초입니다.  
실습에서 장애 감지 과정을 빠르게 확인하기 위한 값이며 운영 환경에서는 네트워크 지연과 장애 감지 요구사항을 함께 고려해야 합니다.  

`parallel-syncs 1`은 Failover 후 한 번에 하나의 Replica만 새 Primary와 동기화하게 합니다.  
값이 작으면 전체 재구성 시간이 길어질 수 있지만 여러 Replica가 동시에 재동기화 상태에 들어가는 상황을 줄일 수 있습니다.  

### 🟦 Sentinel 설정 디렉터리에 쓰기 권한 부여

Sentinel은 실행 중에 발견한 Replica와 다른 Sentinel, Failover 결과를 `sentinel.conf`에 기록합니다.  
Sentinel은 설정 파일 경로에 쓰기 권한이 없으면 시작을 거부합니다.  

Sentinel은 임시 파일을 만든 뒤 기존 설정 파일을 교체할 수 있으므로 파일 하나가 아니라 설정 디렉터리 전체를 쓰기 가능하게 준비합니다.  
간단한 로컬 실습에서는 다음과 같이 권한을 부여할 수 있습니다.  

```bash
# 디렉터리와 파일 소유자를 UID 999(redis)로 변경합니다.
sudo chown -R 999:999 sentinel1 sentinel2 sentinel3

# Sentinel이 임시 파일을 만들 수 있도록 실습 디렉터리에 쓰기 권한을 부여합니다.
sudo chmod 755 sentinel1 sentinel2 sentinel3

# 각 sentinel.conf도 Sentinel 프로세스가 수정할 수 있게 합니다.
sudo chmod 644 sentinel1/sentinel.conf sentinel2/sentinel.conf sentinel3/sentinel.conf

# 적용된 권한을 확인합니다.
ls -ld sentinel1 sentinel2 sentinel3
ls -l sentinel*/sentinel.conf
```

실행 환경에 따라 다음과 같은 결과가 출력됩니다.  

```text
drwxr-xr-x 2 999 systemd-journal 4096 Aug 11 13:59 sentinel1
drwxr-xr-x 2 999 systemd-journal 4096 Aug 11 14:14 sentinel2
drwxr-xr-x 2 999 systemd-journal 4096 Aug 11 14:14 sentinel3
```

> Redis 공식 Docker 이미지의 내부 `redis` 계정은 UID/GID `999`를 사용합니다.  
> Sentinel이 임시 파일을 생성·교체하려면 디렉터리에 `rwx` 권한이 필요하고, `sentinel.conf`를 읽고 수정하려면 파일에 `rw-` 권한이 필요합니다.  
> Ubuntu·Debian 계열에서 GID `999`가 `systemd-journal` 그룹 이름으로 표시될 수 있으며, 이는 호스트의 그룹 정보로 숫자 GID를 표시한 결과입니다.  

## 3. Docker Compose로 Redis와 Sentinel 구축하기 {#session-03}

### 🟦 docker-compose.yml 작성

프로젝트 루트의 `docker-compose.yml`에 다음 내용을 작성합니다.  

```yaml
# 이 Compose 애플리케이션의 프로젝트 이름을 지정합니다.
name: redis-sentinel

services:
  redis-master:
    # 같은 실습 환경을 재현할 수 있도록 패치 버전까지 고정합니다.
    image: redis:7.2.15

    # 컨테이너 이름을 고정하고 사용자가 중지하지 않는 한 장애나 재부팅 후 다시 시작합니다.
    container_name: redis-master
    restart: unless-stopped

    # 호스트의 루프백 주소로만 Redis 포트를 공개합니다.
    ports:
      - "127.0.0.1:6379:6379"

    # Redis 설정은 읽기 전용으로, 영속성 데이터는 이름 있는 Volume에 연결합니다.
    volumes:
      - ./master/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - master_data:/data

    # 컨테이너에 연결한 redis.conf를 사용해 Redis 서버를 실행합니다.
    command: redis-server /usr/local/etc/redis/redis.conf

    # 각 컨테이너(Redis)에 고정 IP를 할당합니다.
    networks:
      redis-net:
        ipv4_address: 172.30.0.10

  # 두 Replica는 Primary와 같은 이미지와 실행 옵션을 사용하고 포트, 설정, 데이터 Volume과 IP만 구분합니다.
  redis-replica1:
    image: redis:7.2.15
    container_name: redis-replica1
    restart: unless-stopped

    ports:
      - "127.0.0.1:6380:6379"

    volumes:
      - ./replica1/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - replica1_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-net:
        ipv4_address: 172.30.0.11

    # Primary 컨테이너를 먼저 시작하지만 서비스 준비 완료까지 기다리지는 않습니다.
    depends_on:
      - redis-master

  redis-replica2:
    image: redis:7.2.15
    container_name: redis-replica2
    restart: unless-stopped

    ports:
      - "127.0.0.1:6381:6379"

    volumes:
      - ./replica2/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - replica2_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-net:
        ipv4_address: 172.30.0.12

    depends_on:
      - redis-master

  sentinel1:
    # Redis 이미지에 포함된 Sentinel 실행 파일을 사용합니다.
    image: redis:7.2.15
    container_name: redis-sentinel1
    restart: unless-stopped

    volumes:
      # Sentinel이 설정을 다시 쓸 수 있도록 디렉터리 전체를 연결합니다.
      - ./sentinel1:/usr/local/etc/redis

    # 연결한 sentinel.conf를 사용해 Redis 서버 대신 Sentinel을 실행합니다.
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf

    # 세 Sentinel이 서로 구분되도록 각각 고정 IP를 할당합니다.
    networks:
      redis-net:
        ipv4_address: 172.30.0.21

    # Redis 노드를 먼저 시작하지만 각 노드의 준비 상태까지 확인하지는 않습니다.
    depends_on:
      - redis-master
      - redis-replica1
      - redis-replica2

  sentinel2:
    image: redis:7.2.15
    container_name: redis-sentinel2
    restart: unless-stopped

    volumes:
      - ./sentinel2:/usr/local/etc/redis

    command: redis-sentinel /usr/local/etc/redis/sentinel.conf

    networks:
      redis-net:
        ipv4_address: 172.30.0.22

    depends_on:
      - redis-master
      - redis-replica1
      - redis-replica2

  sentinel3:
    image: redis:7.2.15
    container_name: redis-sentinel3
    restart: unless-stopped

    volumes:
      - ./sentinel3:/usr/local/etc/redis

    command: redis-sentinel /usr/local/etc/redis/sentinel.conf

    networks:
      redis-net:
        ipv4_address: 172.30.0.23

    depends_on:
      - redis-master
      - redis-replica1
      - redis-replica2

networks:
  redis-net:
    # 고정 IP를 사용할 수 있도록 사용자 정의 bridge 네트워크와 대역을 구성합니다.
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24

volumes:
  # 컨테이너를 다시 생성해도 각 Redis의 RDB와 AOF 데이터를 유지합니다.
  master_data:
  replica1_data:
  replica2_data:
```

Redis 설정 파일은 읽기 전용으로 연결하고 Sentinel 설정 디렉터리는 쓰기 가능하게 연결합니다.  
Redis 7.2.15의 Sentinel은 역할을 바꿀 Redis에 `REPLICAOF`와 `CONFIG REWRITE`를 함께 요청합니다.  
이 구성에서는 `REPLICAOF`에 따른 역할 변경은 실행 중인 Redis에 적용되지만, `CONFIG REWRITE`는 읽기 전용 `redis.conf`를 갱신하지 못합니다.  

Redis 컨테이너가 재시작되면 설정 파일에 작성된 초기 역할로 먼저 실행될 수 있습니다.  
Sentinel은 `sentinel.conf`에 저장한 최신 토폴로지를 기준으로 노드 상태를 확인하고, 현재 Primary에 맞게 Redis 역할을 다시 구성합니다.  
따라서 `redis.conf`를 읽기 전용으로 유지하는 것만으로 전체 실습이 최초 상태로 초기화되지는 않습니다.  
실습을 처음부터 반복하려면 Redis 컨테이너와 함께 Sentinel 설정 상태도 초기화해야 합니다.  

> 운영 환경에서는 Redis가 `CONFIG REWRITE`를 수행할 수 있도록 쓰기 가능한 설정 저장소를 제공하거나, 외부 구성 관리 도구를 사용해 재시작 후에도 올바른 토폴로지가 적용되도록 관리해야 합니다.  

Sentinel 포트는 호스트에 별도로 공개하지 않습니다.  
이번 실습에서는 Sentinel 컨테이너 안에서 `redis-cli`를 실행하기 때문입니다.  

#### 호스트에서 Sentinel에 접속하는 구성 예시

호스트에서 실행한 `redis-cli`나 애플리케이션이 Sentinel에 직접 접속해야 한다면 각 Sentinel 서비스에 `ports`를 추가합니다.  
세 Sentinel은 컨테이너 내부에서 모두 `26379` 포트를 사용하므로 호스트 포트만 `26379`, `26380`, `26381`로 나누어 충돌을 방지합니다.  

```yaml
services:
  sentinel1:
    ports:
      # 호스트 26379 포트를 Sentinel 1의 26379 포트에 연결합니다.
      - "127.0.0.1:26379:26379"

  sentinel2:
    ports:
      - "127.0.0.1:26380:26379"

  sentinel3:
    ports:
      - "127.0.0.1:26381:26379"
```

`127.0.0.1`에 바인딩했으므로 같은 호스트에서만 이 포트로 접속할 수 있습니다.  
Compose 설정을 변경한 뒤 Sentinel 컨테이너를 다시 생성합니다.  

```bash
# 변경한 포트 매핑을 적용하도록 Sentinel 컨테이너만 다시 생성합니다.
sudo docker compose up -d --force-recreate sentinel1 sentinel2 sentinel3
```

호스트에 `redis-cli`가 설치되어 있다면 다음 명령으로 각 Sentinel의 응답을 확인합니다.  

```bash
# 세 Sentinel이 공개한 호스트 포트로 각각 접속합니다.
redis-cli -h 127.0.0.1 -p 26379 PING
redis-cli -h 127.0.0.1 -p 26380 PING
redis-cli -h 127.0.0.1 -p 26381 PING

# Sentinel 1에 현재 Primary 주소를 질의합니다.
redis-cli -h 127.0.0.1 -p 26379 \
  SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
```

각 `PING` 명령이 `PONG`을 반환하고 마지막 명령에서 현재 Primary의 IP와 포트가 출력되면 정상입니다.  

### 🟦 Docker 네트워크와 Sentinel 주소 확인

이번 구성은 사용자 정의 브리지 네트워크 `redis-net`을 `172.30.0.0/24` 대역으로 만듭니다.  

```text
redis-net (172.30.0.0/24)

172.30.0.10:6379  redis-master
172.30.0.11:6379  redis-replica1
172.30.0.12:6379  redis-replica2

172.30.0.21:26379 redis-sentinel1
172.30.0.22:26379 redis-sentinel2
172.30.0.23:26379 redis-sentinel3
```

### 🟦 환경 실행

프로젝트 파일과 Sentinel 설정 디렉터리 권한을 확인합니다.  

```bash
# 필요한 설정 파일이 모두 있는지 확인합니다.
find . -maxdepth 2 -type f -print

# Sentinel 설정 디렉터리와 파일의 권한을 확인합니다.
ls -ld sentinel1 sentinel2 sentinel3
ls -l sentinel*/sentinel.conf
```

Docker Compose를 실행하고 컨테이너 상태를 확인합니다.  

```bash
# Redis 3개와 Sentinel 3개를 백그라운드에서 실행합니다.
sudo docker compose up -d

# 6개 컨테이너가 실행 중인지 확인합니다.
sudo docker compose ps

# 네트워크 목록을 확인
sudo docker network ls

# 컨테이너가 어떤 네트워크에 붙어 있는지 바로 확인
sudo docker network inspect redis-sentinel_redis-net

for c in redis-master redis-replica1 redis-replica2 redis-sentinel1 redis-sentinel2 redis-sentinel3; do
  ip=$(sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$c")
  if [[ "$c" == redis-sentinel* ]]; then
    port=26379
  else
    port=6379
  fi
  printf "%-22s %s\n" "${ip}:${port}" "$c"
done
```

Sentinel이 시작하지 못했다면 로그와 설정 디렉터리 권한을 먼저 확인합니다.  

```bash
# 세 Sentinel의 시작 로그를 함께 확인합니다.
sudo docker compose logs -f sentinel1 sentinel2 sentinel3
```

### 🟦 Redis Replication 상태 확인

초기 Primary에 두 Replica가 연결되었는지 확인합니다.  

```bash
sudo docker exec -it redis-master \
  redis-cli -a dnqnsxn INFO replication
```

정상 상태에서는 다음 값을 확인할 수 있습니다.  

```text
role:master
connected_slaves:2
```

### 🟦 Sentinel이 감시하는 토폴로지 확인

Sentinel 1에서 현재 감시 중인 Primary 정보를 확인합니다.  

```bash
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 SENTINEL MASTER mymaster
```

주요 항목은 다음과 같습니다.  

```text
name
mymaster
flags
master
num-slaves
2
num-other-sentinels
2
quorum
2
```

| 항목 | 의미 |
| --- | --- |
| `name` | Sentinel에서 사용하는 Primary 그룹 이름 |
| `flags` | Sentinel이 판단한 현재 Primary 상태 |
| `num-slaves` | Sentinel이 발견한 Replica 수 |
| `num-other-sentinels` | 현재 Sentinel 외에 발견한 Sentinel 수 |
| `quorum` | ODOWN 판단에 필요한 Sentinel 수 |

`num-slaves`가 `2`, `num-other-sentinels`가 `2`로 표시될 때까지 잠시 기다립니다.  
Sentinel은 Primary의 복제 정보와 Sentinel 간 메시지를 이용해 Replica와 다른 Sentinel을 자동으로 발견합니다.  

발견한 Replica와 다른 Sentinel의 상세 정보도 확인합니다.  

```bash
# Sentinel이 발견한 Replica를 확인합니다.
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 SENTINEL REPLICAS mymaster

# Sentinel 1이 발견한 다른 Sentinel을 확인합니다.
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 SENTINEL SENTINELS mymaster
```

현재 Primary 주소는 다음 명령으로 조회합니다.  

```bash
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 \
  SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
```

정상적으로 실행되면 초기 Primary에 할당한 고정 IP와 Redis 포트가 출력됩니다.  

```text
1) "172.30.0.10"
2) "6379"
```

이 명령은 Failover 전후의 Primary 주소를 비교할 때 사용합니다.  

마지막으로 현재 Sentinel 구성이 장애 판단에 필요한 quorum과 Failover 승인에 필요한 과반수를 확보했는지 확인합니다.  

```bash
# quorum과 과반수 조건을 모두 충족하는지 점검합니다.
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 SENTINEL CKQUORUM mymaster
```

정상 상태라면 다음과 같이 quorum과 Failover 승인 조건을 충족한다는 응답이 출력됩니다.  

```text
OK 3 usable Sentinels. Quorum and failover authorization can be reached
```

## 4. Primary 장애와 자동 Failover 검증하기 {#session-04}

### 🟦 테스트 1: 데이터 저장과 복제 확인

Failover 이전 Primary에 테스트 데이터를 저장합니다.  

```bash
sudo docker exec -it redis-master redis-cli -a dnqnsxn
```

```text
127.0.0.1:6379> SET sentinel:test "before-failover"
OK

127.0.0.1:6379> SET user:1:name "Kim"
OK

127.0.0.1:6379> INCR visit:count
(integer) 1

127.0.0.1:6379> INCR visit:count
(integer) 2

127.0.0.1:6379> MGET sentinel:test user:1:name visit:count
1) "before-failover"
2) "Kim"
3) "2"
```

두 Replica에 같은 데이터가 복제되었는지 확인합니다.  

```bash
sudo docker exec -it redis-replica1 \
  redis-cli -a dnqnsxn MGET sentinel:test user:1:name visit:count

sudo docker exec -it redis-replica2 \
  redis-cli -a dnqnsxn MGET sentinel:test user:1:name visit:count
```

두 명령 모두 같은 세 값을 반환해야 합니다.  

### 🟦 테스트 2: Failover 전 역할 확인

세 Redis의 현재 역할을 확인합니다.  

```bash
for container in redis-master redis-replica1 redis-replica2
do
  echo "===== $container ====="
  sudo docker exec "$container" \
    redis-cli -a dnqnsxn INFO replication \
    | grep -E '^(role|master_host|master_link_status|connected_slaves):'
done

===== redis-master =====
role:master
connected_slaves:2
===== redis-replica1 =====
role:slave
master_host:172.30.0.10
master_link_status:up
connected_slaves:0
===== redis-replica2 =====
role:slave
master_host:172.30.0.10
master_link_status:up
connected_slaves:0
```

Failover 전에는 `redis-master`가 `role:master`, 두 Replica가 `role:slave`여야 합니다.  

### 🟦 테스트 3: Primary 중지와 Sentinel 로그 확인

별도의 터미널에서 Sentinel 로그를 실시간으로 확인합니다.  

```bash
sudo docker compose logs -f sentinel1 sentinel2 sentinel3
```

다른 터미널에서 Primary 컨테이너를 중지합니다.  

```bash
# 실제 Primary 장애 상황을 만들기 위해 기존 Primary를 중지합니다.
sudo docker stop redis-master
```

`down-after-milliseconds`를 5초로 설정했으므로 각 Sentinel은 정상 응답을 받지 못한 시간이 기준을 넘으면 SDOWN으로 판단합니다.  
여러 Sentinel의 판단이 quorum을 충족하면 ODOWN으로 전환되고 Failover 절차가 진행됩니다.  

Sentinel 로그에서는 다음과 같은 이벤트를 확인할 수 있습니다.  

```text
+sdown
+odown
+try-failover
+elected-leader
+selected-slave
+promoted-slave
+failover-end
+switch-master
```

`+switch-master`가 출력되면 Sentinel이 새로운 Primary 구성을 확정해 전파하기 시작한 것입니다.  
실제 출력 순서와 일부 이벤트는 실행 환경에 따라 달라질 수 있습니다.  

### 🟦 테스트 4: 새로운 Primary 확인

Sentinel에 현재 Primary 주소를 다시 요청합니다.  

```bash
sudo docker exec -it redis-sentinel1 \
  redis-cli -p 26379 \
  SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
```

Failover가 완료되면 기존 Primary IP `172.30.0.10`이 아닌 Replica 1의 `172.30.0.11` 또는 Replica 2의 `172.30.0.12`가 반환됩니다.  
Replica 1이 승격되었다면 각 Sentinel의 `sentinel.conf`에 있는 `sentinel monitor` 주소도 `172.30.0.11`로 갱신됩니다.  
Replica 2가 승격된 경우에는 `172.30.0.12`로 갱신되며, 전파가 끝나면 세 Sentinel이 같은 Primary 주소를 저장합니다.  

어느 Replica가 승격되었는지도 직접 확인합니다.  

```bash
for container in redis-replica1 redis-replica2
do
  echo "===== $container ====="
  sudo docker exec "$container" \
    redis-cli -a dnqnsxn INFO replication \
    | grep -E '^(role|master_host|master_link_status):'
done
```

예를 들어 다음과 같이 출력되면 Replica 1이 새로운 Primary입니다.  

```text
===== redis-replica1 =====
role:master

===== redis-replica2 =====
role:slave
master_host:172.30.0.11
master_link_status:up
```

승격 대상은 실행 시점의 복제 상태와 우선순위 등에 따라 Replica 2가 될 수도 있습니다.  

### 🟦 테스트 5: 새로운 Primary에서 읽기와 쓰기 확인

이하 예제에서는 Replica 1이 승격되었다고 가정합니다.  
다른 Replica가 승격되었다면 컨테이너 이름을 실제 결과에 맞게 바꿉니다.  

```bash
sudo docker exec -it redis-replica1 redis-cli -a dnqnsxn
```

Failover 이전 데이터를 조회하고 새로운 데이터를 저장합니다.  

```text
127.0.0.1:6379> MGET sentinel:test user:1:name visit:count
1) "before-failover"
2) "Kim"
3) "2"

127.0.0.1:6379> SET sentinel:test "after-failover"
OK

127.0.0.1:6379> SET failover:result "success"
OK
```

기존 Replica가 Primary 데이터를 복제하고 있었으므로 Failover 이후에도 복제된 데이터를 사용할 수 있습니다.  
다만 장애 직전의 최신 쓰기가 새 Primary로 승격된 Replica에 도착하지 않았을 가능성은 남아 있습니다.  

### 🟦 테스트 6: 나머지 Replica의 복제 대상 확인

Replica 1이 승격되었다면 Replica 2가 새로운 Primary를 따르는지 확인합니다.  

```bash
sudo docker exec -it redis-replica2 \
  redis-cli -a dnqnsxn INFO replication
```

다음 상태를 확인합니다.  

```text
role:slave
master_link_status:up
master_sync_in_progress:0
```

`master_host`는 승격된 Replica 1의 고정 IP `172.30.0.11`을 가리켜야 합니다.  
새로운 Primary에서 저장한 데이터도 조회합니다.  

```bash
sudo docker exec -it redis-replica2 \
  redis-cli -a dnqnsxn GET failover:result
```

```text
"success"
```

Sentinel은 Failover 후 나머지 Replica가 새로운 Primary를 복제하도록 자동으로 재구성합니다.  

### 🟦 테스트 7: 기존 Primary 복구와 Replica 재편입 확인

중지했던 기존 Primary를 다시 실행합니다.  

```bash
sudo docker start redis-master
```

기존 Primary는 읽기 전용 `redis.conf`의 초기 역할에 따라 먼저 Primary로 실행될 수 있습니다.  
Sentinel이 이를 감지하여 새로운 Primary의 Replica로 재구성할 때까지 잠시 기다린 뒤 상태를 확인합니다.  

```bash
sudo docker exec -it redis-master \
  redis-cli -a dnqnsxn INFO replication
```

Replica 1이 새로운 Primary인 예에서는 다음 상태가 되어야 합니다.  

```text
role:slave
master_link_status:up
```

`master_host`는 새로운 Primary를 가리킵니다.  
Failover 이후 저장한 데이터도 복제되었는지 확인합니다.  

```bash
sudo docker exec -it redis-master \
  redis-cli -a dnqnsxn MGET sentinel:test failover:result
```

```text
1) "after-failover"
2) "success"
```

컨테이너 이름에 `master`가 포함되어 있어도 현재 역할이 Primary라는 뜻은 아닙니다.  
Failover 이후 실제 역할은 `INFO replication` 또는 `ROLE` 명령으로 확인해야 합니다.  

```text
                   redis-replica1
                    New Primary
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
              redis-master  redis-replica2
                 Replica       Replica
```

### 🟦 세 Sentinel의 Primary 정보 확인

세 Sentinel이 모두 같은 Primary를 반환하는지 확인합니다.  

```bash
for sentinel in redis-sentinel1 redis-sentinel2 redis-sentinel3
do
  echo "===== $sentinel ====="
  sudo docker exec "$sentinel" \
    redis-cli -p 26379 \
    SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
done

===== redis-sentinel1 =====
172.30.0.11
6379
===== redis-sentinel2 =====
172.30.0.11
6379
===== redis-sentinel3 =====
172.30.0.11
6379
```

세 Sentinel의 응답 주소와 포트가 모두 같으면 새로운 구성이 전파된 상태입니다.  

Sentinel이 설정 파일에 변경된 토폴로지를 기록했는지도 확인합니다.  

```bash
# Sentinel이 Rewrite한 설정과 발견한 노드 정보를 확인합니다.
cat sentinel1/sentinel.conf
```

설정 파일에는 새로운 Primary 주소, Replica와 다른 Sentinel 정보가 추가될 수 있습니다.  
이것이 Sentinel 설정 디렉터리를 쓰기 가능하게 마운트한 이유입니다.  

### 🟦 애플리케이션에서 현재 Primary 찾기

애플리케이션이 `redis-master:6379`에만 고정 연결하면 Sentinel이 Failover를 완료해도 새로운 Primary로 자동 전환할 수 없습니다.  
Sentinel을 지원하는 Redis 클라이언트라면 클라이언트가 현재 Primary를 조회하고 연결 대상을 결정합니다.  

애플리케이션에는 보통 다음 정보를 설정합니다.  

- Sentinel 목록
  - `172.30.0.21:26379`
  - `172.30.0.22:26379`
  - `172.30.0.23:26379`
- Primary 그룹 이름
  - `mymaster`

클라이언트는 목록에 있는 Sentinel에 `mymaster`의 현재 Primary 주소를 요청합니다.  
Replica 1이 승격된 상태라면 `172.30.0.11:6379`를 응답으로 받아 해당 Redis에 연결합니다.  

```text
Application
    │ Sentinel 목록 + "mymaster"
    ▼
Sentinel ── 현재 Primary 조회 ──▶ 172.30.0.11:6379
    │
    └── 조회한 Primary로 연결
```

Failover가 발생하면 클라이언트는 Sentinel에 새로운 Primary 주소를 다시 조회하고 연결을 복구합니다.  
단, 모든 Redis 클라이언트가 Sentinel 연결을 지원하는 것은 아니므로 사용하는 라이브러리와 연결 옵션을 먼저 확인해야 합니다.  

위 Sentinel IP는 같은 Compose 네트워크에 연결된 애플리케이션에서 사용할 수 있는 주소입니다.  
Docker 외부의 애플리케이션은 실제로 접근 가능한 Sentinel 주소와 포트를 설정해야 합니다.  

### 🟦 수동 Failover 요청

Primary를 중지하지 않고 Sentinel에 Failover를 요청할 수도 있습니다.  

```bash
# 현재 Primary를 먼저 확인합니다.
sudo docker exec redis-sentinel1 \
  redis-cli -p 26379 \
  SENTINEL GET-MASTER-ADDR-BY-NAME mymaster

# Sentinel에 수동 Failover를 요청합니다.
sudo docker exec redis-sentinel1 \
  redis-cli -p 26379 SENTINEL FAILOVER mymaster
```

명령이 접수되면 `OK`가 출력됩니다.  
이번 글의 핵심 실습은 실제 장애 감지 흐름이므로 앞에서 사용한 `docker stop redis-master` 방식이 SDOWN과 ODOWN을 확인하기에 더 적합합니다.  

### 🟦 주요 Sentinel 명령과 테스트 결과 정리

실습에서 자주 사용하는 명령은 다음과 같습니다.  

| 명령 | 설명 |
| --- | --- |
| `SENTINEL MASTER mymaster` | 감시 중인 Primary 상태 확인 |
| `SENTINEL REPLICAS mymaster` | Sentinel이 발견한 Replica 확인 |
| `SENTINEL SENTINELS mymaster` | 다른 Sentinel 확인 |
| `SENTINEL GET-MASTER-ADDR-BY-NAME mymaster` | 현재 Primary 주소 조회 |
| `SENTINEL CKQUORUM mymaster` | quorum과 Failover 승인 가능 여부 확인 |
| `SENTINEL FAILOVER mymaster` | 수동 Failover 요청 |
| `INFO replication` | Redis의 현재 Primary 또는 Replica 역할 확인 |
| `ROLE` | Redis 역할과 복제 상태 확인 |
