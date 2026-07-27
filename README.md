# cericube.github.io

Jekyll과 GitHub Pages로 운영하는 독립 블로그 저장소입니다.

## 로컬 실행

```bash
bundle install
bundle exec jekyll serve --livereload
```

브라우저에서 `http://localhost:4000`으로 접속합니다.

## 새 글 작성

`_posts` 폴더에 `YYYY-MM-DD-title.md` 형식으로 파일을 만듭니다.

```yaml
---
layout: post
title: "글 제목"
description: "글 요약"
category_id: redis
categories: [system-infra, redis]
category_path: "1.시스템&인프라/redis"
---
```

카테고리 정의는 `_data/categories.yml`에서 관리합니다.
