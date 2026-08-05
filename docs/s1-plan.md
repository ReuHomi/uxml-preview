# S1 계획서 — 개정 기록

S1의 계획 원문(`S1-renderer-capability.md`)은 이 저장소 밖에 있다. 이 파일은 그
원문을 대체하지 않고, **착수 후 사실 확인으로 바뀐 것만** 기록한다.

기록은 append-only다. 결정이 뒤집히면 지우지 말고 새 행으로 뒤집는다.

---

## 개정 1 — 성공 기준 3을 명시적으로 완화한다 (2026-08-05)

| | |
|---|---|
| 원문 | "시각 속성이 Unity와 일치한다 — 스크린샷 픽셀 diff 임계값 이하" |
| 개정 | "시각 속성이 Unity와 일치한다 — **요소별 CSS 선언 골든 스냅샷(자동 회귀) + 대표 화면 1회 육안 대조를 산출물로 기록**" |

**왜 바꾸는가.** 자동 픽셀 diff는 이 프로젝트에서 재려는 것을 재지 못한다.
브라우저는 `sans-serif`로, Unity는 자기 폰트 에셋으로 글자를 그린다. 텍스트가 든
화면의 픽셀 차이는 레이아웃이 아니라 **폰트 차이**를 재고, 대표 화면(인벤토리)은
텍스트투성이다. 이것은 2026-08-02에 "골든 비교를 픽셀이 아니라 좌표로" 결정한 것과
같은 논리다 (`progress.md` 결정 기록).

부차적으로, 양쪽 하네스가 **둘 다 없다.** `tools/UxmlLayoutDump.cs`는 좌표만 덤프하고
(그 파일 13행이 왜 스크린샷이 아닌지 밝히고 있다), 브라우저 쪽은 테스트가 jsdom이라
래스터라이저가 없다. `pixelmatch`·`pngjs`는 devDeps에 있으나 미사용이다. 자동화하려면
CI가 headless 브라우저 바이너리에 의존하게 된다.

**완화의 대가를 무료로 두지 않는다.** 육안 대조는 반드시 산출물을 남긴다:

- Unity 스크린샷과 프리뷰 스크린샷을 저장소에 커밋한다 (`docs/media/`)
- 무엇을 확인했는지 짧은 체크 기록을 남긴다 — 색 / 테두리 / 모서리 각각
- 대표 화면이 하나뿐이라 부담은 작다

기록이 없으면 렌더러를 고친 뒤 "이전에 맞았던 것이 여전히 맞나"를 물을 방법이 없다.
그때 남는 것은 "한 번 봤다"는 말뿐이고, 그건 근거가 아니다.

**기준을 조용히 재해석하지 않고 여기 적는 이유**: 그래야 나중에 "성공 기준 3을
통과했다"는 문장이 정직해진다.

## 개정 2 — Step 3(pseudo-class)은 대부분 이미 구현돼 있다 (2026-08-05)

계획서는 신규로 잡았으나, 착수 시점에 전 경로가 존재한다.

| 있는 것 | 위치 |
|---|---|
| `RenderOptions.activeStates` | `src/index.ts` |
| `ResolveOptions.activeStates` | `src/style/resolve.ts` |
| `MatchContext.activeStates` | `src/style/selector.ts` |
| 상태 pseudo-class 매칭 | `src/style/selector.ts`, `matchesSimple`의 `pseudo` 분기 |

**남은 것**은 (a) 요소별 상태 지정, (b) provenance에 "어느 상태에서 왔는지" 기록,
(c) 테스트다.

## 개정 3 — 상태 입력은 요소별 셀렉터 맵으로 (2026-08-05)

현행 코드는 문서 전역 `ReadonlySet<string>`이다. 계획서안(요소별 맵)을 채택한다.

```ts
render(doc, el, { states: { '#UseButton': ['hover'], '#DropButton': ['disabled'] } })
```

**왜.** 성공 기준 4는 상태별 렌더 결과가 Unity와 일치하는 것인데, 인벤토리 화면은
**한 화면에 기본 버튼과 disabled 버튼이 동시에** 있다. 전역 집합으로는 그 화면 자체를
그릴 수 없고, Step 6에서 되돌아오게 된다.

키의 셀렉터 문법은 기존 셀렉터 파서를 재사용한다. 전역 `activeStates`는 하위 호환으로
남긴다 (문서 전체에 거는 상태 = 모든 요소에 거는 상태).

`:disabled`가 Unity에서 `SetEnabled`로 하위 트리에 상속된다는 점은 **이번 범위 밖**이다.
필요해지면 별도 항목으로 올린다.

## 개정 4 — Step 4(Image)도 절반 이상 구현돼 있다 (2026-08-05)

`src/render/css-map.ts`에 `background-image` 경로 해석, `resolveAsset` 호출,
미해결 시 플레이스홀더, 경고가 전부 있다.

**남은 것은 둘뿐이다** — `<ui:Image>` 엘리먼트와 `-unity-background-scale-mode`
(현재 `background-size: contain`으로 하드코딩돼 있다).

계획서 §3.1의 지원 USS 속성 목록 중 미구현은 `-unity-background-scale-mode` 하나다.
나머지(flex 계열, 크기, 위치, 색, 테두리, 텍스트, `opacity`/`display`/`visibility`/
`overflow`)는 전부 확인했다.

작업량이 이 정도면 **Step 4를 Step 5(ScrollView)와 묶어 처리해도 된다.** 다만
Step 1~3의 순서는 그대로다 — 검증 순서가 바뀌면 안 되는 쪽은 그쪽이다.
