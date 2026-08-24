# W1-W2 基盤の実装仕様

対象: W1（09/01-09/06, 12h）／W2（09/07-09/13, 15h）＝ **27h**
前提: `docs/plan.md` §3、`docs/decisions.md` ADR-006・ADR-010・ADR-011・ADR-012

基盤はアプリではないので P1ゲート（Before実測）の対象外。**09/01 から着手できる唯一の作業。**

---

## 0. ファイル配置

```
lib/                      共通シェル（ソース。ここが唯一の実装場所）
  telemetry.js            記録・検証・エクスポート
  org-profile.js          読込・schema検証・version検証
  llm.js                  Anthropic API 呼び出し（ADR-006の規約を1箇所に）
  ui.js                   テーマ・レスポンシブ・データ区分表
apps/{app_id}/index.html  アプリ本体（<!-- @inline lib/xxx.js --> マーカーを持つ）
dist/{app_id}.html        配布物（単体HTML。マーカーを展開したもの）
scripts/build.sh          apps/ → dist/ のインライン展開
scripts/aggregate.mjs     telemetry 集計（開発時のみ・Node）
scripts/score.mjs         採点ランナー（開発時のみ・Node）
```

`lib/` は core でも org でも render でもない**インフラ層**。判断ロジックを置かない。
置いていいのは「記録の型」「読込」「API呼び出し」「見た目の器」だけ。
分離検査の対象外だが、`lib/` に会社固有語を書かないこと（`scripts/check-separation.sh lib` で任意に検査できる）。

`dist/` は生成物なので `.gitignore` に入れる。**配布するのは `dist/` の単体HTML**（ADR-011）。

---

## 1. W1（12h）

### T1.1 `lib/telemetry.js` 記録の組み立てと検証 — 2.5h

```js
Telemetry.start({ app_id, app_version, org_id, task })   // 計測開始。開始時刻を保持
Telemetry.finish({ actual, quality, governance, consent, free_note })  // レコード確定
Telemetry.skip({ app_id, task, free_note })              // 未利用機会を1件記録（ADR-004）
Telemetry.records()                                       // 保持中のレコード配列
Telemetry.export()                                        // JSON Lines でダウンロード
```

- `record_id` は `crypto.randomUUID()`
- `recorded_at` は ISO8601（`new Date().toISOString()`）
- `schema_version` は `"1.1"` 固定。`schemas/telemetry.schema.json` と不一致なら**投げる**
- `additionalProperties: false` なので、スキーマにないキーを渡されたら**投げる**（黙って落とさない）
- **localStorage / sessionStorage を使わない。** レコードは JS 変数（モジュールスコープの配列）に持つ

**受け入れ条件**
- スキーマ必須項目が欠けたレコードで `finish()` を呼ぶと例外になる
- 合成レコード10件を作り、`schemas/telemetry.schema.json` で全件通る
- ページを再読込するとレコードが消える（＝ストレージを使っていないことの確認）

### T1.2 エクスポートと未利用機会 — 1.5h

- `export()` は `{app_id}.{YYYY-MM}.jsonl` という名前で `Blob` ダウンロード。1行1レコード、末尾改行あり
- `skip()` は `task.used = false`、`actual.minutes = 0`、`free_note` 必須。`baseline` と `quality` は付けない
- `free_note` が空文字なら `skip()` は**投げる**（理由のない未利用記録は分母を汚すだけ）

**受け入れ条件**
- 利用3件＋未利用2件を出力し、`aggregate.mjs` が機会5件・利用率60%と出す

### T1.3 入力UIの省略不可化 — 1.5h

`docs/externalization-kit.md` が「後付けが効かない2項目」と書いているものを、UI で強制する。

| 項目 | 扱い |
|---|---|
| `actual.manual_fix_minutes` | **省略不可**。未入力では確定ボタンを押せない。0 は明示的な0として受ける |
| `consent.external_citation_anonymized` | **省略不可**。ラジオで yes/no を選ばせる。既定値を置かない |
| `baseline.minutes` / `baseline.method` | 任意。ただし `method` を選ばずに `minutes` だけ入れることは不可 |
| `quality.accepted_without_rework` | 任意だが既定で表示する（削減率と併記するため） |

**受け入れ条件**
- `manual_fix_minutes` 空欄では確定できない
- `consent` 未選択では確定できない
- 「0分」と「未入力」が区別されている（`0` と `undefined` が別に記録される）

### T1.4 `scripts/aggregate.mjs` — 3.5h

`node scripts/aggregate.mjs telemetry/*.jsonl [--app A15] [--weeks 4]`

§3 の指標定義に従って算出し、標準出力に表を出す。

**受け入れ条件**
- `baseline.method === "assumption"` のレコードが削減時間の集計から除外され、**除外件数が表示される**
- n<10 のとき削減率が数値ではなく `n=7（10件未満のため非提示）` と出る
- `saved` が負のレコードが除外されず、中央値に反映される
- 同一 `record_id` が重複していたら1件に畳み、重複件数を表示する

### T1.5 指標定義の確定と動作確認 — 2h

§3 を確定させ、合成10件で aggregate を通す。**ここで式を確定させないと、以降のデータが全部使えなくなる。**

### T1.6 予備 — 1h

---

## 2. W2（15h）

### T2.1 `lib/org-profile.js` — 3h

```js
OrgProfile.load(file)   // File → 検証済みオブジェクト。失敗は throw
OrgProfile.get()        // 読込済みプロファイル
```

- `<input type="file">` で読む。**アプリに埋め込まない**（埋め込んだ瞬間に差し替え不能になる）
- `schemas/org-profile.schema.json` で検証する（必須は `schema_version` / `org` / `policy`）
- **`delivery` / `document` / `legal` が空でも通す。** これが外販時の初期状態
- `schema_version` が core 側の期待値と不一致なら**停止**（DoD 8項）。警告で続行しない

**受け入れ条件**
- `policy` だけのプロファイルで正常に起動する
- `schema_version` を変えたプロファイルで起動が停止し、期待値と実際値の両方が画面に出る
- 不正JSONで、行番号を含むエラーが出る

### T2.2 `lib/llm.js` — 3h

ADR-006 の規約を**ここ1箇所だけ**に実装する。アプリ側からモデル名やパラメータを触らせない。

```js
const MODEL = { PRIMARY: 'claude-opus-5', ALT: 'claude-sonnet-5' };
LLM.setKey(key)                              // セッション中のみJS変数で保持
LLM.call({ system, user, schema, effort })    // 構造化出力を返す
LLM.available()                              // キー未設定なら false
```

- `thinking: { type: 'adaptive' }`。`budget_tokens` は渡さない（400になる）
- 出力は `output_config: { format: schema }`。**assistant prefill を使わない**（400になる）
- `effort` は `output_config.effort`。既定 `high`、単純抽出は `low`
- **`stop_reason === 'refusal'` を `content` を読む前に確認する。** refusal なら `stop_details.category` を添えて throw
- 長文入力は streaming。非streaming の `max_tokens` は 16000
- `system`（core のプロンプト＋org-profile）に `cache_control` を置く。1024トークン未満はキャッシュされない
- `LLM.available() === false` でもアプリが動くこと（ADR-005 の A03/A04 要件）

**受け入れ条件**
- キー未設定で `available()` が false を返し、アプリの本体機能が動く
- refusal 応答（モック）で例外になり、**空の結果が「該当なし」として画面に出ない**
- `budget_tokens` や prefill を渡そうとするコードが `lib/` の外に存在しない（grep で確認）

### T2.3 `lib/ui.js` 共通シェル — 3h

- ライト／ダーク両対応。`prefers-color-scheme` と明示切替の両方（DoD 3項）
- レスポンシブ
- **冒頭にデータ区分表を置く領域。** `policy.data_classification[]` から生成する（ハードコードしない）
- 利用手引きを開く領域（DoD 5項）
- 起動時の検証結果（schema_version 一致・org-profile 読込状態）を常時表示

**受け入れ条件**
- 別org-profile（区分が3段のもの）を読ませると、区分表が3段で描かれる
- 幅360pxで横スクロールが出ない

### T2.4 `scripts/build.sh` — 1h

`apps/{app_id}/index.html` の `<!-- @inline lib/telemetry.js -->` を実ファイル内容に置換して `dist/{app_id}.html` を作る。

**受け入れ条件**
- `dist/` の成果物が外部ファイル参照を持たない（CDN は除く）
- 同じ入力で2回走らせて出力が同一（冪等）

### T2.5 `scripts/score.mjs` 採点ランナー — 4h

`node scripts/score.mjs --app A15`

- `eval/{app_id}.evalset.json` を読み、`core/{app_id}.rubric.json` で採点
- `check_method: "deterministic"` は `must_include` / `must_not_include` で機械判定
- `llm_judge` は同一入力を `consistency_test.runs`（既定3）回採点し、**標準偏差を出す**
- `go_threshold.min_weighted_score` と `must_pass_criteria` で Go/No-Go を判定
- `portability_check` があれば `alternate_org_profile` で再採点し、スコア低下を出す（G5）

**受け入れ条件**
- 加重合計が1.0でない rubric を渡すとエラーになる
- `must_pass_criteria` が落ちたとき、加重スコアが閾値を超えていても **No-Go** と出る
- 標準偏差が `max_score_stddev` を超えた criteria が名指しで警告される

### T2.6 予備 — 1h

---

## 3. 指標定義（確定）

`docs/externalization-kit.md` の「集計の型」を計算式に落としたもの。**W1 で確定させ、以降変更しない。**

### レコード単位

| 指標 | 式 | 除外条件 |
|---|---|---|
| 削減時間 `saved` | `baseline.minutes − (actual.minutes + actual.manual_fix_minutes)` | `baseline` 未記録 ／ `baseline.method === "assumption"` |
| 削減率 `rate` | `saved / baseline.minutes` | 同上、および `baseline.minutes === 0` |

- `manual_fix_minutes` が `undefined` のレコードは**削減時間の集計から除外する**（0として扱わない）。
  0として扱うと削減率が過大に出る。これは v1.0 の DoD が最も警戒していた項目
- `saved` が負でも除外しない。**悪化を隠すと外販根拠として無価値になる**
- `task.used === false` のレコードは削減時間の対象外（機会利用率だけに使う）

### 集計単位

| 指標 | 式 | 提示 |
|---|---|---|
| 削減時間 | `saved` の中央値 | 中央値＋p25-p75、件数併記 |
| 削減率 | `rate` の中央値 | **n<10 は非提示**（`n=7（10件未満のため非提示）`と出す） |
| 品質維持 | `count(accepted_without_rework === true) / count(accepted_without_rework !== undefined)` | 削減率と**必ずセット**で出す |
| 機会利用率（G1） | `count(task.used !== false) / count(全機会レコード)` ※直近4週 | 機会3回未満は `判定保留` と出す（ADR-004） |
| 継続利用 | 利用日数 ／ 営業日 ※直近4週 | 参考値 |

### 出力例

```
A15  2026-09〜2026-11
  機会 14件（利用 12 / 未利用 2） 利用率 86%  → G1 通過
  削減時間  中央値 42分（p25-p75: 28-61）  n=12
  削減率    中央値 47%                     n=12
  品質維持  83%（10/12 が手戻りなし）
  除外      3件（baseline.method=assumption 2件 / manual_fix未入力 1件）
```

**除外件数を必ず出す。** 出さないと「都合のいいレコードだけ集計した数字」と区別できない。

---

## 4. 工数の内訳

| | 作業 | 時間 |
|---|---|---|
| T1.1 | telemetry 記録・検証 | 2.5h |
| T1.2 | エクスポート・未利用機会 | 1.5h |
| T1.3 | 入力UIの省略不可化 | 1.5h |
| T1.4 | aggregate.mjs | 3.5h |
| T1.5 | 指標定義の確定・動作確認 | 2.0h |
| T1.6 | 予備 | 1.0h |
| | **W1 計** | **12.0h** |
| T2.1 | org-profile ローダ | 3.0h |
| T2.2 | llm.js | 3.0h |
| T2.3 | 共通シェル | 3.0h |
| T2.4 | build.sh | 1.0h |
| T2.5 | 採点ランナー | 4.0h |
| T2.6 | 予備 | 1.0h |
| | **W2 計** | **15.0h** |

**T1.1 → T1.2 → T1.3 → T1.4 の順を崩さない。** 一度に複数を進めない（`docs/kickoff-W1.md`）。
T2 は T2.1 → T2.2 → T2.3 → T2.4 → T2.5。採点ランナーを最後に置くのは、W3 の A15 で初めて必要になるため。
