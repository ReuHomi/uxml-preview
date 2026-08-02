# Roadmap

각 Phase의 완료 조건(DoD)에 전부 체크되기 전에는 다음 Phase로 넘어가지 않는다.
특히 **Phase 2를 건너뛰고 렌더링부터 만들고 싶은 유혹**이 강하게 오는데,
그러면 Phase 8에서 데이터 모델을 갈아엎게 된다.

```
Phase 0  저장소 뼈대 + 놀이터        │ 반나절
Phase 1  데이터 모델 설계             │ 1일      ← 가장 중요
Phase 2  파서 + 직렬화 (왕복 검증)    │ 2~3일    ← 관문
Phase 3  USS 스타일 리졸버            │ 2~3일
Phase 4  Yoga 레이아웃 + DOM 페인팅   │ 3~4일    ← 처음으로 화면에 나옴
Phase 5  골든 테스트 체계             │ 2일      ← 신뢰도의 근거
Phase 6  놀이터 완성 + 공개           │ 1~2일    ← v0.1
─────────────────── 여기까지가 v0.1 ───────────────────
Phase 7  컨트롤 확장
Phase 8  편집 레이어
Phase 9  외부 도구 통합
```

---

## Phase 0 — 저장소 뼈대와 놀이터

**목표:** `pnpm dev`로 빈 화면이라도 뜨는 상태.

- [x] TypeScript + Vitest + Vite 빌드가 돌아간다
- [x] `playground/`에 좌우 2분할 페이지가 뜬다
- [x] `pnpm test`가 통과한다 (테스트 0개여도 됨)
- [x] `CLAUDE.md`가 있다
- [x] `docs/uss-reference.md`에 참조표가 있다
- [x] `docs/backlog.md`, `docs/progress.md` 생성
- [x] Git 초기 커밋

**완료 (2026-08-02).** `pnpm build`가 `dist/index.js` + `dist/index.d.ts`를 낸다.
`index.js`는 아직 빈 파일이다 — 공개 API가 `export declare`라 런타임 코드가 없다.
Phase 2에서 실제 구현이 들어가면 채워진다.

> 참조표를 먼저 넣는 이유: CSS↔USS 매핑 표가 Phase 3·4의 사실상 명세서다.
> 이게 없으면 CSS 상식으로 추론해서 존재하지 않는 속성을 매핑한다.

---

## Phase 1 — 데이터 모델 설계

**목표:** 파서도 렌더러도 없지만, UXML 문서를 메모리에서 어떻게 표현할지 확정.
**이 Phase가 프로젝트 전체의 성패를 가른다.**

- [x] `src/model/types.ts`에 전체 타입 정의
- [x] 각 스타일 값의 **출처** 추적 가능 (인라인 / USS 규칙 / 상속 / 기본값) — `StyleOrigin`
- [x] 원본 텍스트 정보(주석, 속성 순서, 공백) 보존 자리 확보
- [x] 타입만 보고도 "이걸로 직렬화가 되겠다"는 확신

**완료 (2026-08-02).** 관통하는 원칙 하나로 정리됐다 —
**모델에는 파일에서 온 것만 넣고, 계산해서 알 수 있는 것은 넣지 않는다.**
계산된 스타일, "이 컨트롤을 지원하는가", 줄 번호, 펼친 shorthand가 전부 모델 밖이다.
파생물을 저장하면 편집 후 낡고, 낡은 걸 못 알아채면 틀린 것을 보여준다.

주석에는 전용 타입이 없다. 요소·규칙·선언 **사이의 공백을 원본에서 슬라이스**하는
방식이라 주석이 그 안에 실려 저절로 살아남는다. 루트 바깥(XML 선언, 첫머리 주석)도
같은 방식이다.

### Phase 2로 넘길 것

- 왕복 기준의 실측: 픽스처에서 바이트 일치가 실제로 나오는지 확인한다.
  스팬 재출력이 맞다면 편집 없는 왕복은 정의상 바이트 일치여야 한다
- `tagDirty` / `childrenDirty` 분리가 실제 편집에서 의도대로 도는지 검증

> 출처 정보가 필요한 이유: 사용자가 화면에서 색을 바꿨을 때
> "인라인에 쓸지, USS 규칙을 고칠지"를 이 정보로 판단한다.
> Phase 8에서 이게 없으면 편집 기능을 만들 수 없다.

---

## Phase 2 — 파서 + 직렬화 (왕복 검증) ★ 관문

**목표:** 파일을 읽었다가 그대로 다시 쓰면 원본과 같아지는 상태.
화면에는 아무것도 안 나온다.

- [ ] UXML 파서 (VisualElement, Label, Button)
- [ ] USS 파서 (셀렉터 + 선언)
- [ ] UXML/USS 직렬화
- [ ] **왕복 테스트 통과**
- [ ] 주석이 살아남음
- [ ] 속성 순서가 유지됨
- [ ] 테스트 픽스처 10개 이상

> 완전한 바이트 단위 일치는 과한 목표일 수 있다.
> **"사람이 저장했을 때 git diff가 깨끗한가"**가 실용적 기준이다.
> 이 기준을 여기서 정하고 문서에 명시한다.

---

## Phase 3 — USS 스타일 리졸버

**목표:** "이 요소에 최종적으로 어떤 스타일이 적용되는가"를 계산.

- [ ] 셀렉터 매칭 (타입 / 클래스 / 이름 / 와일드카드 / 자손 / 자식 / 복합)
- [ ] `@import` 처리
- [ ] 미지원 셀렉터를 경고로 처리하고 해당 규칙만 무시
- [ ] 우선순위 계산이 Unity 규칙과 일치
- [ ] 상속 처리
- [ ] `var()` 커스텀 속성
- [ ] 각 스타일 값에 출처 기록
- [ ] 우선순위 테스트 20개+

---

## Phase 4 — Yoga 레이아웃 + DOM 페인팅

**목표:** 드디어 화면에 나온다.

- [ ] `yoga-layout` 연동 (WASM 로드 포함)
- [ ] 모델 → Yoga 노드 트리 변환
- [ ] 레이아웃 계산 후 좌표 회수
- [ ] 좌표에 맞춰 절대위치 DOM 생성
- [ ] USS 시각 속성 → CSS 매핑 (`src/render/css-map.ts`)
- [ ] 모든 요소에 `box-sizing: border-box`
- [ ] **z-index를 출력하지 않음** (형제 순서에 맡김)
- [ ] `resolveAsset` 훅 + 플레이스홀더 폴백
- [ ] 리렌더 시 Yoga 노드 해제 (누수 테스트 통과)
- [ ] 놀이터에서 실제로 보임

> 여기서 컨트롤을 더 추가하고 싶어지는데, **참는다.** v0.1은 3종이다.

---

## Phase 5 — 골든 테스트 체계

**목표:** "유니티랑 진짜 똑같이 나오냐"에 숫자로 답할 수 있는 상태.
공개했을 때 첫 번째로 받는 질문이 이것이고, 답이 없으면 아무도 안 쓴다.

- [ ] 케이스 세트 작성 (아래)
- [ ] 유니티에서 실제 렌더 스크린샷 확보 (수동)
- [ ] 웹 렌더 결과 자동 캡처
- [ ] 픽셀 diff 측정 및 임계값 판정
- [ ] `pnpm test:golden` 동작
- [ ] 결과가 `docs/accuracy.md`에 수치로 기록

### 케이스 세트

```
실패 패턴 검증 ★ 최우선
  flex-direction 미지정 (기본값이 column인지)   ← 1순위 실패 원인
  형제 순서에 따른 겹침 (z-index 없이)
  부모에 크기 없는 상태의 % 자식 (계산 안 되는 것이 정상)
  margin 상쇄 없음
  시작값이 auto인 속성의 트랜지션 (작동 안 하는 것이 정상)

레이아웃 기초
  flex-direction: row / column (+ reverse)
  justify-content 전체 값
  align-items 전체 값
  flex-wrap

크기
  flex-grow / flex-shrink / flex-basis 조합
  퍼센트 vs 픽셀
  min/max width·height 충돌
  width 미지정 시 콘텐츠 기반 크기

박스 모델
  padding + border + width 동시 지정   ← border-box 검증 핵심

위치
  position: absolute 오버레이
  top/left/right/bottom 조합
  중첩 absolute

텍스트
  줄바꿈
  text-overflow: ellipsis
  font-size 상속
  -unity-text-align 세로+가로 조합
  -unity-font-style 4종

Unity 고유 속성
  -unity-slice-* (9-slice)
  -unity-background-image-tint-color
  -unity-text-outline-*

스타일 우선순위
  동일 우선순위 셀렉터 충돌
  상속 vs 직접 지정
  인라인 오버라이드
```

> 유니티 스크린샷은 **수동으로 찍는다.** 배치모드 파이프라인을 짜는 건
> 이 단계에서 배보다 배꼽이 크다. 케이스 30개면 손으로 찍는 게 빠르다.

---

## Phase 6 — 놀이터 완성 + v0.1 공개

- [ ] 놀이터에 예제 프리셋 드롭다운
- [ ] 경고/에러 표시 영역
- [ ] URL 공유 기능
- [ ] GitHub Pages 배포
- [ ] README에 데모 GIF + 정확도 수치
- [ ] `docs/uss-vs-css.md` 작성 (독립 SEO 자산)
- [ ] `docs/supported.md` 완성
- [ ] npm 배포
- [ ] GitHub Topics 설정
- [ ] v0.1.0 릴리스 노트

---

## Phase 7+ — v0.1 이후

v0.1을 내고 반응을 본 뒤에 구체화한다.

**Phase 7 — 컨트롤 확장**
ScrollView, TextField, Toggle, Slider, Foldout, DropdownField /
`<ui:Template>`·`<ui:Instance>` 전개 / pseudo-class 상태 전환

**Phase 8 — 편집 레이어**
엘리먼트 선택·아웃라인 / 속성 인스펙터 / write-back
(Phase 1의 출처 정보가 여기서 빛을 발한다)

**Phase 9 — 외부 도구 통합**
Open Design 플러그인 / `.uxml` 프리뷰 분기 / 에이전트용 SKILL.md
