# Cericube Jekyll Blog

Jekyll과 GitHub Pages를 이용해 운영하는 개인 기술 블로그입니다.

- 로컬 개발 환경: WSL Ubuntu
- 에디터: Visual Studio Code
- 정적 사이트 생성기: Jekyll
- 배포: GitHub Pages
- 저장소: `cericube.github.io`

---

## 1. 프로젝트 경로

WSL에서 프로젝트를 다음 경로에 둡니다.

```bash
~/projects/blog-workspace/cericube.github.io
```

예시:

```bash
cd ~/projects/blog-workspace/cericube.github.io
```

---

## 2. VS Code WSL 확장 설치

Windows의 Visual Studio Code에서 `WSL` 확장을 설치합니다.

확장 ID:

```text
ms-vscode-remote.remote-wsl
```

이 확장을 사용하면 VS Code 터미널, Ruby, Bundler, Jekyll이 Windows가 아니라 WSL Ubuntu 환경에서 실행됩니다.

설치 후 WSL 터미널에서 프로젝트를 엽니다.

```bash
cd ~/projects/blog-workspace/cericube.github.io
code .
```

VS Code 왼쪽 아래에 다음과 같이 표시되는지 확인합니다.

```text
WSL: Ubuntu
```

VS Code 터미널에서 현재 경로도 확인합니다.

```bash
pwd
```

예상 결과:

```text
/home/사용자명/projects/blog-workspace/cericube.github.io
```

---

## 3. WSL 필수 패키지 설치

WSL Ubuntu 터미널에서 패키지 목록을 갱신합니다.

```bash
sudo apt update
```

Ruby, 빌드 도구, Git을 설치합니다.

```bash
sudo apt install -y \
  ruby-full \
  build-essential \
  zlib1g-dev \
  git
```

설치 결과를 확인합니다.

```bash
ruby -v
gem -v
git --version
```

---

## 4. Ruby Gem 설치 경로 설정

`sudo gem install`을 사용하지 않고, 현재 사용자의 홈 디렉터리에 Gem을 설치하도록 설정합니다.

```bash
echo '# Ruby Gems' >> ~/.bashrc
echo 'export GEM_HOME="$HOME/gems"' >> ~/.bashrc
echo 'export PATH="$HOME/gems/bin:$PATH"' >> ~/.bashrc
```

설정을 적용합니다.

```bash
source ~/.bashrc
```

설정값을 확인합니다.

```bash
echo $GEM_HOME
```

예상 결과:

```text
/home/사용자명/gems
```

---

## 5. Bundler와 Jekyll 설치

Bundler와 Jekyll을 설치합니다.

```bash
gem install bundler jekyll
```

설치 결과를 확인합니다.

```bash
bundle -v
jekyll -v
```

프로젝트별 라이브러리 버전은 루트의 `Gemfile`과 `Gemfile.lock`으로 관리합니다.

---

## 6. 프로젝트 파일 확인

프로젝트 루트로 이동합니다.

```bash
cd ~/projects/blog-workspace/cericube.github.io
```

파일을 확인합니다.

```bash
ls
```

주요 구조는 다음과 같습니다.

```text
cericube.github.io/
├── .vscode/
│   └── settings.json
├── Gemfile
├── Gemfile.lock
├── _config.yml
├── index.html
├── _layouts/
├── _includes/
├── _data/
│   └── categories.yml
├── _posts/
│   ├── tech-notes/
│   │   └── tech-notes-concepts/
│   ├── system-infra/
│   │   ├── system-infra-virtualization/
│   │   └── system-infra-ubuntu/
│   └── nodejs/
│       ├── nodejs-environment/
│       ├── nodejs-typescript/
│       ├── nodejs-prisma/
│       ├── nodejs-vitest/
│       ├── nodejs-typebox/
│       └── nodejs-redis/
├── assets/
│   ├── css/
│   ├── images/
│   └── js/
└── README.md
```

`_posts`와 `assets/images`의 하위 디렉터리는 `_data/categories.yml`에 정의한 카테고리 ID 구조를 동일하게 사용합니다.

---

## 7. 프로젝트 의존성 설치

프로젝트 내부에 Ruby Gem을 설치하도록 설정합니다.

```bash
bundle config set --local path vendor/bundle
```

의존성을 설치합니다.

```bash
bundle install
```

설정 내용은 다음 파일에 저장됩니다.

```text
.bundle/config
```

---

## 8. Jekyll 로컬 실행

다음 명령으로 개발 서버를 실행합니다.

```bash
bundle exec jekyll serve --livereload
```

Windows 브라우저에서 접속합니다.

```text
http://localhost:4000
```

`--livereload` 옵션을 사용하면 Markdown, HTML, CSS 등을 수정했을 때 브라우저가 자동으로 갱신됩니다.

WSL 외부에서도 접근할 수 있도록 호스트를 명시하려면 다음과 같이 실행합니다.

```bash
bundle exec jekyll serve \
  --livereload \
  --host 0.0.0.0
```

서버를 종료할 때는 터미널에서 `Ctrl + C`를 누릅니다.

---

## 9. `_config.yml` 설정

`_config.yml`에서 블로그 기본 정보를 확인합니다.

```yaml
title: "cericube IT 잡학 아카이브"
description: "다양한 IT 지식과 학습 내용을 기록하고 정리하는 블로그입니다."

url: "https://cericube.github.io"
baseurl: ""

lang: ko-KR
timezone: Asia/Seoul

markdown: kramdown
permalink: /archives/:categories/:title/
```

`cericube.github.io`는 GitHub 사용자 사이트 저장소이므로 루트 주소로 배포됩니다.

따라서 `baseurl`은 빈 문자열로 설정합니다.

```yaml
baseurl: ""
```

`_config.yml`을 수정한 경우 실행 중인 Jekyll 서버를 다시 시작하는 것이 안전합니다.

---

## 10. Git 사용자 설정

WSL에서 Git 사용자 이름과 이메일을 설정합니다.

```bash
git config --global user.name "cericube"
git config --global user.email "사용할-GitHub-이메일"
```

설정값을 확인합니다.

```bash
git config --global --list
```

---

## 11. 로컬 Git 저장소 초기화

현재 프로젝트가 Git 저장소인지 먼저 확인합니다.

```bash
cd ~/projects/blog-workspace/cericube.github.io
git status
```

아직 Git 저장소가 아니라면 초기화합니다.

```bash
git init
git branch -M main
git add .
git commit -m "Initial Jekyll blog"
```

이미 Git 저장소라면 `git init`은 다시 실행할 필요가 없습니다.

---

## 12. GitHub 원격 저장소 생성

원격 저장소를 연결하기 전에 GitHub에 Repository를 먼저 만들어야 합니다.

GitHub에서 다음 이름으로 Public Repository를 생성합니다.

```text
cericube.github.io
```

생성 순서:

1. GitHub 로그인
2. `New repository` 선택
3. Repository name에 `cericube.github.io` 입력
4. 공개 블로그라면 `Public` 선택
5. `Create repository` 선택

로컬 프로젝트에 이미 `README.md`, `.gitignore`, `Gemfile` 등이 있으므로 GitHub에서 Repository를 만들 때 다음 항목은 생성하지 않는 것이 좋습니다.

```text
Add a README file
Add .gitignore
Choose a license
```

GitHub 저장소 주소는 다음과 같은 형식입니다.

```text
https://github.com/cericube/cericube.github.io.git
```

---

## 13. 원격 저장소 연결 및 Push

현재 등록된 원격 저장소를 확인합니다.

```bash
git remote -v
```

아직 원격 저장소가 없다면 연결합니다.

```bash
git remote add origin https://github.com/cericube/cericube.github.io.git
```

원격 저장소 연결을 확인합니다.

```bash
git remote -v
```

첫 Push를 실행합니다.

```bash
git push -u origin main
```

`-u` 옵션을 사용하면 이후부터는 다음 명령만 실행해도 됩니다.

```bash
git push
```

이미 `origin`이 등록되어 있는데 주소를 변경해야 한다면 다음 명령을 사용합니다.

```bash
git remote set-url origin https://github.com/cericube/cericube.github.io.git
```

---

## 14. GitHub 인증

HTTPS 주소로 Push할 때 GitHub 계정 비밀번호는 사용할 수 없습니다.

GitHub CLI를 사용하면 간단하게 인증할 수 있습니다.

```bash
sudo apt install -y gh
gh auth login
```

안내에 따라 다음 항목을 선택합니다.

```text
GitHub.com
HTTPS
Login with a web browser
```

SSH 키를 GitHub에 등록한 경우 다음 형식의 원격 주소를 사용할 수도 있습니다.

```text
git@github.com:cericube/cericube.github.io.git
```

---

## 15. GitHub Pages 설정

GitHub의 `cericube.github.io` 저장소에서 다음 메뉴로 이동합니다.

```text
Settings
→ Pages
→ Build and deployment
```

다음과 같이 설정합니다.

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

설정을 저장하면 GitHub Pages가 Jekyll 사이트를 빌드하고 배포합니다.

배포 주소:

```text
https://cericube.github.io
```

배포 상태는 저장소의 `Actions` 또는 `Settings → Pages`에서 확인합니다.

---

## 16. `.gitignore` 설정

프로젝트 루트의 `.gitignore`에는 다음 내용이 설정되어 있습니다.

```gitignore
_site/
.sass-cache/
.jekyll-cache/
.jekyll-metadata
.bundle/
vendor/
.DS_Store
```

`Gemfile.lock`은 삭제하지 않고 Git에 포함하는 것을 권장합니다.

`_site`는 Jekyll이 빌드할 때 자동으로 생성되므로 Git으로 관리하지 않습니다.

---

## 17. 새 글 작성

글은 `_posts` 아래에 카테고리 ID와 같은 디렉터리 구조로 작성합니다.

```text
_posts/
└── nodejs/
    └── nodejs-redis/
```

카테고리는 `_data/categories.yml`에서 관리합니다. 사이드바의 카테고리별 글 개수는 이 파일에 직접 입력하지 않고, 각 글의 `category_id`를 기준으로 자동 계산합니다.

새 글의 파일명은 날짜, 시리즈, 시리즈 순서, 글 이름을 조합하는 다음 형식을 권장합니다.

```text
YYYY-MM-DD-series-series_order-title.md
```

예시:

```text
_posts/nodejs/nodejs-redis/2026-07-27-redis-1-redis-basic.md
```

기본 Front Matter 예시:

```yaml
---
layout: post
title: "Redis 기본 명령어 정리"
description: "Redis에서 자주 사용하는 기본 명령어를 정리합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 1
ai_assisted: true
---
```

본문은 Front Matter 아래에 Markdown으로 작성합니다.

```markdown
## Redis란?

Redis의 기본 개념을 정리합니다.
```

Front Matter의 주요 항목은 다음과 같이 사용합니다.

- `title`: 브라우저에 표시할 글 제목
- `description`: 검색엔진과 소셜 공유를 위한 메타 설명
- `category_id`: 사이드바 분류와 같은 카테고리의 이전·다음 글을 결정하는 하위 카테고리 ID
- `categories`: Jekyll URL에 사용할 상위·하위 카테고리 ID
- `series`: 글이 속한 시리즈
- `series_order`: 시리즈 안에서의 글 순서
- `ai_assisted`: `true`이면 본문 하단에 `_config.yml`의 `ai_notice` 문구 표시
- `toc`: 필요한 글에서만 목차 항목을 정의하며, 브라우저에서는 기본적으로 접힌 상태로 표시

글 목록의 본문 미리보기는 `description`을 사용하지 않습니다. 실제 본문의 첫 번째 의미 있는 문단을 읽어 최대 두 줄로 표시합니다.

게시일로부터 7일이 지나지 않은 글에는 제목 옆에 `N` 배지가 자동으로 표시되므로 `new: true`는 작성하지 않습니다.

### 게시글 이미지 관리

게시글 이미지는 `_posts`의 카테고리 경로와 동일한 `assets/images` 하위 경로에 저장합니다.

```text
_posts/nodejs/nodejs-redis/
assets/images/nodejs/nodejs-redis/
```

VS Code에서 Markdown 파일에 이미지를 붙여넣거나 드래그하면 `.vscode/settings.json`의 다음 설정에 따라 대응하는 이미지 디렉터리로 자동 복사됩니다.

```json
{
  "markdown.copyFiles.destination": {
    "/_posts/**/*": "/assets/images/${documentRelativeDirName/^_posts\\/(.*)$/$1/}/"
  },
  "markdown.copyFiles.overwriteBehavior": "nameIncrementally"
}
```

같은 이름의 이미지가 이미 있으면 기존 파일을 덮어쓰지 않고 파일명에 번호를 붙입니다. 게시글에서 사용하는 이미지 URL은 배포 경로의 영향을 받지 않도록 `/assets/images/...`로 시작하는 루트 상대 경로를 권장합니다.

---

## 18. 매일 작업하는 방법

### 프로젝트 열기

```bash
cd ~/projects/blog-workspace/cericube.github.io
code .
```

### Jekyll 실행

```bash
bundle exec jekyll serve --livereload
```

### 변경 사항 확인

```bash
git status
git diff
```

### Commit 및 Push

```bash
git add .
git commit -m "Add new blog post"
git push
```

---

## 19. 자주 사용하는 명령어

```bash
# 프로젝트 이동
cd ~/projects/blog-workspace/cericube.github.io

# VS Code 열기
code .

# 의존성 설치
bundle install

# 로컬 서버 실행
bundle exec jekyll serve --livereload

# 빌드만 실행
bundle exec jekyll build

# Git 상태 확인
git status

# 변경 사항 저장
git add .
git commit -m "Update blog"
git push
```

---

## 20. 문제 해결

### `bundle: command not found`

```bash
source ~/.bashrc
echo $PATH
bundle -v
```

그래도 실행되지 않으면 Bundler를 다시 설치합니다.

```bash
gem install bundler
```

### `jekyll: command not found`

프로젝트에서는 Bundler를 통해 실행합니다.

```bash
bundle exec jekyll serve
```

### Gem 설치 권한 오류

`sudo gem install`을 사용하지 말고 `GEM_HOME` 설정을 확인합니다.

```bash
echo $GEM_HOME
```

### `Address already in use`

기본 포트 `4000`이 이미 사용 중인 상태입니다.

```bash
bundle exec jekyll serve --livereload --port 4001
```

접속 주소:

```text
http://localhost:4001
```

### `_config.yml` 변경이 반영되지 않음

Jekyll 서버를 종료한 뒤 다시 실행합니다.

```bash
bundle exec jekyll serve --livereload
```

### GitHub Pages에서 CSS 또는 링크가 깨짐

`_config.yml`을 확인합니다.

```yaml
url: "https://cericube.github.io"
baseurl: ""
```

Liquid 템플릿에서는 `relative_url` 필터를 사용하는 것이 안전합니다.

```liquid
{{ '/assets/css/main.css' | relative_url }}
```
