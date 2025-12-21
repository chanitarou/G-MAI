● # G-MAI

  **Gode Wide Valley Method AI** - ビジネスを加速させる生成AIプラットフォーム

  ## サービス一覧

  ### Cross Public Service（クロスパブリックサービス）
  | サービス名 | 説明 |
  |-----------|------|
  | 事例検索RAG | 過去の提案事例をAIで検索し、提案書作成を支援 |
  | 成果物マスキングチェッカー | 提案書内の企業名・個人名等のマスキング漏れを自動検出 |

  ### Cross Border Service（クロスボーダーサービス）
  | サービス名 | 説明 |
  |-----------|------|
  | 業務フロー図AI作成 | テキスト指示から業務フロー図をdrawio形式で自動生成 |

  ---

  ## セットアップ手順

  ### 1. リポジトリをクローン

  ```bash
  git clone https://github.com/chanitarou/G-MAI.git
  cd G-MAI

  2. 依存関係のインストール

  # ルート
  npm install

  # 各アプリ
  cd case-search-rag-main && npm install && cd ..
  cd file-masking-main && npm install && cd ..
  cd generate-business-flow-main/frontend && npm install && cd ../..

  3. 環境変数の設定

  業務フロー図AI（必須）

  バックエンド用（generate-business-flow-main/backend/src/.env）:
  CLAUDE_API_KEY=your-claude-api-key
  PORT=3002

  フロントエンド用（generate-business-flow-main/frontend/.env.local）:
  NEXT_PUBLIC_PROXY_BASE_URL=http://localhost:3002

  事例検索RAG（オプション）

  case-search-rag-main/.env:
  VITE_DIFY_CHAT_API_KEY=your-dify-api-key

  マスキングチェッカー（オプション）

  file-masking-main/.env:
  VITE_GEMINI_API_KEY=your-gemini-api-key

  4. 起動

  npm run start-all
  もしくは
  start-allのバッチファイルをダブルクリック

  5. アクセス

  | サービス             | URL                   |
  |----------------------|-----------------------|
  | トップページ         | index.html を直接開く |
  | 事例検索RAG          | http://localhost:5173 |
  | マスキングチェッカー | http://localhost:5174 |
  | 業務フロー図AI       | http://localhost:3000 |
  | ```                  |                       |
