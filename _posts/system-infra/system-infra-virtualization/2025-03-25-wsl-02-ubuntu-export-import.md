---
layout: post
title: "[WSL]2편. Ubuntu 설치와 Export/Import 복제"
description: "WSL 2에 Ubuntu 24.04를 설치하고 실행 및 기본 배포판 설정, 한글 출력 확인, Export/Import를 이용한 배포판 복제 방법을 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: wsl
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. Ubuntu 24.04 설치하기"
  - id: session-02
    title: "2. Ubuntu 실행 및 기본값 설정"
  - id: session-03
    title: "3. WSL 한글 설정"
  - id: session-04
    title: "4. Ubuntu 배포판 복제(Export/Import)"
---

WSL 2 환경에서 Ubuntu 24.04를 설치하고, 한글 설정부터 배포판 복제까지 전 과정을 다룹니다.  
특히 `wsl --export`, `wsl --import` 명령어를 활용한 배포판 백업 및 복원 방법을 포함합니다.  

## 1. Ubuntu 24.04 설치하기 {#session-01}

Windows에서 WSL을 설치하는 방법은 [Windows에서 WSL 2 설치 및 명령어 정리](/archives/system-infra/system-infra-virtualization/wsl-01-install-commands/){: target="_blank" rel="noopener noreferrer" }를 참고합니다.  

1. WSL 2 설치가 완료된 상태라면 명령 프롬프트나 PowerShell에서 설치 가능한 Linux 배포판 목록을 확인합니다.

```powershell
# 온라인으로 설치할 수 있는 배포판 목록을 확인합니다.
wsl --list --online
```

![WSL에 설치할 수 있는 Linux 배포판 목록](/assets/images/system-infra/system-infra-virtualization/wsl-online-distributions.png)

2. Ubuntu 24.04를 설치하려면 다음 명령어를 입력합니다.

```powershell
# 목록에 표시된 Ubuntu 24.04 배포판을 설치합니다.
wsl --install -d Ubuntu-24.04
```

3. 설치 과정에서 Ubuntu 사용자 이름과 암호를 설정합니다.

![Ubuntu 24.04 설치와 사용자 계정 설정 화면](/assets/images/system-infra/system-infra-virtualization/ubuntu-install-account.png)

> WSL 2는 Linux 파일 시스템을 `.vhdx` 가상 디스크로 관리합니다.  
> Microsoft Store를 통해 설치한 Ubuntu 24.04의 가상 디스크는 일반적으로 `C:\Users\사용자\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu24.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx` 경로에 있습니다.  
> 실제 경로는 설치 방식과 사용자 환경에 따라 달라질 수 있으며, 실행 중인 가상 디스크 파일을 직접 수정하면 안 됩니다.  

## 2. Ubuntu 실행 및 기본값 설정 {#session-02}

설치된 배포판 목록을 확인한 후 Ubuntu 24.04를 실행합니다.  

```powershell
# 설치된 배포판 목록을 확인합니다.
wsl -l

# Ubuntu 24.04 배포판을 지정하여 실행합니다.
wsl -d Ubuntu-24.04
```

![설치된 배포판 목록 확인과 Ubuntu 24.04 실행 결과](/assets/images/system-infra/system-infra-virtualization/ubuntu-run.png)

설치한 배포판이 여러 개이고 Ubuntu 24.04를 기본으로 설정하고 싶다면 다음 명령어를 사용합니다.  
이후부터는 `wsl` 명령어만 입력해도 Ubuntu 24.04가 실행됩니다.  

```powershell
# wsl 명령으로 실행할 기본 배포판을 Ubuntu 24.04로 지정합니다.
wsl --set-default Ubuntu-24.04
```

![Ubuntu 24.04가 기본 배포판으로 지정된 목록](/assets/images/system-infra/system-infra-virtualization/ubuntu-default-distribution.png)

## 3. WSL 한글 설정 {#session-03}

Ubuntu WSL은 일반적으로 Windows 터미널에서 한글을 정상적으로 출력합니다.  
다음 명령어로 한글 출력 여부를 확인할 수 있습니다.  

```bash
# 터미널에서 한글이 올바르게 출력되는지 확인합니다.
echo "안녕하세요, WSL에서 한글이 보이나요?"
```

WSLg로 실행하는 Linux GUI 애플리케이션에서 한글 글꼴이 깨질 경우 다음 명령어로 한글 글꼴을 설치합니다.  

```bash
# 패키지 목록을 갱신한 뒤 나눔 및 은 글꼴을 설치합니다.
sudo apt update && sudo apt install -y fonts-nanum fonts-unfonts-core
```

> 터미널의 한글 표시와 한/영 전환은 Windows 터미널의 글꼴 및 Windows 입력기 설정에 영향을 받습니다.  
> 위 패키지는 Linux 애플리케이션에서 사용할 한글 글꼴을 설치하며, 한/영 전환을 설정하지는 않습니다.  

## 4. Ubuntu 배포판 복제(Export/Import) {#session-04}

WSL에서 Ubuntu 24.04 환경을 두 개 이상 사용하고 싶다면 기존 배포판을 복제할 수 있습니다.  

### 🟦 Ubuntu 배포판 내보내기(Export, 백업)

- 현재 Ubuntu 24.04 배포판을 `.tar` 파일로 백업하려면 다음 명령어를 입력합니다.
- 내보내기를 실행하면 WSL 배포판의 파일 시스템을 지정한 경로에 `.tar` 파일로 저장할 수 있습니다.

```powershell
# Ubuntu 24.04 배포판을 D 드라이브의 tar 파일로 내보냅니다.
wsl --export Ubuntu-24.04 D:\Ubuntu-24.04-backup.tar
```

### 🟦 Ubuntu 배포판 가져오기(Import, 복제)

- 백업한 배포판을 새로운 이름으로 가져오려면 다음 명령어를 사용합니다.
- 복제가 완료되면 서로 독립적인 Ubuntu 환경을 여러 개 운용할 수 있습니다.

```powershell
# 백업 파일을 새 이름과 설치 경로로 가져오고 WSL 2를 사용하도록 지정합니다.
wsl --import Ubuntu-24.04-Python D:\WSL\Ubuntu-24.04-Python D:\Ubuntu-24.04-backup.tar --version 2
```

- `Ubuntu-24.04-Python`: 새 배포판 이름
- `D:\WSL\Ubuntu-24.04-Python`: 복제할 배포판의 설치 경로
- `D:\Ubuntu-24.04-backup.tar`: 내보낸 백업 파일 경로
- `--version 2`: WSL 2 배포판으로 가져오기(`--version 1`을 사용하면 WSL 1로 가져옵니다.)

> `wsl --import`로 가져온 배포판은 기본적으로 `root` 사용자로 시작합니다.  
> 기존 일반 사용자를 기본 사용자로 사용하려면 가져온 배포판의 `/etc/wsl.conf`에서 `[user]`의 `default` 값을 설정해야 합니다.  

가져온 배포판이 목록에 표시되는지 확인합니다.  

![Ubuntu 24.04 복제 배포판 확인 결과](/assets/images/system-infra/system-infra-virtualization/ubuntu-imported-clone.png)

WSL 2 기반의 Ubuntu 24.04 설치부터 Export/Import를 이용한 복제까지 실무에서 자주 사용하는 기능을 정리했습니다.  
배포판을 백업하거나 용도별로 독립적인 환경을 만들 때 활용할 수 있습니다.  
