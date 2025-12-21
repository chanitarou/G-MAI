# コードリーディングメモ

### 構成
- front->フレームワーク不使用のjs。html内に直接jsを記述しており拡張性は著しく低い
- backend->Express.jsを使用。軽量なフレームワークでAPIを定義

### 主要部分処理
- callClaudeAPI
- handleStreamingResponse（と言っているがバッチが呼ばれることはない）
- this.processStreamingSVG(data.text, fullContent);->描画処理

### python fastapi移行検討
- Node 実装が行っている機能（Healthcheck/静的配信/セッション管理/プロンプト合成/Claude へのストリーミング/バッチ呼び出し/チャンク転送/セッション別 draw.io キャッシュ）は、FastAPI＋Python の async エコシステムで全て再現できます。各処理はHTTP I/O と JSON 操作が中心で、Node 独自 API に依存していません。
- 非同期ストリーミングの肝である handleStreamingResponse() (claude-proxy-server.js:375-470) は、Python なら httpx.AsyncClient(stream=True) や aiohttp を使って async for chunk in response.aiter_lines() のように行単位で読み取り、
StreamingResponse で JSON 行をクライアントへプッシュする形で置き換え可能です。チャンクタイムアウトは asyncio.wait_for や Timeout コンテキストで実装できます。
- セッション状態（sessionData/sessionDrawioCache）はメモリ内 dict と asyncio.Lock、もしくは cachetools 等で容易に移植できます。現在の Map 操作も単純なので排他制御を適宜入れれば問題ありません (claude-proxy-server.js:9-24, claude-proxy-
server.js:185-327)。
- ミドルウェア相当の処理（CORS、JSON パース、静的配信）は FastAPI＋fastapi.middleware.cors.CORSMiddleware＋StaticFiles で置き換えられます (claude-proxy-server.js:47-71)。
- 唯一の注意点は、Node 版は fetch を標準利用しているため ReadableStream/getReader() が前提ですが、Python では httpx または aiohttp のストリーム API で同等の非同期読み取りが提供されているので、性能・仕様面でのギャップはありません。
- まとめると、非同期処理を含む全機能は FastAPI 環境でも十分実現可能です。移行時には SSE 風 JSON 行を StreamingResponse で返す実装と、チャンクタイムアウト・エラーハンドリング・セッションキャッシュの排他制御を丁寧に組み直す点だけ確認すれば問
題ありません。

### クラス使用有無基準
- 複数の関数が 共通のデータや設定を共有 する（例：DBコネクション、APIトークン）
- 同種の操作をまとめて ひとつの概念（エンティティ・モデル）として扱いたい
- 状態やライフサイクルを持つ（例：初期化→操作→クローズ）
- インターフェースとして抽象化したい（継承、多態、DI）
- 将来的に拡張が見込まれる

### 不完全なxmlの処理
#### 描画の流れ
- processStreamingSVG (src/static/demo-ui-claude-proxy.html:1491) はチャンクごとに draw.io 断片を this.accumulatedSvgCode へ蓄積し、XMLヘッダーや <mxfile> 相当が現れた瞬間に「描画モード」を有効化します。そのたびにソース表示を更新しつつ forceUpdateFlowDiagram を呼び出します。
- forceUpdateFlowDiagram (src/static/demo-ui-claude-proxy.html:1643) は「一定長さ以上」「<mxfile> または <mxGraphModel> を含む」といった緩い条件を満たした段階で描画を試み、10ms デバウンス後に_doForceUpdateFlowDiagram を実行します。これにより不完全でも随時リレンダリングが走ります。

#### 不完全データの補完とデコード
- _doForceUpdateFlowDiagram (src/static/demo-ui-claude-proxy.html:1674) では、欠けがちな XML 宣言や </mxfile> を疑似的に補完し、属性値のエスケープもかけてから DOMParser + mxCodec でモデル復元を試みます。
- draw.io が base64+raw-deflate で圧縮されているケースに備え、decodeDrawioToModelXml (src/static/demo-ui-claude-proxy.html:1664) で pako.inflateRaw による展開を行い、mxGraphModel ノードを得られた場合のみ mxGraph に流し込みます。途中で失敗しても catch してログを出すだけなので、後続のチャンクで再度トライできます。

#### リアルタイム描画

- 解析できた時点で毎回 mxGraph インスタンスを作り直し (src/static/demo-ui-claude-proxy.html:1699)、スタイルを再適用後 graph.fit() でビューを合わせています（src/static/demo-ui-claude-proxy.html:1810 付近）。このため完全な
SVG になる前でも、現時点でパースできる部分だけで暫定の図を描画し続ける形になっています。

要するに、ストリームの途中段階でも「暫定XMLを補完→パース→mxGraphに流し込む」を繰り返すことで、完全な draw.io ドキュメントを待たずにリアルタイム表示を実現しています。

### テスト
ECサイトの注文処理業務フローを描いて
