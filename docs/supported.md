# Support Matrix / 지원 범위

*[English](supported.en.md) · 한국어*

> **기준 Unity 버전: 6.3 LTS.** "USS에 없다"는 판정은 Unity 6.6까지의 공식 USS 속성 참조표 기준이다.
> 6.7(베타)은 지원하지 않는다 — 6.7 LTS가 나오면 다시 판단한다.
> 좌표 정확도의 공개 수치는 6000.0.40f1 측정이고, 6.3 LTS로 다시 잰 결과와 텍스트 코호트는
> [정확도](accuracy.md)에 따로 둔다. 숫자는 그 문서에만 있다.

이 문서는 무엇을 지원하는지와 함께 **각각 어디까지 확인했는지**를 적는다. 근거는 셋으로 나눈다.

- **측정** — Unity에서 직접 덤프하거나 화면을 대조했다 (`tests/golden/unity/`, `tests/layout/unity/`, `tests/text-cohort/unity/`)
- **문서** — Unity 공식 문서나 속성 참조표에서 읽었다. 틀려도 티가 나지 않으므로 측정 전까지는 이렇게 표시한다
- **추론** — 위 둘 없이 이치로 정했다. 등록표(`src/style/registry.ts`)의 `inferred: true` 행이 이것이다

## 등급

- **A** — 그대로 지원
- **B** — 대체 방식으로 근사 지원 (차이가 있음)
- **C** — 미지원. 경고를 남기고 무시
- **D** — 구조 변경 필요

## 상태 표기

- `미구현` — 시작하지 않았다
- `진행 중`
- `코드 작성` — 코드는 있고 Unity와 대조하지 않았다
- `검증됨` — Unity와 대조해 맞았다. 무엇으로 대조했는지 비고에 적는다
- `폴백` — 전용 렌더러 없이 `VisualElement`로 그린다
- `보류` — 이유를 적고 일부러 미뤘다

**`코드 작성`과 `검증됨`은 섞지 않는다.** 골든 케이스는 좌표만 비교하므로, 좌표에 드러나지 않는
것(색·테두리·폰트)은 코드가 아무리 완성돼 보여도 `코드 작성`이다.

그 대조는 Yoga가 낸 좌표까지다. 그려진 DOM이 그 좌표를 재현하는지는 Unity가 아니라 자체 불변식
검사(`tests/render/border-offset.test.ts`)로 본다. 이 구분이 왜 필요한지는 [정확도](accuracy.md)의
"이 수치가 덮는 범위" 참조.

## 컨트롤

| 타입 | 상태 | 비고 |
|---|---|---|
| `VisualElement` | 검증됨 | 골든 케이스 대부분이 이걸로 짜여 있다 (좌표, 측정) |
| `Label` | 검증됨 | 배치는 골든 케이스로, 글자 상자는 텍스트 코호트로 Unity와 대조했다(측정). 높이는 Unity의 FaceInfo 공식, 자간·어간·문단 간격은 Unity 규칙을 따른다 — 아래 "텍스트와 폰트" |
| `Button` | 검증됨 | 골든 케이스 10개 좌표 대조(측정). 라벨은 **가운데 정렬**(육안 대조로 발견). Unity의 **기본 여백 `margin: 1px 3px`**을 적용한다(`src/controls/theme.ts`). `:hover` 등 상태 스타일 해석 지원. 에디터 테마 기준이며 런타임 테마는 0.7.0 |
| `ScrollView` | 검증됨 | **암묵 계층 3층**(`unity-content-and-vertical-scroll-container` → `unity-content-viewport` → `unity-content-container`)을 재현한다. 골든 케이스 4개 좌표 대조(측정). 스크롤바는 **폭(13px)만 예약**하고 그리지 않는다 — 드래그·휠·스크롤 위치는 정지 렌더 범위 밖 |
| `Image` | 검증됨 | 전용 렌더러(`unity-image`). 대표 화면(`inventory`)의 `Image` 6개가 좌표 24값 모두 Unity 6000.0.40f1과 같고(측정), 기본 스케일 모드 `stretch-to-fill`은 육안 대조로 확인했다([육안 대조](visual-check.md) 5번). 그림은 USS `background-image`로 들어온다 — C#에서 할당한 텍스처는 미리보기가 따라갈 경로가 없다 |
| `TextField` | 폴백 | `text`·`label`이 그려지지 않는다 |
| `Toggle` | 폴백 | 위와 같다 |
| `Slider` / `SliderInt` | 폴백 | 위와 같다 |
| `Foldout` | 폴백 | 위와 같다 |
| `DropdownField` | 폴백 | 위와 같다 |
| `ListView` | 폴백 | 미정 |

> **전용 렌더러가 없는 컨트롤은 `VisualElement`처럼 그려진다** (`폴백`).
> 자기 스타일과 자식은 정상적으로 나오고, 그 컨트롤 고유의 모양(스크롤바, 입력 필드,
> 암묵적 자식 계층)만 빠진다. 요소마다 경고가 한 건 남는다.
>
> 하위 트리를 통째로 버리던 v0.1 동작을 뒤집은 것이다. 미지원 컨트롤 하나에 화면
> 절반이 사라지는 것은 "지원 범위"가 아니라 고장이고, 그런 화면은 무엇이 맞고 무엇이
> 틀린지 판단할 근거조차 주지 않는다.
>
> 파싱은 어느 쪽이든 성공하며, 왕복 시 유실되지 않는다.

컨트롤 전용 렌더러를 늘리는 일과 런타임 테마 선택은 0.7.0 범위다.

## Template / Instance

| 요소 | 상태 | 비고 |
|---|---|---|
| `<ui:Template name="…" src="…">` | 검증됨 | 선언을 읽고 `resolveImport(url, from)`을 재사용해 상대 경로를 해석한다. `project://…` 및 `/…`는 프로젝트 루트 기준이다 |
| `<ui:Instance template="…">` | 검증됨 | 전개 시 불투명한 `TemplateContainer`를 만들고, Instance의 `name`·`class`·인라인 `style`을 그 컨테이너에 붙인다. 중첩 전개 상한은 32(`TEMPLATE_DEPTH_LIMIT`)다. 템플릿 내부 `Style`은 해당 컨테이너 하위로만 스코프된다 |
| `<AttributeOverrides>` | 검증됨 | `element-name`이 같은 **모든** 중복 대상의 일반 속성을 덮어쓴다. 없는 대상은 `override-target-missing`으로 실제 이름 목록과 함께 진단한다. `style` override는 `override-style-ignored`로 보고하고 적용하지 않는다 — Unity가 import에서 무시하는 동작(측정)이며 미리보기의 한계가 아니다 |
| 순환 템플릿 | 미구현 | 전개하지 않고 fail-closed로 차단하며 경로 전체를 `template-cycle`로 보고한다 |
| 슬롯 | 보류 | 6000.0.40f1에서 살아 있음을 실측했다. 슬롯 자식은 배치하지 않고 `template-slot-unsupported`로 보고한다 |

템플릿 `src`의 `Packages/...`는 선언 파일 기준 상대 경로로 처리되어 측정 케이스에서
실패한다. `<projectRoot>/Packages/<name>/`에 실물 디렉터리가 있는 embedded package의
UXML은 `project://database/Packages/...`로 해석된다(Unity 6000.0.40f1 측정).
코어와 호스트는 `Library/PackageCache`를 탐색하지 않는다. 그 경로에만 있는
레지스트리 패키지의 템플릿은 `package-path-not-searched`로 보고된다.

`collectDependencies(source)`로 템플릿 선언의 의존 URL을 소스 순서대로 미리 수집할 수 있다.
외부 표본 14개 문서 중 `<ui:Template>`을 쓰는 것은 1개뿐이다 — 템플릿 지원의 근거는 그 표본이
아니라 위 측정 케이스다.

이 범위에는 런타임 `binding-path`, C# `makeItem`이 정하는 `ListView`/`TreeView`
아이템 템플릿, 인스턴스별 개별 pseudo-state, 순환을 잘라 일부만 그리는 동작이
포함되지 않는다. 템플릿 편집·자동 추출·UI Builder 재현도 뷰어 코어의 비목표다.

## USS 속성

**`검증됨`은 Unity와 대조해 맞은 것만이다.** 무엇으로 대조했는지(좌표 골든 케이스, 텍스트 코호트,
값 프로브, 육안 대조)를 비고에 적는다. 속성의 존재·상속·도입 버전은 등록표
`src/style/registry.ts`가 유일한 출처다.

| 속성군 | 등급 | 상태 | 비고 |
|---|---|---|---|
| flex 계열 | A | 검증됨 | `flex-direction` 기본값 `column`, `flex-shrink` 기본값 `1` (좌표) |
| width/height/min/max | A | 검증됨 | min/max 충돌 우선순위 포함 (좌표) |
| margin / padding | A | 검증됨 | margin 상쇄 없음 (좌표) |
| position / top·left·right·bottom | A | 검증됨 | 중첩 absolute 포함 (좌표). `fixed`·`sticky`는 C |
| 박스 모델 (border-box) | A | 검증됨 | width에 padding·border 포함 (좌표) |
| `%` 크기 | A | **부분** | 부모 크기가 확정된 경우만 일치. 미확정 시 불일치 — [정확도](accuracy.md)의 알려진 불일치 |
| `aspect-ratio` (6.3+) | A | 검증됨 | Yoga에 넘겨 배치한다. 6000.3.25f1 프로브와 대조(`aspect2.json`, 측정) |
| `justify-content: space-evenly` | A | 검증됨 | 두 버전에서 동작한다(값 프로브, 측정) |
| background-color | A | 코드 작성 | 좌표 비교 대상 아님. 대표 화면 육안 대조에서 일치 |
| border-width / color / radius | A | 코드 작성 | width는 레이아웃으로 검증됨. `border-style`은 실선만 |
| opacity / visibility | A | 코드 작성 | `opacity: 50%`는 Unity가 50(불투명)으로 읽는다(측정) — 경고 `invalid-value` |
| color / font-size | A | 코드 작성 | font-size 상속은 캐스케이드 테스트로 확인 |
| `letter-spacing` / `word-spacing` | A | 검증됨 | 값은 CSS px가 아니라 **값 × 글자 크기 / 100**이다. 측정과 그리기 모두 이 규칙(간격 프로브, 측정). 아래 "텍스트와 폰트" |
| `-unity-paragraph-spacing` | A | 검증됨 | 측정과 그리기에 반영(간격 프로브, 측정) |
| `-unity-text-generator` | A | 검증됨 | `standard`와 `advanced`의 간격 규칙 차이를 측정·그리기에 반영(측정) |
| `white-space` | A | **부분** | 공백 처리는 측정했다(아래). `pre`의 줄바꿈은 Unity와 다르다 — Unity는 `pre`도 폭에 맞춰 줄을 바꾸고(측정) 미리보기는 바꾸지 않는다 |
| `-unity-font-definition` | B | 검증됨 | 호스트가 `resolveFont` 훅으로 폰트를 넘기면 그 폰트로 재고 그린다(텍스트 코호트, 측정). 훅이 없거나 `null`이면 경고하고 브라우저 기본 폰트를 쓴다 |
| `-unity-font` | B | 코드 작성 | `-unity-font-definition`과의 우선순위는 Unity 문서를 따랐다(문서). 단독 측정은 안 했다 |
| `-unity-font-style` | B | 코드 작성 | |
| `-unity-text-align` | B | 코드 작성 | 세로+가로 조합 |
| `-unity-background-scale-mode` | A | **기본값 검증됨** | `stretch-to-fill`→`100% 100%`, `scale-and-crop`→`cover`, `scale-to-fit`→`contain`. 기본값은 육안 대조로 확인([육안 대조](visual-check.md)). 나머지 두 값은 대표 화면에 없어 **개별 미확인** |
| translate / scale / rotate | A | 코드 작성 | |
| background-image | A | 코드 작성 | `url()`/`resource()` 형식을 리졸버에 구분해 전달. `resource()`는 Resources 검색이며 에디터 내장 리소스는 디스크 호스트가 풀 수 없다; 실패 시 플레이스홀더. Unity 측정은 [정확도](accuracy.md) |
| `var()` 커스텀 속성 | A | 코드 작성 | 캐스케이드 테스트로 확인, Unity 대조는 안 함 |
| `-unity-slice-*` | A | 미구현 | 경고 `not-rendered` |
| `-unity-background-image-tint-color` | A | 미구현 | CSS 대응이 없어 경고 `not-rendered` |
| `-unity-text-outline-*`, `text-shadow` | B | 미구현 | 경고 `not-rendered`. 둘 다 그림만 바꾸고 상자는 바꾸지 않는다(측정) |
| `-unity-text-auto-size` (6.3+) | A | 미구현 | 경고 `not-rendered`. Unity에서는 **상자 크기가 바뀐다**(6000.3.25f1에서 32×15 → 99×49, 측정) — 이 속성을 쓴 화면의 좌표는 Unity와 다르다 |
| transition | A | 미구현 | 값을 전개하지 않고 통째로 둔다. 정지 화면이라 그릴 것이 없다 |

## 텍스트와 폰트

0.6.0부터 글자 상자를 Unity 규칙으로 잰다. 근거는 모두 Unity 덤프다(`tests/layout/unity/`,
`tests/text-cohort/unity/`, 6000.0.40f1·6000.3.25f1).

- **높이** — `ceil(줄 수 × 글자 크기 × (ascent − descent) / pointSize)`. 계수는 Unity가 그 폰트에
  대해 보고한 FaceInfo다(맞춘 값이 아니다). 기본 폰트(에디터의 Inter)는 12px → 15, 20px → 25.
  여러 줄은 줄마다가 아니라 묶음 전체를 한 번 올림한다(1~4줄 × 다섯 크기, 두 버전 모두 일치).
  6000.0은 둘째 줄부터 다르게 계산하지만 기준 버전(6.3)을 따른다
- **간격** — `letter-spacing`·`word-spacing`은 값 × 글자 크기 / 100. 기본 생성기(`advanced`)는
  공백 옆과 마지막 글자 뒤에 자간을 두지 않는다. 그리는 쪽도 같은 규칙이라 그린 글자가 잰 상자에
  맞는다(실제 브라우저 대조, `tests/text-cohort/paint.mjs`)
- **공백** — 6.3은 `normal`·`nowrap`에서 연속 공백을 하나로 접고 앞 공백을 버리며, `pre`·`pre-wrap`은
  그대로 둔다(측정). 6000.0은 접지 않는다. 미리보기는 6.3을 따른다. **끝 공백은 측정하지 않았다**
- **폰트** — `-unity-font-definition`의 경로를 호스트가 `resolveFont(path, form)`로 풀어 준다. 반환은
  폰트 패밀리 이름, 또는 `{ family, faceInfo }`(FaceInfo를 주면 높이가 Unity와 같아진다), 또는 `null`.
  자세한 것은 [API](api.md)
- **대체 폰트** — 폰트를 지정하지 않은 글자에 한글·한자·가나가 있으면 경고 `font-fallback`을 낸다.
  기본 폰트 Inter에 그 글자가 없어서 Unity가 대체 폰트로 그리고, 그 상자가 1~4px 더 높게 측정됐다.
  **사용자 폰트에 없는 글자는 확인하지 않는다** — 폰트 파일의 글자 범위를 읽지 않기 때문이다
- 텍스트 외곽선·그림자는 그리지 않는다

텍스트 코호트의 수치와 실패 분류는 [정확도](accuracy.md)에 있다.

## 미지원 (C)

`display: block/inline/inline-block`, `display: grid`, `position: fixed/sticky`,
`float`, `clear`, `z-index`, `box-shadow`, `gap`/`row-gap`/`column-gap`,
`overflow-wrap`, `word-break`, `mix-blend-mode`, `clip-path`, `mask`, `outline`,
`line-height`, `text-transform`, `text-decoration`, 다중 배경, `transform: skew()`,
3D 트랜스폼, `@keyframes`, `linear-gradient()`

모두 경고 `not-uss`로 보고한다. `z-index`가 없으므로 겹침 순서는 형제 순서로 정해진다 — 옮길 때는
마크업 순서를 바꿔야 한다(이식 관점의 등급은 D, [USS 참조표](uss-reference.md)).
`linear-gradient()`를 쓰면 Unity는 경고 아이콘을 그린다(측정).

단위: `em` `rem` `vh` `vw` `vmin` `vmax` `pt` `cm` `in` `calc()`

셀렉터: 형제(`+`, `~`), `:nth-child`, `:first/last-child`, `:not()`, `:has()`,
속성 셀렉터, `::before`/`::after`, `@media`, `:selected` 등 Unity가 설정하지 않는 의사 클래스

> 미지원 셀렉터 조각이 하나라도 든 규칙은 **통째로** 버리고, 그 조각을 짚는 경고를 한 번 남긴다.
> 파서는 규칙을 그대로 보관하므로 왕복에서 유실되지 않는다.

USS 속성이지만 이 미리보기가 그리지 않는 것(경고 `not-rendered`)은 등록표의 `handling: 'none'` 행이다:
`text-shadow`, 트랜지션, `-unity-text-outline*`, 9-slice, `-unity-text-auto-size`, `filter`(6.3+),
`-unity-material`(6.3+), `backdrop-filter`(6.6+) 등. 그중 Unity에서 상자를 바꾸는 것은 경고에
`affectsLayout: true`가 붙는다.

## Unity가 적용하지 못하는 값

0.6.0에서 Unity 6000.0.40f1·6000.3.25f1에 직접 넣어 본 값들이다(값 프로브, 측정). 미리보기는
작성자가 뜻한 대로 그리고 경고로 알린다.

| 값 | Unity에서 | 경고 |
|---|---|---|
| `hsl()` 색 | 6.3: 그 요소와 **그 뒤의 모든 요소**가 스타일을 잃는다. 6000.0: 검정으로 그린다 | `invalid-value`, `unityEffect: unstyled-from-here` |
| `cubic-bezier()` | 두 버전 모두 그 요소부터 뒤가 스타일을 잃는다 | `invalid-value`, `unityEffect: unstyled-from-here` |
| `filter` | 6000.0에는 없는 속성이라 그 요소부터 뒤가 스타일을 잃는다. 6.3에서는 정상 | `not-rendered`, `unityEffect`(6000.0) |
| 인라인 `style`의 단위 오류 하나 | 그 파일의 인라인 스타일 전부를 버린다 | `unityEffect: file-inline-dropped` |
| `opacity: 50%` | 50으로 읽어 불투명 | `invalid-value` |
| `inherit` | 투명으로 읽는다 | `invalid-value` |
| `linear-gradient()` | 경고 아이콘을 그린다 | `not-uss` |

`white-space` 값 자체의 버전 차이는 아직 판정하지 않았다.

## pseudo-class 상태

`:hover` `:active` `:inactive` `:focus` `:disabled` `:enabled` `:checked`(`USS_STATES`)의
**스타일 해석**을 지원한다. 상태는 마우스 이벤트가 아니라 **명시적 입력**으로 받는다:

```ts
render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } });
```

키는 USS 셀렉터이고 요소마다 다른 상태를 줄 수 있다. 실제 화면은 한 버튼이 hover인
동시에 다른 버튼이 disabled인 경우가 보통이기 때문이다.

- 마우스로 상태가 바뀌지 않는다. 같은 호출은 항상 같은 그림을 그린다 —
  그래야 Unity와도, 어제 결과와도 비교할 수 있다
- 키는 **상태가 하나도 적용되지 않은 트리**에 대해 매칭된다. 키 안의 `:hover`는
  자기 자신을 켤 수 없으므로 무의미하다. 매칭되는 요소가 없는 키, 상태가 든 키, Unity가 쓰지 않는
  상태 이름은 경고한다
- **`:enabled`는 비활성이 아닌 모든 요소에 자동으로 적용된다** — Unity가 그렇게 한다(6000.0.40f1·
  6000.3.25f1 측정)
- **상태별 Unity 기본값(예: `:hover` 배경색)은 넣지 않았다.** 좌표 덤프로는 색을 측정할 수 없어
  증명 수단이 없다. 상태 스타일은 사용자가 USS에 쓴 것만 적용된다
- **중첩 비활성은 Unity와 다르다.** Unity는 `enabled="false"`를 쓴 요소만 불투명도 0.5로 흐리고 자손은
  그대로 둔다(측정). 미리보기는 자손까지 겹쳐 0.25가 된다. 0.7.0 테마 작업에서 고친다

`:selected`는 상태 목록에 없다. Unity 문서가 USS 미지원이라 적기 때문이다(`:checked`를 쓴다).

`:root`는 버전 문제가 아니다. USS `:root`는 CSS처럼 문서 루트가 아니라 스타일시트가 붙은 요소를
가리킨다. 붙을 UIDocument가 없으므로 미리보기는 `<ui:UXML>`에 매칭하고, 그 사실을 `matches-unity`
경고로 한 번 알린다.

## 버전

속성의 도입 버전은 `src/style/registry.ts`가 Unity 공식표에서 옮긴 값이다.

- 6.3+: `aspect-ratio`, `filter`, `-unity-material`, `-unity-text-auto-size`
- 6.6+: `backdrop-filter`, `animation-play-state`, `-unity-animation-clip`

이 중 `aspect-ratio`만 배치하고 나머지는 그리지 않는다. 그리지 않는 속성의 경고에는
`subject.since`(예: `6000.3`)가 붙는다.

## 경고

경고의 구조(`kind`, `reason`, `subject`, `nodes`, `at`)와 소비자가 읽는 법은 [API](api.md#경고)에 있다.

## 확인하지 않은 것

- 색·테두리·모서리는 대표 화면 하나의 육안 대조에 기대고 있다([육안 대조](visual-check.md)). 그 화면에
  없던 것은 측정하지 않았다
- 줄바꿈된 `ScrollView`의 콘텐츠 높이가 다르다. Unity는 뷰포트에 맞춰 자르고 Yoga는 내용만큼 키운다.
  Unity의 규칙은 아직 찾지 못했다
- 스크롤바는 폭만 예약하고 그리지 않으며, 아무것도 스크롤되지 않는다
- 런타임 테마(PanelSettings)는 대조하지 않았다. 모든 기준값은 에디터 테마다
