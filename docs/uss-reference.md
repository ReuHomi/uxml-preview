# UXML / USS 참조표

HTML/CSS → UXML/USS 매핑. 탐색 모드는 이식 가능성 판정에, 이관 모드는 변환에 쓴다.

**"버전 확인" 표시가 있는 항목은 프로젝트의 유니티 버전에서 실제로 확인한다.**
UI Toolkit은 버전마다 지원 범위가 넓어지고 있어서 기억에 의존하면 틀린다.

## 목차

1. 이식성 등급
2. 태그 매핑
3. 레이아웃 속성
4. 박스 / 테두리
5. 텍스트
6. 배경 / 이미지
7. 트랜스폼 / 트랜지션
8. 셀렉터
9. 단위와 값
10. 애니메이션 판정
11. 상호작용
11-b. 화면 전환
12. 흔한 실패 패턴
13. 템플릿 추출 판정
14. picking-mode

---

## 1. 이식성 등급

주석과 리포트에서 이 등급을 쓴다.

- **A — 그대로** 옮겨진다. 이름만 바뀌거나 동일
- **B — 대체** 다른 방식으로 비슷한 결과를 낸다. 사용자에게 "조금 달라진다"로 보고
- **C — 불가** USS에 없다. C#으로 새로 만들거나 이미지로 굽거나 포기
- **D — 구조 변경** 마크업 구조를 바꿔야 한다

---

## 2. 태그 매핑

UXML 네임스페이스는 보통 `ui:` (`<ui:VisualElement>`). 프로젝트 관례를 따른다.

| HTML | UXML | 등급 | 비고 |
|---|---|---|---|
| `div`, `section`, `article`, `main`, `nav`, `header`, `footer` | `VisualElement` | A | 의미 태그는 전부 클래스로 표현 |
| `span`, `p`, `h1`~`h6`, `strong`, `em`, `label` | `Label` | A | 굵기·크기는 USS로 |
| `button` | `Button` | A | `:hover`/`:active` 내장 |
| `img` | `Image` 또는 `VisualElement` + `background-image` | A | 후자가 더 흔하고 유연 |
| `a` | `Button` | B | 링크 이동 개념 없음. 동작은 C# |
| `ul`, `ol` | `VisualElement` | A | 불릿은 자동 안 붙음. 직접 넣어야 함 |
| `li` | `VisualElement` + `Label` | A | |
| `input[type=text]` | `TextField` | A | |
| `input[type=checkbox]` | `Toggle` | A | |
| `input[type=range]` | `Slider` / `SliderInt` | A | |
| `select` | `DropdownField` | A | |
| `textarea` | `TextField` + `multiline="true"` | A | |
| `details` / `summary` | `Foldout` | A | 대응이 좋다. 접힘 동작 내장 |
| 스크롤 컨테이너 (`overflow: auto`) | `ScrollView` | D | 전용 요소로 교체 |
| 긴 반복 목록 | `ListView` | D | 수백 개 이상이면 성능상 필요 |
| `table`, `tr`, `td` | `VisualElement` 중첩 | D | grid 없음. flex로 행/열 구성 |
| `svg` (인라인) | — | C | 벡터 미지원. PNG로 구워야 함 |
| `canvas` | — | C | |
| `iframe`, `video`, `audio` | — | C | |
| `form` | `VisualElement` | A | 폼 개념 없음. 제출은 C# |

**텍스트 규칙**: UXML에서 맨몸 텍스트 노드는 안 된다. 모든 텍스트는
`Label`의 `text` 속성 또는 자식으로 들어간다. `<div>안녕</div>` →
`<ui:Label text="안녕" />`.

---

## 3. 레이아웃 속성

| CSS | USS | 등급 | 비고 |
|---|---|---|---|
| `display: flex` | 기본값 | A | 모든 요소가 flex |
| `display: none` | `display: none` | A | |
| `display: block`, `inline`, `inline-block` | — | C | 개념 없음. flex로 재구성 |
| `display: grid` | — | C | **grid 없음.** flex 중첩으로 재구성 |
| `flex-direction` | 동일 | A | **기본값이 column (CSS는 row)** |
| `flex-grow`, `flex-shrink`, `flex-basis`, `flex` | 동일 | A | |
| `align-items`, `align-self`, `align-content` | 동일 | A | |
| `justify-content` | 동일 | A | `space-evenly` 버전 확인 |
| `flex-wrap` | 동일 | A | |
| `gap`, `row-gap`, `column-gap` | 버전 확인 | B | 없으면 자식 margin으로 대체 |
| `position: relative`, `absolute` | 동일 | A | |
| `position: fixed`, `sticky` | — | C | absolute + 부모 구조로 대체 |
| `top`, `right`, `bottom`, `left` | 동일 | A | |
| `width`, `height`, `min-*`, `max-*` | 동일 | A | |
| `margin`, `padding` (전체/개별) | 동일 | A | margin 상쇄 없음 |
| `overflow: hidden` | 동일 | A | |
| `overflow: auto`, `scroll` | — | D | `ScrollView`로 교체 |
| `float`, `clear` | — | C | flex로 재구성 |
| `z-index` | — | D | **없음.** 형제 순서로 결정. 뒤에 올수록 위 |
| `aspect-ratio` | 버전 확인 | B | 없으면 고정 크기로 |
| `box-sizing` | 항상 border-box 동작 | A | 선언 불필요 |

---

## 4. 박스 / 테두리

| CSS | USS | 등급 | 비고 |
|---|---|---|---|
| `background-color` | 동일 | A | |
| `border-width`, `border-color` | 동일 | A | 방향별 개별 지정 가능 |
| `border-style` | — | C | 실선만. dashed/dotted 불가 |
| `border-radius` | 동일 | A | 모서리별 지정 가능 |
| `opacity` | 동일 | A | |
| `visibility` | 동일 | A | |
| `box-shadow` | — | C | **미지원.** 그림자를 이미지에 굽거나 9-slice 배경으로 |
| `text-shadow` | `-unity-text-outline-*` | B | 외곽선만. 그림자와 다름 |
| `filter`, `backdrop-filter` | — | C | 흐림·채도 조정 전부 불가. 이미지로 굽기 |
| `mix-blend-mode`, `background-blend-mode` | — | C | 미지원. 셰이더 영역 |
| `clip-path`, `mask` | — | C | `overflow: hidden` 정도로만 |
| `outline` | — | C | border로 대체 |
| `cursor` | `cursor` | A | 유니티 커서 리소스 사용 |

---

## 5. 텍스트

| CSS | USS | 등급 | 비고 |
|---|---|---|---|
| `color` | 동일 | A | |
| `font-size` | 동일 | A | px만 |
| `font-family` | `-unity-font-definition` | B | 폰트 에셋 참조. 웹폰트 개념 없음 |
| `font-weight`, `font-style` | `-unity-font-style` | B | `normal/bold/italic/bold-and-italic`. 100~900 수치 없음 |
| `text-align` | `-unity-text-align` | B | `upper-left`, `middle-center` 등 세로+가로 조합 |
| `white-space` | 동일 | B | `normal`, `nowrap`, `pre` (버전 확인) |
| `text-overflow: ellipsis` | 동일 + `-unity-text-overflow-position` | A | |
| `letter-spacing`, `word-spacing` | 동일 | A | |
| `line-height` | — | C | 없음. `-unity-paragraph-spacing`은 단락 간격이라 다름 |
| `text-transform` | — | C | 텍스트를 직접 대문자로 넣어야 함 |
| `text-decoration` (밑줄, 취소선) | — | C | 미지원. 선을 요소로 그리거나 리치텍스트 태그 |
| `overflow-wrap`, `word-break` | 버전 확인 | B | |

**리치텍스트**: `Label`에 `enable-rich-text="true"`를 주면 `<b>`, `<color=#fff>` 같은
유니티 리치텍스트 태그를 쓸 수 있다. HTML의 인라인 서식(`<strong>`, `<em>`)을
텍스트 안에 섞어야 할 때 유용하다.

---

## 6. 배경 / 이미지

| CSS | USS | 등급 | 비고 |
|---|---|---|---|
| `background-image: url()` | 동일 (에셋 경로 또는 `resource()`) | A | 웹 URL 불가. 프로젝트 에셋으로 |
| `background-size` | 동일 (`cover`/`contain`) | A | 버전 확인 |
| `background-position`, `background-repeat` | 동일 | A | 버전 확인 |
| 다중 배경 (`,`로 나열) | — | C | 하나만. 요소를 겹쳐서 대체 |
| `linear-gradient()` | 버전 확인 | B | 미지원 버전이면 이미지로 구움 |
| 9-slice 늘리기 | `-unity-slice-left/right/top/bottom` | A | CSS `border-image` 대응 |
| 이미지 색조 | `-unity-background-image-tint-color` | A | CSS에 대응 없음. 유용함 |

**이미지 경로**: `url("project://database/Assets/...")` 또는
`resource("...")`. 프로젝트 관례를 따른다.

---

## 7. 트랜스폼 / 트랜지션

| CSS | USS | 등급 | 비고 |
|---|---|---|---|
| `transform: translate()` | `translate` | A | 개별 속성으로 분리됨 |
| `transform: scale()` | `scale` | A | |
| `transform: rotate()` | `rotate` | A | `45deg` 형식 |
| `transform: skew()` | — | C | 미지원 |
| 3D 트랜스폼 (`rotateX`, `perspective`) | — | C | 미지원 |
| `transform-origin` | 동일 | A | |
| `transition` (단축) | 동일 | A | |
| `transition-property/duration/timing-function/delay` | 동일 | A | |
| `cubic-bezier()` | 버전 확인 | B | `ease`, `ease-in-out`, `linear` 등 키워드는 확실히 됨 |
| `will-change` | — | A(무시) | 불필요. 그냥 제거 |

**성능 규칙**: `width`, `height`, `left`, `top`, `margin` 같은 레이아웃 속성에
transition을 걸면 매 프레임 레이아웃을 다시 계산해서 프레임이 떨어진다.
움직임은 `translate`, `scale`, `rotate`, `opacity`로 만든다. 변환 시
레이아웃 속성 transition을 발견하면 transform으로 바꾸고 리포트에 적는다.

---

## 8. 셀렉터

| CSS | USS | 등급 |
|---|---|---|
| 타입 (`Button`) | 동일 (UXML 요소 타입명) | A |
| 클래스 (`.foo`) | 동일 | A |
| ID (`#foo`) | `#foo` = UXML `name` 속성 | A |
| 자손 (`.a .b`) | 동일 | A |
| 자식 (`.a > .b`) | 동일 | A |
| 복합 (`.a.b`) | 동일 | A |
| 전체 (`*`) | 동일 | A |
| `:hover`, `:active`, `:focus`, `:disabled` | 동일 | A |
| `:checked`, `:selected`, `:root`, `:inactive` | 동일 | A |
| 인접·일반 형제 (`+`, `~`) | — | C |
| `:nth-child`, `:first-child`, `:last-child` | — | C |
| `:not()`, `:has()` | — | C |
| 속성 (`[type="x"]`) | — | C |
| `::before`, `::after` | — | C |
| `@media` | — | C |
| `@import` | 동일 | A |

**형제 셀렉터와 `:checked ~`가 없다는 점이 크다.** JS 없이 CSS만으로 만든
아코디언·탭·토글(체크박스 핵)은 전부 옮겨지지 않는다. 이런 구조를 만나면
`Foldout`으로 교체하거나 C# 할 일 목록에 올린다.

**`:nth-child`가 없다는 점**도 실무에서 자주 걸린다. 순차 등장 애니메이션을
`:nth-child(n) { transition-delay: ... }`로 만든 경우, 각 항목에 클래스를
하나씩(`delay-1`, `delay-2`...) 박아야 한다.

---

## 9. 단위와 값

| CSS | USS | 비고 |
|---|---|---|
| `px` | ✓ | |
| `%` | ✓ | |
| `em`, `rem` | ✗ | px로 환산 |
| `vh`, `vw`, `vmin`, `vmax` | ✗ | %로 대체하거나 C#으로 계산 |
| `pt`, `cm`, `in` | ✗ | px로 환산 |
| `deg` (회전) | ✓ | |
| `s`, `ms` | ✓ | |
| `calc()` | ✗ | 계산해서 고정값으로. 동적이면 C# |
| `auto` | ✓ | |
| `initial` | ✓ | |
| 색상 `#hex`, `rgb()`, `rgba()`, 키워드 | ✓ | |
| `hsl()` | 버전 확인 | 미지원이면 hex로 환산 |
| 커스텀 속성 (`--x`) + `var(--x)` | ✓ | **디자인 토큰을 그대로 살릴 수 있다** |

---

## 10. 애니메이션 판정

이 절이 가장 자주 조회된다.

| CSS 기법 | 등급 | 처리 |
|---|---|---|
| `transition` + `:hover`/`:active`/`:focus` | A | 그대로 |
| `transition` + 부모 hover로 자손 변화 (`.card:hover .icon`) | A | 그대로 |
| `transition` + JS 클래스 토글 | A | **최적 패턴.** 클래스 토글만 C#으로 |
| `transition-delay` 순차 등장 | B | `:nth-child`가 없어 각 항목에 클래스 부여 |
| `@keyframes` + `animation` | C | **미지원.** 정적 상태로 이관 + C# 할 일 |
| 무한 루프 (스피너, 펄스, 흔들림) | C | C# 또는 애니메이션 에셋 |
| `steps()` 스프라이트 프레임 | C | C#으로 프레임 교체 |
| `:checked ~` 체크박스 핵 | C | `Foldout`/`Toggle` + C# |
| `:target` (URL 해시) | C | C# 화면 전환 |
| 스크롤 연동 애니메이션 | C | C# |
| `@starting-style`, `view-transition` | C | C# |

**핵심**: USS에는 `@keyframes`가 없다. 트랜지션만 있다. 그래서 **"상태 A에서
상태 B로의 전환"은 잘 되고, "혼자 계속 움직이는 것"은 안 된다.**

**변환 시 권장 구조**: 모든 상태 변화를 클래스 토글로 표현한다.
`element.ToggleInClassList("is-open")` 한 줄이 USS 트랜지션을 발동시킨다.
JS가 `element.style`을 직접 조작하는 코드는 이 구조로 재해석해서
C# 할 일 목록에 적는다.

**중요한 함정**: 기본값이 `auto`인 속성(`left`, `width` 등)에서 시작하는
트랜지션은 작동하지 않는다. 시작값을 `0px`처럼 단위와 함께 명시해야 한다.
`translate`의 기본값은 `0px`이므로 `%`로 전환하려 하면 실패한다 — 단위를 맞춘다.

---

## 11. 상호작용

| 웹 | UI Toolkit | 비고 |
|---|---|---|
| `onclick` | `ClickEvent` / `Button.clicked` | C# |
| `onmouseenter/leave` | `PointerEnterEvent` / `PointerLeaveEvent` | C#. 단순 시각 변화는 `:hover`로 충분 |
| `oninput`, `onchange` | `ChangeEvent<T>` | C# |
| 드래그 | `PointerDown/Move/Up` + `CaptureMouse` | C# |
| 키보드 | `KeyDownEvent` | C# |
| 트랜지션 완료 감지 | `TransitionEndEvent` | C# |

전부 C# 영역이다. 이 스킬은 코드를 쓰지 않고 할 일 목록에만 올린다.

---

## 11-b. 화면 전환

웹의 페이지 이동(`<a href>`, 라우터, `:target`, 주소 변경)은 UI Toolkit에 대응이 없다.
전환 로직은 전부 C#이고, 이 표는 **겉모습**의 이식성만 다룬다.

| 웹 패턴 | 등급 | 처리 |
|---|---|---|
| 링크로 페이지 이동 | C | C#. `Button.clicked` |
| 탭 전환 (클래스 토글 + `transition`) | A | 겉모습 그대로. 토글만 C# |
| 탭 전환 (`:checked ~` 체크박스 핵) | C | 구조를 클래스 토글로 재작성 |
| 화면 밀려나기/밀려들기 (`translate` + `transition`) | A | 그대로 |
| 페이드 (`opacity` + `transition`) | A | 그대로 |
| `display: none` 토글만으로 숨김 | B | 애니메이션이 안 보임. 아래 참조 |
| 모달 열림/닫힘 | A | 겉모습 그대로. 표시 제어는 C# |
| 뒤로가기 (브라우저 히스토리) | C | C#으로 스택 직접 관리 |
| `view-transition` API | C | C# |

**`display: none` 함정**

숨김을 `display: none`으로만 처리하면 사라지는 애니메이션이 보이지 않는다.
레이아웃 계산에서 즉시 빠지기 때문에 전환할 시간이 없다.

올바른 구조:
```css
.screen              { opacity: 1; translate: 0 0;
                       transition: opacity 200ms, translate 200ms; }
.screen--hidden      { opacity: 0; translate: -40px 0; }
.screen--gone        { display: none; }
```
C#이 `--hidden`을 붙이고, `TransitionEndEvent`를 받은 뒤 `--gone`을 붙인다.
들어올 때는 역순. 이 두 단계를 `csharp-todo`에 반드시 올린다.

**전환 중 클릭 차단**

전환 중에는 두 화면이 겹쳐 있어서 양쪽 버튼이 다 눌린다. 나가는 화면에
`picking-mode: ignore`를 거는 것으로 막는다 — 클래스 하나로 처리 가능하니
USS 쪽에서 해결된다. 이것도 C# 할 일에 적는다.

**전략별 차이**

- `visibility-toggle`: 화면들이 한 UXML 안에 공존. 전환 애니메이션이 쉽다.
  화면이 많으면 파일이 비대해지고 초기 로드가 무거워진다.
- `document-swap`: `UIDocument.visualTreeAsset`을 교체. 파일이 깔끔하지만
  전환 애니메이션이 사실상 불가능하다(이전 화면이 즉시 사라진다). 페이드가
  필요하면 별도의 덮개 요소로 화면 전체를 가리는 방식을 쓴다.

---

## 12. 흔한 실패 패턴

변환 후 이 순서로 점검한다.

1. **`flex-direction` 기본값** — CSS는 row, USS는 column. 명시 안 된 모든
   컨테이너에 `flex-direction: row`를 박는다. **1순위 실패 원인.**
2. **맨몸 텍스트 노드** — `Label`로 감싸지 않으면 아무것도 안 보인다.
3. **`z-index` 의존** — 겹침 순서가 형제 순서로 결정된다. 마크업 순서를 바꿔야 한다.
4. **트랜지션이 안 먹음** — 시작값이 `auto`이거나 단위가 안 맞는다.
5. **폰트가 기본 폰트로 나옴** — `font-family` 대신 `-unity-font-definition`에
   폰트 에셋을 지정해야 한다.
6. **`display: block` 잔존** — 무시되거나 오류. 제거한다.
7. **레이아웃 속성 트랜지션** — 동작하지만 프레임이 떨어진다. transform으로 교체.
8. **스크롤이 안 됨** — `overflow: auto`가 아니라 `ScrollView` 요소가 필요하다.
9. **`gap` 무시** — 버전에 따라 없다. 자식 margin으로 대체.
10. **`%` 크기가 안 먹음** — 부모에 명시적 크기가 없으면 계산되지 않는다.

---

## 13. 템플릿 추출 판정

같은 구조가 2회 이상 반복되면 템플릿으로 뺀다. HTML만 보면 "정적으로 5개"와
"1개를 5번 반복"이 구분되지 않으므로 다음을 근거로 판정한다.

**템플릿으로 판정**
- 구조가 동일하고 텍스트/이미지만 다름
- 3개 이상 반복
- 목록·그리드·카드 배열의 형태
- `@template` 주석이 있음

**정적으로 판정**
- 2개뿐이고 구조가 미묘하게 다름 (예: 좌우 대칭 패널)
- 각 항목이 고유한 역할을 가짐 (예: 헤더의 메뉴 3개)
- 개수가 디자인상 고정 (예: 3단 요금제)

**출력**: 템플릿은 별도 `.uxml`로 뺀다. 원본 자리에는 빈 컨테이너만 남기고
`name`을 부여해 C#이 인스턴스화할 지점을 만든다. 계약 파일의 `csharp-todo`에
바인딩 항목을 추가한다.

애매하면 사용자에게 묻는다 — 단 기술 용어 없이:
"이 카드들은 항목이 늘어나면 같이 늘어나는 거야, 아니면 이 3개로 고정이야?"

---

## 14. picking-mode

`picking-mode: position | ignore`. UI가 화면을 덮으면 3D 월드 입력이 막히는데,
`ignore`인 요소는 클릭을 통과시킨다.

**`ignore`로 설정**
- `UIDocument` 루트
- 순수 레이아웃 컨테이너 (자기 자신은 아무것도 안 받음)
- 장식·배경·오버레이 프레임
- `@ignore` 주석이 있는 요소

**`position` 유지**
- 버튼, 입력, 토글, 슬라이더
- 스크롤 영역
- 클릭 가능한 카드
- 뒤쪽 클릭을 의도적으로 막는 모달 배경

**기본 방침**: 텍스트도 버튼도 입력도 없는 요소는 `ignore`로 판정한다.
판정이 갈리는 것만 사용자에게 묻는다 — "이걸 눌렀을 때 뒤에 있는 게 반응해야 해?"

3D 게임에서 UI 위에 커서가 있는지 확인해야 할 때, uGUI의
`IsPointerOverGameObject()`는 UI Toolkit에 작동하지 않는다. 패널의 `Pick()`을
쓴다는 점을 C# 할 일 목록에 메모해둔다.
