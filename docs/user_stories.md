# ユーザーストーリー一覧

本ドキュメントは、`user_requirements.md`, `domain_model.md`, `system_architecture.md` で定義された全仕様を網羅する開発タスクリストである。

## 1. Data Platform (統合データ基盤)

### 1.1 Master Data Context (基礎データ)
- **US-001: ポケモン基本データの取り込み (Species/Stats)**
  - **Source**: PokeAPI / Showdown GitHub.
  - **AC**:
    - Gen9対応の全ポケモンに加え、**将来的な『ポケモンチャンピオンズ』での再登場を見越してメガシンカ・ダイマックス・キョダイマックス等のフォルムデータも網羅して取得**される。
    - 種族値・タイプ・特性がBronzeテーブルに格納され、`dim_pokemon` (Silver) から参照可能になる。
- **US-002: 技・アイテムデータの取り込み (Moves/Items)**
  - **Source**: PokeAPI / Showdown GitHub.
  - **AC**:
    - 技の威力・命中・優先度・範囲(Target)・追加効果が構造化データとして保存される。
    - `dim_moves`, `dim_items` が作成される。
- **US-003: 習得技データの構築 (Learnset)**
  - **Source**: Showdown/PokeAPI.
  - **AC**:
    - ポケモンIDと技IDの中間テーブル `dim_pokemon_learnset` が作成される。
    - (可能な場合) タマゴ技・マシン技・レベル技の区分が保持される。
- **US-004: タイプ相性表の構築 (Type Chart)**
  - **Source**: PokeAPI.
  - **AC**:
    - 攻撃タイプ x 防御タイプの倍率マトリクス `dim_type_chart` が作成される。
- **US-005: 辞書ベースの名寄せ (Normalization)**
  - **Process**: dbt / SQL.
  - **AC**:
    - `dim_term_dictionary` テーブルに基づき、Rawデータの表記揺れ（"ハバカミ"等）が正規IDに変換される。
    - 辞書にない単語は `err_unknown_terms` テーブルに隔離される。

### 1.2 Market Intelligence Context (市場分析)
- **US-010: Pokemon HOME使用率の自動収集**
  - **Source**: `resource.pokemon-home.com` API.
  - **AC**:
    - 日次バッチ(Cloud Run Jobs)でJSONを取得し、GCSにHivePartition形式(`dt=YYYY-MM-DD`)で保存する。
    - ランキング順位、技採用率、持ち物採用率、テラスタイプ採用率がBigQueryにロードされる。
- **US-011: 外部ブログ記事のクローリング**
  - **Source**: Note, Hatena (via Google Custom Search API).
  - **AC**:
    - 指定キーワード（"構築記事" 等）で日次検索を実行する。
    - 重複URLを除外し、タイトル・URL・著者・本文要約を保存する。
    - 海外サイト(VictoryRoad, Smogon)も対象に含める。

### 1.3 Match Ingestion Context (対戦データ取込)
- **US-020: Gemini 3 Proによる動画解析パイプライン**
  - **Process**: Cloud Run Jobs -> Vertex AI / AI Studio.
  - **AC**:
    - YouTube動画URLを入力(またはPolling検知)すると、Gemini 3 ProがAPI経由でアクセスする（Direct URL Analysis）。
    - 動画から「自分/相手の選出6体」「対戦結果(Win/Loss)」「選出4体」を抽出し、JSONとして出力する。
    - Geminiの解析ログJSONがGCSの `raw/video_logs/` に保存される。
- **US-021: 対戦ログの正規化とDB登録**
  - **Process**: GCS -> BigQuery.
  - **AC**:
    - GCS上の解析JSONが解析され、`fct_match_record` テーブルにINSERTされる。
    - ポケモン名等のテキストが名寄せ処理を通過する。
- **US-022: 解析結果のHuman-in-the-Loop修正**
  - **UI**: Next.js App.
  - **AC**:
    - ユーザーはAIの解析結果（選出ミス等）をGUI上で手動修正し、「確定」できる。

## 2. Application Core (アプリケーション機能)

### 2.1 Team Building Context (構築管理)
- **US-101: チームCRUDとバージョン管理**
  - **AC**:
    - チーム名、レギュレーション、コンセプトを登録できる。
    - 既存チームをコピー(Fork)して新しいバージョン(v1.1)を作成できる。
    - チームデータがLocal DB (`dim_my_team`) に保存される。
- **US-102: スロット詳細編集 (Custom Pokemon)**
  - **AC**:
    - ポケモン、特性、性格、持ち物、テラスタイプを選択できる。
    - 努力値(EVs)をスライダー操作し、実数値がリアルタイム連動する。
    - 技構成を4つまで設定できる（習得技チェックあり）。
- **US-103: 定量指標のリアルタイム計算**
  - **Logic**: Domain Model `BaseSpec.QuantitativeMetrics`.
  - **AC**:
    - **火力指数 (Power Index)**: 攻撃実数値 × 技威力 × 補正 を各技ごとに表示。
    - **耐久指数 (Durability Index)**: 物理(HxD/0.411)、特殊(HxB/0.411)、総合指数を表示。
- **US-104: 調整意図の言語化 (Adjustment Intent)**
  - **AC**:
    - 各スロットに「調整意図メモ」欄を用意する。
    - 「C187ハバタクカミのムーンフォース確定耐え」等のテキストを保存できる。
- **US-105: 選出・立ち回り想定 (Matchup Strategy)**
  - **AC**:
    - 主要な仮想敵アーキタイプ（vs 雨パ等）ごとの基本選出（先発/後発）とGamePlanメモを登録できる。

### 2.2 Battle Analysis Context (対戦分析)
- **US-201: 対戦詳細ビューと振り返り**
  - **AC**:
    - 自分と相手のパーティ、選出、勝敗、ログを表示する。
    - **Turn Review**: 各ターンの行動に対してGood/Badの評価メモを残せる。
    - **Key Turn**: 勝敗を分けたターンをタグ付けできる。
- **US-202: 敗因の構造化分析 (Gap Analysis)**
  - **Logic**: 敗因を以下3つに分類して選択保存する。
    1. **Knowledge Gap** (知識不足)
    2. **Design Gap** (構築欠陥)
    3. **Play Gap** (プレイングミス)
- **US-203: チームパフォーマンス分析 (Stats)**
  - **AC**:
    - 特定バージョンのチームにおける「総合勝率」「対戦数」を表示。
    - メンバーごとの「選出率」「選出時勝率」を可視化。
    - **Kill/Death Log**: 誰を倒したか/誰に倒されたかの集計ランキングを表示。

### 2.3 Meta Dashboard Context (環境分析)
- **US-301: Tier List 作成ボード**
  - **AC**:
    - 取得した使用率データを参考に、ドラッグ&ドロップでS〜Cランクに分類できる。
    - 作成したTier表を保存できる。
- **US-302: アイデア・仮説ボード (Idea Board & Hypothesis)**
  - **AC**:
    - 気になるWeb記事や動画URLをクリップし、タグ付け保存できる。
    - 「○○が流行っているので××が刺さる」等の仮説(Hypothesis)を構造化データとして作成・管理できる。

### 2.4 AI Copilot Context (対話支援)
- **US-401: Context-Aware Chat**
  - **Tech**: Vercel AI SDK + RAG.
  - **AC**:
    - チャット画面で質問できる。
    - RAG: 自分のチーム情報、直近の対戦ログ、およびマスタデータ（種族値等）をコンテキストとして回答生成する。
- **US-402: ダメージシミュレーション**
  - **AC**:
    - 「この盤面で倒せる？」等の質問に対し、天候・フィールド・能力ランクを含めたダメージ計算確率を返す。

## 3. Feedback & Governance (還流・運用)

### 3.1 Feedback Loop
- **US-501: Discord Daily Report**
  - **Trigger**: 毎朝 07:00 JST (Cloud Scheduler).
  - **AC**:
    - 昨日の戦績サマリ（勝敗数）をDiscordに通知。
    - 新着収集記事のタイトルと3行要約をDiscordに通知。
- **US-502: Trend Alert**
  - **Trigger**: データ更新時.
  - **AC**:
    - Pokemon HOME使用率データの前日比を計算し、急上昇(例: +10%以上)したポケモンがいれば即座に通知する。
- **US-503: Unknown Term Notification (Data Governance)**
  - **Trigger**: dbt / BigQuery Alert.
  - **AC**:
    - 名寄せ辞書マッチングに失敗した単語(Unknown Term)があればDiscordに通知する。

### 3.2 Infrastructure & Security
- **US-901: Local Docker Environment**
  - **AC**:
    - `docker-compose up` 1つで Next.js, PostgreSQL が起動する。
    - PostgreSQLのデータはVolumeで永続化される。
- **US-902: Cloud Resource Setup**
  - **AC**:
    - GCSバケット、BigQueryデータセット、Cloud Run JobsがTerraform等（または手動手順書）で再現可能である。
    - GCSバケットにはLifecycle Policy（90日/180日保存）が設定される。
- **US-903: Local DB Backup to Cloud**
  - **AC**:
    - ローカルDBのデータ(`pg_dump`)を指定頻度でGCS `raw/user_db_dump/` へアップロードするスクリプト/機能がある。
- **US-904: Secret Management**
  - **AC**:
    - API Key等は`.env`およびGCP Secret Managerで管理され、Gitにはコミットされない。
