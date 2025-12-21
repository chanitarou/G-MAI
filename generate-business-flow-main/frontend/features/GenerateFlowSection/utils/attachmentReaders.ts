import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const ATTACHMENT_TEXT_EXTENSION_REGEX = /\.(txt|md|csv|json|xml|drawio|plantuml|pu|uml|svg)$/i;
const WORD_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_DOCX_EXTENSION_REGEX = /\.docx$/i;
const EXCEL_MIME_TYPES = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12'
];
const EXCEL_EXTENSION_REGEX = /\.(xlsx|xlsm|xls)$/i;
type PdfJsLib = typeof import('pdfjs-dist');
let pdfjsLibPromise: Promise<PdfJsLib> | null = null;

export type AttachmentEncoding = 'text' | 'base64';

export interface AttachmentReadResult {
    content: string;
    encoding: AttachmentEncoding;
}

/**
 * 対象ファイルがテキスト扱いできるかをMIMEタイプや拡張子から判定する。
 * @param file 判定対象のファイル。
 * @returns boolean テキストとして読み込める場合はtrue。
 */
export function isTextualAttachment(file: File) {
    if (!file) {
        return false;
    }
    const mimeType = file.type || '';
    if (mimeType.startsWith('text/')) {
        return true;
    }
    if (['application/json', 'application/xml', 'text/xml', 'image/svg+xml'].includes(mimeType)) {
        return true;
    }
    return ATTACHMENT_TEXT_EXTENSION_REGEX.test(file.name || '');
}

/**
 * MIMEタイプと拡張子からファイルがDOCX形式かどうかをチェックする。
 * @param file 判定対象のファイル。
 * @returns boolean Word文書ならtrue。
 */
export function isWordDocument(file: File) {
    if (!file) {
        return false;
    }
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType === WORD_DOCX_MIME) {
        return true;
    }
    return WORD_DOCX_EXTENSION_REGEX.test(file.name || '');
}

/**
 * ファイルがExcelワークブックかをMIMEタイプと拡張子で判定する。
 * @param file 判定対象のファイル。
 * @returns boolean Excelファイルならtrue。
 */
export function isExcelAttachment(file: File) {
    if (!file) {
        return false;
    }
    const mimeType = (file.type || '').toLowerCase();
    if (EXCEL_MIME_TYPES.includes(mimeType)) {
        return true;
    }
    return EXCEL_EXTENSION_REGEX.test(file.name || '');
}

/**
 * 対象ファイルがpdf.jsで処理すべきPDFかを判定する。
 * @param file 判定対象のファイル。
 * @returns boolean PDFならtrue。
 */
export function isPdfAttachment(file: File) {
    if (!file) {
        return false;
    }
    const mimeType = (file.type || '').toLowerCase();
    return mimeType === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

/**
 * 添付ファイルを読み込んで種類に応じてテキストもしくはbase64へ変換する。
 * @param file ユーザーが選択したファイル。
 * @returns Promise<AttachmentReadResult> 標準化された添付データ。
 */
export async function readAttachmentContent(file: File): Promise<AttachmentReadResult> {
    if (isWordDocument(file)) {
        const wordText = await extractTextFromDocx(file);
        return {
            content: wordText,
            encoding: 'text'
        };
    }

    if (isExcelAttachment(file)) {
        const excelText = await extractTextFromExcel(file);
        return {
            content: excelText,
            encoding: 'text'
        };
    }

    if (isPdfAttachment(file)) {
        const pdfText = await extractTextFromPdf(file);
        return {
            content: pdfText,
            encoding: 'text'
        };
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const asText = isTextualAttachment(file);

        reader.onload = () => {
            const result = reader.result || '';
            if (asText) {
                resolve({
                    content: typeof result === 'string' ? result : '',
                    encoding: 'text'
                });
                return;
            }

            const base64 = typeof result === 'string' ? (result.split(',')[1] || '') : '';
            resolve({
                content: base64,
                encoding: 'base64'
            });
        };

        reader.onerror = () => {
            reject(reader.error || new Error('ファイル読み込みに失敗しました'));
        };

        if (asText) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    });
}

/**
 * DOCXアーカイブからdocument.xmlを展開し、テキストノードを正規化して取り出す。
 * @param file 解析するWordファイル。
 * @returns Promise<string> 抽出された本文テキスト。
 */
export async function extractTextFromDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
        throw new Error('Wordファイルの本文（word/document.xml）が見つかりませんでした');
    }

    const xmlString = await documentXml.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('WordファイルのXML解析に失敗しました');
    }

    const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
    const lines = paragraphs.map((paragraph) => extractDocxParagraphText(paragraph));
    const normalized = lines
        .map((line) => line.replace(/\s+$/u, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!normalized) {
        throw new Error('Wordファイルからテキストを抽出できませんでした。');
    }

    return normalized;
}

/**
 * w:p要素内のテキストランや改行を連結して1段落の文字列に整形する。
 * @param paragraph document.xml内のw:p要素。
 * @returns string 段落のテキスト。
 */
export function extractDocxParagraphText(paragraph: Element): string {
    const fragments: string[] = [];
    const childNodes = Array.from(paragraph.childNodes);

    childNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }
        const element = node as Element;
        const tagName = element.tagName?.toLowerCase();

        if (tagName === 'w:r') {
            const textNodes = Array.from(element.getElementsByTagName('w:t'));
            textNodes.forEach((textNode) => {
                if (textNode.textContent) {
                    fragments.push(textNode.textContent);
                }
            });
            const breakNodes = element.getElementsByTagName('w:br');
            if (breakNodes.length > 0) {
                fragments.push('\n'.repeat(breakNodes.length));
            }
        } else if (tagName === 'w:tab') {
            fragments.push('\t');
        } else if (tagName === 'w:br') {
            fragments.push('\n');
        }
    });

    return fragments.join('').replace(/\t/g, '    ');
}

/**
 * Excelワークブックの各シートをタブ区切りテキストとして書き出し連結する。
 * @param file 解析するExcelファイル。
 * @returns Promise<string> 結合済みのシートテキスト。
 */
export async function extractTextFromExcel(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excelファイルにシートが見つかりませんでした。');
    }

    const sheetTexts = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            return null;
        }

        const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
            header: 1,
            raw: false
        });

        if (!rows.length) {
            return `【シート: ${sheetName}】\n(空のシート)`;
        }

        const formattedRows = rows
            .map((cells) =>
                (cells || [])
                    .map((cell) => normalizeExcelCellValue(cell))
                    .join('\t')
                    .trimEnd()
            )
            .join('\n');

        return `【シート: ${sheetName}】\n${formattedRows}`;
    });

    const combined = sheetTexts.filter(Boolean).join('\n\n').trim();
    if (!combined) {
        throw new Error('Excelファイルからテキストを抽出できませんでした。');
    }

    return combined;
}

/**
 * SheetJSから渡されるセル値を表示に適した文字列へ正規化する。
 * @param value SheetJSが返すセル値。
 * @returns string 正規化後のセル文字列。
 */
export function normalizeExcelCellValue(value: unknown): string {
    if (value === null || typeof value === 'undefined') {
        return '';
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (typeof value === 'string') {
        return value.replace(/\s+/g, ' ').trim();
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    }
    return '';
}

/**
 * pdf.jsでページを順番に読み取り、認識できたテキストを連結する。
 * @param file 解析するPDFファイル。
 * @returns Promise<string> 抽出されたページテキスト。
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    const pdfjsLib = await loadPdfJsLib();
    const data = await file.arrayBuffer();
    console.log('data');
    console.log(data);
    const loadingTask = pdfjsLib.getDocument({
        data
    });
    const pdfDocument = await loadingTask.promise;
    console.log('pdfDocument');
    console.log(pdfDocument);
    const textChunks: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ')
            .trim();

        if (pageText) {
            textChunks.push(pageText);
        }
    }

    const combined = textChunks.join('\n\n').trim();
    if (!combined) {
        throw new Error('PDFからテキストを抽出できませんでした。画像ベースのpdfは非対応です。pdf view等でpdf内の文字列をテキストとして認識できること（=テキストベースのpdf）を確認してください。）');
    }

    return combined;
}

/**
 * pdf.js本体を遅延ロードし、ワーカーを一度だけ初期化する。
 * @returns Promise<PdfJsLib> 読み込まれたpdf.jsモジュール。
 */
export async function loadPdfJsLib(): Promise<PdfJsLib> {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf').then((pdfjsLib) => {
            if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
                try {
                    const workerOptions = pdfjsLib.GlobalWorkerOptions as any;
                    if (!workerOptions.workerPort) {
                        workerOptions.workerPort = new Worker(
                            new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
                            { type: 'module' }
                        );
                    }
                } catch (error) {
                    console.warn('PDF worker 初期化に失敗しました:', error);
                }
            }
            return pdfjsLib;
        });
    }
    return pdfjsLibPromise;
}
