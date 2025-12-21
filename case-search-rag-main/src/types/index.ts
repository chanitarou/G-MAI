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

export interface UploadedFile {
  id: string;
  name: string;
  uploadDate: Date;
  tags: string[];
  size: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}
