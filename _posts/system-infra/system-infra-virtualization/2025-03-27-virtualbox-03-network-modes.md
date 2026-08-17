---
layout: post
title: "[VirtualBox]3편. 가상 머신 네트워크 어댑터 종류와 차이점"
description: "VirtualBox의 NAT, NAT Network, 브리지, 호스트 전용 및 내부 네트워크 모드의 통신 범위와 설정 방법을 비교합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: virtualbox
series_order: 03
ai_assisted: true
toc:
  - id: session-01
    title: "1. VirtualBox 네트워크 어댑터 요약표"
  - id: session-02
    title: "2. NAT (Network Address Translation)"
  - id: session-03
    title: "3. NAT 네트워크(NAT Network)"
  - id: session-04
    title: "4. 브리지 어댑터(Bridged Adapter)"
  - id: session-05
    title: "5. 호스트 전용 어댑터(Host-Only Adapter)"
  - id: session-06
    title: "6. 내부 네트워크(Internal Network)"
---

VirtualBox에서 가상 머신 네트워크를 구성할 때 어떤 어댑터를 선택하는지에 따라 통신 방식이 달라집니다.  
이 글에서는 NAT, NAT Network, 브리지 어댑터, 호스트 전용 어댑터와 내부 네트워크를 비교하고 상황에 맞는 설정 방법을 안내합니다.  

## 1. VirtualBox 네트워크 어댑터 요약표 {#session-01}

| 어댑터 종류 | Guest ↔ Guest | Guest → Host | Host → Guest | Guest → 인터넷 |
| --- | --- | --- | --- | --- |
| NAT | 불가능 | 가능 | 포트 포워딩 필요 | 가능 |
| NAT 네트워크 | 가능 | 가능 | 포트 포워딩 필요 | 가능 |
| 브리지 어댑터 | 가능 | 가능 | 가능 | 가능 |
| 내부 네트워크 | 가능 | 불가능 | 불가능 | 불가능 |
| 호스트 전용 어댑터 | 가능 | 가능 | 가능 | 불가능 |

브리지 어댑터의 통신 가능 여부는 물리 네트워크와 방화벽 설정에 따라 달라질 수 있습니다.  

## 2. NAT (Network Address Translation) {#session-02}

- 기본 설정으로 자주 사용하는 네트워크 모드입니다.
- 가상 머신은 VirtualBox의 가상 라우터를 통해 인터넷에 접근할 수 있습니다.
- 첫 번째 NAT 어댑터를 사용하는 가상 머신의 IP 주소는 일반적으로 `10.0.2.15`로 자동 설정됩니다.
- 호스트나 외부 네트워크에서 가상 머신으로 접근하려면 포트 포워딩 설정이 필요합니다.
- 주 용도는 인터넷은 사용하지만 외부 접근이나 가상 머신 간 통신이 필요하지 않은 환경입니다.

![VirtualBox NAT 모드의 통신 범위](/assets/images/system-infra/system-infra-virtualization/virtualbox-nat-mode-diagram.png)

## 3. NAT 네트워크(NAT Network) {#session-03}

- NAT Network를 사용하려면 먼저 VirtualBox에서 NAT Network를 생성합니다.

![VirtualBox 네트워크 관리자의 NAT Network 탭](/assets/images/system-infra/system-infra-virtualization/virtualbox-nat-network-manager.png)

![VirtualBox NAT Network 생성 및 IPv4 접두사 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-create-nat-network.png)

- NAT의 확장 형태로, 여러 가상 머신이 같은 가상 네트워크를 공유합니다.
- VirtualBox에서 NAT Network를 별도로 생성한 뒤 가상 머신을 해당 네트워크에 연결해야 합니다.
- DHCP를 활성화하면 설정한 IPv4 접두사 범위에서 IP 주소가 자동으로 할당되며 가상 머신끼리 통신할 수 있습니다.
- 호스트에서 가상 머신으로 접근하려면 포트 포워딩 설정이 필요합니다.
- 주 용도는 가상 머신 간 통신과 외부 인터넷 접속이 모두 필요한 테스트 환경입니다.

![VirtualBox NAT Network의 통신 범위](/assets/images/system-infra/system-infra-virtualization/virtualbox-nat-network-diagram.png)

## 4. 브리지 어댑터(Bridged Adapter) {#session-04}

- 가상 머신이 호스트의 물리 네트워크에 직접 연결된 것처럼 동작합니다.
- 공유기 등과 같은 네트워크에 연결되며, 해당 네트워크에 DHCP 서버가 있으면 IP 주소를 자동으로 할당받을 수 있습니다.
- 물리 네트워크와 게스트 운영체제의 방화벽이 허용하면 다른 PC나 서버에서 가상 머신으로 접근할 수 있습니다.
- 주 용도는 개발 서버나 운영 서버처럼 외부 장치의 접근이 필요한 환경입니다.

![VirtualBox 브리지 어댑터의 통신 범위](/assets/images/system-infra/system-infra-virtualization/virtualbox-bridged-network-diagram.png)

## 5. 호스트 전용 어댑터(Host-Only Adapter) {#session-05}

- 호스트와 가상 머신뿐만 아니라 같은 Host-Only 네트워크에 연결된 가상 머신끼리도 통신할 수 있습니다.
- 사용할 Host-Only 네트워크가 없다면 VirtualBox 네트워크 관리자에서 생성해야 합니다.
- 예를 들어 호스트 어댑터 주소가 `192.168.56.1`이면 가상 머신에서 해당 주소로 호스트에 접근할 수 있습니다.
- DHCP 서버 사용 여부를 선택할 수 있으며 IP 주소를 수동으로 설정할 수도 있습니다.
- 주 용도는 외부 네트워크와 격리된 개발 및 테스트 환경입니다.

![VirtualBox Host-Only 네트워크 어댑터 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-network-settings.png)

![VirtualBox Host-Only 네트워크의 통신 범위](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-network-diagram.png)

## 6. 내부 네트워크(Internal Network) {#session-06}

- 같은 내부 네트워크에 연결된 VirtualBox 가상 머신끼리만 통신할 수 있는 독립 네트워크입니다.
- 호스트와 외부 네트워크에서는 내부 네트워크에 직접 접근할 수 없습니다.
- 기본적으로 IP 주소가 자동 할당되지 않으므로 수동으로 설정하며, 필요한 경우 VirtualBox의 DHCP 서버를 별도로 구성할 수 있습니다.
- 주 용도는 보안이 중요한 독립 환경, 가상 클러스터와 테스트 네트워크 구성입니다.

다음 그림의 `DHCP(X)` 표시는 DHCP 서버를 별도로 구성하지 않은 기본 상태를 나타냅니다.  

![VirtualBox 내부 네트워크의 통신 범위](/assets/images/system-infra/system-infra-virtualization/virtualbox-internal-network-diagram.png)

VirtualBox에서는 목적에 따라 여러 가상 네트워크 구성을 선택할 수 있습니다.  
호스트와 가상 머신만 연결하는 개발 환경에는 호스트 전용 어댑터, 외부 장치의 접근을 시험하는 환경에는 브리지 어댑터, 간단한 인터넷 접속만 필요한 환경에는 NAT 모드가 적합합니다.  
