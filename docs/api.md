# API

*[English](api.en.md) · 한국어*

`uxml-preview`의 공개 API. 타입 정의(`dist/index.d.ts`)가 원본이고, 이 문서는 그 위에서 알아야 할
것 — 호출 순서, 소유권, 훅이 받는 것, 경고를 읽는 법 — 을 적는다. 무엇을 지원하는지는
[지원 범위](supported.md), 얼마나 맞는지는 [정확도](accuracy.md)에 있다.

## 순서

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();            // 1. 한 번, 처음에. Yoga는 WebAssembly다
const doc = parse(uxml, uss);        // 2. 텍스트 → 모델 (순수)
const view = render(doc, el, opts);  // 3. 모델 → 화면 (el의 자식을 바꾼다)
view.dispose();                      // 4. 다시 그리기 전에 반드시
const out = serialize(doc);          // 텍스트로 되돌리기
```

- `render`는 동기다. 엔진 로드를 밖으로 뺀 덕분이다. `loadLayoutEngine()` 전에 부르면 실패한다
  (`isLayoutEngineReady()`로 확인할 수 있다)
- **`dispose()`는 호출자의 책임이다.** Yoga 노드는 WASM 핸들이라 가비지 컬렉션되지 않는다. 같은
  컨테이너에 다시 그리기 전에 부른다. `liveNodeCount()`로 새는지 볼 수 있다
- 그리려면 DOM이 필요하다(브라우저, 테스트에서는 happy-dom·jsdom). `parse`·`serialize`는 DOM 없이 돈다

## `parse(uxml, uss?, options?)`

UXML과 USS 텍스트를 모델(`UxmlDocument`)로 읽는다. 실패하지 않는다 — 깨진 입력은
`doc.warnings`의 `malformed`가 되고 나머지는 계속 읽는다.

`options.resolveImport(url, from)` — `<Style src="…">`와 `@import`가 가리키는 스타일시트, 그리고
`<ui:Template src="…">`의 문서 텍스트를 호스트가 돌려준다. 못 찾으면 `null`(경고가 남는다).

- `from`은 그 참조를 담은 파일의 URL로, 이 훅이 그 파일을 풀 때 받았던 `url` 그대로다. 진입 UXML의
  참조는 `null`. 상대 `@import`는 이것 없이 풀 수 없다
- 인자 하나짜리 기존 콜백도 그대로 동작한다. 세 번째 인자가 필요해지면 옵션 객체로 바꾸고 메이저를
  올린다
- `collectDependencies(source)`는 템플릿 의존 URL을 소스 순서대로 돌려준다(미리 불러오기용)

## `render(doc, container, options?)`

| 옵션 | 뜻 |
|---|---|
| `theme` | `'runtime'`(기본값, 0.7.0부터) 또는 `'editor'`(어두운 에디터 테마, 662/676 에디터 수치를 잰 테마). 모르는 값은 `malformed`·`invalid-value` 경고 뒤 기본 테마로 그린다. 코어는 패널 뒤를 칠하지 않는다(투명) — 런타임 글자는 어두운 색이라 바탕은 호스트가 정한다 |
| `size` | 패널 크기(px). **창이 아니라 패널이다** — USS의 `%`와 늘이기는 패널 기준이라 창을 따라가면 "1920×1080에서 어떻게 보이나"에 답할 수 없다. 없으면 컨테이너 크기 |
| `resolveAsset(path, form)` | `background-image`의 `url("project://…")`·`resource("…")`를 브라우저가 읽을 URL로. `form`은 `'url'`(경로) 또는 `'resource'`(Unity Resources 이름, 확장자 없음) — 둘을 같은 경로로 풀면 엉뚱한 그림이 조용히 나온다. 에디터 내장 리소스는 디스크 호스트가 풀 수 없으니 `null`을 돌려준다. `null`이면 플레이스홀더를 그리고 경고한다 |
| `resolveFont(path, form)` | `-unity-font-definition`의 폰트를. 폰트 패밀리 이름(문자열), `{ family, faceInfo }`, 또는 `null`. `faceInfo`(Unity가 그 폰트에 보고하는 `pointSize`·`ascentLine`·`descentLine`)를 주면 글자 높이가 Unity 공식과 같아진다. 같은 (path, form)은 한 번의 render에 한 번만 부른다 |
| `measureText(text, context, availableWidth)` | 글자 측정을 바꿔 끼운다. 기본값은 캔버스를 쓰므로 플랫폼·설치 폰트에 따라 움직인다 — 재현 가능한 결과가 필요하면(테스트) 직접 준다. `context`에 글자 크기·스타일·`whiteSpace`·폰트·FaceInfo·간격·생성기가 온다 |
| `states` | 요소별 의사 클래스 상태. `{ '#UseButton': ['hover'] }`. 키는 USS 셀렉터 |
| `activeStates` | 모든 요소에 켤 상태. `new Set(['hover'])` |

결과(`RenderResult`):

| 필드 | 뜻 |
|---|---|
| `warnings` | 그리면서 지키지 못한 것 전부(아래 "경고"). `doc.warnings`(입력 오류, 못 푼 `@import`)와는 별개 |
| `boxes` | Yoga가 계산한 상자, 패널 좌표. Unity와 비교하는 숫자가 이것이다 |
| `elements` | 모델 노드마다 그려진 DOM 요소. 클릭을 트리로 되짚을 때 쓴다 |
| `document` | 템플릿을 전개한, 실제로 그린 트리 |
| `styles`, `partStyles` | 그린 요소와 컨트롤 부품의 계산된 스타일. 0.7.0부터 테마의 기본 글자 크기·색이 모든 요소에 상속값으로 들어 있다(출처 `builtin-theme`) |
| `theme` | 실제로 그린 테마 |
| `dispose()` | Yoga 트리를 해제하고 그린 DOM을 지운다 |

그린 DOM 요소에는 `NODE_ATTRIBUTE`(모델 노드 id), 컨트롤 부품에는 `PART_ATTRIBUTE`·
`PART_OWNER_ATTRIBUTE` 속성이 붙는다.

## `serialize(doc)`

`{ uxml, uss }`. 고치지 않은 문서는 **입력과 바이트 단위로 같다** — 주석, 속성 순서, 엔티티 표기,
CRLF까지. 고친 노드만 다시 쓰고 나머지는 원문에서 잘라 온다. `uss`는 `parse`에 넘긴 스타일시트만
돌려준다(`@import`한 파일은 따로다).

## 경고

경고는 던지지 않고 목록으로 돌아온다. 렌더 하나가 실패했다고 화면 전체가 죽지 않는다.

```ts
interface Warning {
  kind: WarningKind;           // 17종, 늘리지 않는다
  message: string;             // 사람용. 어느 릴리스에서나 바뀔 수 있다
  reason?: WarningReason;      // 왜 — 소비자가 읽는 것
  subject?: WarningSubject;    // 무엇에 대해 — 소비자가 읽는 것
  at?: SourceRef;              // 텍스트 위치
  node?: NodeId;               // 대표 요소
  nodes?: NodeId[];            // 그 선언의 규칙이 매칭한 모든 요소
  sourceDocument?: string | null;  // 진입 UXML 밖에서 온 경고의 문서 URL
}
```

**문구(`message`)가 아니라 `reason`과 `subject`를 읽는다.** 소비자가 이미 문구로 매칭하는 7개는
바이트 단위로 유지하지만(`tests/render/consumer-contract.test.ts`) API는 아니다.

### `reason`

| `reason` | 뜻 | 누구의 문제 |
|---|---|---|
| `not-uss` | 기준 USS(Unity 6.6까지의 공식 표)에 없는 것을 썼다 (CSS 속성, 없는 의사 클래스, `@media`, `linear-gradient()`) | 작성자 |
| `invalid-value` | USS 이름에 쓸 수 없는 값이나 대상 (`width: wide`, `hsl()`, `cubic-bezier()`, `opacity: 50%`, `inherit`, 없는 override 대상) | 작성자 |
| `not-rendered` | 올바른 USS/UXML이지만 이 미리보기가 그리지 않는다 | 도구의 한계 |
| `font-fallback` | 그리지만, Unity는 일부 글자를 대체 폰트로 그려 글자 크기가 다를 수 있다 | 확인 필요 |
| `version-dependent` | 결과가 Unity 버전에 따라 다를 수 있다 | 확인 필요 |
| `matches-unity` | 무시되지만 Unity도 똑같이 무시한다 | 결함 아님 |

- **`reason`과 `subject.kind`는 열린 집합이다.** 새 값이 마이너 릴리스에서 추가될 수 있다(0.6.0의
  `font-fallback`이 그 첫 예). 소비자는 모르는 값을 위한 분기를 두되, 모르는 값을 곧 실패로 다루면
  새 경고 하나에 모든 실행이 실패한다
- `reason`이 없는 경고도 있다: 해당 사항이 없을 때(깨진 입력, 호스트가 못 푼 파일)
- 속성 경고는 **선언마다 한 번**, 그 선언의 위치(`at`)와 함께 나온다. 아무 요소에도 매칭되지 않는
  규칙의 선언도 경고한다. 상속으로 내려온 값에는 다시 경고하지 않는다

### `subject`

| `subject.kind` | 필드 |
|---|---|
| `property` | `property`, `value`(쓴 그대로), 아래 선택 필드 |
| `selector` | `selector`, `fragment`(문제 조각) |
| `states-key` | `key`, `problem`(`matches-nothing` · `state-in-key` · `unknown-state`, 없으면 셀렉터로 쓸 수 없는 키), `state` |
| `asset` | `path`, `form`(`url`·`resource`), `role`(`font`일 때) |
| `import` | `url`, `from` — 훅이 받았(거나 받았을) 인자 그대로 |
| `control` | `type` |
| `name` | `name` (중복 이름) |
| `at-rule` | `name` (`@` 없이) |

`property`의 선택 필드:

- `since` — 그 속성이 처음 실린 Unity 버전(`6000.3` 등)
- `replacements` — CSS 이름을 USS가 다르게 쓸 때 대신 쓸 속성(11개 이름)
- `affectsLayout` — `not-rendered`·`font-fallback`에서: Unity에서 이것이 상자 크기·위치를 바꿀 수
  있는가. `true`면 **미리보기 좌표가 Unity와 다를 수 있으니** 크기 0·넘침 같은 좌표 판정을 확정
  결과로 다루지 않는다. 판정과 근거(측정·문서·추론)는 등록표의 `unity`·`basis`·`inferred` 열
- `unityEffect` — Unity가 이 값을 적용하지 못할 때 실제로 일어나는 일, 측정한 버전과 함께:
  - `unstyled-from-here` — 그 요소와 그 뒤의 모든 요소가 스타일을 잃는다(앞선 형제는 유지)
  - `file-inline-dropped` — 그 UXML 파일의 인라인 스타일이 전부 버려진다
- `missingGlyphs` — `font-fallback`에서: 기본 폰트(Inter)에 없는 문자 체계(`hangul` · `han` · `kana`)
- `applied` — 예약 필드. 현재 이 값을 쓰는 등록표 행은 없다

### `at`

`{ in: 'uxml', span }` 또는 `{ in: 'uss', sheet, span, url, from }`. `span`은 원문의 `start`/`end`
오프셋이다. 줄 번호는 없다 — 오프셋에서 셀 수 있고, 저장된 줄 번호는 편집 뒤 엉뚱한 곳을 가리킨다.
USS 위치의 `url`·`from`은 그 시트를 위해 `resolveImport`가 받은 인자다 — 전개된 문서 없이도
`sheet`를 파일로 되짚을 수 있다.

## `classifyVisibility(result)`

그린 결과의 요소마다 왜 안 보이는지(또는 보이는지)를 판정한다. uxml-author의 규칙을 옮겨 왔다.

| `kind` | 뜻 |
|---|---|
| `shown` | 보인다 |
| `hidden` | `display: none` — `by`(그 값이 걸린 요소), `origin`(어느 규칙·인라인에서 왔는지) |
| `emptied` | 크기가 0인데, 자식이 모두 `hidden`이거나 `emptied`라서다 |
| `collapsed` | 크기가 0. `explicitZero`는 작성자가 0을 직접 썼는가 |

불투명도와 `visibility`는 판정에 넣지 않는다 — 상자가 있는가만 본다.

## 텍스트

- `textHeight(lines, fontSize, faceInfo, paragraphBreaks?, paragraphSpacing?)` — Unity의 글자 높이 공식
- `EDITOR_DEFAULT_FACE_INFO` — 에디터 기본 폰트(Inter-Regular SDF)의 FaceInfo, Unity가 보고한 값
- `createDefaultMeasureText(doc?)` — 기본 측정기. `measureText`를 감쌀 때 쓴다

## 그 밖의 공개 값

| 이름 | 뜻 |
|---|---|
| `USS_STATES` | Unity가 요소에 켜는 상태 7개 |
| `TEMPLATE_DEPTH_LIMIT` | 템플릿 중첩 전개 상한(32) |
| `expandTemplates(doc)` | 템플릿 전개만 따로 |
| `KNOWN_DIVERGENCES` | Unity와 다르다고 알려진 동작과 그 이유(고칠 수 없음 · 규칙 미상 · 상위 라이브러리) |
| `supportedControlNames()` | 전용 렌더러가 있는 컨트롤 |
| `resolveStyles`, `explainProperty` | 캐스케이드 결과, 한 요소의 한 속성을 두고 경쟁한 선언 전부(편집기가 "인라인을 고칠까, 규칙을 고칠까"를 물을 때) |
| `isInherited(property)` | USS 상속 여부 |
