# Support Matrix / 지원 범위

Phase가 진행되면서 갱신한다. 상세 매핑은 `uss-reference.md` 참조.

## 등급

- **A** — 그대로 지원
- **B** — 대체 방식으로 근사 지원 (차이가 있음)
- **C** — 미지원. 경고를 남기고 무시
- **D** — 구조 변경 필요

## 컨트롤

| 타입 | v0.1 | 비고 |
|---|---|---|
| `VisualElement` | ⬜ | |
| `Label` | ⬜ | |
| `Button` | ⬜ | |
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

| 속성군 | 등급 | 상태 | 비고 |
|---|---|---|---|
| flex 계열 | A | ⬜ | `flex-direction` 기본값 `column` 주의 |
| width/height/min/max | A | ⬜ | |
| margin / padding | A | ⬜ | margin 상쇄 없음 |
| position / top·left·right·bottom | A | ⬜ | `fixed`·`sticky`는 C |
| background-color | A | ⬜ | |
| border-width / color / radius | A | ⬜ | `border-style`은 실선만 |
| opacity / visibility | A | ⬜ | 체감 동작 차이 검증 필요 |
| color / font-size | A | ⬜ | |
| `-unity-font-definition` | B | ⬜ | 에셋 리졸버 경유 |
| `-unity-font-style` | B | ⬜ | |
| `-unity-text-align` | B | ⬜ | 세로+가로 조합 |
| `-unity-slice-*` | A | ⬜ | 9-slice |
| `-unity-background-image-tint-color` | A | ⬜ | |
| `-unity-text-outline-*` | B | ⬜ | |
| translate / scale / rotate | A | ⬜ | |
| transition | A | ⬜ | |
| background-image | A | ⬜ | 에셋 리졸버 필요 |
| `var()` 커스텀 속성 | A | ⬜ | |

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
