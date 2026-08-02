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

| 타입 | v0.1 | 비고 |
|---|---|---|
| `VisualElement` | 검증됨 | 골든 케이스 대부분이 이걸로 짜여 있다 |
| `Label` | 코드 작성 | 레이아웃은 검증됨. **텍스트 측정은 유니티와 대조하지 않았다** |
| `Button` | 코드 작성 | **골든 케이스에 없다.** 렌더링은 `Label`과 같은 경로. `:hover`는 Phase 7 |
| `ScrollView` | — | Phase 7 |
| `TextField` | — | Phase 7 |
| `Toggle` | — | Phase 7 |
| `Slider` / `SliderInt` | — | Phase 7 |
| `Foldout` | — | Phase 7 |
| `DropdownField` | — | Phase 7 |
| `ListView` | — | 미정 |
| `Image` | — | Phase 7 |

> 미지원 컨트롤을 만나도 파싱은 성공한다. "미지원"으로 표시된 채 트리에 유지되며,
> 렌더링에서 제외되고 경고 목록에 담긴다. 왕복 시 유실되지 않는다.

## USS 속성

**`검증됨`은 유니티 6000.0.40f1과 좌표를 대조해 일치한 것만이다** (`docs/accuracy.md`).
골든 케이스가 좌표만 비교하므로, 색·테두리 같은 시각 속성은 코드가 있어도 `코드 작성`이다.

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

## 버전 의존 (확인 필요)

`gap`, `aspect-ratio`, `linear-gradient()`, `hsl()`, `cubic-bezier()`,
`justify-content: space-evenly`, `background-size`/`position`/`repeat`,
`white-space` 값, `overflow-wrap`/`word-break`
