---
layout: post
title: "4편. Redis Hash 실습: 프로필, 세션, 재고, 사용자 설정"
description: "Redis Hash로 프로필, 세션, 재고 상태와 사용자 설정을 관리하는 방법을 실습합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
---
## Redis Hash 시작하기

Hash는 하나의 키 아래 여러 필드를 저장할 때 적합합니다.

```bash
HSET user:1001 name "Kim" role "admin"
HGETALL user:1001
```
