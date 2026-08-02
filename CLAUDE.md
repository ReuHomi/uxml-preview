# uxml-preview

Unity UI Toolkit의 UXML/USS를 브라우저에서 렌더링·편집하는 라이브러리.

## 절대 규칙

1. **레이아웃 계산을 직접 구현하지 않는다.** `yoga-layout` (공식 WASM)에 위임한다.
   Unity UI Toolkit 자체가 Yoga를 쓰기 때문에, 직접 구현하면 반드시 어긋난다.
2. **Yoga 노드는 자동 GC되지 않는다.** 트리를 버릴 때 `freeRecursive()` 필수.
   리렌더가 잦은 구조라 누수가 치명적이다.
3. **USS는 CSS가 아니다.** 아래 함정 절과 `docs/uss-reference.md`를 따른다.
4. **왕복 보존이 최우선이다.** parse → serialize 시 의미가 같아야 하고,
   주석·속성 순서·사용자가 쓴 서식이 유실되면 안 된다.
5. **새 기능을 넣기 전에 테스트를 먼저 쓴다.**
6. **미지원을 만나면 에러를 던지지 않는다.** 경고 목록에 담고 계속 진행한다.
   렌더 하나가 실패했다고 화면 전체가 죽으면 안 된다.

---

## USS 함정 (틀리기 쉬운 것들)

**전체 참조표는 `docs/uss-reference.md`에 있다. 애매하면 그걸 먼저 본다.**

### 1순위 — 이걸 틀리면 전부 어긋난다

- **`flex-direction` 기본값이 `column`이다.** CSS는 `row`.
  파서가 CSS 기본값을 가정하면 모든 레이아웃이 90도 틀어진다.
- **박스 모델이 항상 `border-box` 동작이다.** width/height에 padding과 border 포함.
  선언 없이도 그렇게 동작하므로 페인팅 시 강제 지정한다.
- **`z-index`가 없다.** 겹침 순서는 형제 순서로 결정되고, 뒤에 올수록 위다.
  → 페인팅 시 z-index를 **절대 출력하지 않는다.** DOM 순서에 맡긴다.
- **맨몸 텍스트 노드가 없다.** 모든 텍스트는 `Label`의 `text` 속성이다.
  `<div>안녕</div>` → `<ui:Label text="안녕" />`
- **`%` 크기는 부모에 명시적 크기가 없으면 계산되지 않는다.**
- **margin 상쇄가 없다.** CSS와 다르다.

### 셀렉터

- 타입 셀렉터는 HTML 태그명이 아니라 **C# 클래스명**이다.
  `VisualElement`, `Label`, `Button`, `TextField`, `ScrollView`
- 우선순위: 인라인 > `#name` > `.class` > 타입 > `*`
  동률이면 USS 파일에서 **뒤에 나온 규칙**이 이긴다.
  요소를 직접 겨냥한 스타일은 상속된 스타일보다 항상 우선한다.
- **대소문자를 구분**한다.
- 클래스명 안의 마침표는 새 클래스의 시작으로 해석된다.
- 지원: 타입, 클래스, `#name`, 자손(` `), 자식(`>`), 복합(`.a.b`), 전체(`*`), `@import`
- 지원 pseudo-class: `:hover` `:active` `:focus` `:disabled` `:checked` `:selected` `:root` `:inactive`
- **미지원**: 형제(`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`, `:has()`,
  속성 셀렉터, `::before`/`::after`, `@media`
- `:root`가 CSS와 다르다. 스타일시트가 적용된 각 요소를 가리키며,
  그 자식 요소에는 매칭되지 않는다.

### 이름이 다른 속성 (CSS 이름으로 찾으면 없다)

| CSS | USS |
|---|---|
| `font-family` | `-unity-font-definition` |
| `font-weight` / `font-style` | `-unity-font-style` (`normal`/`bold`/`italic`/`bold-and-italic`) |
| `text-align` | `-unity-text-align` (`upper-left`, `middle-center` 등 세로+가로 조합) |
| `text-shadow` | `-unity-text-outline-*` (외곽선이라 의미가 다름) |
| `border-image` (9-slice) | `-unity-slice-left/right/top/bottom` |
| (대응 없음) | `-unity-background-image-tint-color` |
| `transform: translate()/scale()/rotate()` | `translate` / `scale` / `rotate` 개별 속성 |

### 미지원 속성 — 매핑하지 말고 경고 목록에 담는다

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `overflow: auto/scroll`(→ ScrollView 요소), `z-index`,
`box-shadow`, `filter`, `backdrop-filter`, `mix-blend-mode`, `clip-path`, `mask`,
`outline`, `border-style`(실선만), `line-height`, `text-transform`,
`text-decoration`, 다중 배경, `transform: skew()`, 3D 트랜스폼, `@keyframes`

### 단위

- 지원: `px` `%` `deg` `s` `ms` `auto` `initial`, `#hex`/`rgb()`/`rgba()`/키워드, `var(--x)`
- 미지원: `em` `rem` `vh` `vw` `vmin` `vmax` `pt` `cm` `in` `calc()`

### 버전 의존 — 단정하지 말고 "버전 확인" 경고를 남긴다

`gap`/`row-gap`/`column-gap`, `aspect-ratio`, `linear-gradient()`, `hsl()`,
`cubic-bezier()`, `justify-content: space-evenly`,
`background-size`/`position`/`repeat`, `white-space` 값, `overflow-wrap`/`word-break`

### 애니메이션

- **`@keyframes`가 없다. 트랜지션만 있다.**
  "상태 A → B 전환"은 되고, "혼자 계속 움직이는 것"은 안 된다.
- 시작값이 `auto`인 속성의 트랜지션은 작동하지 않는다. `0px`처럼 단위를 명시해야 한다.
- `translate`의 기본값은 `0px`이라 `%`로 전환하려 하면 실패한다. 단위를 맞춘다.

### 이미지 경로 — 렌더러의 특수 문제

`background-image`가 `url("project://database/Assets/...")` 또는 `resource("...")`
형식이다. **브라우저가 이걸 그대로 로드할 수 없다.**
`resolveAsset(path) => string | null` 훅을 공개 API로 노출하고,
리졸브 실패 시 플레이스홀더를 그린 뒤 경고 목록에 담는다.

---

## 코드 규약 — LCC (Local Contract Coding)

목표는 **에이전트가 오해 없이 확장할 수 있는 코드**다. 막으려는 실패는 둘이다 —
숨은 결합을 잘못 읽는 것, 검증되지 않은 가정 위에 쌓는 것.

### 제1원칙: 자명하지 않은 것만 적는다

코드가 이미 보여주는 걸 반복하지 않는다.
과잉 문서는 잡음이고, **에이전트는 잡음을 신호만큼 성실하게 읽는다.**

### 드러낼 것 (가치 순)

1. **Deps/Effects** — 읽는 외부 상태, 발생시키는 이벤트, 요구되는 호출 순서,
   **소유권(누가 해제하는가)**. 함수 본문만 봐서는 알 수 없다. 가치가 가장 높다
2. **Purpose** — 코드가 보여줄 수 없는 "왜"
3. **Ensures** — 자명하지 않은 사후조건만
4. **Requires** — 호출자가 지켜야 하는 암묵적 사전조건만.
   strict와 `exactOptionalPropertyTypes`가 대부분을 타입으로 잡으므로 드물어야 한다

### 순수성 — 이 프로젝트에서의 경계

파서·직렬화·셀렉터 매칭·캐스케이드는 **전부 순수 함수로 쓸 수 있다.**
순수하면 상태가 드러나고 정확성이 테스트에 고정된다. 기본값은 순수다.

불순한 곳은 셋뿐이고, 셋 다 위험 지점이다:

- **Yoga 노드 트리** — WASM 핸들. GC 안 됨. 소유권과 `freeRecursive()` 책임을 반드시 적는다
- **DOM 페인팅** — 컨테이너를 변형한다
- **`resolveAsset`** — 호스트가 구현하는 훅. 실패할 수 있다

여기서는 순수성 대신 Deps/Effects를 적는다. 목적은 같다.
**경고 목록에 담는 것도 Effect다** (절대 규칙 6).

### 유니티 근거를 밝힌다

USS 고유 동작을 구현하는 곳에는 근거를 남긴다 — `docs/uss-reference.md`의 절 또는
유니티 규칙 자체. 이 프로젝트에서 에이전트의 1순위 실패는 **CSS 상식으로 추론하는 것**이고,
`// USS: flex-direction 기본값은 column (uss-reference §3)` 한 줄이 그걸 막는다.

### 헤더 형식 (함수마다 선택, 쓸 때는 고정)

TypeScript이므로 `///`가 아니라 JSDoc을 쓴다 — `///`는 TS에서 triple-slash 지시자라
의미가 충돌한다.

```ts
/**
 * Purpose:      자명하지 않은 의도
 * Deps/Effects: 읽는 상태 / 이벤트 / 호출 순서 / 소유권
 * Ensures:      자명하지 않은 사후조건
 * Requires:     암묵적 사전조건
 */
```

헤더는 **자명하지 않은 함수에만** 붙인다. 붙일 때는 이 이름을 이 순서로 쓴다.
에이전트가 어디를 볼지 학습하게 하기 위해서다.

### 하지 않는다

- 코드가 이미 명백히 보여주는 것을 다시 쓰지 않는다
- 전체 설계를 함수 헤더에 넣지 않는다. 그건 `docs/architecture.md` 소관이다
- **조용히 어긋날 수 있는 계약은 테스트에 묶거나 최소한으로 줄인다.**
  핵심 로직(계산·직렬화·상태 전이)은 계약을 assert나 단위 테스트로 끌어올린다

---

## 스택

TypeScript (strict) / pnpm / Vite / Vitest / yoga-layout

## 명령어

- `pnpm dev` — 놀이터 실행
- `pnpm test` — 전체 테스트
- `pnpm test:roundtrip` — 왕복 검증만
- `pnpm test:golden` — 골든 이미지 비교
- `pnpm build` — 라이브러리 빌드

## 스코프 경계 (v0.1)

지원 컨트롤은 `VisualElement`, `Label`, `Button` **3종만**.
다른 컨트롤을 추가하자는 제안이 나오면 거절하고 `docs/backlog.md`에 적는다.

모르는 컨트롤 타입을 만나면 **에러를 던지지 말고** "미지원"으로 표시한 채
트리에 유지한다. 왕복 시 유실되면 안 되기 때문이다.

## 세션 규칙

- 세션 시작: `docs/progress.md`를 읽고 현재 상태를 파악한다
- 세션 종료: `/devlog`로 `docs/progress.md`를 갱신한다.
  기록처는 이 파일 하나뿐이다 — 별도 devlog 문서를 만들지 않는다.
  결정 기록과 세션 로그는 **append-only**. 결정이 뒤집히면 지우지 말고 새 행으로 뒤집는다
- 렌더링 버그는 추측으로 고치지 않는다. Yoga 계산 결과와 최종 DOM 좌표를
  둘 다 찍어서 어느 단계에서 어긋났는지 확인한 뒤에 고친다
