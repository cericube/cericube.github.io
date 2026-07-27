---
layout: post
title: "6편. Redis Set 실습: 중복 제거와 상태 관리"
description: "Redis Set을 활용한 중복 제거, 멤버십 관리, 교집합과 합집합 처리 방법을 정리합니다."
category_id: redis
categories: [system-infra, redis]
category_path: "1.시스템&인프라/redis"
---
## 중복 제거

Set은 동일한 값을 한 번만 저장하므로 방문자나 좋아요 사용자 관리에 적합합니다.
