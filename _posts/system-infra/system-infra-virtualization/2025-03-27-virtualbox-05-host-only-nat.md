---
layout: post
title: "[VirtualBox]5편. Host-Only 네트워크에 NAT로 인터넷 연결"
description: "VirtualBox 가상 머신에 Host-Only와 NAT 어댑터를 함께 연결해 가상 머신 간 통신과 인터넷 접속을 구성하고, Netplan으로 고정 IP를 설정하는 방법을 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: virtualbox
series_order: 05
ai_assisted: true
toc:
  - id: session-01
    title: "1. 구성 목표: Host-Only 네트워크와 NAT"
  - id: session-02
    title: "2. VirtualBox Host-Only 네트워크 설정"
  - id: session-03
    title: "3. VM 생성 및 네트워크 어댑터(Host-Only + NAT) 구성"
  - id: session-04
    title: "4. Netplan으로 IP 설정(host101)"
  - id: session-05
    title: "5. 가상 머신 복제 및 고정 IP 설정(host102, host103)"
  - id: session-06
    title: "6. 네트워크 연결 확인 테스트"
---

VirtualBox의 Host-Only 어댑터는 가상 머신 간 통신과 호스트 PC와의 통신을 지원하지만, 이 어댑터만으로는 외부 인터넷에 연결할 수 없습니다.  
NAT 어댑터를 함께 사용하면 가상 머신 간 내부 통신과 인터넷 연결을 모두 사용할 수 있습니다.  

## 1. 구성 목표: Host-Only 네트워크와 NAT {#session-01}

VirtualBox의 Host-Only 어댑터는 가상 머신 간 통신과 호스트 PC와의 통신을 담당합니다.  
NAT 어댑터는 가상 머신에서 외부로 나가는 트래픽을 VirtualBox의 가상 라우터를 통해 전달합니다.  
두 어댑터를 함께 설정하면 내부 통신과 인터넷 연결을 각각 분리해 사용할 수 있습니다.  

![Host-Only와 NAT 어댑터를 함께 사용하는 네트워크 구성](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-nat-diagram.png)

| 가상 머신 이름 | Host-Only 고정 IP |
| --- | --- |
| host101 | `192.168.56.101` |
| host102 | `192.168.56.102` |
| host103 | `192.168.56.103` |

## 2. VirtualBox Host-Only 네트워크 설정 {#session-02}

1. VirtualBox의 Host-Only 네트워크 설정 화면에서 어댑터의 IPv4 주소를 `192.168.56.1`, 네트워크 마스크를 `255.255.255.0`으로 설정합니다.

   다른 대역을 사용해도 되지만, 가상 머신의 고정 IP도 같은 대역으로 설정해야 합니다.

   ![VirtualBox Host-Only 어댑터의 IPv4 주소 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-address.png)

2. 가상 머신에 고정 IP를 직접 할당하므로 VirtualBox의 DHCP 서버를 비활성화합니다.

   ![VirtualBox Host-Only 네트워크의 DHCP 서버 비활성화](/assets/images/system-infra/system-infra-virtualization/virtualbox-disable-host-only-dhcp.png)

이전 글의 Windows ICS 구성을 적용했다면 먼저 ICS를 해제하고, Host-Only 어댑터의 주소가 `192.168.56.1/24`인지 다시 확인합니다.  
ICS가 활성화된 상태에서는 Windows가 공유 대상 어댑터에 다른 주소를 할당할 수 있습니다.  

## 3. VM 생성 및 네트워크 어댑터(Host-Only + NAT) 구성 {#session-03}

테스트를 위해 Linux가 미리 설치된 서드파티 VDI 이미지로 가상 머신을 생성합니다.  
VirtualBox 설치 및 가상 머신 생성 방법은 [관련 글 링크](#session-07)를 참고합니다.  
가상 머신을 생성한 뒤 네트워크 설정에서 NAT용 어댑터와 Host-Only용 어댑터를 각각 추가합니다.  
NAT는 가상 머신의 외부 인터넷 연결을 담당하고, Host-Only는 호스트와 가상 머신 또는 가상 머신 간 통신을 담당합니다.  

- **어댑터 1(NAT)**: VirtualBox의 가상 라우터를 통해 인터넷에 연결합니다. 첫 번째 NAT 어댑터는 일반적으로 `10.0.2.15`를 할당받습니다. 각 가상 머신의 NAT 네트워크는 기본적으로 서로 분리되어 있으므로 여러 가상 머신이 같은 주소를 사용해도 충돌하지 않습니다.

![가상 머신의 첫 번째 NAT 네트워크 어댑터](/assets/images/system-infra/system-infra-virtualization/virtualbox-dual-adapter-nat.png)

- **어댑터 2(Host-Only 어댑터)**: 호스트와 가상 머신 및 가상 머신 간 통신을 지원하며, 이 어댑터를 통한 외부 인터넷 연결은 제공하지 않습니다.

![가상 머신의 두 번째 Host-Only 네트워크 어댑터](/assets/images/system-infra/system-infra-virtualization/virtualbox-dual-adapter-host-only.png)

## 4. Netplan으로 IP 설정(host101) {#session-04}

- 가상 머신을 시작한 뒤 `ip a` 명령으로 네트워크 인터페이스 이름을 확인합니다.

![Ubuntu에서 NAT와 Host-Only 네트워크 인터페이스 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-dual-network-interfaces.png)

위 화면은 인터페이스 이름을 확인하는 예시이며, 이전 ICS와 DHCP 설정이 남아 있어 `enp0s8`에 `192.168.137.104`가 표시되어 있습니다.  
이 글의 설정을 적용한 뒤에는 `enp0s8`의 주소가 `192.168.56.101/24`로 표시되어야 합니다.  

- Netplan 설정 파일을 수정해 Host-Only 어댑터에 고정 IP를 설정합니다.
- 설정 파일은 `/etc/netplan/`에 있으며, 파일 이름은 `01-netcfg.yaml` 또는 `50-cloud-init.yaml`처럼 환경에 따라 다를 수 있습니다.
- 다음 예제의 인터페이스 이름이 실제 환경과 다르면 `ip a`에서 확인한 이름으로 변경합니다.

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    enp0s3:
      # NAT의 IP, 기본 게이트웨이와 DNS를 DHCP로 설정합니다.
      dhcp4: true
    enp0s8:
      # Host-Only 어댑터에는 게이트웨이 없이 고정 IP만 설정합니다.
      dhcp4: false
      addresses:
        - 192.168.56.101/24
```

| 인터페이스 | 역할 | IP 주소 | 게이트웨이 |
| --- | --- | --- | --- |
| `enp0s3`(NAT) | 인터넷 연결 | DHCP(일반적으로 `10.0.2.15/24`) | DHCP 자동 설정(일반적으로 `10.0.2.2`) |
| `enp0s8`(Host-Only) | 내부 네트워크 | `192.168.56.101/24`(수동) | 없음 |

설정을 저장한 뒤 Netplan을 적용합니다.  

```bash
# 변경한 네트워크 설정을 적용합니다.
sudo netplan apply
```

### 🟦 NAT 어댑터(enp0s3)

- 역할: 인터넷 연결을 담당합니다.
- DHCP를 통해 IP, 기본 게이트웨이와 DNS 정보가 자동으로 할당됩니다.
- 첫 번째 NAT 어댑터에는 일반적으로 `10.0.2.15`가 할당되며, 기본 게이트웨이는 `10.0.2.2`입니다.
- 외부로 향하는 인터넷 트래픽은 NAT 경로를 통해 전달됩니다.

### 🟦 Host-Only 어댑터(enp0s8)

- 역할: 호스트와 게스트 또는 게스트 간 내부 네트워크 통신을 담당합니다.
- 이 실습에서는 VirtualBox DHCP 서버를 비활성화했으므로 `192.168.56.101`을 고정 IP로 설정합니다.
- 기본 게이트웨이는 설정하지 않습니다.
- `192.168.56.0/24`의 연결 경로는 고정 IP를 할당할 때 자동으로 생성되므로 별도의 정적 경로를 추가하지 않습니다.

## 5. 가상 머신 복제 및 고정 IP 설정(host102, host103) {#session-05}

### 🟦 가상 머신 복제

복제하기 전에 `host101` 가상 머신을 종료합니다.  

- 복제한 가상 머신의 이름을 각각 `host102`, `host103`으로 변경합니다.
- MAC 주소 정책은 `모든 네트워크 어댑터의 새 MAC 주소 생성`을 선택해 주소 충돌을 방지합니다.

![host101 가상 머신 복제와 새 MAC 주소 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-clone-dual-network-vm.png)

### 🟦 고정 IP 설정

`host101`의 고정 IP 설정을 참고해 `host102`와 `host103`의 Host-Only 주소를 각각 변경합니다.  

```text
host102
addresses: [192.168.56.102/24]

host103
addresses: [192.168.56.103/24]
```

## 6. 네트워크 연결 확인 테스트 {#session-06}

다음 테스트를 통해 설정이 제대로 적용되었는지 확인합니다.  

- VM에서 인터넷으로 연결: `ping www.naver.com`

![가상 머신에서 NAT를 통한 인터넷 연결 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-nat-internet-ping.png)

- VM 간 연결: `ping 192.168.56.101`

![Host-Only 네트워크에서 가상 머신 간 연결 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-host-only-vm-ping.png)

- 호스트에서 VM으로 연결: `ping 192.168.56.102`

![Windows 호스트에서 Host-Only 가상 머신 연결 확인](/assets/images/system-infra/system-infra-virtualization/windows-host-only-vm-ping.png)

- VM에서 호스트로 연결: `ping 192.168.56.1`

![가상 머신에서 Host-Only 호스트 연결 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-host-only-host-ping.png)

VirtualBox에서 Host-Only와 NAT 어댑터를 함께 사용하면 가상 머신 간 통신과 인터넷 연결을 동시에 구성할 수 있습니다.  
어댑터별 역할을 분리하고 가상 머신마다 Host-Only 고정 IP를 할당하면 복제한 가상 머신도 일관되게 관리할 수 있습니다.  
