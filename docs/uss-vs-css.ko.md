# USS는 CSS가 아니다

*[English](uss-vs-css.md) · 한국어*

Unity UI Toolkit의 스타일은 CSS처럼 생겼습니다. CSS가 아니고, 다른 지점이
예상과 다릅니다. 손으로 옮긴 스타일시트는 보통 *거의* 동작하는데, 그게 아예
안 되는 것보다 나쁩니다 — 존재하지 않는 오타를 찾느라 한나절을 씁니다.

이 문서는 실제로 다른 것들을, **문제가 되는 순서대로** 정리한 것입니다.
모든 예제에 브라우저 놀이터 링크가 걸려 있어서 직접 고쳐보며 확인할 수 있습니다.
믿고 넘어가야 하는 대목이 없습니다.

---

## 가장 먼저 깨지는 다섯 가지

### 1. `flex-direction` 기본값이 `column`이다

CSS는 `row`, USS는 `column`입니다. 아무 경고도 없습니다.

```css
/* CSS: 버튼이 가로로 늘어선다 */
.toolbar { display: flex; }

/* USS: 같은 마크업이 세로로 쌓인다 */
.toolbar { flex-direction: row; }  /* 반드시 명시해야 한다 */
```

방향을 명시하지 않은 모든 컨테이너가 CSS와 **90도 틀어집니다.** 이식된
레이아웃이 어긋나는 1순위 원인이고, 컨테이너 하나하나는 그럴듯해 보이기 때문에
눈에 잘 안 띕니다.

**[직접 해보기][try-direction]** — `flex-direction` 줄을 지우면 가로가 세로로 바뀝니다.

![flex-direction: row를 지우면 버튼이 세로로 쌓인다](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/demo-flex-direction.gif)

### 2. `z-index`가 없다

겹침은 문서 순서로 정해집니다. **뒤에 오는 형제가 위에 그려지고**, 이걸 뒤집는
속성이 없습니다.

```css
/* CSS */
.modal { z-index: 100; }

/* USS: 대신 UXML에서 요소를 뒤로 옮긴다 */
```

쌓임 맥락에 기대어 만든 것 — 부모를 벗어나야 하는 드롭다운, 스크롤 목록 위에
떠야 하는 툴팁 — 은 **스타일시트가 아니라 마크업 순서를 고쳐야** 합니다.

**[직접 해보기][try-zindex]** — UXML의 두 줄 순서를 바꾸면 카드 위아래가 바뀝니다.

### 3. 항상 `border-box`다

`width`에 padding과 border가 포함됩니다. 설정할 `box-sizing`이 없고, 빠져나갈
방법도 없습니다.

```css
/* CSS 기본값 content-box: 전체 너비 236px */
.card { width: 200px; padding: 10px; border: 8px solid; }

/* USS: 전체 너비 200px. 내용 영역이 164px로 줄어든다. */
```

CSS에서 `content-box`에 기대고 있던 곳이 있다면, **그 박스들이 전부 의도보다
작아집니다.**

**[직접 해보기][try-borderbox]**

### 4. 맨몸 텍스트 노드가 없다

`<div>Hello</div>`에 대응하는 것이 없습니다. 모든 텍스트는 `Label`의 `text`
속성입니다.

```html
<!-- HTML -->
<div class="title">Inventory</div>

<!-- UXML -->
<ui:Label class="title" text="Inventory" />
```

태그 사이에 쓴 텍스트는 **오류가 아닙니다. 그냥 안 나옵니다.** 파일이 커지면
알아채는 데 오래 걸립니다.

**[직접 해보기][try-baretext]** — 첫 번째 줄은 비어 있고 두 번째 줄만 보입니다.

### 5. margin 상쇄가 없다

인접한 세로 margin이 합쳐지지 않고 **더해집니다.**

```css
/* CSS: 20px과 30px이 상쇄되어 30px 간격 */
/* USS: 간격이 50px */
```

상쇄를 전제로 맞춘 세로 리듬이 대략 1.5배로 벌어집니다.

**[직접 해보기][try-margin]**

---

## 이름이 다른 속성

동작은 있는데 이름이 없습니다. CSS 이름으로 검색하면 안 나오니 "미지원"으로
오해하기 쉽습니다.

| CSS | USS |
|---|---|
| `font-family` | `-unity-font-definition` (웹폰트가 아니라 폰트 에셋) |
| `font-weight` / `font-style` | `-unity-font-style`: `normal`, `bold`, `italic`, `bold-and-italic` |
| `text-align` | `-unity-text-align` — 두 축을 한 번에: `upper-left`, `middle-center`, `lower-right` … |
| `text-shadow` | `-unity-text-outline-*` — 외곽선이라 효과가 다름 |
| `border-image` (9-slice) | `-unity-slice-left` / `-right` / `-top` / `-bottom` |
| `transform: translate() / scale() / rotate()` | `translate`, `scale`, `rotate` 개별 속성 |
| *(대응 없음)* | `-unity-background-image-tint-color` — 배경 이미지 색조. 꽤 유용함 |

`-unity-font-style`은 값이 넷뿐이고 숫자 굵기가 없습니다. `font-weight: 600`
같은 건 없습니다.

## 아예 없는 속성

이름이 바뀐 게 아니라 없습니다. 써도 아무 일도 일어나지 않습니다.

`box-shadow` · `filter` · `backdrop-filter` · `mix-blend-mode` · `clip-path` ·
`mask` · `outline` · `line-height` · `text-transform` · `text-decoration` ·
`float` · `clear` · `z-index` · 다중 배경 · `transform: skew()` · 3D 트랜스폼

`display`는 `flex`와 `none`만 받습니다. `block`도 `inline`도 없고,
**`grid`도 없습니다** — 그리드 레이아웃은 중첩 flex로 다시 짜야 합니다.

`overflow: auto`와 `scroll`은 설정하는 속성이 아닙니다. 스크롤은 `ScrollView`라는
**별도 요소**라서, 스크롤 영역을 만들려면 마크업을 바꿔야 합니다.

`border-style`은 실선만 됩니다. 점선·파선이 없습니다.

## 셀렉터

지원: 타입(`Button`), 클래스(`.foo`), 이름(`#foo`), 자손, 자식(`>`),
복합(`.a.b`), 전체(`*`), `@import`.

pseudo-class: `:hover`, `:active`, `:focus`, `:disabled`, `:checked`,
`:selected`, `:inactive`, `:root`.

미지원: **형제 결합자**(`+`, `~`), `:nth-child`, `:first-child` / `:last-child`,
`:not()`, `:has()`, 속성 셀렉터, `::before` / `::after`, `@media`.

짚어둘 결과 세 가지:

- **타입 셀렉터는 태그명이 아니라 C# 클래스명입니다** — `Label`, `Button`,
  `VisualElement`. **대소문자를 구분**하므로 `label`은 아무것도 매칭하지 않습니다
- **`#foo`는 HTML id가 아니라 UXML의 `name` 속성**을 가리킵니다
- **형제 결합자가 없다는 건 CSS만으로 만든 인터랙션이 전부 안 된다는 뜻입니다.**
  체크박스 핵으로 만든 아코디언·탭·토글은 이식이 불가능하고, C#으로 클래스를
  토글하는 구조가 됩니다. `:nth-child(n) { transition-delay: … }`로 만든 순차
  등장은 항목마다 클래스를 하나씩 박아야 합니다

`:root`도 CSS와 다릅니다. 문서 루트가 아니라 **스타일시트가 적용된 요소**를
가리키고, 그 요소의 자식에는 매칭되지 않습니다.

## 단위

지원: `px`, `%`, `deg`, `s`, `ms`, `auto`, `initial`, 색상(`#hex`, `rgb()`,
`rgba()`, 키워드), 그리고 `var()` 커스텀 속성.

미지원: `em`, `rem`, `vh`, `vw`, `vmin`, `vmax`, `pt`, `cm`, `in`,
그리고 **`calc()`**. 계산이 필요한 값은 고정값으로 풀거나 C#에서 계산해야 합니다.

커스텀 속성은 되고 상속도 됩니다. **디자인 토큰은 거의 그대로 옮겨집니다:**

```css
:root { --accent: rgb(110, 168, 254); }
.button { background-color: var(--accent); }
```

함정 하나: **부모에 명시적 크기가 없으면 `%`가 계산되지 않습니다.** 오류가 아니라
그냥 크기가 0이 됩니다.

## 애니메이션

**`@keyframes`가 없습니다. 트랜지션만 있습니다.**

이 한 문장이 대부분을 결정합니다 — *상태 A에서 B로의 전환*은 되고,
*혼자 계속 움직이는 것*은 안 됩니다.

| 패턴 | 이식 |
|---|---|
| `transition` + `:hover` / `:active` / `:focus` | 그대로 됨 |
| `transition` + 클래스 토글 | 됨 — **가장 권장되는 구조** |
| `transition-delay` 순차 등장 | `:nth-child`가 없어 항목마다 클래스 필요 |
| `@keyframes` + `animation` | 안 됨 |
| 무한 루프: 스피너, 펄스, 흔들림 | 안 됨 — C# 또는 애니메이션 에셋 |
| `steps()` 스프라이트 프레임 | 안 됨 |
| 스크롤 연동 애니메이션 | 안 됨 |

트랜지션 자체의 함정 둘:

- **시작값이 `auto`면 트랜지션이 작동하지 않습니다.** `auto`가 아니라 `0px`처럼
  단위를 명시해야 합니다
- **`translate`의 기본값이 `0px`이라 `%`로 전환하면 실패합니다.** 양쪽 단위를
  맞추세요

성능 주의 — CSS에서도 마찬가지지만 여기서 더 아픕니다: `width`, `height`,
`left`, `top`, `margin`에 트랜지션을 걸면 매 프레임 레이아웃이 다시 돕니다.
움직임은 `translate`, `scale`, `rotate`, `opacity`로 만드세요.

## 이미지

`background-image`는 웹 URL이 아니라 유니티 에셋 참조를 받습니다:

```css
background-image: url("project://database/Assets/UI/panel.png");
/* 또는 */
background-image: resource("panel");
```

`https://` 이미지를 가리킬 방법이 없습니다. 에셋이 프로젝트 안에 있어야 합니다.

## 실제로 측정한 것

위 내용은 문서를 읽고 정리한 게 아닙니다. 이 저장소는 케이스 세트를 **두 번**
레이아웃합니다 — 한 번은 유니티에서, 한 번은 UI Toolkit이 쓰는 것과 같은 Yoga로
브라우저에서 — 그리고 모든 요소의 위치와 크기를 비교합니다.

**Unity 6000.0.40f1** 기준: 케이스 18개, 요소 61개에서
**좌표 244개 중 242개가 완전히 일치**합니다. 어긋난 둘은 크기 미지정 부모에 대한
퍼센트이고, 수치와 조정하려다 실패한 시도까지 [`accuracy.md`](accuracy.md)에
적혀 있습니다.

스크린샷이 아니라 좌표로 비교하는 것은 의도적입니다. 유니티는 자기 폰트 에셋으로
글자를 그리고 브라우저는 그러지 않으므로, 텍스트가 든 케이스에서 픽셀 비교는
레이아웃이 아니라 폰트를 재게 됩니다.

## 직접 넣어보기

[놀이터](https://reuhomi.github.io/uxml-preview/)에 `.uxml`과 `.uss`를 넣으면
바로 렌더됩니다. **아무것도 업로드되지 않고** 페이지 안에서 돕니다.
우상단의 `round-trip: exact`는 지금 문서를 다시 저장했을 때 주석과 미지원
컨트롤까지 포함해 **바이트 단위로 같다**는 뜻입니다.

자기 도구에 프리뷰를 넣고 싶다면 라이브러리로도 쓸 수 있습니다. 다만 아직
pre-alpha이고 npm에 올라가 있지 않습니다. 소스와 API, 전체 지원 범위는
[github.com/ReuHomi/uxml-preview](https://github.com/ReuHomi/uxml-preview)에
있습니다.

[try-direction]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IGNsYXNzPVwiYmFyXCI-XG4gICAgPHVpOkJ1dHRvbiB0ZXh0PVwiRmlsZVwiIGNsYXNzPVwidGFiXCIgLz5cbiAgICA8dWk6QnV0dG9uIHRleHQ9XCJFZGl0XCIgY2xhc3M9XCJ0YWJcIiAvPlxuICAgIDx1aTpCdXR0b24gdGV4dD1cIlZpZXdcIiBjbGFzcz1cInRhYlwiIC8-XG4gIDwvdWk6VmlzdWFsRWxlbWVudD5cbjwvdWk6VVhNTD5cbiIsInVzcyI6Ii8qIERlbGV0ZSB0aGUgZmxleC1kaXJlY3Rpb24gbGluZS4gSW4gQ1NTIHRoZSBidXR0b25zIHN0YXkgaW4gYSByb3cuXG4gICBJbiBVU1MgdGhleSBzdGFjaywgYmVjYXVzZSBjb2x1bW4gaXMgdGhlIGRlZmF1bHQuICovXG4uYmFyIHtcbiAgZmxleC1kaXJlY3Rpb246IHJvdztcbiAgcGFkZGluZzogMTBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDM4LCA0MCwgNDYpO1xufVxuXG4udGFiIHtcbiAgcGFkZGluZzogNnB4IDE2cHg7XG4gIG1hcmdpbi1yaWdodDogNHB4O1xuICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2IoNTgsIDYyLCA3Mik7XG4gIGNvbG9yOiByZ2IoMjIwLCAyMjIsIDIyOCk7XG4gIGJvcmRlci1yYWRpdXM6IDNweDtcbn1cbiIsInciOjY0MCwiaCI6MzYwfQ
[try-zindex]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDwhLS0gU3dhcCB0aGVzZSB0d28gbGluZXMgdG8gc3dhcCB3aGljaCBjYXJkIGlzIG9uIHRvcC4gLS0-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJyZWRcIiAvPlxuICA8dWk6VmlzdWFsRWxlbWVudCBuYW1lPVwiYmx1ZVwiIC8-XG48L3VpOlVYTUw-XG4iLCJ1c3MiOiIvKiBVU1MgaGFzIG5vIHotaW5kZXguIE1hcmt1cCBvcmRlciBkZWNpZGVzIG92ZXJsYXA6IGxhdGVyIGlzIG9uIHRvcC4gKi9cbiNyZWQsICNibHVlIHtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICB3aWR0aDogMTgwcHg7XG4gIGhlaWdodDogMTIwcHg7XG4gIGJvcmRlci1yYWRpdXM6IDhweDtcbn1cblxuI3JlZCB7XG4gIGxlZnQ6IDYwcHg7XG4gIHRvcDogNjBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDE5NiwgNzQsIDc0KTtcbn1cblxuI2JsdWUge1xuICBsZWZ0OiAxNDBweDtcbiAgdG9wOiAxMTBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDcwLCAxMjAsIDIwMCk7XG59XG4iLCJ3Ijo2NDAsImgiOjM2MH0
[try-borderbox]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJib3hcIj5cbiAgICA8dWk6TGFiZWwgdGV4dD1cImNvbnRlbnRcIiAvPlxuICA8L3VpOlZpc3VhbEVsZW1lbnQ-XG48L3VpOlVYTUw-XG4iLCJ1c3MiOiIvKiB3aWR0aCBpcyAyMDBweCBpbmNsdWRpbmcgcGFkZGluZyBhbmQgYm9yZGVyLCBub3Qgb24gdG9wIG9mIHRoZW0uXG4gICBVU1MgYmVoYXZlcyB0aGlzIHdheSB3aXRoIG9yIHdpdGhvdXQgYSBib3gtc2l6aW5nIGRlY2xhcmF0aW9uLiAqL1xuI2JveCB7XG4gIHdpZHRoOiAyMDBweDtcbiAgaGVpZ2h0OiAxMjBweDtcbiAgcGFkZGluZzogMjBweDtcbiAgYm9yZGVyLXRvcC13aWR0aDogOHB4O1xuICBib3JkZXItcmlnaHQtd2lkdGg6IDhweDtcbiAgYm9yZGVyLWJvdHRvbS13aWR0aDogOHB4O1xuICBib3JkZXItbGVmdC13aWR0aDogOHB4O1xuICBib3JkZXItdG9wLWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJvcmRlci1yaWdodC1jb2xvcjogcmdiKDExMCwgMTY4LCAyNTQpO1xuICBib3JkZXItYm90dG9tLWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJvcmRlci1sZWZ0LWNvbG9yOiByZ2IoMTEwLCAxNjgsIDI1NCk7XG4gIGJhY2tncm91bmQtY29sb3I6IHJnYig0OCwgNTIsIDYwKTtcbn1cblxuTGFiZWwge1xuICBjb2xvcjogcmdiKDIyNCwgMjI2LCAyMzIpO1xufVxuIiwidyI6NjQwLCJoIjozNjB9
[try-baretext]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDwhLS0gVGhlIGZpcnN0IGxpbmUgcmVuZGVycyBub3RoaW5nOiBVWE1MIGhhcyBubyBiYXJlIHRleHQgbm9kZXMuXG4gICAgICAgRXZlcnkgc3RyaW5nIGJlbG9uZ3MgdG8gYSBMYWJlbCdzIHRleHQgYXR0cmlidXRlLiAtLT5cbiAgPHVpOlZpc3VhbEVsZW1lbnQgY2xhc3M9XCJyb3dcIj5IZWxsbzwvdWk6VmlzdWFsRWxlbWVudD5cbiAgPHVpOlZpc3VhbEVsZW1lbnQgY2xhc3M9XCJyb3dcIj5cbiAgICA8dWk6TGFiZWwgdGV4dD1cIkhlbGxvXCIgLz5cbiAgPC91aTpWaXN1YWxFbGVtZW50PlxuPC91aTpVWE1MPlxuIiwidXNzIjoiLnJvdyB7XG4gIGhlaWdodDogNDBweDtcbiAgbWFyZ2luLWJvdHRvbTogOHB4O1xuICBwYWRkaW5nOiA4cHg7XG4gIGJhY2tncm91bmQtY29sb3I6IHJnYig0OCwgNTIsIDYwKTtcbn1cblxuTGFiZWwge1xuICBjb2xvcjogcmdiKDIyNCwgMjI2LCAyMzIpO1xufVxuIiwidyI6NjQwLCJoIjozNjB9
[try-margin]: https://reuhomi.github.io/uxml-preview/#eyJ1eG1sIjoiPHVpOlVYTUwgeG1sbnM6dWk9XCJVbml0eUVuZ2luZS5VSUVsZW1lbnRzXCI-XG4gIDx1aTpWaXN1YWxFbGVtZW50IG5hbWU9XCJ0b3BcIiAvPlxuICA8dWk6VmlzdWFsRWxlbWVudCBuYW1lPVwiYm90dG9tXCIgLz5cbjwvdWk6VVhNTD5cbiIsInVzcyI6Ii8qIENTUyB3b3VsZCBjb2xsYXBzZSAyMHB4IGFuZCAzMHB4IGludG8gb25lIDMwcHggZ2FwLlxuICAgVVNTIGFkZHMgdGhlbTogdGhlIGdhcCBpcyA1MHB4LiAqL1xuI3RvcCB7XG4gIGhlaWdodDogNjBweDtcbiAgbWFyZ2luLWJvdHRvbTogMjBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDE5NiwgNzQsIDc0KTtcbn1cblxuI2JvdHRvbSB7XG4gIGhlaWdodDogNjBweDtcbiAgbWFyZ2luLXRvcDogMzBweDtcbiAgYmFja2dyb3VuZC1jb2xvcjogcmdiKDcwLCAxMjAsIDIwMCk7XG59XG4iLCJ3Ijo2NDAsImgiOjM2MH0
