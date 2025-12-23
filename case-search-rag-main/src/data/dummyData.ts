import { ChatMessage, SearchResult, UploadedFile } from '../types';

// NOTE: タグはDify APIから取得されるため、ここでは定義していません
// Tags are fetched from Dify API - not defined here

// NOTE: アップロード済みファイルもDify APIから取得されます
// Uploaded files are fetched from Dify API
// The data below is kept for reference only and is not used in the application
export const uploadedFiles: UploadedFile[] = [
  {
    id: '1',
    name: '大阪市DX推進計画_2023.pdf',
    uploadDate: new Date('2023-12-01'),
    metadata: { sector: '公共', business_type: 'コンサルティング', client_category: '自治体' },
    size: 2048000,
  },
  {
    id: '2',
    name: '厚生労働省システム更改提案書.docx',
    uploadDate: new Date('2023-11-15'),
    metadata: { sector: '公共', business_type: 'システム開発', client_category: '中央省庁' },
    size: 1536000,
  },
  {
    id: '3',
    name: '地方自治体向けDX事例集_2022.pdf',
    uploadDate: new Date('2023-10-20'),
    metadata: { sector: '公共', business_type: '調査研究', client_category: '自治体' },
    size: 3072000,
  },
  {
    id: '4',
    name: 'クラウド移行計画書_愛知県.pdf',
    uploadDate: new Date('2023-09-10'),
    metadata: { sector: '公共', business_type: 'システム開発', client_category: '自治体' },
    size: 1024000,
  },
  {
    id: '5',
    name: 'セキュリティ対策報告書_2024.pdf',
    uploadDate: new Date('2024-03-15'),
    metadata: { sector: '公共', business_type: 'システム開発', client_category: '中央省庁' },
    size: 1856000,
  },
  {
    id: '6',
    name: 'AI活用事例_自治体向け.pdf',
    uploadDate: new Date('2024-02-20'),
    metadata: { sector: '公共', business_type: 'コンサルティング', client_category: '自治体' },
    size: 2240000,
  },
  {
    id: '7',
    name: '業務改善提案書_RPA導入.docx',
    uploadDate: new Date('2024-01-10'),
    metadata: { sector: '公共', business_type: 'コンサルティング', client_category: '中央省庁' },
    size: 1280000,
  },
  {
    id: '8',
    name: 'データ分析基盤構築計画.pdf',
    uploadDate: new Date('2023-12-25'),
    metadata: { sector: '公共', business_type: 'システム開発', client_category: '独立行政法人' },
    size: 1920000,
  },
  {
    id: '9',
    name: 'DX推進コンサルティング報告書.pdf',
    uploadDate: new Date('2024-04-01'),
    metadata: { sector: '公共', business_type: 'コンサルティング', client_category: '中央省庁' },
    size: 1664000,
  },
];

// 初期状態は空（画面を開いた時点ではチャットが進んでいない）
export const chatHistory: ChatMessage[] = [];

// 全検索結果のマスターデータ（検索時にフィルタリングされる）
export const allSearchResults: SearchResult[] = [
  {
    id: '1',
    fileName: '大阪市DX推進計画_2023.pdf',
    matchedText: '当市では、2023年度よりDX推進計画を本格的に開始しました。主な施策として、行政手続きのオンライン化、AI-OCRによる業務効率化、データ活用基盤の整備を進めています。',
    pageNumber: 15,
    tags: ['公共', '自治体', '2023', 'DX'],
    uploadDate: new Date('2023-12-01'),
  },
  {
    id: '2',
    fileName: '地方自治体向けDX事例集_2022.pdf',
    matchedText: '横浜市の事例：住民向けポータルサイトを刷新し、各種証明書のオンライン申請を可能にしました。利用率は導入後6ヶ月で全申請の35%に達し、窓口業務の負荷が大幅に軽減されています。',
    pageNumber: 42,
    tags: ['公共', '自治体', '2022', 'DX', '調査研究'],
    uploadDate: new Date('2023-10-20'),
  },
  {
    id: '3',
    fileName: '地方自治体向けDX事例集_2022.pdf',
    matchedText: '神奈川県の事例：県内全市町村と連携したデータ連携基盤を構築。各自治体の保有データを安全に共有し、広域的な政策立案に活用しています。',
    pageNumber: 58,
    tags: ['公共', '自治体', '2022', 'DX', '調査研究'],
    uploadDate: new Date('2023-10-20'),
  },
  {
    id: '4',
    fileName: '厚生労働省システム更改提案書.docx',
    matchedText: '既存システムの老朽化に伴い、クラウドネイティブなシステムへの更改を提案します。システム開発にはアジャイル手法を採用し、段階的な移行を行うことでリスクを最小化します。',
    pageNumber: 8,
    tags: ['公共', 'システム開発', '2023', 'クラウド'],
    uploadDate: new Date('2023-11-15'),
  },
  {
    id: '5',
    fileName: 'クラウド移行計画書_愛知県.pdf',
    matchedText: 'オンプレミス環境からクラウド環境への移行計画を策定しました。AWSを採用し、3年間で段階的にシステムを移行します。セキュリティ要件は総務省のガイドラインに準拠します。',
    pageNumber: 23,
    tags: ['公共', 'システム開発', '2023', 'クラウド'],
    uploadDate: new Date('2023-09-10'),
  },
  {
    id: '6',
    fileName: '大阪市DX推進計画_2023.pdf',
    matchedText: 'オンライン申請システムの導入により、住民の利便性向上と職員の業務効率化を実現します。スマートフォンからの申請にも対応し、24時間365日の受付を可能にします。',
    pageNumber: 28,
    tags: ['公共', '自治体', '2023', 'DX'],
    uploadDate: new Date('2023-12-01'),
  },
  {
    id: '7',
    fileName: '地方自治体向けDX事例集_2022.pdf',
    matchedText: '福岡市の調査研究：AI-OCRとRPAを組み合わせた業務自動化により、年間3000時間の業務時間削減を実現。導入コストは2年で回収できる見込みです。',
    pageNumber: 67,
    tags: ['公共', '自治体', '2022', 'DX', '調査研究'],
    uploadDate: new Date('2023-10-20'),
  },
  {
    id: '8',
    fileName: 'セキュリティ対策報告書_2024.pdf',
    matchedText: '情報セキュリティ対策として、多層防御の考え方に基づき、ネットワーク分離、アクセス制御、ログ監視などを実施。NISC（内閣サイバーセキュリティセンター）のガイドラインに準拠した対策を行っています。',
    pageNumber: 12,
    tags: ['公共', 'セキュリティ', '2024', 'システム開発'],
    uploadDate: new Date('2024-03-15'),
  },
  {
    id: '9',
    fileName: 'セキュリティ対策報告書_2024.pdf',
    matchedText: 'ゼロトラストセキュリティの導入により、場所を問わない安全なリモートワーク環境を実現。VPN接続に依存しない新しいセキュリティモデルを採用しています。',
    pageNumber: 34,
    tags: ['公共', 'セキュリティ', '2024'],
    uploadDate: new Date('2024-03-15'),
  },
  {
    id: '10',
    fileName: 'AI活用事例_自治体向け.pdf',
    matchedText: 'チャットボットによる住民対応の自動化を実現。AIが24時間365日、よくある質問に自動回答することで、職員の負担を軽減し、住民サービスの向上を図っています。',
    pageNumber: 5,
    tags: ['公共', '自治体', 'AI・機械学習', '2024', 'DX'],
    uploadDate: new Date('2024-02-20'),
  },
  {
    id: '11',
    fileName: 'AI活用事例_自治体向け.pdf',
    matchedText: '画像認識技術を活用した道路損傷検知システム。ドライブレコーダーの映像をAIが自動解析し、舗装の劣化や路面の損傷を検出。効率的な道路維持管理を実現しています。',
    pageNumber: 18,
    tags: ['公共', '自治体', 'AI・機械学習', '2024'],
    uploadDate: new Date('2024-02-20'),
  },
  {
    id: '12',
    fileName: 'AI活用事例_自治体向け.pdf',
    matchedText: '機械学習を用いた需要予測により、施設の稼働率を最適化。過去のデータから利用パターンを学習し、効率的な施設運営と予約システムの改善を実現しました。',
    pageNumber: 27,
    tags: ['公共', '自治体', 'AI・機械学習', 'データ分析', '2024'],
    uploadDate: new Date('2024-02-20'),
  },
  {
    id: '13',
    fileName: '業務改善提案書_RPA導入.docx',
    matchedText: 'RPA（ロボティック・プロセス・オートメーション）の導入により、定型業務を自動化。データ入力、帳票作成、突合作業などを自動化し、年間2000時間の業務削減を実現します。',
    pageNumber: 3,
    tags: ['公共', '業務効率化', '2024'],
    uploadDate: new Date('2024-01-10'),
  },
  {
    id: '14',
    fileName: '業務改善提案書_RPA導入.docx',
    matchedText: 'AI-OCRとRPAの連携により、紙書類のデジタル化と自動処理を実現。手書き文字の認識精度は95%以上を達成し、大幅な業務効率化を実現しています。',
    pageNumber: 15,
    tags: ['公共', '業務効率化', 'AI・機械学習', '2024'],
    uploadDate: new Date('2024-01-10'),
  },
  {
    id: '15',
    fileName: 'データ分析基盤構築計画.pdf',
    matchedText: 'データレイク・データウェアハウスを活用した統合データ分析基盤を構築。各部署に散在するデータを統合し、横断的な分析を可能にします。',
    pageNumber: 8,
    tags: ['公共', 'データ分析', 'クラウド', '2023'],
    uploadDate: new Date('2023-12-25'),
  },
  {
    id: '16',
    fileName: 'データ分析基盤構築計画.pdf',
    matchedText: 'BIツールを活用したダッシュボードの構築により、リアルタイムでのKPI可視化を実現。データドリブンな意思決定を支援します。',
    pageNumber: 22,
    tags: ['公共', 'データ分析', '2023'],
    uploadDate: new Date('2023-12-25'),
  },
  {
    id: '17',
    fileName: 'クラウド移行計画書_愛知県.pdf',
    matchedText: 'マルチクラウド戦略により、AWS、Azure、GCPを適材適所で活用。ベンダーロックインを回避しながら、最適なクラウドサービスを選択します。',
    pageNumber: 45,
    tags: ['公共', 'システム開発', 'クラウド', '2023'],
    uploadDate: new Date('2023-09-10'),
  },
  {
    id: '18',
    fileName: '厚生労働省システム更改提案書.docx',
    matchedText: 'コンテナ技術（Docker/Kubernetes）を活用したマイクロサービスアーキテクチャを採用。システムの柔軟性と拡張性を大幅に向上させます。',
    pageNumber: 19,
    tags: ['公共', 'システム開発', 'クラウド', '2023'],
    uploadDate: new Date('2023-11-15'),
  },
  {
    id: '19',
    fileName: 'DX推進コンサルティング報告書.pdf',
    matchedText: 'デジタルトランスフォーメーション推進のためのコンサルティングを実施。現状分析から戦略立案、実行支援まで一貫してサポートし、組織全体のDX推進を支援しました。',
    pageNumber: 5,
    tags: ['公共', 'コンサルティング', 'DX', '2024'],
    uploadDate: new Date('2024-04-01'),
  },
  {
    id: '20',
    fileName: 'DX推進コンサルティング報告書.pdf',
    matchedText: 'IT戦略コンサルティングにより、中長期的なシステム刷新計画を策定。業務プロセスの見直しとシステム導入を並行して進め、効果的なデジタル化を実現しました。',
    pageNumber: 18,
    tags: ['公共', 'コンサルティング', 'システム開発', '2024'],
    uploadDate: new Date('2024-04-01'),
  },
];

// 初期表示用の検索結果（初期状態は空）
export const searchResults: SearchResult[] = [];
