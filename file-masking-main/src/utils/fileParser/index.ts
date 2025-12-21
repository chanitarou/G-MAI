import { ParseResult, UploadedFile } from '../../types';
import { parsePdf } from './pdfParser';
import { parsePptx } from './pptxParser';
import { parseDocx } from './docxParser';
import { parseXlsx } from './xlsxParser';

export async function extractFileContent(uploadedFile: UploadedFile): Promise<ParseResult> {
  const extension = uploadedFile.name.split('.').pop()?.toLowerCase();

  try {
    switch (extension) {
      case 'pdf':
        return await parsePdf(uploadedFile.file);
      case 'pptx':
        return await parsePptx(uploadedFile.file);
      case 'docx':
        return await parseDocx(uploadedFile.file);
      case 'xlsx':
        return await parseXlsx(uploadedFile.file);
      case 'ppt':
      case 'doc':
      case 'xls':
        // 旧形式は非対応
        return {
          success: false,
          contents: [],
          error: `${extension.toUpperCase()}形式は現在非対応です。OOXML形式（${extension}x）に変換してからアップロードしてください。`,
        };
      default:
        return {
          success: false,
          contents: [],
          error: `未対応のファイル形式: ${extension}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      contents: [],
      error: error instanceof Error ? error.message : '解析中にエラーが発生しました',
    };
  }
}

export { parsePdf, extractPdfPagesAsImages } from './pdfParser';
export { parsePptx } from './pptxParser';
export { parseDocx } from './docxParser';
export { parseXlsx } from './xlsxParser';
