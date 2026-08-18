---
layout: post
title: "[VirtualBox]2편. 가상 머신 생성·복제·가져오기·내보내기"
description: "VirtualBox에서 ISO 또는 기존 VDI로 가상 머신을 만들고, 전체 복제와 OVA 내보내기·가져오기로 가상 머신을 복사하거나 이동하는 방법을 정리합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: virtualbox
series_order: 02
ai_assisted: true
toc:
  - id: session-01
    title: "1. 가상 머신 새로 만들기(ISO 설치)"
  - id: session-02
    title: "2. VDI 이미지로 가상 머신 만들기"
  - id: session-03
    title: "3. 가상 머신 복제하기(Full Clone)"
  - id: session-04
    title: "4. 가상 머신 내보내기/가져오기(OVA)"
---

VirtualBox에서 가상 머신을 생성하고 복제하거나 가져오고 내보내는 과정을 정리합니다.  
Ubuntu 등의 운영체제를 설치하거나 VDI 이미지를 활용해 가상 환경을 구성할 수 있으며, 테스트와 이동을 목적으로 가상 머신을 복제하거나 내보낼 수도 있습니다.  

## 1. 가상 머신 새로 만들기(ISO 설치) {#session-01}

VirtualBox에서 Ubuntu 등의 운영체제를 직접 설치해 가상 머신을 만드는 방법입니다.  

- [Ubuntu Desktop 이미지 다운로드](https://ubuntu.com/download/desktop)
- [Ubuntu 다운로드 미러 목록](https://launchpad.net/ubuntu/+cdmirrors)

1. VirtualBox를 실행하고 `새로 만들기`를 클릭합니다.  

   ![VirtualBox 새 가상 머신 만들기 메뉴](/assets/images/system-infra/system-infra-virtualization/virtualbox-new-vm-menu.png)

2. 가상 머신 이름을 입력하고 설치할 ISO 이미지를 선택합니다.  

   ![가상 머신 이름과 Ubuntu ISO 이미지 선택 화면](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-name-iso.png)

3. 하드웨어 설정에서 가상 머신의 메모리와 프로세서 값을 설정합니다.  

   가상 머신 생성을 마친 뒤에도 메모리와 프로세서 값을 변경할 수 있습니다.  

   ![가상 머신 메모리와 프로세서 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-hardware.png)

4. 가상 하드 디스크 파일의 위치와 용량을 설정합니다.  

   ![가상 하드 디스크 위치와 용량 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-disk.png)

5. 가상 머신 목록에서 가상 머신을 두 번 클릭하거나 `시작` 버튼을 누르면 해당 가상 머신이 실행됩니다.  

6. ISO 이미지로 정상적으로 부팅되면 Ubuntu 설치 프로그램이 시작됩니다.  

## 2. VDI 이미지로 가상 머신 만들기 {#session-02}

Linux 또는 Unix 계열 운영체제가 미리 설치된 VirtualBox용 VDI 이미지로 가상 머신을 만드는 방법입니다.  
이 글에서는 [OSBoxes의 VirtualBox 이미지](https://www.osboxes.org/virtualbox-images/)를 예로 사용합니다.  
OSBoxes 이미지는 Ubuntu가 공식 배포하는 이미지가 아닌 서드파티 이미지이므로 출처와 체크섬을 확인한 뒤 사용해야 합니다.  

1. 내려받은 압축 파일을 풀고 VDI 파일을 확인합니다.  

   예: `Ubuntu Server 24.04 (64bit).7z` 압축 해제 후 `.vdi` 파일을 확인합니다.  

2. 가상 머신 만들기 화면에서 가상 머신 이름을 입력하고 ISO 이미지는 선택하지 않습니다.  

   ![VDI용 가상 머신 이름 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-vdi-vm-name.png)

3. 하드웨어 설정에서는 기본값을 사용해도 되며, 가상 머신을 만든 뒤 메모리와 프로세서 값을 변경할 수 있습니다.  

4. 하드 디스크 설정에서 `가상 하드 디스크를 추가하지 않음`을 선택합니다.  

   `기존 가상 하드 디스크 파일 사용`을 선택해 VDI 파일을 바로 연결할 수도 있지만, 여기서는 가상 머신 파일과 VDI 파일을 같은 폴더에서 관리하기 위해 나중에 연결합니다.  

   ![가상 하드 디스크를 추가하지 않는 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-no-virtual-disk.png)

5. `완료`를 클릭하면 지정한 기본 머신 폴더 아래에 가상 머신 폴더가 생성됩니다.  

   이 글의 예시 경로는 `D:\Virtual-Machines\ubuntu-24.04-server`입니다.  

   ![생성된 VirtualBox 가상 머신 폴더](/assets/images/system-infra/system-infra-virtualization/virtualbox-vm-folder.png)

6. 내려받은 `Ubuntu Server 24.04 (64bit).vdi` 파일을 가상 머신 폴더로 복사합니다.  

   ![가상 머신 폴더로 복사한 VDI 파일](/assets/images/system-infra/system-infra-virtualization/virtualbox-vdi-file.png)

7. 가상 머신의 `설정 > 저장소`로 이동하고 하드 디스크 추가 버튼을 눌러 복사한 VDI 파일을 선택합니다.  

   ![VirtualBox 저장소 설정에서 VDI 파일 추가](/assets/images/system-infra/system-infra-virtualization/virtualbox-add-vdi.png)

8. 저장소에 VDI가 추가되었는지 확인하고 `시작`을 눌러 가상 머신을 실행합니다.  

   ![VirtualBox 저장소에 추가된 VDI 확인](/assets/images/system-infra/system-infra-virtualization/virtualbox-vdi-storage.png)

   ![OSBoxes Ubuntu Server 가상 머신 실행 화면](/assets/images/system-infra/system-infra-virtualization/virtualbox-vdi-vm-start.png)

> OSBoxes 이미지의 초기 계정 정보는 다음과 같습니다.  
>
> - 사용자명: `osboxes`
> - 비밀번호: `osboxes.org`
>
> 공개된 공용 계정 정보이므로 처음 로그인한 뒤 비밀번호를 반드시 변경합니다.  

## 3. 가상 머신 복제하기(Full Clone) {#session-03}

가상 머신을 복제하면 기존 설정을 유지한 새로운 가상 머신을 만들 수 있습니다.  
테스트 환경을 만들거나 동일한 환경을 여러 개 생성할 때 유용합니다.  
복제한 뒤에도 메모리와 CPU 등의 설정을 개별적으로 변경할 수 있습니다.  

1. 복제할 가상 머신을 선택하고 마우스 오른쪽 버튼으로 클릭한 뒤 `복제`를 선택합니다.  

   ![VirtualBox 가상 머신 복제 메뉴](/assets/images/system-infra/system-infra-virtualization/virtualbox-clone-menu.png)

2. 복제할 가상 머신의 이름을 설정합니다.  

3. `완전한 복제`를 선택하고 필요에 따라 복제할 스냅샷 범위를 선택합니다.  

4. 원본과 복제본을 동시에 실행할 수 있다면 MAC 주소 정책에서 `모든 네트워크 어댑터의 새 MAC 주소 생성`을 선택해 주소 중복을 방지합니다.  

   ![완전한 복제와 새 MAC 주소 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-full-clone-settings.png)

완전한 복제를 완료하면 원본 가상 디스크의 데이터가 복사된 새로운 VDI 파일과 이 VDI를 사용하는 가상 머신이 함께 생성됩니다.  
복제된 가상 머신은 원본 가상 머신과 독립적으로 동작합니다.  

가상 머신 등록 정보 없이 복제된 VDI 파일만 가지고 있다면 새 가상 머신을 생성한 뒤 `설정 > 저장소`에서 해당 VDI를 기존 가상 하드 디스크로 연결합니다.  
운영체제를 새로 설치하지 않아도 VDI에 저장된 운영체제와 데이터를 그대로 사용할 수 있습니다.  

## 4. 가상 머신 내보내기/가져오기(OVA) {#session-04}

가상 머신을 OVA 파일로 내보내 저장하거나 다른 PC와 VirtualBox 환경에서 가져와 실행할 수 있습니다.  

> OVA(Open Virtual Appliance)는 OVF 설명 파일과 가상 디스크 등의 구성 파일을 하나로 묶은 아카이브 파일입니다.  
> 일반적으로 `.ova` 확장자를 사용하며 TAR 형식의 변형으로 패키징됩니다.  
> 여러 가상화 제품이 OVF와 OVA를 지원하지만 제품별 지원 범위가 다르므로 가져온 뒤 가상 하드웨어 설정을 확인해야 합니다.  

### 🟦 가상 머신 내보내기

1. `내보내기`를 선택하고 내보낼 가상 머신을 선택합니다.  

   ![내보낼 VirtualBox 가상 머신 선택](/assets/images/system-infra/system-infra-virtualization/virtualbox-export-vm-selection.png)

2. 내보내기 형식을 선택합니다.  

   화면에서는 기본값인 `Open Virtualization Format 1.0`을 사용합니다.  

3. 파일 저장 위치와 MAC 주소 정책을 선택한 뒤 `완료`를 클릭합니다.  

   ![OVA 내보내기 형식과 저장 위치 설정](/assets/images/system-infra/system-infra-virtualization/virtualbox-export-ova-settings.png)

### 🟦 가상 머신 가져오기

1. `가져오기`를 선택하고 가져올 `.ova` 파일을 선택합니다.  

   ![가져올 OVA 파일 선택](/assets/images/system-infra/system-infra-virtualization/virtualbox-import-ova-selection.png)

2. 가상 머신 이름, 저장 경로, MAC 주소 정책을 설정합니다.  

   원본 가상 머신과 같은 네트워크에서 함께 실행할 수 있다면 새 MAC 주소를 생성하는 정책을 선택합니다.  

   ![OVA 가져오기 설정과 새 MAC 주소 정책](/assets/images/system-infra/system-infra-virtualization/virtualbox-import-ova-settings.png)

3. `완료`를 클릭해 가져오기를 마친 뒤 가상 머신을 실행합니다.  

   ![OVA에서 가져온 VirtualBox 가상 머신](/assets/images/system-infra/system-infra-virtualization/virtualbox-imported-vm.png)

VirtualBox에서 가상 머신을 만드는 방법에는 ISO를 이용해 운영체제를 설치하는 방법과 기존 VDI 이미지를 연결하는 방법이 있습니다.  
가상 머신 복제를 사용하면 동일한 환경을 쉽게 복사할 수 있으며, OVA 내보내기와 가져오기를 사용하면 다른 VirtualBox 환경으로 가상 머신을 옮길 수 있습니다.  
