export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SearchResult {
  id: string;
  fileName: string;
  matchedText: string;
  pageNumber?: number;
  tags: string[];
  uploadDate: Date;
}

export interface SearchResultItem {
  document_name: string;
  title: string;
  summary: string;
  relevance_score: 'high' | 'medium' | 'low';
  key_points?: string[];
  category?: string;
  date?: string;
  client?: string;
}

export interface SearchResponse {
  status: 'success' | 'no_results' | 'partial';
  total_count: number;
  results: SearchResultItem[];
  suggestion_message?: string;
}

// ChatSearch用のタグ型
export interface Tag {
  id: string;
  name: string;
  color: string;
}

// メタデータフィールドの型
export interface DocumentMetadata {
  sector?: string;           // セクター: 公共 / 民間
  business_type?: string;    // 業務種別: システム開発 / コンサルティング 等
  client_category?: string;  // クライアント種別: 中央省庁 / 銀行 等
}

export interface UploadedFile {
  id: string;
  name: string;
  uploadDate: Date;
  metadata: DocumentMetadata;
  size: number;
}

// メタデータの選択肢定義
export const METADATA_OPTIONS = {
  sector: ['公共', '民間'],
  business_type: ['システム開発', 'コンサルティング', '運用保守', 'PMO', '調査研究'],
  client_category: {
    公共: ['中央省庁', '自治体', '独立行政法人', '公共団体'],
    民間: ['銀行', '証券', '保険', 'その他金融', '製造', '流通・小売', '通信・IT'],
  },
} as const;
