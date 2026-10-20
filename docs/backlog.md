# Backlog

v0.1 스코프 밖으로 밀린 것들. 지금 하지 않는다.

형식:
```
- [Phase N] 항목 — 왜 미뤘는지 (기록일)
```

---

- [Phase 7] ScrollView 지원 — v0.1은 컨트롤 3종 고정 (2026-08-02)
- [Phase 7] TextField / Toggle / Slider / Foldout / DropdownField — 동일 (2026-08-02)
- ~~[Phase 7] `<ui:Template>` / `<ui:Instance>` 전개~~ — **0.5.0에서 완료·대체됨.**
  남은 경계와 미측정 항목은 아래 R1 목록으로 이동했다 (2026-08-25)
- [Phase 8] 엘리먼트 선택 및 속성 편집 — 렌더링 검증 후 (2026-08-02)
- [Phase 9] Open Design 플러그인화 — v0.1 공개 후 (2026-08-02)
- [미정] Unity 배치모드 골든 이미지 자동 촬영 — 케이스 30개는 수동이 빠름 (2026-08-02)
- [미정] 유니티 버전별 호환성 매트릭스 — Unity 6 계열 먼저 (2026-08-02)
- ~~[Phase 7] 미지원 컨트롤을 일반 `VisualElement`처럼 그리기~~ — **S1 Step 1에서 완료**
  (2026-08-05). 폴백이 기본 경로가 되도록 `resolveControl`이 `null`을 반환하지 않게 바꿨다 (2026-08-02)
- [Phase 8] `Attribute`에 `dirty` 추가 — 속성 하나를 고치면 그 태그의 속성이 전부
  재생성되어 여러 줄 속성이 접힌다. 자식에 쓴 간격 슬라이스를 속성에도 적용하면 된다 (2026-08-02)
- [Phase 8] 간격을 형제로 승격 — `childrenDirty`가 켜지면 자식 사이 주석이 사라진다.
  구조 변경이라 편집 UI와 함께 설계한다 (2026-08-02)
- ~~[Phase 6+] `Button` 골든 케이스 추가~~ — **케이스 6개 작성됨 (S1 Step 2, 2026-08-05).**
  남은 것은 유니티 대조다. `pnpm golden:emit` 후 `tools/UxmlLayoutDump.cs`를 돌리면
  `UNMEASURED against Unity` 목록에서 5개가 빠진다 (2026-08-02)
- [S1 Step 6] **유니티 기본 테마 USS의 컨트롤별 기본 여백** — `Button` 케이스가 대조되면
  가장 먼저 터질 후보다. 유니티는 테마 USS로 `Button`에 기본 `margin`/`padding`/`border`를
  주는데 이 렌더러는 아무것도 주지 않는다. 근거는 `needle-mirror/com.unity.ui` (2026-08-05)
- ~~[Phase 6+] 시각 속성 대조 — `pixelmatch`·`pngjs`~~ — **자동 픽셀 diff는 하지 않기로 했다**
  (2026-08-05 결정 기록). 대신 CSS 선언 골든(`tests/render/visual.test.ts`, S1 Step 2 완료) +
  Step 6의 1회 육안 대조 기록. `pixelmatch`·`pngjs`는 devDeps에 남아 있으나 미사용 (2026-08-02)
- [미정] 텍스트 측정을 유니티와 맞추기 — 행 높이 `font-size * 1.2`는 추측이다.
  유니티 폰트 에셋의 메트릭을 알아야 하고, 그건 케이스 세트와 다른 종류의 작업이다 (2026-08-02)
- [Phase 7] `VAR_PATTERN`을 괄호 짝맞춤 스캐너로 교체 — fallback 그룹이 `[^)]*`라
  `var(--a, var(--b))`를 한 번에 못 읽는다. 치환 루프가 두 바퀴 돌면서 결과적으로
  맞고 테스트로 고정해뒀지만, **맞는 이유가 패턴이 옳아서가 아니다** (2026-08-03)
- [Phase 8] 상속 `StyleOrigin`이 깊이만큼 중첩된다 (`inherited → inherited → …`).
  동작에는 문제가 없고, 편집 UI에서 출처 체인을 거슬러 올라갈 때 성가시다.
  최종 출처를 평탄화해 함께 들고 있는 편이 낫다 (2026-08-03)
- [S1 이후] 대표 화면이 **줄바꿈 경계에 앉아 있다** — 슬롯 92px가 뷰포트 안쪽 371px에
  4개(368px) 들어가서 여유가 3px뿐이다. 캔버스나 스크롤바 폭이 4px만 달라도 4+2가
  3+3으로 바뀐다. 좌표 대조는 덤프가 하므로 문제없지만 **시각 대조용으로는 부서지기
  쉽다.** 슬롯 폭을 줄이거나 패널을 넓혀 여유를 두는 편이 낫다 (2026-08-06)
- [S1 이후] 기존 유니티 기준값이 **중복 키를 가진 채 저장돼 있다** — 덤퍼에 접미사
  규약을 넣기 전에 뜬 것이라 `unity-dragger` 등 스크롤바 파트 7종이 두 번씩 나오고
  `JSON.parse`가 마지막(가로, 0×0)만 남긴다. 비교에서는 `NOT_REPRODUCED`라 영향이
  없지만, **실제로 이걸 세로 스크롤바가 숨겨진 것으로 오독한 적이 있다.**
  다음 덤프 라운드에서 깨끗하게 다시 받는다 (2026-08-06)
- [S2] `<Style src>`를 **직렬화 쪽에서도** 쓴다 — 읽기는 지원됐으므로, 생성한 파일에
  써넣으면 산출물이 자기완결이 된다. 없으면 유니티 개발자가 UI Builder로 열었을 때
  스타일 없는 화면을 보게 된다 (2026-08-06)
- [S1 직후] **상태 규칙이 명시도를 이긴다** — 대표 화면 픽셀 측정으로 확인됐다.
  유니티는 `Button:disabled`(0,1,1)를 `#DropButton`(1,0,0)보다 우선한다. CSS라면
  ID가 이긴다. 우리 캐스케이드에는 이 축이 없어서 비활성 버튼이 활성과 똑같이 보인다.
  **규칙의 범위를 모른다** — 인라인까지 이기는지, 상태끼리는 어떻게 되는지.
  `state-vs-id`·`state-vs-inline` 케이스가 좌표로 판정한다 (2026-08-06)
- [S1 직후] **중첩 비활성의 불투명도가 곱해진다** — 유니티는 비활성 요소를
  `opacity: 0.5`로 그린다(대표 화면 픽셀 측정: 배경 3채널 정확 일치). 그런데
  `enabled="false"`는 하위 트리 전체를 `:disabled`로 만들므로 우리 테마 규칙이
  각 층에 걸리고 CSS가 곱해서 0.25가 된다. **유니티는 한 번만 흐리게 할 것이 거의
  확실하지만 측정하지 않았다.** 고치는 방법에 선택지가 있어(선언한 요소에만 걸기 /
  상속된 것은 억제) 근거 없이 고르지 않았다. 불투명도는 좌표 덤프에 안 나오므로
  중첩 케이스 스크린샷이 필요하다. `visual-nested-disabled`가 현재 값을 고정해둔다 (2026-08-06)

## 0.5.0 R1 — Template / Instance 후속 항목

0.5.0에서 고치지 않고, 근거와 함께 다음 트랙으로 이월한다.

- [R1 / MINOR] `unsupported-control`에 `sourceDocument` 없음 — 여러 문서가 전개된
  트리에서 어느 파일의 `Toggle`인지 찾을 수 없다. 클론 노드에는 이미 provenance가
  있으므로 진단에도 전달한다 (2026-08-25).
- [R1 / MINOR] sibling prefetch 상한 16 vs 코어 깊이 32 — 16단을 넘는 URL은
  `unresolved`에도 남지 않아 파일 미발견으로 위장할 수 있다. 실무 템플릿에서는
  드물지만 상한을 맞춘다 (2026-08-25).
- [R1 / MINOR] `WarningKindMap<T>` 소비자 부재 — sibling은 `switch` + `assertNever`로
  exhaustive하지만 다른 소비자가 맵을 사용하지 않으면 17번째 진단이 조용히 빠질 수
  있다. 실제 소비자 채택을 추가한다 (2026-08-25).
- [R1 / NOTE · 중요] C7 동률 명시도에서 부모 시트와 템플릿 시트의 우선순위 —
  현재 `styleRoots` 뒤에 템플릿 시트를 붙여 템플릿이 이긴다. G3-6에서만 Unity와
  일치했고 동률 규칙은 미측정이다. 좌표가 아니라 색·패딩이 조용히 뒤집힐 수 있다
  (2026-08-25).
- [R1 / MINOR] 순환 정체성이 `(name, src 철자, from)` — `a.uxml`과 `./a.uxml`이
  달라 한 바퀴 더 돌 수 있다. 깊이 32의 유계 fail-closed는 유지된다 (2026-08-25).
- [R1 / NOTE] `collectDependencies`가 루트 직계 `<Template>`만 수집 — 중첩된
  VisualElement 안의 선언은 `[]`가 된다. Unity 관행상 선언이 루트에 있어 실무 타격은
  작지만, 문서화·추후 확장이 필요하다 (2026-08-25).
- [R1 / NOTE] 템플릿 파일 rename 후 새 경로 미감시 — VS Code 실기에서 rename만
  하면 기존 `src`는 unresolved로 남았다. 엔트리의 `src`를 새 이름으로 고치면 즉시
  다시 그리고, 그 뒤 새 템플릿 파일 수정도 감시했다 (2026-08-25).
- [R1 / 중요] 외부 14개 표본에 템플릿이 사실상 없음 — `<ui:Template>`을 쓰는 문서는
  1개뿐이다. 외부 표본의 템플릿 기능 검증 근거가 거의 없으므로 다음 트랙에서
  실제 템플릿 화면 표본을 추가한다 (2026-08-25).
- [R1 / 중요] 레지스트리 패키지의 template `src` 해석 —
  `Library/PackageCache`에만 있는 입력은 프리뷰에서 `template-src-unresolved`와
  `package-path-not-searched`로 실패함을 확인했다. 같은 입력의 Unity 동작은
  미측정이며 X3의 남은 절반이다 (2026-08-25).
- [R1 / NOTE] 1차 반례 27개 중 24개를 정규 코어 회귀망으로 승격하지 않았다 —
  `review/g3-adversarial`을 참조한다. 디스크 CRLF 스캔은 아직 어디서도 자동화하지
  않는다. 외부 14개 byte roundtrip은 현재 sibling 재관찰 테스트에만 있으며,
  나머지 반례와 함께 장기 회귀망으로 옮길지 다음 트랙에서 결정한다 (2026-08-25).

## 0.6.0 — 0.5.1이 넘긴 항목

> **2026-10-16, 0.6.0에서 처리(release/0.6.0):** `:enabled` 자동 적용, `states` 키 경고 3종, 값 수준
> 판정(`hsl()`·`cubic-bezier()`·`space-evenly`·`opacity %`·`inherit`·`linear-gradient()`; `cursor` 값은 아님),
> `letter-spacing`/`word-spacing` 측정, 선언 단위 경고의 요소 목록(`nodes`), 6.3 LTS 측정 문항 중
> 텍스트·효과 계열(등록표 `inferred` 해제). 남은 것: `unsupported-unit` 종류(여전히 발생 지점 없음),
> `background-position-x/-y` 그리기, `-unity-font` 단독 측정, `transition`/6.6 전용 속성, `white-space` 값.
> 아래 원문은 기록으로 남긴다.
>
> **2026-10-16, 적대적 검증에서 남긴 것:**
> - 사용자 폰트의 글자 범위 확인 — 0.6.0은 기본 폰트(Inter)의 한글·한자·가나만 경고한다. 사용자 폰트에
>   없는 글자는 Unity가 대체 폰트로 그리지만 이 미리보기는 모른다
> - 중첩 비활성의 투명도 — **0.7.0(컨트롤·테마)으로 옮겼다**, 아래 0.7.0 절
> - Label `flex-shrink: 0` — 0.7.0 절로 옮겼다
> - 공백 접기 — 6.3은 연속 공백을 접고 앞 공백을 버린다(`spaces.json`). 6000.0은 접지 않는다. 미리보기는 6.3을 따른다.
>   `pre-wrap`은 `pre`처럼 공백을 둔다(`spaces-prewrap.json`, 측정 후 측정기 수정). 끝 공백은 미측정
> - `white-space: pre`의 줄바꿈 — **측정됨**(`te-wrap.json`, 두 버전): Unity는 `pre`도 폭에 맞춰 줄을 바꾼다
>   (60px 상자에서 `normal`·`pre`·`pre-wrap` 모두 두 줄, `nowrap`만 한 줄). 미리보기는 측정·그리기 모두 CSS처럼
>   `pre`를 줄바꿈하지 않는다 — 둘은 서로 맞지만 Unity와 다르다. 고치면 측정과 그리기를 함께 바꿔야 한다

0.5.1의 원칙은 "그려지는 결과는 바꾸지 않고, 말하지 않던 것을 말하게 한다"였다.
아래는 그 범위를 넘거나 값 수준 판정이 필요해서 넘긴 것이다 (2026-10-13).

- [0.6.0] `:enabled` 자동 적용 — Unity 문서상 활성 요소는 모두 `:enabled`인데,
  지금은 `states`로 넘겨야만 켜진다. 켜면 `:enabled` 규칙을 쓴 화면의 그림이 바뀐다
- [0.6.0] `states` 키가 아무 요소에도 매칭되지 않거나 키 안에 상태 의사 클래스가
  있을 때 경고. `states` 값에 `USS_STATES` 밖의 이름이 있을 때 경고
- [0.6.0] `unsupported-unit` — `WarningKind`에 있지만 발생 지점이 없다. 단위 문제는
  `unsupported-property`로 나간다. 쓸지, 문서상 폐기할지 결정
- [0.6.0] 값 수준 판정 — `hsl()`, `cubic-bezier()`, `justify-content: space-evenly`,
  `linear-gradient()`(Unity 6.x 지원 여부 미확인; 0.5.1은 `not-uss`로 보고),
  `opacity: 50%`, `inherit` 키워드, USS 전용 `cursor` 값(`link`, `resource()`)이
  브라우저에서 조용히 버려지는 것
- [0.6.0] `letter-spacing`/`word-spacing`이 그려지지만 글자 측정에 들어가지 않음
- [0.6.0] `background-position-x/-y` 그리기, scale-mode와 `background-*`를 함께 쓸 때
  어느 쪽이 이기는지 — 육안 대조 필요 (docs/visual-check.md)
- [0.6.0] **선언 단위 경고가 영향받는 요소를 잃었다.** 0.5.0 대비 차등 검사
  (`tests/regression/warning-diff.test.ts`)에서 병합된 776건 중 515건은 0.5.1 경고가
  요소를 하나도 가리키지 않고(규칙 선언 경고는 `at`만 있음), 261건은 첫 요소 하나만
  가리킨다(값 수준 경고를 선언당 하나로 합칠 때). 소비자가 "어떤 요소가 영향을 받는가"를
  알 수 없다. 후보: `Warning`에 `nodes?: NodeId[]`를 더하거나, 요소별 조회 API

- [0.6.0] **6.3 LTS 코호트 측정 문항 — 등록표 `unity` 열의 추론 판정 28개 전부.**
  `inferred: true`인 행은 문서나 측정이 아니라 추론이다. 6.3 LTS 덤프로 판정하고, 판정이 끝난
  행은 `inferred`를 내린다. 텍스트 측정 계열이 가장 급하다 — `affectsLayout`이 좌표 신뢰
  여부를 소비자에게 알리는 근거이기 때문이다.
  - 텍스트 측정 (layout 판정): `letter-spacing`, `word-spacing`, `white-space`,
    `-unity-font`, `-unity-font-definition`, `-unity-font-style`, `-unity-paragraph-spacing`,
    `-unity-text-generator` — 자동 크기 Label의 너비·높이가 값에 따라 바뀌는지
  - 텍스트 (paint 판정): `-unity-text-auto-size`(상자가 아니라 글자가 맞춰지는지),
    `text-overflow`, `-unity-text-overflow-position`(말줄임이 상자 크기를 바꾸지 않는지),
    `-unity-editor-text-rendering-mode`, `text-shadow`, `-unity-text-outline`,
    `-unity-text-outline-color`, `-unity-text-outline-width`
  - 클리핑·효과 (paint 판정): `overflow`, `-unity-overflow-clip-box`, `filter`(6.3+),
    `backdrop-filter`(6.6+, 6.3 LTS에는 없음 — 6.6 이상에서만), `-unity-material`(6.3+)
  - 시간 (none 판정, 정지 프레임 기준): `transition`, `transition-delay`,
    `transition-duration`, `transition-property`, `transition-timing-function`,
    `animation-play-state`(6.6+), `-unity-animation-clip`(6.6+)

## 다음 버전(0.8) 후보 — 순서대로

1. **ScrollView 스크롤바 그리기** — 0.7.0은 폭만 확보하고 그리지 않는다(알려진 차이, `docs/supported.md`·`docs/accuracy.md`).
   Unity는 `unity-scroller` 아래에 반복 버튼 둘과 Slider를 만든다(`a2-scrollview` 덤프). 만들면 클래스 테스트의 제외
   (`tests/contract-070/classes.test.ts` 머리말)와 골든의 `NOT_REPRODUCED`를 함께 걷어낸다. 넘칠 때만 보이는 조건부 표시가
   먼저 측정돼 있다(`accuracy.md` ScrollView 절). 2026-10-18 사람 결정

2. **반 픽셀 반올림** — 정렬별(왼쪽·가운데·오른쪽, 빈 공간의 홀짝 나머지) 반올림을 측정한 뒤 결정. Unity는 가운데 정렬된 글을 반 픽셀에서 올리고 미리보기의 Yoga는 글 노드 위치를 내린다(ProgressBar 제목 x 1px, `bundle-f.test.ts` `KNOWN_HALF_PIXEL`). 글 노드 반올림을 바꾸면 모든 글 상자가 움직이므로 측정·예측이 먼저다. 2026-10-20 사람 결정

## 0.7.0 — 컨트롤·테마

- **중첩 비활성의 투명도** — 측정됨(`tests/layout/unity/<version>/probe-editor/nested-disabled.json`, 6000.0.40f1·
  6000.3.25f1, 2026-10-16): Unity는 `enabled="false"`를 쓴 요소에만 `unity-disabled`와 opacity 0.5를 주고, 그 자손은
  1이다. 이 미리보기는 내장 테마의 `:disabled` 규칙으로 0.5를 줘서 자손이 0.25로 겹친다(Unity 0.5, 미리보기 0.25).
  테마 규칙의 문제라 0.7.0 테마 작업에서 고친다. 2026-08-06 항목("측정하지 않았다")은 이것으로 판정됐다
- Label `flex-shrink: 0` — 에디터 테마 값(측정). 넣으면 `inventory`의 `ItemDesc.height`·`y`가 맞는다(+2)
- **2026-10-17 완료(묶음 A, A2)**: 위 두 항목. 비활성은 `.unity-disabled`에만 0.5, Label·Button `flex-shrink: 0`, 에디터 좌표 662/676
- **2026-10-17 정정**: 0.6.0 절의 "`white-space: pre`의 줄바꿈 — Unity는 `pre`도 폭에 맞춰 줄을 바꾼다"는 뒤집혔다. `pre-wrap2`(40px,
  두 버전·두 테마)에서 `pre`는 1줄, `pre-wrap`은 3줄. `te-wrap`은 12px에서 글이 상자에 들어가 구분력이 없었다. 미리보기는 이미 맞다
- **런타임 테마의 금칙**: 런타임 패널은 금칙이 없고 미리보기도 런타임 테마에서는 금칙 없이 그린다(A2). 에디터 테마(6.3)의 금칙은
  알려진 차이로 남는다(`zh` 60px). 에디터 테마 금칙을 재현할지는 측정 범위(어떤 문자 쌍)부터 정해야 한다

- **`:root` 경고에 맞는 kind 신설 — `WarningKind`를 바꿀 수 있는 다음 큰 버전에서**(2026-10-17 결정). 지금은 kind
  `version-dependent`·reason `matches-unity`이고 버전 차이가 아니다. 기존 17종에는 맞는 것이 없다(`unsupported-selector`도
  사실과 다르다 — `:root`는 지원된다). `WarningKind`는 닫힌 집합이라(`WarningKindMap`, vscode `assertNever`) 새 kind는 소비자
  컴파일을 깨므로 메이저에서만. 두 소비자는 reason을 먼저 보므로 그때까지 영향 없음(`docs/api.md` 경고 절)

### 소비자 갱신 — uxml-author가 0.6.0 이상을 받을 때

- **`font-fallback`(0.6.0에 새로 생긴 reason)** — 스킬의 `src/check.js` `classify`는 모르는 `reason`을 `default`로
  `other`에 보내고, `other`는 `judge`에서 `problems`가 되어 **exit 1**이다. 그대로 0.6.0 코어를 묶으면 폰트를
  지정하지 않은 한국어 UXML이 전부 exit 1이 된다. 스킬은 `case 'font-fallback':`을 더해 알림 채널
  (`matchesUnity`처럼 보고만 하는 채널)로 보내고 **exit 코드는 바꾸지 않는다**. exit 3 조건
  (`not-rendered` + `subject.affectsLayout === true`)은 그대로 둔다 — 이 경고는 `affectsLayout: true`를 달지만
  reason이 `not-rendered`가 아니어서 걸리지 않는다. 보고에는 `subject.missingGlyphs`와 "Unity에서 글자 높이가
  1~4px 다를 수 있다"를 함께 적는다. 코어 쪽 고정: `tests/contract-060/review-fixes.test.ts` #4
- `states-key` 경고는 `subject.problem`을 읽는다(0.6.0 D1). `aspect-ratio`는 더 이상 레이아웃 갭 예시가 아니다

## 6.7 LTS 출시 시 재검토

기준 Unity 버전은 6.3 LTS이고, 등록표(`src/style/registry.ts`)는 6.6까지의 공식 표를
담는다. Unity 6.7은 지원하지 않는다. 아래는 **6.7 베타 기준** 관찰이며, 6.7 LTS가 나오면
정식 표로 다시 확인한 뒤 등록할지 정한다 (2026-10-13 결정).

- 출처: <https://docs.unity.com/en-us/engine/6000.7/manual/uitoolkits/uielements/uie-uss/properties/reference>
  (페이지 표기 "Unity 6.7 Beta", 확인 2026-10-13, 126행 — 6.6 표 102행 대비 24개 추가)
- 추가된 24개 (모두 상속 안 됨):
  - 간격: `gap`, `row-gap`, `column-gap`
  - 겹침: `z-index`
  - CSS Grid (설명상 `display: grid`일 때만 적용): `grid-auto-columns`, `grid-auto-flow`,
    `grid-auto-rows`, `grid-column`, `grid-column-end`, `grid-column-start`, `grid-row`,
    `grid-row-end`, `grid-row-start`, `grid-template-columns`, `grid-template-rows`,
    `justify-items`, `justify-self`
  - 애니메이션: `animation`, `animation-delay`, `animation-direction`, `animation-duration`,
    `animation-iteration-count`, `animation-name`
  - 기타: `-unity-curvature`
- 재검토할 때 함께 볼 것
  - 0.5.1은 이 이름들을 `not-uss`로 보고한다. 기준(6.3 LTS)에서는 맞는 판정이다
  - CLAUDE.md의 "`z-index`가 없다", "`display: grid` 없음", "`@keyframes`가 없다" 원칙
    (현재 "Unity 6.6까지" 한정). 렌더러의 겹침 규칙(형제 순서)은 그대로다
  - 그라디언트·그림자·블러는 6.7 베타 표에도 없다. 개발 중이라는 출처는
    "UI Toolkit development status and next milestones – November 2025"
    (<https://discussions.unity.com/t/ui-toolkit-development-status-and-next-milestones-november-2025/1698009>,
    버전 명시 없음)
