---
layout: post
title: "2편. Python 기본 문법 요약: 변수, 연산자, 조건문, 반복문"
description: "Python 3.12의 변수와 기본 자료형, 연산자, 조건문, 반복문을 예제로 정리합니다. 객체 참조와 들여쓰기부터 is와 ==의 차이, match-case, for-else까지 익힙니다."
category_id: python-basics
categories: [python, python-basics]
series: python-basics
series_order: 2
ai_assisted: true
toc:
  - id: session-01
    title: "1. 변수 선언과 기본 자료형"
  - id: session-02
    title: "2. Python 연산자"
  - id: session-03
    title: "3. 조건문과 분기 처리"
  - id: session-04
    title: "4. 반복문과 반복 제어"
---

## 1. 변수 선언과 기본 자료형 {#session-01}

### 🟦 변수는 객체를 참조하는 이름

Python에서는 별도의 변수 선언 키워드 없이 `이름 = 값`으로 값을 대입합니다.  
정확히는 오른쪽 객체에 왼쪽 이름을 연결합니다. 변수 안에 객체를 복사해서 넣는다고 생각하기보다, 변수 이름이 객체를 가리킨다고 이해하면 좋습니다.  

```python
# 같은 정수 객체를 참조하다가, score만 다른 객체를 참조하도록 바꿉니다.
score = 80
saved_score = score
score = 95

print(score)        # 95
print(saved_score)  # 80
```

`score = 95`는 `saved_score`의 값까지 바꾸는 명령이 아닙니다.  
`score`라는 이름을 다른 객체에 다시 연결하는 명령입니다.  

리스트처럼 내용을 바꿀 수 있는 객체에서는 참조를 공유한다는 점이 더 잘 드러납니다. 리스트는 여러 값을 순서대로 담는 자료형입니다.  

```python
# 두 이름이 같은 리스트를 참조하므로 변경한 내용을 함께 확인할 수 있습니다.
items = ["Python"]
shared_items = items
shared_items.append("Ruff")

print(items)         # ['Python', 'Ruff']
print(shared_items)  # ['Python', 'Ruff']
```

`shared_items = items`는 새 리스트를 만드는 작업이 아닙니다. 같은 리스트를 참조하는 이름을 하나 더 만드는 작업입니다.  

- 불변 객체(Immutable): 객체 생성 이후 해당 객체의 값을 변경할 수 없으며, 다른 값이 필요하면 새로운 객체를 사용합니다.

- 가변 객체(Mutable): 객체 생성 이후에도 객체의 동일성을 유지하면서 내부 상태를 변경할 수 있습니다.

### 🟦 변수 값 교환

Python에서는 `a, b = b, a`처럼 작성하면 임시 변수를 직접 만들지 않고 두 변수의 값을 교환할 수 있습니다.  

```python
# 오른쪽의 기존 값을 먼저 평가한 뒤 왼쪽 변수에 차례대로 대입합니다.
a = 10
b = 20

a, b = b, a

print(a)  # 20
print(b)  # 10
```

오른쪽의 `b, a`에서 교환 전 값인 `20, 10`을 먼저 구한 뒤, 각각 왼쪽의 `a`, `b`에 대입합니다.  
오른쪽의 기존 값들을 모두 평가한 후 왼쪽에 각각 대입하는 다중 할당(언패킹 대입) 문법입니다.

반대로 `a = b` 다음에 `b = a`를 실행하면 첫 대입에서 기존 `a`의 값을 잃어 두 변수 모두 `20`이 됩니다. 값을 교환하려면 위처럼 한 문장으로 작성합니다.  
이때 객체 자체의 내용을 바꾸는 것이 아니라, 두 변수 이름이 참조하는 객체를 서로 바꾸는 것입니다.  

### 🟦 동적 타이핑과 기본 자료형

Python은 실행 중 객체의 타입을 확인하는 동적 타입 언어입니다. 이름에 타입이 고정되는 것이 아니라, 이름이 참조하는 객체에 타입이 있습니다.  

```python
# 같은 이름에 다른 타입의 객체를 대입할 수 있습니다.
value = 10
print(type(value).__name__)  # int

value = "열 개"
print(type(value).__name__)  # str
```

문법적으로 가능하더라도 같은 변수에 전혀 다른 의미의 값을 반복해서 넣으면 코드를 이해하기 어려워집니다. 변수 이름과 용도를 일관되게 사용하는 편이 좋습니다.  

| 종류 | 예시 | 설명 |
|---|---|---|
| `int` | `10`, `-3` | 정수 |
| `float` | `3.14`, `-0.5` | 부동소수점 방식으로 표현하는 실수 |
| `bool` | `True`, `False` | 참과 거짓 |
| `str` | `"Python"`, `'hello'` | 문자열 |
| `NoneType` | `None` | 값이 없음을 나타내는 객체의 타입 |

`True`, `False`, `None`은 첫 글자가 대문자입니다. `None`은 `0`이나 빈 문자열과는 다른 값입니다.  

```python
# 대표적인 값을 만들고 문자열 안에 변수를 넣어 출력합니다.
name = "민수"
age = 20
height = 175.5
is_student = True
nickname = None

print(f"{name}: {age}세, {height}cm")  # 민수: 20세, 175.5cm
print(is_student)  # True
print(nickname)    # None
```

문자열 앞에 `f`를 붙이면 `{변수}` 형태로 값을 삽입할 수 있습니다. 이를 f-string이라고 합니다.  
`float`는 일부 소수를 정확히 표현하지 못하므로 `0.1 + 0.2 == 0.3`이 `False`일 수 있습니다. 정밀한 금액 계산 등에서는 별도의 처리 방법을 고려해야 합니다.  

### 🟦 타입 변환

`int()`, `float()`, `str()`, `bool()`로 값을 다른 타입으로 변환할 수 있습니다.  

```python
# 숫자로 된 문자열을 변환한 뒤 계산합니다.
quantity = int("3")
unit_price = float("12.5")

print(quantity * unit_price)  # 37.5
print(str(100) + "원")        # 100원
print(int(3.9))               # 3
print(int(-3.9))              # -3
```

`int()`로 실수를 변환하면 소수 부분을 버리고 0 방향으로 정수를 만듭니다. 반올림과는 다릅니다.  
`int("3.5")`나 `int("hello")`처럼 정수로 해석할 수 없는 문자열을 전달하면 `ValueError`가 발생합니다.  
또한 `input()`으로 받은 값은 문자열이므로, 숫자 계산 전에는 필요한 타입으로 변환해야 합니다.  

### 🟦 참과 거짓으로 평가되는 값

조건문에서는 `False`, `None`, 숫자 `0`, 빈 문자열이나 빈 리스트 등을 거짓으로 평가합니다.  
비어 있지 않은 문자열은 내용과 관계없이 참으로 평가합니다.  

```python
# 문자열의 내용이 아니라 비어 있는지에 따라 참과 거짓이 결정됩니다.
print(bool(0))        # False
print(bool(""))       # False
print(bool([]))       # False
print(bool(None))     # False
print(bool("False"))  # True
print(bool("0"))      # True
print(bool(True))     # True
```

## 2. Python 연산자 {#session-02}

### 🟦 산술 연산자와 대입 연산자

| 연산자 | 의미 | 예시 결과 |
|---|---|---|
| `+`, `-`, `*` | 더하기, 빼기, 곱하기 | `7 + 3` → `10` |
| `/` | 나누기 | `7 / 2` → `3.5` |
| `//` | 나눗셈 결과를 내림한 몫 | `7 // 2` → `3` |
| `%` | 나머지 | `7 % 2` → `1` |
| `**` | 거듭제곱 | `2 ** 3` → `8` |
| `=`, `+=`, `-=` | 대입, 더해서 대입, 빼서 대입 | `count += 1` |

정수끼리 나눠도 `/`의 결과는 실수입니다. `//`는 단순히 소수 부분을 버리는 연산이 아니라 작은 정수 방향으로 내림하는 연산입니다.  

```python
# 음수에서는 //와 int()의 결과가 다를 수 있습니다.
print(8 / 2)      # 4.0
print(-7 // 2)    # -4
print(int(-7 / 2))  # -3

count = 1
count += 1
print(count)  # 2
```

Python에는 `count++` 같은 증가 연산자가 없습니다. `count += 1`을 사용합니다.  

### 🟦 비교 연산자와 논리 연산자

비교에는 `==`, `!=`, `<`, `<=`, `>`, `>=`를 사용합니다. `=`는 대입이고, `==`는 값이 같은지 비교하는 연산입니다.  
논리 연산에는 `and`, `or`, `not`을 사용합니다.  

```python
# 비교를 연결하거나 논리 연산자로 여러 조건을 조합합니다.
age = 20
has_ticket = True

print(18 <= age < 65)          # True
print(age >= 18 and has_ticket)  # True
print(age < 18 or has_ticket)    # True
print(not has_ticket)            # False
```

`and`는 앞의 값이 거짓이면 뒤를 평가하지 않고, `or`는 앞의 값이 참이면 뒤를 평가하지 않습니다. 이를 **단락 평가**라고 합니다.  

```python
# 분모가 0이면 뒤의 나눗셈을 실행하지 않습니다.
denominator = 0
print(denominator != 0 and 10 / denominator > 1)  # False

# or는 항상 bool을 반환하는 것이 아니라 피연산자 중 하나를 반환합니다.
entered_name = ""
display_name = entered_name or "손님"
print(display_name)  # 손님
```

`and`와 `or`는 결과로 `True`나 `False`만 반환하지 않습니다. 평가한 피연산자 중 하나를 반환하므로, 기본값 처리에 `or`를 쓸 때에는 `0` 같은 값도 거짓으로 취급된다는 점을 확인해야 합니다.  

### 🟦 ==는 값 비교, is는 객체 동일성 비교

`==`는 두 객체의 값이 같은지 비교하고, `is`는 두 이름이 **바로 그 동일한 객체**를 가리키는지 확인합니다.  

```python
# 값이 같은 별도 리스트와, 같은 리스트를 참조하는 이름을 비교합니다.
a = [1, 2]
b = [1, 2]
c = a

print(a == b)  # True: 리스트의 내용이 같습니다.
print(a is b)  # False: 서로 다른 리스트입니다.
print(a is c)  # True: 같은 리스트를 참조합니다.

result = None
print(result is None)  # True
```

숫자나 문자열의 값 비교에는 `==`를 사용합니다. 일부 객체가 내부적으로 재사용되어 `is`가 우연히 참이 되는 결과에 의존하면 안 됩니다.  
`None`인지 확인할 때에는 `value is None`, `None`이 아닌지 확인할 때에는 `value is not None`을 사용합니다.  

### 🟦 in과 not in으로 포함 여부 확인

`in`은 값이 포함되어 있는지, `not in`은 포함되어 있지 않은지 확인합니다.  

```python
# 문자열에서는 부분 문자열을, 리스트에서는 원소를 확인합니다.
print("Py" in "Python")       # True
print("Java" not in "Python")  # True
print("apple" in ["apple", "banana"])  # True

# 딕셔너리에서는 기본적으로 값이 아니라 키를 검사합니다.
user = {"name": "민수", "age": 20}
print("name" in user)          # True
print("민수" in user)          # False
print("민수" in user.values())  # True
```

딕셔너리는 키와 값을 짝지어 저장하는 자료형입니다. `in user`는 키를 검사하므로, 값에서 찾으려면 `user.values()`를 사용합니다.  

## 3. 조건문과 분기 처리 {#session-03}

### 🟦 들여쓰기로 코드 블록 구분

Python은 중괄호 대신 **들여쓰기**로 실행 범위를 구분합니다.  
조건문과 반복문 등의 시작 줄 끝에는 콜론(`:`)을 붙이고, 내부 코드는 일반적으로 공백 4칸을 들여씁니다.  

```python
# 들여쓴 두 줄은 조건이 참일 때만 실행합니다.
is_logged_in = True

if is_logged_in:
    print("로그인 상태입니다.")
    print("마이페이지를 표시합니다.")

print("조건과 관계없이 실행합니다.")
```

같은 블록 안의 들여쓰기 깊이는 같아야 합니다.  
탭과 공백을 섞지 말고 편집기에서 공백 4칸으로 통일하는 것이 좋습니다.  

### 🟦 if, elif, else

조건은 위에서 아래로 검사하며, 처음 참이 된 분기 하나만 실행합니다. 어느 조건에도 해당하지 않으면 `else`를 실행합니다.  

```python
# 범위가 겹치므로 높은 점수 조건부터 검사합니다.
score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"

print(grade)  # B
```

여러 `if`를 따로 작성하면 각 조건을 독립적으로 검사합니다.  
하나만 선택하려면 위처럼 `if`와 `elif`를 연결합니다.  

### 🟦 조건 표현식으로 값 선택

다른 언어의 삼항 연산자와 비슷한 기능을 `참일 때 값 if 조건 else 거짓일 때 값`으로 작성합니다.  

```python
# 조건에 따라 두 값 중 하나를 선택해 변수에 대입합니다.
age = 17
status = "성인" if age >= 18 else "미성년자"  # ( ? : ) 연산자롸 같음
print(status)  # 미성년자
```

짧은 값 선택에는 편리하지만, 조건이 길거나 여러 작업을 실행해야 한다면 일반 `if`문이 읽기 쉽습니다.  

### 🟦 match-case로 값과 구조에 따라 분기

`match-case`는 Python 3.10부터 지원하며 Python 3.12에서도 사용할 수 있습니다. 단순한 값 비교뿐 아니라 리스트 등의 구조를 기준으로 분기할 수 있습니다.  

```python
# 값이 일치하는 첫 번째 case를 실행합니다.
command = "start"

match command:
    case "start" | "restart":
        print("서비스를 시작합니다.")
    case "stop":
        print("서비스를 종료합니다.")
    case _:
        print("알 수 없는 명령입니다.")
```

`|`는 여러 패턴 중 하나와 일치하는 경우를 나타냅니다.  
`_`는 어떤 값이든 받아들이는 기본 패턴이며, 일반적으로 마지막에 둡니다.  
다른 언어의 일부 `switch`문처럼 다음 분기로 넘어가지 않으므로 `break`를 넣을 필요가 없습니다.  

```python
# 리스트의 길이와 첫 번째 값을 확인하고 나머지 값을 이름에 연결합니다.
action = ["move", 10, 20]

match action:
    case ["move", x, y] if x >= 0 and y >= 0:
        print(f"이동 좌표: {x}, {y}")
    case ["move", _, _]:
        print("음수 좌표로는 이동하지 않습니다.")
    case _: # 앞의 모든 case와 일치하지 않을 때 실행됩니다.
        print("지원하지 않는 동작입니다.")

# 출력: 이동 좌표: 10, 20
```

case ["move", x, y]는 원소가 3개이고 첫 번째 원소가 "move"인지 검사합니다. 조건에 일치하면 두 번째와 세 번째 원소를 각각 변수 x, y에 저장합니다.  

패턴 뒤의 if x >= 0 and y >= 0은 추가 조건을 검사하는 **가드(Guard)**입니다. 패턴이 일치하더라도 가드 조건이 거짓이면 다음 case를 검사합니다.

## 4. 반복문과 반복 제어 {#session-04}

### 🟦 for와 range

Python의 `for`는 리스트나 문자열처럼 순서대로 값을 꺼낼 수 있는 객체에서 값을 하나씩 받아 반복합니다.  

```python
# 리스트의 원소를 순서대로 받습니다.
for language in ["Python", "JavaScript"]:
    print(language)

# range의 끝값은 포함하지 않으므로 1, 2, 3을 출력합니다.
for number in range(1, 4):
    print(number)
```

`range(시작, 끝, 증가폭)`은 정수 범위를 표현합니다.  
시작을 생략하면 `0`, 증가폭을 생략하면 `1`을 사용합니다.  
`range(3)`은 `0, 1, 2`를 순서대로 제공합니다.  

### 🟦 while로 조건이 참인 동안 반복

반복 횟수보다 종료 조건이 중요할 때에는 `while`을 사용할 수 있습니다.  

```python
# 조건에 사용하는 값을 갱신하여 반복이 끝나도록 합니다.
remaining = 3

while remaining > 0:
    print(remaining)
    remaining -= 1

print("완료")
# 출력 순서: 3 → 2 → 1 → 완료
```

조건을 바꾸거나 `break`로 빠져나올 방법이 없으면 무한 반복이 될 수 있습니다.  

### 🟦 break, continue, pass

| 키워드 | 동작 |
|---|---|
| `break` | 가장 가까운 반복문을 종료합니다. |
| `continue` | 현재 회차의 나머지 코드를 건너뛰고 다음 회차로 넘어갑니다. |
| `pass` | 아무 작업도 하지 않고 다음 문장으로 진행합니다. |

```python
# 홀수는 건너뛰고, 6을 만나면 반복을 끝냅니다.
for number in range(1, 8):
    if number == 6:
        break
    if number % 2 != 0:
        continue
    print(number)

# 출력: 2, 4 (각각 한 줄)
```

`pass`는 `continue`와 다릅니다. 반복을 건너뛰는 기능이 없으며, 아직 구현하지 않은 블록의 자리를 채울 때 사용할 수 있습니다.  

```python
# pass를 실행해도 같은 회차의 print는 그대로 실행합니다.
for number in range(3):
    if number == 1:
        pass
    print(number)

# 출력: 0, 1, 2 (각각 한 줄)
```

### 🟦 enumerate로 번호와 값을 함께 사용

직접 인덱스를 증가시키는 대신 `enumerate()`를 사용하면 순번과 값을 함께 받을 수 있습니다.  

```python
# 표시할 번호를 1부터 시작합니다. 리스트 자체의 인덱스는 바뀌지 않습니다.
subjects = ["변수", "조건문", "반복문"]

for number, subject in enumerate(subjects, start=1):
    print(f"{number}. {subject}")
```

출력 결과:

```text
1. 변수
2. 조건문
3. 반복문
```

`start`의 기본값은 `0`입니다. `number, subject`는 각 회차에서 받은 두 값을 각각의 이름에 나누어 대입합니다.  

### 🟦 zip으로 여러 목록을 함께 순회

`zip()`은 여러 객체에서 값을 하나씩 가져와 묶습니다.  

```python
# 같은 위치의 이름과 점수를 한 쌍으로 받습니다.
names = ["민수", "지수"]
scores = [80, 95]

for name, score in zip(names, scores, strict=True):
    print(f"{name}: {score}점")

# 출력: 민수: 80점 / 지수: 95점 (각각 한 줄)
```

기본 `zip()`은 가장 짧은 목록이 끝나면 종료합니다.  
두 목록의 길이가 반드시 같아야 한다면 `strict=True`를 사용합니다.  
길이가 다르면 순회 중 `ValueError`가 발생하므로 누락을 발견할 수 있습니다.  

### 🟦 for-else로 검색 실패 처리

반복문 뒤의 `else`는 **`break` 없이 반복이 끝났을 때** 실행합니다. 마지막 `if`에 붙은 `else`가 아니므로 `for`와 같은 깊이로 들여씁니다.  

```python
# 찾으면 break로 종료하고, 끝까지 못 찾았을 때만 else를 실행합니다.
users = ["민수", "지수"]
target = "영희"

for user in users:
    if user == target:
        print(f"{target}님을 찾았습니다.")
        break
else:
    print(f"{target}님이 없습니다.")

# 출력: 영희님이 없습니다.
```

`target`을 `"민수"`로 바꾸면 `break`가 실행되므로 `else`는 실행하지 않습니다.  
목록이 비어 있어 한 번도 반복하지 않은 경우에는 `else`를 실행합니다.  

`continue`는 반복을 종료하지 않으므로 그 자체로 `else` 실행을 막지는 않습니다.  
`while`에도 같은 방식으로 `else`를 붙일 수 있으며, 조건이 거짓이 되어 정상 종료하면 실행합니다.  
예외나 함수의 `return`으로 반복문을 빠져나오는 경우에는 `else`까지 진행하지 않습니다.  
