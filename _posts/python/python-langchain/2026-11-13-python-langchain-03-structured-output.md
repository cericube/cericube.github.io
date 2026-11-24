---
layout: post
title: "3편. [Gemini API] Structured Output: JSON 응답"
description: "Gemini Interactions API로 주문 정보를 JSON 형식으로 받습니다. JSON Schema로 출력 구조를 정하고, Pydantic 모델로 응답을 검증해 Python 객체로 사용하는 방법을 익힙니다."
category_id: python-langchain
categories: [python, python-langchain]
series: python-gemini-sdk
series_order: 3
ai_assisted: true
toc:
  - id: session-01
    title: "1. Structured Output으로 주문 정보 추출하기"
  - id: session-02
    title: "2. JSON 응답을 Python 딕셔너리로 변환하기"
  - id: session-03
    title: "3. JSON Schema로 키와 값의 규칙 정하기"
  - id: session-04
    title: "4. Pydantic 모델로 응답 검증하기"
---

📂 **[[GitHub 코드 보러가기]](https://github.com/cericube/agent-workbook/tree/main/gemini-sdk-basics){: target="_blank" rel="noopener noreferrer" }**

## 1. Structured Output으로 주문 정보 추출하기 {#session-01}

**Structured Output(구조화된 출력)**은 필요한 항목과 타입을 정해 Gemini의 답변을 JSON 같은 구조로 받는 방법입니다. 문장으로 된 답변을 다시 분석할 필요 없이, 각 값을 프로그램에서 바로 꺼내 사용할 수 있습니다.  

예를 들어 다음 문장에서 주문 정보를 추출할 수 있습니다.  

> 주문번호는 ORD-1001이고, 상품은 파이썬 입문서 2권입니다. 단가는 25,000원입니다.  

주문번호·상품명·수량·단가를 지정하면 다음처럼 받을 수 있습니다.  

```json
{
  "order_id": "ORD-1001",
  "product": "파이썬 입문서",
  "quantity": 2,
  "unit_price": 25000
}
```

이렇게 받은 데이터는 화면 표시, 계산, 저장 등에 활용할 수 있습니다. 다만 출력 구조를 맞추는 기능이므로, 값이 원문과 일치하는지는 별도로 확인해야 합니다.  

## 2. JSON 응답을 Python 딕셔너리로 변환하기 {#session-02}

먼저 스키마 없이 JSON 형식의 응답을 요청하고, 받은 문자열을 Python 딕셔너리로 변환합니다. 추출할 항목은 질문으로 알려 주되, 키 이름과 값 타입은 고정하지 않습니다.  

### 🟦 response_format으로 JSON 요청하기

`response_format`의 `mime_type="application/json"`으로 JSON 응답을 요청합니다.  
이 단계에서는 `schema_`를 지정하지 않고, 질문에 필요한 항목과 하나의 객체로 반환하라는 지시를 넣습니다.  

```python
# 소스 경로: gemini-sdk-basics/ch03/01_json_response.py
source_text = (
    "주문번호는 ORD-1001이고, 상품은 파이썬 입문서 2권입니다. "
    "단가는 25,000원입니다."
)

# 원문에서 주문 정보를 추출하고 JSON 형식으로 응답받습니다.
with genai.Client() as client:
    response = client.interactions.create(
        model=model,
        input=(
            "다음 문장에서 주문번호, 상품명, 수량, 단가를 빠짐없이 추출해 "
            f"하나의 JSON 객체로 반환하세요. \n{source_text}"
        ),
        response_format=TextResponseFormat(
            type="text",
            mime_type="application/json",
            # 키 이름과 타입을 고정하는 schema_는 아직 지정하지 않습니다.
        ),
        stream=False,
        store=False,
    )

# 완성된 응답인지 확인한 뒤 JSON 문자열을 읽습니다.
if not isinstance(response, Interaction):
    raise TypeError("일반 Interaction 응답이 필요합니다.")
if response.status != "completed" or not response.output_text:
    raise RuntimeError(f"응답을 받지 못했습니다: {response.status}")

print("응답 문자열:", response.output_text)
# JSON 문자열을 변환한 뒤, 비어 있지 않은 딕셔너리인지 확인합니다.
data = json.loads(response.output_text)
if not isinstance(data, dict) or not data:
    raise ValueError("주문 정보가 담긴 JSON 객체를 받지 못했습니다.")
print(type(data))  # <class 'dict'>
print(data)
```

```text
((.venv) ) gemini-sdk-basics/ch03$ python 01_json_response.py 
응답 문자열: {
  "주문번호": "ORD-1001",
  "상품명": "파이썬 입문서",
  "수량": 2,
  "단가": "25,000원"
}
<class 'dict'>
{'주문번호': 'ORD-1001', '상품명': '파이썬 입문서', '수량': 2, '단가': '25,000원'}
```

`TextResponseFormat`은 출력 형식 설정을 담는 SDK 클래스입니다.  
`type="text"`는 텍스트 응답을, `mime_type="application/json"`은 그 내용이 JSON 형식임을 나타냅니다.  

이 단계에서는 키 이름을 지정하지 않았으므로, 응답에 `product`가 사용될지 `product_name`이 사용될지 고정되어 있지 않습니다. 특정 키를 코드에서 사용하려면 다음 절처럼 구조를 명시하는 편이 좋습니다.  

### 🟦 JSON 문자열과 Python 딕셔너리 구분하기

| 값 | 타입 | 역할 |
|---|---|---|
| `response.output_text` | `str` | 모델이 반환한 JSON 문자열 |
| `json.loads(response.output_text)` | 이 예제에서는 `dict` | Python에서 다룰 수 있도록 변환한 값 |

`json.loads()`는 JSON 문법을 해석하며, 문법이 잘못되면 `json.JSONDecodeError`가 발생합니다. 변환 뒤의 검사는 딕셔너리인지와 비어 있지 않은지만 확인합니다. 필요한 키가 모두 있는지나 수량이 올바른지는 아직 검사하지 않습니다.  

## 3. JSON Schema로 키와 값의 규칙 정하기 {#session-03}

**JSON Schema는 JSON 데이터의 구조와 값의 조건을 정의하는 표준**입니다.  
어떤 키가 필요한지, 값은 문자열인지 정수인지, 숫자는 어느 범위까지 허용할지 등을 표현합니다.  

### 🟦 JSON Schema의 기본 구조

스키마도 JSON으로 작성합니다. 다음은 `quantity`라는 키에 1 이상의 정수가 들어가야 한다고 정의한 예입니다.  

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "quantity": {
      "type": "integer",
      "minimum": 1,
      "description": "주문 수량"
    }
  },
  "required": ["quantity"],
  "additionalProperties": false
}
```

바깥쪽 `type`은 데이터 전체의 타입을, `properties` 안의 `type`은 각 항목의 타입을 지정합니다.  
위 스키마에는 `{"quantity": 2}`가 맞지만, `{"quantity": "2"}`나 `{"quantity": 0}`은 맞지 않습니다.  
`$schema`는 사용하는 JSON Schema의 버전을 나타냅니다. 모든 스키마에 반드시 필요한 항목은 아니며, 아래 Gemini 요청 예제에서는 생략합니다.  

### 🟦 키 이름과 값 타입 정하기

이제 앞의 주문 정보를 `order_id`·`product`·`quantity`·`unit_price`로 받도록 정의합니다.  
Python에서는 JSON 객체를 딕셔너리로 표현하므로, JSON의 `false` 대신 `False`를 사용합니다.  

```python
# 주문 정보를 네 항목으로 받도록 출력 구조를 정의합니다.
order_schema = {
    "type": "object",
    "properties": {
        "order_id": {"type": "string", "description": "주문번호"},
        "product": {"type": "string", "description": "상품명"},
        "quantity": {"type": "integer", "minimum": 1, "description": "주문 수량"},
        "unit_price": {"type": "integer", "minimum": 0, "description": "원 단위 단가"},
    },
    "required": ["order_id", "product", "quantity", "unit_price"],
    "additionalProperties": False,
}
```

| 항목 | 의미 |
|---|---|
| `type` | 객체·문자열·정수 등 값의 타입 |
| `properties` | 객체 안에 들어갈 키와 각 값의 규칙 |
| `required` | 반드시 포함해야 하는 키 |
| `minimum` | 허용하는 최솟값 |
| `additionalProperties: False` | 정의하지 않은 키는 허용하지 않음 |

`properties`에 키를 적는 것만으로 필수가 되지는 않습니다. 반드시 받아야 하는 키는 `required`에도 넣습니다.  

### 🟦 스키마를 API 요청에 적용하기

`TextResponseFormat`의 `schema_`에 구조를 지정하면 API 요청에서는 `schema`라는 이름으로 전달됩니다.  

```python
with genai.Client() as client:
    response = client.interactions.create(
        model=model,
        input=f"다음 문장에서 주문 정보를 추출하세요.\n{source_text}",
        response_format=TextResponseFormat(
            type="text",
            mime_type="application/json",
            schema_=order_schema, # SDK에서 출력 스키마를 받는 매개변수
        ),
        stream=False,
        store=False,
    )
if not isinstance(response, Interaction):
    raise TypeError("일반 Interaction 응답이 필요합니다.")
if response.status != "completed" or not response.output_text:
    raise RuntimeError(f"응답을 받지 못했습니다: {response.status}")

order = json.loads(response.output_text)
print(order["product"])   # 파이썬 입문서
print(order["quantity"])  # 2
```

```text
((.venv) ) /gemini-sdk-basics/ch03$ python 02_json_schema.py 
파이썬 입문서
2
{'order_id': 'ORD-1001', 'product': '파이썬 입문서', 'quantity': 2, 'unit_price': 25000}
```

이제 프로그램은 키 이름을 예상할 수 있습니다. 다만 `json.loads()` 자체가 스키마를 검증하는 것은 아닙니다. 응답을 애플리케이션에서 사용하기 전에 타입과 제약까지 확인하려면 다음 절의 Pydantic을 활용할 수 있습니다.  

> Gemini는 JSON Schema의 일부 기능을 지원합니다. 복잡한 스키마를 한꺼번에 넣기보다 필요한 항목부터 정의하고, 원문과 값이 맞는지도 확인합니다.  

## 4. Pydantic 모델로 응답 검증하기 {#session-04}

Pydantic은 타입 힌트를 바탕으로 데이터의 구조와 값을 검증하는 라이브러리입니다.  
Python 클래스로 모델을 정의하면 JSON Schema를 만들고, 응답을 검증한 뒤 속성으로 접근할 수 있습니다.

이 예제는 Pydantic을 직접 사용하므로 `agent-workbook` 루트에서 프로젝트 의존성으로 추가합니다.

```bash
uv add pydantic
```

### 🟦 주문 정보를 표현하는 모델 만들기

Pydantic 2.x가 설치된 환경에서 다음 모델을 정의합니다.  

```python
from pydantic import BaseModel, ConfigDict, Field, ValidationError
# BaseModel을 상속해 응답의 필드와 검증 규칙을 정의합니다.
# 이 클래스는 요청할 JSON Schema를 생성할 때와 실제 응답을 검증할 때 모두 사용합니다.
class OrderInfo(BaseModel):
    # 정의하지 않은 필드가 들어오면 검증 오류로 처리합니다.
    model_config = ConfigDict(extra="forbid")
    # 기본값을 지정하지 않았으므로 네 필드 모두 필수입니다.
    # description은 스키마에 포함되어 모델이 각 필드의 의미를 이해하는 데 사용됩니다.
    order_id: str = Field(description="주문번호")
    product: str = Field(description="상품명")
    # ge는 해당 값 이상이어야 한다는 뜻입니다. 수량은 1 이상, 단가는 0 이상입니다.
    quantity: int = Field(ge=1, description="주문 수량")
    unit_price: int = Field(ge=0, description="원 단위 단가")
```

`Field(ge=1)`은 1 이상, `Field(ge=0)`은 0 이상을 뜻합니다.  
`extra="forbid"`는 정의하지 않은 필드가 들어오면 검증 오류로 처리하는 설정입니다.  
기본값을 지정하지 않은 네 필드는 모두 필수입니다.  

### 🟦 모델에서 스키마를 만들고 응답 검증하기

```python
# 소스 경로: gemini-sdk-basics/ch03/03_pydantic_response.py
with genai.Client() as client:
    response = client.interactions.create(
        model=model,
        input=f"다음 문장에서 주문 정보를 추출하세요.\n{source_text}",
        response_format=TextResponseFormat(
            type="text",
            mime_type="application/json",
            # Python 모델에서 JSON Schema를 생성합니다.
            schema_=OrderInfo.model_json_schema(),
        ),
        stream=False,
        store=False,
    )
if not isinstance(response, Interaction):
    raise TypeError("일반 Interaction 응답이 필요합니다.")
if response.status != "completed" or not response.output_text:
    raise RuntimeError(f"응답을 받지 못했습니다: {response.status}")
# JSON 문자열을 검증하고 OrderInfo 인스턴스로 만듭니다.
order = OrderInfo.model_validate_json(response.output_text, strict=True)
print(order.product)    # 파이썬 입문서
print(order.quantity)   # 2
print(order.model_dump())  # 일반 dict로 변환합니다.
```

`model_json_schema()`는 **Gemini에 전달할 출력 구조**를 만듭니다.  
`model_validate_json()`은 **실제로 받은 JSON 문자열**을 검사해 `OrderInfo` 객체로 만듭니다.  
두 메서드는 서로 다른 단계에서 사용합니다.  

`strict=True`를 지정했으므로 수량이 숫자 `2`가 아닌 문자열 `"2"`로 들어오면 자동 변환하지 않고 오류로 처리합니다. 기본 설정에서는 일부 타입을 변환할 수 있습니다.  

### 🟦 JSON Schema와 Pydantic의 역할 정리하기

| 방법 | 얻는 결과 | 프로그램에서 사용할 때 |
|---|---|---|
| JSON 객체 요청 | JSON 문자열 | `json.loads()`로 변환 |
| JSON Schema 지정 | 지정한 구조의 JSON 문자열 | 변환 후 필요한 값 검사 |
| Pydantic 모델 사용 | 모델에서 생성한 스키마로 응답 요청 | `model_validate_json()`으로 검증하고 객체 생성 |

Pydantic은 `TypedDict`처럼 구조를 설명하는 데 그치지 않고, 검증 메서드를 호출하면 실행 중에도 값을 검사합니다.  
하지만 상품명이나 주문번호가 실제 데이터와 일치하는지는 별도로 확인해야 합니다. 
