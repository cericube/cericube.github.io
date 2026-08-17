---
layout: post
title: "[Docker]2편. Ubuntu에 Docker 설치 및 sudo 없이 사용하기"
description: "Ubuntu에 Docker 공식 저장소를 등록해 Docker Engine을 설치하고, 서비스 자동 시작과 sudo 없이 사용하는 방법을 단계별로 알아봅니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. 기존 Docker 패키지 제거"
  - id: session-02
    title: "2. Docker GPG 키 추가"
  - id: session-03
    title: "3. Docker 저장소 추가"
  - id: session-04
    title: "4. Docker 설치 및 테스트"
  - id: session-05
    title: "5. Docker 서비스 활성화"
  - id: session-06
    title: "6. sudo 없이 Docker 사용하기"
  - id: session-07
    title: "7. Docker 업그레이드 및 제거"
---

Ubuntu에서 Docker를 설치하고, `sudo` 없이 편리하게 사용하는 방법까지 단계별로 안내합니다.  
기존 패키지 제거, GPG 키 등록, 저장소 설정과 서비스 실행 등 핵심 과정을 모두 포함합니다.  

## 1. 기존 Docker 패키지 제거 {#session-01}

기존 시스템에 설치된 Docker 관련 패키지 중 Docker 공식 패키지와 충돌할 수 있는 패키지를 제거합니다.  

```bash
# Docker 공식 패키지와 충돌할 수 있는 패키지를 차례로 제거합니다.
for pkg in \
  docker.io \
  docker-doc \
  docker-compose \
  docker-compose-v2 \
  docker-buildx \
  podman-docker \
  containerd \
  runc
do
  sudo apt remove "$pkg"
done
```

필요한 경우 남아 있는 Docker 데이터도 완전히 삭제할 수 있습니다.  

> 다음 명령은 기존 이미지, 컨테이너와 볼륨 데이터를 삭제하므로 필요한 데이터를 먼저 백업해야 합니다.

```bash
# Docker와 containerd의 기존 데이터를 모두 삭제합니다.
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
```

## 2. Docker GPG 키 추가 {#session-02}

Ubuntu에서 소프트웨어를 설치할 때는 해당 패키지가 신뢰할 수 있는 출처에서 제공되었는지 확인하는 과정이 필요합니다.  
이를 위해 GPG(GNU Privacy Guard) 키를 사용해 저장소 메타데이터의 서명을 검증합니다.  
Docker가 제공하는 공식 GPG 키를 시스템에 등록하면 공식 저장소에서 받은 패키지를 검증할 수 있습니다.  

```bash
# 저장소 등록에 필요한 인증서와 curl을 설치합니다.
sudo apt update
sudo apt install ca-certificates curl

# Docker의 공식 GPG 키를 저장할 디렉터리를 만들고 키를 내려받습니다.
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

## 3. Docker 저장소 추가 {#session-03}

Ubuntu 기본 저장소의 Docker 패키지는 Docker가 직접 제공하는 공식 패키지와 버전이나 구성 방식이 다를 수 있으므로 Docker 공식 저장소를 따로 등록합니다.  
이렇게 하면 이후 `apt install` 명령으로 Docker 공식 저장소의 안정 버전을 설치하고 유지 관리할 수 있습니다.  

```bash
# 현재 Ubuntu 버전과 시스템 아키텍처에 맞는 Docker 저장소를 등록합니다.
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 새로 등록한 저장소의 패키지 목록을 가져옵니다.
sudo apt update
```

## 4. Docker 설치 및 테스트 {#session-04}

Docker와 함께 필요한 구성 요소를 설치합니다.  
다음 명령으로 Docker Engine, 명령줄 도구, 컨테이너 런타임, Buildx와 Compose 플러그인을 설치할 수 있습니다.  

```bash
# Docker Engine과 주요 플러그인을 설치합니다.
sudo apt install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

설치가 완료되면 다음 테스트 명령으로 Docker가 정상적으로 동작하는지 확인합니다.  
명령을 실행하면 테스트 이미지를 내려받아 컨테이너로 실행한 뒤 확인 메시지를 출력하고 종료합니다.  

```bash
# hello-world 컨테이너를 실행해 설치 상태를 확인합니다.
sudo docker run hello-world
```

![Docker hello-world 컨테이너 실행 결과](/assets/images/system-infra/system-infra-virtualization/docker-hello-world-output.png)

## 5. Docker 서비스 활성화 {#session-05}

Docker는 서비스(데몬)로 동작합니다.  
Ubuntu에서는 Docker Engine 패키지를 설치하면 일반적으로 Docker 서비스가 부팅 시 자동으로 시작되지만, 다음 명령으로 자동 시작 설정을 명시적으로 활성화할 수 있습니다.  

```bash
# 부팅할 때 Docker와 containerd가 자동으로 시작되도록 설정합니다.
sudo systemctl enable docker.service
sudo systemctl enable containerd.service
```

자동 시작을 해제하려면 다음과 같이 `disable` 명령을 별도로 실행합니다.  

```bash
# Docker와 containerd의 부팅 시 자동 시작을 해제합니다.
sudo systemctl disable docker.service
sudo systemctl disable containerd.service
```

Docker 서비스를 즉시 시작하면서 자동 시작도 함께 활성화하려면 다음 명령을 사용할 수 있습니다.  

```bash
# Docker 서비스를 지금 시작하고 부팅 시 자동으로 시작되도록 설정합니다.
sudo systemctl enable --now docker
```

## 6. sudo 없이 Docker 사용하기 {#session-06}

기본 설정에서는 Docker 명령을 사용할 때마다 `sudo`를 입력해야 합니다.  
현재 사용자를 `docker` 그룹에 추가하면 `sudo` 없이 Docker를 사용할 수 있습니다.  

> `docker` 그룹의 사용자는 Docker 데몬을 통해 호스트에서 루트 수준의 권한을 행사할 수 있으므로 신뢰할 수 있는 사용자만 추가해야 합니다.

```bash
# usermod의 -aG 옵션은 기존 그룹을 유지하면서 사용자를 docker 그룹에 추가합니다.
sudo usermod -aG docker "$USER"

# 로그아웃하지 않고 docker 그룹이 적용된 새 셸을 시작합니다.
newgrp docker
```

## 7. Docker 업그레이드 및 제거 {#session-07}

### 🟦 Docker 업그레이드

Docker는 일반 패키지와 마찬가지로 다음 명령으로 저장소에 등록된 최신 버전으로 업그레이드할 수 있습니다.  

```bash
# 패키지 목록을 갱신한 뒤 Docker 구성 요소를 업그레이드합니다.
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

### 🟦 Docker 제거

다음 명령은 Docker 프로그램과 주요 데이터, 이 글에서 등록한 저장소 정보를 삭제합니다.  

> `/var/lib/docker`와 `/var/lib/containerd`를 삭제하면 기존 이미지, 컨테이너와 볼륨 데이터를 복구하기 어려우므로 필요한 데이터를 먼저 백업해야 합니다.

```bash
# Docker Engine과 관련 플러그인을 제거합니다.
sudo apt purge docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras

# Docker 데이터와 이 글에서 등록한 저장소 정보를 삭제합니다.
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd
sudo rm /etc/apt/sources.list.d/docker.list
sudo rm /etc/apt/keyrings/docker.asc
```

직접 만든 `/etc/docker`의 설정 파일이나 사용자 홈의 `.docker` 디렉터리 등은 남을 수 있으므로, 필요한 경우 내용을 확인한 후 별도로 삭제합니다.  

Docker는 가상 머신보다 일반적으로 적은 자원을 사용하고 빠르게 시작할 수 있어 개발과 배포 환경 구성에 유용합니다.  
