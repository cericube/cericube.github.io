---
layout: post
title: "15. Redis Cluster 설정과 분산·Failover 테스트"
description: "Redis 7.2에서 3 Primary·3 Replica Cluster를 구성하고, Hash Slot 기반 Sharding, MOVED Redirect, Hash Tag와 Primary 장애 후 자동 Failover를 테스트합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 15
ai_assisted: true
toc:
  - id: session-01
    title: "1. Redis Cluster의 Hash Slot과 Sharding 이해하기"
  - id: session-02
    title: "2. Cluster용 redis.conf와 노드 통신 설정하기"
  - id: session-03
    title: "3. Docker Compose로 3 Primary·3 Replica 구축하기"
  - id: session-04
    title: "4. 데이터 분산, Redirect와 Failover 테스트하기"
---

Redis Replication은 하나의 Primary 데이터를 Replica에 복제합니다.  
Sentinel은 이 Primary·Replica 구조를 감시하고 Primary 장애 시 Replica를 자동 승격합니다.  

하지만 데이터와 트래픽이 하나의 Primary가 처리할 수 있는 범위를 넘으면 여러 Primary에 나누어 저장하는 구조가 필요합니다.  
Redis Cluster는 데이터를 여러 Primary에 분산하는 Sharding과 Replica를 이용한 Failover를 함께 제공합니다.  

이번 실습에서는 Docker Compose로 다음 구조를 구성합니다.  

![3개의 Primary와 각각 연결된 Replica로 구성한 Redis Cluster](/assets/images/nodejs/nodejs-redis/redis-cluster-three-primary-three-replica.svg)

3개의 Primary가 전체 Hash Slot을 나누어 담당하고, 각 Primary에는 Replica 하나가 연결됩니다.  
Primary 하나에 장애가 발생하면 Cluster의 과반수 Primary가 장애에 동의하고 해당 Primary의 Replica가 승격될 수 있습니다.  

## 1. Redis Cluster의 Hash Slot과 Sharding 이해하기 {#session-01}

### 🟦 Redis Cluster란?

Redis Cluster는 Redis 데이터를 여러 Primary 노드에 자동으로 나누어 저장하는 구조입니다.  
하나의 Redis에 모든 데이터를 저장하는 대신 여러 서버가 데이터 저장 공간과 요청을 나누어 담당합니다.  

Redis Cluster는 Key를 특정 서버에 직접 배정하지 않고 Hash Slot이라는 중간 단계를 사용합니다.  
전체 Hash Slot은 `0`부터 `16383`까지 총 16,384개입니다.  

3개의 Primary를 사용하면 다음과 비슷한 범위로 Slot이 나뉩니다.  

```text
Primary 1: Slot     0 ~  5460
Primary 2: Slot  5461 ~ 10922
Primary 3: Slot 10923 ~ 16383
```

실제 Slot 배치와 Primary·Replica 관계는 Cluster 생성 결과로 확인해야 합니다.  

### 🟦 Key가 저장될 Primary 결정

Redis Cluster는 Key를 기반으로 `CRC16` 해시값을 계산한 뒤, 이를 `16384`로 나눈 나머지를 이용해 Hash Slot을 결정합니다.  
각 Hash Slot은 특정 Primary 노드가 담당하며, 해당 Key의 데이터는 그 Slot을 담당하는 Primary에 저장됩니다.  

![Redis Cluster에서 Key의 Hash Slot을 계산하고 담당 Primary에 데이터를 저장하는 흐름](/assets/images/nodejs/nodejs-redis/redis-cluster-key-slot-flow.svg)

특정 Key의 Hash Slot은 `CLUSTER KEYSLOT`으로 확인할 수 있습니다.  

```text
CLUSTER KEYSLOT user:1
```

```text
(integer) 10778
```

위 결과처럼 `user:1`의 Hash Slot이 10778이라면, 데이터는 10778번 Slot을 담당하는 Primary에 저장됩니다.  
Key마다 계산된 Slot이 다를 수 있으므로 데이터는 여러 Primary에 자연스럽게 분산됩니다.  

### 🟦 Sharding

데이터를 여러 서버에 나누어 저장하는 방식을 Sharding이라고 합니다.  

```text
                 Application
                      │
                      ▼
                Redis Cluster
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Primary 1     Primary 2     Primary 3
      user:3        user:1       order:100
      cache:8       order:2       user:9
```

Hash Slot을 여러 Primary가 나누어 담당하므로 하나의 서버에 데이터와 트래픽이 집중되는 문제를 줄일 수 있습니다.  
다만 하나의 Key 자체가 매우 크다면 그 Key가 여러 Primary로 나뉘지는 않으므로 데이터 모델도 함께 고려해야 합니다.  

### 🟦 Primary와 Replica

Redis Cluster에서도 각 Primary의 데이터를 Replica에 복제할 수 있습니다.  
이번 실습에서는 6개의 노드를 실행한 뒤 `--cluster-replicas 1` 옵션으로 Primary마다 Replica 하나를 배정합니다.  

```text
redis-node1
redis-node2
redis-node3
redis-node4
redis-node5
redis-node6
```

어떤 Replica가 어떤 Primary에 연결될지는 `redis-cli --cluster create`가 제안하는 배치에 따라 달라질 수 있습니다.  
`node1 → node4`처럼 관계를 미리 단정하지 말고 `CLUSTER NODES`나 `CLUSTER REPLICAS`로 실제 결과를 확인해야 합니다.  

### 🟦 Sentinel과 Cluster의 차이

Sentinel과 Redis Cluster는 모두 Failover를 제공하지만 목적이 다릅니다.  

| 구분 | Sentinel | Redis Cluster |
| --- | --- | --- |
| 데이터 Sharding | 제공하지 않음 | 제공 |
| 여러 Primary 사용 | 일반적으로 사용하지 않음 | 사용 |
| Primary 장애 감지 | 제공 | 제공 |
| Replica 승격 | 제공 | 제공 |
| 데이터 저장 방식 | 하나의 논리적 데이터 세트를 복제 | 여러 Primary에 데이터 분산 |
| 주요 목적 | 고가용성 | 수평 확장과 고가용성 |

Sentinel은 하나의 Primary 데이터 세트에 고가용성을 추가합니다.  
Redis Cluster는 데이터 자체를 여러 Primary에 나누어 저장하면서 각 Primary에 Replica를 배치합니다.  

## 2. Cluster용 redis.conf와 노드 통신 설정하기 {#session-02}

### 🟦 프로젝트 디렉터리 구성

이번 실습에서는 6개의 Redis 컨테이너를 사용합니다.  

```text
redis-cluster/
├── docker-compose.yml
├── node1/
│   └── redis.conf
├── node2/
│   └── redis.conf
├── node3/
│   └── redis.conf
├── node4/
│   └── redis.conf
├── node5/
│   └── redis.conf
└── node6/
    └── redis.conf
```

디렉터리를 만들고 프로젝트 루트로 이동합니다.  

```bash
# 6개 Redis 노드의 설정 디렉터리를 만듭니다.
mkdir -p ~/runtimes/redis-cluster/{node1,node2,node3,node4,node5,node6}
cd ~/runtimes/redis-cluster

# 현재 작업 경로를 확인합니다.
pwd
```

실행 환경에 따라 다음과 같은 경로가 출력됩니다.  

```text
/home/ubuntu/runtimes/redis-cluster
```

### 🟦 Cluster용 redis.conf 작성

6개 노드는 같은 초기 설정을 사용합니다.  
먼저 `node1/redis.conf`에 다음 설정을 작성합니다.  

```properties
# Docker 네트워크에서 Client와 다른 Cluster 노드의 연결을 받습니다.
bind 0.0.0.0

# Client가 Redis 명령을 보낼 때 사용하는 포트입니다.
port 6379

# 실습용 Client 인증 비밀번호입니다.
requirepass dnqnsxn

# Replica가 Primary에 복제 연결할 때 사용하는 비밀번호입니다.
masterauth dnqnsxn

# Redis Cluster 기능을 활성화합니다.
cluster-enabled yes

# 노드 ID, 역할과 Slot 정보를 Redis가 자동으로 관리하는 파일입니다.
cluster-config-file nodes.conf

# 노드 장애 판단 등에 사용하는 기준 시간을 5초로 지정합니다.
cluster-node-timeout 5000

# AOF를 활성화하고 약 1초마다 디스크와 동기화합니다.
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes

# nodes.conf와 영속성 파일을 Docker Volume이 연결된 경로에 저장합니다.
dir /data
```

같은 설정을 나머지 노드에 복사합니다.  

```bash
for node in node2 node3 node4 node5 node6
do
  cp node1/redis.conf "$node/redis.conf"
done

# 6개의 설정 파일이 준비되었는지 확인합니다.
find . -maxdepth 2 -name redis.conf -print
```

Cluster와 직접 관련된 설정은 다음과 같습니다.  

| 설정 | 설명 |
| --- | --- |
| `cluster-enabled yes` | Redis Cluster 기능 활성화 |
| `cluster-config-file nodes.conf` | 노드 상태와 Slot 정보를 저장할 파일 지정 |
| `cluster-node-timeout 5000` | 노드 장애 판단 등에 사용하는 시간 기준 지정 |
| `requirepass` | Client 인증 비밀번호 지정 |
| `masterauth` | Replica의 Primary 인증 비밀번호 지정 |
| `appendonly yes` | AOF 영속성 활성화 |
| `dir /data` | Cluster 상태와 영속성 파일 저장 경로 지정 |

`nodes.conf`는 일반 설정 파일과 성격이 다릅니다.  
Redis가 Cluster의 현재 상태를 기록하고 자동으로 갱신하므로 사용자가 직접 작성하거나 수정하면 안 됩니다.  

### 🟦 Client Port와 Cluster Bus Port

Redis Cluster 노드는 Client 통신과 노드 간 통신에 서로 다른 TCP 포트를 사용합니다.  
기본 Redis 포트가 `6379`이면 Cluster Bus 포트는 기본적으로 `10000`을 더한 `16379`입니다.  

```text
6379
 └── Client와 Redis 노드의 명령 통신

16379
 └── Redis 노드 사이의 Cluster Bus 통신
```

Cluster Bus는 노드 상태, 장애 감지, 구성 변경과 Failover 승인 정보를 교환합니다.  
실제 여러 서버에 Redis Cluster를 배포한다면 Client Port와 Cluster Bus Port 모두 필요한 대상 사이에서 통신할 수 있어야 합니다.  

### 🟦 Docker 내부 IP를 고정하는 이유

Redis Cluster 노드는 자신이 사용하는 주소를 Cluster 구성과 Redirect 응답에 포함합니다.  
Docker Port Mapping처럼 내부 주소·포트와 Client가 사용하는 주소·포트가 다르면 Client가 Redirect 대상에 접근하지 못할 수 있습니다.  

이번 실습에서는 모든 명령을 같은 Docker 네트워크 안에서 실행하고 각 노드에 다음 고정 IP를 사용합니다.  

```text
redis-node1 → 172.28.0.11
redis-node2 → 172.28.0.12
redis-node3 → 172.28.0.13
redis-node4 → 172.28.0.14
redis-node5 → 172.28.0.15
redis-node6 → 172.28.0.16
```

이 주소는 한 Docker 호스트 안에서 Cluster 동작을 확인하기 위한 실습용 주소입니다.  
호스트에서 이미 `172.28.0.0/16` 대역을 사용한다면 충돌하지 않는 다른 사설 네트워크 대역을 선택해야 합니다.  

## 3. Docker Compose로 3 Primary·3 Replica 구축하기 {#session-03}

### 🟦 docker-compose.yml 작성

프로젝트 루트의 `docker-compose.yml`에 다음 내용을 작성합니다.  

```yaml
name: redis-cluster

services:
  redis-node1:
    # 같은 실습 환경을 재현할 수 있도록 Redis 7.2 패치 버전을 고정합니다.
    image: redis:7.2.15
    container_name: redis-node1
    restart: unless-stopped

    volumes:
      - ./node1/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node1_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.11

  redis-node2:
    image: redis:7.2.15
    container_name: redis-node2
    restart: unless-stopped

    volumes:
      - ./node2/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node2_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.12

  redis-node3:
    image: redis:7.2.15
    container_name: redis-node3
    restart: unless-stopped

    volumes:
      - ./node3/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node3_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.13

  redis-node4:
    image: redis:7.2.15
    container_name: redis-node4
    restart: unless-stopped

    volumes:
      - ./node4/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node4_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.14

  redis-node5:
    image: redis:7.2.15
    container_name: redis-node5
    restart: unless-stopped

    volumes:
      - ./node5/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node5_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.15

  redis-node6:
    image: redis:7.2.15
    container_name: redis-node6
    restart: unless-stopped

    volumes:
      - ./node6/redis.conf:/usr/local/etc/redis/redis.conf:ro
      - redis_node6_data:/data

    command: redis-server /usr/local/etc/redis/redis.conf

    networks:
      redis-cluster-network:
        ipv4_address: 172.28.0.16

volumes:
  redis_node1_data:
  redis_node2_data:
  redis_node3_data:
  redis_node4_data:
  redis_node5_data:
  redis_node6_data:

networks:
  redis-cluster-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

이번 실습에서는 Redis 포트를 호스트에 공개하지 않습니다.  
모든 명령을 컨테이너 안에서 실행하므로 Cluster가 알려 주는 Docker 내부 주소에 그대로 접근할 수 있습니다.  

Docker 외부 애플리케이션에서 이 Cluster를 사용하려면 Cluster가 광고하는 각 노드의 Client Port와 Cluster Bus Port에 접근할 수 있도록 별도의 네트워크 설계가 필요합니다.  
단순 Port Mapping만 추가하면 `MOVED` 응답에 포함된 내부 주소로 외부 Client가 접근하지 못할 수 있습니다.  

#### 예시 설계

운영 환경에서는 애플리케이션과 Redis 노드를 같은 VPC의 사설망에 배치하고, 각 Redis 노드에 애플리케이션이 직접 접근할 수 있는 고유한 주소를 부여할 수 있습니다.  

```text
Application: 10.0.20.10
  └── Cluster-aware Redis Client
        ├── Primary 1: 10.0.10.11:6379 ── Replica 1: 10.0.10.14:6379
        ├── Primary 2: 10.0.10.12:6379 ── Replica 2: 10.0.10.15:6379
        └── Primary 3: 10.0.10.13:6379 ── Replica 3: 10.0.10.16:6379
```

애플리케이션은 초기 접속에 사용할 노드 주소를 Seed로 등록하고, 접속 후 전달받은 Slot 맵에 따라 각 Primary로 요청을 보냅니다.  
따라서 애플리케이션에서는 모든 Redis 노드의 `6379` 포트에 접근할 수 있어야 합니다.  
Redis 노드끼리는 복제 연결에 사용하는 `6379` 포트뿐 아니라 Cluster Bus 통신을 위한 `16379` 포트에도 서로 접근할 수 있어야 합니다.  

각 노드는 다른 노드와 Client가 실제로 접근할 수 있는 자신의 사설 주소를 광고합니다.  
예를 들어 Primary 1의 `redis.conf`에는 다음 설정을 추가할 수 있습니다.  

```conf
cluster-announce-ip 10.0.10.11
cluster-announce-port 6379
cluster-announce-bus-port 16379
```

나머지 노드도 `cluster-announce-ip`에 각자의 주소를 지정합니다.  
위 Primary·Replica 연결은 설명을 위한 예시이며, 실제 관계는 Cluster 생성 후 `CLUSTER NODES`로 확인해야 합니다.  
인터넷에는 Redis 포트를 공개하지 않고, 방화벽이나 보안 그룹에서 애플리케이션과 Redis 노드 사이에 필요한 통신만 허용하는 방식이 안전합니다.  

### 🟦 Redis 노드 실행과 설정 확인

Docker Compose를 실행하고 6개 컨테이너의 상태를 확인합니다.  

```bash
# 6개 Redis 노드를 백그라운드에서 실행합니다.
sudo docker compose up -d

# 모든 컨테이너가 실행 중인지 확인합니다.
sudo docker compose ps
```

정상적으로 실행되면 다음과 비슷하게 출력됩니다.  

```text
NAME          IMAGE          STATUS
redis-node1   redis:7.2.15   Up
redis-node2   redis:7.2.15   Up
redis-node3   redis:7.2.15   Up
redis-node4   redis:7.2.15   Up
redis-node5   redis:7.2.15   Up
redis-node6   redis:7.2.15   Up
```

각 Redis 프로세스와 Cluster 설정을 확인합니다.  

```bash
# node1의 Redis 연결을 확인합니다.
sudo docker exec redis-node1 redis-cli -a dnqnsxn PING

# Cluster 기능이 활성화되었는지 확인합니다.
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CONFIG GET cluster-enabled
```

아직 6개의 노드를 하나의 Cluster로 묶지 않았으므로 `CLUSTER INFO`는 정상 Cluster 상태를 보여 주지 않습니다.  

### 🟦 Redis Cluster 생성

`redis-cli --cluster create`로 6개의 빈 Redis 노드를 하나의 Cluster로 묶습니다.  

```bash
sudo docker exec -it redis-node1 \
  redis-cli -a dnqnsxn --cluster create \
  172.28.0.11:6379 \
  172.28.0.12:6379 \
  172.28.0.13:6379 \
  172.28.0.14:6379 \
  172.28.0.15:6379 \
  172.28.0.16:6379 \
  --cluster-replicas 1
```

`--cluster-replicas 1`은 각 Primary에 Replica 하나를 배정하라는 뜻입니다.  
`redis-cli`가 제안한 Primary·Replica와 Slot 배치를 확인한 뒤 다음 질문에 `yes`를 입력합니다.  

```text
Can I set the above configuration? (type 'yes' to accept): yes
```

Cluster 구성이 완료되면 다음과 비슷한 결과가 출력됩니다.  

```text
[OK] All 16384 slots covered.
```

전체 16,384개 Hash Slot을 Primary들이 모두 담당하고 있다는 뜻입니다.  

### 🟦 Cluster 상태와 노드 관계 확인

Cluster 전체 상태를 확인합니다.  

```bash
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER INFO
```

정상 상태에서는 다음 항목을 확인할 수 있습니다.  

```text
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_known_nodes:6
```

| 항목 | 의미 |
| --- | --- |
| `cluster_state:ok` | 현재 노드 관점에서 Cluster가 명령을 처리할 수 있음 |
| `cluster_slots_assigned:16384` | 전체 Slot이 노드에 배정됨 |
| `cluster_slots_ok:16384` | 정상 상태로 제공되는 Slot 수 |
| `cluster_known_nodes:6` | 현재 알고 있는 Cluster 노드 수 |

노드별 역할과 Slot 범위를 확인합니다.  

```bash
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER NODES
```

결과는 다음과 비슷합니다.  

```text
<node-id> 172.28.0.11:6379@16379 myself,master ... 0-5460
<node-id> 172.28.0.12:6379@16379 master ... 5461-10922
<node-id> 172.28.0.13:6379@16379 master ... 10923-16383
<node-id> 172.28.0.14:6379@16379 slave ...
<node-id> 172.28.0.15:6379@16379 slave ...
<node-id> 172.28.0.16:6379@16379 slave ...
```

Redis 7.2의 출력에는 호환성을 위해 Replica 역할이 `slave`로 표시될 수 있습니다.  
`6379@16379`는 Client Port가 `6379`, Cluster Bus Port가 `16379`라는 뜻입니다.  

특정 Primary의 Replica는 해당 Primary의 Node ID를 사용해 확인할 수 있습니다.  

```bash
# <primary-node-id>를 CLUSTER NODES에서 확인한 실제 ID로 바꿉니다.
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER REPLICAS <primary-node-id>
```

Primary·Replica 관계는 이후 장애 테스트에서 사용하므로 실제 출력 결과를 기록해 둡니다.  

## 4. 데이터 분산, Redirect와 Failover 테스트하기 {#session-04}

### 🟦 Hash Slot 확인

여러 Key가 어떤 Slot에 배정되는지 확인합니다.  

```bash
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER KEYSLOT user:1
10778  

sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER KEYSLOT user:2
6777

sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER KEYSLOT order:100
11530  
```

각 Key의 CRC16 결과에 따라 서로 다른 Slot 번호가 출력될 수 있습니다.  
`CLUSTER NODES`의 Primary 행 마지막 부분과 비교하면 해당 Slot을 담당하는 Primary를 찾을 수 있습니다.  

### 🟦 MOVED Redirect 확인

Cluster Mode를 사용하지 않은 일반 `redis-cli`로 node1에 접속합니다.  

```bash
sudo docker exec -it redis-node1 redis-cli -a dnqnsxn
```

node1이 담당하지 않는 Slot의 Key에 명령을 보내면 다음과 같은 `MOVED` 응답을 받을 수 있습니다.  

```text
127.0.0.1:6379> SET cluster:test "hello"
(error) MOVED 14032 172.28.0.13:6379
```

이 Key는 내가 담당하는 Slot이 아니니 다른 노드로 요청하라”는 Redis Cluster의 Redirect 응답입니다

Slot 번호와 대상 주소는 실제 Cluster 배치에 따라 달라집니다.  

```text
MOVED 14032 172.28.0.13:6379
      │     │
      │     └── 해당 Slot을 담당하는 Primary 주소
      └──────── Key의 Hash Slot
```

Redis 노드는 요청을 다른 노드로 대신 전달하지 않고 Client에 올바른 노드 주소를 알려 줍니다.  
Cluster를 지원하는 Client가 이 응답이나 Slot 맵을 이용해 적절한 Primary로 요청해야 합니다.  

### 🟦 redis-cli -c로 Redirect 자동 처리

`redis-cli`의 `-c` 옵션은 Cluster Mode를 활성화하여 `MOVED` 응답을 자동으로 따라갑니다.  

```bash
sudo docker exec -it redis-node1 redis-cli -a dnqnsxn -c
```

```text
127.0.0.1:6379> SET cluster:test "hello"
-> Redirected to slot [14032] located at 172.28.0.13:6379
OK

172.28.0.13:6379> GET cluster:test
"hello"
```

실제 Slot과 Redirect 대상은 환경에 따라 다를 수 있습니다.  
운영 애플리케이션에서는 사용하는 Redis Client가 Cluster Mode와 Slot 맵 갱신을 지원하는지 확인해야 합니다.  

### 🟦 여러 Key 분산 저장

Cluster Mode로 여러 Key를 저장합니다.  

```bash
sudo docker exec -it redis-node1 redis-cli -a dnqnsxn -c
```

```text
SET user:1 "Kim"
SET user:2 "Lee"
SET user:3 "Park"
SET order:100 "created"
SET order:200 "paid"
SET cache:product:1 "MacBook"
```

각 Key의 Slot을 확인하면 여러 Slot과 Primary에 분산된 것을 볼 수 있습니다.  
각 Primary의 로컬 Key를 살펴보려면 먼저 `CLUSTER NODES`에서 Primary 컨테이너를 확인한 뒤 각 노드에서 `SCAN 0`을 실행합니다.  

```bash
# SCAN은 접속한 노드의 로컬 Key만 조회합니다.
sudo docker exec redis-node1 redis-cli -a dnqnsxn SCAN 0
0
user:3

sudo docker exec redis-node2 redis-cli -a dnqnsxn SCAN 0
0
cache:product:1
cluster:test
user:2
user:1

sudo docker exec redis-node3 redis-cli -a dnqnsxn SCAN 0
0
order:200
order:100
```

Cluster 전체 Key를 한 번에 조회하는 명령이 아니므로 실제 Primary 역할을 가진 모든 노드에서 각각 확인해야 합니다.  

### 🟦 Hash Tag와 Cross-Slot 제약

Redis Cluster에서 여러 Key를 한 명령으로 처리하려면 관련 Key가 같은 Hash Slot에 있어야 합니다.  
다른 Slot에 있는 두 Key를 `MGET`으로 조회하면 다음 오류가 발생할 수 있습니다.  

```text
127.0.0.1:6379> MGET user:1 user:2
CROSSSLOT Keys in request don't hash to the same slot
```

Key 이름의 `{}` 안에 같은 문자열을 넣는 Hash Tag를 사용하면 여러 Key를 같은 Slot에 배치할 수 있습니다.  

```text
sudo docker exec -it redis-node3 redis-cli -a dnqnsxn -c

SET user:{1}:name "Kim"
-> Redirected to slot [9842] located at 172.28.0.12:6379

SET user:{1}:email "kim@example.com"
OK

CLUSTER KEYSLOT user:{1}:name
(integer) 9842

CLUSTER KEYSLOT user:{1}:email
(integer) 9842

MGET user:{1}:name user:{1}:email
1) "Kim"
2) "kim@example.com"
```

Redis는 `{}` 안의 `1`을 기준으로 Slot을 계산하므로 두 Key가 같은 Slot을 사용합니다.  
Hash Tag를 지나치게 사용하면 특정 Slot과 Primary에 데이터가 집중될 수 있으므로 함께 처리해야 하는 Key에만 사용합니다.  

Transaction, Lua Script와 Multi-Key 명령을 사용할 때도 관련 Key의 Slot 설계를 확인해야 합니다.  

### 🟦 Failover 대상 Primary와 Replica 확인

Primary 하나를 중지하기 전에 실제 Primary·Replica 관계를 확인합니다.  

```bash
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn CLUSTER NODES
```

출력에서 `master` 역할과 Slot 범위를 가진 노드를 하나 선택하고, 그 Node ID를 복제하는 Replica를 찾습니다.  
현재 `CLUSTER NODES` 결과에서는 Primary 3개와 Replica 3개가 다음과 같이 연결되어 있습니다.  

| 역할 | Node ID | IP | Slot | Replica |
| ------- | --------------- | ------------- | ------------- | ------------- |
| Primary | `08bb29...923b` | `172.28.0.11` | `0-5460` | `172.28.0.15` |
| Primary | `080852...b998` | `172.28.0.12` | `5461-10922` | `172.28.0.16` |
| Primary | `f7e420...b988` | `172.28.0.13` | `10923-16383` | `172.28.0.14` |

예를 들어 다음 두 행으로 `172.28.0.12`와 `172.28.0.16`의 관계를 확인할 수 있습니다.  

```text
0808525422d5ad68b30e96ed0da98a43b111b998 172.28.0.12:6379@16379 master - 0 1786505177708 2 connected 5461-10922
050d75646d34a767050aa7a8f878749e16684306 172.28.0.16:6379@16379 slave 0808525422d5ad68b30e96ed0da98a43b111b998 0 1786505177000 2 connected
```

첫 번째 행은 `172.28.0.12`가 Slot `5461-10922`를 담당하는 `master`임을 보여 줍니다.  
두 번째 행에서 `slave` 뒤의 Node ID가 첫 번째 행의 Node ID와 같으므로, `172.28.0.16`은 `172.28.0.12` Primary의 Replica입니다.  

이하 Failover 실습에서는 Slot `0-5460`을 담당하는 `redis-node1`을 중지하고, 그 Replica인 `redis-node5`가 Primary로 승격되는지 확인합니다.  

```text
redis-node1 (172.28.0.11): Primary, Slot 0-5460
     │
     └── redis-node5 (172.28.0.15): Replica
```

다른 Cluster 배치에서 실습한다면 `CLUSTER NODES` 결과에 맞게 중지할 Primary와 승격을 확인할 Replica를 바꿔야 합니다.  

### 🟦 Primary 장애와 Replica 자동 승격

선택한 Primary를 중지합니다.  

```bash
# Slot 0-5460을 담당하는 Primary를 중지합니다.
sudo docker stop redis-node1
```

중지한 노드가 아닌 다른 노드에서 Cluster 상태를 확인합니다.  

```bash
sudo docker exec redis-node2 \
  redis-cli -a dnqnsxn CLUSTER NODES
```

`cluster-node-timeout`과 Cluster의 Failover 절차에 따라 장애 판단과 승격에는 시간이 걸릴 수 있습니다.  
잠시 후 기존 Primary에는 `fail` 플래그가 표시되고 해당 Replica가 `master`로 승격됩니다.  

```text
Failover 전

redis-node1 (172.28.0.11): master, Slot 0-5460
     │
     └── redis-node5 (172.28.0.15): slave

Failover 후

redis-node1 (172.28.0.11): master,fail
redis-node5 (172.28.0.15): master, Slot 0-5460
```

![alt text](/assets/images/nodejs/nodejs-redis/image-2026-08-11.png)

Redis Cluster는 `redis-node1`이 담당하던 Slot `0-5460`을 승격된 `redis-node5`에 연결합니다.  
Cluster Failover가 진행되려면 과반수 Primary가 서로 통신할 수 있고, 장애 Primary를 대신할 정상 Replica가 있어야 합니다.  

### 🟦 Failover 후 Cluster와 데이터 확인

Failover가 완료되면 Cluster 상태를 확인합니다.  

```bash
sudo docker exec redis-node2 \
  redis-cli -a dnqnsxn CLUSTER INFO
```

정상 상태로 복구되면 다음 값을 확인할 수 있습니다.  

```text
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
```

살아 있는 노드에서 Cluster Mode로 접속해 기존 데이터를 조회합니다.  

```bash
sudo docker exec -it redis-node2 redis-cli -a dnqnsxn -c
```

```text
GET user:1
GET order:100
GET cluster:test
```

Cluster Client는 갱신된 Slot 정보를 따라 승격된 Primary로 요청을 보냅니다.  
다만 Redis Cluster도 비동기 복제를 사용하므로 장애 직전 Replica에 전달되지 않은 쓰기는 유실될 수 있습니다.  

### 🟦 기존 Primary 재실행

중지했던 `redis-node1`을 다시 실행합니다.  

```bash
sudo docker start redis-node1
```

잠시 후 다른 노드에서 현재 역할과 Slot 배치를 확인합니다.  

```bash
sudo docker exec redis-node2 \
  redis-cli -a dnqnsxn CLUSTER NODES
```

`redis-node1`을 다시 실행해도 기존 Primary 역할로 자동 복귀하지 않습니다.  
Failover 과정에서 Slot `0-5460`을 넘겨받은 `redis-node5`가 계속 `master`로 유지되고, `redis-node1`은 `redis-node5`를 복제하는 `slave`로 Cluster에 다시 합류합니다.  

![alt text](/assets/images/nodejs/nodejs-redis/image-2026-08-11-1.png)  

컨테이너 이름만 보고 역할을 판단하지 말고 `CLUSTER NODES` 결과의 `master`와 `slave` 플래그를 기준으로 확인합니다.  

### 🟦 Cluster 상태와 nodes.conf 확인

`redis-cli --cluster check`로 전체 Slot 배치와 Cluster 상태를 검사합니다.  

```bash
sudo docker exec redis-node1 \
  redis-cli -a dnqnsxn --cluster check 172.28.0.11:6379
```

정상 상태에서는 다음 결과를 확인할 수 있습니다.  

```text
[OK] All 16384 slots covered.
```

각 노드의 `/data`에는 Redis가 자동으로 관리하는 `nodes.conf`와 AOF 파일이 저장됩니다.  

```bash
# Cluster 상태 파일과 영속성 파일을 확인합니다.
sudo docker exec redis-node1 ls -al /data

# 학습 목적으로 nodes.conf 내용을 읽어 봅니다.
sudo docker exec redis-node1 cat /data/nodes.conf
```

`nodes.conf`는 노드 ID, 주소, 역할과 Slot 정보를 저장하며 사용자가 직접 수정해서는 안 됩니다.  

### 🟦 주요 Cluster 명령과 실습 결과 정리

| 명령 | 설명 |
| --- | --- |
| `CLUSTER INFO` | Cluster 전체 상태 확인 |
| `CLUSTER NODES` | 노드 목록, 역할과 Slot 확인 |
| `CLUSTER KEYSLOT key` | 특정 Key의 Hash Slot 확인 |
| `CLUSTER REPLICAS node-id` | 특정 Primary의 Replica 확인 |
| `redis-cli -c` | Cluster Redirect를 자동 처리하며 접속 |
| `redis-cli --cluster create` | Redis Cluster 생성 |
| `redis-cli --cluster check` | Cluster 구성과 Slot 상태 확인 |
