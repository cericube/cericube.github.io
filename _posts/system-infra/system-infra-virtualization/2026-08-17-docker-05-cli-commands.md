---
layout: post
title: "[Docker]5편. Docker 명령어 정리와 사용 예제"
description: "Docker의 버전 확인부터 이미지, 컨테이너, 실행 옵션, 네트워크, 볼륨과 불필요한 리소스 정리까지 자주 사용하는 명령어를 예제와 함께 알아봅니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker 버전 및 시스템 정보 확인"
  - id: session-02
    title: "2. Docker Image 명령어"
  - id: session-03
    title: "3. Docker Container 명령어"
  - id: session-04
    title: "4. Container 실행 옵션(docker run)"
  - id: session-05
    title: "5. run vs exec vs attach"
  - id: session-06
    title: "6. Docker 네트워크 명령어"
  - id: session-07
    title: "7. Docker 볼륨 명령어"
  - id: session-08
    title: "8. 불필요 리소스 정리 명령어"
---

Docker를 활용해 실무에서 자주 수행하는 작업을 중심으로 명령어 예제를 구성했습니다.  
개발, 테스트와 배포 환경에서 많이 사용하는 예제를 소개합니다.  

> 예제의 이미지와 컨테이너 이름은 상황에 맞게 바꿔야 합니다.  
> `webapp:latest`를 사용하는 예제는 2절에서 해당 이미지를 먼저 빌드했다고 가정합니다.  

## 1. Docker 버전 및 시스템 정보 확인 {#session-01}

| 명령어 | 설명 |
| --- | --- |
| `docker version` | Docker 클라이언트와 서버의 버전 정보를 확인합니다. |
| `docker info` | 컨테이너 수, 네트워크와 스토리지 드라이버 등 Docker 시스템 정보를 확인합니다. |

```bash
# Docker 클라이언트와 데몬의 버전을 확인합니다.
docker version

# 컨테이너 수, 네트워크와 스토리지 드라이버 등 시스템 정보를 확인합니다.
docker info
```

## 2. Docker Image 명령어 {#session-02}

| 명령어 | 설명 |
| --- | --- |
| `docker images` | 로컬 이미지 목록을 조회하며 `docker image ls`와 같습니다. |
| `docker search [이미지명]` | Docker Hub에서 이미지를 검색합니다.<br>예: `docker search ubuntu` |
| `docker pull [이미지명]:[태그]` | 레지스트리에서 이미지를 내려받습니다.<br>예: `docker pull nginx:latest` |
| `docker build -t [이미지명]:[태그] .` | 현재 디렉터리의 Dockerfile로 이미지를 만듭니다.<br>예: `docker build -t myapp:v1 .` |
| `docker tag [이미지명] [새 이미지명]` | 기존 이미지에 새로운 이름과 태그를 추가합니다.<br>예: `docker tag myapp:v1 myrepo/myapp:v1` |
| `docker push [이미지명]` | 이미지를 레지스트리에 올립니다.<br>예: `docker push myrepo/myapp:v1` |
| `docker rmi [이미지명]` | 로컬 이미지 또는 태그를 삭제합니다.<br>해당 이미지를 사용하는 컨테이너 때문에 삭제할 수 없다면 컨테이너를 먼저 확인하고 제거해야 합니다. |
| `docker save -o [파일명.tar] [이미지명]` | 이미지를 tar 파일로 저장합니다.<br>예: `docker save -o myapp.tar myapp:v1` |
| `docker load -i [파일명.tar]` | tar 파일에서 이미지를 불러옵니다.<br>예: `docker load -i myapp.tar` |
| `docker inspect [이미지명]` | 이미지의 상세 정보를 출력합니다.<br>예: `docker inspect ubuntu:latest` |
| `docker history [이미지명]` | 이미지의 레이어 생성 기록을 확인합니다.<br>예: `docker history ubuntu:latest` |
| `docker commit [컨테이너명] [새 이미지명]` | 컨테이너의 현재 변경 상태로 새 이미지를 만듭니다.<br>예: `docker commit my-container my-ubuntu:latest` |

```bash
# Docker Hub에서 nginx 관련 이미지를 검색합니다.
docker search nginx

# 경량 nginx 이미지를 내려받습니다.
docker pull nginx:alpine

# 현재 디렉터리의 Dockerfile로 webapp:latest 이미지를 만듭니다.
docker build -t webapp:latest .

# 빌드한 이미지에 개인 저장소용 태그를 추가합니다.
docker tag webapp:latest yourdockerhub/webapp:latest

# Docker Hub에 로그인한 뒤 이미지를 올립니다.
docker login
docker push yourdockerhub/webapp:latest

# 이미지를 배포하거나 옮길 수 있도록 파일로 저장합니다.
docker save -o webapp.tar webapp:latest

# 더 이상 필요하지 않은 로컬 이미지 태그를 삭제합니다.
docker rmi webapp:latest

# 다른 환경에서 이미지 파일을 불러옵니다.
docker load -i webapp.tar
```

## 3. Docker Container 명령어 {#session-03}

| 명령어 | 설명 |
| --- | --- |
| `docker run [옵션] [이미지명] [명령어]` | 새 컨테이너를 생성하고 실행합니다.<br>예: `docker run -it ubuntu /bin/bash` |
| `docker exec -it [컨테이너명] [명령어]` | 실행 중인 컨테이너에서 새 프로세스를 실행합니다.<br>예: `docker exec -it my-container /bin/bash` |
| `docker attach [컨테이너명]` | 실행 중인 컨테이너의 주 프로세스에 연결합니다.<br>예: `docker attach my-container` |
| `docker stop [컨테이너명]` | 실행 중인 컨테이너를 중지합니다. |
| `docker start [컨테이너명]` | 중지된 컨테이너를 시작합니다. |
| `docker restart [컨테이너명]` | 컨테이너를 중지한 뒤 다시 시작합니다. |
| `docker rm [컨테이너명]` | 중지된 컨테이너를 삭제합니다. 실행 중인 컨테이너는 `-f` 옵션으로 강제 삭제할 수 있습니다. |
| `docker cp [호스트 파일] [컨테이너]:[경로]` | 호스트의 파일을 컨테이너로 복사합니다.<br>예: `docker cp myfile.txt my-container:/home/` |
| `docker cp [컨테이너]:[경로] [호스트 경로]` | 컨테이너의 파일을 호스트로 복사합니다.<br>예: `docker cp my-container:/var/log/nginx.log ./` |
| `docker ps` | 실행 중인 컨테이너를 조회합니다. |
| `docker ps -a` | 중지된 컨테이너를 포함한 전체 목록을 조회합니다. |
| `docker stats` | 컨테이너의 리소스 사용량을 실시간으로 확인합니다. |
| `docker inspect [컨테이너명]` | 컨테이너의 상세 정보를 확인합니다. |
| `docker logs [컨테이너명]` | 컨테이너의 로그를 출력합니다. |
| `docker logs -f [컨테이너명]` | 컨테이너의 새로운 로그를 계속 출력합니다. |

```bash
# 명령을 확인할 nginx 컨테이너를 백그라운드에서 실행합니다.
docker run -d --name web-container -p 8080:80 nginx:alpine

# 실행 중인 웹 컨테이너에서 nginx 설정 문법을 검사합니다.
docker exec web-container nginx -t

# 애플리케이션 컨테이너를 중지한 뒤 다시 시작합니다.
docker stop web-container
docker start web-container

# 디버깅을 위해 컨테이너 로그를 출력합니다.
docker logs web-container

# 실행 중인 컨테이너를 강제로 삭제합니다.
docker rm -f web-container

# 중지된 컨테이너를 포함한 전체 목록을 확인합니다.
docker ps -a
```

## 4. Container 실행 옵션(docker run) {#session-04}

| 옵션 | 설명 |
| --- | --- |
| `-d` | 컨테이너를 백그라운드에서 실행합니다.<br>예: `docker run -d nginx` |
| `-it` | 표준 입력을 열어 두고 가상 터미널을 할당합니다.<br>예: `docker run -it ubuntu /bin/bash` |
| `--name` | 컨테이너 이름을 지정합니다.<br>예: `docker run --name my-container ubuntu` |
| `-p 호스트포트:컨테이너포트` | 컨테이너 포트를 호스트에 게시합니다.<br>예: `docker run -p 8080:80 nginx` |
| `-v 호스트경로:컨테이너경로` | 호스트 경로를 컨테이너에 마운트합니다.<br>예: `docker run -d -v /mydata:/data ubuntu sleep infinity` |
| `-e VAR=값` | 컨테이너에 환경 변수를 전달합니다.<br>예: `docker run --rm -e MY_VAR="Hello, Docker!" ubuntu env` |
| `--rm` | 컨테이너가 종료되면 컨테이너와 연결된 익명 볼륨을 자동으로 삭제합니다.<br>예: `docker run --rm ubuntu ls` |
| `-u 사용자` | 지정한 사용자로 프로세스를 실행합니다.<br>예: `docker run --rm -u root ubuntu id` |
| `--cpus` | 컨테이너가 사용할 수 있는 CPU 수를 제한합니다.<br>예: `docker run -d --cpus="1.5" ubuntu sleep infinity` |
| `--memory` | 컨테이너의 메모리 사용량을 제한합니다.<br>예: `docker run -d --memory="512m" ubuntu sleep infinity` |
| `--network` | 컨테이너가 사용할 네트워크를 지정합니다.<br>예: `docker run --network=bridge nginx`, `docker run --network=host nginx`, `docker run --network=none ubuntu` |

`-d`와 `--rm`은 함께 사용할 수 있으며, 이 경우 백그라운드 컨테이너가 종료되면 자동으로 삭제됩니다.  
다만 `--restart` 옵션과 `--rm` 옵션은 함께 사용할 수 없습니다.  

```bash
# 앞에서 빌드한 웹 앱 이미지를 3000 포트에 연결해 실행합니다.
docker run -d --name node-app -p 3000:3000 webapp:latest

# 환경 변수를 전달해 별도의 컨테이너를 실행합니다.
docker run -d --name node-prod \
  -e NODE_ENV=production \
  -e API_KEY=example-key \
  webapp:latest

# 호스트의 로그 디렉터리를 컨테이너에 마운트합니다.
docker run -d --name webapp-logs \
  -v /var/logs/app:/usr/src/app/logs \
  webapp:latest

# 컨테이너의 CPU와 메모리 사용량을 제한합니다.
docker run -d --name webapp-limited \
  --cpus="2" \
  --memory="1024m" \
  webapp:latest
```

> 명령줄에 입력한 환경 변수는 명령 기록이나 컨테이너 설정에서 노출될 수 있으므로 실제 비밀값은 안전한 비밀 관리 방식을 사용해야 합니다.

## 5. run vs exec vs attach {#session-05}

| 명령어 | 설명 |
| --- | --- |
| `docker run` | 새로운 컨테이너를 생성하고 실행합니다. |
| `docker exec` | 실행 중인 컨테이너에서 새로운 프로세스를 실행합니다. |
| `docker attach` | 실행 중인 컨테이너의 주 프로세스 표준 입출력에 연결합니다. |

```bash
# run으로 예제 컨테이너를 새로 생성하고 백그라운드에서 실행합니다.
docker run -d --name web-container nginx:alpine

# 실행 중인 웹 컨테이너에서 별도의 셸 프로세스를 실행합니다.
docker exec -it web-container sh

# 실행 중인 컨테이너의 주 프로세스에 직접 연결합니다.
# Ctrl+C를 입력하면 전달된 신호로 인해 컨테이너가 종료될 수 있습니다.
docker attach web-container

# attach에서 빠져나온 뒤 예제 컨테이너를 정리합니다.
docker rm -f web-container
```

`attach` 상태에서 컨테이너를 중지하지 않고 빠져나오려면 기본 분리 키인 `Ctrl+P`, `Ctrl+Q`를 차례로 입력합니다.  

## 6. Docker 네트워크 명령어 {#session-06}

| 명령어 | 설명 |
| --- | --- |
| `docker network ls` | 현재 생성된 네트워크 목록을 확인합니다. |
| `docker network inspect [네트워크명]` | 네트워크의 상세 정보를 확인합니다. |
| `docker network create [네트워크명]` | 새로운 네트워크를 만듭니다. |
| `docker network connect [네트워크명] [컨테이너명]` | 실행 중인 컨테이너를 네트워크에 연결합니다. |
| `docker network disconnect [네트워크명] [컨테이너명]` | 실행 중인 컨테이너를 네트워크에서 분리합니다. |
| `docker network rm [네트워크명]` | 사용 중이지 않은 네트워크를 삭제합니다. |

```bash
# 컨테이너 간 통신에 사용할 사용자 정의 브리지 네트워크를 생성합니다.
docker network create backend-net

# 웹 컨테이너를 네트워크에 연결해 실행합니다.
docker run -d --name nginx --network backend-net nginx:alpine

# 앞에서 만든 API 이미지의 컨테이너를 같은 네트워크에 연결합니다.
docker run -d --name api --network backend-net webapp:latest

# 같은 사용자 정의 네트워크에서는 컨테이너 이름으로 통신할 수 있습니다.
# 예: http://api:3000

# 네트워크의 상세 설정과 연결된 컨테이너를 확인합니다.
docker network inspect backend-net
```

## 7. Docker 볼륨 명령어 {#session-07}

| 명령어 | 설명 |
| --- | --- |
| `docker volume ls` | 현재 존재하는 볼륨 목록을 확인합니다. |
| `docker volume inspect [볼륨명]` | 볼륨의 상세 정보를 확인합니다. |
| `docker volume create [볼륨명]` | 새로운 볼륨을 만듭니다.<br>예: `docker volume create my-volume` |
| `docker volume rm [볼륨명]` | 어떤 컨테이너에서도 참조하지 않는 볼륨을 삭제합니다.<br>예: `docker volume rm my-volume` |

```bash
# 영구 데이터를 저장할 볼륨을 생성합니다.
docker volume create db-data

# 학습용 비밀번호를 지정하고 MySQL 데이터 디렉터리에 볼륨을 연결합니다.
docker run -d --name mysql-db \
  -v db-data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=example-password \
  mysql:8

# 백업이나 이전 전에 볼륨의 드라이버와 저장 위치를 확인합니다.
docker volume inspect db-data
```

## 8. 불필요 리소스 정리 명령어 {#session-08}

| 명령어 | 설명 |
| --- | --- |
| `docker system prune` | 중지된 컨테이너, 사용하지 않는 네트워크, 태그가 없는(dangling) 이미지와 빌드 캐시를 정리합니다. 볼륨은 기본적으로 삭제하지 않습니다. |
| `docker system prune -a` | 기본 정리 대상과 함께 어떤 컨테이너에서도 사용하지 않는 이미지까지 정리합니다. |
| `docker image prune` | 태그가 없는(dangling) 이미지를 정리합니다. `-a`를 추가하면 컨테이너에서 사용하지 않는 이미지까지 포함합니다. |
| `docker container prune` | 중지된 컨테이너를 정리합니다. |
| `docker volume prune` | 어떤 컨테이너에서도 참조하지 않는 익명 로컬 볼륨을 정리합니다. Named Volume까지 포함하려면 `--all`을 사용합니다. |
| `docker network prune` | 사용하지 않는 네트워크를 정리합니다. `bridge`, `host`, `none` 같은 기본 네트워크는 삭제하지 않습니다. |

다음 명령은 각각 독립적인 정리 예제이며 삭제될 대상을 확인한 후 필요한 명령만 실행해야 합니다.  

```bash
# 중지된 컨테이너, 사용하지 않는 이미지와 네트워크, 빌드 캐시를 정리합니다.
# 볼륨까지 정리하려면 --volumes 옵션을 추가해야 합니다.
docker system prune -a

# 컨테이너에서 사용하지 않는 이미지를 정리합니다.
docker image prune -a

# 중지된 컨테이너를 정리합니다.
docker container prune

# 어떤 컨테이너에서도 참조하지 않는 익명 로컬 볼륨을 정리합니다.
docker volume prune

# 기본 네트워크를 제외한 사용하지 않는 네트워크를 정리합니다.
docker network prune
```

> `prune` 명령은 여러 리소스를 한 번에 삭제하므로 표시되는 삭제 대상을 확인한 뒤 실행해야 합니다.
