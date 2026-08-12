---
layout: post
title: "12. Redis RDB·AOF 설정과 데이터 복구 테스트"
description: "Redis의 RDB와 AOF 영속성 방식을 이해하고, redis.conf와 Docker Named Volume을 구성해 컨테이너 재시작 및 재생성 후 데이터가 복구되는지 확인합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 12
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis 영속성이 필요한 이유와 RDB·AOF 동작 방식"
  - id: session-02
    title: "2. redis.conf에서 RDB와 AOF 설정하기"
  - id: session-03
    title: "3. Docker에서 설정 파일과 데이터 볼륨 구성하기"
  - id: session-04
    title: "4. Redis 재시작과 컨테이너 재생성 후 데이터 복구하기"
---

## 1. Redis 영속성이 필요한 이유와 RDB·AOF 동작 방식 {#session-01}

### 🟦 Redis 영속성이란?

Redis 영속성은 메모리의 데이터를 SSD나 HDD 같은 영구 저장 장치에 기록하는 기능입니다.  
디스크에 기록한 데이터는 Redis가 다시 시작될 때 메모리로 불러올 수 있습니다.  

Redis의 대표적인 영속성 방식은 RDB와 AOF입니다.  

| 구분 | RDB | AOF |
| --- | --- | --- |
| 저장 방식 | 특정 시점의 전체 데이터를 Snapshot으로 저장 | 실행된 쓰기 명령을 계속 기록 |
| 대표 파일 | `dump.rdb` | Redis 7에서는 Base·Incremental AOF와 Manifest로 구성 |
| 장점 | 파일이 비교적 작고 복구가 빠른 편 | 최근 데이터의 유실 가능성을 줄일 수 있음 |
| 단점 | 마지막 Snapshot 이후의 변경이 유실될 수 있음 | RDB보다 파일이 크고 디스크 쓰기가 많을 수 있음 |
| 주요 설정 | `save`, `dbfilename` | `appendonly`, `appendfsync` |

### 🟦 RDB Snapshot

RDB는 설정한 조건을 만족하면 현재 데이터 전체를 특정 시점의 Snapshot으로 저장합니다.  
예를 들어 다음 설정은 300초 동안 10회 이상의 변경이 발생했을 때 RDB 저장을 수행한다는 의미입니다.  

```properties
save 300 10
```

RDB 파일은 일반적으로 `dump.rdb`라는 이름으로 저장됩니다.  
특정 시점의 데이터를 하나의 파일로 관리하기 쉬우며, 큰 데이터 세트에서는 AOF보다 재시작이 빠른 편입니다.  

반면 Redis가 비정상적으로 종료되면 마지막 Snapshot 이후에 변경된 데이터는 유실될 수 있습니다.  

### 🟦 AOF

AOF(Append Only File)는 Redis가 처리한 쓰기 명령을 로그에 기록하는 방식입니다.  
예를 들어 다음 명령을 실행하면 데이터 변경 내용이 AOF에 기록됩니다.  

```text
SET user:1 "Kim"
INCR access:count
DEL cache:old
```

Redis는 재시작할 때 이 기록을 이용해 데이터 세트를 복원합니다.  
AOF를 활성화하려면 다음 설정을 사용합니다.  

```properties
appendonly yes
```

AOF 내용을 실제 디스크와 동기화하는 주기는 `appendfsync`로 설정합니다.  

```properties
appendfsync everysec
```

`everysec`은 일반적으로 성능과 데이터 안정성의 균형을 고려한 설정입니다.  
운영체제나 하드웨어 장애가 발생하면 최근 약 1초의 쓰기 데이터가 유실될 가능성은 남아 있습니다.  

| 설정 | 의미 |
| --- | --- |
| `always` | 쓰기 작업마다 디스크에 동기화하며 가장 안전하지만 느린 편 |
| `everysec` | 약 1초마다 동기화하며 성능과 안정성의 균형을 제공 |
| `no` | 동기화 시점을 운영체제에 맡기며 가장 빠르지만 유실 범위가 커질 수 있음 |

Redis 7부터 AOF는 하나의 `appendonly.aof` 파일이 아니라 여러 파일로 구성될 수 있습니다.  
Base 파일, 이후 변경을 담는 Incremental 파일과 이 파일들을 추적하는 Manifest가 별도 디렉터리에 저장됩니다.  

실습에서는 RDB와 AOF를 함께 활성화합니다.  
두 방식이 모두 활성화된 상태에서 Redis가 재시작하면 더 완전한 데이터 세트를 가진 AOF를 사용해 데이터를 복구합니다.  

## 2. redis.conf에서 RDB와 AOF 설정하기 {#session-02}

### 🟦 프로젝트 디렉터리 구성

다음과 같이 프로젝트 디렉터리를 구성합니다.  

```text
redis-persistence/
├── docker-compose.yml
└── redis/
    └── redis.conf
```

프로젝트 디렉터리를 생성하고 이동합니다.  

```bash
# Redis 설정 파일을 저장할 하위 디렉터리까지 함께 만듭니다.
mkdir -p ~/runtimes/redis-persistence/redis
cd ~/runtimes/redis-persistence

# 현재 작업 경로를 확인합니다.
pwd
```

실행 환경에 따라 다음과 같은 경로가 출력됩니다.  

```text
/home/ubuntu/runtimes/redis-persistence
```

### 🟦 redis.conf 작성

`redis/redis.conf` 파일에 다음 설정을 작성합니다.  

아래 `save` 조건은 Redis 7.2의 기본값이 아니라 실습에서 RDB 저장을 확인하기 위한 사용자 지정 값입니다.  
Redis 7.2 예제 설정의 기본 조건은 `save 3600 1`, `save 300 100`, `save 60 10000`입니다.  

```properties
# Docker 컨테이너의 네트워크 인터페이스에서 연결을 받습니다.
# Compose에서는 호스트 포트를 127.0.0.1에만 공개합니다.
bind 0.0.0.0

# Redis 기본 포트입니다.
port 6379

# 실습용 비밀번호입니다.
# 운영 환경에서는 충분히 복잡한 비밀번호나 ACL을 사용해야 합니다.
requirepass mypassword

# Redis가 데이터 세트에 사용할 메모리의 상한을 256MB로 설정합니다.
# AOF와 복제 버퍼처럼 Key 제거 여부를 판단할 때 제외되는 메모리가 있으므로
# Redis 프로세스의 실제 전체 메모리 사용량은 256MB보다 클 수 있습니다.
maxmemory 256mb

# 메모리 상한에 도달하면 모든 Key 중 최근에 덜 사용된 Key를
# 근사 LRU 방식으로 제거하여 새로운 데이터를 저장할 공간을 확보합니다.
maxmemory-policy allkeys-lru

# maxmemory는 메모리 제한이며 RDB와 AOF 파일 크기의 제한이 아닙니다.
# RDB는 현재 데이터 세트를 압축된 Snapshot으로 저장하므로 메모리 사용량과
# 파일 크기가 같지 않으며, 일반적으로 같은 데이터의 AOF보다 작은 편입니다.
# AOF는 쓰기 명령 이력이 쌓이므로 RDB보다 커질 수 있고,
# AOF Rewrite가 실행되면 현재 상태 복원에 필요한 기록만 남겨 크기를 줄입니다.

# --------------------------------------------------
# RDB Persistence
# --------------------------------------------------

# 실습용 사용자 지정 조건입니다.
# 지정한 시간 동안 최소 변경 횟수를 만족하면 Snapshot을 저장합니다.
save 900 1
save 300 10
save 60 10000

# RDB Snapshot의 파일 이름입니다.
dbfilename dump.rdb

# --------------------------------------------------
# AOF Persistence
# --------------------------------------------------

# 쓰기 명령을 AOF에 기록합니다.
appendonly yes

# 약 1초마다 AOF 데이터를 디스크와 동기화합니다.
appendfsync everysec

# AOF Rewrite의 Base 파일을 RDB 형식으로 저장합니다.
aof-use-rdb-preamble yes

# --------------------------------------------------
# Persistence 파일 저장 경로
# --------------------------------------------------

# RDB와 AOF 관련 파일을 /data 아래에 저장합니다.
dir /data
```

핵심 설정의 의미는 다음과 같습니다.  

| 설정 | 의미 |
| --- | --- |
| `maxmemory 256mb` | Redis 데이터 세트에 사용할 메모리 상한을 256MB로 지정 |
| `maxmemory-policy allkeys-lru` | 메모리 상한 도달 시 모든 Key 중 최근에 덜 사용된 Key를 우선 제거 |
| `save 900 1` | 900초 동안 1회 이상 변경되면 RDB 저장 |
| `save 300 10` | 300초 동안 10회 이상 변경되면 RDB 저장 |
| `save 60 10000` | 60초 동안 10,000회 이상 변경되면 RDB 저장 |
| `dbfilename dump.rdb` | RDB 파일 이름 지정 |
| `appendonly yes` | AOF 활성화 |
| `appendfsync everysec` | 약 1초마다 AOF를 디스크와 동기화 |
| `aof-use-rdb-preamble yes` | AOF Rewrite의 Base 파일에 RDB 형식 사용 |
| `dir /data` | 영속성 파일 저장 디렉터리 지정 |

Redis 7의 AOF 파일은 기본적으로 `/data/appendonlydir` 아래에 생성될 수 있습니다.  
따라서 AOF 동작을 확인할 때는 `appendonly.aof` 파일 하나만 찾지 말고 `/data` 아래의 전체 파일 구조를 확인해야 합니다.  

### 🟦 실행 중인 Redis 설정 확인

Redis를 실행한 뒤에는 `CONFIG GET`으로 실제 적용된 값을 확인할 수 있습니다.  

```bash
# 비밀번호가 명령 기록에 남을 수 있으므로 이 방식은 실습 환경에서만 사용합니다.
sudo docker exec -it redis-persistence redis-cli -a mypassword
```

Redis CLI에서 다음 명령을 실행합니다.  

```text
127.0.0.1:6379> CONFIG GET save
1) "save"
2) "900 1 300 10 60 10000"

127.0.0.1:6379> CONFIG GET appendonly
1) "appendonly"
2) "yes"

127.0.0.1:6379> CONFIG GET appendfsync
1) "appendfsync"
2) "everysec"

127.0.0.1:6379> CONFIG GET dir
1) "dir"
2) "/data"
```

`CONFIG GET save`의 조건 순서는 Redis가 출력하는 형식에 따라 설정 파일의 순서와 다르게 보일 수 있습니다.  
각 시간과 변경 횟수의 쌍이 모두 적용되었는지 확인하면 됩니다.  

## 3. Docker에서 설정 파일과 데이터 볼륨 구성하기 {#session-03}

Redis 영속성을 Docker에서 사용할 때는 `/data`를 컨테이너 외부에 보존해야 합니다.  
컨테이너의 쓰기 가능 계층에만 파일을 저장하면 컨테이너를 삭제할 때 영속성 파일도 사라질 수 있습니다.  

이 실습에서는 Docker Named Volume을 `/data`에 연결합니다.  

### 🟦 docker-compose.yml 작성

프로젝트 루트에 `docker-compose.yml`을 작성합니다.  

```yaml
name: redis-persistence

services:
  redis:
    # 같은 실습 환경을 재현할 수 있도록 Redis 7.2 패치 버전을 고정합니다.
    image: redis:7.2
    container_name: redis-persistence
    restart: unless-stopped

    ports:
      # 외부 네트워크에 Redis 포트를 직접 공개하지 않습니다.
      - "127.0.0.1:6379:6379"

    volumes:
      # 호스트의 설정 파일을 컨테이너에 읽기 전용으로 연결합니다.
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro

      # 영속성 파일을 컨테이너 수명과 분리된 Volume에 저장합니다.
      - redis_data:/data

    # 마운트한 redis.conf를 사용해 Redis를 실행합니다.
    command: redis-server /usr/local/etc/redis/redis.conf

volumes:
  redis_data:
```

가장 중요한 설정은 다음 Volume 연결입니다.  

```yaml
volumes:
  - redis_data:/data
```

Redis는 `dir /data` 설정에 따라 RDB와 AOF 파일을 컨테이너의 `/data`에 저장합니다.  
이 디렉터리는 Docker Named Volume과 연결되어 있으므로 데이터는 컨테이너 수명과 분리됩니다.  

```text
Redis Memory
     │
     │ RDB / AOF
     ▼
Container /data
     │
     │ Docker Volume Mount
     ▼
redis_data Named Volume
     │
     ▼
Host Disk
```

### 🟦 Redis 실행과 접속 확인

Docker Compose로 Redis를 실행하고 상태를 확인합니다.  

```bash
# 백그라운드에서 Redis 컨테이너를 생성하고 실행합니다.
sudo docker compose up -d

# Compose 서비스 상태를 확인합니다.
sudo docker compose ps

# Redis 시작 로그를 확인합니다.
sudo docker compose logs redis
```

정상적으로 실행되면 다음과 비슷한 상태를 확인할 수 있습니다.  

```text
NAME                IMAGE          STATUS
redis-persistence   redis:7.2      Up
```

Redis CLI에 접속합니다.  

```bash
sudo docker exec -it redis-persistence redis-cli
```

비밀번호를 설정했으므로 인증 전에는 일반 명령을 실행할 수 없습니다.  

```text
127.0.0.1:6379> PING
(error) NOAUTH Authentication required.

127.0.0.1:6379> AUTH mypassword
OK

127.0.0.1:6379> PING
PONG
```

> `redis-cli -a mypassword`처럼 비밀번호를 명령줄에 직접 작성하면 셸 기록이나 프로세스 정보에 노출될 수 있습니다. 운영 환경에서는 비밀번호 관리 방법을 별도로 마련해야 합니다.  

### 🟦 Docker Named Volume과 영속성 파일 확인

생성된 Volume을 확인합니다.  

```bash
sudo docker volume ls
sudo docker volume inspect redis-persistence_redis_data
```

Compose 프로젝트 이름이 `redis-persistence`이고 Volume 이름이 `redis_data`이므로 기본 Volume 이름은 다음과 같이 생성됩니다.  

```text
redis-persistence_redis_data
```

Volume의 실제 이름이나 호스트 저장 경로는 Docker와 Compose 환경에 따라 달라질 수 있습니다.  

컨테이너의 `/data`와 AOF 디렉터리를 확인합니다.  

```bash
# /data의 디렉터리와 파일을 확인합니다.
sudo docker exec redis-persistence ls -al /data

# 하위 2단계까지 영속성 파일을 출력합니다.
sudo docker exec redis-persistence find /data -maxdepth 2 -type f -print
```

Redis 7에서 AOF가 활성화되면 다음과 같은 파일이 생성될 수 있습니다.  

```text
/data/appendonlydir/appendonly.aof.1.base.rdb
/data/appendonlydir/appendonly.aof.1.incr.aof
/data/appendonlydir/appendonly.aof.manifest
```

RDB Snapshot이 생성되었다면 다음 파일도 확인할 수 있습니다.  

```text
/data/dump.rdb
```

파일 이름과 번호는 AOF Rewrite 횟수와 Redis 상태에 따라 달라질 수 있습니다.  

## 4. Redis 재시작과 컨테이너 재생성 후 데이터 복구하기 {#session-04}

이제 테스트 데이터를 저장하고 다음 세 가지 상황을 차례로 확인합니다.  

1. Redis 컨테이너를 재시작합니다.  
2. 컨테이너만 삭제한 뒤 같은 Volume으로 다시 생성합니다.  
3. Named Volume까지 삭제해 데이터가 사라지는지 확인합니다.  

### 🟦 테스트 데이터 저장과 영속성 상태 확인

Redis CLI에 접속해 테스트 데이터를 저장합니다.  

```bash
sudo docker exec -it redis-persistence redis-cli -a mypassword
```

```text
127.0.0.1:6379> SET persistence:test "redis-data"
OK

127.0.0.1:6379> SET user:1:name "Kim"
OK

127.0.0.1:6379> INCR visit:count
(integer) 1

127.0.0.1:6379> INCR visit:count
(integer) 2

127.0.0.1:6379> GET persistence:test
"redis-data"

127.0.0.1:6379> GET user:1:name
"Kim"

127.0.0.1:6379> GET visit:count
"2"
```

현재 영속성 상태를 확인합니다.  

```text
127.0.0.1:6379> INFO persistence
```

출력에서 다음 항목을 확인합니다.  

```text
rdb_last_bgsave_status:ok
aof_enabled:1
aof_last_write_status:ok
```

`aof_enabled:1`이면 AOF가 활성화된 상태입니다.  

### 🟦 RDB Snapshot 강제 생성

`save` 설정은 지정한 시간과 변경 횟수 조건을 만족해야 자동으로 Snapshot을 만듭니다.  
실습에서는 기다리지 않고 `BGSAVE`로 RDB Snapshot 생성을 요청할 수 있습니다.  

먼저 `INFO persistence`에서 AOF Rewrite가 진행 중인지 확인합니다.  

```text
127.0.0.1:6379> INFO persistence
...
aof_rewrite_in_progress:0
```

`aof_rewrite_in_progress:0`이면 다음과 같이 `BGSAVE`를 실행합니다.  

```text
127.0.0.1:6379> BGSAVE
Background saving started
```

값이 `1`이면 AOF Rewrite와 RDB 저장이 동시에 자식 프로세스를 만들 수 없어 `BGSAVE` 요청이 거부될 수 있습니다.  
이때는 `BGSAVE SCHEDULE`을 실행하면 AOF Rewrite가 끝난 뒤 RDB 저장을 시작하도록 예약할 수 있습니다.  

```text
127.0.0.1:6379> BGSAVE SCHEDULE
Background saving scheduled
```

`BGSAVE` 응답은 백그라운드 저장을 시작했다는 뜻이며 완료를 의미하지 않습니다.  
`INFO persistence`를 반복해서 확인해 다음 상태가 되었는지 확인합니다.  

```text
rdb_bgsave_in_progress:0
rdb_last_bgsave_status:ok
```

완료된 마지막 저장 시각은 `LASTSAVE`로 확인할 수 있습니다.  

```text
127.0.0.1:6379> LASTSAVE
(integer) 1786400000
```

RDB 파일도 확인합니다.  

```bash
sudo docker exec redis-persistence ls -al /data/dump.rdb
```

### 🟦 테스트 1: 컨테이너 재시작

Redis 컨테이너를 재시작하고 다시 접속합니다.  

```bash
sudo docker compose restart redis
sudo docker compose ps
sudo docker exec -it redis-persistence redis-cli -a mypassword
```

기존 데이터를 조회합니다.  

```text
127.0.0.1:6379> GET persistence:test
"redis-data"

127.0.0.1:6379> GET user:1:name
"Kim"

127.0.0.1:6379> GET visit:count
"2"
```

데이터가 그대로 조회되면 Redis가 `/data`의 영속성 데이터를 읽어 메모리로 복구한 것입니다.  
이 실습처럼 RDB와 AOF를 모두 활성화했다면 Redis는 재시작 시 AOF를 사용해 데이터 세트를 복원합니다.  

### 🟦 테스트 2: 컨테이너 삭제 후 재생성

이번에는 컨테이너를 삭제한 뒤 다시 생성합니다.  

```bash
# 컨테이너와 네트워크를 삭제하지만 Named Volume은 유지합니다.
# down: 컨테이너를 정지한 뒤 삭제
# stop: 컨테이너를 정지
sudo docker compose down

# redis_data Volume이 남아 있는지 확인합니다.
sudo docker volume ls

# 같은 Compose 설정으로 컨테이너를 다시 생성합니다.
sudo docker compose up -d
sudo docker compose ps
```

Redis에 다시 접속해 기존 데이터를 조회합니다.  

```bash
sudo docker exec -it redis-persistence redis-cli -a mypassword
```

```text
127.0.0.1:6379> GET persistence:test
"redis-data"

127.0.0.1:6379> GET user:1:name
"Kim"

127.0.0.1:6379> GET visit:count
"2"
```

컨테이너를 삭제해도 `redis-persistence_redis_data` Volume은 유지됩니다.  
새 컨테이너가 같은 Volume을 `/data`에 연결하므로 기존 데이터가 복구됩니다.  

```text
Redis Container  ── 삭제 후 재생성
       │
       └── /data ── redis_data Named Volume은 유지
```

### 🟦 테스트 3: Named Volume 삭제

> 다음 명령은 RDB와 AOF 파일이 들어 있는 Named Volume을 삭제합니다. 이 실습의 테스트 데이터가 필요하지 않은지 확인한 뒤 실행해야 하며, 삭제한 Volume은 일반적으로 복구할 수 없습니다.  

컨테이너와 Compose가 만든 Named Volume을 함께 삭제합니다.  

```bash
# -v 옵션이 redis_data Named Volume까지 삭제합니다.
sudo docker compose down -v

# 기존 Volume이 사라졌는지 확인합니다.
sudo docker volume ls
```

Redis를 다시 실행하면 새로운 빈 Volume이 생성됩니다.  

```bash
sudo docker compose up -d
sudo docker exec -it redis-persistence redis-cli -a mypassword
```

기존 키를 조회합니다.  

```text
127.0.0.1:6379> GET persistence:test
(nil)
```

기존 데이터가 더 이상 존재하지 않는 이유는 영속성 파일을 저장하던 Volume까지 삭제했기 때문입니다.  
Docker 환경에서 Redis 데이터를 유지해야 한다면 `docker compose down -v` 사용에 특히 주의해야 합니다.  

### 🟦 CONFIG SET과 redis.conf의 차이

Redis가 실행 중일 때 `CONFIG SET`으로 일부 설정을 즉시 변경할 수 있습니다.  

```text
127.0.0.1:6379> CONFIG SET appendfsync always
OK

127.0.0.1:6379> CONFIG GET appendfsync
1) "appendfsync"
2) "always"
```

하지만 이 실습의 `redis.conf`에는 `appendfsync everysec`이 기록되어 있습니다.  
Redis를 재시작하면 시작할 때 설정 파일을 다시 읽으므로 값은 `everysec`으로 돌아옵니다.  

```bash
sudo docker compose restart redis
sudo docker exec -it redis-persistence redis-cli -a mypassword CONFIG GET appendfsync
```

```text
1) "appendfsync"
2) "everysec"
```

`CONFIG SET`의 변경을 계속 사용하려면 설정 파일도 같은 값으로 관리해야 합니다.  
이 실습에서는 `redis.conf`를 읽기 전용으로 마운트했으므로 컨테이너 안에서 설정 파일을 직접 변경하지 않고 호스트의 `redis/redis.conf`를 수정한 뒤 Redis를 재시작합니다.  

### 🟦 테스트 결과 정리

| 테스트 | 데이터 또는 설정 결과 | 이유 |
| --- | --- | --- |
| `docker compose restart redis` | 데이터 유지 | `/data`의 AOF에서 데이터 복구 |
| `docker compose down` 후 `up -d` | 데이터 유지 | Named Volume 유지 |
| 컨테이너 삭제 후 재생성 | 데이터 유지 | 데이터가 컨테이너가 아닌 Volume에 저장됨 |
| `docker compose down -v` | 데이터 삭제 | Named Volume까지 삭제됨 |
| `CONFIG SET` 후 Redis 재시작 | 설정 파일의 값으로 복원 | 시작할 때 `redis.conf`를 다시 읽음 |

Docker 환경에서 Redis 영속성을 구성할 때 핵심은 다음 두 가지입니다.  

1. `redis.conf`에 RDB 또는 AOF 설정을 작성합니다.  
2. Redis의 `/data` 디렉터리를 Docker Volume에 연결합니다.  

`appendonly yes`와 `dir /data`만 설정하고 `/data`를 외부 Volume에 연결하지 않으면 컨테이너 삭제 시 영속성 파일도 사라질 수 있습니다.  
또한 Docker Volume은 호스트 디스크 장애나 실수로 인한 Volume 삭제까지 막아 주는 백업이 아닙니다.  
중요한 데이터는 RDB 또는 AOF 파일을 별도의 저장소에 백업하고 복구 절차도 함께 검증해야 합니다.  
