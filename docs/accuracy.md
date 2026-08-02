# Accuracy

**"유니티랑 진짜 똑같이 나오냐"에 숫자로 답하는 문서.**
공개했을 때 첫 번째로 받는 질문이고, 답이 없으면 아무도 쓰지 않는다.

## 현재 상태

| 항목 | 값 |
|---|---|
| 케이스 수 | 20 (비교 대상 18, 텍스트 측정 의존 2) |
| **유니티 기준값 확보** | **0 / 18** |
| **좌표 일치율** | **미측정** |
| 회귀 스냅샷 | 20 / 20 |

**아직 아무것도 검증되지 않았다.** 회귀 스냅샷은 "우리 출력이 안 바뀌었다"만 말하고,
그것이 유니티와 같다는 뜻은 아니다. 위 표의 "미측정"을 "통과"로 읽지 않는다.

## 왜 픽셀이 아니라 좌표인가

유니티는 자기 폰트 에셋으로, 브라우저는 `sans-serif`로 글자를 그린다.
안티앨리어싱과 서브픽셀 렌더링도 다르다. **레이아웃이 100% 정확해도 글자 픽셀은
전부 다르게 나온다.** 텍스트가 포함된 케이스에서 픽셀 diff를 재면 그 수치는
레이아웃 정확도가 아니라 폰트 차이를 재게 된다.

정말 답해야 하는 질문은 "내 레이아웃이 유니티와 같은 자리에 오나"이고,
그건 좌표로 답한다. 색·테두리·모서리 같은 시각 속성은 좌표가 말해주지 않으므로
별도로 눈으로 대조한다.

## 기준값 만드는 법

```
1. pnpm golden:emit
     tests/golden/cases.ts  ->  tests/golden/cases/*.uxml + *.uss

2. tests/golden/cases/ 폴더를 유니티 프로젝트로 복사 (예: Assets/GoldenCases/)
   tools/UxmlLayoutDump.cs 를 Assets/Editor/ 에 넣는다

3. 유니티: Tools > uxml-preview > Golden Case Dumper
   케이스 폴더 지정 -> Run -> 출력 폴더 지정

4. 나온 *.json 을 tests/golden/unity/ 로 복사

5. pnpm test:golden
```

기준값이 없는 케이스는 **실패가 아니라 건너뛴다.** 아무도 만들 수 없는 파일이
없다고 빌드가 깨지면 안 되고, 동시에 미측정이 통과로 보여서도 안 된다.

패널 크기는 각 JSON에 기록되고 웹 쪽이 그 크기로 다시 레이아웃한다.
두 곳의 숫자를 손으로 맞출 일이 없다.

## 판정 기준

- 요소별로 `x` / `y` / `width` / `height` 비교
- 허용 오차 **0.5px** — Yoga의 포인트 반올림에서 나오는 흔들림은 불일치가 아니다
- 조인 키는 UXML의 `name` 속성. 이름 없는 요소는 비교하지 않는다
- `measuresText: true` 케이스는 비교에서 제외한다. 유니티 폰트 메트릭과
  우리 측정식이 다르므로 여기서 나오는 차이는 레이아웃 오차가 아니다

## 이 케이스 세트가 판정할 미검증 가정

Phase 1~4에서 단정하지 않고 넘긴 것들이다. 각각 어느 케이스가 답하는지 적어둔다.

| 가정 | 어디서 왔나 | 판정할 케이스 |
|---|---|---|
| `flex-shrink` 기본값이 1 (Yoga 엔진값은 0) | `src/render/values.ts` | `flex-grow-shrink` |
| 우선순위를 트리플로 세고 pseudo-class를 class로 센다 | `src/style/specificity.ts` | `specificity-tie` |
| 요소를 직접 겨냥한 스타일이 상속을 항상 이긴다 | CLAUDE.md | `inherit-vs-direct` |
| 인라인이 모든 셀렉터를 이긴다 | CLAUDE.md | `inline-override` |
| auto 크기 부모에 대한 `%`가 축마다 다르게 풀린다 | Yoga 실측 (아래) | `percent-without-parent-size` |
| 행 높이가 `font-size * 1.2` | `src/render/measure.ts` | `text-size` (참고용) |
| `-unity-text-align` 세로 정렬 매핑 | `src/render/css-map.ts` | `text-align` (참고용) |

### 퍼센트 축 비대칭 — 확인이 필요한 발견

Yoga를 직접 찍어보니, **명시적 크기가 없는 부모에 대한 퍼센트가 축마다 다르게** 나온다.

```
부모: 크기 미지정, 자식: width 50% / height 50%, 패널 300 높이

  자식 width  -> 0    (부모도 0)
  자식 height -> 75   (부모는 150)
```

CLAUDE.md는 "`%` 크기는 부모에 명시적 크기가 없으면 계산되지 않는다"고 한 줄로
적어두고 있는데, 가로에는 맞고 세로에는 틀리다. 유니티도 같은 Yoga를 쓰므로
같은 결과가 나와야 하고, 그렇다면 **문서 쪽을 고쳐야 한다** —
`docs/uss-reference.md` 12절에 축 구분을 넣는다.

유니티가 다른 결과를 낸다면 그건 UI Toolkit이 Yoga 위에 무언가를 더 얹었다는
뜻이고, 그쪽이 훨씬 중요한 발견이다.

## 케이스 목록

`pnpm golden:emit`이 만드는 `tests/golden/cases/README.md`에 케이스별 질문이 있다.
케이스 정의 자체는 `tests/golden/cases.ts`가 유일한 출처다.
