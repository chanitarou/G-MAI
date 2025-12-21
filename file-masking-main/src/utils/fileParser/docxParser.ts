import JSZip from 'jszip';
import { ParseResult, FileContent } from '../../types';

export async function parseDocx(file: File): Promise<ParseResult> {
  const contents: FileContent[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // word/document.xml を取得
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
      return {
        success: false,
        contents: [],
        error: 'document.xml が見つかりません',
      };
    }

    const xmlContent = await documentFile.async('string');
    const paragraphs = extractTextFromDocxXml(xmlContent);

    // 段落をページ相当にグループ化（約500文字ごと）
    const pageSize = 500;
    let currentPage = 1;
    let currentText = '';

    for (const para of paragraphs) {
      currentText += para + '\n';

      if (currentText.length >= pageSize) {
        contents.push({
          page: `ページ${currentPage}`,
          text: currentText.trim(),
        });
        currentPage++;
        currentText = '';
      }
    }

    // 残りのテキストを最終ページとして追加
    if (currentText.trim()) {
      contents.push({
        page: `ページ${currentPage}`,
        text: currentText.trim(),
      });
    }

    // テキストが空の場合
    if (contents.length === 0) {
      contents.push({
        page: 'ページ1',
        text: '',
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
      error: `DOCX解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

function extractTextFromDocxXml(xmlContent: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  // 名前空間を考慮して段落とテキストを抽出
  const wNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paragraphs = doc.getElementsByTagNameNS(wNamespace, 'p');
  const result: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const textElements = paragraphs[i].getElementsByTagNameNS(wNamespace, 't');
    const paraTexts: string[] = [];

    for (let j = 0; j < textElements.length; j++) {
      const text = textElements[j].textContent;
      if (text) {
        paraTexts.push(text);
      }
    }

    const paraText = paraTexts.join('');
    if (paraText.trim()) {
      result.push(paraText);
    }
  }

  // 名前空間が認識されない場合のフォールバック
  if (result.length === 0) {
    const fallbackParagraphs = doc.querySelectorAll('*');
    let currentPara = '';

    for (let i = 0; i < fallbackParagraphs.length; i++) {
      const el = fallbackParagraphs[i];
      if (el.localName === 'p') {
        if (currentPara.trim()) {
          result.push(currentPara);
        }
        currentPara = '';
      } else if (el.localName === 't' && el.textContent) {
        currentPara += el.textContent;
      }
    }

    if (currentPara.trim()) {
      result.push(currentPara);
    }
  }

  return result;
}
