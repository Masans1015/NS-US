# W1-2 基盤スプリント ／ 最初の指示

Claude Code に最初に投げる内容。上から順に。

> **v1.1 での改定**: W1 は稼働 **12h**（9/1が火曜のため）、W2 は 15h。
> W1 のスコープに **集計スクリプト**（ADR-010）、W2 に **`schema_version` 検証**（DoD 8項）を追加した。
> W3 の A15 着手は W3-5 の3週に広がっている（W4 は祝日3日で稼働6h）。前提は `docs/plan.md`。

---

## 1. 前提の確認（必ず最初に）

```
CLAUDE.md と docs/plan.md と docs/decisions.md を読んで、以下を答えて。
- このプロジェクトで core に書いてはいけないものは何か
- A15 の Go基準は何か
- 私が今すぐ埋めなければいけない空欄はどこか
- 今期の着手対象は何本で、次期送りにしたのはどれとどれか。その理由は何か
- 期限が最も近い未解決事項は何か
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
   - 「使わなかった機会」も1レコード出せること（G1が機会利用率で判定されるため。ADR-004）

2. telemetry の集計スクリプト（ADR-010）
   - jsonl を読み、docs/externalization-kit.md の「集計の型」で出力する
   - 削減時間 = baseline − (actual + manual_fix)。中央値とレンジ(p25-p75)、件数併記、n<10 は提示しない
   - baseline.method が assumption のレコードは集計から除外し、除外件数を表示する

3. org-profile のローダー
   - ファイル選択で読み込み、schema でバリデーション
   - core と org-profile の schema_version の一致を検証し、不一致なら停止する（DoD 8項）
   - delivery / document / legal が空でも動くこと

4. アプリの共通シェル（単体HTML）
   - ライト/ダーク両対応、レスポンシブ
   - 冒頭にデータ区分表を置く領域
   - LLM 呼び出しは ADR-006 の規約をここに1箇所だけ実装する（refusal 処理を含む）
   - 依存は CDN のみ、ビルドツールなし

まず 1 だけ作って、動かして見せて。同時に進めない。
```

1 と 2 を同じ週に置くのは、**出力しただけでは削減時間が出ない**から。
集計手段のないtelemetryは外販根拠にならない。スキーマが手元にある状態で作るのが最も安い。

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
手順の全文は `docs/baseline-measurement.md`。**実測は W1 の初日（09/01）から通常業務と並行して開始する。**

- 直近の見積作成を3件、所要時間を計る（**手直し時間を含める。Before と After で計測範囲を揃える**）
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
- スコープが広がる提案が来たら `docs/requirements.md` の見送りリストと `docs/decisions.md` を見せて判断する
- 稼働は174hしかない。削る提案を歓迎する
- 毎週金曜に `docs/plan.md` §8 の週次リズムを回す。残工数・残バッファ・未解決事項の期限を突き合わせる
