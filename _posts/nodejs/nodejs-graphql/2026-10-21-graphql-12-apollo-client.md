---
layout: post
title: "12. [Apollo Client] JavaScript로 GraphQL Query, Mutation, Subscription 구현하기"
description: "프레임워크 없는 JavaScript 프로젝트에 Apollo Client를 설정하고, Query·Mutation·Subscription을 실행합니다. HttpLink와 WebSocket Link를 구성해 게시글 목록 조회, 등록과 실시간 이벤트 수신을 구현합니다."
category_id: nodejs-graphql
categories: [nodejs, nodejs-graphql]
series: graphql
series_order: 12
ai_assisted: true
toc:
  - id: session-01
    title: "1. Apollo Client 설치 및 기본 설정"
  - id: session-02
    title: "2. ApolloClient, InMemoryCache, Apollo Link 구성"
  - id: session-03
    title: "3. client.query()로 게시글 목록 조회"
  - id: session-04
    title: "4. client.mutate()로 게시글 등록"
  - id: session-05
    title: "5. client.subscribe()를 활용한 Subscription 기본 사용법"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/graphql-basics/apollo-client){: target="_blank" rel="noopener noreferrer" }**  

Apollo Client는 GraphQL 요청 전송과 응답 캐시를 함께 관리하는 JavaScript 클라이언트 라이브러리입니다. 핵심 기능은 특정 UI 프레임워크에 종속되지 않으므로 일반 JavaScript와 TypeScript에서도 사용할 수 있습니다.  

프레임워크가 달라도 내부에서 사용하는 `ApolloClient`, Link, Cache의 기본 원리는 같습니다.  

```text
client.query()     → 게시글 목록 조회
client.mutate()    → 게시글 등록
client.subscribe() → 새 게시글 이벤트 수신
```

Query와 Mutation은 HTTP로 요청을 보내고, Subscription은 WebSocket으로 연결합니다.  
하나의 `ApolloClient`가 작업 종류를 확인해 알맞은 통신 방식으로 자동 분기하도록 구성하겠습니다.  

## 1. Apollo Client 설치 및 기본 설정 {#session-01}

### 🟦 패키지 설치

`graphql-basics` 프로젝트에서 Apollo Client와 Vite를 설치합니다. Apollo Client는 애플리케이션에서 사용하므로 일반 의존성으로, 개발 서버와 빌드 도구인 Vite는 개발 의존성으로 설치합니다.  

> Vite는 JavaScript 웹 애플리케이션을 빠르게 개발하고 빌드할 수 있도록 도와주는 프런트엔드 개발 도구입니다.  

```bash
cd /home/ubuntu/blog-workspaces/nodejs-workbook/graphql-basics
npm install @apollo/client
npm install -D vite
```

### 🟦 실습 폴더 구조

12편의 화면과 이벤트 처리는 `12-basic`에 두고, 여러 편에서 함께 사용할 Apollo Client 설정과 GraphQL 작업은 `shared`에 분리합니다.  

```text
apollo-client/
├─ 12-basic/
│  ├─ index.html
│  └─ main.js
└─ shared/
   ├─ apollo.js
   ├─ operations.js
   ├─ style.css
   └─ ui.js
```

![실습화면 레이아웃](/assets/images/nodejs/nodejs-graphql/image-2026-10-21-5.png)
Vite가 `apollo-client` 폴더를 개발 서버의 기준 경로로 사용하도록 `package.json`에 실행 명령을 추가합니다.  

```json
{
  "scripts": {
    "client:apollo": "vite apollo-client"
  }
}
```

백엔드 서버와 Apollo Client 실습 화면은 각각 별도 터미널에서 실행합니다.  

```bash
# 터미널 1: GraphQL 서버를 실행합니다.
npm run dev

# 터미널 2: Apollo Client 실습 화면을 실행합니다.
npm run client:apollo
```

Vite가 출력한 주소로 접속한 뒤 `12편`을 선택합니다. 게시글 등록·수정·삭제와 Subscription은 인증이 필요하므로 화면 상단의 실습 계정으로 먼저 로그인합니다.  

## 2. ApolloClient, InMemoryCache, Apollo Link 구성 {#session-02}

### 🟦 Apollo Client의 핵심 구성 요소 이해하기

Apollo Client는 GraphQL 작업을 실행하고, 서버에서 받은 데이터를 캐시에 저장하며, 필요한 경우 화면에 최신 결과를 전달합니다. 처음에는 다음 세 가지 구성 요소의 역할을 구분해 두면 전체 설정을 이해하기 쉽습니다.  

| 구성 요소 | 역할 |
| --- | --- |
| `ApolloClient` | Query, Mutation, Subscription을 실행하고 전체 흐름을 관리합니다. |
| `InMemoryCache` | GraphQL 서버에서 받은 데이터를 브라우저 메모리에 저장하고 조회합니다. |
| `Apollo Link` | 인증 정보 추가, 오류 처리, HTTP·WebSocket 통신 등 네트워크 요청 과정을 담당합니다. |

각 구성 요소의 관계는 다음과 같습니다.  

```text
client.query(), client.mutate(), client.subscribe()
  → ApolloClient
      ├─ InMemoryCache → 데이터 저장·조회
      └─ Apollo Link   → GraphQL 서버와 통신
```

`ApolloClient`는 GraphQL 작업의 출발점입니다.  
캐시에서 처리할 수 있는 데이터는 `InMemoryCache`에서 읽고, 서버와 통신해야 하는 작업은 Apollo Link에 전달합니다.  
간단히 말하면 Cache는 데이터를 관리하고, Link는 서버와의 통신을 관리합니다.  

### 🟦 Apollo Link 구조 이해하기

Apollo Link는 GraphQL 요청이 서버에 전달되는 과정을 여러 단계로 나누어 처리하는 기능입니다.  
인증 토큰 추가, 오류 기록, 재시도, HTTP 전송 같은 기능을 각각 별도의 Link로 만들고 필요한 순서로 연결할 수 있습니다.  

Link는 역할에 따라 크게 두 종류로 나눌 수 있습니다.  

| 종류 | 역할 | 이 글의 예시 |
| --- | --- | --- |
| 중간 Link | 작업을 확인하거나 수정한 뒤 다음 Link로 전달합니다. | `ApolloLink`로 만든 `authLink` |
| 종료 Link | 작업을 실제 서버에 전송하고 응답을 받아옵니다. | `HttpLink`, `GraphQLWsLink` |

`ApolloLink`는 모든 Link의 기반이 되는 클래스입니다. `authLink`는 Apollo Client가 별도로 제공하는 기능 이름이 아니라, `ApolloLink`로 직접 만든 인증용 Link에 붙인 변수명입니다. 프로젝트에 따라 `authenticationLink`나 `tokenLink`처럼 다른 이름을 사용해도 됩니다.  

중간 Link는 `forward(operation)`을 호출해 작업을 다음 Link로 넘깁니다.  
종료 Link는 HTTP나 WebSocket으로 서버와 직접 통신하므로 다음 Link로 작업을 넘기지 않습니다.  
서버 응답은 반대 방향으로 Link 체인을 거쳐 `ApolloClient`에 돌아옵니다.  

여러 Link를 조합할 때는 `concat()`과 `split()`을 사용합니다.  

- `authLink.concat(httpLink)`: `authLink`에서 인증 헤더를 추가한 뒤 `httpLink`로 전송합니다.  
- `ApolloLink.split(조건, A, B)`: 조건이 참이면 A Link를, 거짓이면 B Link를 선택합니다.  

이번 실습에서는 GraphQL 작업 종류에 따라 HTTP와 WebSocket 통신을 구분합니다.  

```text
ApolloClient
  → split(Subscription인가?)
      ├─ 예     → GraphQLWsLink → WebSocket 서버
      └─ 아니요 → authLink → HttpLink → HTTP 서버
```

Query와 Mutation은 HTTP로 전송합니다. Subscription은 WebSocket 연결을 유지하면서 서버에서 발생한 이벤트를 실시간으로 받습니다.  

### 🟦 Query와 Mutation을 위한 HTTP Link 구성

`HttpLink`는 GraphQL 작업을 HTTP 요청으로 바꾸고 지정한 서버에 전송하는 종료 Link입니다.  
이 실습에서는 `http://localhost:3000/api/graphql`을 GraphQL 엔드포인트로 사용합니다.  

`InMemoryCache`는 응답 데이터를 브라우저 메모리에 저장합니다.  
기본적으로 응답 객체의 `__typename`과 `id`를 조합해 같은 객체를 식별하므로, 여러 Query에 같은 게시글이 포함되어도 정규화된 객체 하나를 공유할 수 있습니다.  

먼저 Query와 Mutation만 실행할 수 있는 가장 단순한 Apollo Client를 구성해 보겠습니다.  

```javascript
// /apollo-client/shared/apollo.js
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client/core';

// HttpLink는 GraphQL 요청을 지정한 서버에 HTTP로 전송하고 응답을 받아오는 마지막 Link입니다.
const httpLink = new HttpLink({
  uri: 'http://localhost:3000/api/graphql',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
```

`ApolloClient`를 생성할 때는 서버 통신 방법을 나타내는 `link`와 응답 데이터를 저장할 `cache`를 지정합니다.  
위 설정만으로도 `client.query()`와 `client.mutate()`를 사용해 GraphQL 서버에 HTTP 요청을 보낼 수 있습니다.  

### 🟦 authLink로 Access Token 추가하기

게시글 등록이나 수정처럼 인증이 필요한 작업에는 HTTP 요청의 `Authorization` 헤더에 Access Token을 넣어야 합니다.  
이 실습에서는 `ApolloLink`로 인증용 Link를 만들고, 생성한 `authLink`는 실제 요청을 전송하는 `HttpLink` 앞에 연결합니다.  

```javascript
// /apollo-client/shared/apollo.js
// ApolloLink 생성자는 GraphQL 작업이 다음 Link로 넘어가기 전에 실행할 함수를 받습니다.
// 이 Link는 작업마다 최신 토큰을 읽어 HTTP Authorization 헤더에 추가합니다.
const authLink = new ApolloLink((operation, forward) => {
  // GraphQL 작업을 실행할 때마다 최신 Access Token을 읽습니다.
  const token = getAccessToken();

  // 현재 작업의 HTTP 요청 헤더에 Access Token을 추가합니다.
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));

  // 수정한 작업을 다음 Link인 HttpLink로 전달합니다.
  return forward(operation);
});

const httpLink = new HttpLink({
  uri: 'http://localhost:3000/api/graphql',
});

// 인증 정보를 추가한 다음 HTTP 요청을 전송합니다.
const link = authLink.concat(httpLink);
```

`authLink`는 작업이 실행될 때마다 `localStorage`에서 Access Token을 읽습니다. 토큰이 있으면 헤더를 추가하고, `forward(operation)`으로 수정한 작업을 다음 Link인 `HttpLink`에 전달합니다.  

```text
Query 또는 Mutation
  → authLink: Authorization 헤더 추가
  → HttpLink: HTTP 요청 전송
  → GraphQL 서버
```

`authLink.concat(httpLink)`는 두 Link를 위 순서대로 실행한다는 의미입니다.  

### 🟦 Subscription을 위한 WebSocket Link 구성

Query와 Mutation은 요청을 보낸 뒤 한 번의 응답을 받으면 작업이 끝납니다.  
반면 Subscription은 서버에서 이벤트가 발생할 때마다 결과를 받아야 하므로 연결을 계속 유지해야 합니다. 이번 실습에서는 WebSocket으로 이 연결을 구성합니다.  

`graphql-ws`의 `createClient()`로 WebSocket Client를 만들고 이를 `GraphQLWsLink`로 감쌉니다.  
그런 다음 `ApolloLink.split()`을 사용해 Subscription은 WebSocket으로, Query와 Mutation은 HTTP로 전송합니다.  

다음 코드는 HTTP Link, 인증 Link, WebSocket Link를 모두 조합한 최종 설정입니다.  

```javascript
// /apollo-client/shared/apollo.js
const HTTP_URL = 'http://localhost:3000/api/graphql';
const WS_URL = 'ws://localhost:3000/api/graphql';
const TOKEN_KEY = 'apollo-practice-access-token';

// Query와 Mutation의 HTTP 요청에 인증 정보를 추가합니다.
const authLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();

  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));

  return forward(operation);
});

// Query와 Mutation을 GraphQL 서버에 HTTP로 전송합니다.
const httpLink = new HttpLink({ uri: HTTP_URL });

// Subscription을 GraphQL 서버에 WebSocket으로 연결합니다.
const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL,
    // WebSocket 연결을 시작할 때 최신 Access Token을 전달합니다.
    connectionParams: () => {
      const token = getAccessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  }),
);

export function createApolloClient() {
  // ApolloClient는 조립한 Link로 작업을 전송하고 InMemoryCache로 결과를 관리합니다.
  return new ApolloClient({
    // ApolloLink.split()은 판별 함수가 true면 두 번째 Link를, false면 세 번째 Link를 선택합니다.
    // 따라서 Subscription은 wsLink를, Query나 Mutation은 인증 Link와 httpLink를 사용합니다.  
    link: ApolloLink.split(
      ({ query }) => {
        // 파싱된 GraphQL 문서에서 주 작업의 정의와 작업 종류를 꺼냅니다.
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
        );
      },
      // Subscription은 WebSocket으로 전송합니다.
      wsLink,
      // authLink 실행 후 httpLink가 실행되는 하나의 직렬 Link 체인을 만듭니다.
      authLink.concat(httpLink),
    ),
    // GraphQL 응답 데이터를 브라우저 메모리에 저장합니다.
    cache: new InMemoryCache(),
  });
}
```

`ApolloLink.split()`은 첫 번째 함수의 결과에 따라 사용할 Link를 선택합니다.  
조건이 `true`이면 `wsLink`를 사용하고, `false`이면 `authLink.concat(httpLink)`를 사용합니다.  

HTTP 요청에서는 `Authorization` 헤더로 인증 정보를 전달합니다.  
브라우저의 WebSocket API에서는 임의의 HTTP 헤더를 직접 설정할 수 없으므로, 연결을 초기화할 때 `connectionParams`에 인증 정보를 담습니다. 서버도 이 값을 읽어 인증하도록 구현되어 있어야 합니다.  

`connectionParams` 함수는 WebSocket 연결을 시작할 때 실행됩니다. 이미 연결된 상태에서 Access Token이 바뀌었다면 새 토큰을 적용하기 위해 WebSocket을 다시 연결해야 할 수 있습니다.  

전체 통신 흐름을 다시 정리하면 다음과 같습니다.  

```text
ApolloClient
  → ApolloLink.split()
      ├─ Query·Mutation
      │   → authLink: Access Token 추가
      │   → HttpLink: HTTP 요청
      │   → GraphQL 서버
      └─ Subscription
          → GraphQLWsLink: WebSocket 연결
          → GraphQL 서버
```

이 구성을 사용하면 하나의 `ApolloClient` 인스턴스로 Query, Mutation, Subscription을 모두 실행할 수 있습니다.  
`ApolloClient`는 GraphQL 작업을 관리하고, `InMemoryCache`는 데이터를 저장하며, Apollo Link는 작업 종류에 알맞은 통신 방식으로 요청을 전달합니다.  

## 3. client.query()로 게시글 목록 조회 {#session-03}

### 🟦 gql로 Query 문서 작성하기

Apollo Client에는 `gql`로 정의한 GraphQL 문서를 `query` 옵션으로 전달합니다. 목록 조회와 이후 Mutation, Subscription에서 같은 게시글 필드를 재사용할 수 있도록 Fragment로 분리합니다.  

Fragment(프래그먼트)는 여러 Query, Mutation, Subscription에서 반복해서 사용하는 필드 목록을 하나로 정의하고 재사용하는 기능입니다. 기본 구조는 다음과 같습니다.  

```graphql
fragment FragmentName on GraphQLType {
  field1
  field2
}
```

`FragmentName`에는 Fragment 이름을, `GraphQLType`에는 필드가 속한 GraphQL 타입을 작성합니다.  
작업(Operation) 문서에서 `...FragmentName`을 사용하면 Fragment에 정의한 필드 목록이 해당 위치에 포함됩니다.  

아래 예제에서는 `PostFields`라는 Fragment를 `Post` 타입에 정의합니다.  
Query 안의 `...PostFields`로 필드 목록을 불러오고, 템플릿 리터럴의 `${POST_FIELDS}`로 Fragment 문서를 Query 문서에 함께 포함합니다.  

```javascript
// /apollo-client/shared/operations.js
import { gql } from '@apollo/client/core';

export const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    title
    content
    published
    likeCount
    authorId
    createdAt
    updatedAt
  }
`;

export const POSTS_QUERY = gql`
  query Posts($pagination: OffsetPaginationInput) {
    postsByOffset(pagination: $pagination) {
      items {
        ...PostFields
      }
      totalCount
      pageInfo {
        offset
        limit
        hasNextPage
      }
    }
  }
  ${POST_FIELDS}
`;
```

### 🟦 client.query() 호출 구조와 주요 옵션

`client.query()`에는 Query 실행 방법을 담은 옵션 객체를 전달합니다. 실행이 끝나면 결과를 담은 Promise를 반환합니다.  

```javascript
const result = await client.query({
  query: QUERY_DOCUMENT,
  variables: { /* GraphQL 변수 */ },
  fetchPolicy: 'cache-first',
  errorPolicy: 'none',
});
```

| 옵션 | 설명 |
| --- | --- |
| `query` | `gql`로 정의한 Query 문서를 지정합니다. |
| `variables` | Query 문서에 선언한 GraphQL 변수의 값을 객체로 전달합니다. |
| `fetchPolicy` | 캐시와 네트워크 중 어디에서 데이터를 가져올지 결정합니다. 기본값은 `cache-first`입니다. |
| `errorPolicy` | GraphQL 오류가 있을 때 데이터와 오류를 어떻게 처리할지 결정합니다. 기본값은 `none`입니다. |

### 🟦 게시글 목록 조회

`client.query()`는 Query 문서와 변수를 객체로 받아 요청을 한 번 실행합니다. 실행 결과를 담은 Promise를 반환하므로 `await`으로 결과를 기다릴 수 있습니다.  

```javascript
// /apollo-client/12-basic/main.js
const result = await client.query({
  query: POSTS_QUERY,
  variables: {
    pagination: { offset: 0, limit: 10 },
  },
  // 항상 서버에 요청하고 결과를 캐시에 저장
  fetchPolicy: 'network-only',
});

const posts = result.data.postsByOffset.items;
console.log(posts);
```

Apollo Client의 기본 조회 정책은 캐시에 데이터가 있으면 먼저 사용하는 `cache-first`입니다.  
이번 장에서는 버튼을 누를 때마다 네트워크 요청이 발생하는 모습을 확인하기 위해 `network-only`를 사용합니다. 캐시 정책은 다음 장에서 자세히 살펴봅니다.  

## 4. client.mutate()로 게시글 등록 {#session-04}

### 🟦 Mutation 문서 작성하기

게시글을 등록하는 Mutation을 작성합니다. 반환 필드에는 앞에서 만든 `PostFields` Fragment를 재사용해 등록된 게시글 정보를 같은 형태로 받습니다.  

```javascript
// /apollo-client/shared/operations.js
export const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ...PostFields
    }
  }
  ${POST_FIELDS}
`;
```

### 🟦 client.mutate() 호출 구조와 주요 옵션

`client.mutate()`에는 실행할 Mutation과 필요한 변수를 옵션 객체로 전달합니다. 작업이 끝나면 Mutation 결과를 담은 Promise를 반환합니다.  

```javascript
const result = await client.mutate({
  mutation: MUTATION_DOCUMENT,       // 실행할 GraphQL Mutation 문서
  variables: { /* 변수 */ },         // Mutation에 전달할 변수
  errorPolicy: 'none',              // GraphQL 오류 처리 정책
  fetchPolicy: 'network-only',      // 결과 캐시 정책: 'network-only' | 'no-cache'

  // 서버 응답 전 낙관적 업데이트 (선택)
  // optimisticResponse: { ... },

  // Mutation 결과를 이용한 캐시 직접 수정
  update(cache, result) {
    // cache.modify(), cache.writeQuery() 등
  },

  refetchQueries: [],               // Mutation 이후 재조회할 Query 지정
  awaitRefetchQueries: false,       // Query 재조회 완료까지 대기 여부

  // 캐시 변경의 영향을 받은 Query의 재조회 여부 제어 (선택)
  // onQueryUpdated(observableQuery) {
  //   return observableQuery.refetch();
  // },

  // 요청별 Apollo Link 설정 (인증 헤더 등)
  context: {
    // headers: { Authorization: 'Bearer ...' }
  },
});
```

| 옵션 | 설명 |
| --- | --- |
| `mutation` | `gql`로 정의한 Mutation 문서를 지정합니다. |
| `variables` | Mutation 문서에 선언한 GraphQL 변수의 값을 객체로 전달합니다. |
| `errorPolicy` | GraphQL 오류가 있을 때 결과를 어떻게 처리할지 결정합니다. 기본값은 `none`입니다. |
| `refetchQueries` | Mutation이 끝난 뒤 최신 데이터가 필요한 Query를 다시 실행합니다. |

### 🟦 게시글 등록

`client.mutate()`의 `mutation`에는 GraphQL 문서를, `variables`에는 작업에서 선언한 변수와 같은 구조의 값을 전달합니다.  
로그인 후 저장한 Access Token은 앞에서 만든 `authLink`가 자동으로 HTTP 헤더에 추가합니다.  

```javascript
const result = await client.mutate({
  mutation: CREATE_POST,
  variables: {
    input: {
      title: document.querySelector('#title').value,
      content: document.querySelector('#content').value,
      published: document.querySelector('#published').checked,
    },
  },
});

console.log(result.data.createPost);
```

## 5. client.subscribe()를 활용한 Subscription 기본 사용법 {#session-05}

### 🟦 Subscription 문서 작성하기

새 게시글이 생성될 때마다 게시글 정보를 받을 수 있도록 `postCreated` Subscription을 작성합니다.  
Query와 Mutation에서 사용한 것과 같은 Fragment를 사용하면 응답 객체를 동일한 형태로 유지할 수 있습니다.  

```javascript
// /apollo-client/shared/operations.js
export const POST_CREATED = gql`
  subscription PostCreated {
    postCreated {
      ...PostFields
    }
  }
  ${POST_FIELDS}
`;
```

### 🟦 client.subscribe() 호출 구조와 주요 옵션

`client.subscribe()`에는 Subscription 실행 방법을 담은 옵션 객체를 전달합니다. 반환된 Observable에 다시 `subscribe()`를 호출하고 콜백을 등록하면 서버가 보내는 결과를 계속 받을 수 있습니다.  

```javascript
const observable = client.subscribe({
  query: SUBSCRIPTION_DOCUMENT,
  variables: { /* GraphQL 변수 */ },
  errorPolicy: 'none',
});

const subscription = observable.subscribe({
  next: (result) => console.log(result.data),
  error: (error) => console.error(error),
  complete: () => console.log('구독이 종료되었습니다.'),
});
```

| 옵션·콜백 | 설명 |
| --- | --- |
| `query` | `gql`로 정의한 Subscription 문서를 지정합니다. |
| `variables` | Subscription 문서에 선언한 GraphQL 변수의 값을 객체로 전달합니다. |
| `errorPolicy` | GraphQL 오류가 있을 때 전달받을 결과를 어떻게 처리할지 결정합니다. 기본값은 `none`입니다. |
| `next` | 서버에서 새 결과를 받을 때마다 실행됩니다. |
| `error` | 구독 처리 중 오류가 발생하면 실행됩니다. |
| `complete` | 서버가 구독을 정상적으로 종료하면 실행됩니다. |

### 🟦 client.subscribe()로 이벤트 받기

`client.query()`와 `client.mutate()`는 한 번 완료되는 Promise를 반환합니다. 반면 `client.subscribe()`는 서버가 반복해서 전송하는 결과를 처리하기 위해 Observable을 반환합니다.  

Observable의 `subscribe()`에 `next`와 `error` 콜백을 등록합니다. 새 게시글 이벤트가 도착할 때마다 `next`가 실행되며, 이벤트 데이터는 `data.postCreated`에서 확인할 수 있습니다.  

```javascript
const subscription = client
  .subscribe({ query: POST_CREATED })
  .subscribe({
    next: ({ data }) => {
      console.log('새 게시글:', data.postCreated);
    },
    error: (error) => {
      console.error('Subscription 오류:', error);
    },
  });
```

실습 화면에서 `postCreated 구독 시작` 버튼을 누른 뒤 게시글을 등록하면 다음 순서로 이벤트를 받습니다.  

```text
client.mutate(CREATE_POST)
  → 서버가 게시글 저장
  → post:created 이벤트 발행
  → WebSocket Subscription으로 postCreated 전달
  → next() 콜백 실행
```

### 🟦 구독 해제하기

더 이상 이벤트가 필요하지 않을 때는 `unsubscribe()`를 호출합니다. 같은 버튼을 여러 번 눌러 중복 구독이 생기지 않도록 새 구독을 시작하기 전에 기존 구독을 먼저 해제할 수도 있습니다.  

```javascript
let subscription;

document.querySelector('#subscribe').addEventListener('click', () => {
  // 이전 구독이 있으면 결과 수신을 중단합니다.
  subscription?.unsubscribe();

  subscription = client.subscribe({ query: POST_CREATED }).subscribe({
    next: ({ data }) => console.log(data.postCreated),
    error: (error) => console.error(error),
  });
});

// 화면을 떠나는 시점처럼 더 이상 이벤트가 필요하지 않을 때 호출합니다.
subscription?.unsubscribe();
```
