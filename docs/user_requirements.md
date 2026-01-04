# ユーザー要件定義書

## 1. プロジェクト概要
**プロジェクト名**: Road to WCS (Pokemon Battle Analysis Platform)
**目的**: ポケモンWCS出場を目指す私（ユーザー）が、自身の対戦を客観的・定量的に分析し、効率的な知識定着とプレイング・構築精度向上を実現するための統合プラットフォームを構築する。

**コアコンセプト**: **「Hybrid Data Strategy (Local Agility + Global Intelligence)」**
個人の活動（構築・対戦）はローカル環境で高速に管理しつつ、世界中の膨大な対戦データやメタ情報はクラウドの強力なデータ基盤で処理する。
Gemini 3 Proを活用して非構造化データ（動画・記事）を「知識」に変え、データドリブンな意思決定を支援する。

## 2. ユーザーの課題 (Current Pains)
- **情報の非対称性**: 上位プレイヤーが持つ「暗黙知（ダメージ感覚、Sライン調整、メタ読み）」を言語化・定量化できていない。
- **振り返りの質**: 敗因が「運負け」なのか「構築負け」なのか「プレミ」なのかの切り分けが曖昧で、次に活かせていない。
- **データ入力の負荷**: 対戦記録を手動でつけるのが手間であり、継続できない。
- **情報の散逸**: X、構築記事、動画など、有益な情報がフロー型で流れてしまい、ストック化されていない。

## 3. 目指す姿 (To-Be)
- **Quantitative Team Building**: 「なんとなく」ではなく、「火力指数」「物理耐久指数」「仮想敵への確定数」に基づいて構築を組める。
- **Automated Ingestion**: YouTubeのURLを貼るだけで、Geminiが自動で対戦ログを作成してくれる。
- **Gap Analysis**: 敗因が「Knowledge / Design / Play」のどこにあったかを明確にし、弱点を重点的に補強できる。
- **Active Feedback**: 自分から見に行かなくても、Discordに「今日の気づき」「新着の注目記事」が届く。

## 4. 機能要件 (Domain Contexts)

### 4.1 Data Platform & Knowledge Base (データの収集・統合)
- **Knowledge Acquisition (外部データ収集)**:
  - **Master Data**: 公式データ(PokeAPI/Showdown)のバージョン管理。DLC/パッチ対応。
  - **Meta Stats**: Pokemon HOMEのリソースから使用率ランキング・技採用率を日次取得。
  - **Market Intelligence**: ブログ(Note/Hatena)や海外サイト(VictoryRoad/Smogon)から構築記事・考察を収集。
- **Data Governance (データ品質管理)**:
  - **Normalization**: 表記揺れ（例: "ハバカミ"⇄"ハバタクカミ"）を辞書ベースで正規化。
  - **Human-in-the-Loop**: 未知の単語検知時にDiscord通知し、ユーザーが正しいマッピングを登録するフロー。

### 4.2 Application Core (分析・活用アプリケーション)
**Platform**: Local Docker (Next.js 16 + PostgreSQL)

- **Team Building Context (構築管理)**:
  - **Quantitative Metrics**: ポケモンごとの「火力指数(PowerIndex)」「耐久指数(DurabilityIndex)」を自動計算。
  - **Adjustment Intent**: 「C187ハバタクカミのムーンフォース確定耐え」等の調整意図を言語化して保存。
  - **Version Control**: 構築の微調整履歴を管理。

- **Battle Analysis Context (対戦分析)**:
  - **Gap Analysis**: 敗因を3層（Knowledge / Design / Play）に分類してタグ付け。
  - **Team Performance**: 構築バージョンごとの「選出率」「勝率」「Kill/Deathランキング」を可視化。

- **Match Ingestion Context (データ取込)**:
  - **Video Analysis**: YouTube URLを入力するだけで、Gemini 3 Proが「選出」「勝敗」「対戦ログ」を抽出。
  - **Direct URL**: 手動での動画ダウンロード/アップロードは不要。Cloud Run -> Gemini (Direct Query) -> BigQueryのフロー。

- **Meta Dashboard Context (環境分析)**:
  - **Tier List**: 使用率データを元に現在のTier表を作成・編集。
  - **Idea Board**: 気になる記事やツイートをクリップし、メモを残す。

- **AI Copilot Context (対話型支援)**:
  - **Advisor**: 「今の構築で重いポケモンは？」等の質問に対し、RAG技術を用いて回答。
  - **Simulator**: ダメージ計算機と連携し、「この盤面で倒せる確率は？」を即座に提示。

### 4.3 Feedback Context (還流)
- **Discord Integration**:
  - **Daily Report**: 前日の戦績サマリ、新着記事要約を毎朝配信。
  - **Trend Alert**: 特定のポケモンの使用率急増などをリアルタイム通知。

## 5. 技術要件 (System Architecture)

### 5.1 System Configuration (Hybrid Architecture)
コスト最適化と開発効率のため、**Local Environment** と **Google Cloud** を使い分ける。

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **App & DB (Local)** | **Docker** (Next.js 16, PostgreSQL) | アプリケーションUI、その場でのデータCRU、SoRデータの保持。 |
| **Ingestion (Cloud)** | **Cloud Run Jobs** | クローラー、API Fetcher。 |
| **AI Engine (Cloud)** | **Gemini 3 Pro** (via AI Studio API) | 動画のマルチモーダル解析。Context Caching活用。 |
| **Data Lake (Cloud)** | **Google Cloud Storage (GCS)** | Raw JSON, Video Logsの保存。Hive Partitioning構成。 |
| **Data Warehouse (Cloud)**| **BigQuery** | 分析用DWH。Bronze/Silver/Goldの3層スキーマ。 |

### 5.2 Data Pipeline & Schema
- **ELT Pattern**: RawデータをGCSにLoadし、dbt (Data Build Tool) で変形・正規化する。
- **Schema Tiers**:
  - **Bronze**: Raw Data (External Tables + Local DB Dump).
  - **Silver**: Normalized Data (Master結合, 名寄せ済み). **`dim_pokemon_learnset`**, **`dim_type_chart`** を含む。
  - **Gold**: Data Mart (TierList, TeamPerformance等).

### 5.3 Security & CI/CD
- **Single User Mode**: 自分専用アプリのため、認証機能は省略（または簡易的なBasic認証のみ）。
- **Secret Management**: 
  - Local: `.env` ファイルで管理。
  - Cloud: Secret Manager (GCP) で管理。
  - CI/CD: **GitHub Actions Secrets / Environments** を活用し、キー情報をリポジトリに含めない。

### 5.4 Documentation
- **README.md**:
  - CI/CDで完全に自動化できない手動手順（例: 初期セットアップ、トークン取得、特定データのパッチ適用）については、`README.md` に詳細な手順を記載し、誰でも（未来の自分でも）再現可能にする。
