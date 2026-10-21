# uxml-preview

*[English](https://github.com/ReuHomi/uxml-preview/blob/main/README.md) · [한국어](https://github.com/ReuHomi/uxml-preview/blob/main/README.ko.md) · [日本語](https://github.com/ReuHomi/uxml-preview/blob/main/README.ja.md) · 简体中文*

**无需 Unity 编辑器，即可在浏览器中渲染 Unity UI Toolkit 的 UXML/USS——由 UI Toolkit 自身使用的
Yoga 引擎负责布局，并与 Unity 实测结果进行了比对验证。**

![uxml-preview 0.7.0：左侧是用 UXML 和 USS 编写的设置界面，右侧是浏览器中的渲染结果](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/promo-0.7.0.gif)

[![在线体验页面：上方为预览画面，下方列出每条警告的原因及 Unity 的实际处理方式](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/playground.png)](https://reuhomi.github.io/uxml-preview/)

### ▶ [打开在线体验 (Playground)](https://reuhomi.github.io/uxml-preview/)

粘贴你自己的 `.uxml` 和 `.uss`，或直接打开示例。所有内容都不会上传，完全在页面本地
运行。

[![CI](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml)
[![Pages](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/ReuHomi/uxml-preview/blob/main/LICENSE)

## 验证方式

- **坐标·运行时主题（默认）：** 在同样的 42 个布局用例中，1122 / 1148 个元素坐标值与真实的 Unity 6.3 运行时面板（6000.3.25f1，PanelSettings + UIDocument，Play 模式）完全一致。剩余差异均为编辑器主题同样存在的差异。[测量方法 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#runtime-theme-separate-set-measured-2026-10-17)
- **坐标·编辑器主题：** 在包含三个完整界面（物品栏，以及使用全部 15 种已绘制控件的设置界面英文版和韩文版）在内的 42 个布局用例中，1122 / 1148 个元素坐标值与 Unity 6000.0.40f1 完全一致。[查看全部差异明细 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md) 在 Unity 6.3（6000.3.25f1）中重新导出这批用例后，所有布局结果均与当天导出的 6000.0.40f1 结果一致。[6.3 重新测量结果 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#unity-63-lts-re-measurement-2026-10-15)
- **文本：** 在真实浏览器中绘制，并与 Unity 6000.3.25f1 逐个 Label 进行比对——行数 92 / 92、高度 84 / 92、宽度 92 / 92（误差在 1px 或 1% 以内）。所有高度存在差异的用例，均是使用了不含韩文字符的拉丁字体 Inter 来排版韩文或混排文本；此时 Unity 会改用回退字体绘制，而本预览工具会针对该情况发出明确警告。[文本测试集 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#text-cohort-separate-set-measured-2026-10-16)
- **测量条件：** 坐标数值测量的是给定文字尺寸时的布局（测试工具用固定函数测量文字，文字测量由文本数值单独衡量）。文本数值是在向预览传入与 Unity 相同的字体文件的条件下测得的。若不传入字体，预览会用浏览器默认字体测量，文字宽度可能相差几个像素，多行文本的行数也可能不同。[条件 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md)
- **Unity 版本：** 基准版本为 Unity 6.3 LTS。某项属性是否属于 USS，依据 Unity 官方属性表（截至 6.6）判定；6.7 在推出 LTS 版本之前暂不支持。[支持范围 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md)
- **不一致之处会明确报告，绝不静默忽略。** 遇到不支持的控件、属性或值时，工具会返回警告并说明原因；对于已实测的情况，还会一并告知 Unity 的实际处理方式。[警告说明 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md#warnings)

## 三种使用方式

| 使用场景 | 推荐方案 |
|---|---|
| **设计界面** | 使用浏览器中的[在线体验](https://reuhomi.github.io/uxml-preview/)，或在项目文件旁使用 [UXML Preview for VS Code](https://github.com/ReuHomi/vscode-uxml-preview) |
| **让 AI 智能体编写 UI** | [uxml-author](https://github.com/ReuHomi/uxml-author) —— 编写 UXML/USS、调用本库渲染并先验证结果再交付的技能（Skill） |
| **构建工具** | 直接使用本库：`npm install uxml-preview`，详见 [API 文档](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md) |

## 安装

```bash
npm install uxml-preview
```

工具链需要 Node 22 或更高版本；渲染需要 DOM 环境（浏览器，或在测试中使用 happy-dom /
jsdom）。

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();                 // Yoga 基于 WebAssembly：预先加载一次即可

const doc = parse(uxmlText, ussText);     // 文本 → 模型
const view = render(doc, container, {     // 模型 → 画面
  size: { width: 1280, height: 720 },     // 面板尺寸，而非窗口尺寸
  resolveAsset: (path, form) => myAssetUrl(path, form),  // project://… → URL，不存在则返回 null
});

for (const w of view.warnings) console.log(w.reason ?? w.kind, w.message);

view.dispose();                           // Yoga 节点不会被垃圾回收，需手动释放
const { uxml, uss } = serialize(doc);     // 若未修改，输出与输入字节级完全一致
```

## 文档

- [USS 不是 CSS](https://github.com/ReuHomi/uxml-preview/blob/main/docs/uss-vs-css.md)（英文） — 导致迁移过来的样式表显示异常的各项差异，均附有示例
- [支持范围](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md)（英文） — 控件、属性、状态、版本，以及各项的验证程度
- [精度说明](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md)（英文） — 所有数据、测量方法及全部已知差异
- [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md)（英文） — `parse`、`render`、`serialize`、钩子（Hooks）、警告、`classifyVisibility`
- [更新日志](https://github.com/ReuHomi/uxml-preview/blob/main/CHANGELOG.md)（英文）
- [视觉比对](https://github.com/ReuHomi/uxml-preview/blob/main/docs/visual-check.md)（韩文） — 将色彩与质感同 Unity 并排对比的单次记录（2026-08）

## 开发

```bash
pnpm install
pnpm dev            # 在本地启动在线体验页面（Playground）
pnpm test           # 无需浏览器或 Unity 即可运行的全部测试
pnpm test:text      # 文本测试集，在真实 Chromium 中运行（见 docs/accuracy.en.md）
pnpm build
```

复现 Unity 侧的基准数据需要安装 Unity，具体步骤见
[精度说明](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#producing-the-ground-truth)。

## 许可证

Apache-2.0
