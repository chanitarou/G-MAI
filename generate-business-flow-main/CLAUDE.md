# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# BiT-Flow - 業務フロー図生成システム

BiT-Flowは、厳密な仕様ルールに従ってプロフェッショナルなスイムレーン図を作成する、drawioベースの業務フロー図生成システムです。Claude APIを使用してdrawio形式の業務プロセスフローを生成します。

## アーキテクチャ

### システム構成

```
backend/                    # FastAPI サーバー
├── src/
│   ├── app.py             # アプリケーションエントリーポイント
│   ├── api/routes.py      # エンドポイント定義
│   ├── core/              # 設定とLLM設定
│   │   ├── settings.py    # 環境変数、パス管理
│   │   └── anthropic_llm_config.yaml  # Claude モデル設定
│   ├── llm/               # LLMクライアント抽象化
│   │   ├── base_llm_client.py
│   │   └── anthropic_llm_client.py
│   ├── services/          # ビジネスロジック
│   │   ├── session_manager.py    # セッション状態とdrawioキャッシュ
│   │   └── prompt_builder.py     # プロンプト構築
│   ├── prompts/
│   │   ├── FlowGenerationPrompt.md   # 初回生成用プロンプトテンプレート（Jinja2）
│   │   └── FlowModificationPrompt.md # 修正用プロンプトテンプレート（Jinja2）
│   └── static/            # Next.jsビルド出力先

frontend/                   # Next.js 14 (App Router)
├── app/                   # ページルーティング
├── components/            # UIコンポーネント
│   └── ui/bitFlowSections # Chat/Diagram等のデモロジック
├── lib/                   # API通信ロジック
└── scripts/sync-static.mjs  # ビルド結果をbackend/src/staticへ同期
```

### 主要な処理フロー

1. **初回リクエスト**: ユーザーがフロー図生成を要求
   - `SessionManager.register_request()` で初回フラグとキャッシュを確認
   - `PromptBuilder.build_prompt()` で `FlowGenerationPrompt.yaml` の完全仕様を使用
   - `AnthropicLLMClient.stream_message()` でストリーミング生成
   - レスポンスからdrawio XMLを抽出して `SessionManager` にキャッシュ

2. **修正リクエスト**: 同一セッションで修正指示
   - キャッシュされた前回のdrawio XMLを取得
   - 修正専用プロンプトを構築（`PromptBuilder._build_modification_prompt()`）
   - 修正後の完全なdrawio XMLを再度キャッシュ

3. **ストリーミング処理**:
   - `stream_message()` は改行区切りJSONをyield
   - `content_block_delta` イベントからテキスト断片を抽出
   - `message_stop` で完全なコンテンツをキャッシュ
   - フロントエンドはリアルタイムで表示可能

### セッション管理の仕組み

- **SessionManager**: セッションIDごとに状態管理とdrawioキャッシュを保持
  - `register_request()`: 初回フラグとリクエスト回数を追跡
  - `cache_drawio_if_present()`: レスポンスから`<?xml...></mxfile>`を正規表現で抽出してキャッシュ
  - 修正リクエスト時は前回のdrawioを読み込んで差分修正を実行

### プロンプトテンプレートの役割

**すべてのプロンプトはMarkdown形式 + Jinja2テンプレートで管理**

#### FlowGenerationPrompt.md（初回生成用）

`backend/src/prompts/FlowGenerationPrompt.md` が業務フロー図生成の完全仕様を定義:

- **配色仕様**: タスク、システム、文書、接続線の標準カラーパレット
- **レイアウト戦略**: スイムレーン配置順序（外部→窓口→実務→管理→システム）
- **要素定義**: タスク、判断、データベース、文書のdrawioスタイル
- **接続ルール**: 厳密な直交矢印接続（水平/垂直のみ、斜線禁止）
- **検証ルール**: source/target属性の必須化、浮遊矢印禁止、重複接続禁止
- Jinja2テンプレート形式（現時点では動的変数なし）
- Markdown形式で記述され、読みやすく編集しやすい

**重要**: このファイルはJinja2でレンダリングされてシステムプロンプトとして使用されます。フロー図の品質はこの仕様に依存します。

#### FlowModificationPrompt.md（修正用）

`backend/src/prompts/FlowModificationPrompt.md` が既存フロー図の修正指示を定義:

- Jinja2テンプレート形式で記述
- `{{ previous_drawio }}` 変数に前回生成したdrawio XMLが埋め込まれる
- 修正ルール: 部分出力禁止、完全なXML出力、説明文不要など

## 開発コマンド

### バックエンド（FastAPI）

```bash
# 開発サーバー起動
cd backend
uvicorn src.app:app --reload --port 3002

# コードフォーマット（black）
cd backend
black src/                    # フォーマット実行
black --check src/            # フォーマットチェックのみ
black --diff src/             # 差分表示

# import文の整理（isort）
cd backend
isort src/                    # import文を整理
isort --check-only src/       # チェックのみ

# 構文チェック
cd backend
python -m compileall -q src

# テスト実行
pytest

# 環境変数設定（.envファイル）
CLAUDE_API_KEY=sk-ant-...
PORT=3002
```

### フロントエンド（Next.js）

```bash
# 開発サーバー起動
cd frontend
npm run dev

# 本番ビルド + backend/src/staticへ同期
cd frontend
npm run export

# 静的ファイル確認（ブラウザで開く）
open backend/src/static/index.html
```

## 設定ファイル

### 必須の環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `CLAUDE_API_KEY` | Anthropic APIキー（必須） | なし |
| `PORT` | FastAPIポート番号 | 3002 |
| `NEXT_PUBLIC_PROXY_BASE_URL` | フロントエンドから参照するAPI URL | http://localhost:3002 |

### .devcontainer/requirements.txt

プロジェクトの全依存関係を管理:
```txt
# 本番依存
fastapi==0.111.0
uvicorn==0.30.1
httpx==0.27.0
pydantic==2.12.4
python-multipart==0.0.20
pyyaml>=6.0
jinja2>=3.1.0

# 開発ツール
black>=24.0.0
isort>=5.13.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

依存関係のインストール:
```bash
pip install -r .devcontainer/requirements.txt
```

### backend/pyproject.toml

blackとisortの設定のみを定義（依存関係は`requirements.txt`で管理）:
```toml
[tool.black]
line-length = 100
target-version = ['py311']

[tool.isort]
profile = "black"
line_length = 100
```

### backend/src/core/anthropic_llm_config.yaml

Claude APIのモデル設定:
```yaml
model: claude-sonnet-4-5-20250929
max_tokens: 64000
```

### プロンプトテンプレートファイル

#### backend/src/prompts/FlowGenerationPrompt.md

初回生成用の完全仕様（Markdown + Jinja2形式）:
- 約16,000文字の詳細な業務フロー図生成仕様
- 配色、レイアウト、要素定義、接続ルール、検証ルールなどを含む
- `PromptBuilder`で`Template.render()`により読み込まれる

#### backend/src/prompts/FlowModificationPrompt.md

修正用プロンプト（Markdown + Jinja2形式）:
```markdown
あなたは先ほど生成したdrawio形式の業務フロー図を修正する専門家です。

【重要な指示】
1. 後述の「現在のdrawioコード」をベースに、指定された修正のみを行ってください
...

【現在のdrawioコード】
{{ previous_drawio }}
```

## API仕様

### PUT /v1/sessions/{session_id}/flows

業務フロー図を生成または修正するエンドポイント。

**リクエスト**:
```json
{
  "user_prompt": "宿泊療養対応業務のフローを描いて",
  "streaming": true
}
```

**ストリーミングレスポンス** (改行区切りJSON):
```json
{"type": "start", "message": "Claude API ストリーミング開始"}
{"type": "content", "text": "<?xml version=\"1.0\"...", "chunk": 1}
{"type": "content", "text": "<mxfile...", "chunk": 2}
...
{"type": "complete", "fullContent": "<?xml...></mxfile>", "totalChunks": 150}
```

## 重要な技術的詳細

### drawio形式の生成

- SVGではなくdrawio XML（mxfile形式）を生成
- 各要素は`<mxCell>`タグで定義、接続は`edge="1"`属性で明示
- `source`/`target`属性で接続元・接続先を指定（浮遊矢印を防止）
- `edgeStyle=orthogonalEdgeStyle`で直角接続を強制

### プロンプト構築ロジック

`PromptBuilder`クラスがプロンプトを構築:

**初回リクエスト**:
- `FlowGenerationPrompt.md`をJinja2テンプレートとして読み込み
- `template.render()`でレンダリング（現時点では動的変数なし）
- レンダリング結果をシステムプロンプトとして使用
- 完全な仕様に基づいて新規フロー図を生成

**修正リクエスト**:
- `FlowModificationPrompt.md`をJinja2テンプレートとして読み込み
- `{{ previous_drawio }}`変数に前回生成したdrawio XMLを埋め込み
- レンダリング結果をシステムプロンプトとして使用

**テンプレート例（FlowModificationPrompt.md）**:
```markdown
あなたは先ほど生成したdrawio形式の業務フロー図を修正する専門家です。

【重要な指示】
1. 後述の「現在のdrawioコード」をベースに、指定された修正のみを行ってください
2. 修正後も完全なdrawioコードを出力してください（部分的な出力は禁止）
...

【現在のdrawioコード】
{{ previous_drawio }}
```

**実装**:
```python
from jinja2 import Template

# テンプレートの読み込み
template = Template(flow_modification_prompt)

# 変数を埋め込んでレンダリング
rendered = template.render(previous_drawio=previous_drawio)
```

### HTTPストリーミングの実装

- `httpx.AsyncClient.stream()` でSSE形式のストリームを受信
- `aiter_lines()` で行単位に読み取り、`data: ` プレフィックスをパース
- `content_block_delta` イベントからテキスト断片を抽出
- タイムアウト: 120秒（`chunk_timeout`パラメータ）

### 静的ファイル配信

- Next.jsビルド結果を`backend/src/static/`へコピー
- FastAPIの`StaticFiles`ミドルウェアで`/`パスから配信
- `html=True`オプションでSPAルーティングをサポート

## 開発時の注意点

1. **プロンプトテンプレートの編集**:
   - **FlowGenerationPrompt.md**: 初回生成用の完全仕様。Markdown + Jinja2形式
     - 色コード、レイアウトルール、接続ルールを変更する際は既存の参考drawioファイルと整合性を確認
     - 将来的に動的変数を追加する場合は`{{ variable_name }}`形式で記述
   - **FlowModificationPrompt.md**: 修正用プロンプト。Jinja2テンプレート形式
     - `{{ previous_drawio }}`変数は自動的に埋め込まれる
     - Markdown形式で記述可能。修正指示の文言を調整する際に編集

   **メリット**:
   - YAMLからMarkdownに変更したことで、プロンプトの可読性と編集性が向上
   - Jinja2テンプレートにより、動的な変数埋め込みが統一的に管理可能
   - すべてのプロンプトが同じフォーマット（Markdown + Jinja2）で統一

2. **セッション管理**:
   - セッションIDは`PUT /v1/sessions/{session_id}/flows`のパスパラメータで指定
   - 同一セッションでの連続リクエストは前回のdrawioを自動的にキャッシュから取得
   - メモリ内管理のため、サーバー再起動でキャッシュは消失

3. **ストリーミングエラーハンドリング**:
   - ネットワーク切断時は`{"type": "error"}`イベントを送信
   - `finally`ブロックで未送信の`complete`イベントを保証

4. **LLMクライアント拡張**:
   - 新しいLLMプロバイダーを追加する場合は`BaseLLMClient`を継承
   - `send_message()`と`stream_message()`を実装
   - `app.py`のファクトリーロジックで振り分け（現在はAnthropicのみ）

5. **コードフォーマット**:
   - 処理完了前に必ず`black src/`を実行してフォーマット
   - 処理完了前に必ず`isort src/`でimport文を整理（blackと互換性のあるプロファイル使用）
   - 行長は100文字に設定（`pyproject.toml`で定義）

6. **コード生成規約**
   - 各関数の冒頭には日本語のコメントで仕様を記述する。
   - backendの関数については、Google式のdocstringを日本語で記述する
   - frontendの関数についても日本語のコメントで処理内容を記述する

## 参考ファイル

- `参考：地方自治体の申請業務フロー.drawio`: 高品質な参考例
- `宿泊療養対応業務一覧_更新版.csv`: 業務プロセス定義のサンプル
- `DEMO-UI.md`: フロントエンドの詳細仕様（存在する場合）
