---
layout: post
title: "5편. Redis List 실습: 최근 기록과 간단한 버퍼 처리"
description: "Redis List로 최근 기록 저장과 간단한 버퍼 처리 전략을 실습합니다."
category_id: redis
categories: [system-infra, redis]
category_path: "1.시스템&인프라/redis"
---
## 최근 기록 저장하기

List의 LPUSH와 LTRIM을 조합하면 최근 항목만 유지할 수 있습니다.
