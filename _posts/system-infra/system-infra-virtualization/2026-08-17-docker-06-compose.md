---
layout: post
title: "[Docker]6편. Docker Compose 이해와 사용법"
description: "Docker Compose와 Docker의 역할 차이를 알아보고, compose.yaml의 서비스, 볼륨, 네트워크 구성과 주요 명령어를 웹 애플리케이션과 데이터베이스 예제로 이해합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 06
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker Compose란?"
  - id: session-02
    title: "2. Docker와 Docker Compose의 차이"
  - id: session-03
    title: "3. compose.yaml 구성 이해하기"
  - id: session-04
    title: "4. Docker Compose 실행과 주요 명령어"
---

Docker를 사용하면 애플리케이션을 이미지로 만들고 컨테이너로 실행할 수 있습니다.  
하지만 실제 서비스는 하나의 컨테이너만으로 구성되는 경우보다 애플리케이션 서버, 데이터베이스, 캐시 등 여러 컨테이너가 함께 동작하는 경우가 많습니다.  

각 컨테이너를 `docker run` 명령으로 하나씩 실행할 수도 있지만 컨테이너가 많아질수록 포트, 환경 변수, 볼륨, 네트워크와 같은 설정도 함께 복잡해집니다.  

Docker Compose를 사용하면 여러 컨테이너의 구성을 하나의 `compose.yaml` 파일에 선언하고 하나의 명령으로 실행하거나 종료할 수 있습니다.  

이 글에서는 Docker CLI에 통합된 Compose v2의 `docker compose` 명령을 사용합니다.  

기본 문법을 살펴본 뒤에는 웹 애플리케이션과 데이터베이스를 하나의 Compose 프로젝트로 관리하는 예제를 통해 각 설정이 어떻게 연결되는지 확인합니다.  

## 1. Docker Compose란? {#session-01}

Docker Compose는 **여러 Docker 컨테이너로 구성된 애플리케이션을 정의하고 실행하기 위한 도구**입니다.  

Docker에서는 일반적으로 다음과 같이 하나의 컨테이너를 실행할 수 있습니다.  

```bash
# nginx 컨테이너를 백그라운드로 실행합니다.
docker run -d \
  --name web \
  -p 8080:80 \
  nginx
```

컨테이너가 하나뿐이라면 크게 복잡하지 않습니다.  

하지만 다음과 같이 애플리케이션 서버와 데이터베이스가 함께 필요한 환경을 생각해 보겠습니다.  

```text
Application
├── App Container
└── MySQL Container
```

Docker 명령만 사용한다면 각각의 컨테이너를 따로 실행해야 합니다.  

```bash
# 두 컨테이너가 서비스 이름으로 통신할 네트워크를 생성합니다.
docker network create app-network

# MySQL 컨테이너를 실행합니다.
docker run -d \
  --name db \
  --network app-network \
  -e MYSQL_ROOT_PASSWORD=example-password \
  -e MYSQL_DATABASE=myapp \
  mysql:8

# 애플리케이션 컨테이너를 실행합니다.
docker run -d \
  --name app \
  --network app-network \
  -p 8080:8080 \
  -e DB_HOST=db \
  my-app
```

여기서 `my-app`은 애플리케이션 코드로 미리 빌드해 둔 예시 이미지라고 가정합니다.  

실제 환경에서는 여기에 네트워크와 볼륨 설정도 추가될 수 있습니다.  

컨테이너가 많아질수록 다음과 같은 설정을 매번 명령으로 관리해야 합니다.  

* 사용할 이미지
* 컨테이너 이름
* 포트
* 환경 변수
* 볼륨
* 네트워크
* 컨테이너 사이의 의존 관계

Docker Compose를 사용하면 이러한 설정을 `compose.yaml` 파일에 선언할 수 있습니다.  

```yaml
services:
  app:
    image: my-app
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
    networks:
      - backend

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: "example-password"
      MYSQL_DATABASE: "myapp"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - backend

volumes:
  mysql-data:

networks:
  backend:
```

작성한 Compose 파일은 다음 명령으로 실행할 수 있습니다.  

```bash
docker compose up -d
```

즉 Docker Compose는 여러 개의 `docker run` 명령과 관련 설정을 **하나의 구성 파일로 관리할 수 있도록 해주는 도구**라고 이해하면 쉽습니다.  

## 2. Docker와 Docker Compose의 차이 {#session-02}

Docker와 Docker Compose는 서로 대체하는 기술이 아닙니다.  

Docker가 이미지, 컨테이너, 네트워크와 볼륨을 직접 생성하고 관리하는 기반이라면, Docker Compose는 이러한 Docker 리소스를 **여러 컨테이너로 구성된 하나의 애플리케이션 단위로 관리**합니다.  

간단하게 비교하면 다음과 같습니다.  

| 구분     | Docker            | Docker Compose      |
| ------ | ----------------- | ------------------- |
| 주요 목적  | 이미지와 컨테이너 생성 및 관리 | 여러 컨테이너의 구성과 실행 관리  |
| 대표 명령  | `docker run`      | `docker compose up` |
| 설정 방식  | CLI 옵션으로 직접 지정    | `compose.yaml`에 선언  |
| 관리 단위  | 개별 컨테이너           | 여러 서비스로 구성된 프로젝트    |
| 네트워크   | 직접 생성하고 연결        | Compose 파일에서 선언 가능  |
| 볼륨     | 명령어로 직접 연결        | Compose 파일에서 선언 가능  |
| 적합한 경우 | 단일 컨테이너 실행        | 여러 컨테이너를 함께 실행      |

예를 들어 애플리케이션과 MySQL을 같은 네트워크에서 실행한다고 가정합니다.  

Docker만 사용하면 먼저 네트워크를 만들고 각각의 컨테이너를 연결해야 합니다.  

앞의 Docker 명령 예제를 실행했다면 같은 컨테이너 이름을 다시 사용하기 전에 기존 컨테이너와 네트워크를 정리합니다.  

```bash
# 앞의 예제에서 만든 컨테이너와 네트워크를 제거합니다.
docker rm -f app db
docker network rm app-network
```

```bash
# 컨테이너가 사용할 네트워크를 생성합니다.
docker network create backend

# MySQL 컨테이너를 실행합니다.
docker run -d \
  --name db \
  --network backend \
  -e MYSQL_ROOT_PASSWORD=example-password \
  mysql:8

# 애플리케이션 컨테이너를 실행합니다.
docker run -d \
  --name app \
  --network backend \
  -p 8080:8080 \
  -e DB_HOST=db \
  my-app
```

Docker Compose를 사용하면 동일한 구성을 다음과 같이 작성할 수 있습니다.  

```yaml
services:
  app:
    image: my-app
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
    networks:
      - backend

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: "example-password"
    networks:
      - backend

networks:
  backend:
```

같은 Compose 네트워크에 연결된 서비스는 서로의 IP 주소를 직접 알 필요 없이 **서비스 이름을 호스트 이름처럼 사용할 수 있습니다.**

따라서 `app`에서는 데이터베이스의 주소를 다음과 같이 사용할 수 있습니다.  

```text
db:3306
```

여기서 `db`는 실제 컨테이너 IP 주소가 아니라 Compose에 정의한 서비스 이름입니다.  

Docker와 Compose의 관계를 간단히 표현하면 다음과 같습니다.  

```text
Docker
├── Image
├── Container
├── Volume
└── Network
      ▲
      │
      │ 구성 및 관리
      │
Docker Compose
└── compose.yaml
```

Docker Compose가 별도의 컨테이너 기술을 제공하는 것이 아니라 **Docker가 제공하는 여러 리소스를 하나의 애플리케이션 구성으로 묶어 관리하는 역할**을 합니다.  

## 3. compose.yaml 구성 이해하기 {#session-03}

Docker Compose에서는 애플리케이션 구성을 YAML 형식의 파일에 작성합니다.  

일반적으로 파일 이름은 `compose.yaml`을 사용합니다.  

```text
my-project/
├── compose.yaml
└── app/
    └── Dockerfile
```

다음은 애플리케이션과 MySQL을 함께 실행하는 기본적인 Compose 파일입니다.  

```yaml
services:
  app:
    build: ./app
    ports:
      - "8080:8080"
    environment:
      DB_HOST: db
      DB_NAME: myapp
    depends_on:
      - db
    networks:
      - backend

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: "example-password"
      MYSQL_DATABASE: "myapp"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - backend

volumes:
  mysql-data:

networks:
  backend:
```

전체 구조를 단순하게 보면 다음과 같습니다.  

```text
compose.yaml
│
├── services
│   ├── app
│   └── db
│
├── volumes
│   └── mysql-data
│
└── networks
    └── backend
```

### 🟦 services

`services`에는 애플리케이션을 구성하는 각각의 서비스를 정의합니다.  

```yaml
services:
  app:
    # app 서비스 설정

  db:
    # db 서비스 설정
```

여기서 `app`과 `db`는 각각 하나의 서비스입니다.  

서비스에는 어떤 이미지로 컨테이너를 만들고 어떤 포트, 환경 변수, 볼륨과 네트워크를 사용할지 정의할 수 있습니다.  

### 🟦 image

`image`는 컨테이너를 실행할 이미지를 지정합니다.  

```yaml
services:
  db:
    image: mysql:8
```

Docker 명령으로 표현하면 다음과 비슷합니다.  

```bash
# MySQL 초기화에 필요한 root 비밀번호를 전달합니다.
docker run --rm \
  -e MYSQL_ROOT_PASSWORD=example-password \
  mysql:8
```

### 🟦 build

직접 작성한 Dockerfile로 이미지를 빌드해야 하는 경우 `build`를 사용할 수 있습니다.  

```yaml
services:
  app:
    build: ./app
```

디렉터리가 다음과 같이 구성되어 있다면

```text
my-project/
├── compose.yaml
└── app/
    ├── Dockerfile
    └── ...
```

Compose는 `./app`을 빌드 컨텍스트로 사용해 이미지를 생성합니다.  

### 🟦 ports

`ports`는 호스트와 컨테이너의 포트를 연결합니다.  

```yaml
ports:
  - "8080:8080"
```

기본 형식은 다음과 같습니다.  

```text
호스트 포트:컨테이너 포트
```

따라서 위 설정에서는 호스트의 `8080` 포트로 들어온 요청이 컨테이너의 `8080` 포트로 전달됩니다.  

### 🟦 environment

`environment`는 컨테이너에서 사용할 환경 변수를 지정합니다.  

```yaml
environment:
  DB_HOST: db
  DB_NAME: myapp
```

`docker run`에서 `-e` 옵션을 사용하는 것과 비슷합니다.  

```bash
docker run \
  -e DB_HOST=db \
  -e DB_NAME=myapp \
  my-app
```

환경 변수에는 데이터베이스 주소, 애플리케이션 실행 환경과 같은 값을 전달할 수 있습니다.  

> 비밀번호와 API 키처럼 외부에 노출되면 안 되는 값은 Compose 파일에 직접 작성하기보다 별도의 환경 변수 관리 방식을 사용하는 것이 좋습니다.  

단순히 `.env` 파일로 옮기는 것만으로 비밀값이 암호화되지는 않습니다.  
운영 환경의 민감한 값은 Compose의 `secrets` 또는 별도의 비밀 관리 도구를 사용해 관리하는 것이 안전합니다.  

### 🟦 volumes

`volumes`는 컨테이너의 데이터를 컨테이너 외부에 저장하기 위해 사용합니다.  

```yaml
services:
  db:
    volumes:
      - mysql-data:/var/lib/mysql

volumes:
  mysql-data:
```

위 설정에서는 `mysql-data`라는 named volume을 MySQL의 `/var/lib/mysql`에 연결합니다.  

컨테이너는 삭제 후 다시 생성될 수 있기 때문에 데이터베이스와 같이 유지되어야 하는 데이터는 컨테이너 내부에만 저장하지 않는 것이 일반적입니다.  

구조를 단순하게 보면 다음과 같습니다.  

```text
MySQL Container
      │
      │ /var/lib/mysql
      ▼
 mysql-data Volume
```

따라서 MySQL 컨테이너를 다시 생성하더라도 동일한 볼륨을 연결하면 기존 데이터를 계속 사용할 수 있습니다.  

### 🟦 networks

`networks`는 서비스 사이의 통신에 사용할 Docker 네트워크를 정의합니다.  

여기서 `backend`는 Docker가 미리 정해 둔 예약어가 아니라 사용자가 목적에 맞게 붙인 네트워크 이름입니다.  
이 글에서는 애플리케이션과 데이터베이스가 내부적으로 통신하는 네트워크라는 의미로 사용합니다.  

```yaml
services:
  app:
    networks:
      - backend

  db:
    networks:
      - backend

networks:
  backend:
```

위 설정에서 `app`과 `db` 서비스는 모두 `backend` 네트워크에 연결됩니다.  

Compose가 네트워크를 생성할 때는 일반적으로 프로젝트 이름을 붙여 `<프로젝트명>_backend` 형태의 실제 이름을 사용합니다.  
같은 `backend` 네트워크에 연결된 컨테이너끼리만 이 네트워크를 통해 직접 통신할 수 있습니다.  

같은 네트워크에 연결된 서비스는 서비스 이름을 사용해 서로 통신할 수 있습니다.  

```text
app
 │
 │ DB_HOST=db
 ▼
db:3306
```

따라서 데이터베이스 컨테이너의 IP 주소를 직접 확인하거나 설정할 필요가 없습니다.  

다만 이름을 `backend`로 지정했다고 해서 외부 통신이 자동으로 차단되는 것은 아닙니다.  
외부 연결이 차단된 내부 전용 네트워크가 필요하다면 top-level `networks` 설정에 `internal: true`를 추가해야 합니다.  

네트워크를 여러 개로 나누어 서비스 간 통신 범위를 구분할 수도 있습니다.  

```yaml
services:
  web:
    image: nginx
    ports:
      - "80:80"
    networks:
      - frontend

  app:
    image: my-app
    networks:
      - frontend
      - backend

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: "example-password"
    networks:
      - backend

networks:
  frontend:
  backend:
```

이 구성에서는 `web`과 `app`이 `frontend` 네트워크로 통신하고, `app`과 `db`는 `backend` 네트워크로 통신합니다.  

`web`과 `db`는 같은 네트워크에 연결되어 있지 않으므로 서로 직접 통신할 수 없습니다.  

호스트의 요청이 `web` 컨테이너로 전달되는 것은 `ports` 설정의 역할이며, `frontend` 네트워크는 컨테이너 사이의 통신 범위를 구분합니다.  

```text
         Host
          │
         :80
          │
     ┌────▼────┐
     │   web   │
     └────┬────┘
          │
      frontend
          │
     ┌────▼────┐
     │   app   │
     └────┬────┘
          │
       backend
          │
     ┌────▼────┐
     │    db   │
     └─────────┘
```

다만 별도의 `networks` 설정을 작성하지 않아도 Compose는 프로젝트를 위한 기본 네트워크를 자동으로 생성합니다.  

예를 들어 다음 Compose 파일에서도 `app`과 `db`는 기본 네트워크를 통해 서로 통신할 수 있습니다.  

```yaml
services:
  app:
    image: my-app

  db:
    image: mysql:8
```

따라서 `networks`는 항상 작성해야 하는 설정은 아니며, 네트워크 이름을 명시하거나 서비스별 통신 범위를 나누고 싶을 때 활용할 수 있습니다.  

### 🟦 depends_on

`depends_on`은 서비스 사이의 실행 의존 관계를 정의합니다.  

```yaml
services:
  app:
    depends_on:
      - db
```

위 구성에서는 `app` 서비스보다 `db` 서비스를 먼저 시작하도록 Compose에 의존 관계를 알려줍니다.  

하지만 단순한 `depends_on`만으로 데이터베이스가 실제 요청을 처리할 준비까지 완료되었다고 판단해서는 안 됩니다.  

예를 들어 MySQL 컨테이너가 시작되었더라도 내부 데이터베이스 초기화가 끝나기까지 시간이 필요할 수 있습니다.  

애플리케이션이 데이터베이스의 실제 준비 상태를 확인해야 한다면 `healthcheck`와 같은 설정을 함께 사용하는 방법을 고려할 수 있습니다.  

다음과 같이 `service_healthy` 조건을 지정하면 `db`의 상태 검사가 통과한 뒤 `app` 서비스를 시작할 수 있습니다.  

```yaml
services:
  app:
    image: my-app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: "example-password"
    healthcheck:
      # 실제 TCP 접속과 쿼리가 성공해야 준비 완료로 판단합니다.
      # $$는 MYSQL_ROOT_PASSWORD를 컨테이너 안에서 참조하도록 합니다.
      test: ["CMD-SHELL", "MYSQL_PWD=\"$${MYSQL_ROOT_PASSWORD}\" mysql --protocol=tcp -h 127.0.0.1 -u root -e \"SELECT 1\""]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

### 🟦 compose.yaml의 핵심 구성

지금까지 살펴본 내용을 정리하면 다음과 같습니다.  

| 항목            | 역할                     |
| ------------- | ---------------------- |
| `services`    | 실행할 서비스와 컨테이너 설정 정의    |
| `image`       | 사용할 Docker 이미지 지정      |
| `build`       | Dockerfile을 이용한 이미지 빌드 |
| `ports`       | 호스트와 컨테이너 포트 연결        |
| `environment` | 컨테이너 환경 변수 설정          |
| `volumes`     | 컨테이너 데이터 저장소 연결        |
| `networks`    | 서비스 사이의 통신 네트워크 구성     |
| `depends_on`  | 서비스 사이의 실행 의존 관계 정의    |

### 🟦 일반 구성 예시: 웹 애플리케이션과 데이터베이스

앞에서 살펴본 설정을 실제 형태로 연결하기 위해 웹 애플리케이션과 MySQL을 함께 실행하는 Compose 파일을 살펴보겠습니다.  

프로젝트 디렉터리는 다음과 같이 구성합니다.  

```text
web-app/
├── compose.yaml
├── .env
└── app/
    ├── Dockerfile
    └── ...
```

`app` 디렉터리에는 컨테이너로 실행할 애플리케이션 코드와 Dockerfile이 있다고 가정합니다.  
이 예제의 애플리케이션은 컨테이너의 `8080` 포트에서 실행되고, 환경 변수로 MySQL 접속 정보를 받습니다.  

이 예제는 특정 프로그래밍 언어나 프레임워크의 구현보다 Compose 설정 사이의 관계를 설명하는 데 목적이 있습니다.  
직접 실행하려면 위 조건에 맞는 애플리케이션 코드와 Dockerfile을 `app` 디렉터리에 먼저 준비해야 합니다.  

비밀번호처럼 환경마다 달라지는 값은 `.env` 파일에 작성합니다.  

```dotenv
MYSQL_ROOT_PASSWORD=change-root-password
MYSQL_PASSWORD=change-app-password
```

> `.env`는 값을 Compose 파일과 분리할 뿐 암호화하지 않습니다.  
> `.gitignore`에 등록하고, 운영 환경에서는 별도의 비밀 관리 방법을 사용하는 것이 안전합니다.  

다음은 `app`과 `db` 서비스를 정의한 `compose.yaml`입니다.  

```yaml
# 이 파일로 생성할 Compose 프로젝트의 이름입니다.
name: web-app

# 실행할 컨테이너 단위의 서비스를 정의합니다.
services:
  app:
    # ./app을 빌드 컨텍스트로 사용해 Dockerfile의 이미지를 만듭니다.
    build:
      context: ./app

    # 사용자가 직접 중지하지 않았다면 오류나 Docker 재시작 후 다시 실행합니다.
    restart: unless-stopped

    # 호스트의 8080 포트를 컨테이너의 8080 포트로 전달합니다.
    ports:
      - "8080:8080"

    # 애플리케이션 컨테이너에 데이터베이스 접속 정보를 전달합니다.
    environment:
      DB_HOST: db
      DB_PORT: "3306"
      DB_NAME: myapp
      DB_USER: appuser
      DB_PASSWORD: "${MYSQL_PASSWORD}"

    # db의 상태 검사가 통과한 뒤 app을 시작합니다.
    depends_on:
      db:
        condition: service_healthy

    # app과 db가 통신할 사용자 정의 네트워크에 연결합니다.
    networks:
      - backend

  db:
    # 직접 빌드하지 않고 Docker Hub의 MySQL 이미지를 사용합니다.
    image: mysql:8
    restart: unless-stopped

    # .env의 비밀번호와 초기 데이터베이스 정보를 MySQL에 전달합니다.
    environment:
      MYSQL_ROOT_PASSWORD: "${MYSQL_ROOT_PASSWORD}"
      MYSQL_DATABASE: myapp
      MYSQL_USER: appuser
      MYSQL_PASSWORD: "${MYSQL_PASSWORD}"

    # 컨테이너를 다시 만들어도 데이터가 유지되도록 named volume을 연결합니다.
    volumes:
      - db-data:/var/lib/mysql

    # 실제 TCP 접속과 쿼리가 성공하는지 확인합니다.
    healthcheck:
      # $$는 MYSQL_ROOT_PASSWORD를 컨테이너 안에서 참조하도록 합니다.
      test: ["CMD-SHELL", "MYSQL_PWD=\"$${MYSQL_ROOT_PASSWORD}\" mysql --protocol=tcp -h 127.0.0.1 -u root -e \"SELECT 1\""]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    # 호스트에 포트를 게시하지 않고 app과 같은 backend 네트워크에 연결합니다.
    networks:
      - backend

# services에서 연결한 named volume을 프로젝트 리소스로 선언합니다.
volumes:
  db-data:

# app과 db가 함께 사용할 사용자 정의 네트워크를 선언합니다.
networks:
  backend:
    driver: bridge
```

Compose 파일은 다음과 같은 관계로 읽으면 이해하기 쉽습니다.  

```text
web-app 프로젝트
│
├── app 서비스
│   ├── ./app의 Dockerfile로 이미지 빌드
│   ├── 호스트의 8080 포트 공개
│   └── backend 네트워크에서 db에 접속
│
├── db 서비스
│   ├── mysql:8 이미지 사용
│   ├── db-data volume에 데이터 저장
│   └── 준비 상태를 healthcheck로 확인
│
├── db-data volume
└── backend network
```

`DB_HOST`에는 IP 주소가 아니라 Compose 서비스 이름인 `db`를 사용합니다.  
두 서비스가 같은 `backend` 네트워크에 연결되어 있으므로 Docker의 내부 DNS가 `db`를 현재 데이터베이스 컨테이너 주소로 해석합니다.  

`app`의 `ports`는 호스트에서 애플리케이션으로 들어오는 연결을 처리합니다.  
반면 `db`에는 `ports`가 없으므로 Compose가 MySQL 포트를 호스트에 게시하지 않습니다.  
`app`은 같은 `backend` 네트워크를 통해 `db`에 접속합니다.  
다만 포트를 게시하지 않는 것만으로 호스트를 포함한 모든 외부 접근이 차단된다고 단정해서는 안 됩니다.  

서비스 아래의 `volumes`는 컨테이너에 무엇을 연결할지 지정하고, top-level `volumes`는 named volume 자체를 Compose 프로젝트의 리소스로 선언합니다.  
네트워크도 서비스 아래에서는 연결 대상을 지정하고, top-level에서는 네트워크의 이름과 드라이버 같은 속성을 정의합니다.  

YAML에 서비스를 작성한 순서는 컨테이너의 준비 완료 순서를 보장하지 않습니다.  
이 예제에서는 `db`의 `healthcheck`가 성공한 뒤 `app`을 시작하도록 `depends_on.condition`에 `service_healthy`를 지정했습니다.  

결국 `compose.yaml`은 단순히 여러 컨테이너를 실행하는 파일이 아니라 **애플리케이션을 구성하는 서비스, 저장소와 네트워크 구조를 코드로 표현하는 파일**이라고 볼 수 있습니다.  

## 4. Docker Compose 실행과 주요 명령어 {#session-04}

3절에서 웹 애플리케이션과 MySQL을 정의한 `compose.yaml`을 작성했습니다.  
이 절에서는 같은 파일을 검증하고 실행한 뒤 상태를 확인하고 종료하는 과정을 이어서 살펴봅니다.  

다음 명령을 실행하려면 3절에서 설명한 애플리케이션 코드, Dockerfile과 `.env` 파일이 준비되어 있어야 합니다.  

### 🟦 구성 확인 및 서비스 실행

먼저 `compose.yaml`이 있는 `web-app` 디렉터리에서 다음 명령을 실행합니다.  

```bash
# YAML 문법, 환경 변수 치환과 실제 적용될 구성을 확인합니다.
docker compose config
```

`docker compose config` 결과에는 `.env`에서 치환한 비밀번호가 표시될 수 있으므로 출력 내용을 외부에 공유할 때 주의해야 합니다.  

오류가 없다면 애플리케이션 이미지를 빌드하고 서비스를 백그라운드에서 실행합니다.  

```bash
# app 이미지를 빌드한 뒤 app과 db 서비스를 실행합니다.
docker compose up -d --build

# 각 서비스와 컨테이너의 상태를 확인합니다.
docker compose ps
```

`docker compose up`처럼 `-d` 없이 실행하면 터미널에서 전체 서비스의 로그를 바로 확인할 수 있습니다.  

### 🟦 로그 확인

전체 서비스의 로그를 확인하려면 다음 명령을 사용합니다.  

```bash
docker compose logs
```

`-f` 옵션을 사용하면 새 로그를 실시간으로 계속 확인할 수 있습니다.  

```bash
docker compose logs -f
```

서비스 이름을 마지막에 지정하면 특정 서비스의 로그만 확인할 수 있습니다.  

```bash
# app 서비스의 로그만 실시간으로 확인합니다.
docker compose logs -f app
```

### 🟦 실행 중인 컨테이너에서 명령 실행

`docker compose exec`는 실행 중인 특정 서비스의 컨테이너 안에서 명령을 실행합니다.  

```bash
# app 이미지에 sh가 포함되어 있다면 컨테이너에서 셸을 실행합니다.
docker compose exec app sh
```

여기서 `app`은 컨테이너 이름이 아니라 Compose 파일에 정의한 서비스 이름입니다.  
경량 또는 distroless 이미지처럼 `sh`가 없는 이미지에서는 애플리케이션에 포함된 다른 실행 명령을 지정해야 합니다.  
셸을 종료하려면 `exit`를 입력합니다.  

### 🟦 서비스 중지

컨테이너를 삭제하지 않고 중지만 하려면 다음 명령을 사용합니다.  

```bash
docker compose stop
```

중지한 컨테이너는 다시 실행할 수 있습니다.  

```bash
docker compose start
```

### 🟦 서비스 종료 및 제거

Compose로 만든 컨테이너와 네트워크를 종료하고 제거하려면 `down`을 사용합니다.  

```bash
docker compose down
```

`stop`과 `down`은 비슷해 보이지만 동작이 다릅니다.  

```text
docker compose stop
        │
        └─ 컨테이너 중지
           컨테이너는 유지

docker compose down
        │
        ├─ 컨테이너 중지
        ├─ 컨테이너 제거
        └─ Compose 네트워크 제거
```

named volume은 기본적인 `docker compose down`만으로 제거되지 않습니다.  
따라서 컨테이너를 다시 생성해도 `db-data`에 저장된 MySQL 데이터를 이어서 사용할 수 있습니다.  

볼륨까지 함께 삭제하려면 `-v` 옵션을 사용합니다.  

```bash
docker compose down -v
```

> `docker compose down -v`를 실행하면 `db-data`와 그 안의 데이터베이스 데이터가 삭제되므로 주의해야 합니다.  

단, `external: true`로 선언한 외부 볼륨과 외부 네트워크는 Compose 프로젝트 밖에서 관리하므로 `down -v`로 삭제되지 않습니다.  

### 🟦 이미지 빌드

`build`가 정의된 `app` 서비스의 이미지만 미리 빌드하려면 다음 명령을 사용합니다.  

```bash
docker compose build app
```

애플리케이션 소스나 Dockerfile을 변경한 뒤에는 다음 명령으로 이미지를 다시 빌드하면서 서비스를 실행할 수 있습니다.  

```bash
docker compose up -d --build
```

자주 사용하는 명령을 정리하면 다음과 같습니다.  

| 명령어                            | 설명                     |
| ------------------------------ | ---------------------- |
| `docker compose up`            | 서비스를 생성하고 실행           |
| `docker compose up -d`         | 서비스를 백그라운드에서 실행        |
| `docker compose up -d --build` | 이미지 빌드 후 백그라운드 실행      |
| `docker compose config`        | Compose 파일 검증 및 적용 구성 확인 |
| `docker compose ps`            | 서비스 상태 확인              |
| `docker compose logs`          | 서비스 로그 확인              |
| `docker compose logs -f`       | 서비스 로그를 실시간으로 확인       |
| `docker compose stop`          | 컨테이너를 삭제하지 않고 중지       |
| `docker compose start`         | 중지한 컨테이너 다시 시작         |
| `docker compose down`          | 컨테이너와 Compose 네트워크 제거  |
| `docker compose down -v`       | 컨테이너, 네트워크와 볼륨 제거      |
| `docker compose build`         | 서비스 이미지 빌드             |
| `docker compose exec`          | 실행 중인 서비스 컨테이너에서 명령 실행 |

Docker Compose를 사용한다고 해서 Docker 대신 다른 방식으로 컨테이너를 실행하는 것은 아닙니다.  

Docker가 **이미지, 컨테이너, 볼륨과 네트워크를 제공하는 기반 기술**이라면 Docker Compose는 그 위에서 **여러 Docker 리소스를 하나의 애플리케이션 구성으로 정의하고 관리하는 도구**입니다.  

단일 컨테이너를 간단하게 실행한다면 `docker run`만으로 충분할 수 있습니다.  

반면 애플리케이션 서버, 데이터베이스와 캐시처럼 여러 컨테이너가 함께 필요한 환경에서는 Compose를 사용하면 포트, 환경 변수, 볼륨과 네트워크 설정을 하나의 파일로 관리할 수 있습니다.  

또한 동일한 `compose.yaml` 파일을 사용하면 개발자마다 긴 `docker run` 명령을 따로 관리할 필요 없이 비교적 동일한 구성을 반복해서 만들 수 있습니다.  

Docker와 Docker Compose의 역할은 다음과 같이 정리할 수 있습니다.  

```text
Docker
= 이미지와 컨테이너 등의 리소스를 생성하고 실행한다.

Docker Compose
= 여러 Docker 리소스를 하나의 애플리케이션으로 정의하고 관리한다.
```
