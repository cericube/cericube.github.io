---
layout: post
title: "[Fastify] 12. 게시글과 첨부파일의 등록·수정·삭제·업로드·다운로드 흐름"
description: "Fastify 게시글과 첨부파일 예제로 게시글 CRUD와 multipart 파일 업로드·다운로드의 관계를 이해합니다. 파일 메타데이터와 실제 파일 저장, 삭제 시 정리 순서, 스트림 기반 업로드·다운로드 흐름을 핵심 코드와 함께 살펴봅니다."
category_id: nodejs-fastify
categories: [nodejs, nodejs-fastify]
series: fastify
series_order: 12
ai_assisted: true
toc:
  - id: session-01
    title: "1. 게시글과 첨부파일 구조"
  - id: session-02
    title: "2. 게시글 등록·수정·삭제와 첨부파일"
  - id: session-03
    title: "3. 파일 업로드·다운로드 흐름"
  - id: session-04
    title: "4. 직접 요청하고 확인하기"

---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/nodejs-workbook/tree/main/fastify-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. 게시글과 첨부파일 구조 {#session-01}

게시글에 파일을 첨부하면 게시글 정보와 실제 파일을 함께 관리해야 합니다.  
게시글과 첨부파일 메타데이터는 DB에 저장하고, 실제 파일 내용은 파일 저장소에 따로 저장하는 방법을 살펴봅니다.

```text
Post
  └─ id, title, content, published ...

PostAttachment
  └─ id, postId, originalName, mimeType, size, storageKey

FileStorage
  └─ uploads/post-attachments/<storageKey>
```

`PostAttachment.postId`는 어느 게시글의 파일인지 나타내고, `storageKey`는 실제 파일을 찾는 값입니다.

![게시글과 첨부파일 저장 구조](/assets/images/nodejs/nodejs-fastify/fastify-post-attachment-storage-structure.png)

그림처럼 DB에는 첨부파일의 이름·크기·MIME 타입과 `storageKey`를 저장하고, 실제 바이트 데이터는 파일 저장소에 보관합니다.

### 🟦 multipart와 stream

파일 업로드에는 multipart/form-data를 사용합니다.  
multipart는 하나의 HTTP 요청을 여러 **part**로 나누어 파일과 일반 값을 전달할 수 있는 형식입니다.

Fastify의 `@fastify/multipart`는 multipart 요청을 파싱하고, 파일 part의 내용을 `part.file` 스트림으로 제공합니다.

```text
multipart 요청
    ↓
request.parts()
    ↓
파일 part
    ↓
part.file stream
```

스트림은 파일 전체를 메모리에 올리지 않고 작은 청크 단위로 읽고 쓰는 방식입니다.

```text
업로드: 클라이언트 → multipart → stream → FileStorage

다운로드: FileStorage → stream → HTTP 응답
```

multipart는 **요청 형식**, stream은 **데이터 처리 방식**이라는 차이가 있습니다.

## 2. 게시글 등록·수정·삭제와 첨부파일 {#session-02}

게시글과 첨부파일은 하나의 관계를 가지지만 등록·수정·삭제 시 처리 방식은 다릅니다.

![게시글 등록·수정·삭제 흐름:](/assets/images/nodejs/nodejs-fastify/fastify-post-crud-attachment-lifecycle.png)

### 🟦 게시글 등록

게시글을 먼저 생성하고 파일은 별도 첨부파일 API로 업로드합니다.

```text
POST /api/posts
    ↓
Post 생성
    ↓
필요하면
POST /api/posts/:postId/attachments
```

`PostService.create()`는 활성 사용자를 확인하고 게시글 데이터만 생성합니다.

```typescript
async create(
  actor: AuthActor,
  input: { title: string; content?: string | null; published?: boolean },
): Promise<PostResult> {
  await this.assertActiveActor(actor.userId);

  return this.postRepository.create(
    {
      title: input.title.trim(),
      authorId: actor.userId,
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.published === undefined ? {} : { published: input.published }),
    },
    actor.userId,
  );
}
```

### 🟦 게시글 수정

수정은 제목·본문·공개 여부처럼 전달된 게시글 필드만 변경합니다. 기존 첨부파일은 그대로 유지합니다.

```text
PATCH /api/posts/:id
    ↓
게시글 필드 수정
    ↓
첨부파일 유지
```

파일 추가·삭제는 첨부파일 API에서 별도로 처리합니다.

### 🟦 게시글 삭제

게시글 삭제에서는 연결된 실제 파일도 함께 정리해야 합니다.  
DB의 연쇄 삭제는 `PostAttachment` 레코드는 삭제할 수 있지만, 파일 시스템의 실제 파일까지 지워 주지는 않습니다.   따라서 실제 파일을 먼저 삭제합니다.

```typescript
async delete(actor: AuthActor, id: number): Promise<void> {
  await this.assertActiveActor(actor.userId);

  const post = await this.findByIdOrThrow(id, actor.userId);
  assertCanModify(post, actor);

  const attachments = await this.postRepository.findAttachmentKeys(id);

  for (const attachment of attachments) {
    await this.attachmentStorage.delete(attachment.storageKey);
  }

  await this.postRepository.delete(id);
}
```

처리 순서는 다음과 같습니다.

```text
첨부파일 storageKey 조회
    ↓
실제 파일 삭제
    ↓
Post 삭제
    ↓
DB 관계 설정에 따라 PostAttachment 연쇄 삭제
```

게시글을 먼저 삭제하면 `storageKey`도 함께 사라져 실제 파일을 찾기 어려워질 수 있습니다. 그래서 실제 파일을 먼저 정리한 뒤 게시글을 삭제합니다.  
파일 삭제에 실패하면 게시글 삭제를 진행하지 않아 메타데이터를 남기고 다시 시도할 수 있게 합니다.  
다만 파일 시스템과 DB는 하나의 트랜잭션이 아니므로 여러 파일 중 일부만 삭제된 뒤 오류가 발생할 수도 있습니다.  이런 경우에는 재시도나 별도 정리 작업으로 상태를 보완해야 합니다.  

## 3. 파일 업로드·다운로드 흐름 {#session-03}

### 🟦 파일 업로드

업로드 요청은 multipart 파일 part를 stream으로 읽고, 검증한 뒤 임시 파일에 저장합니다. 요청 전체가 정상임을 확인한 뒤 최종 파일로 확정하고 DB에 메타데이터를 등록합니다.  

![Fastify 파일 업로드 처리 흐름](/assets/images/nodejs/nodejs-fastify/fastify-multipart-upload-flow.png)

핵심 흐름은 다음과 같습니다.

```text
multipart
    ↓
request.parts()
    ↓
part.file
    ↓
Service 검증
    ↓
stage()
    ↓
임시 파일
    ↓
commit()
    ↓
최종 파일
    ↓
PostAttachment DB 저장
```

Route에서는 multipart 요청의 기본 제한을 설정합니다.

```typescript
await fastify.register(multipart, {
  limits: {
    files: 1,
    fields: 0,
    parts: 1,
    fileSize: env.MAX_ATTACHMENT_SIZE,
  },
});
```

현재 API는 파일 part 한 개만 허용하며 기본 최대 크기는 5MiB입니다.  
Controller에서는 `request.parts()`로 multipart 요청을 읽습니다.  

```typescript
for await (const part of request.parts()) {
  if (part.type !== 'file' || part.fieldname !== 'file' || received) {
    if (part.type === 'file') part.file.destroy();

    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      'file 필드에 파일 한 개만 전달해야 합니다.',
      400,
    );
  }

  yield {
    originalName: part.filename,
    mimeType: part.mimetype,
    content: part.file,
  };
}
```

여기서 `content`는 파일 전체가 아니라 `part.file` 스트림입니다.  
Service는 스트림을 읽으며 실제 바이트 수를 확인합니다.  

```typescript
async function* limitContent(
  content: Readable,
): AsyncGenerator<Buffer> {
  let size = 0;

  for await (const chunk of content as AsyncIterable<Buffer>) {
    size += chunk.length;

    if (size > env.MAX_ATTACHMENT_SIZE) {
      throw new BusinessError(
        ErrorCode.VALIDATION_ERROR,
        `파일은 최대 ${env.MAX_ATTACHMENT_SIZE}바이트까지 허용합니다.`,
        413,
      );
    }

    yield chunk;
  }
}
```

검사를 통과한 stream은 `stage()`로 임시 저장합니다.

```typescript
staged = await this.attachmentStorage.stage(
  storageKey,
  Readable.from(limitContent(input.content)),
);
```

요청 검증이 끝나면 `commit()`으로 파일을 확정하고 첨부파일 메타데이터를 DB에 저장합니다.

```typescript
await staged.commit();

return await this.postAttachmentRepository.create({
  postId,
  storageKey,
  ...metadata,
  size: staged.size,
});
```

DB 저장에 실패하면 `discard()`로 파일을 정리합니다.

### 🟦 파일 다운로드

다운로드는 DB의 `storageKey`로 실제 파일을 찾은 뒤 읽기 stream을 HTTP 응답으로 전달합니다.

```text
첨부파일 조회
    ↓
storageKey
    ↓
FileStorage.read()
    ↓
Readable stream
    ↓
reply.send(content)
```

첨부파일은 게시글 ID와 첨부파일 ID를 함께 조건으로 조회합니다.

```typescript
return this.prisma.postAttachment.findFirst({
  where: { postId, id },
});
```

파일 저장소에서는 전체 파일을 메모리에 읽지 않고 stream을 반환합니다.

```typescript
async read(key: string): Promise<Readable> {
  const handle = await open(this.path(key), 'r');
  return handle.createReadStream({ autoClose: true });
}
```

Controller는 다운로드 헤더를 설정한 뒤 stream을 보냅니다.

```typescript
return reply
  .code(200)
  .type('application/octet-stream')
  .header(
    'Content-Disposition',
    `attachment; filename="attachment"; filename*=UTF-8''${filename}`,
  )
  .header('X-Content-Type-Options', 'nosniff')
  .header('Cache-Control', 'private, no-store')
  .send(content);
```

성공 응답은 JSON이 아니라 실제 파일 데이터입니다.

## 4. 직접 요청하고 확인하기 {#session-04}

서버가 `http://localhost:3000`에서 실행 중이고 로그인한 사용자가 게시글 작성자라고 가정합니다.

### 🟦 게시글 생성

```bash
ACCESS_TOKEN='로그인으로_받은_Access_Token'

curl --fail-with-body -i \
  -X POST \
  'http://localhost:3000/api/posts' \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "첨부파일 테스트",
    "content": "파일 업로드 테스트 게시글"
  }'
```

응답에서 받은 게시글 ID를 지정합니다.

```bash
POST_ID=1
```

### 🟦 파일 업로드

```bash
printf 'hello' > hello.txt

curl --fail-with-body -i \
  "http://localhost:3000/api/posts/$POST_ID/attachments" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'file=@./hello.txt;type=text/plain'
```

`-F`가 multipart 본문과 boundary를 자동으로 구성합니다.

성공하면 첨부파일 메타데이터를 받습니다.

```json
{
  "id": 7,
  "postId": 1,
  "originalName": "hello.txt",
  "mimeType": "text/plain",
  "size": 5,
  "createdAt": "2026-09-18T09:00:00.000Z"
}
```

### 🟦 다운로드

```bash
ATTACHMENT_ID=7

curl --fail \
  "http://localhost:3000/api/posts/$POST_ID/attachments/$ATTACHMENT_ID/download" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --output downloaded-hello.txt

cmp hello.txt downloaded-hello.txt
```

두 파일의 바이트가 같으면 `cmp`는 아무것도 출력하지 않고 성공합니다.

### 🟦 게시글 수정

게시글을 수정해도 첨부파일은 유지됩니다.

```bash
curl --fail-with-body -i \
  -X PATCH \
  "http://localhost:3000/api/posts/$POST_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "수정된 제목"
  }'
```

### 🟦 게시글 삭제

```bash
curl --fail-with-body -i \
  -X DELETE \
  "http://localhost:3000/api/posts/$POST_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

게시글 삭제 시에는 연결된 실제 파일을 먼저 삭제한 뒤 Post를 삭제합니다.  
업로드 실패 후 부분 파일이 남지 않는지, 게시글 삭제 후 연결된 실제 파일이 함께 정리되는지도 확인해야 합니다.