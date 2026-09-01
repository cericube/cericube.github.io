---
layout: post
title: "01. Cookie와 브라우저 저장소의 수명·공유 범위·보안"
description: "Cookie, localStorage, sessionStorage, IndexedDB, Cache Storage의 수명과 탭 사이의 공유 범위를 비교합니다. 인증 정보와 일반 데이터를 어떤 저장소에 보관해야 안전한지 실무 보안 설정과 함께 알아봅니다."
category_id: tech-notes-concepts
categories: [tech-notes, tech-notes-concepts]
series: web-storage
series_order: 1
ai_assisted: true
toc:
  - id: session-01
    title: "1. 전체 비교"
  - id: session-02
    title: "2. Cookie"
  - id: session-03
    title: "3. localStorage와 sessionStorage"
  - id: session-04
    title: "4. IndexedDB와 Cache Storage"
---

## 1. 전체 비교 {#session-01}

웹 애플리케이션은 브라우저에 데이터를 보관할 때 여러 저장소를 사용할 수 있습니다.  
저장소마다 데이터가 유지되는 기간, 다른 탭과 데이터를 공유하는 방식, 서버로 자동 전송되는지가 다릅니다.  

| 저장소 | 기본 수명 | 같은 출처의 탭 간 공유 | 서버 자동 전송 | 대표 용도 |
| --- | --- | --- | --- | --- |
| Cookie | 세션 종료 또는 지정한 만료 시점까지 | O | 조건 일치 시 O | 인증 세션, 서버와 공유할 작은 데이터 |
| `localStorage` | 직접 삭제하거나 브라우저가 제거할 때까지 | O | X | 테마, 언어, 단순한 Key-Value 설정 |
| `sessionStorage` | 해당 탭을 닫을 때까지 | X | X | 탭별 입력 상태, 일시적인 화면 상태 |
| IndexedDB | 직접 삭제하거나 브라우저가 제거할 때까지 | O | X | 대용량 구조화 데이터, 오프라인 데이터 |
| Cache Storage | 직접 삭제하거나 브라우저가 제거할 때까지 | O | X | 요청·응답 캐시, PWA와 Service Worker |

`localStorage`, `sessionStorage`, IndexedDB, Cache Storage는 **출처(Origin)**를 기준으로 저장 공간을 구분합니다.  
출처는 프로토콜, 호스트, 포트의 조합을 말합니다.  
예를 들어 `https://example.com`과 `https://example.com:8443`은 포트가 다르므로 서로 다른 출처입니다.  

Cookie는 출처만으로 범위를 구분하지 않습니다. Domain, Path, Secure, SameSite 등의 조건에 따라 전송 범위가 달라집니다.  
따라서 저장소를 선택할 때는 수명뿐 아니라 JavaScript에서 접근할 수 있는지, 서버로 자동 전송되는지도 함께 확인해야 합니다.  

📌 표의 수명은 일반 모드의 기본 동작을 나타냅니다. 사용자가 사이트 데이터를 지우거나 비공개 모드를 종료할 때, 또는 저장 공간이 부족해 브라우저가 데이터를 정리할 때는 데이터가 더 일찍 사라질 수 있습니다.  

## 2. Cookie {#session-02}

Cookie는 브라우저에 저장되는 작은 문자열 형태의 데이터입니다.  
Domain, Path, Secure, SameSite 등의 조건이 일치하면 브라우저가 Cookie를 HTTP 요청의 `Cookie` 헤더에 자동으로 담습니다.  
서버가 브라우저에 Cookie를 저장할 때는 응답의 `Set-Cookie` 헤더를 사용합니다.  

### 🟦 세션 Cookie와 영구 Cookie

| 구분 | 만료 설정 | 브라우저 종료 후 | 대표 용도 |
| --- | --- | --- | --- |
| 세션 Cookie | `Expires`, `Max-Age` 생략 | 일반적으로 제거되지만 복원될 수 있음 | 짧은 브라우저 세션 |
| 영구 Cookie | `Expires` 또는 `Max-Age` 지정 | 만료 시점까지 유지 | 로그인 유지, 사용자 설정 |

세션 Cookie는 탭이 아니라 브라우저 세션을 기준으로 관리됩니다. 따라서 Cookie 전송 조건이 일치하면 다른 탭에서도 사용됩니다.  
다만 브라우저의 세션 복원 기능이 세션 Cookie까지 복원할 수 있습니다.  
보안이 중요한 로그인은 브라우저 종료에만 의존하지 않고 서버에서도 유휴 시간과 절대 만료 시간을 관리해야 합니다.  

### 🟦 Cookie 설정 예시

아래 예시는 HTTPS 응답에서 Cookie를 설정하는 상황을 가정합니다.  
`Secure`가 포함된 Cookie는 `localhost`와 같은 예외를 빼면 일반 HTTP 사이트에서 설정할 수 없으며 HTTPS 요청에만 전송됩니다.  

다음은 브라우저 세션이 끝날 때 일반적으로 제거되는 테마 Cookie입니다.  

```http
Set-Cookie: theme=dark; Path=/; Secure; SameSite=Lax
```

`Max-Age=2592000`을 추가하면 30일 동안 유지되는 영구 Cookie가 됩니다.  

```http
Set-Cookie: theme=dark; Path=/; Secure; SameSite=Lax; Max-Age=2592000
```

로그인에 사용하는 Session ID에는 다음과 같이 보안 속성을 함께 적용합니다.  

```http
Set-Cookie: __Host-session=random-session-id; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800
```

| 보안 속성 | 역할 |
| --- | --- |
| `HttpOnly` | JavaScript가 `document.cookie`를 통해 Session ID를 읽지 못하게 합니다. |
| `Secure` | HTTPS 연결에서만 Cookie를 전송합니다. |
| `SameSite=Lax` 또는 `Strict` | 교차 사이트 요청의 Cookie 전송을 제한해 CSRF 위험을 줄입니다. |
| `Path=/` | Cookie를 전송할 URL 경로의 범위를 정합니다. |
| Domain 생략 | Cookie를 발급한 호스트로 범위를 좁힙니다. |
| `Max-Age` | 브라우저가 Cookie를 보관할 최대 시간을 초 단위로 정합니다. |

`__Host-` 접두사를 사용하려면 `Secure`와 `Path=/`를 설정해야 하며 Domain은 지정할 수 없습니다.  
`HttpOnly`는 XSS 자체를 차단하지 않고, `SameSite`도 모든 CSRF를 막지는 못합니다.  
중요한 상태 변경 요청에는 입력값 검증, XSS 방어, CSRF Token이나 Origin 검사 등을 함께 적용해야 합니다.  

## 3. localStorage와 sessionStorage {#session-03}

두 저장소 모두 문자열 형태의 키-값 데이터를 보관하며 HTTP 요청에는 자동으로 포함되지 않습니다.  
두 저장소의 차이는 데이터가 유지되는 기간과 탭 사이의 공유 여부입니다.  

| 저장소 | 기본 수명 | 같은 Origin의 탭 간 공유 |
| --- | --- | --- |
| `localStorage` | 직접 삭제하거나 브라우저가 제거할 때까지 | O |
| `sessionStorage` | 해당 탭을 닫을 때까지 | X |

### 🟦 localStorage 예시

`localStorage`는 브라우저를 닫았다가 다시 열어도 값이 유지됩니다.  
다음 예시는 화면 테마를 문자열로 저장한 뒤 다시 불러옵니다.  

```javascript
// 브라우저를 다시 열어도 사용할 테마 값을 저장합니다.
localStorage.setItem('theme', 'dark');

// 저장된 테마 값을 읽습니다.
const savedTheme = localStorage.getItem('theme');
console.log(savedTheme); // dark
```

Web Storage에는 문자열만 저장할 수 있습니다.  
객체는 `JSON.stringify()`로 변환하고, 읽을 때 `JSON.parse()` 오류와 객체 구조를 검사한 뒤 사용해야 합니다.  
`localStorage`에는 기본 만료 시간이 없습니다.  
만료 기능이 필요하면 만료 시각인 `expiresAt`을 값과 함께 저장해야 합니다. 값을 읽을 때 애플리케이션이 만료 여부를 확인하고, 만료되었다면 직접 제거해야 합니다.  

### 🟦 sessionStorage 예시

`sessionStorage`의 데이터는 페이지를 새로고침해도 유지되지만 해당 탭을 닫으면 사라집니다.  
여러 단계 입력 화면처럼 현재 탭에서만 필요한 임시 상태에 적합합니다.  

```javascript
// 현재 탭의 주문서 작성 단계를 저장합니다.
sessionStorage.setItem('checkout-step', 'shipping');

// 새로고침한 뒤에도 현재 탭에서는 같은 값을 읽을 수 있습니다.
const currentStep = sessionStorage.getItem('checkout-step');
console.log(currentStep); // shipping

// 입력을 완료하면 임시 상태를 직접 제거합니다.
sessionStorage.removeItem('checkout-step');
```

기존 페이지에서 열려 `window.opener`로 연결된 새 탭의 `sessionStorage`에는 처음에 기존 탭의 값이 복사될 수 있습니다.  
값을 복사한 뒤에는 두 저장소가 서로 분리되므로 한 탭에서 변경한 내용이 다른 탭에는 반영되지 않습니다.  

### 🟦 Web Storage 보안 주의 사항

`localStorage`와 `sessionStorage`는 같은 Origin에서 실행되는 JavaScript가 읽고 변경할 수 있습니다.  
Session ID, Access Token, Refresh Token, 비밀번호 같은 인증 정보는 저장하지 않는 편이 안전합니다.  

사용자는 개발자 도구에서 저장된 값을 변경할 수도 있습니다.  
따라서 `JSON.parse()` 오류를 처리하고 객체 구조를 검사해야 하며, 저장된 값을 인증이나 권한 판정의 근거로 사용하면 안 됩니다.  

## 4. IndexedDB와 Cache Storage {#session-04}

IndexedDB는 구조화된 대용량 데이터를 저장하며 Cache Storage는 HTTP 요청과 응답을 저장합니다.  
두 저장소 모두 비동기 API이며 같은 Origin의 탭과 Worker에서 접근할 수 있습니다.  

### 🟦 IndexedDB 예시

IndexedDB는 객체를 문자열로 변환하지 않고 저장할 수 있으며, Transaction을 이용해 데이터를 읽고 씁니다.  
다음 예시는 `todos` Object Store를 만든 뒤 할 일 객체 하나를 저장합니다.  

```javascript
// 브라우저의 IndexedDB에서
// 이름이 'app-db'인 데이터베이스를 버전 1로 엽니다.
//
// 데이터베이스가 없으면 새로 생성되고,
// 기존 버전보다 높은 버전으로 열면 업그레이드가 진행됩니다.
const openRequest = indexedDB.open('app-db', 1);

// 데이터베이스를 처음 만들거나,
// 버전이 올라가서 스키마 변경이 필요할 때 실행됩니다.
openRequest.onupgradeneeded = () => {
  // 열린 데이터베이스 객체를 가져옵니다.
  const db = openRequest.result;

  // 'todos'라는 Object Store가 아직 없다면 생성합니다.
  // Object Store는 일반 DB의 테이블과 비슷한 역할을 합니다.
  if (!db.objectStoreNames.contains('todos')) {
    // 'todos' Object Store를 생성합니다.
    //
    // keyPath: 'id'
    // → 저장되는 객체의 id 값을 기본 키처럼 사용합니다.
    //
    // 예:
    // { id: 1, title: '공부하기', done: false }
    // 여기서 id 값인 1이 데이터의 키가 됩니다.
    db.createObjectStore('todos', { keyPath: 'id' });
  }
};

// 데이터베이스가 정상적으로 열린 후 실행됩니다.
openRequest.onsuccess = () => {
  // 열린 데이터베이스 객체를 가져옵니다.
  const db = openRequest.result;

  // 'todos' Object Store를 대상으로
  // 읽기/쓰기가 가능한 Transaction을 시작합니다.
  //
  // IndexedDB에서는 데이터를 읽거나 쓸 때
  // 반드시 Transaction을 통해 접근해야 합니다.
  const transaction = db.transaction('todos', 'readwrite');

  // Transaction에서 사용할 'todos' Object Store를 가져옵니다.
  const todoStore = transaction.objectStore('todos');

  // 할 일 데이터를 저장합니다.
  //
  // put()은:
  // - 같은 id가 없으면 새로 추가하고
  // - 같은 id가 이미 있으면 기존 데이터를 덮어씁니다.
  todoStore.put({
    id: 1,
    title: '브라우저 저장소 공부',
    done: false,
  });
};
```

IndexedDB에는 Cookie 같은 내장 만료 속성이 없습니다.  
필요하면 `expiresAt`을 저장하고 애플리케이션에서 만료된 레코드를 직접 삭제해야 합니다.  

### 🟦 Cache Storage 예시

Cache Storage는 `Request`와 `Response` 객체를 한 쌍으로 저장합니다.  
주로 PWA나 Service Worker에서 정적 파일을 오프라인으로 제공할 때 사용합니다.  
Cache Storage는 일반적으로 HTTPS와 같은 보안 컨텍스트에서만 사용할 수 있으며, localhost는 개발 편의를 위해 신뢰할 수 있는 출처로 취급됩니다.  
일반 HTTP 출처에서 접근하면 `SecurityError`가 발생할 수 있습니다.  

먼저 페이지에서 Service Worker 지원 여부를 확인하고 `/service-worker.js` 파일을 등록합니다.  

```html
<script>
  // 현재 브라우저가 Service Worker를 지원할 때만 등록을 시도합니다.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker 등록 성공:', registration);
      })
      .catch((error) => {
        console.error('Service Worker 등록 실패:', error);
      });
  }
</script>
```

`service-worker.js`에서는 설치할 때 App Shell을 캐시에 저장합니다. 이후 네트워크 요청이 발생하면 캐시를 먼저 확인하고, 저장된 응답이 없을 때만 서버에 요청합니다.  

```javascript
// Cache Storage에서 사용할 이름과 미리 저장할 App Shell을 정합니다.
// 파일 구성이 바뀌면 app-static-v2처럼 캐시 이름의 버전을 올립니다.
const CACHE_NAME = 'app-static-v1';
const APP_SHELL = ['/index.html'];

// Service Worker를 설치하는 동안 App Shell 캐싱이 끝날 때까지 기다립니다.
self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
});

async function cacheAppShell() {
  // 같은 이름의 캐시가 없으면 새로 만든 뒤 App Shell 파일을 저장합니다.
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

// 페이지에서 발생한 요청의 응답을 Service Worker가 직접 결정합니다.
self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // 요청과 일치하는 응답이 있으면 네트워크 요청 없이 반환합니다.
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log('캐시 사용:', request.url);
    return cachedResponse;
  }

  // 캐시에 응답이 없으면 기존 방식대로 네트워크에 요청합니다.
  console.log('네트워크 요청:', request.url);
  return fetch(request);
}
```

Cache Storage는 HTTP 캐시와 별개의 저장소이며 `Cache-Control`이나 `Expires` 헤더에 따라 항목을 자동으로 삭제하지 않습니다.  
캐시 이름에 버전을 넣고 Service Worker나 애플리케이션에서 오래된 캐시를 직접 삭제해야 합니다.  

### 🟦 저장 및 보안 기준

IndexedDB와 Cache Storage도 같은 Origin에서 실행되는 JavaScript가 접근할 수 있으므로 비밀 정보를 안전하게 숨길 수 있는 공간은 아닙니다.  
IndexedDB에서 읽은 데이터는 서버 응답과 마찬가지로 검증해야 합니다. 인증된 사용자의 개인 데이터가 담긴 응답은 Cache Storage에 함부로 저장해서는 안 됩니다.  

- 구조화된 목록과 오프라인 데이터는 IndexedDB를 사용합니다.  
- PWA의 정적 파일과 재사용할 네트워크 응답은 Cache Storage를 사용합니다.  
- 브라우저 정책에 따라 저장 공간의 데이터가 삭제될 수 있으므로 중요한 원본 데이터는 서버에도 보관합니다.  
- 로그아웃할 때 사용자와 관련된 IndexedDB 데이터와 Cache Storage 항목도 함께 정리합니다.  

📌 저장소의 이름보다 중요한 기준은 **JavaScript에서 읽을 수 있는지, 서버로 자동 전송되는지, 언제 삭제되는지, 값이 변조되어도 안전한지**입니다.  
