---
layout: post
title: "[Docker]3편. Docker와 방화벽(UFW, firewalld) 설정 시 주의사항과 해결 방법"
description: "Linux에서 Docker가 UFW와 firewalld의 방화벽 규칙에 미치는 영향을 살펴보고, DOCKER-USER 체인으로 컨테이너 트래픽을 제어하는 방법을 알아봅니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker와 방화벽이 충돌하는 이유"
  - id: session-02
    title: "2. Docker와 UFW 호환성 문제"
  - id: session-03
    title: "3. UFW 우회 문제 해결 방법(DOCKER-USER 체인 사용)"
  - id: session-04
    title: "4. Docker와 firewalld의 동작 방식"
---

Docker를 Ubuntu 또는 CentOS 같은 Linux 시스템에서 사용할 때 UFW 또는 firewalld의 방화벽 설정이 예상대로 적용되지 않을 수 있습니다.  
이 글에서는 그 원인과 해결 방법을 설명합니다.  

## 1. Docker와 방화벽이 충돌하는 이유 {#session-01}

Docker는 기본적으로 Linux 커널의 `iptables`를 사용해 포트 포워딩과 네트워크 연결에 필요한 규칙을 설정합니다.  
Ubuntu의 UFW, CentOS와 RHEL의 firewalld 같은 방화벽 도구도 `iptables` 또는 nftables 규칙을 관리하므로 Docker가 추가한 규칙과 함께 사용할 때 예상과 다르게 동작할 수 있습니다.  
특히 Docker가 포트 게시를 위해 패킷을 전달하면 다른 방화벽 도구에서 설정한 규칙을 우회하는 것처럼 보일 수 있습니다.  

### 🟦 iptables의 두 가지 방식

- **iptables-nft**: nftables를 백엔드로 사용하는 `iptables` 호환 방식이며, 최신 Linux 배포판에서 주로 사용합니다.
- **iptables-legacy**: 기존 xtables 기반의 전통적인 `iptables` 방식입니다.

Docker의 `iptables` 방화벽 백엔드는 `iptables-nft`와 `iptables-legacy`를 모두 지원하므로 `iptables-legacy`가 항상 더 호환성이 높은 것은 아닙니다.  

## 2. Docker와 UFW 호환성 문제 {#session-02}

UFW(Uncomplicated Firewall)는 Ubuntu에서 제공하는 간단한 방화벽 관리 도구입니다.  
그러나 Docker와 UFW는 방화벽 규칙을 처리하는 방식이 달라 UFW 규칙이 Docker에서 게시한 포트에 적용되지 않을 수 있습니다.  
예를 들어 다음과 같이 UFW에서 8080 포트를 차단합니다.  

```bash
# UFW에서 8080 포트로 들어오는 연결을 차단합니다.
sudo ufw deny 8080
```

Docker 컨테이너가 호스트의 8080 포트를 게시하고 있다면 외부에서 해당 포트에 계속 접근할 수 있습니다.  

### 🟦 외부에서 접근할 수 있는 이유

- UFW는 주로 `INPUT`과 `OUTPUT` 체인을 통해 호스트의 포트 접근을 제어합니다.
- Docker는 `nat` 테이블과 `FORWARD`, `DOCKER` 등의 체인을 사용해 게시된 포트의 트래픽을 컨테이너로 전달합니다.
- 컨테이너 트래픽은 UFW의 `INPUT`과 `OUTPUT` 체인에 도달하기 전에 전달될 수 있어 UFW 설정이 적용되지 않는 것처럼 보입니다.

### 🟦 동작 예시

- UFW는 `INPUT` 체인에서 8080 포트를 차단합니다.
- Docker는 `DOCKER` 체인을 통해 호스트의 8080 포트를 컨테이너 내부 IP(예: `172.17.0.2`)와 포트로 전달합니다.
- 이 과정에서 외부 연결이 UFW의 차단 규칙을 거치지 않아 접속할 수 있습니다.

![Docker 포트 전달과 UFW 규칙의 처리 흐름](/assets/images/system-infra/system-infra-virtualization/docker-ufw-iptables-flow.png)

## 3. UFW 우회 문제 해결 방법(DOCKER-USER 체인 사용) {#session-03}

이 방법은 UFW 대신 `iptables` 명령으로 Docker 컨테이너의 전달 트래픽을 제어합니다.  
Docker의 `iptables` 방화벽 백엔드를 사용할 때는 `DOCKER-USER` 체인에 사용자 규칙을 추가할 수 있습니다.  
이 체인의 규칙은 Docker가 만든 전달 규칙보다 먼저 처리됩니다.  

> Docker의 실험적인 nftables 방화벽 백엔드에는 `DOCKER-USER` 체인이 없으므로 이 방법을 그대로 사용할 수 없습니다.

### 🟦 예: 컨테이너의 8080 포트 차단

```bash
# DNAT 이후 목적지 포트가 8080인 컨테이너 전달 트래픽을 차단합니다.
sudo iptables -I DOCKER-USER -p tcp --dport 8080 -j DROP
```

이 명령은 `DOCKER-USER` 체인의 가장 앞에 TCP 목적지 포트 8080을 차단하는 규칙을 추가합니다.  
`DOCKER-USER` 체인에 도달한 패킷은 이미 DNAT 처리를 거쳤으므로 `--dport 8080`은 컨테이너 내부의 목적지 포트가 8080일 때 일치합니다.  
호스트의 게시 포트와 컨테이너 포트가 다르면 원래 게시 포트를 기준으로 필터링하기 위해 `conntrack` 조건이 필요합니다.  
이 규칙은 포트 8080으로 전달되는 다른 트래픽에도 영향을 줄 수 있으므로 실제 환경에서는 외부 인터페이스와 출발지 등 조건을 함께 검토해야 합니다.  
또한 이 명령으로 추가한 규칙은 일반적으로 재부팅 후 유지되지 않으므로 계속 사용하려면 운영체제에 맞는 방식으로 방화벽 규칙을 저장해야 합니다.  

## 4. Docker와 firewalld의 동작 방식 {#session-04}

firewalld는 RHEL, CentOS와 Fedora 등에서 주로 사용하는 동적 방화벽 관리 도구입니다.  
Docker는 firewalld가 활성화된 환경에서 다음과 같은 방식으로 네트워크 규칙을 구성합니다.  

### 🟦 동작 방식 요약

- Docker는 자동으로 `docker`라는 존(zone)을 만들고 대상(target)을 `ACCEPT`로 설정합니다.
- `docker0`, `br-xxxx` 등 Docker가 만든 브리지 네트워크 인터페이스는 `docker` 존에 포함됩니다.
- Docker는 모든 존에서 `docker` 존으로의 전달을 허용하는 `docker-forwarding` 정책을 만듭니다.
- 외부에서 접근할 수 있는 범위는 컨테이너의 포트 게시 설정과 Docker가 생성한 방화벽 규칙에도 영향을 받습니다.

firewalld를 사용하는 환경에서는 Docker가 네트워크 규칙을 자동으로 설정하지만, 보안 요구 사항에 따라 `docker` 존과 전달 정책을 확인하고 조정해야 할 수 있습니다.  

Docker는 컨테이너 네트워크를 자동으로 설정해 주는 편리한 도구입니다.  
하지만 UFW 또는 firewalld와 함께 사용할 때는 Docker가 게시한 포트의 트래픽이 기존 방화벽 정책과 다르게 처리될 수 있습니다.  
UFW 환경에서 게시된 컨테이너 포트를 제한해야 한다면 `DOCKER-USER` 체인 등을 이용해 전달 트래픽을 별도로 제어할 수 있습니다.  
firewalld 환경에서는 Docker가 만든 존과 포워딩 정책을 확인하는 것이 좋습니다.  