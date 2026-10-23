---
layout: post
title: "13. [Apollo Client] fetchPolicy와 Query 캐시 활용하기"
description: "Apollo Client의 캐시 재사용 원리와 fetchPolicy별 동작을 비교하고, query·readQuery·watchQuery·refetch로 Query 결과를 조회하고 갱신하는 방법을 실습합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 13
ai_assisted: true
toc:
  - id: session-01
    title: "1. InMemoryCache와 캐시 재사용 원리"
  - id: session-02
    title: "2. fetchPolicy 주요 정책과 동작 비교"
  - id: session-03
    title: "3. query(), readQuery(), watchQuery()와 refetch() 활용"
  - id: session-04
    title: "4. 상황별 캐시 동기화 전략"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics/apollo-client){: target="_blank" rel="noopener noreferrer" }**

Apollo Client는 GraphQL 서버에서 받은 데이터를 `InMemoryCache`에 저장합니다.  
같은 데이터를 다시 조회할 때 캐시를 활용하면 불필요한 네트워크 요청을 줄이고 화면을 빠르게 표시할 수 있습니다.  

하지만 서버의 데이터가 바뀌었다고 해서 캐시도 항상 자동으로 바뀌는 것은 아닙니다.  
`fetchPolicy`로 캐시와 네트워크를 어떻게 사용할지 정하고, 필요할 때 `watchQuery()`와 `refetch()`로 최신 결과를 받아야 합니다.  

이번 글에서는 다음 흐름으로 캐시 동작을 살펴봅니다.  

```text
GraphQL 서버
    ▼
Apollo Client
    ├─ InMemoryCache → 응답 데이터 저장 및 재사용
    ├─ fetchPolicy → 캐시와 네트워크 사용 방식 결정
    ├─ watchQuery() → Query 결과 변화 관찰
    └─ refetch() → 서버 데이터 다시 조회
```

## 1. InMemoryCache와 캐시 재사용 원리 {#session-01}

### 🟦 InMemoryCache란?

`InMemoryCache`는 Apollo Client가 GraphQL 응답을 메모리에 저장하고 관리하는 기본 캐시입니다.  
Apollo Client는 Query를 실행할 때 `fetchPolicy`에 따라 저장된 데이터를 재사용하거나 서버에 요청합니다.  

![InMemoryCache](/assets/images/nodejs/nodejs-graphql/image-2026-10-21.png)

캐시를 사용하면 다음과 같은 장점이 있습니다.  

- **네트워크 요청 감소:** 이미 조회한 데이터를 다시 사용할 수 있습니다.  
- **빠른 조회:** 서버 응답을 기다리지 않고 캐시에 있는 결과를 표시할 수 있습니다.  
- **데이터 재사용:** 여러 Query가 같은 객체를 조회할 때 저장된 데이터를 함께 사용할 수 있습니다.  

캐시는 데이터를 빠르게 보여 주는 데 유용하지만, 서버에서 발생한 모든 변화를 자동으로 반영하지는 못합니다.  
따라서 최신 데이터가 얼마나 중요한지에 따라 알맞은 `fetchPolicy`를 선택해야 합니다.  

### 🟦 정규화 캐시의 기본 원리

`InMemoryCache`는 여러 Query에서 조회한 동일한 객체를 하나의 데이터로 식별해 관리합니다. 이를 **정규화(Normalization)**라고 합니다.  

Apollo Client는 기본적으로 `__typename`과 `id` 또는 `_id`를 조합해 객체를 식별합니다.  
예를 들어 `__typename`이 `Post`이고 `id`가 `1`인 게시글은 캐시에서 `Post:1`이라는 고유한 객체로 관리됩니다.  

![정규화 캐시 원리](/assets/images/nodejs/nodejs-graphql/image-2026-10-21-1.png)

정규화 캐시는 다음 순서로 동작합니다.  

1. GraphQL 응답의 `__typename`과 `id` 또는 `_id`로 객체를 식별합니다.  
2. 처음 조회한 객체는 새로 저장하고, 이미 저장된 객체는 응답으로 받은 값으로 갱신합니다.  
3. 여러 Query에서 같은 객체를 조회하면 정규화된 객체를 공유합니다.  

예를 들어 목록 Query에서 게시글의 `id`와 `title`을 조회하고, 상세 Query에서 같은 게시글의 `content`와 `likeCount`를 추가로 조회하는 경우입니다.  

```graphql
# 목록에서는 게시글의 기본 정보를 조회합니다.
query {
  postsByOffset(pagination: { offset: 0, limit: 10 }) {
    items {
      id
      title
    }
  }
}

# 상세 화면에서는 같은 게시글의 추가 정보를 조회합니다.
query {
  post(id: "1") {
    id
    content
    likeCount
  }
}
```

두 Query가 반환한 게시글의 `__typename`이 `Post`이고 `id`가 `1`이라면 Apollo Client는 두 응답을 같은 객체로 식별합니다.  

```text
목록 Query { id, title } ───────────┐
                                    ├─▶ Post:1 { id, title, content, likeCount }
상세 Query { id, content, likeCount } ┘
```

목록 Query에서 얻은 `title`과 상세 Query에서 얻은 `content`, `likeCount`는 같은 게시글 객체에 병합됩니다.  
서버 응답으로 이 객체가 갱신되면, 같은 객체를 사용하는 다른 활성 Query에도 변경된 값이 반영될 수 있습니다.  

### 🟦 Query 변수와 캐시 재사용 조건

같은 Query를 실행하더라도 변수로 전달한 필드 인자 값이 다르면, 조회 결과도 기본적으로 나누어 저장됩니다.  
`postsByOffset`으로 게시글을 열 개씩 조회하는 예를 살펴보겠습니다.  

```javascript
// 첫 번째 페이지
variables: {
  pagination: {
    offset: 0,
    limit: 10,
  },
}

// 두 번째 페이지
variables: {
  pagination: {
    offset: 10,
    limit: 10,
  },
}
```

두 요청은 같은 `postsByOffset` 필드를 조회하지만 `offset` 값이 다릅니다.  
따라서 기본 설정에서는 `offset: 0`과 `offset: 10`의 목록 결과를 각각 구분해 저장합니다.  

`cache-first` 정책을 사용하는 경우 다음과 같이 동작합니다.  

- **첫 번째 페이지 최초 조회:** 캐시에 결과가 없으므로 서버에 요청하고 응답을 캐시에 저장합니다.  
- **두 번째 페이지 최초 조회:** 변수 값이 달라 해당 목록 결과가 없으므로 서버에 요청합니다.  
- **첫 번째 페이지 재조회:** 같은 변수에 해당하는 결과가 캐시에 있으면 서버 요청 없이 재사용합니다.  
- **두 번째 페이지 재조회:** 두 번째 페이지의 결과도 캐시에 저장되어 있다면 재사용합니다.  

```text
최초 요청
offset: 0  → 서버 요청 → 첫 번째 페이지 캐시 저장
offset: 10 → 서버 요청 → 두 번째 페이지 캐시 저장

재요청
offset: 0  → 첫 번째 페이지 캐시 사용
offset: 10 → 두 번째 페이지 캐시 사용
```

캐시를 재사용하려면 **현재 변수로 조회한 결과**와 **Query에서 요청한 모든 필드**가 캐시에 있어야 합니다.  

## 2. fetchPolicy 주요 정책과 동작 비교 {#session-02}

### 🟦 fetchPolicy의 역할과 지원 정책

`fetchPolicy`는 GraphQL Query를 실행할 때 **캐시에서 결과를 읽을지, 서버에 요청할지, 응답을 캐시에 저장할지**를 결정하는 옵션입니다.  

Apollo Client는 기본적으로 `cache-first`를 사용합니다. 데이터가 얼마나 자주 바뀌는지, 항상 최신 결과가 필요한지에 따라 다른 정책을 선택할 수 있습니다.  

![fetchPolicy 정책](/assets/images/nodejs/nodejs-graphql/image-2026-10-21-3.png)

정책을 선택할 때는 캐시 조회 여부, 서버 요청 시점, 응답의 캐시 저장 여부를 함께 확인합니다.  

| 정책 | 캐시 조회 | 서버 요청 | 응답 캐시 저장 |
| --- | --- | --- | --- |
| `cache-first` | 먼저 조회 | 캐시에 필요한 데이터가 없을 때 | 저장 |
| `cache-only` | 조회 | 하지 않음 | 해당 없음 |
| `network-only` | 먼저 조회하지 않음 | 항상 요청 | 저장 |
| `cache-and-network` | 먼저 조회 | 항상 요청 | 저장 |
| `no-cache` | 조회하지 않음 | 항상 요청 | 저장하지 않음 |
| `standby` | 자동 실행하지 않음 | 자동 요청하지 않음 | 자동 갱신하지 않음 |

## 3. query(), readQuery(), watchQuery()와 refetch() 활용 {#session-03}

### 🟦 client.query(), client.readQuery(), client.watchQuery() 차이

Apollo Client의 `query()`, `readQuery()`, `watchQuery()`는 모두 GraphQL 데이터를 조회할 때 사용합니다.  
다만 데이터를 어디에서 가져오는지, 이후의 캐시 변경까지 관찰하는지에 차이가 있습니다.  

| 구분 | `client.query()` | `client.readQuery()` | `client.watchQuery()` |
| --- | --- | --- | --- |
| 주요 목적 | Query 한 번 실행 | 현재 캐시 값 한 번 읽기 | Query 결과 지속 관찰 |
| 서버 요청 | `fetchPolicy`에 따라 실행 | 실행하지 않음 | `fetchPolicy`에 따라 실행 |
| 캐시 사용 | `fetchPolicy`에 따라 결정 | 캐시만 사용 | `fetchPolicy`에 따라 결정 |
| 캐시 변경 감지 | 하지 않음 | 하지 않음 | 구독 중인 결과의 변경을 감지 |
| 반환값 | `Promise<ApolloQueryResult>` | 데이터 또는 `null` | `ObservableQuery` |
| 적합한 상황 | 상세 데이터 등 일회성 조회 | 현재 캐시 상태 확인 | 목록처럼 계속 갱신할 화면 |

`client.query()`는 Query를 한 번 실행하고 Promise로 결과를 반환합니다.  
설정한 `fetchPolicy`에 따라 캐시를 사용하거나 서버에 요청합니다. 한 번 조회한 뒤에는 캐시가 바뀌어도 새로운 결과를 전달하지 않습니다.  

```javascript
// fetchPolicy에 따라 캐시 또는 서버에서 게시글 목록을 한 번 조회합니다.
const { data } = await client.query({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
  fetchPolicy: 'cache-first',
});
```

`client.readQuery()`는 서버에 요청하지 않고 캐시에 저장된 결과만 바로 읽습니다.  
지정한 Query와 변수에 필요한 데이터가 캐시에 충분하지 않으면 `null`을 반환할 수 있습니다.  

```javascript
// 같은 Query와 변수로 저장된 현재 캐시 결과만 읽습니다.
const cachedData = client.readQuery({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
});
```

`client.watchQuery()`는 `ObservableQuery`를 만들고 Query 결과를 계속 관찰합니다.  
캐시 쓰기나 서버 응답으로 구독 중인 결과가 바뀌면 구독자에게 새로운 결과를 전달합니다.  

### 🟦 watchQuery()로 결과 관찰하기

`watchQuery()`는 `ObservableQuery` 객체를 반환합니다.  
이 객체의 `subscribe()` 메서드에 콜백을 등록하면 새로운 Query 결과가 들어올 때마다 콜백이 실행됩니다.  

```javascript
let watcher;
let subscription;
let count = 0;

function startWatcher() {
  // 기존 관찰을 종료해 중복 구독을 방지합니다.
  subscription?.unsubscribe();

  // 서버 요청의 시작·완료 상태도 결과로 전달합니다.
  // watchQuery()는 Query 결과를 계속 지켜보는 ObservableQuery를 반환합니다.
  // notifyOnNetworkStatusChange를 켜면 재요청 중인 상태 변화도 구독자에게 전달합니다.
  watcher = client.watchQuery({
    query: POSTS_QUERY,
    variables: LIST_VARIABLES,
    fetchPolicy: document.querySelector('#policy').value,
    notifyOnNetworkStatusChange: true,
  });

  // subscribe()는 캐시나 네트워크 결과가 바뀔 때 next 콜백을 호출합니다.
  subscription = watcher.subscribe({
    next: ({ data, loading, networkStatus }) => {
      // count는 네트워크 요청 횟수가 아니라 next 콜백이 호출된 횟수입니다.
      // cache-and-network는 캐시 결과를 먼저 보내고, 서버 응답이 오면 최신 결과를 다시 보냅니다.
      // 따라서 네트워크 요청이 한 번이어도 next 콜백은 두 번 호출될 수 있습니다.
      count += 1;
      document.querySelector('#emissions').textContent = count;
      document.querySelector('#posts').innerHTML = postCards(
        data?.postsByOffset?.items ?? [],
      );
      output({ loading, networkStatus, data }, 'watchQuery 결과');
    },
    error: (error) => output(error),
  });
}
```

Apollo Client가 새로운 Query 결과를 전달하면 `next` 콜백에서 화면을 갱신합니다.  
예제에 사용한 주요 항목은 다음과 같습니다.  

| 항목 | 설명 |
| --- | --- |
| `query` | 실행할 GraphQL Query |
| `variables` | Query에 전달할 변수 |
| `fetchPolicy` | 캐시와 네트워크 사용 정책 |
| `notifyOnNetworkStatusChange` | 서버 요청 상태가 바뀔 때도 새 결과를 전달할지 설정 |
| `data` | 현재 조회 결과 |
| `loading` | 현재 서버 요청이 진행 중인지 표시 |
| `networkStatus` | 초기 조회, 재조회 등 현재 요청 단계를 구분 |

`cache-and-network`는 캐시 결과를 먼저 전달하고, 서버 응답이 도착하면 최신 결과를 다시 전달할 수 있습니다.  
`notifyOnNetworkStatusChange: true`로 설정하면 서버 요청이 시작되거나 끝나서 `loading`과 `networkStatus`가 바뀔 때도 새로운 결과를 받을 수 있습니다.  

> 여기서 네트워크 상태는 Wi-Fi 같은 인터넷 연결 상태가 아닙니다. **Query가 서버에 요청을 보내고 있는지, 현재 어느 요청 단계에 있는지**를 나타냅니다.  

### 🟦 refetch()로 서버 데이터 다시 조회하기

`watchQuery()`로 만든 `watcher`에서 `refetch()`를 호출하면, `watcher`가 기억하는 Query와 변수로 서버에 다시 요청합니다.  
따라서 Query를 새로 만들지 않고도 현재 화면의 데이터를 갱신할 수 있습니다.  

```javascript
// watcher가 기억한 Query와 변수로 서버에 다시 요청합니다.
document.querySelector('#refetch').addEventListener('click', async () => {
  if (!watcher) {
    startWatcher();
    return;
  }
  try {
    const result = await watcher.refetch();
    output(result.data, 'refetch 결과');
  } catch (error) {
    output(error);
  }
});
```

![refetch](/assets/images/nodejs/nodejs-graphql/image-2026-10-21-4.png)

`refetch()`는 서버 요청을 보장하기 위해 일반적으로 `network-only`로 실행됩니다.  
기존 `fetchPolicy`가 이미 서버 요청을 보장하는 `no-cache` 또는 `cache-and-network`라면 해당 정책을 유지합니다.  

## 4. 상황별 캐시 동기화 전략 {#session-04}

### 🟦 캐시와 서버 데이터가 달라지는 이유

Apollo Client의 `InMemoryCache`는 서버 데이터의 복사본을 브라우저 메모리에 보관합니다.  
따라서 서버 데이터가 바뀌더라도 클라이언트의 캐시까지 항상 자동으로 갱신되지는 않습니다.  

- 다른 사용자가 게시글을 수정하거나 삭제한 경우
- 새로운 게시글이 추가되어 목록 구성이 변경된 경우
- Mutation 응답에 갱신에 필요한 필드가 포함되지 않은 경우
- 서버 데이터가 변경되었지만 클라이언트에서 다시 조회하지 않은 경우

### 🟦 상황별 fetchPolicy 선택

모든 Query에 `network-only`를 사용하면 최신 데이터를 받을 수 있지만 캐시의 장점을 활용하기 어렵습니다.  
데이터가 얼마나 자주 바뀌고 최신 결과가 얼마나 중요한지 고려하여, 필요한 시점에만 서버 데이터를 다시 조회하는 것이 좋습니다.  

| 상황 | 권장 방법 | 이유 |
| --- | --- | --- |
| 자주 변경되지 않는 상세 정보 | `cache-first` | 불필요한 요청 감소 |
| 이미 저장된 데이터만 사용 | `cache-only` | 서버 요청 차단 |
| 빠른 표시와 최신 데이터가 중요한 목록 | `cache-and-network` | 캐시 결과와 서버 응답 활용 |
| 서버 응답을 우선해야 하는 조회 | `network-only` | 실행할 때마다 서버 요청 |
| 일회성 데이터 조회 | `no-cache` | 조회 결과를 캐시에 저장하지 않음 |
| 자동 갱신 없이 대기 상태로 유지 | `standby` | 필요할 때만 수동으로 갱신 |
| 사용자가 누른 새로 고침 | `refetch()` | 기존 Query를 다시 실행 |

### 🟦 Mutation 이후 캐시 동기화

Mutation 응답에 `__typename`, `id`, 변경된 필드가 포함되면 Apollo Client가 해당 캐시 객체를 자동으로 갱신할 수 있습니다.  
다만 게시글 추가·삭제처럼 목록 구성이 바뀌면 관련 Query를 다시 조회하거나 캐시 목록을 직접 수정해야 합니다.  

```text
Mutation 실행
    ▼
서버 응답 수신
    ├─ 기존 객체의 필드 변경
    │      └─ 정규화 캐시 자동 갱신 가능
    └─ 목록 추가·삭제 또는 관련 데이터 변경
           ├─ refetchQueries로 다시 조회
           └─ update / cache.modify로 직접 수정
```

### 🟦 캐시 사용 원칙 정리

Apollo Client의 캐시를 효과적으로 사용하려면 다음 원칙을 이해하는 것이 중요합니다.  

1. **캐시를 재사용할 수 있는 데이터는 `cache-first`를 활용합니다.** 불필요한 네트워크 요청을 줄일 수 있습니다.  
2. **빠른 화면 표시와 최신 데이터가 모두 필요하면 `cache-and-network`를 고려합니다.** 기존 데이터를 표시하면서 서버 응답으로 갱신할 수 있습니다.  
3. **사용자가 최신 데이터를 요청하면 `refetch()`를 활용합니다.** 기존 Query를 유지하면서 서버에서 다시 조회할 수 있습니다.  
4. **Mutation 이후에는 변경 범위를 확인합니다.** 단순한 객체 필드 변경과 목록 추가·삭제는 캐시 동기화 방법이 다를 수 있습니다.  
5. **캐시를 직접 수정하기 전에 자동 정규화와 재조회 방법을 검토합니다.** 불필요하게 복잡한 캐시 관리 코드를 줄일 수 있습니다.  
