# プロジェクト名
> プロジェクトの概要を1〜2文で記述します。例: 「AIを活用した業務フロー生成ツール」

## 🧭 概要

- 目的: このプロジェクトが解決する課題や価値
- 主要機能: 例) フロー図生成 / プロンプト管理 / ストリーミング可視化
- 対応プラットフォーム: 例) Web (FastAPI + JS), CLI, etc.
- 関連リポジトリ/ドキュメント: DEMO-UI.md (./DEMO-UI.md), CLAUDE.md (./CLAUDE.md)

## 🏗️ アーキテクチャ

```
├─ backend/          # FastAPI / APIロジック
│   └─ src/          # app.py, api/, services/, prompts/, static/ など
├─ frontend/         # Next.js 14 (App Router)
├─ data/             # 出力例やサンプルデータ
└─ tests/            # Pytestベースの自動テスト
```

- Frontend詳細:

```
frontend/
├─ app/            # App Router (layout, page, about, contact, loading, not-found, favicon)
├─ components/     # common(Logo), layout(Header/Footer/Navigation), ui(Button/Card/Modal)
│   └─ ui/bitFlowSections  # Chat/Diagram等のTSXとbitFlowProxyDemoロジック
├─ features/       # 機能単位のUI（例: BitFlowExperience）
├─ hooks/          # useTheme / useFetch などのカスタムフック
├─ lib/            # api-client.ts, config.ts, utils.ts
├─ styles/         # globals.css, variables.css
├─ constants/      # ルート等の定数
├─ types/          # 共通型定義
├─ data/           # サンプルJSON
└─ public/         # images / fonts
```

- 詳細図: [随時追記]

## 🚀 セットアップ

```
  git clone <REPO_URL>
  cd frontend && npm install       # Next.js デモUI
```

- 追加の依存がある場合は追記してください (例: npm install 等)

## ⚙️ 主要コマンド

| 目的 | コマンド |
| --- | --- |
| 開発用API起動 |npm run dev |
| 構文チェック | cd backend && python -m compileall -q src |
| テスト実行 | pytest |
| フロントエンド静的書き出し | cd frontend && npm run export *(out → backend/src/static へ自動同期)* |

## 🔑 設定項目

| 変数名 | 役割 | 設定例 |
| --- | --- | --- |
| CLAUDE_API_KEY | Claude APIキー | .env または環境変数に設定 |
| PORT | FastAPIポート | 3002 |
| ANTHROPIC_API_URL | APIエンドポイント | デフォルト値があれば記載 |
| NEXT_PUBLIC_PROXY_BASE_URL | Next.js デモUIから参照するFastAPIエンドポイント | http://localhost:3002 |

- 必要に応じて .env.example を用意してください。

## 🧪 テスト

- 単体テスト: pytest
- ストリーミング/手動検証: 例: curl -N localhost:3002/api/...
- 追加の検証手順があれば箇条書きで記載

## 📦 デプロイ手順

1. docker build -t <image_name> .
2. docker run -p 3002:3002 <image_name>
3. CI/CDやクラウド環境固有の手順は追って追記

## 📄 ライセンス

- LICENSE (./LICENSE) を参照してください（未定の場合は“未定”などでプレースホルダ）

## 🤝 コントリビューション

1. Issue作成 → ブランチ作成 (feat/xxx)
2. 変更とテスト
3. PR作成 (背景・実装・検証手順を記載)
4. レビュー結果を反映

## 📞 サポート

- 担当者: TBD
- 連絡方法: support@example.com / Slack #bit-flow
- 障害対応手順やSLAがあれば併記

———

  必要な項目があれば適宜セクションを追加してください。
