import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiFinding } from '../types';

// 環境変数からAPIキーを取得
function getApiKey(): string | null {
  return import.meta.env.VITE_GEMINI_API_KEY || null;
}

export function hasGeminiApiKey(): boolean {
  return !!getApiKey();
}

// OCR機能（画像化PDF用）
export async function performOcr(imageBase64: string): Promise<{
  success: boolean;
  text: string;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, text: '', error: 'Gemini APIキーが設定されていません' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      },
      {
        text: 'この画像に含まれる日本語テキストをすべて抽出してください。書式は無視して、テキストのみを返してください。テキストがない場合は空文字を返してください。',
      },
    ]);

    const response = await result.response;
    const text = response.text() || '';

    return {
      success: true,
      text: text.trim(),
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: `OCR処理エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// ファイル全体のマスキング漏れ検出（文書全体を一度に解析）
export async function performFullDocumentDetection(
  fileContents: Array<{ page: string; text: string }>
): Promise<{
  success: boolean;
  findings: Array<GeminiFinding & { page: string }>;
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, findings: [], error: 'Gemini APIキーが設定されていません' };
  }

  // 全ページのテキストを結合（ページ情報付き）
  const fullText = fileContents
    .map((c) => `【${c.page}】\n${c.text}`)
    .join('\n\n');

  // テキストが短すぎる場合はスキップ
  if (fullText.length < 10) {
    return { success: true, findings: [] };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `以下のテキストは官公庁向け提案書の全文です。マスキング漏れの可能性がある箇所をすべて特定してください。

【特定すべき項目】
1. 会社名・組織名（株式会社〇〇、〇〇社、〇〇株式会社、〇〇法人など）
2. 個人名（〇〇氏、〇〇様、フルネームなど）
3. プロジェクト名・案件名（固有の案件を特定できる名称）
4. 製品名・システム名（固有の製品やシステムを特定できる名称）
5. 自社を示す表現（弊社、当社、我々など - 提案者が特定される可能性）
6. 伏字・マスキング漏れ（〇〇、△△、A社、B氏など不完全なマスキング）

【注意事項】
- 各ページは【ページ名】で区切られています
- 検出した箇所がどのページにあるか必ず記載してください
- 同じ単語が複数箇所にある場合は、すべての出現箇所を報告してください

結果は必ず以下のJSON配列形式で返してください。該当がない場合は空配列[]を返してください:
[{"text": "検出テキスト", "page": "ページ名", "reason": "検出理由"}]

テキスト:
${fullText.substring(0, 30000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text() || '[]';

    // デバッグ用：Geminiの応答をログ出力
    console.group('🤖 Gemini AI検出結果');
    console.log('応答:', responseText);
    console.groupEnd();

    // JSON配列を抽出（複数行対応）
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        const findings = JSON.parse(jsonMatch[0]) as Array<GeminiFinding & { page: string }>;
        return { success: true, findings };
      } catch {
        // JSONパース失敗時は空配列を返す
        console.error('JSON parse error:', jsonMatch[0]);
        return { success: true, findings: [] };
      }
    }

    return { success: true, findings: [] };
  } catch (error) {
    return {
      success: false,
      findings: [],
      error: `AI検出エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// 高度なマスキング漏れ検出（ページ単位 - 後方互換性のため残す）
export async function performAdvancedDetection(text: string): Promise<{
  success: boolean;
  findings: GeminiFinding[];
  error?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, findings: [], error: 'Gemini APIキーが設定されていません' };
  }

  // テキストが短すぎる場合はスキップ
  if (text.length < 10) {
    return { success: true, findings: [] };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `以下のテキストは官公庁向け提案書の一部です。マスキング漏れの可能性がある箇所を特定してください。

特定すべき項目:
1. 会社名（株式会社〇〇、〇〇社など）
2. 個人名（〇〇氏、〇〇様など）
3. プロジェクト名・案件名
4. 製品が特定できるシステム名
5. 自社を示す表現（弊社、当社、我々など）

結果は必ず以下のJSON配列形式で返してください。該当がない場合は空配列[]を返してください:
[{"text": "検出テキスト", "reason": "検出理由"}]

テキスト:
${text.substring(0, 2000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text() || '[]';

    // JSON配列を抽出
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);

    if (jsonMatch) {
      try {
        const findings = JSON.parse(jsonMatch[0]) as GeminiFinding[];
        return { success: true, findings };
      } catch {
        // JSONパース失敗時は空配列を返す
        return { success: true, findings: [] };
      }
    }

    return { success: true, findings: [] };
  } catch (error) {
    return {
      success: false,
      findings: [],
      error: `AI検出エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// 複数ページの画像からOCRを実行
export async function performBatchOcr(
  pages: Array<{ pageNum: number; imageBase64: string }>
): Promise<{
  success: boolean;
  contents: Array<{ page: string; text: string }>;
  errors: string[];
}> {
  const contents: Array<{ page: string; text: string }> = [];
  const errors: string[] = [];

  for (const page of pages) {
    const result = await performOcr(page.imageBase64);
    if (result.success) {
      contents.push({
        page: `P.${page.pageNum}`,
        text: result.text,
      });
    } else {
      errors.push(`P.${page.pageNum}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    contents,
    errors,
  };
}
