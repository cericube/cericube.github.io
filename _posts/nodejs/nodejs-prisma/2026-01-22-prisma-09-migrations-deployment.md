---
layout: post
title: "09. Prisma 데이터베이스 마이그레이션: 개발에서 운영까지"
description: "Prisma 7에서 개발 데이터베이스의 마이그레이션을 생성하고 변경 이력을 관리한 뒤, 환경 변수와 CI/CD를 이용해 운영 데이터베이스에 안전하게 적용하는 방법을 설명합니다."
category_id: nodejs-prisma
categories: [nodejs, nodejs-prisma]
series: prisma
series_order: 9
ai_assisted: true
toc:
  - id: session-01
    title: "1. Prisma에서 DB 동기화의 핵심 개념"
  - id: session-02
    title: "2. 개발용 초기 DB 구축(migrate dev)"
  - id: session-03
    title: "3. 개발 DB 스키마 변경 관리 방법"
  - id: session-04
    title: "4. 환경 변수 기반의 안전한 연결 관리와 자동 배포 프로세스"
---

## 1. Prisma에서 DB 동기화의 핵심 개념 {#session-01}

Prisma에서 데이터베이스 동기화를 올바르게 이해하려면 명령어마다 담당하는 역할을 구분해야 합니다.  
또한 `schema.prisma → migration → DB → Prisma Client`로 이어지는 흐름을 이해해야 합니다.  

### 🟦 Prisma DB 동기화 명령어 역할 정리

| 명령어 | 환경 | 역할 |
| --- | --- | --- |
| `prisma migrate dev` | 개발 | `schema.prisma` 변경을 바탕으로 마이그레이션을 만들고 개발 DB에 적용합니다. Prisma 7에서는 Client를 자동 생성하지 않습니다. |
| `prisma migrate deploy` | 운영·테스트 | 이미 만들어진 마이그레이션 중 아직 적용하지 않은 파일을 순서대로 적용합니다. Client는 생성하지 않습니다. |
| `prisma db push` | 실험·프로토타입 | 마이그레이션 파일을 만들지 않고 스키마를 DB에 바로 반영합니다. Prisma 7에서는 Client를 자동 생성하지 않습니다. |
| `prisma db pull` | 개발 | 기존 DB 구조를 읽어 `schema.prisma`에 반영합니다. Client는 생성하지 않습니다. |
| `prisma generate` | 모든 환경 | `schema.prisma`를 기준으로 Prisma Client를 생성합니다. DB 구조는 변경하지 않습니다. |

### 🟦 `migrate dev`와 `migrate deploy` 비교

두 명령은 모두 마이그레이션을 적용하지만, 사용 환경과 수행하는 검사 범위가 다릅니다.  

| 구분 | `prisma migrate dev` | `prisma migrate deploy` |
| --- | --- | --- |
| 사용 환경 | 로컬 개발 환경 | 운영·스테이징 환경 |
| 마이그레이션 생성 | Prisma 스키마 변경을 분석해 새 마이그레이션 파일을 생성 | 생성하지 않음 |
| 마이그레이션 적용 | 미적용 마이그레이션과 새로 생성한 마이그레이션을 개발 DB에 적용 | 저장소의 미적용 마이그레이션만 적용 |
| 스키마 드리프트 검사 | 수행 | 수행하지 않음 |
| Shadow Database | 필요 | 필요하지 않음 |
| DB 초기화 요청 | 충돌이나 드리프트가 있으면 초기화를 요청할 수 있음 | 자동으로 초기화하지 않음 |
| 주요 목적 | 스키마 변경 개발 및 검증 | 검토·커밋된 변경 배포 |

`migrate dev`는 마이그레이션을 만드는 개발 명령이고, `migrate deploy`는 이미 만들어 검토한 마이그레이션을 반영하는 배포 명령입니다.  

> 드리프트 검사(drift detection)란,  
> 마이그레이션 파일들을 정상적으로 적용했을 때 나와야 하는 DB 구조와, 현재 개발 DB의 실제 구조가 서로 다른지 확인하는 것  
> Prisma에서 DB 구조 변경과 Prisma Client 생성은 서로 다른 작업입니다.  

- DB 구조 변경은 `migrate` 또는 `db push` 명령이 담당합니다.  
- 코드에서 사용할 타입과 Client 생성은 `generate` 명령이 담당합니다.  
- Prisma 7에서는 `migrate dev`가 `generate`를 자동으로 실행하지 않으므로 두 명령을 각각 실행합니다.

```bash
# 개발 환경에서 마이그레이션을 만들고 적용합니다.
npx prisma migrate dev --name add_user_status

# 변경된 스키마에 맞는 Prisma Client를 생성합니다.
npx prisma generate

# 운영 환경에서는 기존 마이그레이션만 적용합니다.
npx prisma migrate deploy

# 애플리케이션 빌드 단계에서 Prisma Client를 생성합니다.
npx prisma generate
```

### 🟦 `prisma generate`를 명시적으로 실행해야 하는 상황

### 🔷 1. Prisma Client 출력 경로를 지정한 경우

Prisma 7의 `prisma-client` 생성기는 `output` 경로를 명시해야 합니다.  
`prisma generate`를 실행하면 해당 경로에 현재 스키마와 일치하는 Client와 타입이 생성됩니다.  

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

### 🔷 2. 스키마의 생성기 설정만 변경한 경우

DB 테이블 구조를 바꾸지 않더라도 Client 생성 방식이 달라지면 `prisma generate`를 다시 실행해야 합니다.  

- `generator`의 `output`, `moduleFormat` 또는 `engineType`을 변경한 경우
- Client 생성에 영향을 주는 Preview 기능 설정을 변경한 경우
- Prisma 패키지 버전을 변경한 뒤 Client를 다시 생성해야 하는 경우

### 🔷 3. CI/CD 배포 파이프라인

운영 환경의 `migrate deploy`는 DB 마이그레이션만 적용하며 Prisma Client를 만들지 않습니다.  
따라서 애플리케이션 빌드와 배포 과정에는 다음 두 작업이 모두 포함되어야 합니다.  

```bash
# 아직 적용하지 않은 마이그레이션을 운영 DB에 반영합니다.
npx prisma migrate deploy

# 배포할 애플리케이션이 사용할 Prisma Client를 생성합니다.
npx prisma generate
```

두 명령의 실행 순서는 배포 구조에 따라 달라질 수 있습니다.  
중요한 점은 Client 생성과 DB 마이그레이션 적용을 서로 다른 단계로 보고 둘 다 수행하는 것입니다.  

## 2. 개발용 초기 DB 구축(migrate dev) {#session-02}

스키마 구조는 [01편의 실습용 스키마](/archives/nodejs/nodejs-prisma/prisma-01-setup/)를 기준으로 사용합니다.  

Prisma Migrate는 스키마를 DB에 적용할 뿐 아니라 SQL 마이그레이션 파일로 변경 이력을 관리하는 도구입니다.  

### 🟦 최초 마이그레이션 생성 및 반영

```bash
# 현재 schema.prisma를 기준으로 최초 마이그레이션을 만들고 개발 DB에 적용합니다.
npx prisma migrate dev --name init_schema

# Prisma 7에서는 Client를 별도로 생성합니다.
npx prisma generate
```

`migrate dev` 명령은 내부에서 다음 작업을 수행합니다.  

- 기존 마이그레이션 이력을 Shadow Database에 다시 실행하여 스키마 드리프트를 확인합니다.  
- `schema.prisma`의 변경 사항을 분석해 `prisma/migrations` 아래에 SQL 파일을 만듭니다.  
- 아직 적용하지 않은 마이그레이션을 개발 데이터베이스에 적용합니다.  
- 실행 결과를 데이터베이스의 `_prisma_migrations` 테이블에 기록합니다.  

Prisma 7에서는 이 과정이 끝난 뒤 `npx prisma generate`를 직접 실행해야 합니다.  

### 🟦 운영 환경에서 주의할 점

`migrate dev`는 스키마 드리프트나 마이그레이션 이력 충돌을 발견하면 개발 DB 초기화를 요청할 수 있습니다.  
따라서 운영 DB에서는 사용하지 않아야 합니다.  
운영 환경에서는 `npx prisma migrate deploy`로 이미 검토한 마이그레이션을 적용합니다.  

마이그레이션 디렉터리는 다음과 같은 구조입니다.  

```text
prisma/
└── migrations/
    └── 20260101_init_schema/
        └── migration.sql
```

### 🟦 동일한 명령을 다시 실행하는 경우

### 🔷 1. `schema.prisma`에 변경이 없는 경우

DB와 마이그레이션 이력, 스키마가 일치한다면 새 마이그레이션을 만들지 않습니다.  
이 경우 새 파일을 만들 변경 사항이 없으므로 `--name` 값도 사용되지 않습니다.  

```console
> npx prisma migrate dev --name init_schema

Already in sync, no schema change or pending migration was found.
```

### 🔷 2. `schema.prisma`에 변경이 있는 경우

스키마를 변경했다면 다음 절에서 설명하는 흐름에 따라 새로운 마이그레이션을 생성하고 적용합니다.  

## 3. 개발 DB 스키마 변경 관리 방법 {#session-03}

### 🟦 Prisma Migrate의 내부 동작 흐름 이해하기

`npx prisma migrate dev`를 실행하면 Prisma는 다음 순서로 작업합니다.  

### 🔷 1단계: 현재 상태 파악(Scanning)

- Shadow Database에 기존 마이그레이션 이력을 처음부터 다시 적용합니다.  
- 개발 DB를 확인하여 마이그레이션 이력의 최종 상태와 실제 DB 구조가 다른지 검사합니다.  
- DB의 `_prisma_migrations` 테이블에서 이미 적용한 마이그레이션을 확인합니다.  

### 🔷 2단계: 차이점 계산(Diffing)

- 기존 마이그레이션의 최종 상태와 현재 `schema.prisma`가 원하는 상태를 비교합니다.  
- Shadow Database를 이용해 스키마 드리프트와 새 변경 사항의 데이터 손실 가능성을 확인합니다.  
- 테이블 추가, 필드 타입 변경, 인덱스와 제약 조건 변경 등을 분석합니다.  

Shadow Database는 개발 DB와 분리된 임시 데이터베이스입니다.  
직접 설정하는 경우에는 개발 DB와 동일한 URL을 사용하면 데이터가 삭제될 수 있으므로 반드시 별도의 DB를 지정해야 합니다.  

### 🔷 3단계: 변경 사항 처리(Execution)

비교 결과 변경 사항이 있으면 다음 작업을 순서대로 수행합니다.  

1. 변경 내용을 SQL로 변환하여 `prisma/migrations` 아래에 타임스탬프 기반 디렉터리와 `migration.sql`을 생성합니다.  
2. 생성한 SQL과 아직 적용하지 않은 마이그레이션을 개발 DB에 적용합니다.  
3. `_prisma_migrations` 테이블에 적용 결과와 실행 정보를 기록합니다.  
4. 명령이 끝나면 `npx prisma generate`를 별도로 실행하여 최신 Prisma Client를 생성합니다.  

### 🟦 예시: User 모델에 `status` 컬럼 추가

현재 실습용 `User` 모델에 기본값이 `ACTIVE`인 `status` 필드를 추가합니다.  

```prisma
model User {
  id          Int      @id @default(autoincrement())
  email       String   @unique
  displayName String?  @map("display_name")
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now()) @map("created_at")

  // 기존 Post와 PostLike 관계는 그대로 유지합니다.
  posts Post[]
  likes PostLike[]

  @@map("users")
}
```

스키마를 저장한 뒤 변경 목적이 드러나는 이름으로 마이그레이션을 생성합니다.  
그다음 Prisma Client를 명시적으로 다시 생성합니다.  

```console
> npx prisma migrate dev --name add_user_status

Applying migration `20260108002217_add_user_status`

The following migration(s) have been created and applied from new schema changes:

prisma/migrations/
└── 20260108002217_add_user_status/
    └── migration.sql

Your database is now in sync with your schema.

> npx prisma generate

Generated Prisma Client to ./generated/prisma
```

다음 화면은 기존 실습 DB의 `users` 테이블에 `status` 컬럼과 기본값이 적용된 결과입니다.  
스크린샷의 다른 컬럼과 테이블은 촬영 당시 실습 스키마에 포함된 항목입니다.  

![개발 DB의 User 데이터에 status 컬럼이 적용된 결과](/assets/images/nodejs/nodejs-prisma/image-2026-01-22-user-status-data.png)

### 🟦 실무 권장 네이밍 규칙

Prisma 마이그레이션은 이름이 아니라 디렉터리의 타임스탬프를 기준으로 실행 순서를 결정합니다.  
협업할 때 변경 내용을 빠르게 파악할 수 있도록 `행위 + 대상` 형태의 이름을 사용하는 것이 좋습니다.  

| 유형 | 권장 예시 | 설명 |
| --- | --- | --- |
| 초기 생성 | `init` 또는 `initial_schema` | 프로젝트의 기본 테이블과 스키마를 만듭니다. |
| 컬럼 추가 | `add_user_status` | 특정 테이블에 새 필드를 추가합니다. |
| 컬럼 수정 | `alter_post_content_type` | 컬럼 타입이나 제약 조건을 변경합니다. |
| 삭제 작업 | `remove_old_logs` | 사용하지 않는 테이블이나 컬럼을 제거합니다. |
| 인덱스 추가 | `add_idx_user_email` | 조회 성능을 위한 인덱스를 생성합니다. |

## 4. 환경 변수 기반의 안전한 연결 관리와 자동 배포 프로세스 {#session-04}

### 🟦 운영 DB 연결 관리의 핵심: 격리 및 주입

운영 DB의 보안과 안정성을 지키려면 연결 정보를 소스 코드와 분리해야 합니다.  
애플리케이션과 마이그레이션 작업은 실행 환경의 Secret 또는 환경 변수로 주입한 `DATABASE_URL`을 사용합니다.  

### 🔷 로컬 환경

로컬에서는 Git에 커밋하지 않는 `.env` 파일로 개발 DB 연결 정보를 관리합니다.  
개발 DB에서 `prisma migrate dev`를 실행하여 스키마와 마이그레이션을 설계합니다.  

### 🔷 운영 환경

운영 DB의 자격 증명을 저장소의 설정 파일에 포함하지 않습니다.  
서버의 Secret 관리 기능이나 CI/CD 시스템의 암호화된 Secret을 통해 `DATABASE_URL`을 주입합니다.  

### 🟦 운영 DB 반영 및 배포 워크플로

운영 환경에서는 검토를 완료하고 저장소에 반영된 마이그레이션 파일만 적용해야 합니다.  
배포를 실행하기 전에 운영 데이터베이스에 연결할 DATABASE_URL이 실행 환경에 설정되어 있는지 확인합니다.  
또한 데이터베이스 초기화로 인한 데이터 손실 위험을 방지하기 위해 migrate dev가 아닌 migrate deploy를 사용합니다.  

다음 PowerShell 예제는 배포 환경에서 `DATABASE_URL`이 Secret으로 이미 주입되었다고 가정합니다.  

```powershell
# 1. 운영 DB 연결 정보가 주입되었는지 확인합니다.
if (-not $env:DATABASE_URL) {
  throw 'DATABASE_URL 환경 변수가 필요합니다.'
}

# 2. 애플리케이션이 사용할 Prisma Client를 생성합니다.
npx prisma generate

# 3. 아직 적용하지 않은 마이그레이션을 운영 DB에 적용합니다.
npx prisma migrate deploy
```

다음 화면은 예시 운영 DB에 준비된 마이그레이션을 적용한 결과입니다.  

![운영 DB에 마이그레이션을 적용한 터미널 결과](/assets/images/nodejs/nodejs-prisma/image-2026-01-22-migrate-deploy.png)

적용이 끝난 뒤 DB 관리 도구에서 `status` 컬럼이 추가되었는지 확인할 수 있습니다.  
화면에 표시된 다른 테이블은 촬영 당시 예시 DB의 구조입니다.  

![운영 DB의 users 테이블에 status 컬럼이 추가된 결과](/assets/images/nodejs/nodejs-prisma/image-2026-01-22-user-status-schema.png)
