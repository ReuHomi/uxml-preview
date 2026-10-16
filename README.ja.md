# uxml-preview

*[English](https://github.com/ReuHomi/uxml-preview/blob/main/README.md) · [한국어](https://github.com/ReuHomi/uxml-preview/blob/main/README.ko.md) · 日本語 · [简体中文](https://github.com/ReuHomi/uxml-preview/blob/main/README.zh-CN.md)*

**Unity UI Toolkit の UXML/USS を、Unity エディタなしでブラウザ上に描画します。レイアウトには
UI Toolkit 自身が使用する Yoga エンジンを採用し、描画結果は実際の Unity と突き合わせて検証しています。**

[![プレイグラウンド画面：上部にプレビュー画面、下部に各警告の理由と Unity 側の実際の挙動を表示](https://raw.githubusercontent.com/ReuHomi/uxml-preview/main/docs/media/playground.png)](https://reuhomi.github.io/uxml-preview/)

### ▶ [プレイグラウンドを開く](https://reuhomi.github.io/uxml-preview/)

手元の `.uxml` と `.uss` を貼り付けるか、サンプルを開いて試せます。ファイルはどこにも
アップロードされず、すべてページ内で動作します。

[![CI](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/ci.yml)
[![Pages](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml/badge.svg)](https://github.com/ReuHomi/uxml-preview/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/ReuHomi/uxml-preview/blob/main/LICENSE)

## 検証方法

- **座標：** 完成画面1件を含む40個のレイアウトケースにおいて、要素の座標値 660 / 676 が Unity 6000.0.40f1 と一致しています。[すべての差異とその内訳 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md) 同じケースを Unity 6.3（6000.3.25f1）で再ダンプしたところ、同日に取得した 6000.0.40f1 のダンプとすべての配置が一致しました。[6.3 での再測定 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#unity-63-lts-re-measurement-2026-10-15)
- **テキスト：** 実際のブラウザで描画し、Unity 6000.3.25f1 と Label 単位で比較しました。行数 60 / 60、高さ 52 / 60、幅 60 / 60（誤差 1px または 1% 以内）。高さが異なるケースはすべて、ハングルを含まない欧文フォント Inter で韓国語、または韓国語と欧文が混在するテキストを指定したものです。Unity はこれをフォールバックフォントで描画しますが、本プレビューではまさにその状況を警告として通知します。[テキスト検証セット →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#text-cohort-separate-set-measured-2026-10-16)
- **Unity バージョン：** 基準バージョンは Unity 6.3 LTS です。USS プロパティかどうかの判定は Unity 公式のプロパティ一覧（6.6 まで）に基づいており、6.7 は LTS になるまでサポート対象外です。[サポート範囲 →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md)
- **一致しない箇所は見過ごさず、警告として報告します。** 未サポートのコントロール・プロパティ・値は、その理由とともに（測定済みの場合は Unity 側が代わりにどう振る舞うかも含めて）警告として返されます。[警告について →](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md#warnings)

## 3つの使い方

| 用途 | 推奨ツール |
|---|---|
| **画面をデザインする** | ブラウザ上の[プレイグラウンド](https://reuhomi.github.io/uxml-preview/)、またはプロジェクトファイルの隣で使える [UXML Preview for VS Code](https://github.com/ReuHomi/vscode-uxml-preview) |
| **AI エージェントに UI を書かせる** | [uxml-author](https://github.com/ReuHomi/uxml-author) — UXML/USS を記述し、本ライブラリで描画・結果確認まで行ってから出力するスキル |
| **ツールを開発する** | 本ライブラリ：`npm install uxml-preview`、詳細は [API ドキュメント](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md) |

## インストール

```bash
npm install uxml-preview
```

ツール類には Node 22 以降が必要です。描画には DOM 環境（ブラウザ、またはテスト環境では
happy-dom / jsdom）が必要です。

```ts
import { loadLayoutEngine, parse, render, serialize } from 'uxml-preview';

await loadLayoutEngine();                 // Yoga は WebAssembly のため、最初に1回読み込む

const doc = parse(uxmlText, ussText);     // テキスト → モデル
const view = render(doc, container, {     // モデル → 画面
  size: { width: 1280, height: 720 },     // ウィンドウではなくパネルのサイズ
  resolveAsset: (path, form) => myAssetUrl(path, form),  // project://… → URL（なければ null）
});

for (const w of view.warnings) console.log(w.reason ?? w.kind, w.message);

view.dispose();                           // Yoga ノードはガベージコレクションされないため明示的に解放
const { uxml, uss } = serialize(doc);     // 未編集なら入力とバイト単位で一致
```

## ドキュメント

- [USS は CSS ではない](https://github.com/ReuHomi/uxml-preview/blob/main/docs/uss-vs-css.md)（英語） — CSS から移植したスタイルシートが意図通りにならない違いを実例付きで解説
- [サポート範囲](https://github.com/ReuHomi/uxml-preview/blob/main/docs/supported.en.md)（英語） — コントロール、プロパティ、ステート、バージョン、およびそれぞれの検証範囲
- [精度](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md)（英語） — すべての数値、測定方法、既知の差異一覧
- [API](https://github.com/ReuHomi/uxml-preview/blob/main/docs/api.en.md)（英語） — `parse`、`render`、`serialize`、各種フック、警告、`classifyVisibility`
- [変更履歴](https://github.com/ReuHomi/uxml-preview/blob/main/CHANGELOG.md)（英語）
- [目視比較](https://github.com/ReuHomi/uxml-preview/blob/main/docs/visual-check.md)（韓国語） — 色や質感を Unity と並べて比較した単発の検証記録（2026-08）

## 開発

```bash
pnpm install
pnpm dev            # プレイグラウンドを起動
pnpm test           # ブラウザや Unity なしで動作する全テスト
pnpm test:text      # テキスト検証セット（実際の Chromium 上で実行、docs/accuracy.en.md 参照）
pnpm build
```

Unity 側のリファレンス値を再生成するには Unity のインストールが必要です。手順は
[精度ドキュメント](https://github.com/ReuHomi/uxml-preview/blob/main/docs/accuracy.en.md#producing-the-ground-truth)にあります。

## ライセンス

Apache-2.0
