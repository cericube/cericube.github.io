---
layout: post
title: "7편. Redis Sorted Set 실습: 랭킹과 우선순위 처리"
description: "Redis Sorted Set으로 점수 기반 랭킹과 우선순위 처리 방법을 구현합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 7
ai_assisted: true
---
## 랭킹 만들기

Sorted Set은 score를 기준으로 멤버를 자동 정렬합니다.
