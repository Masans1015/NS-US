# A15 実装状況

対象: `apps/A15/index.html`（v0.1.0）／設計は `docs/specs/A15-design.md`

---

## 動くもの

| | 状態 |
|---|---|
| org-profile のファイル読込＋`schema_version` 検証（不一致で停止） | ✓ |
| データ区分表を `policy.data_classification` から生成（ハードコードなし） | ✓ |
| 案件概要 → WBS・レンジ・バッファ根拠・前提・不確実性・不足情報 | ✓ |
| 出どころ（`basis`）を全タスクに表示、判断・類推の比率を警告 | ✓ |
| rubric C1・C5 の機械判定をその場で表示（自己検品） | ✓ |
| telemetry 記録（`manual_fix_minutes`・`consent` は省略不可） | ✓ |
| 未利用機会の記録（`task.used=false`、ADR-004） | ✓ |
| JSON Lines 書き出し | ✓ |
| ライト／ダーク・レスポンシブ | ✓ |

### 検証済み（ヘッドレス Chromium で実行）

20項目の機能テストが全通過。書き出した実レコード2件を
`schemas/telemetry.schema.json`（1.1）に対して検証し、両方とも準拠を確認した。

集計仕様の検算も通っている ─ 機会2件／利用1件で利用率50%、
削減時間 `90 − (25 + 0) = 65分`、`method: measured` なので集計対象。

---

## まだ無いもの

| | いつ |
|---|---|
| `eval/A15.evalset.json` 20件 | W3-W4 |
| 採点ランナー `scripts/score.mjs` での P3 判定 | W5 |
| G5 可搬性テスト（`org-profile.generic.json` と `claude-sonnet-5` で再採点） | W5 |
| `lib/` への共通シェル切り出し | 2本目（A03）の着手時 |
| `delivery.estimation_baseline[]` の実データ | W6 まで（ADR-015） |

---

## 実キーでの未検証事項

**ブラウザから Anthropic API を直接呼ぶ経路は、まだ実キーで通していない。**
テストは `fetch` をモックして描画・検品・telemetry の経路を確認したもので、
API との実通信は含まれていない。

`apps/A15/index.html` の `callLLM()` は次のヘッダを送っている。

```
x-api-key
anthropic-version: 2023-06-01
anthropic-dangerous-direct-browser-access: true
```

最後の1つは、ブラウザからの直接呼び出しを許可する宣言として付けた。
**この名前と要否は実キーで確認していない。** CORS で弾かれた場合は次のいずれかへ倒す。

1. ヘッダ名・要否を実際のエラーに合わせて直す（軽い）
2. それでも通らなければ、A15 は自分専用なのでローカルの薄い中継を挟む（TierA の主旨からは外れるので最後の手段）

**最初の実キー実行で必ず確認すること。** ここが通らないと LLM層3本（A15・A11・A09）が同じ壁に当たる。

---

## 設計判断の記録

- **共通シェルは切り出していない。** 1本目は最小限を同梱し、2本目で `lib/` へ出す方針
  （実際の共有ニーズを見てから汎用化する。過剰設計を避ける）
- **`output_config.format` の構造化出力を使い、prefill は使っていない**（400になるため。ADR-006）
- **`stop_reason` を `content` より先に見ている。** 逆にすると refusal の空結果を正常な見積として表示してしまう
- **自己検品を画面に出した。** rubric の C1・C5 は機械判定できるので、採点ランナーを待たずに
  利用のたびに見える。評価セットが揃う前でも出力の破綻に気づける
