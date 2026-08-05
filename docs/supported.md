# Support Matrix / 지원 범위

*[English](supported.en.md) · 한국어*

Phase가 진행되면서 갱신한다. 상세 매핑은 `uss-reference.md` 참조.

## 등급

- **A** — 그대로 지원
- **B** — 대체 방식으로 근사 지원 (차이가 있음)
- **C** — 미지원. 경고를 남기고 무시
- **D** — 구조 변경 필요

## 컨트롤

> 상태 표기: `코드 작성` = 코드는 있고 골든 테스트로 검증 안 됨,
> `검증됨` = 유니티와 대조까지 끝남. Phase 5 전에는 `검증됨`이 하나도 없다.

| 타입 | v0.2 | 비고 |
|---|---|---|
| `VisualElement` | 검증됨 | 골든 케이스 대부분이 이걸로 짜여 있다 |
| `Label` | 코드 작성 | 레이아웃은 검증됨. **텍스트 측정은 유니티와 대조하지 않았다** |
| `Button` | 검증됨 | 골든 케이스 6개 유니티 대조 완료. 라벨은 **가운데 정렬**(육안 대조로 발견). 유니티의 **기본 여백 `margin: 1px 3px`**을 적용한다 (`src/controls/theme.ts`). `:hover` 등 상태 스타일 해석 지원 |
| `ScrollView` | 검증됨 | **암묵 계층 3층**(`unity-content-and-vertical-scroll-container` → `unity-content-viewport` → `unity-content-container`)을 재현한다. 골든 케이스 3개 유니티 대조 완료. 스크롤바는 **폭(13px)만 예약**하고 그리지 않는다 — 드래그·휠·스크롤 위치는 정지 렌더 스코프 밖 |
| `TextField` | 폴백 | `text`·`label`이 그려지지 않는다 |
| `Toggle` | 폴백 | 위와 같다 |
| `Slider` / `SliderInt` | 폴백 | 위와 같다 |
| `Foldout` | 폴백 | 위와 같다 |
| `DropdownField` | 폴백 | 위와 같다 |
| `ListView` | 폴백 | 미정 |
| `Image` | 검증됨(시각) | 전용 렌더러(`unity-image`). 그림은 USS `background-image`로 들어온다 — C#에서 할당한 텍스처는 프리뷰가 따라갈 경로가 없다. 대표 화면에서 육안 대조 완료 |

> **전용 렌더러가 없는 컨트롤은 `VisualElement`처럼 그려진다** (`폴백`).
> 자기 스타일과 자식은 정상적으로 나오고, 그 컨트롤 고유의 모양(스크롤바, 입력 필드,
> 암묵적 자식 계층)만 빠진다. 요소마다 경고가 한 건 남는다.
>
> 하위 트리를 통째로 버리던 v0.1 동작을 뒤집은 것이다. 미지원 컨트롤 하나에 화면
> 절반이 사라지는 것은 "지원 범위"가 아니라 고장이고, 그런 화면은 무엇이 맞고 무엇이
> 틀린지 판단할 근거조차 주지 않는다.
>
> 파싱은 어느 쪽이든 성공하며, 왕복 시 유실되지 않는다.

## USS 속성

**`검증됨`은 유니티 6000.0.40f1과 좌표를 대조해 일치한 것만이다** (`docs/accuracy.md`).
골든 케이스가 좌표만 비교하므로, 색·테두리 같은 시각 속성은 코드가 있어도 `코드 작성`이다.

**그 대조는 Yoga가 낸 좌표까지다.** 그려진 DOM이 그 좌표를 재현하는지는 유니티가
아니라 자체 불변식 검사(`tests/render/border-offset.test.ts`)로 본다. 이 구분이
왜 필요한지는 `accuracy.md`의 "이 수치가 덮는 범위" 참조.

| 속성군 | 등급 | 상태 | 비고 |
|---|---|---|---|
| flex 계열 | A | 검증됨 | `flex-direction` 기본값 `column`, `flex-shrink` 기본값 `1` 확인 |
| width/height/min/max | A | 검증됨 | min/max 충돌 우선순위 포함 |
| margin / padding | A | 검증됨 | margin 상쇄 없음 확인 |
| position / top·left·right·bottom | A | 검증됨 | 중첩 absolute 포함. `fixed`·`sticky`는 C |
| 박스 모델 (border-box) | A | 검증됨 | width에 padding·border 포함 확인 |
| `%` 크기 | A | **부분** | 부모 크기가 확정된 경우만 일치. 미확정 시 불일치 — `accuracy.md` 참조 |
| background-color | A | 코드 작성 | 좌표 비교 대상 아님 |
| border-width / color / radius | A | 코드 작성 | width는 레이아웃으로 검증됨. `border-style`은 실선만 |
| opacity / visibility | A | 코드 작성 | |
| color / font-size | A | 코드 작성 | font-size 상속은 캐스케이드 테스트로 확인 |
| `-unity-font-definition` | B | 코드 작성 | 경고만 남기고 브라우저 기본 폰트 사용 |
| `-unity-font-style` | B | 코드 작성 | |
| `-unity-text-align` | B | 코드 작성 | 세로+가로 조합. 텍스트 케이스는 비교 제외 |
| `-unity-background-scale-mode` | A | **기본값 검증됨** | `stretch-to-fill`→`100% 100%`, `scale-and-crop`→`cover`, `scale-to-fit`→`contain`. 기본값 `stretch-to-fill`은 육안 대조로 확인(`docs/visual-check.md`). 나머지 두 값은 대표 화면에 없어 **개별 미확인** |
| `-unity-slice-*` | A | **미구현** | 경고만 남긴다 |
| `-unity-background-image-tint-color` | A | **미구현** | CSS 대응이 없어 경고만 남긴다 |
| `-unity-text-outline-*` | B | 미구현 | |
| translate / scale / rotate | A | 코드 작성 | |
| transition | A | 미구현 | 값을 전개하지 않고 통째로 둔다 |
| background-image | A | 코드 작성 | 에셋 리졸버 필요. 실패 시 플레이스홀더 |
| `var()` 커스텀 속성 | A | 코드 작성 | 캐스케이드 테스트로 확인, 유니티 대조는 안 함 |

## 미지원 (C)

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `z-index`, `box-shadow`, `filter`, `backdrop-filter`,
`mix-blend-mode`, `clip-path`, `mask`, `outline`, `line-height`, `text-transform`,
`text-decoration`, 다중 배경, `transform: skew()`, 3D 트랜스폼, `@keyframes`

단위: `em` `rem` `vh` `vw` `vmin` `vmax` `pt` `cm` `in` `calc()`

셀렉터: 형제(`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`, `:has()`,
속성 셀렉터, `::before`/`::after`, `@media`

## pseudo-class 상태

`:hover` `:active` `:focus` `:disabled` `:checked` `:selected` `:inactive`의
**스타일 해석**을 지원한다. 상태는 마우스 이벤트가 아니라 **명시적 입력**으로 받는다:

```ts
render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } });
```

키는 USS 셀렉터이고 요소마다 다른 상태를 줄 수 있다. 실제 화면은 한 버튼이 hover인
동시에 다른 버튼이 disabled인 경우가 보통이기 때문이다.

- 마우스로 상태가 바뀌지 않는다. 같은 호출은 항상 같은 그림을 그린다 —
  그래야 유니티와도, 어제 결과와도 비교할 수 있다
- 키는 **상태가 하나도 적용되지 않은 트리**에 대해 매칭된다. 키 안의 `:hover`는
  자기 자신을 켤 수 없으므로 무의미하다
- **상태별 유니티 기본값(예: `:hover` 배경색)은 넣지 않았다.** 좌표 덤프로는 색을
  측정할 수 없어 증명 수단이 없다. 상태 스타일은 사용자가 USS에 쓴 것만 적용된다

## 버전 의존 (확인 필요)

`gap`, `aspect-ratio`, `linear-gradient()`, `hsl()`, `cubic-bezier()`,
`justify-content: space-evenly`, `background-size`/`position`/`repeat`,
`white-space` 값, `overflow-wrap`/`word-break`
