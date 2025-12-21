# 添付ファイル送信フロー

このメモは、デモUIの「ファイルを選択」ボタンで選ばれたファイルがフロントエンドでどのように処理され、最終的にバックエンドのClaudeプロキシへ渡るかを説明します。

## 1. UIエントリポイント
- 添付UIは `frontend/components/ui/bitFlowSections/ChatSection.tsx` にあり、`id="attach-btn"` のボタンと、`accept` 属性で拡張子を制限した非表示の `<input type="file" id="file-input" multiple ...>` がペアになっています。

## 2. デモアプリでのイベント接続
- 初期化時に `BiTFlowProxyDemo.attachEventListeners` がボタン押下で隠し`input`をクリックさせ、ファイル選択の`change`イベントを監視します（`frontend/components/ui/bitFlowSections/bitFlowProxyDemo.ts:330-384`）。
- 変更を検知すると、選択された `File` オブジェクトを `handleFileAttachments` に渡し、同じファイルを再度選べるよう `<input>` の値をリセットします。

## 3. 添付ファイルの正規化
- `AttachmentDescriptor`（id、name、size、type、`encoding`、`content`）は `frontend/components/ui/bitFlowSections/bitFlowProxyDemo.ts:12-24` で定義され、`this.attachments` に保持されます。
- `handleFileAttachments`（同ファイル） は 2 MB 制限を適用し、`readAttachmentContent` を呼んで新しいディスクリプタをリストに結合します。
- `readAttachmentContent`（同ファイル） は Word（.docx）は `JSZip` で `word/document.xml` を展開、Excel（.xls/.xlsx/.xlsm）は `xlsx` ライブラリで各シートをタブ区切りテキスト化、PDFは `pdfjs-dist` でテキスト抽出、それ以外は `FileReader` と `isTextualAttachment` でテキスト扱いかデータURL扱いかを判断します。
- テキスト抽出できたファイルと PDF は生テキストのまま保存され、画像などバイナリ系のファイルだけが base64 化されます。いずれも `encoding` 種別が付くため後段で表記を変えられます。

## 4. プロンプトへの埋め込み
- 「送信」クリック時、`generateFlow` が UIから消す前の `this.attachments` をコピーします（`frontend/components/ui/bitFlowSections/bitFlowProxyDemo.ts:758-833`）。
- `preparePrompt`（同ファイル:733-756） はユーザープロンプト末尾に添付詳細ブロックを追加し、各添付を次のように整形します。
  ```
  【添付N: filename | 表示用サイズ | text|base64】
  <生テキストまたはbase64文字列>
  ```
  これが `prompt` フィールドの一部として送信され、マルチパートアップロードや別APIは使いません。

## 5. リクエスト送信
- `generateFlowStreaming` は `fetch(ENDPOINTS.messages(this.sessionId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, streaming: true }) })` を実行します（`frontend/components/ui/bitFlowSections/bitFlowProxyDemo.ts:836-865`）。
- 添付は `prompt` に埋め込まれているため、バックエンドは `prompt` と `streaming` の2項目だけを含むJSONを受け取れば十分です。

## 6. バックエンドでの処理
- FastAPIは `PUT /v1/sessions/{session_id}/flows`（`backend/src/api/routes.py:52-101`）でリクエストを受け、`LLMMessageRequest`（`backend/src/schemas/requests.py:10-15`）として解析します。添付は構造化されておらず、結合済みの文字列として扱われます。
- `routes.llm_messages` はプロンプトをトリム・検証し、セッションを登録して `PromptBuilder.build_prompt`（`backend/src/api/routes.py:75-84`）へ渡します。プロンプトビルダーはセッション情報と既存drawioを合成したシステムプロンプトのみを返し、添付部分はユーザープロンプト文字列側に残ります。
- こうして得たシステムプロンプトと元のユーザープロンプトを `AnthropicLLMClient.stream_message` に渡し、戻ってくるストリームをブラウザ側の `handleStreamingResponse` が処理します。

## 7. 運用上の注意
- テキスト/バイナリ判定はファイル名の拡張子と MIME タイプに依存します。PDFは `pdfjs-dist` でテキスト抽出済みのため、他のテキストファイルと同様に `encoding=text` で送信されます（画像だけのPDFはエラーになる）。
- サイズチェックはフロントエンド (`MAX_ATTACHMENT_SIZE_BYTES`) でのみ行うため、バックエンドはクライアントが制限を守る前提です。
- 添付が1つの文字列に平坦化されているため、サーバー側で個別検証や解析を行いたい場合はこの文字列表現を再解釈する必要があります。現状、添付を別フィールドで保持するスキーマはありません。
