---
layout: post
title: "8편. Redis Stream 실습: 이벤트 로그와 비동기 작업 큐"
description: "Redis Stream을 실습 예제로 이벤트 로그 저장과 비동기 작업 큐를 구현합니다."
category_id: nodejs-redis
categories: [nodejs, nodejs-redis]
series: redis
series_order: 8
ai_assisted: true
toc:
  - id: order-event
    title: "주문 이벤트 저장하기"
  - id: notification-queue
    title: "알림 이벤트 큐 만들기"
  - id: email-queue
    title: "이메일 전송 큐 구현하기"
  - id: audit-log
    title: "감사 로그 저장하기"
---
<h2 id="order-event">1. 주문 이벤트 저장하기</h2>

Redis Stream은ㄹㅇㄴㅁㅁㄴㅇ  이벤트를 순차적으로 저장하는 로그 구조입니다. 주문이 발생할 때마다 주문 정보를 Stream에 추가할 수 있습니다.  
Redis Stream은 이벤트를 순차적으로 저장하는 로그 구조입니다. 주문이 발생할 때마다 주문 정보를 Stream에 추가할 수 있습니다.

Redis Stream은 이벤트를 순차적으로 저장하는 로그 구조입니다. 주문이 발생할 때마다 주문 정보를 Stream에 추가할 수 있습니다.

Redis Stream은 이벤트를 순차적으로 저장하는 로그 구조입니다. 주문이 발생할 때마다 주문 정보를 Stream에 추가할 수 있습니다.

Redis Stream은 이벤트를 순차적으로 저장하는 로그 구조입니다. 주문이 발생할 때마다 주문 정보를 Stream에 추가할 수 있습니다.
```bash
XADD orders * orderId "1001" userId "u001" product "노트북" amount "1200000"
```

> Stream의 ID는 서버가 자동으로 생성하며 시간과 시퀀스 형태로 증가합니다.

<h2 id="notification-queue">2. 알림 이벤트 큐 만들기</h2>

고객에게 발송할 알림 이벤트를 별도의 Stream에 적재합니다.

![alt text](/assets/images/nodejs/nodejs-redis/image.png)

```bash
XADD notifications * type "order_placed" userId "u001" channel "email" message "주문이 접수되었습니다."
```

<h2 id="email-queue">3. 이메일 전송 큐 구현하기</h2>

Consumer Group을 사용하면 여러 Worker가 작업을 나누어 처리할 수 있습니다.

<h2 id="audit-log">4. 감사 로그 저장하기</h2>

처리 성공 후 `XACK`을 호출해 메시지가 정상 처리되었음을 기록합니다.
