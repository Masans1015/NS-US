# W1-2 基盤スプリント ／ 最初の指示

Claude Code に最初に投げる内容。上から順に。

---

## 1. 前提の確認（必ず最初に）

```
CLAUDE.md と docs/requirements.md を読んで、以下を答えて。
- このプロジェクトで core に書いてはいけないものは何か
- A15 の Go基準は何か
- 私が今すぐ埋めなければいけない空欄はどこか
```

答えがずれていたら、CLAUDE.md の書き方が悪い。修正してから進む。

---

## 2. W1: 基盤

```
W1 の基盤スプリントを始めたい。以下の順で作って。

1. telemetry の記録・エクスポート機能を単体JSモジュールとして実装
   - schemas/telemetry.schema.json に準拠
   - localStorage は使わない。JS変数で保持し、JSON Lines でダウンロード
   - manual_fix_minutes と consent は必ず入力させる（省略不可）

2. org-profile のローダー
   - ファイル選択で読み込み、schema でバリデーション
   - delivery / document / legal が空でも動くこと

3. アプリの共通シェル（単体HTML）
   - ライト/ダーク両対応、レスポンシブ
   - 冒頭にデータ区分表を置く領域
   - 依存は CDN のみ、ビルドツールなし

まず 1 だけ作って、動かして見せて。3つ同時に進めない。
```

telemetry を最初に作るのは、これが後から遡って取得できない唯一のデータだから。

---

## 3. W2: 評価の型

```
W2。評価の型を作る。

1. schemas/rubric.schema.json に準拠した A15 用 rubric を core/A15.rubric.json として起こす
   - docs/requirements.md の「アプリ別の閾値」に従う
   - 判定方法は deterministic を最優先。llm_judge は最小限に

2. 採点ランナー
   - evalset を読み、rubric で採点し、加重スコアと足切り判定を出す
   - llm_judge 項目は同一入力3回採点し標準偏差を出す

3. インジェクション点検チェックリスト（A11/A18 用）
```

---

## 4. W3: A15 着手

**着手前に必ず実測すること。** これをやらずに始めると、後で削減率が主張できなくなる。

- 直近の見積作成を3件、所要時間を計る
- 過去案件の見積と実績の乖離率を3件拾う
- `org/org-profile.rcg.json` の `delivery.estimation_baseline[]` に入れる（`source: "measured"`, `sample_n: 3`）
- `docs/requirements.md` の A15 の「現状値 Before」を埋める

```
A15 ワークプラン／工数見積キットを作る。
docs/requirements.md の A15 の節を読んで、まず core/A15.system.md（判断ロジック）を書いて。
会社固有は一切書かず、org-profile から差し込む前提で。
書けたら ./scripts/check-separation.sh を実行して確認して。
```

---

## 進めるときの約束

- 一度に1つ。3つ同時に指示しない
- コミット前に必ず `./scripts/check-separation.sh`
- スコープが広がる提案が来たら `docs/requirements.md` の見送りリストを見せて判断する
- 週15hしかない。削る提案を歓迎する
