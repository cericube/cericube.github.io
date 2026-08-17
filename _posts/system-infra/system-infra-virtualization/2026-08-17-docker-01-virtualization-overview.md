---
layout: post
title: "[Docker]1편. 가상화 개요: 하이퍼바이저와 컨테이너 비교"
description: "Docker를 이해하는 데 필요한 가상화 개념을 살펴보고, 하이퍼바이저 기반 가상 머신과 컨테이너의 구조와 차이를 비교합니다."
category_id: system-infra-virtualization
categories: [system-infra, system-infra-virtualization]
series: docker
series_order: 01
ai_assisted: true
toc:
  - id: session-01
    title: "1. 가상화란?"
  - id: session-02
    title: "2. 하이퍼바이저(Hypervisor) 기반 가상화"
  - id: session-03
    title: "3. 컨테이너(Container) 기반 가상화"
  - id: session-04
    title: "4. VM과 컨테이너 비교"
---

## 1. 가상화란? {#session-01}

가상화(Virtualization)는 물리적인 컴퓨터 자원을 논리적으로 나누어 여러 독립된 환경을 실행하는 기술입니다.  
하나의 물리 서버에서 여러 운영체제를 동시에 실행할 수 있으며, 비용을 절감하고 자원을 효율적으로 활용할 수 있습니다.  
주요 방식으로는 서버, 네트워크, 스토리지와 애플리케이션 가상화가 있습니다.  

![하이퍼바이저와 컨테이너 가상화 방식 개요](/assets/images/system-infra/system-infra-virtualization/virtualization-overview.png)

## 2. 하이퍼바이저(Hypervisor) 기반 가상화 {#session-02}

하이퍼바이저(Hypervisor)는 가상 머신(VM)을 실행하고 관리하는 핵심 소프트웨어입니다.  
물리 자원에 대한 접근을 제어하고 각 가상 머신에 독립된 실행 환경을 제공합니다.  
하이퍼바이저는 실행 위치에 따라 두 가지 유형으로 나뉩니다.  

![Type 1과 Type 2 하이퍼바이저 구조](/assets/images/system-infra/system-infra-virtualization/hypervisor-types.png)

### 🟦 Type 1(Native, Bare-Metal)

- 하이퍼바이저가 하드웨어 바로 위에서 실행되는 방식입니다.
- 하이퍼바이저가 프로세서, 메모리와 장치 등 하드웨어 자원에 대한 접근을 제어하므로 자원을 효율적으로 사용할 수 있습니다.
- Type 2처럼 범용 호스트 운영체제 위에서 실행되지 않아 오버헤드가 비교적 적지만, 제품에 따라 관리용 파티션이나 하드웨어 드라이버가 필요할 수 있습니다.
- 대표적인 Type 1 하이퍼바이저로는 Xen, Microsoft Hyper-V와 KVM이 있습니다.
- 가상 머신이 하이퍼바이저와 상호작용하는 방식은 전가상화와 반가상화로 설명할 수 있으며, 현대 환경에서는 두 방식의 기술을 함께 사용하기도 합니다.

![전가상화와 반가상화의 동작 비교](/assets/images/system-infra/system-infra-virtualization/full-vs-paravirtualization.png)

### 🔷 1) 전가상화(Full Virtualization)

- 전가상화는 게스트 운영체제가 물리 하드웨어와 유사한 가상 하드웨어를 사용하도록 제공하는 방식입니다.
- 게스트 운영체제가 특권 명령을 실행하면 하이퍼바이저가 하드웨어 가상화 기능이나 에뮬레이션을 이용해 해당 요청을 처리하고 자원 접근을 제어합니다.

### 🔷 2) 반가상화(Paravirtualization)

- 전통적인 반가상화는 게스트 운영체제가 가상 환경임을 인식하고, 수정된 커널에서 하이퍼콜(Hypercall)을 호출하는 방식입니다.
- 현대 운영체제에서는 커널 전체를 수정하는 대신 가상화 환경에 맞춘 드라이버나 통합 기능을 함께 사용하는 경우도 많습니다.
- 게스트 운영체제는 하이퍼콜을 통해 필요한 작업을 하이퍼바이저에 요청하며, 하이퍼바이저는 해당 요청에 따라 하드웨어 자원을 제어합니다.

### 🟦 Type 2(Hosted)

- 호스트형 하이퍼바이저는 일반적인 소프트웨어처럼 호스트 운영체제 위에서 실행됩니다.
- 호스트 운영체제와 장치 드라이버를 통해 가상 머신에 가상 하드웨어를 제공하므로 Type 1보다 계층이 하나 더 존재합니다.
- 호스트 운영체제와 하이퍼바이저가 지원하는 범위에서 여러 종류의 게스트 운영체제를 실행할 수 있으며, 데스크톱과 노트북에서도 편리하게 사용할 수 있습니다.
- 대표적인 Type 2 하이퍼바이저로는 VMware Workstation과 Oracle VirtualBox가 있습니다.

## 3. 컨테이너(Container) 기반 가상화 {#session-03}

컨테이너는 호스트 운영체제의 커널을 공유하면서 각 애플리케이션에 격리된 실행 환경을 제공하는 기술입니다.  
가상 머신보다 필요한 자원이 적고 빠르게 시작할 수 있으며, 네임스페이스 등을 통해 독립된 파일 시스템과 네트워크 공간을 제공합니다.  
Docker는 대표적인 컨테이너 기술입니다.  

> 위 설명은 Docker Engine이 Linux 호스트에서 직접 실행되는 환경을 기준으로 합니다.  
> Docker Desktop에서 Linux 컨테이너는 Docker Desktop이 실행하는 Linux 가상 머신의 커널을 공유합니다.  

![Docker 컨테이너의 실행 구조](/assets/images/system-infra/system-infra-virtualization/container-architecture.png)

## 4. VM과 컨테이너 비교 {#session-04}

![컨테이너와 가상 머신의 구조 비교](/assets/images/system-infra/system-infra-virtualization/vm-container-comparison.png)

| 항목 | 컨테이너(Container) | 가상 머신(VM) |
| --- | --- | --- |
| 가상화 수준 | 운영체제 수준의 가상화 기술 | 하드웨어 수준의 가상화 기술 |
| 운영 방식 | 호스트 커널을 공유하며 격리된 프로세스로 실행 | 각 가상 머신이 독립된 게스트 운영체제와 커널을 포함 |
| 자원 사용 | 가상 머신보다 상대적으로 적음 | 게스트 운영체제를 포함하므로 상대적으로 많음 |
| 시작 속도 | 일반적으로 빠름 | 운영체제 부팅이 필요해 상대적으로 오래 걸림 |
| 격리 수준 | 네임스페이스와 제어 그룹을 이용해 격리하지만 호스트 커널을 공유 | 하이퍼바이저를 경계로 게스트 운영체제와 커널을 분리 |
| 실행 가능한 애플리케이션 수 | 같은 자원에서 상대적으로 많이 실행 가능 | 같은 자원에서 상대적으로 적게 실행 가능 |
| 대표 기술 | Docker, containerd, Kubernetes(오케스트레이션) | VMware, KVM, Hyper-V, VirtualBox |

가상 머신은 운영체제와 커널을 분리해 비교적 강한 격리를 제공하고, 컨테이너는 호스트 커널을 공유해 자원을 적게 사용하면서 빠르게 실행할 수 있습니다.  
