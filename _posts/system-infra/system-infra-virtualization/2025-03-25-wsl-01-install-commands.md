---
layout: post
title: "[WSL]1편. Windows에서 WSL 2 설치 및 명령어 정리"
description: "Windows에서 WSL 2를 설치하는 방법과 배포판·버전·실행·백업·디스크 관리에 사용하는 주요 명령어를 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: wsl
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. WSL 2란?"
  - id: session-02
    title: "2. Windows 기능 수동 추가(필요한 Windows 10 환경)"
  - id: session-03
    title: "3. WSL 설치 방법"
  - id: session-04
    title: "4. WSL 2 명령어 정리"
---

WSL 2(Windows Subsystem for Linux)는 Windows 환경에서 Linux를 가볍고 효율적으로 실행할 수 있는 기능입니다.  
이 글에서는 WSL 2 설치 방법과 주요 명령어를 정리합니다.  

## 1. WSL 2란? {#session-01}

WSL(Windows Subsystem for Linux)은 별도의 가상 머신을 직접 구성하거나 이중 부팅하지 않고도 Windows에서 Linux 환경을 실행할 수 있는 기능입니다.  
WSL 2는 가상화 기술을 사용하여 경량 유틸리티 가상 머신에서 Linux 커널을 실행합니다.  
각 Linux 배포판은 WSL 2 관리형 가상 머신 안에서 격리된 컨테이너로 실행됩니다.  

## 2. Windows 기능 수동 추가(필요한 Windows 10 환경) {#session-02}

최신 Windows 10에서 `wsl --install` 명령을 사용하면 필요한 기능이 자동으로 활성화됩니다.  
이 명령을 사용할 수 없는 이전 Windows 10 빌드에서 WSL 2를 수동으로 설치하려면 `Linux용 Windows 하위 시스템`과 `가상 머신 플랫폼` 기능을 활성화해야 합니다.  

1. `제어판 > 프로그램 > 프로그램 및 기능 > Windows 기능 켜기/끄기`로 이동합니다.
2. `Linux용 Windows 하위 시스템`과 `가상 머신 플랫폼`을 선택합니다.
3. 시스템을 다시 부팅합니다.

![제어판의 프로그램 및 기능 메뉴](/assets/images/system-infra/system-infra-virtualization/windows-features-programs.png)

Windows 11에서 `wsl --install` 명령을 사용하는 경우에는 이 수동 설정 과정을 생략할 수 있습니다.  

## 3. WSL 설치 방법 {#session-03}

1. Windows 11의 명령 프롬프트나 PowerShell을 관리자 권한으로 실행한 뒤 다음 명령어를 입력하여 설치를 시작합니다.

```powershell
# WSL과 기본 Ubuntu 배포판을 함께 설치합니다.
wsl --install
```

![WSL 설치 안내가 표시된 명령 프롬프트](/assets/images/system-infra/system-infra-virtualization/wsl-install-prompt.jpg)

![WSL과 가상 머신 플랫폼 설치 진행 화면](/assets/images/system-infra/system-infra-virtualization/wsl-install-progress.jpg)

2. 시스템을 다시 부팅합니다.

3. 명령 프롬프트에서 WSL 설치 여부와 버전을 확인합니다.

![wsl --version 명령 실행 결과](/assets/images/system-infra/system-infra-virtualization/wsl-version.png)

4. 설치가 끝나면 다음 명령어로 현재 설치된 배포판과 온라인으로 설치할 수 있는 배포판 목록을 확인합니다.

```powershell
# 설치된 배포판의 상태와 WSL 버전을 확인합니다.
wsl --list --verbose

# 온라인으로 설치할 수 있는 배포판 목록을 확인합니다.
wsl --list --online
```

![설치된 배포판과 온라인 배포판 목록 확인 결과](/assets/images/system-infra/system-infra-virtualization/wsl-distribution-list.png)

## 4. WSL 2 명령어 정리 {#session-04}

다음 명령어는 PowerShell 또는 Windows 명령 프롬프트에서 실행합니다.  

### 🟦 설치 및 버전 관리

| 명령어 | 설명 |
| --- | --- |
| `wsl --install` | WSL과 기본 Ubuntu 배포판 설치 |
| `wsl --install -d <배포판>` | 특정 배포판 설치(예: Debian, Kali Linux 등) |
| `wsl --list --online` 또는 `wsl -l -o` | 설치 가능한 배포판 목록 확인 |
| `wsl --list --verbose` 또는 `wsl -l -v` | 설치된 배포판, 실행 상태, WSL 버전 확인 |
| `wsl --set-version <배포판> <1 또는 2>` | 특정 배포판의 WSL 버전을 1 또는 2로 변경 |
| `wsl --set-default-version <1 또는 2>` | 새로 설치할 배포판의 기본 WSL 버전 지정 |
| `wsl --set-default <배포판>` | 기본 배포판 지정 |

### 🟦 실행 및 종료

| 명령어 | 설명 |
| --- | --- |
| `wsl` | 기본 배포판 실행 |
| `wsl ~` | 사용자 홈 디렉터리에서 실행 |
| `wsl -d <배포판> -u <사용자>` | 특정 배포판을 특정 사용자로 실행 |
| `wsl --user <사용자>` | 기본 배포판을 지정한 사용자로 실행 |
| `wsl --shutdown` | 실행 중인 모든 배포판과 WSL 2 가상 머신 종료 |
| `wsl --terminate <배포판>` 또는 `wsl -t <배포판>` | 특정 배포판 종료 |

### 🟦 상태 확인 및 업데이트

| 명령어 | 설명 |
| --- | --- |
| `wsl --status` | 기본 배포판, 기본 버전, 커널 정보 확인 |
| `wsl --version` | 현재 WSL과 구성 요소의 버전 확인 |
| `wsl --update` | WSL을 최신 버전으로 업데이트 |
| `wsl --help` | 전체 명령어와 옵션 확인 |

### 🟦 배포판 백업 및 복원

| 명령어 | 설명 |
| --- | --- |
| `wsl --unregister <배포판>` | 배포판 등록 해제 및 제거(모든 데이터가 삭제됨) |
| `wsl --export <배포판> <파일명>` | 배포판을 기본적으로 `.tar` 파일로 백업 |
| `wsl --import <배포판> <설치 경로> <파일명>` | `.tar` 백업을 새 배포판으로 가져오기 |
| `wsl --import-in-place <배포판> <파일명>` | `ext4` 파일 시스템의 `.vhdx` 이미지를 새 배포판으로 가져오기 |
| `<배포판> config --default-user <사용자>` | 배포판의 기본 사용자 변경 |

> `wsl --unregister`를 실행하면 해당 배포판의 데이터, 설정, 소프트웨어가 모두 영구적으로 삭제됩니다.  

### 🟦 디스크 및 네트워크

| 명령어 | 설명 |
| --- | --- |
| `wsl --mount <디스크 경로>` | 실제 디스크를 WSL 2에 연결하고 탑재 |
| `wsl --unmount <디스크 경로>` | 탑재한 디스크를 분리 |
| `wsl hostname -I` | 현재 WSL 2 배포판의 가상 머신 IP 주소 확인 |
