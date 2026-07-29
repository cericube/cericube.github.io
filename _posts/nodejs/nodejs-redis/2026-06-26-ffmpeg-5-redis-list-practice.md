---
layout: post
title: "5편. fffmpeg Redis List 실습: 최근 기록과 간단한 버퍼 처리"
description: "Redis List로 최근 기록 저장과 간단한 버퍼 처리 전략을 실습합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 5
ai_assisted: true
---
## 최근 기록 저장하기

List의 LPUSH와 LTRIM을 조합하면 최근 항목만 유지할 수 있습니다.
