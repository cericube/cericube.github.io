---
layout: post
title: "[VirtualBox]1편. 설치 및 Host-Only·NAT Network 비교"
description: "Windows에 VirtualBox 7.1.6을 설치하고 설치 오류를 해결하는 방법, 기본 머신 폴더와 호스트 전용 네트워크 설정, Host-Only와 NAT Network의 차이를 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: virtualbox
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. VirtualBox 7.1.6 설치 및 오류 해결"
  - id: session-02
    title: "2. VirtualBox 가상 머신 폴더 선택"
  - id: session-03
    title: "3. 네트워크 관리자 설정 및 확인"
  - id: session-04
    title: "4. 가상 네트워크 종류 및 차이점"
---

VirtualBox는 Oracle이 개발하는 오픈 소스 가상화 소프트웨어로, 한 대의 PC에서 여러 운영체제를 실행할 수 있습니다.  
이 글에서는 VirtualBox 7.1.6의 설치 방법부터 가상 네트워크 방식인 Host-Only와 NAT Network의 차이까지 정리합니다.  

## 1. VirtualBox 7.1.6 설치 및 오류 해결 {#session-01}

- 다운로드 링크: [Oracle VirtualBox](https://www.virtualbox.org/)

![Oracle VirtualBox 공식 홈페이지](/assets/images/system-infra/system-infra-virtualization/virtualbox-homepage.png)

![VirtualBox 7.1.6 Windows 설치 파일 선택 화면](/assets/images/system-infra/system-infra-virtualization/virtualbox-windows-download.png)

- 원문에서 사용한 설치 파일은 `VirtualBox-7.1.6-167084-Win.exe`입니다.
- 설치는 기본 설정으로 진행할 수 있으며, 필요한 경우 설치 구성 요소를 선택할 수 있습니다.
- 설치 후 드라이버가 정상적으로 로드되지 않으면 시스템을 다시 시작합니다.

드라이버가 로드되지 않은 상태에서는 다음과 같은 오류가 발생할 수 있습니다.  

```text
NtCreateFile(\Device\VBoxDrvStub) failed: 0xc0000034
STATUS_OBJECT_NAME_NOT_FOUND (0 retries) (rc=-101)
```

### 🟦 설치 오류 해결: Visual C++ 2019 오류 메시지

일부 VirtualBox 설치 파일을 실행할 때 다음 오류 메시지가 나타나며 설치가 중단될 수 있습니다.  
이 메시지는 시스템에 필요한 Microsoft Visual C++ 재배포 가능 패키지가 설치되어 있지 않다는 의미입니다.  

```text
Oracle VM VirtualBox 7.0.6 needs the Microsoft Visual C++ 2019
Redistributable Package being installed first.
```

Microsoft 공식 사이트에서 운영체제 아키텍처에 맞는 최신 지원 패키지를 내려받습니다.  
일반적인 64비트 Windows 환경에서는 `vc_redist.x64.exe`를 사용합니다.  
Visual C++ 재배포 가능 패키지를 설치한 후 VirtualBox 설치를 다시 진행합니다.  

- [지원되는 최신 Visual C++ 재배포 가능 패키지 다운로드](https://learn.microsoft.com/ko-kr/cpp/windows/latest-supported-vc-redist?view=msvc-170)

## 2. VirtualBox 가상 머신 폴더 선택 {#session-02}

VirtualBox를 실행한 뒤 `파일 > 환경 설정`으로 이동하고 `Expert` 모드를 선택합니다.  
`Expert` 모드에서는 VirtualBox의 모든 환경 설정과 도구를 확인할 수 있습니다.  
가상 머신 이미지 파일을 저장할 위치는 `일반 > 기본 머신 폴더`에서 변경할 수 있습니다.  

![VirtualBox Expert 모드와 기본 머신 폴더 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-default-machine-folder.png)

## 3. 네트워크 관리자 설정 및 확인 {#session-03}

전역 `도구 > 네트워크` 메뉴에서 네트워크 관리자를 열고 호스트 전용 네트워크 어댑터를 확인합니다.  
네트워크 도구가 보이지 않는다면 `파일 > 환경 설정`에서 `Expert` 모드를 선택했는지 확인합니다.  

![VirtualBox 네트워크 관리자와 호스트 전용 네트워크](/assets/images/system-infra/system-infra-virtualization/virtualbox-network-manager.png)

호스트 전용 네트워크를 선택한 뒤 `어댑터` 탭에서 IPv4 주소와 서브넷 마스크를 확인합니다.  
IP 주소는 필요에 따라 변경할 수 있지만, 여기서는 기본값만 확인합니다.  

![VirtualBox 호스트 전용 네트워크 어댑터 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-host-only-settings.png)

호스트 전용 네트워크를 사용하면 VirtualBox가 호스트에 소프트웨어 네트워크 인터페이스를 생성합니다.  
Windows의 `제어판 > 네트워크 및 인터넷 > 네트워크 연결`에서 `VirtualBox Host-Only Ethernet Adapter`를 확인할 수 있습니다.  
Windows에서 표시되는 어댑터 이름은 `VirtualBox`처럼 알아보기 쉬운 이름으로 변경해도 됩니다.  
Windows 어댑터의 IP 정보는 VirtualBox 네트워크 관리자에서 설정한 값과 일치해야 합니다.  

![Windows의 VirtualBox Host-Only Ethernet Adapter IPv4 설정](/assets/images/system-infra/system-infra-virtualization/windows-virtualbox-host-only-adapter.png)

## 4. 가상 네트워크 종류 및 차이점 {#session-04}

VirtualBox의 `NAT`와 `NAT Network`는 서로 다른 네트워크 모드입니다.  
이 글에서는 여러 가상 머신을 같은 네트워크에 연결할 수 있는 `NAT Network`를 Host-Only와 비교합니다.  

### 🟦 호스트 전용 네트워크(Host-Only)

- 가상 머신과 호스트 사이에 통신할 수 있는 네트워크입니다.
- 이 네트워크 어댑터만으로는 외부 네트워크나 인터넷에 연결되지 않습니다.
- Host-Only 네트워크를 사용하면 VirtualBox가 호스트에 소프트웨어 네트워크 인터페이스를 생성합니다.
- 같은 Host-Only 네트워크에 연결된 가상 머신끼리 통신할 수 있습니다.
- 호스트에서 가상 머신으로 SSH 접속할 때 활용할 수 있습니다.

### 🟦 NAT Network

- 가상 머신이 VirtualBox의 NAT 서비스를 통해 외부 네트워크나 인터넷에 접속하는 방식입니다.
- 같은 NAT Network에 연결된 가상 머신끼리 통신할 수 있습니다.
- 가상 머신에서 호스트로 통신할 수 있지만, 호스트에서 가상 머신의 서비스로 접속하려면 일반적으로 포트 포워딩이 필요합니다.
- VirtualBox의 DHCP 서버를 활성화하면 가상 머신에 IP 주소를 자동으로 할당할 수 있습니다.

### 🟦 Host-Only와 NAT Network 비교

| 항목 | 호스트 전용(Host-Only) | NAT Network |
| --- | --- | --- |
| 인터넷 연결 | 기본적으로 불가능 | 가능 |
| 호스트 → VM 접속 | 가능 | 포트 포워딩 필요 |
| VM 간 통신 | 같은 Host-Only 네트워크에서 가능 | 같은 NAT Network에서 가능 |
| IP 할당 | 수동 또는 DHCP | 수동 또는 DHCP |
| 게이트웨이 | 외부 연결용 게이트웨이 없음 | VirtualBox 가상 라우터 제공 |
| SSH 접속 | 가능 | 호스트에서 접속할 때 포트 포워딩 필요 |
| 포트 포워딩 | 필요 없음 | 외부에서 VM 서비스로 접속할 때 필요 |
