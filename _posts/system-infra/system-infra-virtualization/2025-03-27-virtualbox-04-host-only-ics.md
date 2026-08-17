---
layout: post
title: "[VirtualBox]4편. Host-Only 네트워크에서 ICS로 인터넷 연결"
description: "Windows 인터넷 연결 공유(ICS)를 이용해 VirtualBox Host-Only 네트워크의 가상 머신을 인터넷에 연결하고, Netplan으로 고정 IP를 설정하는 방법을 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: virtualbox
series_order: 04
ai_assisted: true
toc:
  - id: session-01
    title: "1. 구성 목표: Host-Only 네트워크와 ICS"
  - id: session-02
    title: "2. Windows ICS 활성화 및 VirtualBox 어댑터 설정"
  - id: session-03
    title: "3. VM 생성 및 Netplan 고정 IP 설정(host101)"
  - id: session-04
    title: "4. VM 복제 및 IP 설정(host102, host103)"
  - id: session-05
    title: "5. 네트워크 연결 확인"
---

VirtualBox에서 Host-Only 네트워크를 사용하면 기본 설정으로는 가상 머신이 인터넷에 접속할 수 없습니다.  
Windows의 인터넷 연결 공유(Internet Connection Sharing, ICS)를 설정하면 호스트의 인터넷 연결을 가상 머신과 공유할 수 있습니다.  

## 1. 구성 목표: Host-Only 네트워크와 ICS {#session-01}

VirtualBox의 Host-Only 어댑터는 기본적으로 외부 네트워크와 분리되어 있어 가상 머신이 인터넷에 접근할 수 없습니다.  
Windows에서 ICS를 활성화하면 인터넷에 연결된 어댑터를 통해 가상 머신도 인터넷에 접속할 수 있습니다.  
이 실습 환경에서는 ICS가 공유 대상 어댑터에 `192.168.137.1/24`를 할당하므로, 해당 대역을 기준으로 가상 머신의 고정 IP를 설정합니다.  

### 🟦 구성 목표

- 목표: VirtualBox의 Host-Only 네트워크를 사용하는 가상 머신에서도 인터넷을 사용합니다.
- 방법: Windows ICS를 이용해 호스트의 인터넷 연결을 공유합니다.
- 기본 IP 구조: 이 실습에서는 Windows ICS가 할당한 `192.168.137.1`을 기본 게이트웨이로 사용합니다.
- 고정 IP 구성: 가상 머신에 `192.168.137.0/24` 대역의 고정 IP를 할당합니다.

![Host-Only 네트워크에 Windows ICS를 적용한 구성](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-ics-diagram.png)

| 가상 머신 이름 | 고정 IP |
| --- | --- |
| host101 | `192.168.137.101` |
| host102 | `192.168.137.102` |
| host103 | `192.168.137.103` |

ICS는 DHCP와 이름 확인 기능도 제공하므로 고정 IP가 필수는 아닙니다.  
여기서는 가상 머신마다 예측 가능한 주소로 접속하기 위해 고정 IP를 사용합니다.  

## 2. Windows ICS 활성화 및 VirtualBox 어댑터 설정 {#session-02}

### 🟦 Windows ICS 활성화

1. `제어판 > 네트워크 및 인터넷 > 네트워크 연결`로 이동합니다.

   ![Windows 네트워크 연결의 인터넷 및 VirtualBox 어댑터](/assets/images/system-infra/system-infra-virtualization/windows-ics-network-adapters.png)

2. 실제 인터넷에 연결된 어댑터를 마우스 오른쪽 버튼으로 클릭하고 `속성 > 공유` 탭을 선택합니다.

3. `다른 네트워크 사용자가 이 컴퓨터의 인터넷 연결을 통해 연결할 수 있도록 허용`을 활성화합니다.

4. 홈 네트워킹 연결에서 `VirtualBox Host-Only Network`를 공유 대상 어댑터로 선택합니다.

   ![Windows 인터넷 연결 공유 활성화와 대상 어댑터 선택](/assets/images/system-infra/system-infra-virtualization/windows-enable-ics.png)

5. 인터넷 어댑터에 `공유됨` 상태가 표시되는지 확인합니다.

   ![Windows 인터넷 어댑터의 공유 상태](/assets/images/system-infra/system-infra-virtualization/windows-ics-shared-adapter.png)

### 🟦 VirtualBox 어댑터 설정

- 이 실습에서는 ICS가 Host-Only 어댑터에 `192.168.137.1/24`를 할당했는지 확인합니다.
- 실제로 할당된 주소가 다르면 이후 Netplan의 주소와 기본 게이트웨이도 같은 대역에 맞게 변경합니다.
- ICS가 DHCP를 제공하므로 주소 할당 충돌을 피하기 위해 VirtualBox Host-Only 네트워크의 DHCP 서버는 비활성화합니다.
- 고정 IP를 사용할 때는 같은 네트워크에서 이미 사용 중이거나 ICS가 임대한 주소와 중복되지 않는지 확인합니다.

> VirtualBox DHCP를 비활성화해도 ICS의 DHCP는 계속 주소를 배포하므로, 수동으로 지정한 고정 IP와 나중에 충돌할 수 있습니다.  
> 안정적인 고정 IP가 필요하다면 ICS 대신 NAT와 Host-Only 어댑터를 함께 사용하는 구성을 권장합니다.  

![VirtualBox Host-Only 어댑터의 ICS 주소 확인](/assets/images/system-infra/system-infra-virtualization/virtualbox-ics-host-only-address.png)

> 위 화면에는 VirtualBox DHCP 서버가 `사용함`으로 표시되어 있지만, 이 구성에서는 DHCP 서버 탭에서 비활성화합니다.  

## 3. VM 생성 및 Netplan 고정 IP 설정(host101) {#session-03}

### 🟦 가상 머신 생성

- 테스트를 위해 Linux가 미리 설치된 서드파티 VDI 이미지로 가상 머신을 생성합니다.
- 필요한 도구를 인터넷에서 설치할 수 있도록 처음에는 기본 네트워크 모드인 NAT를 사용합니다.

![도구 설치를 위한 가상 머신 NAT 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-nat-before-setup.png)

1. 가상 머신에 로그인합니다.

   OSBoxes 이미지를 사용한다면 초기 계정은 `osboxes`, 비밀번호는 `osboxes.org`입니다.

   공개된 초기 계정 정보이므로 처음 로그인한 뒤 비밀번호를 변경합니다.

2. 필요한 편집기, 네트워크 확인 도구와 SSH 서버를 설치합니다.

```bash
# 패키지 목록을 갱신합니다.
sudo apt update

# 설정 편집기와 네트워크 확인 도구, SSH 서버를 설치합니다.
sudo apt install vim nano iputils-ping isc-dhcp-client openssh-server -y
```

설치를 마치면 가상 머신을 종료합니다.  

### 🟦 Netplan으로 고정 IP 설정

1. `host101` 가상 머신의 네트워크를 `Host-Only 어댑터`로 변경하고 가상 머신을 시작합니다.

   ![가상 머신의 Host-Only 네트워크 어댑터 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-host-only-adapter.png)

2. `/etc/netplan/`에 있는 기존 YAML 설정 파일을 확인합니다.

   파일 이름은 환경에 따라 `01-netcfg.yaml`, `50-cloud-init.yaml` 등으로 다를 수 있습니다.

3. 네트워크 인터페이스 이름을 확인한 뒤 기존 Netplan 설정 파일에 고정 IP를 설정합니다.

   다음 예제의 인터페이스 이름은 `enp0s3`이며, 실제 이름이 다르면 해당 환경에 맞게 변경합니다.

```yaml
network:
  version: 2
  ethernets:
    enp0s3:
      # DHCP 대신 host101의 고정 주소를 사용합니다.
      dhcp4: false
      addresses: [192.168.137.101/24]
      routes:
        # Windows ICS 어댑터를 기본 게이트웨이로 사용합니다.
        - to: default
          via: 192.168.137.1
      nameservers:
        # 외부 도메인 이름을 확인할 DNS 서버를 지정합니다.
        addresses: [8.8.8.8]
```

`50-cloud-init.yaml`처럼 cloud-init이 생성한 파일은 시스템 설정에 따라 다시 만들어질 수 있으므로 파일 상단의 안내를 확인합니다.  

4. Netplan 설정을 적용합니다.

```bash
# 변경한 네트워크 설정을 적용합니다.
sudo netplan apply
```

5. `ping 8.8.8.8`을 실행해 인터넷 연결을 확인합니다.

   ![Ubuntu 가상 머신에서 ICS 인터넷 연결 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-ics-ping-ip.png)

정상 동작을 확인한 뒤 가상 머신을 종료합니다.  

## 4. VM 복제 및 IP 설정(host102, host103) {#session-04}

### 🟦 가상 머신 복제

- 가상 머신 이름을 각각 `host102`, `host103`으로 설정합니다.
- MAC 주소 정책은 `모든 네트워크 어댑터의 새 MAC 주소 생성`을 선택합니다.

![host101 가상 머신 복제와 새 MAC 주소 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-clone-network-vms.png)

### 🟦 고정 IP 설정

`host101`의 Netplan 설정을 참고해 `host102`와 `host103`의 고정 IP를 각각 변경합니다.  

```text
host102
addresses: [192.168.137.102/24]

host103
addresses: [192.168.137.103/24]
```

## 5. 네트워크 연결 확인 {#session-05}

### 🟦 Host에서 VM 연결 확인

Windows에서 `ssh osboxes@192.168.137.101`로 접속한 뒤 `ip a`를 실행해 IP 주소를 확인합니다.  

![SSH로 접속한 host101의 IP 주소 확인](/assets/images/system-infra/system-infra-virtualization/ubuntu-ics-ip-address.png)

### 🟦 VM 간 연결 확인

`host101`에서 `ping 192.168.137.102`를 실행해 `host102`와의 연결을 확인합니다.  

![host101에서 host102로 ping 실행](/assets/images/system-infra/system-infra-virtualization/ubuntu-ics-vm-ping.png)

### 🟦 VM에서 인터넷 연결 확인

`host101`에서 `ping www.naver.com`을 실행해 인터넷 연결과 DNS 이름 확인이 모두 동작하는지 확인합니다.  

![host101에서 외부 도메인으로 ping 실행](/assets/images/system-infra/system-infra-virtualization/ubuntu-ics-internet-ping.png)

VirtualBox의 Host-Only 네트워크만 사용하더라도 Windows ICS를 통해 가상 머신에서 인터넷에 접속할 수 있습니다.  
ICS와 Netplan 고정 IP 설정을 함께 사용하면 가상 머신 간 통신과 외부 인터넷 접속을 구성할 수 있습니다.  
