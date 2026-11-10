---
layout: post
title: "1장. Google Gen AI SDK 기초"
description: "Python에서 Google Gen AI SDK로 Gemini를 호출하는 방법을 익힙니다. 개발 환경 설정부터 generate_content(), System Instruction, 멀티턴 대화, 스트리밍과 비동기 호출까지 예제로 살펴봅니다."
category_id: python-langchain
categories: [python, python-langchain]
series: python-langchain
series_order: 1
ai_assisted: true
toc:
  - id: session-01
    title: "1.1 Google Gen AI SDK 설치 및 개발 환경 설정"
  - id: session-02
    title: "1.2 Gemini 모델과 generate_content() 기본 사용법"
  - id: session-03
    title: "1.3 System Instruction과 멀티턴 대화"
  - id: session-04
    title: "1.4 스트리밍 및 비동기 API 호출"
---

LangChain을 사용하기 전에 모델을 직접 호출해 보면, 질문과 응답이 오가는 기본 구조를 이해하기 쉽습니다.  
이 장에서는 **Google Gen AI SDK**로 Gemini에 질문을 보내고, 대화를 이어 가며, 응답을 나누어 받는 방법을 실습합니다.  

Google Gen AI SDK는 Google의 생성형 AI API를 Python 코드에서 사용할 수 있도록 돕는 라이브러리입니다. LangChain 자체는 아니며, 이 장의 실습에는 LangChain 패키지가 필요하지 않습니다.  
예제는 API 키로 인증하는 **Gemini Developer API**를 기준으로 작성합니다. SDK의 설치와 클라이언트 생성 방식은 [공식 저장소의 안내](https://github.com/googleapis/python-genai)를 참고합니다.  

## 1.1 Google Gen AI SDK 설치 및 개발 환경 설정 {#session-01}

### 🟦 가상환경과 패키지 준비

실습에는 Python 3.11 이상을 사용합니다. 설치하는 SDK 버전의 Python 지원 범위는 [공식 패키지 설정](https://github.com/googleapis/python-genai/blob/main/pyproject.toml)에서 확인할 수 있습니다.  
프로젝트마다 가상환경을 만들면 다른 프로젝트와 패키지 버전이 섞이는 일을 줄일 수 있습니다.  

```bash
# 실습 폴더와 독립된 패키지 설치 공간을 만듭니다.
mkdir gemini-sdk-basics
cd gemini-sdk-basics
python -m venv .venv

# macOS 또는 Linux에서 가상환경을 활성화합니다.
source .venv/bin/activate

# 현재 Python 환경에 Google Gen AI SDK를 설치합니다.
python -m pip install --upgrade google-genai
python -m pip show google-genai
```

Windows PowerShell에서는 활성화 명령을 다음과 같이 바꿉니다.  

```powershell
.\.venv\Scripts\Activate.ps1
```

설치 이름은 `google-genai`이고, 코드에서 가져오는 이름은 `from google import genai`입니다.  
이 글의 예제에는 과거 라이브러리인 `google-generativeai`의 `GenerativeModel` 문법을 섞어 쓰지 않습니다.  

### 🟦 API 키와 모델 ID 설정

[Google AI Studio](https://aistudio.google.com/apikey)에서 API 키를 발급받고, 실습할 터미널의 환경 변수로 설정합니다.  
실제 키는 소스 코드나 Git 저장소에 저장하지 않습니다.  

```bash
# macOS 또는 Linux에서 현재 터미널 세션에 설정합니다.
export GEMINI_API_KEY="발급받은_API_키"
export GEMINI_MODEL="gemini-3.8-flash"
```

Windows PowerShell에서는 다음 명령을 사용합니다.  

```powershell
$env:GEMINI_API_KEY = "발급받은_API_키"
$env:GEMINI_MODEL = "gemini-3.8-flash"
```

모델 ID는 [SDK 공식 예제](https://googleapis.github.io/python-genai/#generate-content)에 나오는 값을 사용했습니다. 사용 시점에 계정에서 이용할 수 있는 모델로 `GEMINI_MODEL`을 바꾸면 이후 코드를 그대로 활용할 수 있습니다.  
`GEMINI_API_KEY`를 설정하면 `genai.Client()`가 자동으로 읽습니다. `GOOGLE_API_KEY`도 함께 설정하면 그 값이 우선하므로, 실습에서는 둘 중 하나만 설정합니다.  

### 🟦 설치 확인

다음 코드를 `check_setup.py`로 저장하고 `python check_setup.py`로 실행합니다.  
이 코드는 API를 호출하지 않고 환경 변수와 SDK 설치만 확인합니다.  

```python
# 비밀 키를 출력하지 않고 필수 설정이 있는지 확인합니다.
import os
from importlib.metadata import version

from google import genai

if not os.environ.get("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY 환경 변수를 설정해 주세요.")
if not os.environ.get("GEMINI_MODEL"):
    raise RuntimeError("GEMINI_MODEL 환경 변수를 설정해 주세요.")

print("SDK 버전:", version("google-genai"))
print("모델:", os.environ["GEMINI_MODEL"])
print("클라이언트 사용 준비:", callable(genai.Client))
```

## 1.2 Gemini 모델과 generate_content() 기본 사용법 {#session-02}

### 🟦 모델과 SDK의 역할

**Gemini 모델**이 입력을 해석하고 답변을 생성한다면, **SDK**는 Python에서 요청을 보내고 응답을 다루는 역할을 합니다.  
`generate_content()`는 모델에 내용을 전달하고 생성 결과를 받는 기본 메서드입니다.  

| 항목 | 역할 | 예시 |
|---|---|---|
| `model` | 요청을 처리할 모델 ID | 환경 변수 `GEMINI_MODEL` |
| `contents` | 모델에 전달할 입력 | 질문 문자열 |
| `config` | 응답 생성에 적용할 설정 | System Instruction 등 |
| `response.text` | 응답의 텍스트를 읽는 속성 | 생성된 설명 |

호출 형태는 [공식 SDK의 텍스트 생성 예제](https://googleapis.github.io/python-genai/#with-text-content-input-text-output)를 따릅니다.  

### 🟦 첫 번째 요청 보내기

다음 코드를 `basic.py`로 저장하고 `python basic.py`로 실행합니다.  
이후 예제도 별도 파일로 저장해 같은 가상환경과 환경 변수가 설정된 터미널에서 실행합니다.  

```python
# Gemini에 질문 하나를 보내고 완성된 응답을 출력합니다.
import os

from google import genai

# with 블록을 벗어나면 클라이언트의 연결 자원을 정리합니다.
with genai.Client() as client:
    response = client.models.generate_content(
        model=os.environ["GEMINI_MODEL"],
        contents="Python의 리스트와 튜플의 차이를 초보자에게 설명해 주세요.",
    )
    print(response.text or "텍스트 응답이 없습니다.")
```

실행 흐름은 **환경 변수 읽기 → 클라이언트 생성 → 모델 호출 → 응답 출력** 순서입니다.  
동기 호출이므로 응답을 받을 때까지 다음 줄의 `print()`는 실행되지 않습니다.  

생성 결과는 매번 달라질 수 있습니다. 또한 `response.text`가 항상 존재하는 것은 아니므로 예제에서는 빈 값도 처리합니다.  
텍스트가 없을 때는 응답 객체의 `prompt_feedback`이나 `candidates`를 확인해 차단 여부와 종료 이유를 살펴볼 수 있습니다.  

인증 관련 오류가 나면 API 키와 환경 변수를, 모델을 찾을 수 없으면 모델 ID와 접근 권한을 먼저 확인합니다.  
요청 제한 오류가 나면 요청 빈도를 줄이고 계정의 할당량을 확인합니다.  

## 1.3 System Instruction과 멀티턴 대화 {#session-03}

### 🟦 System Instruction으로 답변 기준 정하기

**System Instruction**은 모델이 답변할 때 따를 역할이나 표현 방식을 전달하는 지침입니다.  
`contents`에 이번 질문을 넣고, `config.system_instruction`에 공통 답변 기준을 넣으면 두 목적을 구분하기 쉽습니다.  

```python
# 같은 질문에도 적용할 설명 방식과 역할을 설정합니다.
import os

from google import genai
from google.genai import types

with genai.Client() as client:
    response = client.models.generate_content(
        model=os.environ["GEMINI_MODEL"],
        contents="Python의 딕셔너리는 언제 사용하나요?",
        config=types.GenerateContentConfig(
            system_instruction=(
                "당신은 Python 입문 강사입니다. "
                "한국어 정중체로 답하고, 짧은 설명 뒤에 코드 예시를 제시하세요. "
                "확실하지 않은 내용은 추측이라고 밝혀 주세요."
            ),
        ),
    )
    print(response.text or "텍스트 응답이 없습니다.")
```

설정 객체와 지침 전달 방식은 [공식 SDK의 생성 설정 예제](https://github.com/googleapis/python-genai#system-instructions-and-other-configs)를 참고합니다.  
지침은 답변을 유도하는 수단이며, 정확성이나 형식을 항상 보장하지는 않습니다. 중요한 결과는 별도로 검토해야 합니다.  

### 🟦 같은 대화 안에서 질문 이어 가기

`generate_content()`를 독립적으로 여러 번 호출한다고 이전 질문이 자동으로 연결되지는 않습니다.  
이전 내용을 반영하려면 대화 기록을 직접 입력에 포함하거나, 기록을 관리해 주는 `client.chats`를 사용합니다.  

```python
# 같은 chat 객체로 두 번 질문해 앞선 대화의 맥락을 이어 갑니다.
import os

from google import genai
from google.genai import types

with genai.Client() as client:
    chat = client.chats.create(
        model=os.environ["GEMINI_MODEL"],
        config=types.GenerateContentConfig(
            system_instruction="Python 입문자에게 한국어 정중체로 설명하세요.",
        ),
    )

    first = chat.send_message("할 일 목록을 저장하는 Python 리스트 예제를 보여 주세요.")
    print("첫 번째 답변:", first.text or "텍스트 응답이 없습니다.")

    # '그 예제'가 가리키는 내용을 앞선 대화 기록에서 파악합니다.
    second = chat.send_message("그 예제에 항목을 추가하는 코드도 보여 주세요.")
    print("두 번째 답변:", second.text or "텍스트 응답이 없습니다.")

    # user와 model 역할로 쌓인 기록을 확인합니다.
    for message in chat.get_history():
        print("대화 역할:", message.role)
```

[공식 Chats 안내](https://googleapis.github.io/python-genai/#chats)처럼 **같은 `chat` 객체**에 메시지를 보내야 대화가 이어집니다.  
새 `chat` 객체를 만들면 별도 기록으로 시작하며, 프로그램을 종료한 뒤에도 기록을 유지하려면 저장과 복원 처리를 추가해야 합니다.  
대화가 길어질수록 입력에 포함되는 기록도 커지므로 토큰 사용량과 컨텍스트 한도를 함께 고려합니다.  

## 1.4 스트리밍 및 비동기 API 호출 {#session-04}

### 🟦 스트리밍과 비동기는 서로 다른 기능입니다

**스트리밍**은 응답을 여러 조각으로 받는 방식이고, **비동기**는 응답을 기다리는 동안 다른 작업이 실행될 수 있도록 하는 호출 방식입니다.  
두 기능은 함께 사용할 수 있습니다.  

| 방식 | 호출 메서드 | 결과를 받는 방법 |
|---|---|---|
| 동기 일반 호출 | `client.models.generate_content()` | 완성된 응답 반환 |
| 동기 스트리밍 | `client.models.generate_content_stream()` | `for`로 조각 순회 |
| 비동기 일반 호출 | `client.aio.models.generate_content()` | `await`로 응답 수신 |
| 비동기 스트리밍 | `client.aio.models.generate_content_stream()` | `await` 후 `async for`로 순회 |

### 🟦 동기 스트리밍으로 응답 바로 출력하기

다음 코드를 `stream.py`로 저장하고 `python stream.py`로 실행합니다.  

```python
# 응답이 완성되기 전에도 도착한 텍스트부터 출력합니다.
import os

from google import genai

with genai.Client() as client:
    for chunk in client.models.generate_content_stream(
        model=os.environ["GEMINI_MODEL"],
        contents="Python 함수의 장점을 간단한 예제로 설명해 주세요.",
    ):
        # 텍스트가 없는 조각은 건너뛰고 출력 버퍼를 즉시 비웁니다.
        if chunk.text:
            print(chunk.text, end="", flush=True)
    print()
```

`end=""`는 조각마다 줄바꿈이 들어가는 것을 막고, `flush=True`는 터미널에 곧바로 표시하도록 합니다.  
스트리밍은 첫 내용을 먼저 보여 주는 데 도움이 되지만 전체 생성 시간의 단축을 보장하지는 않습니다.  

### 🟦 비동기 API로 호출하기

다음 코드를 `async_basic.py`로 저장하고 `python async_basic.py`로 실행합니다.  

```python
# 비동기 클라이언트로 요청하고 결과가 도착하면 출력합니다.
import asyncio
import os

from google import genai


async def main():
    # 비동기 컨텍스트 관리자가 종료 시 연결 자원을 정리합니다.
    async with genai.Client().aio as client:
        response = await client.models.generate_content(
            model=os.environ["GEMINI_MODEL"],
            contents="Python의 async와 await를 두 문장으로 설명해 주세요.",
        )
        print(response.text or "텍스트 응답이 없습니다.")


if __name__ == "__main__":
    asyncio.run(main())
```

`await`는 현재 코루틴에서 결과를 기다립니다. 이때 이벤트 루프에 다른 실행 가능한 작업이 있으면 그 작업이 진행될 수 있습니다.  
위 예제는 요청이 하나이므로 여러 요청을 동시에 보내지는 않습니다. 독립된 요청을 함께 실행하려면 `asyncio.gather()` 등을 추가로 사용합니다.  
Jupyter처럼 이벤트 루프가 이미 실행 중인 환경에서는 `asyncio.run(main())` 대신 셀에서 `await main()`을 사용합니다.  

### 🟦 비동기와 스트리밍 함께 사용하기

다음 코드를 `async_stream.py`로 저장하고 `python async_stream.py`로 실행합니다.  

```python
# 스트림을 비동기로 열고 도착하는 텍스트를 순서대로 출력합니다.
import asyncio
import os

from google import genai


async def main():
    async with genai.Client().aio as client:
        # 먼저 await로 스트림을 받고, async for로 각 조각을 읽습니다.
        stream = await client.models.generate_content_stream(
            model=os.environ["GEMINI_MODEL"],
            contents="Python 학습 계획을 세 단계로 정리해 주세요.",
        )
        async for chunk in stream:
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print()


if __name__ == "__main__":
    asyncio.run(main())
```

스트리밍과 비동기 메서드의 사용 형태는 [SDK 공식 예제](https://github.com/googleapis/python-genai#generate-content-asynchronous-streaming)에서 확인할 수 있습니다.  
비동기 스트리밍에서는 **스트림을 얻는 단계의 `await`**와 **응답 조각을 읽는 단계의 `async for`**를 함께 사용합니다.  

이제 기본 호출, 답변 지침, 대화 기록, 응답 수신 방식을 구분할 수 있습니다.  
이 구조를 익혀 두면 LangChain에서 모델과 메시지를 다룰 때도 각 구성 요소의 역할을 이해하기 쉽습니다.  
