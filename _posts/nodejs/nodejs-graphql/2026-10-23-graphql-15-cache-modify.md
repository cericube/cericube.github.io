---
layout: post
title: "15. [Apollo Client] update()와 cache.modify()로 캐시 직접 갱신하기"
description: "Apollo Client의 update()와 cache.modify()로 Mutation 결과를 목록 캐시에 직접 반영합니다. writeFragment와 readField를 활용해 서버 재조회 없이 게시글을 추가하고 삭제하는 방법을 실습합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 15
ai_assisted: true
toc:
  - id: session-01
    title: "1. Mutation 이후 캐시 직접 갱신 개념과 동작 흐름"
  - id: session-02
    title: "2. update()와 cache.modify() 기본 사용 방법"
  - id: session-03
    title: "3. 예시: 게시글 등록 후 캐시 목록에 추가하기"
  - id: session-04
    title: "4. 예시: 게시글 삭제 후 캐시 목록에서 제거하기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics/apollo-client){: target="_blank" rel="noopener noreferrer" }**

`refetchQueries`는 Mutation 이후 목록을 서버에서 다시 가져옵니다.  
이번에는 목록을 다시 요청하지 않고 `update()`와 `cache.modify()`로 캐시를 직접 바꿉니다.  

```text
게시글 등록·삭제 Mutation
          ▼
서버에서 Mutation 결과 응답
          ▼
update(cache, result) 실행
          ▼
cache.modify()로 목록 캐시 수정
          ▼
watchQuery()가 변경 감지 → 화면 자동 갱신
```

## 1. Mutation 이후 캐시 직접 갱신 개념과 동작 흐름 {#session-01}

### 🟦 서버 재조회와 캐시 직접 갱신 비교

Mutation 이후 목록을 최신 상태로 만드는 방법은 크게 두 가지입니다.  

| 구분 | `refetchQueries` | `update()`와 `cache.modify()` |
| --- | --- | --- |
| 갱신 방식 | 목록 Query를 서버에 다시 요청 | Mutation 결과로 캐시를 직접 수정 |
| 추가 네트워크 요청 | 있음 | 없음 |
| 장점 | 서버의 최신 결과를 그대로 사용 | 빠르게 반영하고 요청 수를 줄임 |
| 주의점 | 요청이 많아질 수 있음 | 목록 조건과 개수를 직접 맞춰야 함 |
| 적합한 상황 | 변경 범위가 복잡하거나 응답 정보가 부족할 때 | 변경 결과와 목록 구조를 정확히 알 때 |

![서버 재조회와 캐시 직접 갱신 방식 비교](/assets/images/nodejs/nodejs-graphql/image-2026-10-23.png)

`refetchQueries`는 서버가 계산한 최신 목록을 다시 받으므로 구현이 단순합니다.  
반면 캐시 직접 갱신은 빠르지만, 클라이언트 코드가 서버의 정렬·필터·페이지 조건을 올바르게 반영해야 합니다.  

### 🟦 Mutation부터 화면 반영까지

`client.mutate()`의 `update` 콜백은 Mutation 결과가 캐시에 기록된 뒤 실행됩니다.  
이 콜백에서 `cache.modify()`로 목록 필드를 바꾸면 해당 목록을 관찰하던 Query에 새 결과가 전달됩니다.  

![Mutation부터 화면 반영까지의 흐름](/assets/images/nodejs/nodejs-graphql/image-2026-10-23-1.png)

캐시를 직접 바꾸는 것과 화면을 다시 그리는 것은 별도의 작업입니다.  
`cache.modify()`는 캐시 데이터만 변경합니다.  
이 변경으로 `watchQuery()`가 관찰하는 Query 결과가 달라지면 `subscribe()`의 `next` 콜백이 실행됩니다.  
이 콜백에서 `render()`를 호출해 화면을 다시 그립니다.  

```javascript
// 게시글 목록을 조회하고 같은 Query 결과가 바뀌는지 계속 관찰합니다.
const watcher = client.watchQuery({
  query: POSTS_QUERY,
  variables: LIST_VARIABLES,
});

watcher.subscribe({
  // 캐시 결과가 바뀔 때마다 최신 목록을 화면에 표시합니다.
  next: ({ data }) => render(data),
  error: (error) => output(error),
});
```

따라서 Mutation 처리 코드에서 `render()`를 다시 호출하지 않아도 게시글 목록이 자동으로 갱신됩니다.  

### 🟦 정규화 캐시와 목록 갱신 원리

Apollo Client의 `InMemoryCache`는 기본적으로 객체의 `__typename`과 `id` 또는 `_id`를 조합해 객체를 구분합니다.  
예를 들어 `id`가 `10`인 게시글은 캐시에서 `Post:10`이라는 키로 관리됩니다.  
목록 필드는 게시글 객체 전체를 중복 저장하는 대신, 정규화된 객체를 가리키는 **Reference**를 보관합니다.  
Reference는 `{ __ref: 'Post:10' }`과 같은 형태의 내부 참조입니다.  

![정규화 캐시와 목록 갱신 원리](/assets/images/nodejs/nodejs-graphql/image-2026-10-23-2.png)

Apollo Client의 정규화 캐시는 게시글의 실제 필드 데이터를 `Post:10`과 같은 고유 키로 구분해 저장합니다.  
목록에는 해당 객체를 가리키는 Reference를 저장합니다.  
Mutation이 새 게시글을 반환하면 Apollo Client는 해당 객체를 정규화 캐시에 저장할 수 있습니다. 하지만 기존 게시글 목록에는 자동으로 추가하지 않습니다.  
따라서 `cache.modify()`로 `postsByOffset.items`에 새 게시글의 Reference를 추가해야 합니다.  

## 2. update()와 cache.modify() 기본 사용 방법 {#session-02}

### 🟦 update()와 cache.modify()의 역할

`update()`는 Mutation 결과를 받은 뒤 어떤 캐시 데이터를 바꿀지 정하는 콜백입니다.  
`cache.modify()`는 `update()` 안에서 선택한 캐시 필드의 값을 실제로 변경합니다.  

```text
update(cache, { data })
├─ data에서 Mutation 결과 확인
└─ cache.modify() 호출
   ├─ 수정할 캐시 객체와 필드 선택
   ├─ 기존 필드 값으로 새 값 계산
   └─ 계산한 값을 캐시에 저장
```

```javascript
// Mutation 응답을 받은 뒤 update 콜백에서 목록 캐시를 수정합니다.
const result = await client.mutate({
  mutation: CREATE_POST,
  variables: {
    input: {
      title: document.querySelector('#title').value,
      content: document.querySelector('#content').value,
      published: true,
    },
  },
  update(cache, { data }) {
    // data.createPost에는 서버가 반환한 새 게시글이 들어 있습니다.
    const createdPost = data.createPost;

    // createdPost를 이용한 실제 목록 수정은 다음 실습에서 작성합니다.
  },
});
```

| 값 | 역할 |
| --- | --- |
| `cache` | 현재 `InMemoryCache`를 읽고 수정하는 객체 |
| `data` | 서버가 반환한 Mutation 결과 |
| `data.createPost` | 이번 실습에서 새로 생성된 게시글 |

> `optimisticResponse`를 함께 사용하면 `update()`가 낙관적 응답과 실제 서버 응답에 대해 각각 실행될 수 있습니다. 같은 항목이 두 번 들어가지 않도록 목록을 수정할 때 ID를 확인해야 합니다.  

### 🟦 ROOT_QUERY와 cache.modify() 기본 구조

GraphQL Query의 최상위 필드는 캐시의 `ROOT_QUERY` 객체에 저장됩니다.  
실습의 `postsByOffset`도 최상위 Query 필드이므로 `ROOT_QUERY`에서 수정합니다.  

```javascript
// ROOT_QUERY에 저장된 postsByOffset의 전체 개수를 1 늘립니다.
cache.modify({
  // 수정할 캐시 객체를 선택합니다.
  id: 'ROOT_QUERY',
  fields: {
    // 현재 필드 값을 받아 새 값을 반환합니다.
    postsByOffset(existing) {
      return {
        // items와 pageInfo 같은 기존 값은 그대로 유지합니다.
        ...existing,
        totalCount: existing.totalCount + 1,
      };
    },
  },
});
```

| 항목 | 역할 |
| --- | --- |
| `id` | 수정할 캐시 객체의 ID 지정 |
| `fields` | 수정할 필드와 수정 함수 지정 |
| `existing` | 수정 함수에 전달되는 현재 필드 값 |
| 수정 함수의 반환값 | 기존 필드를 대체할 새 값 |

수정 함수에서는 `existing`을 직접 바꾸지 않고 새 객체나 배열을 반환합니다.  
예제의 `...existing`은 `items`와 `pageInfo`를 유지하면서 `totalCount`만 바꾸는 역할을 합니다.  

`cache.modify()`는 캐시에 없는 필드를 새로 만들지 못합니다. 따라서 실습에서는 게시글 목록을 먼저 조회한 뒤 캐시를 수정합니다.  

### 🟦 페이지와 필터별 캐시 수정 주의사항

`postsByOffset`처럼 인수를 받는 Query 필드는 페이지나 필터 조건에 따라 별도의 캐시 항목으로 저장될 수 있습니다.  

```text
ROOT_QUERY
├─ postsByOffset({"pagination":{"offset":0,"limit":10}})
│  └─ 첫 번째 페이지 목록
│
└─ postsByOffset({"pagination":{"offset":10,"limit":10}})
   └─ 두 번째 페이지 목록
```

`fields`에 `postsByOffset`을 지정하면 캐시에 저장된 같은 필드의 여러 인수 조합이 모두 수정 대상이 될 수 있습니다.  
여러 페이지나 필터를 함께 사용한다면 수정할 목록을 구분하거나 페이지네이션 정책에 맞게 갱신해야 합니다.  

## 3. 예시: 게시글 등록 후 캐시 목록에 추가하기 {#session-03}

이번에는 `CREATE_POST` Mutation이 반환한 새 게시글을 캐시 목록에 바로 추가합니다.  

### 🟦 게시글 등록 처리 흐름

등록 작업은 다음 순서로 진행됩니다.  

```text
CREATE_POST Mutation
        ↓
서버에서 새 게시글 반환
        ↓
새 게시글을 Post:10으로 정규화해 캐시에 저장
단, postsByOffset 목록은 아직 그대로 유지
        ↓
update() 실행
        ↓
writeFragment()로 새 게시글 Reference 가져오기
        ↓
cache.modify()로 items 맨 앞에 추가
        ↓
totalCount 1 증가
        ↓
watchQuery()가 변경 감지 → 화면 갱신
```

이 실습처럼 기본 캐시 설정을 사용하면 Apollo Client는 Mutation 응답을 먼저 정규화해 캐시에 저장한 뒤 `update()`를 실행합니다.  
따라서 `update()`가 시작될 때 새 `Post` 객체는 이미 캐시에 있지만, `postsByOffset.items`와 `totalCount`는 아직 바뀌지 않은 상태입니다.  

기존 목록에 게시글이 두 개 있다면 등록 후에는 다음과 같이 바뀝니다.  

```text
등록 전
items: [게시글 2, 게시글 1]
totalCount: 2

등록 후
items: [게시글 3, 게시글 2, 게시글 1]
totalCount: 3
```

### 🟦 ① writeFragment()로 새 게시글 Reference 가져오기

`InMemoryCache`는 Mutation 응답에 포함된 `__typename`과 `id`로 객체를 식별합니다.  
예를 들어 `CREATE_POST`가 다음 게시글을 반환했다고 가정하겠습니다.  

```javascript
{
  __typename: 'Post',
  id: '10',
  title: '새 게시글',
  content: '게시글 내용',
}
```

Apollo Client는 이 게시글을 `Post:10`이라는 고유 키로 구분해 정규화 캐시에 자동으로 저장합니다.  

```text
Post:10
├─ __typename: "Post"
├─ id: "10"
├─ title: "새 게시글"
└─ content: "게시글 내용"
```

하지만 `Post:10` 객체가 저장되어도 기존 게시글 목록은 자동으로 바뀌지 않습니다.  
Apollo Client는 새 게시글이 어떤 페이지와 필터 조건의 목록에 들어가야 하는지 알 수 없기 때문입니다.  

```text
ROOT_QUERY
└─ postsByOffset(...)
   ├─ items
   │  ├─ { __ref: "Post:9" }
   │  └─ { __ref: "Post:8" }
   └─ totalCount: 2

Post:10  ← Mutation 응답으로 새로 저장된 객체
```

이 상태에서는 `Post:10`이 캐시에 존재하지만 `postsByOffset.items`에는 연결되지 않았습니다.  
새 게시글을 목록에 넣으려면 `Post:10`을 가리키는 **Reference(참조)**가 필요합니다.  

`cache.writeFragment()`를 사용하면 게시글 데이터를 캐시에 기록하면서 해당 객체의 Reference를 반환받을 수 있습니다.  

```javascript
// 같은 Post를 다시 병합하면서 목록에 넣을 Reference를 얻습니다.
const newPostRef = cache.writeFragment({
  fragment: POST_FIELDS,
  data: data.createPost,
});
```

| 값 | 역할 |
| --- | --- |
| `POST_FIELDS` | 캐시에 기록할 게시글 필드를 정의한 GraphQL Fragment |
| `data.createPost` | Mutation 응답으로 받은 새 게시글 데이터 |
| `newPostRef` | 캐시에 저장된 게시글을 가리키는 Reference |

`newPostRef`에는 다음과 같은 Reference가 들어갑니다.  

```javascript
{ __ref: 'Post:10' }
```

현재 실습에서는 Mutation 응답으로 `Post:10`이 이미 캐시에 저장되어 있습니다.  
따라서 `writeFragment()`가 같은 객체를 하나 더 만드는 것은 아닙니다.  
기존 객체에 Fragment의 필드를 기록하고 그 객체를 가리키는 Reference를 반환합니다.  

즉, 이 실습에서 `writeFragment()`를 사용하는 주된 목적은 새 객체를 처음 저장하는 것이 아니라 목록에 추가할 Reference를 얻는 것입니다.  
이제 `newPostRef`를 `cache.modify()`에 전달해 기존 목록과 연결합니다.  

### 🟦 ② cache.modify()로 게시글 목록 수정하기

```javascript
// ROOT_QUERY에 저장된 postsByOffset 필드를 선택합니다.
cache.modify({
  id: 'ROOT_QUERY',
  fields: {
    postsByOffset(existing, { readField }) {
      // existing을 바탕으로 새 목록 값을 반환합니다.
    },
  },
});
```

`existing`에는 현재 게시글 목록이 전달됩니다. `readField()`는 목록의 Reference가 가리키는 게시글 필드를 읽을 때 사용합니다.  

### 🟦 ③ readField()로 중복 게시글 확인하기

```javascript
// Reference가 가리키는 ID를 읽어 같은 게시글이 있는지 확인합니다.
const alreadyAdded = existing.items.some(
  (ref) => readField('id', ref) === data.createPost.id,
);

if (alreadyAdded) return existing;
```

`existing.items`의 각 게시글은 Reference일 수 있습니다. 따라서 `ref.id`처럼 내부 구조에 직접 접근하지 않고 `readField('id', ref)`로 게시글 ID를 읽습니다.  
같은 ID가 이미 있다면 기존 목록을 그대로 반환하므로 게시글과 `totalCount`가 중복으로 추가되지 않습니다.  

### 🟦 ④ items와 totalCount 변경하기

```javascript
// 기존 필드는 유지하고 목록과 전체 개수만 새 값으로 바꿉니다.
return {
  ...existing,
  items: [newPostRef, ...existing.items],
  totalCount: existing.totalCount + 1,
};
```

| 코드 | 동작 |
| --- | --- |
| `...existing` | `pageInfo`를 포함한 기존 필드 유지 |
| `[newPostRef, ...existing.items]` | 새 게시글을 목록 맨 앞에 추가 |
| `existing.totalCount + 1` | 전체 게시글 개수를 1 증가 |

기존 객체와 배열을 직접 수정하지 않고 새 값을 만들어 반환합니다.  
그 결과 `Post:10`을 가리키는 Reference가 목록 맨 앞에 추가되고 `totalCount`가 3으로 바뀝니다.  

```text
ROOT_QUERY
└─ postsByOffset(...)
   ├─ items
   │  ├─ { __ref: "Post:10" }  ← 새 게시글 Reference
   │  ├─ { __ref: "Post:9" }
   │  └─ { __ref: "Post:8" }
   └─ totalCount: 3
```

변경된 캐시 결과는 `watchQuery()`의 구독자에게 전달되고, 새 게시글이 화면에 표시됩니다.  

## 4. 예시: 게시글 삭제 후 캐시 목록에서 제거하기 {#session-04}

게시글 삭제도 등록과 마찬가지로 `update()`와 `cache.modify()`를 사용합니다.  
다만 새 게시글을 추가하는 대신, 삭제한 게시글의 Reference를 목록에서 제거하고 정규화 객체도 정리합니다.  

### 🟦 게시글 삭제 처리 흐름

```text
DELETE_POST Mutation
        ↓
서버에서 삭제 성공 여부 반환
단, 목록과 Post 객체는 아직 캐시에 남아 있음
        ↓
update() 실행
        ↓
cache.modify()로 대상 Reference 제거
        ↓
totalCount 1 감소
        ↓
cache.evict()와 cache.gc()로 남은 데이터 정리
        ↓
watchQuery()가 변경 감지 → 화면 갱신
```

실습의 `DELETE_POST`는 삭제된 게시글 객체가 아니라 성공 여부만 반환합니다.  
Apollo Client는 이 응답만으로 어떤 `Post` 객체와 목록 Reference를 지워야 하는지 알 수 없습니다.  
따라서 `update()`에서 요청에 사용한 `id`를 기준으로 목록과 정규화 객체를 직접 정리합니다.  

게시글이 세 개 있는 목록에서 ID가 `2`인 게시글을 삭제하면 다음과 같이 바뀝니다.  

```text
삭제 전
items: [게시글 3, 게시글 2, 게시글 1]
totalCount: 3

삭제 후
items: [게시글 3, 게시글 1]
totalCount: 2
```

삭제 코드도 네 단계로 나누어 살펴보겠습니다.  

### 🟦 ① DELETE_POST에 삭제할 ID 전달하기

```javascript
// 삭제할 게시글 ID를 Mutation 변수로 전달합니다.
const result = await client.mutate({
  mutation: DELETE_POST,
  variables: { id },
  update(cache) {
    // 성공한 Mutation의 ID를 기준으로 캐시를 수정합니다.
  },
});
```

실습의 `DELETE_POST` Mutation은 게시글 ID를 받아 삭제하고 성공 여부를 Boolean 값으로 반환합니다.  
응답에는 삭제한 게시글의 `__typename`과 `id`가 없습니다. 따라서 Apollo Client는 캐시의 `Post:2` 객체나 목록의 Reference를 자동으로 제거하지 않습니다.  
`update()`에서는 Mutation 요청에 사용한 `id`로 삭제할 캐시 항목을 찾습니다.  

```text
ROOT_QUERY
└─ postsByOffset(...)
   ├─ items
   │  ├─ { __ref: "Post:3" }
   │  ├─ { __ref: "Post:2" }  ← 목록에서 제거할 Reference
   │  └─ { __ref: "Post:1" }
   └─ totalCount: 3

Post:2  ← 정규화 캐시에서 제거할 객체
```

### 🟦 ② filter()로 삭제할 게시글 제외하기

```javascript
// 삭제할 ID와 다른 게시글 Reference만 새 배열에 남깁니다.
const items = existing.items.filter(
  (ref) => readField('id', ref) !== id,
);
```

`filter()`는 조건을 통과한 항목만 담은 새 배열을 반환합니다.  
각 항목은 Reference이므로 `ref.id`로 직접 접근하지 않습니다. `readField()`로 Reference가 가리키는 객체의 ID를 읽고, 삭제할 ID와 다른 게시글만 남깁니다.  

```text
기존 items: [3, 2, 1]
삭제할 ID: 2

filter() 실행

변경 items: [3, 1]
```

### 🟦 ③ items와 totalCount 변경하기

```javascript
// 삭제한 항목이 빠진 배열을 저장하고 전체 개수를 1 줄입니다.
return {
  ...existing,
  items,
  totalCount: Math.max(0, existing.totalCount - 1),
};
```

| 코드 | 동작 |
| --- | --- |
| `...existing` | `pageInfo`를 포함한 기존 필드 유지 |
| `items` | 삭제한 게시글이 제외된 새 목록 |
| `Math.max(0, existing.totalCount - 1)` | 전체 개수를 1 줄이고 음수 방지 |

등록할 때는 새 Reference를 배열 앞에 추가했습니다. 삭제할 때는 `filter()`로 대상 Reference를 제외합니다.  
이 단계가 끝나면 목록에서는 `Post:2`의 Reference가 사라지고 `totalCount`가 2로 바뀝니다.  

```text
ROOT_QUERY
└─ postsByOffset(...)
   ├─ items
   │  ├─ { __ref: "Post:3" }
   │  └─ { __ref: "Post:1" }
   └─ totalCount: 2

Post:2  ← 목록에서는 빠졌지만 정규화 객체는 남아 있을 수 있음
```

### 🟦 ④ cache.evict()와 cache.gc()로 삭제 데이터 정리하기

```javascript
// 게시글의 캐시 ID를 구해 정규화 객체를 제거합니다.
cache.evict({
  id: cache.identify({ __typename: 'Post', id }),
});

// 어떤 객체에서도 참조하지 않는 데이터를 정리합니다.
cache.gc();
```

`cache.modify()`는 `postsByOffset` 목록만 수정합니다.  
따라서 목록에서 Reference를 제거해도 `Post:2` 객체는 정규화 캐시에 남을 수 있습니다.  
실습에서는 다음 API로 남은 데이터를 정리합니다.  

| API | 역할 |
| --- | --- |
| `cache.identify()` | `__typename`과 `id`로 게시글의 캐시 ID 확인 |
| `cache.evict()` | 지정한 캐시 객체 제거 |
| `cache.gc()` | 더 이상 참조되지 않는 캐시 데이터 정리 |

`cache.identify()`는 `__typename: 'Post'`와 삭제할 `id`를 조합해 `Post:2` 같은 캐시 ID를 만듭니다.  
`cache.evict()`는 이 ID에 해당하는 객체를 제거하고, `cache.gc()`는 그 뒤 어떤 객체에서도 참조하지 않는 데이터를 정리합니다.  

```text
cache.modify()  → 목록에서 Post:2 Reference 제거
cache.evict()   → 정규화 캐시에서 Post:2 객체 제거
cache.gc()      → 더 이상 참조되지 않는 데이터 정리
```

목록과 정규화 객체가 모두 정리되면 `watchQuery()`가 변경된 목록 결과를 구독자에게 전달합니다.  

### 🟦 등록과 삭제 방식 비교

| 구분 | 게시글 등록 | 게시글 삭제 |
| --- | --- | --- |
| Mutation | `CREATE_POST` | `DELETE_POST` |
| 기준 데이터 | 새 게시글 객체 | 삭제할 게시글 ID |
| Reference 처리 | `writeFragment()`로 가져오기 | `readField()`로 ID 확인 |
| 목록 변경 | 새 Reference 추가 | `filter()`로 Reference 제거 |
| 전체 개수 | `totalCount + 1` | `totalCount - 1` |
| 추가 작업 | 중복 확인 | `evict()`와 `gc()`로 캐시 정리 |

두 작업 모두 `update()`에서 `cache.modify()`를 호출합니다. 변경된 캐시 결과는 `watchQuery()`를 통해 화면에 자동으로 반영됩니다.  

`update()`와 `cache.modify()`는 변경할 목록과 개수를 정확히 계산할 수 있을 때 유용합니다.  
페이지, 필터, 정렬 조건이 복잡하거나 Mutation 응답만으로 변경 결과를 판단하기 어렵다면 `refetchQueries`로 서버 데이터를 다시 조회하는 편이 안전합니다.  
