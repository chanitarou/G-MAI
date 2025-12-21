export type Category = '会社名' | '人名' | '案件名' | 'システム名' | 'その他';

export interface NgWord {
  id?: string;
  word: string;
  category: Category;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  file: File;
}

export interface FileContent {
  page: string;
  text: string;
}

export type DetectionType = '完全一致' | 'AI検知';

export interface Detection {
  id: string;
  type: DetectionType;
  keyword: string;
  fileName: string;
  location: string;
  context: string;
  fullText: string;
  reason?: string;
}

export interface ParseResult {
  success: boolean;
  contents: FileContent[];
  error?: string;
  isImageBased?: boolean;
}

export interface ParseError {
  fileName: string;
  error: string;
}

export interface CheckResult {
  detections: Detection[];
  parseErrors: ParseError[];
  imagePdfs: string[];
}

export interface GeminiFinding {
  text: string;
  reason: string;
}
