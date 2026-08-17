---
layout: post
title: "[Docker]4편. Docker 볼륨 종류와 사용법 이해하기"
description: "Docker 컨테이너의 데이터가 사라지는 이유와 Docker Volume, Bind Mount, tmpfs Mount의 차이 및 사용 방법을 예제와 함께 알아봅니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker에서 볼륨이 필요한 이유"
  - id: session-02
    title: "2. Docker 볼륨 종류"
  - id: session-03
    title: "3. Docker Volume 생성 및 사용하기"
  - id: session-04
    title: "4. Bind Mount와 tmpfs 사용하기"
---

Docker 컨테이너는 기본적으로 컨테이너 내부에 데이터를 저장합니다.  
하지만 컨테이너가 삭제되면 컨테이너 내부에서 생성하거나 변경한 데이터 역시 함께 사라질 수 있습니다.  

데이터베이스처럼 컨테이너가 삭제되더라도 데이터를 유지해야 하는 경우에는 컨테이너의 생명주기와 데이터를 분리할 필요가 있습니다.  

Docker에서는 이러한 데이터를 관리하기 위해 **Volume**, **Bind Mount**, **tmpfs Mount** 등의 저장 방식을 제공합니다.  

이번 글에서는 Docker의 데이터 저장 구조를 이해하고 각 마운트 방식의 차이와 기본적인 사용 방법을 알아봅니다.  

## 1. Docker에서 볼륨이 필요한 이유 {#session-01}

Docker 컨테이너는 이미지(Image)를 기반으로 생성됩니다.  

이미지는 읽기 전용 레이어로 구성되며 컨테이너가 실행되면 그 위에 쓰기 가능한 **컨테이너 레이어(Container Layer)** 가 추가됩니다.  

```text
Container
┌──────────────────────────────┐
│ Writable Container Layer     │
├──────────────────────────────┤
│ Image Layer                  │
│ Image Layer                  │
│ Image Layer                  │
└──────────────────────────────┘
```

컨테이너에서 파일을 생성하거나 수정하면 기본적으로 이 쓰기 가능한 컨테이너 레이어에 저장됩니다.  

예를 들어 Ubuntu 컨테이너를 실행한 뒤 파일을 하나 생성해 보겠습니다.  

```bash
# Ubuntu 컨테이너를 실행합니다.
docker run -it --name volume-test ubuntu bash
```

컨테이너 내부에서 파일을 생성합니다.  

```bash
# 컨테이너 내부에 테스트 파일을 생성합니다.
echo "Docker Volume Test" > /data.txt

cat /data.txt

# 컨테이너 셸을 종료하고 호스트로 돌아갑니다.
exit
```

종료된 컨테이너를 다시 실행하면 파일은 그대로 존재합니다.  

```bash
# 컨테이너를 다시 시작하고 셸에 연결합니다.
docker start -ai volume-test

# 컨테이너 내부에서 파일을 확인한 뒤 셸을 종료합니다.
cat /data.txt
exit
```

컨테이너를 **중지(stop)** 하는 것만으로 컨테이너 레이어가 삭제되지는 않기 때문입니다.  

하지만 컨테이너 자체를 삭제하면 해당 컨테이너의 쓰기 가능한 레이어도 함께 제거됩니다.  

```bash
# 컨테이너를 삭제합니다.
docker rm -f volume-test
```

새로운 컨테이너를 생성한다고 해서 이전 컨테이너의 `/data.txt` 파일이 복구되지는 않습니다.  

이 구조는 애플리케이션 실행 환경을 빠르게 생성하고 제거하는 Docker의 특징에는 적합하지만, 데이터베이스 데이터와 같이 계속 유지해야 하는 정보에는 적합하지 않습니다.  

예를 들어 MySQL 컨테이너의 데이터가 다음 위치에 저장된다고 가정해 보겠습니다.  

```text
/var/lib/mysql
```

별도의 저장 공간을 사용하지 않는다면 MySQL 컨테이너를 삭제했을 때 데이터도 컨테이너와 함께 제거될 수 있습니다.  

이를 해결하기 위해 Docker에서는 **컨테이너 외부의 저장 공간을 컨테이너 내부 디렉터리에 연결하는 마운트(Mount) 방식**을 제공합니다.  

```text
Docker Host
│
├─ Persistent Storage
│       │
│       └──────────────┐
│                      │ Mount
│                      ▼
└─ Container
        │
        └─ /var/lib/mysql
```

컨테이너를 삭제하고 새로운 컨테이너를 생성하더라도 같은 저장 공간을 다시 연결하면 기존 데이터를 사용할 수 있습니다.  

즉, Docker에서 볼륨을 사용하는 가장 중요한 목적은 **컨테이너의 생명주기와 데이터의 생명주기를 분리하는 것**입니다.  

## 2. Docker 볼륨 종류 {#session-02}

Docker에서 컨테이너에 데이터를 연결하는 대표적인 방법은 다음 세 가지입니다.  

| 종류          | 저장 위치        | Docker 관리 | 주요 용도           |
| ----------- | ------------ | --------- | --------------- |
| Volume      | Docker 관리 영역 | O         | DB 데이터, 영구 데이터  |
| Bind Mount  | 호스트의 지정 경로   | X         | 소스 코드, 설정 파일    |
| tmpfs Mount | 호스트 메모리      | O         | 임시 데이터, 비영구 데이터 |

구조를 간단하게 표현하면 다음과 같습니다.  

```text
Docker Host
│
├─ Docker Volume
│      └─────────────> Container /data
│
├─ /home/user/project
│      └─────────────> Container /app
│
└─ Memory
       └─────────────> Container /tmp
```

### 🟦 Volume

Volume은 Docker가 직접 관리하는 저장 공간입니다.  

```text
Docker 관리 영역
        │
        ▼
     Volume
        │
        ▼
Container /data
```

Linux 환경에서는 일반적으로 Docker 데이터 디렉터리 아래에서 관리되지만, 실제 저장 경로에 직접 접근하기보다는 `docker volume` 명령을 통해 관리하는 것이 권장됩니다.  

Volume은 데이터베이스처럼 **컨테이너가 삭제된 이후에도 데이터를 유지해야 하는 경우**에 주로 사용합니다.  

예를 들어 다음과 같이 사용할 수 있습니다.  

```bash
# 학습용 비밀번호를 지정하고 MySQL 데이터 디렉터리를 Volume에 연결합니다.
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=example-password \
  -v mysql-data:/var/lib/mysql \
  mysql
```

> `example-password`는 실습용 값이므로 운영 환경에서는 안전하게 관리하는 비밀번호나 Docker secrets 같은 방식을 사용해야 합니다.

여기서  

```text
mysql-data
```

는 Docker가 관리하는 Volume 이름이고,  

```text
/var/lib/mysql
```

은 컨테이너 내부에서 해당 Volume이 연결되는 경로입니다.  

Volume은 다시 **Named Volume**과 **Anonymous Volume**으로 구분해 이해할 수 있습니다.  

Named Volume은 사용자가 이름을 직접 지정합니다.  

```bash
docker run --rm -v my-volume:/data ubuntu
```

반면 다음처럼 이름을 지정하지 않으면 Docker가 임의의 이름을 생성합니다.  

```bash
docker run --name anonymous-volume-test -v /data ubuntu
```

이를 Anonymous Volume이라고 합니다.  

종료된 컨테이너도 Anonymous Volume을 계속 참조하므로 다음 명령으로 컨테이너와 연결된 Anonymous Volume을 함께 삭제합니다.  

```bash
# 실습용 컨테이너와 컨테이너에 연결된 Anonymous Volume을 삭제합니다.
docker rm -v anonymous-volume-test
```

관리와 재사용 측면에서는 일반적으로 이름을 명확하게 지정하는 Named Volume을 사용하는 편이 좋습니다.  

### 🟦 Bind Mount

Bind Mount는 호스트에 존재하는 파일이나 디렉터리를 컨테이너에 직접 연결하는 방식입니다.  

예를 들어 호스트의 프로젝트 디렉터리를 컨테이너의 `/app`에 연결할 수 있습니다.  

```bash
docker run -it \
  --rm \
  --mount type=bind,source="$(pwd)",target=/app \
  ubuntu bash
```

구조는 다음과 같습니다.  

```text
Host
/home/user/project
        │
        ▼
Container
/app
```

호스트에서 파일을 수정하면 컨테이너에서도 바로 변경 내용을 확인할 수 있고, 반대로 컨테이너에서 수정한 내용도 호스트 디렉터리에 반영됩니다.  

이러한 특징 때문에 개발 환경에서 소스 코드를 연결할 때 많이 사용합니다.  

### 🟦 tmpfs Mount

tmpfs Mount는 데이터를 컨테이너의 쓰기 가능한 레이어 대신 **호스트의 메모리에 저장**합니다.  

tmpfs Mount는 Linux에서 실행하는 Docker 컨테이너에서 사용할 수 있습니다.  

> Linux의 스왑이 활성화되어 있으면 tmpfs 데이터가 스왑 파일을 통해 디스크에 기록될 수 있으므로 민감한 데이터 처리 시 주의해야 합니다.

```text
Host Memory
     │
     ▼
   tmpfs
     │
     ▼
Container /data
```

컨테이너가 중지되거나 제거되면 tmpfs에 저장된 데이터도 사라집니다.  

따라서 영구적으로 보관해야 하는 데이터보다는 캐시나 실행 중에만 필요한 임시 데이터에 적합합니다.  

```bash
docker run -d \
  --name tmpfs-test \
  --mount type=tmpfs,destination=/app/cache \
  nginx
```

## 3. Docker Volume 생성 및 사용하기 {#session-03}

Docker Volume은 `docker volume` 명령을 사용해 관리할 수 있습니다.  

먼저 현재 생성되어 있는 Volume 목록을 확인합니다.  

```bash
# Docker Volume 목록을 확인합니다.
docker volume ls
```

새로운 Volume을 생성하려면 `docker volume create` 명령을 사용합니다.  

```bash
# data-volume이라는 이름의 Volume을 생성합니다.
docker volume create data-volume
```

생성된 Volume의 상세 정보를 확인할 수도 있습니다.  

```bash
# data-volume의 드라이버와 실제 저장 위치 등 상세 정보를 확인합니다.
docker volume inspect data-volume
```

Linux의 기본 Docker 구성이라면 다음과 비슷한 정보가 출력됩니다.  

```json
[
  {
    "Driver": "local",
    "Name": "data-volume",
    "Mountpoint": "/var/lib/docker/volumes/data-volume/_data"
  }
]
```

여기서 `Mountpoint`는 Docker가 실제 데이터를 저장하고 있는 호스트 측 위치입니다.  

> `/var/lib/docker/volumes` 내부의 파일을 직접 수정하기보다는 Docker 명령을 통해 Volume을 관리하는 것이 좋습니다.

생성한 Volume은 `docker run`의 `--mount` 옵션을 사용해 컨테이너에 연결할 수 있습니다.  

```bash
docker run -it \
  --name volume-test \
  --mount source=data-volume,target=/data \
  ubuntu bash
```

컨테이너 내부에서 테스트 파일을 생성합니다.  

```bash
echo "Hello Docker Volume" > /data/test.txt

cat /data/test.txt

# 확인을 마친 뒤 컨테이너 셸을 종료합니다.
exit
```

이제 컨테이너를 삭제합니다.  

```bash
docker rm -f volume-test
```

컨테이너가 삭제되어도 `data-volume`은 별도로 존재하기 때문에 데이터가 유지됩니다.  

새로운 컨테이너에서 같은 Volume을 다시 연결해 보겠습니다.  

```bash
docker run -it \
  --name volume-test2 \
  --mount source=data-volume,target=/data \
  ubuntu bash
```

컨테이너 내부에서 파일을 확인합니다.  

```bash
cat /data/test.txt

# 확인을 마친 뒤 컨테이너 셸을 종료합니다.
exit
```

다음과 같이 이전 컨테이너에서 생성한 데이터를 그대로 확인할 수 있습니다.  

```text
Hello Docker Volume
```

즉, 구조적으로 보면 다음과 같습니다.  

```text
┌─────────────────┐
│ Container A     │
│ /data           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ data-volume     │
└────────┬────────┘
         ▲
         │
┌────────┴────────┐
│ Container B     │
│ /data           │
└─────────────────┘
```

컨테이너 A를 삭제해도 Volume은 유지되며 이후 Container B에서 같은 데이터를 사용할 수 있습니다.  

Volume은 `-v` 또는 `--volume` 옵션으로도 간단하게 연결할 수 있습니다.  

```bash
docker run -it \
  --rm \
  -v data-volume:/data \
  ubuntu bash
```

두 명령은 기본적인 Volume 연결이라는 점에서는 같은 역할을 합니다.  

```bash
# -v 방식
docker run --rm -v data-volume:/data ubuntu

# --mount 방식
docker run --rm \
  --mount type=volume,source=data-volume,target=/data \
  ubuntu
```

`-v` 방식은 짧고 간단하며, `--mount` 방식은 `type`, `source`, `target` 등이 명시적으로 표현되어 설정을 이해하기 쉽다는 차이가 있습니다.  

사용하지 않는 Volume은 다음 명령으로 삭제할 수 있습니다.  

Volume을 참조하는 컨테이너가 남아 있으면 삭제할 수 없으므로 먼저 실습용 컨테이너를 제거합니다.  

```bash
# data-volume을 참조하는 실습용 컨테이너를 제거합니다.
docker rm volume-test2

# 더 이상 사용하지 않는 Named Volume을 삭제합니다.
docker volume rm data-volume
```

현재 어떤 컨테이너에서도 사용하지 않는 익명 Volume을 한 번에 정리하려면 다음 명령을 사용할 수 있습니다.  

```bash
# 현재 사용하지 않는 익명 Volume을 확인하고 삭제합니다.
docker volume prune
```

> `docker volume prune`은 사용하지 않는 Volume을 삭제하므로 필요한 데이터가 없는지 확인한 후 실행해야 합니다.

사용하지 않는 Named Volume까지 모두 정리하려면 `docker volume prune --all`을 사용하지만, 필요한 데이터가 삭제될 수 있으므로 더욱 주의해야 합니다.  

## 4. Bind Mount와 tmpfs 사용하기 {#session-04}

Volume이 Docker가 관리하는 영구 저장 공간이라면 Bind Mount는 **호스트의 특정 디렉터리를 직접 컨테이너와 연결하는 방식**입니다.  

예를 들어 다음과 같은 프로젝트가 있다고 가정해 보겠습니다.  

```text
~/docker-project
├── index.html
└── nginx.conf
```

현재 디렉터리를 Nginx 컨테이너의 `/usr/share/nginx/html`에 연결할 수 있습니다.  

```bash
docker run -d \
  --name nginx-test \
  -p 8080:80 \
  --mount type=bind,source="$(pwd)",target=/usr/share/nginx/html \
  nginx
```

구조는 다음과 같습니다.  

```text
Host
~/docker-project
     │
     │ Bind Mount
     ▼
Container
/usr/share/nginx/html
```

호스트의 `index.html` 파일을 수정하면 별도의 이미지 빌드 과정 없이 컨테이너에서도 변경된 파일을 바로 사용할 수 있습니다.  

이러한 특성 때문에 Bind Mount는 개발 환경에서 특히 유용합니다.  

쓰기 가능한 Bind Mount를 연결하면 컨테이너에서도 호스트 파일을 변경할 수 있으므로 연결 경로와 권한을 주의해서 설정해야 합니다.  

예를 들어 애플리케이션 소스 코드를 컨테이너에 연결하는 경우가 대표적입니다.  

```bash
docker run -it \
  --rm \
  --mount type=bind,source="$(pwd)",target=/app \
  node bash
```

컨테이너가 호스트 파일을 수정하지 못하도록 읽기 전용으로 연결할 수도 있습니다.  

```bash
docker run -it \
  --rm \
  --mount type=bind,source="$(pwd)",target=/app,readonly \
  ubuntu bash
```

`-v`를 사용하면 다음처럼 표현할 수 있습니다.  

```bash
docker run -it \
  --rm \
  -v "$(pwd)":/app:ro \
  ubuntu bash
```

여기서 `ro`는 **read-only**를 의미합니다.  

반면 tmpfs는 호스트의 디스크가 아니라 메모리를 사용합니다.  

```bash
docker run -d \
  --name tmpfs-cache-test \
  --mount type=tmpfs,destination=/app/cache \
  nginx
```

컨테이너 내부에서 `/app/cache`에 저장한 데이터는 컨테이너의 쓰기 가능한 레이어가 아니라 tmpfs에 저장됩니다.  

따라서 다음과 같은 데이터에 사용할 수 있습니다.  

* 애플리케이션의 임시 캐시
* 실행 과정에서만 필요한 임시 파일
* 디스크에 영구적으로 남길 필요가 없는 데이터

세 가지 방식을 정리하면 다음과 같습니다.  

| 구분               | Volume       | Bind Mount   | tmpfs      |
| ---------------- | ------------ | ------------ | ---------- |
| 저장 위치            | Docker 관리 영역 | 호스트 지정 경로    | 메모리        |
| 컨테이너 삭제 후 데이터    | 유지           | 유지           | 소멸         |
| Docker가 저장 위치 관리 | O            | X            | O          |
| 호스트에서 직접 접근      | 일반적으로 불필요    | 쉬움           | 불가능        |
| 대표적인 사용 사례       | DB, 영구 데이터   | 소스 코드, 설정 파일 | 캐시, 임시 데이터 |

실제 사용에서는 데이터의 성격에 따라 저장 방식을 선택하면 됩니다.  

**데이터베이스처럼 컨테이너와 독립적으로 유지해야 하는 데이터**라면 Docker Volume이 적합합니다.  

```text
MySQL / PostgreSQL
        ↓
     Volume
```

**개발 중인 소스 코드나 설정 파일처럼 호스트와 컨테이너가 함께 사용해야 하는 파일**이라면 Bind Mount가 적합합니다.  

```text
Source Code / Config
        ↓
    Bind Mount
```

**컨테이너가 실행되는 동안에만 필요한 데이터**라면 tmpfs를 고려할 수 있습니다.  

```text
Cache / Temporary Data
        ↓
       tmpfs
```

Docker 컨테이너는 언제든지 생성하고 삭제할 수 있다는 점이 큰 장점입니다.  
따라서 컨테이너 내부에 데이터를 함께 보관하기보다는 **애플리케이션 실행 환경과 영구 데이터를 분리하는 구조**로 구성하는 것이 중요합니다.  

Docker Volume을 적절하게 활용하면 컨테이너를 교체하거나 재배포하더라도 데이터를 유지하면서 컨테이너의 일회성 특성을 그대로 활용할 수 있습니다.  
다만 Volume 자체가 백업을 제공하는 것은 아니므로 호스트 장애, 파일 손상과 실수에 대비해 별도의 백업을 구성해야 합니다.  

### 🟦 실습 환경 정리

실습을 마친 뒤 이 글에서 생성한 컨테이너와 Volume이 더 이상 필요하지 않다면 다음과 같이 정리할 수 있습니다.  

```bash
# 이 글에서 이름을 지정해 생성한 실습용 컨테이너를 삭제합니다.
docker rm -f mysql tmpfs-test nginx-test tmpfs-cache-test

# 컨테이너에서 분리된 실습용 Named Volume을 삭제합니다.
docker volume rm mysql-data my-volume
```
