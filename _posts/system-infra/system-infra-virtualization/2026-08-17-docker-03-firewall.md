---
layout: post
title: "[Docker]3편. Docker 포트 게시와 UFW·firewalld 동작 방식"
description: "Linux에서 Docker가 컨테이너 포트를 게시할 때 UFW와 firewalld의 규칙이 어떻게 처리되는지 살펴보고, 서비스 공개 범위를 확인할 때 주의할 점을 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. Docker가 방화벽 규칙을 추가하는 이유"
  - id: session-02
    title: "2. Docker 포트 게시와 UFW"
  - id: session-03
    title: "3. Docker와 firewalld의 동작 방식"
---

Docker의 기본 방화벽 설정에서 컨테이너 포트를 게시하면 UFW나 firewalld에서 해당 포트를 따로 허용하지 않아도 외부에서 접근할 수 있습니다.  
이 글에서는 Docker의 포트 게시와 Linux 방화벽 규칙이 어떤 관계인지 알아봅니다.  

## 1. Docker가 방화벽 규칙을 추가하는 이유 {#session-01}

Docker는 컨테이너의 브리지 네트워크와 포트 게시 기능을 구현하기 위해 Linux의 `iptables` 또는 nftables에 필요한 규칙을 추가합니다.  
`-p` 옵션은 `호스트_포트:컨테이너_포트` 형식으로 사용하며, 두 포트는 같거나 다를 수 있습니다.  
예를 들어 다음 명령은 호스트의 8080 포트로 들어온 요청을 컨테이너의 80 포트로 전달합니다.  

```bash
# 호스트의 모든 네트워크 인터페이스에서 8080 포트를 게시합니다.
docker run -d -p 8080:80 nginx
```

호스트 IP를 생략하고 `-p 8080:80`처럼 지정하면 기본적으로 모든 호스트 네트워크 인터페이스에 포트가 게시됩니다.  
외부 요청은 Docker가 추가한 DNAT와 전달 규칙을 거쳐 컨테이너로 이동합니다.  

UFW와 firewalld도 같은 netfilter 체계에 규칙을 추가하지만, Docker와 사용하는 체인과 처리 경로가 다를 수 있습니다.  
이 차이 때문에 일반적인 호스트 방화벽 규칙이 게시된 컨테이너 포트에 기대한 대로 적용되지 않을 수 있습니다.  

외부 공개가 필요하지 않다면 포트를 게시하지 않거나 다음과 같이 호스트의 루프백 주소에만 연결할 수 있습니다.  

```bash
# 호스트 자신만 8080 포트에 접근할 수 있도록 게시 주소를 제한합니다.
docker run -d -p 127.0.0.1:8080:80 nginx
```

## 2. Docker 포트 게시와 UFW {#session-02}

UFW(Uncomplicated Firewall)는 Ubuntu에서 제공하는 간단한 방화벽 관리 도구입니다.  
UFW는 호스트로 직접 들어오는 트래픽을 주로 `INPUT` 체인에서 제어하지만, Docker 게시 포트의 트래픽은 다른 경로로 처리됩니다.  
다음 그림의 위쪽은 일반 호스트 서비스로 들어오는 요청을, 아래쪽은 Docker 컨테이너로 전달되는 요청을 보여 줍니다.  

![UFW와 Docker가 사용하는 netfilter 처리 경로 비교](/assets/images/system-infra/system-infra-virtualization/image-2026-08-17.png)

### 🟦 일반 호스트 서비스의 처리 경로

- 외부 요청이 호스트에서 직접 실행 중인 서비스의 포트에 도착합니다.  
- 요청이 `INPUT` 체인을 거치므로 UFW의 허용 또는 차단 규칙이 적용됩니다.  

### 🟦 Docker 게시 포트의 처리 경로

- 외부 요청이 호스트의 게시 포트에 도착합니다.  
- Docker의 NAT 규칙이 DNAT를 수행해 요청의 목적지를 컨테이너 IP와 포트로 변경합니다.  
- 변경된 요청이 일반적인 `INPUT` 경로가 아니라 `FORWARD`와 Docker 관련 체인을 거쳐 컨테이너로 전달됩니다.  

이처럼 두 요청은 처리 경로가 다르므로 UFW의 일반적인 포트 차단 규칙이 Docker에서 게시한 컨테이너 포트에 바로 적용되지 않을 수 있습니다.  

예를 들어 다음과 같이 UFW에서 8080 포트를 차단해도 Docker가 같은 포트를 게시하면 외부에서 계속 접근할 수 있습니다.  

```bash
# UFW에서 8080 포트로 들어오는 연결을 차단합니다.
sudo ufw deny 8080
```

다음 그림은 UFW의 8080 차단 규칙과 Docker의 컨테이너 포트 허용 규칙이 함께 존재하는 상황을 단순화해 보여 줍니다.  
UFW의 차단 규칙이 있더라도 요청이 Docker의 전달 경로를 사용하면 컨테이너의 게시 포트에 접근할 수 있습니다.  

![UFW의 8080 차단 규칙과 Docker의 컨테이너 포트 허용 규칙 비교](/assets/images/system-infra/system-infra-virtualization/docker-ufw-iptables-flow.png)

이 동작은 Docker가 UFW를 고장 내는 것이 아니라 게시된 포트를 컨테이너로 전달하는 과정에서 발생합니다.  
외부에 서비스를 공개하려고 포트를 게시했다면 정상적인 동작이지만, UFW의 차단 규칙만 보고 접근이 제한됐다고 판단해서는 안 됩니다.  

## 3. Docker와 firewalld의 동작 방식 {#session-03}

firewalld는 RHEL, CentOS와 Fedora 등에서 주로 사용하는 동적 방화벽 관리 도구입니다.  
Docker의 방화벽 규칙 생성이 기본값으로 활성화되어 있고 firewalld가 실행 중이면, Docker가 컨테이너 통신에 필요한 존과 전달 정책을 자동으로 구성합니다.  
다음 그림의 위쪽은 firewalld에 추가되는 설정을, 아래쪽은 게시된 포트의 요청이 컨테이너까지 전달되는 경로를 보여 줍니다.  

![Docker 포트 게시와 firewalld의 처리 흐름](/assets/images/system-infra/system-infra-virtualization/docker-firewalld-publish-flow.png)

### 🟦 firewalld에 자동 추가되는 설정

- Docker는 `docker` 존(zone)을 생성하고 대상(target)을 `ACCEPT`로 설정합니다.  
- `docker0`, `br-xxxx` 같은 Docker 브리지 인터페이스를 `docker` 존에 포함합니다.  
- `docker-forwarding` 정책을 생성해 다른 존에서 `docker` 존으로 트래픽이 전달되도록 허용합니다.  

### 🟦 게시 포트 트래픽의 전달 과정

`-p 8080:8080`처럼 포트를 게시하면 Docker가 호스트의 8080 포트와 컨테이너의 8080 포트를 연결합니다.  

- 외부 요청이 호스트의 게시 포트에 도착합니다.  
- Docker의 NAT 규칙이 요청의 목적지를 컨테이너 IP와 포트로 변경합니다.  
- 변경된 요청이 `FORWARD`와 Docker 관련 체인을 거쳐 컨테이너로 전달됩니다.  

따라서 외부 클라이언트가 호스트에 접근할 수 있고 다른 네트워크 보안 정책이 요청을 차단하지 않는다면, 별도의 `firewall-cmd --add-port` 설정 없이도 게시된 컨테이너 포트에 접근할 수 있습니다.  

다만 `docker` 존의 대상이 `ACCEPT`라고 해서 컨테이너의 모든 포트가 자동으로 외부에 공개되는 것은 아닙니다.  
외부에서는 `-p` 또는 `--publish` 옵션으로 게시한 포트에 접근할 수 있습니다.  

핵심은 UFW나 firewalld의 호스트 포트 설정만 확인해서는 안 된다는 점입니다.  
컨테이너를 실행할 때는 Docker에서 게시한 주소와 포트가 의도한 공개 범위와 일치하는지도 함께 확인해야 합니다.  
