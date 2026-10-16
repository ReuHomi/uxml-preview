# uxml-preview

*[English](https://github.com/ReuHomi/uxml-preview/blob/main/README.md) · 한국어*

**Unity UI Toolkit의 UXML/USS를 Unity 에디터 없이 브라우저에서 그립니다. 배치는 UI Toolkit이
쓰는 엔진인 Yoga가 하고, 결과는 Unity와 대조해 측정했습니다.**

[![놀이터 화면: 위에는 화면, 아래에는 경고마다 이유와 Unity가 대신 하는 일](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/playground.png)](https://reuhomi.github.io/uxml-preview/)

### ▶ [놀이터 열기](https://reuhomi.github.io/uxml-preview/)

`.uxml`과 `.uss`를 붙여 넣거나 예제를 여세요. 아무것도 업로드되지 않고 페이지 안에서만
돕니다.

[![CI](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml)
[![Pages](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/ReuHomi/uxml-preview/blob/main/LICENSE)

## 어떻게 확인했나

- **좌표:** 완성된 화면 하나를 포함한 배치 케이스 40개에서, 요소 좌표 값 660 / 676이 Unity 6000.0.40f1과 같습니다. [다른 곳은 전부 이름을 붙여 적었습니다 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.md)
- **텍스트:** 실제 브라우저에서 그려 Unity 6000.3.25f1과 Label 단위로 대조했습니다. 줄 수 60 / 60, 높이 52 / 60, 너비 60 / 60(1px 또는 1% 이내). [텍스트 코호트 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.md#텍스트-코호트-별도-검증-세트-2026-10-16-측정)
- **Unity 버전:** 기준은 Unity 6.3 LTS입니다. USS 속성인지는 Unity 공식 속성표(6.6까지)로 판정하고, 6.7은 LTS가 나올 때까지 지원하지 않습니다. [지원 범위 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.md)
- **맞지 않는 곳은 조용히 넘기지 않고 경고로 알립니다.** 지원하지 않는 컨트롤·속성·값은 이유와 함께, 측정한 경우에는 Unity가 대신 어떻게 하는지까지 경고로 돌아옵니다. [경고 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.md#경고)

## 쓰는 방법 세 가지

| 이런 분이라면 | 이것을 |
|---|---|
| **화면을 디자인한다** | 브라우저의 [놀이터](https://reuhomi.github.io/uxml-preview/), 또는 프로젝트 파일 옆에서 [UXML Preview for VS Code](https://github.com/ReuHomi/vscode-uxml-preview) |
| **AI 에이전트에게 UI를 맡긴다** | [uxml-author](https://github.com/ReuHomi/uxml-author) — UXML/USS를 쓰고, 이 라이브러리로 그려 결과를 확인한 뒤 넘겨주는 스킬 |
| **도구를 만든다** | 이 라이브러리: `npm install uxml-preview`, 그다음 [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.md) |

## 설치

```bash
npm install uxml-preview
```

도구 쪽은 Node 22 이상입니다. 그리려면 DOM이 필요합니다(브라우저, 또는 테스트에서는
happy-dom·jsdom).

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();                 // Yoga는 WebAssembly라 처음에 한 번 불러온다

const doc = parse(uxmlText, ussText);     // 텍스트 → 모델
const view = render(doc, container, {     // 모델 → 화면
  size: { width: 1280, height: 720 },     // 창이 아니라 패널 크기
  resolveAsset: (path, form) => myAssetUrl(path, form),  // project://… → URL, 없으면 null
});

for (const w of view.warnings) console.log(w.reason ?? w.kind, w.message);

view.dispose();                           // Yoga 노드는 가비지 컬렉션되지 않는다
const { uxml, uss } = serialize(doc);     // 고치지 않았으면 입력과 바이트 단위로 같다
```

## 문서

- [USS는 CSS가 아니다](https://github.com/ReuHomi/uxml-preview/blob/main/docs/uss-vs-css.ko.md) — 옮겨 온 스타일시트가 틀어지는 차이들, 예제와 함께
- [지원 범위](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.md) — 컨트롤·속성·상태·버전, 그리고 각각 어디까지 확인했는지
- [정확도](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.md) — 모든 수치, 잰 방법, 알려진 차이 전부
- [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.md) — `parse`, `render`, `serialize`, 훅, 경고, `classifyVisibility`
- [변경 기록](https://github.com/ReuHomi/uxml-preview/blob/main/CHANGELOG.md) (영문)
- [육안 대조](https://github.com/ReuHomi/uxml-preview/blob/main/docs/visual-check.md) — 색과 질감을 Unity와 나란히 놓고 본 1회 기록(2026-08)

## 개발

```bash
pnpm install
pnpm dev            # 놀이터
pnpm test           # 브라우저·Unity 없이 도는 전부
pnpm test:text      # 텍스트 코호트, 실제 Chromium에서 (docs/accuracy.md)
pnpm build
```

Unity 쪽 기준값을 다시 만들려면 Unity가 필요합니다. 절차는
[정확도](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.md#기준값-만드는-법)에 있습니다.

## 라이선스

Apache-2.0
