● G-MAI 開発環境セットアップ手順

  1. リポジトリをクローン

  git clone https://github.com/chanitarou/G-MAI.git
  cd G-MAI

  2. 依存関係インストール

  # ルート
  npm install

  # 各アプリ
  cd case-search-rag-main && npm install && cd ..
  cd file-masking-main && npm install && cd ..
  cd generate-business-flow-main/frontend && npm install && cd ../..

  3. 環境変数の設定

  業務フロー図AI（必須）
  # generate-business-flow-main/backend/src/.env を作成
  CLAUDE_API_KEY=sk-ant-api03-xxxxx
  PORT=3002

  # generate-business-flow-main/frontend/.env.local を作成
  NEXT_PUBLIC_PROXY_BASE_URL=http://localhost:3002

  事例検索RAG（オプション）
  # case-search-rag-main/.env を作成
  VITE_DIFY_CHAT_API_KEY=xxxxx

  マスキングチェッカー（オプション）
  # file-masking-main/.env を作成
  VITE_GEMINI_API_KEY=xxxxx

  4. 起動

  npm run start-all

  5. アクセス

  - トップページ: index.html を直接開く
  - 事例検索RAG: http://localhost:5173
  - マスキングチェッカー: http://localhost:5174
  - 業務フロー図AI: http://localhost:3000
