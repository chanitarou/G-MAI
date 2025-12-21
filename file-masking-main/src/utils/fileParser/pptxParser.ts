import JSZip from 'jszip';
import { ParseResult, FileContent } from '../../types';

export async function parsePptx(file: File): Promise<ParseResult> {
  const contents: FileContent[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // スライドファイルを取得（ppt/slides/slide1.xml, slide2.xml, ...）
    const slideFiles: Array<{ num: number; file: JSZip.JSZipObject }> = [];

    zip.forEach((relativePath, zipEntry) => {
      const match = relativePath.match(/ppt\/slides\/slide(\d+)\.xml$/);
      if (match && !zipEntry.dir) {
        slideFiles.push({
          num: parseInt(match[1], 10),
          file: zipEntry,
        });
      }
    });

    // スライド番号でソート
    slideFiles.sort((a, b) => a.num - b.num);

    for (const slideFile of slideFiles) {
      const xmlContent = await slideFile.file.async('string');
      const text = extractTextFromPptxXml(xmlContent);

      contents.push({
        page: `スライド${slideFile.num}`,
        text: text,
      });
    }

    return {
      success: true,
      contents,
    };
  } catch (error) {
    return {
      success: false,
      contents: [],
      error: `PPTX解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

function extractTextFromPptxXml(xmlContent: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  // 名前空間を考慮してテキストを抽出
  // <a:t> タグからテキストを取得
  const texts: string[] = [];

  // getElementsByTagNameNS を使用して名前空間付きの要素を取得
  const aNamespace = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const textElements = doc.getElementsByTagNameNS(aNamespace, 't');

  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i].textContent;
    if (text) {
      texts.push(text);
    }
  }

  // 名前空間が認識されない場合のフォールバック
  if (texts.length === 0) {
    const fallbackElements = doc.querySelectorAll('*');
    for (let i = 0; i < fallbackElements.length; i++) {
      const el = fallbackElements[i];
      if (el.localName === 't' && el.textContent) {
        texts.push(el.textContent);
      }
    }
  }

  return texts.join(' ').replace(/\s+/g, ' ').trim();
}
