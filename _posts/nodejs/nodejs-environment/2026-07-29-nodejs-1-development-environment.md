---
layout: post
title: "1. VS Code·WSL·Remote-SSH 기반 Node.js 개발 환경 구축"
description: "Windows에서 VS Code와 WSL·Ubuntu를 활용해 Node.js 개발 환경을 구축하고, Remote-SSH와 VS Code Server로 로컬 및 원격 Linux 환경에 연결하는 방법을 정리합니다."
category_id: nodejs-environment
categories: [nodejs, nodejs-environment]
series: nodejs
series_order: 1
ai_assisted: true
toc:
  - id: session-01
    title: "1. VS Code-WSL 기반 Node.js 개발 환경 설치"
  - id: session-02
    title: "2. VS Code Remote-SSH 원격 개발 환경 구성"
  - id: session-03
    title: "3. VS Code와 WSL 연동"
  - id: session-04
    title: "4. 프로젝트별 Node.js 버전 자동 적용"
---

## 1. VS Code-WSL 기반 Node.js 개발 환경 설치 {#session-01}

Node.js는 Windows에서도 개발할 수 있지만, 실제 서비스 운영 환경은 대부분 Linux(Ubuntu)입니다.  
Windows에서 직접 Node.js를 설치하여 개발하는 것도 가능하지만, 운영 환경과 차이가 발생해 배포 후 예상치 못한 문제가 발생하는 경우도 있습니다.

이러한 문제를 해결하기 위해 WSL(Windows Subsystem for Linux) 을 이용하여 Windows에서 Ubuntu를 실행하고,  
VSCode의 Remote Development 기능으로 WSL 환경에 접속하여 개발하는 방식을 사용합니다.

### 🟦 VSCode 설치

Visual Studio Code는 Microsoft에서 제공하는 무료 코드 에디터입니다.  
[VS Code 공식 다운로드 페이지](https://code.visualstudio.com/download)에 접속합니다.  
"Windows용 설치 프로그램"을 클릭하여 VSCodeUserSetup-x64-버전번호.exe 파일을 다운로드합니다.
![alt text](/assets/images/nodejs/nodejs-environment/image.png)

### 🟦 VSCode 폰트 설정

VSCode에서 코드 가독성을 높이기 위해 폰트 설정이 중요합니다.

1. Ctrl + ,를 눌러 설정창을 엽니다.
2. Font Family 항목에 원하는 폰트를 입력합니다. (예: "D2Coding", "Consolas", "Courier New", monospace)
3. D2Coding 폰트는 한글 가독성이 좋아 개발자에게 많이 사용됩니다.
4. 설정 변경 후 저장하면 즉시 적용됩니다.

![alt text](/assets/images/nodejs/nodejs-environment/image-1.png)

### 🟦 Remote Development 확장 설치

VSCode가 WSL과 SSH 환경을 사용할 수 있도록 Microsoft에서 제공하는 Remote Development 확장을 설치합니다.  
Remote Development는 여러 개의 확장을 하나로 묶은 Extension Pack이며 다음 기능을 제공합니다.

- Remote - WSL
- Remote - SSH
- Dev Containers

![alt text](/assets/images/nodejs/nodejs-environment/image-2.png)

### 🟦 WSL 설치

WSL(Windows Subsystem for Linux)은 Windows에서 Linux를 실행할 수 있도록 지원하는 기능입니다.

1. Windows (Windows 11) 명령 프롬프트(관리자 권한)에서  wsl을 입력하여 설치를 시작합니다.

   ```bash
   wsl --install
   ```

   ![alt text](/assets/images/nodejs/nodejs-environment/image-3.png)

2. 시스템을 재 부팅 합니다.
3. 명령 프롬프트에서 wsl 설치를 확인합니다.

   ```bash
   wsl --version
   ```

### 🟦 Ubuntu 설치

```bash
# 배포 목록 확인
wsl --list --online
다음은 설치할 수 있는 유효한 배포 목록입니다.
'wsl.exe --install <Distro>'을 사용하여 설치합니다.

NAME                            FRIENDLY NAME
Ubuntu                          Ubuntu
Ubuntu-26.04                    Ubuntu 26.04 LTS
Ubuntu-24.04                    Ubuntu 24.04 LTS
Ubuntu-22.04                    Ubuntu 22.04 LTS
openSUSE-Tumbleweed             openSUSE Tumbleweed
...

# Ubuntu-26.04 설치
> wsl --install -d Ubuntu-26.04

# 설치 확인
> wsl --list
Linux용 Windows 하위 시스템 배포:
Ubuntu-26.04(기본값)

# Ubuntu 실행
> wsl -d Ubuntu-26.04
#처음 실행 시에는 Linux 사용자 계정을 생성합니다.
Username :
Password :

# 계정 생성 후 시스템을 최신 상태로 업데이트합니다.
> sudo apt update
> sudo apt upgrade -y

```

### 🟦 OpenSSH 설치

Remote 기능이나 SSH 접속을 위해 OpenSSH Server를 설치합니다.

```bash
sudo apt install openssh-server

# 서비스 상태를 확인합니다.
> sudo systemctl status ssh
○ ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; disabled; preset: enabled)
     Active: inactive (dead)
TriggeredBy: ● ssh.socket
       Docs: man:sshd(8)
             man:sshd_config(5)

# 실행 중이 아니라면 시작합니다.
> sudo systemctl start ssh

# 부팅 시 자동 실행하도록 설정합니다.
> sudo systemctl enable ssh

```

OpenSSH Server가 설치되면 WSL 내부에서도 SSH 서비스를 사용할 수 있습니다.  
이러한 SSH 환경은 이후 Remote-SSH를 이용한 원격 개발에도 동일하게 활용됩니다

### 🟦 WSL에 Node.js 설치

```bash
 # home 이동
 > cd ~

 # runtimes 경로 생성
 > mkdir runtimes
 > cd runtimes
 > pwd
 /home/ubuntu/runtimes

 # nodejs 설치 (https://nodejs.org/ko/download 에서 경로 확인)
 > wget https://nodejs.org/dist/v24.18.0/node-v24.18.0-linux-x64.tar.xz
 > wget https://nodejs.org/dist/v22.23.1/node-v22.23.1-linux-x64.tar.xz

 # 압축해제
 > tar -xf node-v22.23.1-linux-x64.tar.xz
 > tar -xf node-v24.18.0-linux-x64.tar.xz
```

## 2. VS Code Remote-SSH 원격 개발 환경 구성 {#session-02}

Remote-SSH를 사용하면 VSCode는 Windows에서 실행되지만, 프로젝트 파일과 Node.js 실행 환경은 모두 원격 Ubuntu 서버에서 동작합니다.  
따라서 로컬 환경과 운영 서버의 차이로 발생하는 문제를 줄이고, 서버 자원을 그대로 활용할 수 있습니다.

Remote-SSH를 사용하기 위해서는 원격 Ubuntu 서버에서 SSH 서비스가 실행 중이어야 합니다.  
서버에 접속한 후 다음 명령으로 SSH 서비스 상태를 확인합니다.

```bash
> sudo systemctl status ssh
[sudo: authenticate] Password:
○ ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; disabled; preset: enabled)
     Active: inactive (dead)
TriggeredBy: ● ssh.socket
       Docs: man:sshd(8)
             man:sshd_config(5)
```

### 🟦 VSCode에서 SSH 접속 설정

좌측 하단의 원격 연결(><) 아이콘을 클릭한 후 Connect to Host를 선택합니다.  
처음 연결하는 경우에는 SSH 접속 정보를 입력합니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-4.png)

```bash
ssh username@192.168.0.100
```

VSCode는 해당 정보를 사용자 SSH 설정 파일(~/.ssh/config)에 저장합니다.  
예를 들어 다음과 같이 구성할 수 있습니다.

```sshconfig
Host node-server
    HostName 192.168.0.100
    User ubuntu
    Port 22
```

### 🟦 VSCode에서 SSH 연결하기

![alt text](/assets/images/nodejs/nodejs-environment/image-5.png)
인증이 완료되면 새로운 VSCode 창이 열리면서 원격 서버에 연결됩니다.

원격 연결이 완료되면 VSCode는 자동으로 원격 서버 모드로 전환됩니다.  
이제 File → Open Folder를 선택하여 Node.js 프로젝트가 있는 디렉터리를 엽니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-6.png)

예를 들어 다음과 같은 프로젝트를 사용할 수 있습니다.

```text
/home/ubuntu/blog-workspaces/cericube.github.io
```

프로젝트를 열면 Explorer에는 원격 서버의 파일이 표시되며, 모든 편집 작업은 서버에서 직접 이루어집니다.

### 🟦 .vscode-server

Remote-SSH로 처음 접속하면 VSCode는 원격 서버의 사용자 홈 디렉터리에 .vscode-server 디렉터리를 자동으로 생성합니다.

```text
~/.vscode-server/
```

이 디렉터리는 원격 개발을 위한 VSCode 백엔드(Server) 역할을 수행합니다.

주요 구성은 다음과 같습니다.

| 디렉터리 | 역할 |
| --- | --- |
| `bin/` | VSCode 서버 실행 파일 |
| `extensions/` | 원격 서버에서 사용하는 확장 프로그램 |
| `logs/` | 실행 로그 |
| `data/` | 세션 및 임시 데이터 |
| `server.sh` | VSCode Server 실행 스크립트 |

Remote-SSH 연결 과정은 다음과 같습니다.

```text
VSCode 실행
      │
      ▼
SSH 연결
      │
      ▼
원격 서버 접속
      │
      ▼
.vscode-server 존재 확인
      │
      ├── 없음 → 자동 설치
      │
      └── 있음 → 기존 서버 사용
      │
      ▼
원격 개발 시작
```

즉, VSCode는 SSH 연결만 사용하는 것이 아니라, 원격 서버에 설치된 VSCode Server와 통신하여 파일 탐색, 터미널, 디버깅, IntelliSense, Git, 확장 프로그램 등을 원격 환경에서 실행합니다.  
.vscode-server는 삭제해도 문제가 되지 않으며, 다음 연결 시 현재 VSCode 버전에 맞는 서버가 자동으로 다시 설치됩니다.

## 3. VS Code와 WSL 연동 {#session-03}

VSCode는 Windows에서 실행되지만, 프로젝트 파일, 터미널, Node.js, npm은 모두 Ubuntu(WSL)에서 실행됩니다.  
따라서 Windows를 사용하면서도 Linux 환경에서 개발하는 것과 동일한 경험을 얻을 수 있습니다.

### 🟦 WSL에 연결하기

VSCode에서는 Remote Development 확장의 Remote - WSL 기능을 이용하여 WSL에 쉽게 연결할 수 있습니다.
![alt text](/assets/images/nodejs/nodejs-environment/image-7.png)

원격 연결이 완료되면 VSCode는 자동으로 원격 서버 모드로 전환됩니다.  
이제 File → Open Folder를 선택하여 Node.js 프로젝트가 있는 디렉터리를 엽니다.  
![alt text](/assets/images/nodejs/nodejs-environment/image-8.png)
이 상태가 되면 VSCode는 Windows에서 실행되고 있지만, 터미널과 Node.js 실행 환경은 모두 Ubuntu 내부에서 동작합니다.

### 🟦 Remote-SSH와 WSL의 차이

Remote Development는 여러 가지 원격 개발 방식을 제공합니다.  
가장 많이 사용하는 것이 Remote - WSL과 Remote - SSH입니다.

| 항목     | Remote - WSL      | Remote - SSH |
| ------ | ----------------- | ------------ |
| 연결 대상  | 내 PC의 WSL(Ubuntu) | 원격 Linux 서버  |
| 네트워크   | 로컬                | SSH          |
| 인터넷 필요 | 불필요               | 필요           |
| 실행 위치  | 내 PC              | 원격 서버        |
| 성능     | 매우 빠름             | 네트워크 속도 영향   |
| 주 용도   | 로컬 개발             | 운영 서버, 개발 서버 |

▸ Remote - WSL은 자신의 PC에 설치된 Ubuntu를 사용하는 방식입니다.  
▸ Remote - SSH는 별도의 Linux 서버(예: 개발 서버, AWS EC2, Azure VM 등)에 접속하여 개발하는 방식입니다.

## 4. 프로젝트별 Node.js 버전 자동 적용 {#session-04}

 각 프로젝트에서 VS Code가 자동으로 올바른 Node.js 버전을 인식하도록 설정합니다.  
 이 설정을 적용하면, 프로젝트를 열 때마다 VS Code 터미널이 해당 버전에 맞게 자동 전환되어 빌드 에러나 의존성 불일치 문제를 깔끔하게 방지할 수 있습니다.

### 🟦 .vscode/settings.json으로 환경 변수 재정의

VS Code는 각 프로젝트별로 로컬 설정 디렉터리(.vscode)를 지원합니다.  
여기에 settings.json 파일을 만들어, 해당 프로젝트에서 사용할 Node.js 버전을 명시할 수 있습니다.

예를 들어, Node.js 22 버전을 사용하는 프로젝트라면 다음과 같이 설정합니다

```jsonc
{
  "terminal.integrated.env.linux": {
    "PATH": "/home/ubuntu/runtimes/node-v22.23.1-linux-x64/bin:${env:PATH}"
  }
}
```

이 설정은 VS Code 내장 터미널에만 적용됩니다.  
즉, Ubuntu 전체 PATH에는 영향을 주지 않으며, 해당 프로젝트의 터미널에서만 Node.js 22 버전이 우선 적용됩니다.

다른 프로젝트가 Node.js 24를 필요로 한다면, 단순히 경로만 바꿔주면 됩니다.

```jsonc
{
  "terminal.integrated.env.linux": {
    "PATH": "/home/ubuntu/runtimes/node-v24.18.0-linux-x64/bin:${env:PATH}"
  }
}
```

### 🟦 적용 확인

설정이 제대로 적용되었는지 확인하려면 VS Code 내에서 터미널을 열고 다음을 입력합니다

'''bash
node --version
'''

이 방식은 VS Code의 설정 파일만으로 로컬 PATH를 재정의하므로, 시스템 전체 환경을 건드리지 않으면서도 프로젝트 단위 제어가 가능합니다

### 🟦 Node.js 다중 버전 자동 전환 템플릿 구조

다음은 포터블 Node.js 환경에서 여러 프로젝트가 서로 다른 버전을 자동으로 사용하는 구조 예시입니다.

```text
/home/ubuntu/dev
 ├─ nodejs/
 │   ├─ v18.20.4/
 │   ├─ v20.17.0/
 │   └─ v22.11.0/
 └─ projects/
     ├─ legacy-api/
     │   └─ .vscode/settings.json   → Node 18
     ├─ frontend-vue/
     │   └─ .vscode/settings.json   → Node 20
     └─ nextjs-latest/
         └─ .vscode/settings.json   → Node 22
```

▸ nodejs/: Node.js 포터블 버전 저장소 (버전별로 독립된 실행 환경)  
▸ projects/: 실제 프로젝트 소스 디렉터리  
▸ 각 프로젝트 폴더마다 .vscode/settings.json 파일을 둬서 해당 프로젝트에 필요한 Node.js 버전을 지정합니다.  
