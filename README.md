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
├── Gemfile
├── Gemfile.lock
├── _config.yml
├── index.html
├── _layouts/
├── _includes/
├── _data/
├── _posts/
├── assets/
└── README.md
```

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

프로젝트 루트의 `.gitignore`에 다음 내용을 추가합니다.

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

---

## 17. 새 글 작성

글은 `_posts` 디렉터리에 작성합니다.

```text
_posts/
```

파일명은 다음 형식을 사용합니다.

```text
YYYY-MM-DD-title.md
```

예시:

```text
2026-07-27-redis-basic.md
```

기본 Front Matter 예시:

```yaml
---
layout: post
title: "Redis 기본 명령어 정리"
description: "Redis에서 자주 사용하는 기본 명령어를 정리합니다."
category_id: redis
categories:
  - system-infra
  - redis
category_path: "1.시스템&인프라/redis"
---
```

본문은 Front Matter 아래에 Markdown으로 작성합니다.

```markdown
## Redis란?

Redis의 기본 개념을 정리합니다.
```

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
