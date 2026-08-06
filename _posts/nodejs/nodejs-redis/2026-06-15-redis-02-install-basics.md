---
layout: post
title: "02. Redis 설치와 기본 설정"
description: "Docker와 Docker Compose로 Redis 7.2를 안전하게 실행하고 주요 설정을 적용합니다. redis-cli 접속과 Key 관리 명령어까지 초보자 관점에서 설명합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker로 Redis 설치 및 실행하기"
  - id: session-02
    title: "2. Redis 기본 설정 이해하기"
  - id: session-03
    title: "3. redis-cli 접속과 Key 관리"
---

## 1. Docker로 Redis 설치 및 실행하기 {#session-01}

### 🟦 Redis 설치

다음 명령은 Redis 7.2 이미지를 내려받아 `redis`라는 이름의 컨테이너로 실행합니다.  
이 글은 Linux에서 `sudo`로 Docker를 실행하는 환경을 기준으로 합니다. 현재 사용자가 Docker를 직접 실행할 권한이 있다면 `sudo`를 생략할 수 있습니다.  

```bash
# 로컬에 이미지가 없으면 Redis 7.2 이미지를 자동으로 내려받습니다.
# 호스트의 127.0.0.1에만 포트를 열어 외부 접근을 막습니다.
# redis:7.2는 7.2 계열의 최신 패치 버전을 가리키는 이동 태그입니다
# --restart unless-stopped
#   컨테이너가 종료되었을 때 자동으로 다시 시작하도록 하는 정책
#   - Redis 프로세스가 오류로 종료됨 → 자동 재시작
#   - Docker 데몬이나 서버가 재부팅됨 → 자동 재시작
#   - 사용자가 docker stop redis로 직접 중지함 → 자동 재시작하지 않음
#   - 직접 중지한 상태에서 서버가 재부팅됨 → 계속 중지 상태 유지

# sudo docker pull redis:7.2
sudo docker run -d --name redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7.2

# 컨테이너가 실행 중인지 확인합니다.
sudo docker ps

# 컨테이너 안에서 Redis CLI를 실행합니다.
sudo docker exec -it redis redis-cli

# Redis 컨테이너를 중지합니다.
sudo docker stop redis

# 다음 예제에서 같은 이름을 다시 사용할 수 있도록 컨테이너를 삭제합니다.
# 컨테이너를 다시 사용할 예정이라면 삭제하지 않고 docker start redis를 실행합니다.
sudo docker rm redis
```

![Docker로 Redis 7.2 이미지 설치 및 실행](/assets/images/nodejs/nodejs-redis/redis-docker-install.png)

접속한 뒤 `PING` 명령을 실행합니다.  
`PONG`이 출력되면 Redis 서버가 정상적으로 동작하는 것입니다.  

![redis-cli에서 Redis 실행 상태 확인](/assets/images/nodejs/nodejs-redis/redis-cli-ping.png)

### 🟦 docker-compose.yml로 Redis 구성하기

Docker는 컨테이너를 만들고 실행하는 기본 도구입니다.  
Docker Compose는 여러 컨테이너를 하나의 애플리케이션처럼 묶어서 실행하고 관리하는 도구입니다.  

```yaml

# 프로젝트명 없으면 현재 디렉토리명이 기본 프로젝트명으로 사용
# name: redis
services:
  # redis라는 이름의 서비스를 정의합니다.
  # Compose에서는 다음처럼 서비스 이름으로 제어할 수 있습니다
  # docker compose up -d redis
  redis:
    # 사용할 Redis Docker 이미지와 버전
    image: redis:7.2
    # 실제 생성되는 컨테이너 이름
    container_name: local-redis
    ports:
      # 로컬 PC에서만 Redis에 접속할 수 있도록 제한합니다.
      # 호스트 IP:호스트 포트:컨테이너 포트
      - "127.0.0.1:6379:6379"
    volumes:
      # Docker named volume을 Redis 컨테이너 내부의 /data 디렉터리에 연결합니다.
      # 컨테이너를 삭제해도 named volume을 삭제하지 않는 한 Redis 데이터는 유지
      - redis_data:/data

    # Redis 서버를 실행하면서 AOF 영속화 기능을 활성화합니다.  
    # Redis 컨테이너가 재시작되어도 /data에 저장된 AOF 파일을 읽어 데이터를 복구할 수 있습니다.
    command: redis-server --requirepass mypassword --appendonly yes

volumes:
  redis_data:
```

위 설정은 Redis를 `local-redis`라는 이름의 컨테이너로 실행합니다.  
`redis_data:/data`의 `redis_data`는 프로젝트 디렉터리 안의 폴더가 아니라 Docker가 저장 위치를 관리하는 Named Volume입니다.  
생성된 볼륨은 다음 명령으로 확인할 수 있습니다.  

```bash
sudo docker volume ls

DRIVER    VOLUME NAME
local     redis_redis_data
```

Named Volume을 사용할 때는 다음처럼 작성합니다.  

```yaml
volumes:
  # Docker가 호스트의 실제 저장 위치를 관리합니다.
  - redis_data:/data
```

프로젝트 디렉터리의 `redis_data` 폴더에 직접 저장하려면 Bind Mount로 변경합니다.  
`./redis_data`는 `docker-compose.yml` 파일이 있는 디렉터리를 기준으로 하는 상대 경로입니다.  

```yaml
volumes:
  # 현재 프로젝트의 redis_data 폴더를 직접 연결합니다.
  - ./redis_data:/data
```

Named Volume은 Docker가 저장 위치와 권한을 관리하므로 일반적인 데이터 보관에 편리합니다.  
Bind Mount는 호스트에서 파일을 바로 확인하거나 백업하기 쉽지만, 디렉터리 권한을 직접 관리해야 합니다.  
Bind Mount로 변경하면 Compose 파일 마지막에 있는 최상위 `volumes: redis_data:` 선언은 삭제해도 됩니다.  
Redis는 기본적으로 메모리에 데이터를 저장하지만, RDB 또는 AOF Persistence를 사용하면 데이터를 디스크에도 저장할 수 있습니다.  

### 🟦 Docker Compose 실행 및 확인

```bash

# 경로 확인
pwd
/home/ubuntu/runtimes/redis
ls
docker-compose.yml

# Redis를 백그라운드에서 실행합니다.
# sudo docker compose -p 프로젝트명 up -d
sudo docker compose up -d

# 컨테이너 상태를 확인합니다.
sudo docker compose ps

# Redis CLI에 접속합니다.
sudo docker exec -it local-redis redis-cli

# Docker 볼륨 목록을 확인합니다.
sudo docker volume ls

# Docker Named Volume이 실제로 저장된 위치를 확인합니다.
# 형식: 프로젝트명_볼룸명, 앞 redis는 Docker Compose 프로젝트 이름에 맞게 바꿉니다.
sudo docker volume inspect redis_redis_data

# 실행 중인 컨테이너와 네트워크를 종료합니다.
sudo docker compose down
```

`docker compose down`을 실행해도 Named Volume은 삭제되지 않으므로 데이터는 남아 있습니다.  
볼륨까지 삭제하려면 `docker compose down -v`를 사용할 수 있지만, 저장된 데이터도 함께 삭제되므로 주의해야 합니다.  

`docker volume inspect` 결과의 `Mountpoint`에서 실제 저장 경로를 확인할 수 있습니다.  

```text
"Mountpoint": "/var/lib/docker/volumes/redis_redis_data/_data"
```

![Docker Compose로 Redis 실행 및 볼륨 확인](/assets/images/nodejs/nodejs-redis/image-2026-06-15.png)

## 2. Redis 기본 설정 이해하기 {#session-02}

### 🟦 redis.conf 주요 설정

Redis 설정은 보통 `redis.conf` 파일에서 관리합니다.  
대표적인 설정은 다음과 같습니다.  

아래 `bind 127.0.0.1`은 Redis를 호스트에 직접 설치했을 때 로컬 연결만 허용하는 예시입니다.  
Docker에서 설정 파일을 마운트하는 방법은 뒤에서 별도로 살펴봅니다.  

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
`requirepass`는 모든 클라이언트가 하나의 비밀번호를 공유하는 기존 인증 방식입니다.  
학습 환경에서는 간단히 사용할 수 있지만, 운영 환경에서는 사용자별 권한을 제한할 수 있는 Redis ACL을 우선 검토하는 것이 좋습니다.  

```conf
requirepass mypassword
```

Docker Compose에서 직접 설정하려면 다음과 같이 `command` 옵션에 추가할 수 있습니다.  

```yaml
services:
  redis:
    image: redis:7.2
    container_name: local-redis
    ports:
      - "127.0.0.1:6379:6379"
    command: redis-server --requirepass mypassword --appendonly yes
```

비밀번호가 설정된 Redis에 접속하면 인증하기 전에는 명령을 사용할 수 없습니다.  

```console
$ sudo docker exec -it local-redis redis-cli
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
sudo docker exec -it local-redis redis-cli -a mypassword
```

> `-a` 옵션에 비밀번호를 직접 작성하면 셸 기록이나 프로세스 정보에 노출될 수 있습니다. 실제 환경에서는 비밀번호 관리 방식과 Redis ACL 적용을 함께 검토해야 합니다.  

Docker Compose의 `command`에 비밀번호를 직접 작성하는 방식도 설정 파일이나 컨테이너 정보에 비밀번호가 남을 수 있습니다.  
따라서 위 코드는 로컬 실습용으로만 사용하고, 운영 환경에서는 Secret 관리 도구와 ACL을 사용하는 것이 안전합니다.  

### 🟦 maxmemory와 Eviction Policy

`maxmemory`로 Redis가 데이터 저장에 사용할 수 있는 메모리 한도를 설정할 수 있습니다.  

```conf
maxmemory 256mb
```

Redis가 `maxmemory`에 도달했을 때 어떤 데이터를 제거할지 결정하는 정책을 Eviction Policy라고 합니다.  
LRU(Least Recently Used)는 가장 오랫동안 사용되지 않은 데이터를 우선 제거하는 방식입니다.  
Redis는 메모리와 처리 비용을 줄이기 위해 정확한 LRU가 아니라 일부 Key를 표본으로 확인하는 근사 LRU 방식을 사용합니다.  

```conf
maxmemory-policy allkeys-lru
```

| 정책 | 설명 |
| --- | --- |
| `noeviction` | 메모리가 가득 차면 새 데이터를 쓰는 요청에 오류를 반환 |
| `allkeys-lru` | 전체 Key 중 LRU 기준으로 제거 |
| `volatile-lru` | 만료 시간이 설정된 Key 중 LRU 기준으로 제거 |
| `allkeys-lfu` | 전체 Key 중 사용 빈도가 낮은 Key를 우선 제거 |
| `volatile-lfu` | 만료 시간이 설정된 Key 중 사용 빈도가 낮은 Key를 우선 제거 |
| `allkeys-random` | 전체 Key 중 무작위로 제거 |
| `volatile-random` | 만료 시간이 설정된 Key 중 무작위로 제거 |
| `volatile-ttl` | 만료 시간이 설정된 Key 중 TTL이 짧은 Key부터 제거 |

LFU(Least Frequently Used)는 사용 빈도를 기준으로 제거 대상을 고릅니다.  
이름이 `volatile-`로 시작하는 정책은 만료 시간이 설정된 Key만 대상으로 삼으며, 대상 Key가 없으면 새 쓰기 요청에 오류를 반환할 수 있습니다.  

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
| 운영 환경 고려 사항 | 스냅샷 주기와 데이터 유실 허용 범위를 검토해야 함 | `appendfsync everysec` 사용 시 장애 상황에서 약 1초 분량의 데이터가 유실될 수 있음 |

Redis 7부터 AOF는 하나의 파일이 아니라 Base 파일, Incremental 파일과 Manifest 파일로 구성됩니다.  
Redis를 재시작하면 이 파일들을 이용해 데이터를 복구합니다.  
AOF는 데이터 유실 가능성을 줄여 주지만 백업 자체를 대신하지는 않으므로, 운영 환경에서는 별도의 백업과 복구 절차도 준비해야 합니다.  

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

아래 세 방법은 서로 다른 대안이므로 한 번에 하나만 실행합니다.  
다음 방법을 실습하기 전에는 현재 컨테이너를 중지하고 삭제해야 같은 `6379` 포트를 다시 사용할 수 있습니다.  

1. `redis-server` 실행 옵션으로 설정 전달
2. 호스트의 `redis.conf` 파일을 컨테이너에 마운트
3. `docker-compose.yml`에서 `redis.conf` 파일을 마운트

### 🔷 방법 1: docker run에서 설정 옵션 직접 전달

간단한 테스트라면 `redis-server` 실행 옵션으로 설정을 전달할 수 있습니다.  

```bash
# 메모리 제한과 Eviction Policy를 지정합니다.
sudo docker run -d \
  --name redis \
  -p 127.0.0.1:6379:6379 \
  redis:7.2 \
  redis-server \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru
```

설정을 확인한 뒤 다음 방법을 실습하려면 `sudo docker rm -f redis`로 이 컨테이너를 먼저 삭제합니다.  

### 🔷 방법 2: 호스트의 redis.conf를 Docker 컨테이너에 마운트

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
  -p 127.0.0.1:6379:6379 \
  -v "$PWD/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro" \
  -v redis_data:/data \
  redis:7.2 \
  redis-server /usr/local/etc/redis/redis.conf
```

설정을 확인한 뒤 다음 방법을 실습하려면 `sudo docker rm -f redis-conf`로 이 컨테이너를 먼저 삭제합니다.  

> 컨테이너는 `bind 0.0.0.0`으로 연결을 받지만, Docker 포트는 호스트의 `127.0.0.1`에만 연결했습니다. 따라서 같은 PC에서는 접속할 수 있지만 외부 네트워크에는 Redis 포트가 직접 공개되지 않습니다.  

### 🔷 방법 3: docker-compose.yml에서 redis.conf 마운트

프로젝트 구조는 방법 2와 같습니다.  

```text
my-project/
├── docker-compose.yml
└── redis/
    └── redis.conf
```

`redis/redis.conf` 파일을 작성합니다.  

```conf
# Redis가 컨테이너의 모든 네트워크 인터페이스에서 접속을 받도록 합니다.
bind 0.0.0.0
port 6379

# 비밀번호설정
requirepass dnqnsxn

# Redis가 사용할 수 있는 최대 메모리
maxmemory 256mb

# 메모리가 부족할 때 모든 키를 대상으로 최근에 사용되지 않은 키부터 제거
maxmemory-policy allkeys-lru

# AOF 활성화
appendonly yes

# AOF 내용을 대략 1초 마다 디스크에 동기화 합니다.
appendfsync everysec

# RDB와 AOF 같은 Redis 영속화 파일을 저장할 디렉터리입니다.
dir /data
```

Docker Compose에서 다음처럼 연결했다면:

```bash
volumes:
  - redis_data:/data
```

실제 데이터는 Docker 볼륨 redis_data에 저장됩니다.

`docker-compose.yml` 파일을 작성합니다.  

```yaml
# Docker Compose 프로젝트명을 명시적으로 지정할 수 있습니다.
# 이 항목을 생략하면 일반적으로 현재 디렉터리명이 프로젝트명으로 사용됩니다.
# 예: 현재 디렉터리가 ~/runtimes/redis이면 프로젝트명은 redis
name: redis

services:
  # redis라는 이름의 서비스를 정의합니다.
  # 서비스명은 Compose 명령에서 사용할 수 있습니다.
  # 예: docker compose up -d redis
  redis:
    # 사용할 Redis 공식 Docker 이미지입니다.
    # redis:7.2는 Redis 7.2 계열의 최신 패치 버전을 가리키는 태그입니다.
    image: redis:7.2

    # 실제 생성되는 Docker 컨테이너 이름입니다.
    container_name: local-redis

    # 컨테이너가 비정상 종료되거나 Docker가 재시작되면 자동으로 다시 실행합니다.
    # 단, 사용자가 docker stop 명령으로 직접 중지한 경우에는 자동 재시작하지 않습니다.
    restart: unless-stopped

    ports:
      # 호스트의 127.0.0.1:6379를 컨테이너의 6379 포트에 연결합니다.
      # 127.0.0.1에만 바인딩하므로 외부 PC에서는 직접 접근할 수 없습니다.
      #
      # 형식:
      # 호스트 IP:호스트 포트:컨테이너 포트
      - "127.0.0.1:6379:6379"

    volumes:
      # 현재 디렉터리의 redis.conf 파일을 컨테이너 내부 설정 파일로 연결합니다.
      # :ro는 컨테이너에서 해당 파일을 수정할 수 없도록 읽기 전용으로 마운트한다는 의미입니다.
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro

      # Docker named volume인 redis_data를 컨테이너의 /data에 연결합니다.
      # Redis의 AOF, RDB 등 영속화 데이터가 이 볼륨에 저장됩니다.
      # 컨테이너를 삭제하더라도 볼륨을 삭제하지 않으면 데이터는 유지됩니다.
      - redis_data:/data

    # 위에서 연결한 redis.conf 파일을 사용해 Redis 서버를 실행합니다.
    # 비밀번호, 메모리 제한, AOF 설정 등은 redis.conf에서 관리합니다.
    command: redis-server /usr/local/etc/redis/redis.conf

# Compose에서 사용할 Docker named volume을 정의합니다.
volumes:
  # 실제 볼륨 이름은 일반적으로 다음 형식으로 생성됩니다.
  # 프로젝트명_볼륨명
  #
  # 프로젝트명이 redis이면 실제 Docker 볼륨 이름은:
  # redis_redis_data
  redis_data:
```

다음 명령으로 Redis를 실행하고 설정을 확인합니다.  

```bash
# Redis를 실행합니다.
sudo docker compose up -d

# Redis 로그를 확인합니다. 종료하려면 Ctrl+C를 누릅니다.
sudo docker compose logs -f redis

# Redis CLI에 접속합니다.
sudo docker exec -it local-redis redis-cli
```

```console
127.0.0.1:6379> AUTH mypassword
OK
127.0.0.1:6379> PING
PONG
```

![redis.conf 적용 후 Redis 설정 확인](/assets/images/nodejs/nodejs-redis/redis-config-check.png)

## 3. redis-cli 접속과 Key 관리 {#session-03}

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
sudo docker exec -it local-redis redis-cli

# 비밀번호가 있는 경우
sudo docker exec -it local-redis redis-cli -a mypassword
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
운영 환경에서는 한 번에 일부 Key만 점진적으로 조회하는 `SCAN`을 사용하는 것이 좋습니다.  

```console
127.0.0.1:6379> SCAN 0
```

다음 글에서는 String, Hash, List, Set과 Sorted Set의 기본 명령어를 실습합니다.  
메시지를 저장하는 Stream과 실시간으로 전달하는 Pub/Sub의 차이도 함께 살펴봅니다.  
