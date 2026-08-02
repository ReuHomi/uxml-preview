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
- 세션 종료: `docs/progress.md`를 갱신한다
- 렌더링 버그는 추측으로 고치지 않는다. Yoga 계산 결과와 최종 DOM 좌표를
  둘 다 찍어서 어느 단계에서 어긋났는지 확인한 뒤에 고친다
