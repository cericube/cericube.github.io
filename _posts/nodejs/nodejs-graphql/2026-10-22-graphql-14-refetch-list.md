---
layout: post
title: "14. [Apollo Client] refetchQueries로 Mutation 이후 목록 갱신하기"
description: "Mutation 이후 refetchQueries로 게시글 목록 캐시를 갱신하고, readQuery와 watchQuery로 최신 목록을 수동 또는 자동으로 화면에 반영하는 방법을 실습합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 14
ai_assisted: true
toc:
  - id: session-01
    title: "1. Mutation 이후 목록 갱신의 개념과 동작 흐름"
  - id: session-02
    title: "2. client.mutate()와 refetchQueries 사용 방법"
  - id: session-03
    title: "3. readQuery()로 갱신된 목록 캐시 조회하기"
  - id: session-04
    title: "4. watchQuery()로 게시글 목록 자동 갱신하기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics/apollo-client){: target="_blank" rel="noopener noreferrer" }**

게시글을 새로 등록하면 서버 데이터는 바뀌지만, Apollo Client에 저장된 목록 캐시까지 자동으로 바뀌지는 않습니다.  
이때 `refetchQueries`로 게시글 목록을 다시 요청하면 최신 응답으로 목록 캐시를 갱신할 수 있습니다.  

갱신된 캐시를 화면에 반영하는 방식은 데이터를 읽는 방법에 따라 달라집니다.  
`readQuery()`는 코드를 다시 실행해 캐시를 읽어야 하고, `watchQuery()`는 캐시 변경을 감지해 구독자에게 새 결과를 전달합니다.  

이번 글에서는 다음 흐름을 실습합니다.  

```text
게시글 등록 Mutation
        │
        ▼
refetchQueries로 목록 Query 재조회
        │
        ▼
postsByOffset 목록 캐시 갱신
        │
        ├─ readQuery()  → 호출할 때 최신 캐시를 읽어 화면 갱신
        │
        └─ watchQuery() → subscribe() 콜백으로 화면 자동 갱신
```

## 1. Mutation 이후 목록 갱신의 개념과 동작 흐름 {#session-01}

### 🟦 Mutation 응답과 기존 목록 캐시의 관계

Apollo Client의 `InMemoryCache`는 기본적으로 `__typename`과 `id` 또는 `_id`로 객체를 식별합니다.  
Mutation 응답에 이 식별 정보가 포함되면 새 객체를 캐시에 저장하거나 기존 객체의 필드를 갱신할 수 있습니다.  

`CREATE_POST` Mutation도 게시글을 등록하면 생성된 게시글 정보를 반환합니다.  

```graphql
# 서버에 게시글을 등록하고 생성된 객체를 응답으로 받습니다.
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    published
    likeCount
    authorId
    createdAt
    updatedAt
  }
}
```

이 응답을 받으면 새 `Post` 객체를 캐시에 저장할 수 있습니다.  
하지만 새 객체가 저장되었다고 해서 기존 `postsByOffset`의 목록 캐시가 자동으로 갱신되는 것은 아닙니다.  

```text
Mutation 응답
  └─ 새 Post 객체를 캐시에 저장할 수 있음

기존 postsByOffset 목록 캐시
  └─ 새 Post를 어느 페이지의 어느 위치에 넣어야 할지 알 수 없음
```

목록 결과는 페이지 범위, 필터, 정렬 순서, 전체 개수와 같은 여러 조건에 따라 달라질 수 있습니다.  
Apollo Client는 Mutation 응답만으로 새 게시글이 어떤 목록에 들어가야 하는지 안전하게 판단할 수 없습니다.  

### 🟦 Mutation부터 화면 반영까지

실습에서는 Mutation 이후 `POSTS_QUERY`를 다시 실행해 이 문제를 해결합니다.  

```text
1. CreatePost Mutation 요청
             ▼
2. 서버에 새 게시글 저장
             ▼
3. refetchQueries로 Posts Query 재요청
             ▼
4. 서버에서 최신 게시글 목록 응답
             ▼
5. postsByOffset 목록 캐시 갱신
             ▼
6. 갱신된 목록을 화면에 반영
```

1~2단계에서는 Mutation으로 서버 데이터를 변경합니다.  
3~5단계에서는 `refetchQueries`가 목록을 다시 받아 캐시를 갱신합니다.  
6단계에서는 `readQuery()` 또는 `watchQuery()`로 최신 캐시 결과를 화면에 반영합니다.  

### 🟦 refetchQueries, readQuery(), watchQuery() 역할 구분

세 기능은 서로 다른 역할을 담당합니다.  

| 기능 | 역할 | 서버 요청 |
| --- | --- | --- |
| `refetchQueries` | Mutation 이후 지정한 Query를 다시 실행해 캐시 갱신 | 있음 |
| `readQuery()` | 호출한 시점의 캐시 결과를 한 번 읽음 | 없음 |
| `watchQuery()` | Query 결과를 관찰하고 변경된 결과를 구독자에게 전달 | `fetchPolicy`에 따라 실행 |

`refetchQueries`가 캐시를 갱신하고, `readQuery()`와 `watchQuery()`는 갱신된 캐시를 서로 다른 방식으로 화면에 전달합니다.  
따라서 **캐시 갱신**과 **화면 갱신**은 구분해서 이해해야 합니다.  

## 2. client.mutate()와 refetchQueries 사용 방법 {#session-02}

### 🟦 client.mutate()의 주요 옵션

`client.mutate()`에 실행할 Mutation, 게시글 입력값, 다시 조회할 목록 Query를 함께 전달합니다.  

```javascript
// 게시글을 등록한 뒤 첫 번째 페이지 목록까지 최신 데이터로 갱신합니다.
const result = await client.mutate({
  mutation: CREATE_POST,
  variables: {
    input: {
      title: document.querySelector('#title').value,
      content: document.querySelector('#content').value,
      published: true,
    },
  },

  // 게시글 등록 후 첫 번째 페이지 목록을 서버에서 다시 받습니다.
  refetchQueries: [{ query: POSTS_QUERY, variables: LIST_VARIABLES }],

  // 목록 재조회가 끝난 뒤 client.mutate()의 Promise를 완료합니다.
  awaitRefetchQueries: true,
});
```

각 옵션의 역할은 다음과 같습니다.  

| 옵션 | 역할 |
| --- | --- |
| `mutation` | 실행할 `CREATE_POST` Mutation 지정 |
| `variables` | 서버에 전달할 게시글 입력값 지정 |
| `refetchQueries` | Mutation 성공 후 다시 실행할 Query와 변수 지정 |
| `awaitRefetchQueries` | 재조회가 끝날 때까지 Mutation Promise가 기다릴지 결정 |

### 🟦 refetchQueries 재조회 대상 지정하기

`refetchQueries`는 Mutation 실행 후 어떤 Query를 서버에 다시 요청할지 정하는 옵션입니다. Query 이름이나 문서 또는 Query와 변수를 담은 객체를 지정할 수 있습니다.  

| 지정 방식 | 코드 예 | 동작 |
| --- | --- | --- |
| Query 이름 | `['Posts']` | 같은 이름의 활성 Query를 기존 변수로 재조회 |
| Query 문서 | `[POSTS_QUERY]` | 같은 문서를 사용하는 활성 Query를 기존 변수로 재조회 |
| Query와 변수 | `[{ query: POSTS_QUERY, variables: LIST_VARIABLES }]` | 지정한 Query를 지정한 변수로 재조회 |
| 활성 Query 전체 | `'active'` | 현재 활성 상태인 Query를 모두 재조회 |
| 관리 중인 Query 전체 | `'all'` | Apollo Client가 관리하는 Query를 대상으로 재조회 |

`활성 Query`란 하나 이상의 구독자가 결과를 지켜보고 있으며, `standby` 상태가 아닌 Query를 말합니다.  
`standby`는 캐시가 바뀌어도 결과를 자동으로 갱신하지 않고 기다리는 `fetchPolicy`입니다.  
실습에서는 다시 실행할 Query와 변수를 코드에 분명하게 나타내기 위해 `{ query, variables }` 형식을 사용합니다.  

```javascript
// 첫 번째 페이지와 같은 조건으로 게시글 목록을 다시 요청합니다.
refetchQueries: [
  {
    query: POSTS_QUERY,
    variables: LIST_VARIABLES,
  },
],
```

`LIST_VARIABLES`에는 첫 번째 페이지를 조회하는 조건이 들어 있습니다.  

```javascript
// 첫 번째 페이지를 조회할 때 공통으로 사용할 변수입니다.
const LIST_VARIABLES = {
  pagination: {
    offset: 0,
    limit: 10,
  },
};
```

즉, 게시글을 등록한 뒤 `offset: 0`, `limit: 10` 조건으로 첫 번째 페이지를 다시 가져옵니다.  

### 🟦 페이지별 Query 재조회하기

같은 `POSTS_QUERY`라도 `variables`가 다르면 서로 다른 페이지의 결과로 관리됩니다.  

| 페이지 | `offset` | `limit` | 조회 범위 |
| --- | --- | --- | --- |
| 첫 번째 페이지 | `0` | `10` | 게시글 1~10 |
| 두 번째 페이지 | `10` | `10` | 게시글 11~20 |

두 페이지를 모두 갱신해야 한다면 각 페이지의 변수를 따로 지정합니다.  

```javascript
// 각 페이지의 조회 조건을 따로 지정해 두 목록을 모두 갱신합니다.
refetchQueries: [
  {
    query: POSTS_QUERY,
    variables: {
      pagination: { offset: 0, limit: 10 },
    },
  },
  {
    query: POSTS_QUERY,
    variables: {
      pagination: { offset: 10, limit: 10 },
    },
  },
],
```

이 경우 서로 다른 페이지 조건으로 목록 요청이 각각 발생합니다.  
모든 페이지를 다시 조회하면 네트워크 요청도 늘어나므로 Mutation의 영향을 받는 범위만 지정하는 것이 좋습니다.  

실습에서는 새 게시글이 포함될 첫 번째 페이지만 다시 조회합니다.  

### 🟦 awaitRefetchQueries로 완료 시점 제어하기

`refetchQueries`를 지정해도 기본적으로 `client.mutate()`의 Promise는 목록 재조회가 끝나기 전에 완료될 수 있습니다.  
`awaitRefetchQueries: true`를 설정하면 지정한 Query의 재조회와 캐시 갱신이 끝난 뒤 Promise가 완료됩니다.  

```text
awaitRefetchQueries: false (기본값)

Mutation 완료
    ├─ mutate() Promise 완료 → 다음 코드 실행
    └─ 목록 Query 재조회 진행

awaitRefetchQueries: true

Mutation 완료
    ↓
목록 Query 재조회 완료
    ↓
목록 캐시 갱신
    ↓
mutate() Promise 완료 → 다음 코드 실행
```

실습에서는 재조회까지 마친 뒤 완료 메시지를 출력하도록 `true`를 사용합니다.  

```javascript
// awaitRefetchQueries가 true이므로 목록 재조회까지 끝난 뒤 실행됩니다.
output(result.data, 'Mutation 완료 · 목록 재조회 완료');
```

## 3. readQuery()로 갱신된 목록 캐시 조회하기 {#session-03}

### 🟦 readQuery()의 캐시 조회 원리

`client.readQuery()`는 서버에 요청하지 않고 `InMemoryCache`에 저장된 결과만 읽습니다.  
호출할 때 지정한 Query와 변수가 캐시에 저장된 조건과 같아야 결과를 가져올 수 있습니다. 필요한 데이터가 캐시에 없으면 `null`을 반환합니다.  

```javascript
// 목록 Query와 변수가 일치하는 현재 캐시 결과를 읽습니다.
const data = client.readQuery({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
});
```

`readQuery()`는 호출한 순간의 결과를 한 번 반환합니다.  
그 뒤 캐시가 바뀌더라도 이전에 반환한 값이나 이미 그린 화면을 자동으로 갱신하지 않습니다.  

또한 `readQuery()`는 캐시를 갱신하는 메서드가 아닙니다.  
이 실습에서는 `refetchQueries`가 목록 캐시를 갱신하고, `readQuery()`는 갱신된 값을 읽는 역할만 합니다.  

### 🟦 Mutation 이후 갱신된 캐시 읽기

```javascript
// 버튼을 누른 시점의 목록 캐시를 한 번 읽습니다.
document.querySelector('#read-cache').addEventListener('click', () => {
  const data = client.readQuery({
    query: POSTS_QUERY,
    variables: LIST_VARIABLES,
  });

  document.querySelector('#read-hint')?.remove();
  render(data, '#read-posts', '#read-total');
  output(data, 'readQuery로 읽은 현재 캐시');
});
```

게시글을 등록하면 `refetchQueries`가 목록 캐시를 최신 상태로 바꿉니다. 다만 `readQuery()`로 그린 영역은 버튼을 눌러 캐시를 다시 읽을 때까지 그대로 남아 있습니다.  

### 🟦 버튼으로 최신 게시글 목록 표시하기

```text
refetchQueries 실행 전
readQuery() 호출 → 현재 목록 캐시를 화면에 표시

refetchQueries 실행 후
목록 캐시는 갱신됨 → 왼쪽 화면은 그대로 유지

버튼 다시 클릭
readQuery() 재호출 → 최신 목록 캐시를 화면에 표시
```

## 4. watchQuery()로 게시글 목록 자동 갱신하기 {#session-04}

### 🟦 watchQuery()와 subscribe()로 변경 감지하기

`client.watchQuery()`는 Query 결과를 계속 관찰할 수 있는 `ObservableQuery`를 반환합니다.  
이 객체의 `subscribe()`에 콜백을 등록하면 Query 결과가 바뀔 때마다 새로운 결과를 받을 수 있습니다.  

```javascript
// 처음 목록을 조회하고 같은 Query와 변수의 결과를 계속 관찰합니다.
const watcher = client.watchQuery({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
});

watcher.subscribe({
  // 캐시가 갱신되면 새 결과로 목록을 다시 그립니다.
  next: ({ data }) => render(data, '#watch-posts', '#watch-total'),
  error: (error) => output(error),
});
```

실습이 시작되면 `watchQuery()`가 게시글 목록을 조회하고 화면에 표시합니다.  
이후 같은 Query와 변수에 해당하는 캐시 결과가 바뀌면 `next` 콜백이 다시 실행됩니다.  

### 🟦 Mutation 이후 목록 자동 갱신하기

게시글 등록 폼을 제출하면 `client.mutate()`가 `CREATE_POST`를 실행합니다.  
Mutation이 성공하면 `refetchQueries`가 `POSTS_QUERY`를 다시 요청하고 최신 목록으로 캐시를 갱신합니다.  

```javascript
// 폼을 제출하면 게시글을 등록하고 첫 번째 페이지 목록을 다시 조회합니다.
document.querySelector('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const result = await client.mutate({
      mutation: CREATE_POST,
      variables: {
        input: {
          title: document.querySelector('#title').value,
          content: document.querySelector('#content').value,
          published: true,
        },
      },
      refetchQueries: [{ query: POSTS_QUERY, variables: LIST_VARIABLES }],
      awaitRefetchQueries: true,
    });

    // watchQuery 목록은 캐시 변경을 전달받아 이미 자동으로 갱신됩니다.
    output(result.data, 'Mutation 완료 · 목록 재조회 완료');
  } catch (error) {
    output(error);
  }
});
```

재조회 응답이 캐시에 기록되면 `watchQuery()`가 새 결과를 구독자에게 전달합니다.  
따라서 목록은 별도로 `readQuery()`를 호출하거나 화면 갱신 버튼을 누르지 않아도 자동으로 바뀝니다.  

### 🟦 readQuery()와 watchQuery() 결과 비교하기

두 영역은 같은 `POSTS_QUERY`와 `LIST_VARIABLES`의 캐시 결과를 사용하지만 화면 갱신 시점은 다릅니다.  

| 비교 항목 | `readQuery()` 목록 | `watchQuery()` 목록 |
| --- | --- | --- |
| 캐시 읽기 | 호출한 시점에 한 번 읽음 | Query 결과를 계속 관찰 |
| 캐시 변경 감지 | 하지 않음 | 구독 중이면 감지 |
| Mutation 이후 화면 | 기존 목록 유지 | 자동으로 최신 목록 표시 |
| 최신 화면 표시 방법 | 버튼으로 `readQuery()` 재호출 | `subscribe()` 콜백 자동 실행 |

```text
Mutation 및 refetchQueries 완료
              │
              ▼
      postsByOffset 목록 캐시 갱신
              │
              ├─ readQuery 목록
              │     └─ 버튼을 다시 눌러야 화면 갱신
              │
              └─ watchQuery 목록
                    └─ subscribe 콜백으로 자동 갱신
```
