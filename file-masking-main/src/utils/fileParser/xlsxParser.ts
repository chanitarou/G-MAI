import JSZip from 'jszip';
import { ParseResult, FileContent } from '../../types';

export async function parseXlsx(file: File): Promise<ParseResult> {
  const contents: FileContent[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // sharedStrings.xml を取得（テキスト参照テーブル）
    const sharedStrings = await loadSharedStrings(zip);

    // ワークシートファイルを取得（xl/worksheets/sheet1.xml, ...）
    const sheetFiles: Array<{ num: number; file: JSZip.JSZipObject }> = [];

    zip.forEach((relativePath, zipEntry) => {
      const match = relativePath.match(/xl\/worksheets\/sheet(\d+)\.xml$/);
      if (match && !zipEntry.dir) {
        sheetFiles.push({
          num: parseInt(match[1], 10),
          file: zipEntry,
        });
      }
    });

    sheetFiles.sort((a, b) => a.num - b.num);

    for (const sheetFile of sheetFiles) {
      const xmlContent = await sheetFile.file.async('string');
      const text = extractTextFromSheetXml(xmlContent, sharedStrings);

      contents.push({
        page: `シート${sheetFile.num}`,
        text: text,
      });
    }

    // シートが見つからない場合
    if (contents.length === 0) {
      contents.push({
        page: 'シート1',
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
      error: `XLSX解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

async function loadSharedStrings(zip: JSZip): Promise<string[]> {
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (!sharedStringsFile) {
    return [];
  }

  const xmlContent = await sharedStringsFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  // 名前空間を考慮して取得
  const ssNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const siElements = doc.getElementsByTagNameNS(ssNamespace, 'si');
  const strings: string[] = [];

  for (let i = 0; i < siElements.length; i++) {
    const tElements = siElements[i].getElementsByTagNameNS(ssNamespace, 't');
    const texts: string[] = [];

    for (let j = 0; j < tElements.length; j++) {
      const text = tElements[j].textContent;
      if (text) {
        texts.push(text);
      }
    }

    strings.push(texts.join(''));
  }

  // 名前空間が認識されない場合のフォールバック
  if (strings.length === 0) {
    const fallbackElements = doc.querySelectorAll('si');
    for (let i = 0; i < fallbackElements.length; i++) {
      const tElements = fallbackElements[i].querySelectorAll('t');
      const texts: string[] = [];
      tElements.forEach((t) => {
        if (t.textContent) {
          texts.push(t.textContent);
        }
      });
      strings.push(texts.join(''));
    }
  }

  return strings;
}

function extractTextFromSheetXml(xmlContent: string, sharedStrings: string[]): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'application/xml');

  const ssNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const cellElements = doc.getElementsByTagNameNS(ssNamespace, 'c');
  const texts: string[] = [];

  for (let i = 0; i < cellElements.length; i++) {
    const cell = cellElements[i];
    const cellType = cell.getAttribute('t');
    const valueElements = cell.getElementsByTagNameNS(ssNamespace, 'v');
    const valueElement = valueElements[0];

    if (valueElement && valueElement.textContent) {
      if (cellType === 's') {
        // 文字列参照（sharedStringsのインデックス）
        const index = parseInt(valueElement.textContent, 10);
        if (sharedStrings[index]) {
          texts.push(sharedStrings[index]);
        }
      } else if (cellType === 'inlineStr') {
        // インライン文字列
        const tElements = cell.getElementsByTagNameNS(ssNamespace, 't');
        for (let j = 0; j < tElements.length; j++) {
          const text = tElements[j].textContent;
          if (text) {
            texts.push(text);
          }
        }
      } else {
        // 数値やその他
        texts.push(valueElement.textContent);
      }
    }
  }

  // 名前空間が認識されない場合のフォールバック
  if (texts.length === 0) {
    const fallbackCells = doc.querySelectorAll('c');
    for (let i = 0; i < fallbackCells.length; i++) {
      const cell = fallbackCells[i];
      const cellType = cell.getAttribute('t');
      const valueElement = cell.querySelector('v');

      if (valueElement && valueElement.textContent) {
        if (cellType === 's') {
          const index = parseInt(valueElement.textContent, 10);
          if (sharedStrings[index]) {
            texts.push(sharedStrings[index]);
          }
        } else {
          texts.push(valueElement.textContent);
        }
      }
    }
  }

  return texts.join(' ').replace(/\s+/g, ' ').trim();
}
