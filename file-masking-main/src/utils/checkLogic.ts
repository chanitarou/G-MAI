import { NgWord, UploadedFile, Detection, FileContent, CheckResult, ParseError } from '../types';
import { extractFileContent, extractPdfPagesAsImages } from './fileParser';
import { hasGeminiApiKey, performBatchOcr, performFullDocumentDetection } from './geminiApi';

export interface CheckOptions {
  useGemini?: boolean;
  onProgress?: (fileName: string, status: 'parsing' | 'checking' | 'ocr' | 'ai' | 'done') => void;
}

export async function performCheck(
  files: UploadedFile[],
  ngWords: NgWord[],
  options?: CheckOptions
): Promise<CheckResult> {
  const detections: Detection[] = [];
  const parseErrors: ParseError[] = [];
  const imagePdfs: string[] = [];
  let idCounter = 0;

  const useGemini = options?.useGemini && hasGeminiApiKey();

  for (const file of files) {
    options?.onProgress?.(file.name, 'parsing');

    // ファイル解析を試行
    const parseResult = await extractFileContent(file);

    let fileContents: FileContent[];

    if (parseResult.success) {
      fileContents = parseResult.contents;

      // デバッグ用：抽出されたテキストをログ出力
      console.group(`📄 [${file.name}] 抽出テキスト`);
      for (const content of fileContents) {
        console.log(`--- ${content.page} ---`);
        console.log(content.text || '(テキストなし)');
      }
      console.groupEnd();

      // 画像化PDFの検出
      if (parseResult.isImageBased) {
        imagePdfs.push(file.name);

        // Geminiが有効な場合はOCRを実行
        if (useGemini) {
          options?.onProgress?.(file.name, 'ocr');
          const pagesResult = await extractPdfPagesAsImages(file.file);

          if (pagesResult.success && pagesResult.pages.length > 0) {
            const ocrResult = await performBatchOcr(pagesResult.pages);
            if (ocrResult.success || ocrResult.contents.length > 0) {
              fileContents = ocrResult.contents;

              // デバッグ用：OCR結果をログ出力
              console.group(`🔍 [${file.name}] OCR結果`);
              for (const content of fileContents) {
                console.log(`--- ${content.page} ---`);
                console.log(content.text || '(テキストなし)');
              }
              console.groupEnd();
            }
          }
        }
      }
    } else {
      // 解析失敗時のエラー記録
      parseErrors.push({
        fileName: file.name,
        error: parseResult.error || '不明なエラー',
      });
      continue; // このファイルはスキップ
    }

    options?.onProgress?.(file.name, 'checking');

    // 検出処理
    for (const content of fileContents) {
      // 完全一致検索
      for (const ngWord of ngWords) {
        // 同一ページ内の複数出現をすべて検出
        let searchIndex = 0;
        while (true) {
          const index = content.text.indexOf(ngWord.word, searchIndex);
          if (index === -1) break;

          const contextStart = Math.max(0, index - 20);
          const contextEnd = Math.min(content.text.length, index + ngWord.word.length + 20);
          const context = content.text.substring(contextStart, contextEnd);

          detections.push({
            id: `detection-${idCounter++}`,
            type: '完全一致',
            keyword: ngWord.word,
            fileName: file.name,
            location: content.page,
            context: context,
            fullText: content.text,
          });

          searchIndex = index + ngWord.word.length;
        }
      }
    }

    // Gemini による高度な検出（ファイル全体を一度に解析）
    if (useGemini && fileContents.length > 0) {
      options?.onProgress?.(file.name, 'ai');
      const aiResult = await performFullDocumentDetection(fileContents);

      if (aiResult.success && aiResult.findings.length > 0) {
        for (const finding of aiResult.findings) {
          // ページ情報からfullTextを取得
          const pageContent = fileContents.find((c) => c.page === finding.page);
          const fullText = pageContent?.text || '';

          // 既に検出済みのものは除外
          const alreadyDetected = detections.some(
            (d) =>
              d.fileName === file.name &&
              d.location === finding.page &&
              d.keyword === finding.text
          );

          if (!alreadyDetected) {
            // コンテキストを抽出
            let context = finding.text;
            if (fullText && fullText.includes(finding.text)) {
              const index = fullText.indexOf(finding.text);
              const contextStart = Math.max(0, index - 20);
              const contextEnd = Math.min(fullText.length, index + finding.text.length + 20);
              context = fullText.substring(contextStart, contextEnd);
            }

            detections.push({
              id: `detection-${idCounter++}`,
              type: 'AI検知',
              keyword: finding.text,
              fileName: file.name,
              location: finding.page,
              context: context,
              fullText: fullText,
              reason: finding.reason,
            });
          }
        }
      }
    }

    options?.onProgress?.(file.name, 'done');
  }

  return { detections, parseErrors, imagePdfs };
}
