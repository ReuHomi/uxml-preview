# Backlog

v0.1 스코프 밖으로 밀린 것들. 지금 하지 않는다.

형식:
```
- [Phase N] 항목 — 왜 미뤘는지 (기록일)
```

---

- [Phase 7] ScrollView 지원 — v0.1은 컨트롤 3종 고정 (2026-08-02)
- [Phase 7] TextField / Toggle / Slider / Foldout / DropdownField — 동일 (2026-08-02)
- [Phase 7] `<ui:Template>` / `<ui:Instance>` 전개 — 동일 (2026-08-02)
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
