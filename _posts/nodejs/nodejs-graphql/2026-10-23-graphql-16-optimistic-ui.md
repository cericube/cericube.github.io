---
layout: post
title: "16. [Apollo Client] optimisticResponse로 서버 응답 전에 UI 갱신하기"
description: "Apollo Client의 optimisticResponse로 좋아요, 게시글 추가와 삭제 결과를 서버 응답 전에 화면에 반영합니다. 정규화 캐시의 자동 갱신과 update(), cache.modify(), cache.evict()를 함께 사용하는 방법도 알아봅니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 16
ai_assisted: true
toc:
  - id: session-01
    title: "1. Optimistic UI 개념과 동작 원리"
  - id: session-02
    title: "2. 실습: optimisticResponse로 좋아요 수 즉시 반영하기"
  - id: session-03
    title: "3. 실습: optimisticResponse와 update()로 게시글 즉시 추가하기"
  - id: session-04
    title: "4. 실습: optimisticResponse와 update()로 게시글 즉시 삭제하기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics/apollo-client){: target="_blank" rel="noopener noreferrer" }**

앞선 글에서는 Mutation이 끝난 뒤 `update()`와 `cache.modify()`로 캐시를 수정했습니다.  
이번에는 서버 응답을 기다리는 동안 예상 결과를 먼저 보여 주는 Optimistic UI를 구현합니다.  

좋아요, 게시글 추가, 게시글 삭제를 차례로 구현하며 Mutation 결과에 따라 캐시를 갱신하는 방법을 비교합니다.  
요청이 성공하면 실제 응답으로 결과를 확정하고, 실패하면 Apollo Client가 낙관적 변경을 제거해 이전 화면으로 자동 복원합니다.  

## 1. Optimistic UI 개념과 동작 원리 {#session-01}

### 🟦 Optimistic UI와 optimisticResponse란?

일반적인 Mutation은 서버 응답을 받은 뒤 화면을 바꿉니다.  
네트워크가 느리면 사용자는 버튼을 눌러도 잠시 아무 변화가 없는 것처럼 느낄 수 있습니다.  

Optimistic UI는 요청이 성공할 것이라고 예상하고 화면부터 바꾸는 방식입니다.  
Apollo Client에서는 `optimisticResponse`에 예상 Mutation 결과를 전달해 구현합니다.  

예를 들어 현재 좋아요 수가 `5`라면 서버가 `6`을 반환할 것으로 예상할 수 있습니다.  

```text
좋아요 버튼 클릭
        ↓
optimisticResponse의 예상값 6 적용
        ↓
화면에 좋아요 6 즉시 표시
        ↓
서버 응답으로 최종 결과 확정
```

Optimistic UI가 서버 요청 자체를 빠르게 만드는 것은 아닙니다.  
서버를 기다리는 동안 예상 결과를 먼저 보여 주어 사용자가 느끼는 대기 시간을 줄입니다.  

### 🟦 일반적인 Mutation과 Optimistic UI 비교

두 방식의 차이는 화면을 갱신하는 시점입니다.  

| 구분 | 일반적인 Mutation | Optimistic UI |
| --- | --- | --- |
| 요청 직후 | 기존 화면을 유지합니다. | 예상 결과를 즉시 표시합니다. |
| 성공 시 | 서버 응답으로 화면을 갱신합니다. | 예상 결과를 실제 응답으로 교체합니다. |
| 실패 시 | 기존 화면을 그대로 유지합니다. | 예상 결과를 제거하고 이전 화면으로 복원합니다. |

좋아요처럼 결과를 쉽게 예측할 수 있는 작업은 Optimistic UI에 잘 맞습니다.  
결제처럼 실패 가능성이 크거나 결과를 미리 확정하기 어려운 작업은 신중하게 적용해야 합니다.  

### 🟦 낙관적 캐시 계층과 실제 캐시

Apollo Client는 `optimisticResponse`를 기본 캐시에 바로 덮어쓰지 않습니다.  
기본 캐시 위에 임시 낙관적 계층을 만들고 예상 결과를 그곳에 기록합니다.  

`Post:1`의 좋아요 수가 `5`일 때 예상값 `6`을 적용하면 다음과 같은 상태가 됩니다.  

```text
화면에서 읽는 값
└─ 임시 낙관적 캐시 계층
   └─ Post:1
      └─ likeCount: 6

기본 캐시
└─ Post:1
   └─ likeCount: 5
```

화면은 위쪽의 낙관적 계층을 먼저 읽으므로 좋아요 수 `6`을 표시합니다.  
기본 캐시의 값 `5`는 서버 응답이 올 때까지 그대로 남아 있습니다.  

### 🟦 성공하면 확정하고 실패하면 자동 롤백하기

서버 요청이 끝나면 Apollo Client는 임시 낙관적 계층을 제거합니다.  
그다음 요청 결과에 따라 화면이 달라집니다.  

```text
서버 요청 성공
임시 계층 제거 → 실제 응답을 기본 캐시에 기록 → 실제 값 표시

서버 요청 실패
임시 계층 제거 → 기존 기본 캐시가 다시 보임 → 이전 값으로 복원
```

예상 좋아요 수가 `6`이어도 서버가 `7`을 반환하면 최종 화면에는 `7`이 표시됩니다.  
요청이 실패하면 임시 값 `6`이 사라지고 기존 값 `5`가 다시 표시됩니다.  

개발자가 `catch` 블록에서 캐시 값을 직접 되돌릴 필요는 없습니다.  
다만 오류 메시지나 재시도 버튼처럼 실패를 알리는 UI는 별도로 처리해야 합니다.  

### 🟦 optimisticResponse와 update()의 역할 구분하기

`optimisticResponse`와 `update()`는 역할이 다릅니다.  

| 기능 | 역할 |
| --- | --- |
| `optimisticResponse` | 서버가 반환할 것으로 예상하는 Mutation 결과를 만듭니다. |
| `update()` | Mutation 결과를 이용해 목록과 같은 다른 캐시 필드를 직접 수정합니다. |

Mutation이 기존 객체의 필드를 반환하면 Apollo Client의 정규화 캐시가 해당 객체를 자동으로 갱신할 수 있습니다.  
좋아요처럼 기존 `Post`의 `likeCount`만 바꾸는 경우에는 `update()`가 필요하지 않습니다.  

반면 새 `Post`가 캐시에 저장되더라도 Apollo Client는 이를 어느 목록의 어느 위치에 추가해야 하는지 알지 못합니다.  
삭제 Mutation이 Boolean만 반환하는 경우에도 응답만으로는 수정할 목록과 제거할 Reference를 판단할 수 없습니다.  
이처럼 목록에 Reference를 추가하거나 제거해야 할 때는 `update()`를 함께 사용해 목록 구조를 직접 바꿉니다.  

`optimisticResponse`와 `update()`를 함께 사용하면 `update()`는 두 번 실행됩니다.  

```text
Mutation 실행 직후
└─ optimisticResponse를 사용해 update() 실행

서버 응답 수신 후
└─ 실제 응답을 사용해 update() 실행
```

첫 번째 변경은 임시 낙관적 계층에 기록됩니다.  
두 번째 변경은 실제 응답을 바탕으로 기본 캐시에 기록됩니다.  

## 2. 실습: optimisticResponse로 좋아요 수 즉시 반영하기 {#session-02}

좋아요 Mutation은 기존 게시글의 `id`와 변경된 `likeCount`를 반환합니다.  
같은 게시글임을 식별할 수 있으므로 `update()` 없이 `optimisticResponse`만으로 화면을 갱신할 수 있습니다.  

### 🟦 세 실습에서 캐시 변경 감지하기

먼저 세 실습이 공통으로 사용하는 캐시 관찰 코드를 준비합니다.  
`watchQuery()`로 게시글 목록을 조회하고 결과를 계속 관찰합니다.  
`subscribe()`의 `next` 콜백은 최초 조회뿐 아니라 캐시가 바뀔 때도 호출됩니다.  

```javascript
// 같은 게시글에 Mutation이 중복 실행되지 않도록 요청 중인 ID를 기록합니다.
const pending = new Set();

// 게시글 목록을 조회하고 같은 Query의 캐시 변화를 계속 관찰합니다.
const watcher = client.watchQuery({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
});

watcher.subscribe({
  // 최초 조회와 낙관적 변경, 실제 응답 반영 시점마다 목록을 다시 그립니다.
  next: ({ data }) => {
    document.querySelector('#posts').innerHTML = postCards(
      data?.postsByOffset?.items ?? [],
      '<span class="button-row"><button class="like-post">♥ 좋아요</button><button class="delete-post secondary">삭제</button></span>',
    );
  },
  error: (error) => output(error),
});
```

Mutation 코드에서 화면을 직접 다시 그릴 필요는 없습니다.  
캐시가 바뀌면 `watchQuery()`가 새 결과를 전달하고 `subscribe()`가 화면을 다시 그립니다.  
이 동작은 좋아요뿐 아니라 뒤에서 구현할 게시글 추가와 삭제에도 동일하게 적용됩니다.  

### 🟦 좋아요 실습 코드 살펴보기

좋아요 버튼을 클릭한 시점부터 서버 응답을 처리할 때까지의 전체 코드는 다음과 같습니다.  

```javascript
// 좋아요 버튼의 클릭을 위임받아 기존 Post의 likeCount를 낙관적으로 변경합니다.
document.querySelector('#posts').addEventListener('click', async (event) => {
  if (!event.target.matches('.like-post')) return;

  const card = event.target.closest('.post');
  const id = card.dataset.id;

  // 같은 게시글의 Mutation이 진행 중이면 중복 요청을 보내지 않습니다.
  if (pending.has(id)) return;
  pending.add(id);
  event.target.disabled = true;
  document.querySelector('#pending').textContent = `#${id} 응답 대기 중`;

  try {
    // 화면의 현재 값에 1을 더해 서버가 반환할 것으로 예상하는 값을 만듭니다.
    const visibleCount =
      Number(card.querySelector('footer > span').textContent.replace(/\D/g, '')) || 0;

    const result = await client.mutate({
      mutation: LIKE_POST,
      variables: { id },
      // 같은 타입과 ID를 사용해 기존 Post의 likeCount를 먼저 변경합니다.
      optimisticResponse: {
        likePost: {
          __typename: 'Post',
          id,
          likeCount: visibleCount + 1,
        },
      },
    });

    output(result.data, '서버 응답으로 낙관적 값을 확정');
  } catch (error) {
    // 실패하면 Apollo Client가 낙관적 likeCount를 제거해 이전 값으로 되돌립니다.
    output(error, '좋아요 실패 · 낙관적 변경 자동 롤백');
  } finally {
    // 성공과 실패에 관계없이 요청 대기 상태를 해제합니다.
    pending.delete(id);
    document.querySelector('#pending').textContent = '';
  }
});
```

### 🟦 코드의 동작 흐름 이해하기

먼저 클릭한 요소가 좋아요 버튼인지 확인하고 게시글의 `id`를 가져옵니다.  
`pending`에 같은 ID가 있으면 이전 요청이 끝나지 않은 상태이므로 추가 Mutation을 실행하지 않습니다.  

다음으로 화면에 표시된 좋아요 수를 읽고 `1`을 더해 예상값을 만듭니다.  
`optimisticResponse`의 구조와 필드 이름은 실제 `LIKE_POST` 응답에 맞춥니다.  

```text
likePost
├─ __typename: "Post"
├─ id: 클릭한 게시글 ID
└─ likeCount: 현재 화면의 값 + 1
```

Apollo Client의 `InMemoryCache`는 기본적으로 `__typename`과 `id`를 조합해 객체를 식별합니다.  
따라서 낙관적 응답의 `Post`를 목록이 이미 참조하고 있는 기존 게시글과 같은 객체로 인식합니다.  

```text
ROOT_QUERY.postsByOffset.items
└─ { __ref: "Post:1" }
           ↓
Post:1
└─ likeCount: 5 → 6
```

기존 `Post`의 `likeCount`만 바뀌므로 목록 Reference를 직접 수정하는 `update()`는 필요하지 않습니다.  
캐시가 바뀌면 앞에서 등록한 `watchQuery()`와 `subscribe()`가 새 결과를 받아 화면을 다시 그립니다.  

서버 요청이 성공하면 임시 좋아요 수를 제거하고 실제 `likeCount`를 기본 캐시에 저장합니다.  
요청이 실패하면 임시 계층을 제거해 화면을 변경 전 좋아요 수로 자동 복원합니다.  
마지막으로 `finally`에서 `pending`을 비우고 요청 대기 표시를 해제합니다.  

## 3. 실습: optimisticResponse와 update()로 게시글 즉시 추가하기 {#session-03}

게시글 추가는 좋아요보다 한 단계 더 필요합니다.  
새 `Post` 객체를 캐시에 저장하는 것뿐 아니라 `postsByOffset.items` 목록에도 새 Reference를 넣어야 합니다.  

### 🟦 새 게시글 생성에 update()가 필요한 이유

`CREATE_POST`는 생성한 게시글의 모든 필드를 반환합니다.  

```graphql
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ...PostFields
  }
}
```

Apollo Client는 응답으로 받은 게시글을 정규화해 `Post:<id>` 객체로 저장할 수 있습니다.  
하지만 이 객체를 어떤 페이지의 어떤 위치에 추가할지는 스스로 판단할 수 없습니다.  

```text
optimisticResponse만 사용
└─ 임시 Post 객체는 생성됨
   └─ postsByOffset.items에는 연결되지 않음

optimisticResponse와 update() 사용
└─ 임시 Post 객체 생성
   └─ postsByOffset.items 맨 앞에 Reference 추가
```

따라서 게시글 추가 실습에서는 `update()`와 `cache.modify()`를 함께 사용합니다.  

### 🟦 임시 ID로 optimisticResponse 구성하기

서버 응답 전에는 새 게시글의 실제 ID를 알 수 없습니다.  
실습에서는 실제 ID와 충돌하지 않는 문자열을 만들어 임시 게시글을 식별합니다.  

```javascript
const title = document.querySelector('#title').value;
const content = document.querySelector('#content').value;
const now = new Date().toISOString();

// 동시에 생성한 임시 게시글도 서로 구분할 수 있는 ID를 만듭니다.
const optimisticId =
  `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

`optimisticResponse`에는 목록 Query가 화면을 그릴 때 사용하는 필드를 모두 넣습니다.  

```javascript
optimisticResponse: {
  createPost: {
    __typename: 'Post',
    id: optimisticId,
    title,
    content,
    published: true,
    likeCount: 0,
    authorId: 'optimistic-user',
    createdAt: now,
    updatedAt: now,
  },
},
```

필요한 필드가 빠지면 임시 게시글을 그리는 동안 값이 비어 보일 수 있습니다.  
실제 Mutation 응답과 목록 Query의 형태를 기준으로 예상 객체를 구성하는 것이 안전합니다.  

### 🟦 cache.modify()로 목록에 Reference 추가하기

`update()`가 실행될 때 Mutation 결과의 새 게시글은 이미 정규화 캐시에 기록되어 있습니다.  
`toReference(newPost)`로 해당 객체를 가리키는 Reference를 만든 뒤 목록 맨 앞에 추가합니다.  

```javascript
update(cache, { data }) {
  const newPost = data?.createPost;
  if (!newPost) return;

  cache.modify({
    id: 'ROOT_QUERY',
    fields: {
      postsByOffset(existing, { readField, toReference }) {
        if (!existing) return existing;

        // 정규화된 새 Post를 가리키는 Reference를 만듭니다.
        const newPostRef = toReference(newPost);
        if (!newPostRef) return existing;

        // 같은 실행 단계에서 동일한 게시글이 중복으로 들어가지 않게 확인합니다.
        if (existing.items.some((ref) => readField('id', ref) === newPost.id)) {
          return existing;
        }

        return {
          ...existing,
          items: [newPostRef, ...existing.items],
          totalCount: existing.totalCount + 1,
        };
      },
    },
  });
},
```

`postsByOffset`는 게시글 배열만 저장하지 않고 `items`, `totalCount`, `pageInfo`를 가진 객체입니다.  
기존 값은 펼침 연산자로 유지하고, `items`와 `totalCount`만 새 값으로 바꿉니다.  

### 🟦 낙관적 응답과 실제 응답에서 update() 실행하기

게시글 등록 코드 전체는 다음과 같습니다.  

```javascript
document.querySelector('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = document.querySelector('#title').value;
  const content = document.querySelector('#content').value;
  const now = new Date().toISOString();
  const optimisticId =
    `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const button = document.querySelector('#create');

  button.disabled = true;

  try {
    // 예상 결과를 먼저 캐시에 반영한 뒤 실제 게시글 생성 요청을 보냅니다.
    const result = await client.mutate({
      mutation: CREATE_POST,
      variables: { input: { title, content, published: true } },
      // 목록을 바로 그릴 수 있도록 PostFields에 필요한 값을 모두 채웁니다.
      optimisticResponse: {
        createPost: {
          __typename: 'Post',
          // 서버가 실제 ID를 발급하기 전까지 사용할 임시 캐시 ID입니다.
          id: optimisticId,
          title,
          content,
          published: true,
          likeCount: 0,
          authorId: 'optimistic-user',
          createdAt: now,
          updatedAt: now,
        },
      },
      // 낙관적 응답과 실제 서버 응답을 받을 때 각각 한 번씩 실행됩니다.
      update(cache, { data }) {
        // 현재 실행 단계에서 받은 임시 Post 또는 실제 Post를 가져옵니다.
        const newPost = data?.createPost;
        if (!newPost) return;

        // ROOT_QUERY에 저장된 게시글 목록의 구조를 직접 수정합니다.
        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            postsByOffset(existing, { readField, toReference }) {
              // 목록 Query가 아직 캐시에 없으면 수정할 대상이 없으므로 종료합니다.
              if (!existing) return existing;

              // 정규화된 Post 객체를 가리키는 Reference를 만듭니다.
              const newPostRef = toReference(newPost);
              if (!newPostRef) return existing;

              // 같은 ID의 게시글이 이미 있으면 목록에 중복으로 추가하지 않습니다.
              if (existing.items.some((ref) => readField('id', ref) === newPost.id)) {
                return existing;
              }

              // 기존 페이지 정보는 유지하고 새 게시글과 전체 개수만 갱신합니다.
              return {
                ...existing,
                items: [newPostRef, ...existing.items],
                totalCount: existing.totalCount + 1,
              };
            },
          },
        });
      },
    });

    output(result.data, '서버 응답으로 임시 게시글 확정');
  } catch (error) {
    // 실패하면 임시 Post와 목록 Reference가 함께 제거됩니다.
    output(error, '게시글 등록 실패 · 낙관적 추가 자동 롤백');
  } finally {
    button.disabled = false;
  }
});
```

Mutation 직후 첫 번째 `update()`는 임시 ID를 가진 게시글을 목록에 추가합니다.  
서버 응답 후 두 번째 `update()`는 서버가 발급한 실제 ID를 가진 게시글을 목록에 추가합니다.  

### 🟦 임시 게시글을 실제 게시글로 교체하기

요청이 성공하면 Apollo Client는 낙관적 계층을 제거하고 실제 응답을 기본 캐시에 기록합니다.  
이 과정에서 임시 ID를 가진 게시글은 사라지고 실제 ID를 가진 게시글이 남습니다.  

```text
Mutation 실행 직후
postsByOffset.items
└─ Post:optimistic-...

서버 응답 수신 후
postsByOffset.items
└─ Post:27
```

화면은 같은 위치에 실제 게시글이 나타나므로 자연스럽게 확정된 것처럼 보입니다.  
요청이 실패하면 임시 `Post`와 목록에 추가한 Reference가 모두 낙관적 계층과 함께 제거됩니다.  

## 4. 실습: optimisticResponse와 update()로 게시글 즉시 삭제하기 {#session-04}

삭제 Mutation은 삭제 성공 여부인 Boolean만 반환합니다.  
응답에 게시글 객체가 없으므로 `update()`에서 요청 변수의 `id`를 이용해 캐시를 직접 정리합니다.  

### 🟦 게시글 삭제에 update()가 필요한 이유

실습의 `DELETE_POST`는 다음과 같습니다.  

```graphql
mutation DeletePost($id: ID!) {
  deletePost(id: $id)
}
```

서버 응답은 `{ deletePost: true }`처럼 성공 여부만 알려 줍니다.  
Apollo Client는 이 값만으로 다음 작업을 자동으로 처리할 수 없습니다.  

- `postsByOffset.items`에서 삭제한 게시글의 Reference를 제거합니다.  
- `totalCount`를 `1`만큼 줄입니다.  
- 정규화 캐시에 남은 `Post:<id>` 객체를 제거합니다.  

따라서 삭제할 ID를 클로저에서 사용해 `update()`로 세 작업을 처리합니다.  

### 🟦 Boolean optimisticResponse로 성공 결과 예상하기

삭제 Mutation의 실제 응답과 같은 형태로 낙관적 응답을 만듭니다.  

```javascript
optimisticResponse: {
  deletePost: true,
},
```

예상 응답을 `true`로 설정하면 Apollo Client는 삭제가 성공한 것처럼 `update()`를 즉시 실행합니다.  
삭제 Mutation은 `Post` 객체를 반환하지 않으므로 `__typename`과 `id`를 넣지 않습니다.  

### 🟦 cache.modify()로 목록에서 Reference 제거하기

`cache.modify()`에서 삭제할 ID와 다른 Reference만 남깁니다.  
목록의 전체 개수도 함께 줄입니다.  

```javascript
cache.modify({
  id: 'ROOT_QUERY',
  fields: {
    postsByOffset(existing, { readField }) {
      if (!existing) return existing;

      // 삭제 대상이 아닌 Post Reference만 새 배열에 남깁니다.
      const items = existing.items.filter(
        (ref) => readField('id', ref) !== id,
      );

      return {
        ...existing,
        items,
        totalCount: Math.max(0, existing.totalCount - 1),
      };
    },
  },
});
```

`readField('id', ref)`는 각 Reference가 가리키는 `Post`의 ID를 읽습니다.  
`Math.max(0, ...)`은 전체 개수가 음수가 되지 않도록 막습니다.  

### 🟦 cache.evict()로 정규화된 Post 제거하기

목록에서 Reference를 빼더라도 정규화된 `Post:<id>` 객체는 캐시에 남을 수 있습니다.  
`cache.evict()`로 해당 객체도 함께 제거합니다.  

```javascript
cache.evict({
  id: cache.identify({ __typename: 'Post', id }),
});
```

`cache.identify()`는 `__typename`과 `id`를 이용해 `Post:1`과 같은 캐시 ID를 만듭니다.  
`deletePost` 응답에는 게시글 정보가 없으므로 요청에 사용한 `id`를 그대로 사용합니다.  

### 🟦 삭제 확정과 실패 시 자동 롤백하기

삭제 처리 코드 전체는 다음과 같습니다.  

```javascript
document.querySelector('#posts').addEventListener('click', async (event) => {
  // 삭제 버튼에서 발생한 클릭만 처리합니다.
  if (!event.target.matches('.delete-post')) return;

  const id = event.target.closest('.post').dataset.id;

  // 같은 게시글의 Mutation이 진행 중이면 중복 요청을 막습니다.
  if (pending.has(id)) return;
  pending.add(id);
  event.target.disabled = true;
  document.querySelector('#pending').textContent = `#${id} 응답 대기 중`;

  try {
    const result = await client.mutate({
      mutation: DELETE_POST,
      variables: { id },
      // 삭제 성공을 예상해 update()를 즉시 실행합니다.
      optimisticResponse: { deletePost: true },
      update(cache, { data }) {
        if (!data?.deletePost) return;

        cache.modify({
          id: 'ROOT_QUERY',
          fields: {
            postsByOffset(existing, { readField }) {
              if (!existing) return existing;

              const items = existing.items.filter(
                (ref) => readField('id', ref) !== id,
              );

              return {
                ...existing,
                items,
                totalCount: Math.max(0, existing.totalCount - 1),
              };
            },
          },
        });

        // Boolean 응답에 Post가 없으므로 요청 변수의 id로 객체를 제거합니다.
        cache.evict({
          id: cache.identify({ __typename: 'Post', id }),
        });
      },
    });

    output(result.data, `#${id} 삭제 확정`);
  } catch (error) {
    // 실패하면 목록과 Post 객체에 적용한 낙관적 변경이 모두 취소됩니다.
    output(error, '게시글 삭제 실패 · 낙관적 변경 자동 롤백');
  } finally {
    pending.delete(id);
    document.querySelector('#pending').textContent = '';
  }
});
```

낙관적 실행에서는 목록의 Reference 제거와 `cache.evict()`가 모두 임시 계층에 적용됩니다.  
따라서 사용자가 삭제 버튼을 누르면 게시글이 화면에서 즉시 사라집니다.  

서버가 삭제 성공을 반환하면 `update()`가 실제 응답으로 다시 실행되어 삭제를 확정합니다.  
서버 요청이 실패하면 Apollo Client가 낙관적 계층을 제거하므로 게시글과 목록의 전체 개수가 이전 상태로 자동 복원됩니다.  

이번 실습의 세 Mutation을 정리하면 다음과 같습니다.  

| 작업 | optimisticResponse | update() | 캐시 처리 |
| --- | --- | --- | --- |
| 좋아요 | 예상 `Post` 반환 | 사용하지 않음 | 같은 `__typename`과 `id`로 기존 객체를 자동 갱신합니다. |
| 게시글 추가 | 임시 ID를 가진 `Post` 반환 | 사용함 | 새 Reference를 목록에 추가합니다. |
| 게시글 삭제 | `deletePost: true` 반환 | 사용함 | 목록 Reference와 정규화된 객체를 제거합니다. |

`optimisticResponse`는 예상 서버 응답을 만들고, `update()`는 그 응답만으로 자동 처리되지 않는 목록 구조를 바꿉니다.  
