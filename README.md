# uxml-preview

**Render and edit Unity UI Toolkit UXML/USS in the browser — no Unity Editor required.**

**유니티 에디터 없이, 브라우저에서 UXML/USS를 렌더링하고 편집합니다.**

[English](#english) · [한국어](#한국어)

> ⚠️ **Status: pre-alpha.** Under active development. Not yet published to npm.
> 현재 개발 초기 단계입니다. 아직 npm에 배포되지 않았습니다.

---

<a name="english"></a>
## English

### What it does

`uxml-preview` parses Unity UI Toolkit `.uxml` and `.uss` files and renders them
directly in a web browser. It uses **Yoga** — the same layout engine Unity UI Toolkit
itself uses — compiled to WebAssembly, so results match the Unity Editor rather than
approximating it.

```
.uxml + .uss  →  parse  →  style resolve  →  Yoga layout  →  DOM paint
                                                                  ↓
                                                          edit in browser
                                                                  ↓
                                                       serialize back to .uxml/.uss
```

### Why

Designing Unity UI Toolkit interfaces today means a slow round trip: mock it up
somewhere, hand-translate to UXML, open the Unity Editor, check, repeat. Web-based
design tools and AI coding agents can write UXML, but neither can *see* the result.
That broken feedback loop is what this library fixes.

**Use cases**
- Preview UXML layouts without launching Unity
- Give AI agents a visual feedback loop when authoring UI Toolkit interfaces
- Embed a UXML preview in your own tooling (editor extensions, internal tools)
- Share UI mockups with people who don't have Unity installed

### Design principles

1. **Never reimplement layout.** Unity UI Toolkit delegates layout to Yoga. So do we.
   Reimplementing it guarantees drift.
2. **Round-trip fidelity is non-negotiable.** Parse → serialize must preserve comments,
   attribute order, and formatting. If opening and saving a file produces a noisy
   git diff, it's unusable in practice.
3. **USS is not CSS.** Different box model, different defaults, no `z-index`,
   no `@keyframes`. See [`docs/uss-reference.md`](docs/uss-reference.md).
4. **Honest support matrix.** Unsupported properties produce warnings, not silent
   wrong output. See [`docs/supported.md`](docs/supported.md).

### Status & roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo scaffold + playground | ✅ |
| 1 | Data model | ✅ |
| 2 | Parser + serializer (round-trip) | ✅ |
| 3 | USS style resolver | 🔨 |
| 4 | Yoga layout + DOM painting | ⬜ |
| 5 | Golden image regression tests | ⬜ |
| 6 | **v0.1 release** | ⬜ |
| 7+ | More controls, editing layer, tool integration | ⬜ |

Full plan: [`docs/ROADMAP.md`](docs/ROADMAP.md)

### Planned API

```ts
import { parse, render, serialize } from 'uxml-preview';

// text → model
const doc = parse(uxmlText, ussText);

// model → screen
render(doc, document.getElementById('preview'), {
  resolveAsset: (path) => myAssetUrlFor(path),
});

// model → text
const { uxml, uss } = serialize(doc);
```

### Development

```bash
pnpm install
pnpm dev      # playground
pnpm test     # all tests
pnpm build
```

### Accuracy

Verified against golden images captured from the actual Unity Editor.
Results will be published in `docs/accuracy.md` once Phase 5 lands.

### License

Apache-2.0

---

<a name="한국어"></a>
## 한국어

### 무엇을 하는가

`uxml-preview`는 Unity UI Toolkit의 `.uxml`, `.uss` 파일을 파싱해서 웹 브라우저에
직접 렌더링하는 라이브러리입니다. Unity UI Toolkit이 실제로 사용하는 레이아웃 엔진인
**Yoga**를 WebAssembly로 그대로 사용하기 때문에, 결과를 "비슷하게 흉내내는" 것이 아니라
유니티 에디터와 일치시킵니다.

```
.uxml + .uss  →  파싱  →  스타일 계산  →  Yoga 레이아웃  →  DOM 페인팅
                                                                  ↓
                                                          브라우저에서 편집
                                                                  ↓
                                                    .uxml/.uss로 다시 저장
```

### 왜 만드는가

지금 UI Toolkit으로 UI를 만들려면 왕복이 깁니다. 어딘가에 시안을 만들고 → 손으로 UXML로
옮기고 → 유니티를 켜서 확인하고 → 안 맞으면 되돌아갑니다. 웹 기반 디자인 도구나 AI 코딩
에이전트가 UXML을 쓸 수는 있지만, 둘 다 그 결과를 **볼 수 없습니다.** 이 끊긴 피드백
루프를 잇는 것이 이 라이브러리의 목적입니다.

**활용**
- 유니티를 켜지 않고 UXML 레이아웃 확인
- AI 에이전트가 UI Toolkit UI를 만들 때 시각적 피드백 루프 제공
- 자체 도구(에디터 확장, 사내 툴)에 UXML 프리뷰 내장
- 유니티가 없는 사람과 UI 시안 공유

### 설계 원칙

1. **레이아웃을 직접 구현하지 않는다.** UI Toolkit은 레이아웃을 Yoga에 위임합니다.
   우리도 그렇게 합니다. 직접 구현하면 반드시 어긋납니다.
2. **왕복 보존은 타협 대상이 아니다.** 파싱 → 직렬화 시 주석, 속성 순서, 서식이
   유지되어야 합니다. 열었다 저장했을 때 git diff가 지저분해지면 실무에서 못 씁니다.
3. **USS는 CSS가 아니다.** 박스 모델이 다르고, 기본값이 다르고, `z-index`가 없고,
   `@keyframes`가 없습니다. [`docs/uss-reference.md`](docs/uss-reference.md) 참조.
4. **지원 범위를 정직하게 밝힌다.** 미지원 속성은 조용히 틀린 결과를 내는 대신
   경고를 남깁니다. [`docs/supported.md`](docs/supported.md) 참조.

### 진행 상황

| 단계 | 범위 | 상태 |
|---|---|---|
| 0 | 저장소 뼈대 + 놀이터 | ✅ |
| 1 | 데이터 모델 | ✅ |
| 2 | 파서 + 직렬화 (왕복 검증) | ✅ |
| 3 | USS 스타일 리졸버 | 🔨 |
| 4 | Yoga 레이아웃 + DOM 페인팅 | ⬜ |
| 5 | 골든 이미지 회귀 테스트 | ⬜ |
| 6 | **v0.1 공개** | ⬜ |
| 7+ | 컨트롤 확장, 편집 레이어, 도구 통합 | ⬜ |

전체 계획: [`docs/ROADMAP.md`](docs/ROADMAP.md)

### 개발

```bash
pnpm install
pnpm dev      # 놀이터 실행
pnpm test     # 전체 테스트
pnpm build
```

### 라이선스

Apache-2.0

---

### Keywords

Unity, Unity3D, UI Toolkit, UITK, UXML, USS, renderer, preview, browser,
Yoga layout, WebAssembly, TypeScript, game UI, editor tooling
