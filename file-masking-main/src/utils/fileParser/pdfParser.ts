import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { ParseResult, FileContent } from '../../types';

// PDF.js Worker設定（ローカルワーカーをVite経由でインポート）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function parsePdf(file: File): Promise<ParseResult> {
  const contents: FileContent[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument(typedArray).promise;

    let totalTextLength = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // テキストアイテムを結合
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      totalTextLength += pageText.length;

      contents.push({
        page: `P.${pageNum}`,
        text: pageText,
      });
    }

    // 画像化PDFの検出（テキストがほとんどない場合）
    // 1ページあたり平均50文字未満の場合は画像化PDFと判定
    const isImageBased = pdf.numPages > 0 && totalTextLength < 50 * pdf.numPages;

    return {
      success: true,
      contents,
      isImageBased,
    };
  } catch (error) {
    return {
      success: false,
      contents: [],
      error: `PDF解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// PDF各ページを画像として抽出（Gemini OCR用）
export async function extractPdfPagesAsImages(
  file: File
): Promise<{ success: boolean; pages: Array<{ pageNum: number; imageBase64: string }>; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument(typedArray).promise;

    const pages: Array<{ pageNum: number; imageBase64: string }> = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // 解像度調整

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as Parameters<typeof page.render>[0]).promise;

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      pages.push({ pageNum, imageBase64 });
    }

    return { success: true, pages };
  } catch (error) {
    return {
      success: false,
      pages: [],
      error: error instanceof Error ? error.message : '画像抽出でエラーが発生しました',
    };
  }
}
