# uxml-preview

규칙 정본은 `CLAUDE.md`다. 그 파일을 전부 읽고 시작하라.
특히 "USS 함정", "검증 규율", "스코프 경계".

## Group 3 review checklist (Template / Instance)

이 체크리스트는 작업 범위의 점검표일 뿐이며, 규칙 정본은 계속 `CLAUDE.md`다.

- [x] `<ui:Template>` / `<ui:Instance>` 전개는 원본 AST와 분리된 파생 렌더 트리에서만 한다. 왕복 바이트 보존과 Yoga 위임을 함께 확인한다.
- [x] Unity 6000.0.40f1에서 확인한 `TemplateContainer` 경계(C1), 상속, `:root`, `Style` 스코프, `AttributeOverrides` 결과를 케이스와 테스트로 고정한다.
- [x] 상대 `src`와 프로젝트 루트 고정 `project://…` 경로는 기존 `resolveImport(url, from)`을 재사용한다. 코어/호스트가 `Library/PackageCache`를 직접 탐색하지 않는다는 제약과 `package-path-not-searched`를 유지한다.
- [x] 순환·깊이 초과·미해결·누락 대상은 fail-closed 또는 폴백과 명시적 진단으로 처리한다. `WarningKind` 17종 소비자 분류기를 갱신한다.
- [x] 슬롯은 6000.0.40f1에서 살아 있음을 실측했지만 이번 릴리스 비목표다. 슬롯 자식을 배치하지 않고 `template-slot-unsupported`를 보고한다.
- [x] 기본 컨트롤 수치 660/676과 템플릿 코호트 수치는 합산하지 않는다. 정적 검사·빌드·테스트·Unity 측정/런타임 주장을 서로 섞지 않는다.

## Group 3 교훈

- Windows에서 native crash `0xC0000005`가 발생하면 전체 스위트의 성공으로 오인하지 않는다. 기여자는 `pnpm exec vitest run <suite/file>`로 각 스위트/파일을 개별 실행하고 부모 프로세스의 exit code를 확인한다.
- 템플릿 골든의 정확도·커버리지·컨트롤 범위는 별도 숫자다. 빈 상자 양쪽 일치와 외부 표본의 진단 건수를 렌더 성공으로 세지 않는다.
