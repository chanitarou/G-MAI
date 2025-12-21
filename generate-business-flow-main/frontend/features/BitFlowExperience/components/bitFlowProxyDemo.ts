import { ENDPOINTS } from '../../../lib/config';
import { AttachmentReadResult, readAttachmentContent } from '../../GenerateFlowSection/utils/attachmentReaders';

const MX_GRAPH_POLL_INTERVAL_MS = 250;
const MX_GRAPH_MAX_WAIT_MS = 5000;
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
interface AttachmentDescriptor extends AttachmentReadResult {
    id: string;
    name: string;
    size: number;
    type: string;
}
interface ClearAttachmentsOptions {
    skipButtonUpdate?: boolean;
}
let globalErrorHandlersRegistered = false;
let documentShapeCtor: any | null = null;

declare const mxGraph: any;
declare const mxClient: any;
declare const mxUtils: any;
declare const mxCodec: any;
declare const mxGraphModel: any;
declare const mxCell: any;
declare const mxGeometry: any;
declare const mxPoint: any;
declare const mxRectangleShape: any;
declare const mxEllipse: any;
declare const mxRhombus: any;
declare const mxCylinder: any;
declare const mxShape: any;
declare const mxSwimlane: any;
declare const mxCellRenderer: any;
declare const mxConstants: any;
/**
 * Draw.ioのカスタムドキュメントシェイプを登録し、MXGraphで再利用できるコンストラクタを返す。
 * @returns any MXGraphが帳票ノードを描画する際に利用するキャッシュ済みのコンストラクタ。
 */
function getDrawioDocumentShapeCtor() {
    if (documentShapeCtor || typeof mxShape === 'undefined' || typeof mxUtils === 'undefined') {
        return documentShapeCtor;
    }

    const ctor = function DrawioDocumentShape(this: any) {
        mxShape.call(this);
    };

    mxUtils.extend(ctor, mxShape);

    ctor.prototype.paintBackground = function paintBackground(c: any, x: number, y: number, w: number, h: number) {
        const fold = Math.min(w * 0.2, h * 0.2, 20);

        c.begin();
        c.moveTo(x, y);
        c.lineTo(x + w - fold, y);
        c.lineTo(x + w, y + fold);
        c.lineTo(x + w, y + h);
        c.lineTo(x, y + h);
        c.close();
        c.fillAndStroke();

        c.begin();
        c.moveTo(x + w - fold, y);
        c.lineTo(x + w - fold, y + fold);
        c.lineTo(x + w, y + fold);
        c.stroke();
    };

    documentShapeCtor = ctor;
    return documentShapeCtor;
}

class BiTFlowProxyDemo {
    [key: string]: any;
    attachments: AttachmentDescriptor[];
    attachmentIdCounter: number;
    /**
     * デモ用コントローラを生成し、状態初期化やDOM参照・イベント・接続チェックをまとめて行う。
     */
    constructor() {
        this.isGenerating = false;
        this.currentStream = null;
        this.svgStarted = false;
        this.accumulatedSvgCode = '';
        this.updateTimer = null; // デバウンスタイマー
        this.svgDisplayed = false; // drawio表示状態
        this.attachments = [];
        this.attachmentIdCounter = 0;
        
        // MXGraph関連
        this.currentGraph = null; // 現在のグラフインスタンス
        this.parsedCells = new Set(); // 既にパースしたセルのIDを記録
        this.mxgraphInitialized = false; // MXGraph初期化フラグ
        
        // プロンプト履歴を保存するマップ（メッセージIDをキーとする）
        this.promptHistory = new Map();
        this.messageIdCounter = 0;
        
        // セッションID生成（ブラウザごとに一意）
        this.sessionId = this.getOrCreateSessionId();
        console.log('セッションID:', this.sessionId);

        this.chatSectionRatio = this.getStoredPanelRatio();
        
        this.initializeElements();
        this.applyPanelSplit(this.chatSectionRatio);
        this.setupPanelResizer();
        this.attachEventListeners();
        this.updateButtonState(); // 初期状態を正しく設定
        this.checkConnection();
        
        console.log('業務フロー図AI 初期化完了');
    }
    
    // セッションIDの取得または生成
    /**
     * ローカルストレージに保存されたセッションIDを取得し、無ければ新規に発行する。
     * @returns string ブラウザ単位で安定したセッション識別子。
     */
    getOrCreateSessionId() {
        const key = 'bitflow_session_id';
        let sessionId = localStorage.getItem(key);
        
        if (!sessionId) {
            // 新しいセッションIDを生成
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(key, sessionId);
            console.log('新しいセッションIDを生成しました:', sessionId);
        } else {
            console.log('既存のセッションIDを使用:', sessionId);
        }
        
        return sessionId;
    }
    /**
     * UIで利用するDOM要素を取得してキャッシュし、添付リストなどの初期状態を整える。
     */
    initializeElements() {
        // DOM要素の取得
        this.elements = {
            promptInput: document.getElementById('prompt-input'),
            generateBtn: document.getElementById('generate-btn'),
            clearBtn: document.getElementById('clear-btn'),
            chatMessages: document.getElementById('chat-messages'),
            svgCode: document.getElementById('svg-code'),
            flowDiagram: document.getElementById('flow-diagram'),
            btnText: document.getElementById('btn-text'),
            btnSpinner: document.getElementById('btn-spinner'),
            attachBtn: document.getElementById('attach-btn'),
            fileInput: document.getElementById('file-input'),
            attachmentList: document.getElementById('attachment-list'),
            
            // ステータス表示
            chatStatus: document.getElementById('chat-status'),
            codeStatus: document.getElementById('code-status'),
            diagramStatus: document.getElementById('diagram-status'),
            
            // コピーボタン
            copySvgBtn: document.getElementById('copy-svg-btn'),
            
            // ダウンロードボタン
            downloadSvgBtn: document.getElementById('download-svg-btn'),
            
            // プロンプトモーダル要素
            promptModal: document.getElementById('prompt-modal'),
            promptModalBody: document.getElementById('prompt-modal-body'),
            promptModalClose: document.getElementById('prompt-modal-close'),

            // パネルレイアウト
            leftPanel: document.querySelector('.left-panel'),
            chatSection: document.getElementById('chat-section'),
            codeSection: document.getElementById('code-section'),
            panelResizer: document.getElementById('left-panel-resizer')
        };
        
        // 重要な要素の存在確認
        console.log('DOM要素取得結果:');
        console.log('promptInput:', this.elements.promptInput);
        console.log('generateBtn:', this.elements.generateBtn);
        console.log('generateBtn disabled:', this.elements.generateBtn ? this.elements.generateBtn.disabled : 'undefined');
        
        // 添付リストの初期表示
        if (this.elements.attachmentList) {
            this.updateAttachmentListUI();
        }

        // 送信ボタンが取得できない場合はエラー
        if (!this.elements.generateBtn) {
            console.error('送信ボタン (generate-btn) が見つかりません！');
        }
        
        if (!this.elements.promptInput) {
            console.error('プロンプト入力 (prompt-input) が見つかりません！');
        }
    }
    /**
     * ローカルストレージのパネル分割比を読み出し、安全な範囲にクランプした値を返す。
     * @returns number チャットとコード領域の高さ比率。
     */
    getStoredPanelRatio() {
        if (typeof window === 'undefined') {
            return 0.8;
        }
        const stored = window.localStorage.getItem('bitflow_chat_ratio');
        if (!stored) {
            return 0.8;
        }
        const parsed = parseFloat(stored);
        if (Number.isFinite(parsed)) {
            return Math.min(0.9, Math.max(0.2, parsed));
        }
        return 0.8;
    }
    /**
     * 現在のパネル分割比をローカルストレージに保存し、レイアウトを再訪時も維持する。
     */
    persistPanelRatio() {
        if (typeof window === 'undefined') {
            return;
        }
        try {
            window.localStorage.setItem('bitflow_chat_ratio', String(this.chatSectionRatio));
        } catch (error) {
            console.warn('パネル比率の保存に失敗しました:', error);
        }
    }
    /**
     * 指定された値でチャットとコード領域のflexを更新し、分割レイアウトを適用する。
     * @param ratio チャットセクションに割り当てたい高さ比率。
     */
    applyPanelSplit(ratio: number) {
        if (!this.elements || !this.elements.chatSection || !this.elements.codeSection) {
            return;
        }
        const clamped = Math.min(0.9, Math.max(0.2, ratio));
        this.chatSectionRatio = clamped;
        const codeRatio = Math.max(0.1, 1 - clamped);

        this.elements.chatSection.style.flexGrow = String(clamped);
        this.elements.chatSection.style.flexShrink = '1';
        this.elements.chatSection.style.flexBasis = '0%';

        this.elements.codeSection.style.flexGrow = String(codeRatio);
        this.elements.codeSection.style.flexShrink = '1';
        this.elements.codeSection.style.flexBasis = '0%';
    }
    /**
     * ドラッグやキーボード操作でパネル比率を変更できるようリサイズバーにイベントを登録する。
     */
    setupPanelResizer() {
        if (!this.elements) {
            return;
        }
        const resizer = this.elements.panelResizer;
        const leftPanel = this.elements.leftPanel;
        if (!resizer || !leftPanel || !this.elements.chatSection || !this.elements.codeSection) {
            return;
        }

        let isDragging = false;

        const updateFromClientY = (clientY: number | null | undefined) => {
            if (!leftPanel || typeof clientY !== 'number') {
                return;
            }
            const rect = leftPanel.getBoundingClientRect();
            if (!rect || rect.height <= 0) {
                return;
            }
            const ratio = (clientY - rect.top) / rect.height;
            this.applyPanelSplit(ratio);
            this.persistPanelRatio();
        };

        const stopDrag = () => {
            if (!isDragging) {
                return;
            }
            isDragging = false;
            document.body.classList.remove('is-resizing');
        };

        const startDrag = (event: MouseEvent | TouchEvent) => {
            isDragging = true;
            document.body.classList.add('is-resizing');
            event.preventDefault();
            const clientY = 'touches' in event ? (event.touches[0] ? event.touches[0].clientY : null) : event.clientY;
            updateFromClientY(clientY);
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (!isDragging) {
                return;
            }
            updateFromClientY(event.clientY);
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (!isDragging) {
                return;
            }
            const touch = event.touches[0];
            if (!touch) {
                return;
            }
            updateFromClientY(touch.clientY);
            event.preventDefault();
        };

        resizer.addEventListener('mousedown', (event) => startDrag(event));
        resizer.addEventListener('touchstart', (event) => startDrag(event), { passive: false });
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchend', stopDrag);
        window.addEventListener('touchcancel', stopDrag);

        resizer.addEventListener('keydown', (event) => {
            const STEP = 0.05;
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.applyPanelSplit(this.chatSectionRatio + STEP);
                this.persistPanelRatio();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.applyPanelSplit(this.chatSectionRatio - STEP);
                this.persistPanelRatio();
            } else if (event.key === 'Home') {
                event.preventDefault();
                this.applyPanelSplit(0.9);
                this.persistPanelRatio();
            } else if (event.key === 'End') {
                event.preventDefault();
                this.applyPanelSplit(0.2);
                this.persistPanelRatio();
            }
        });
    }
    /**
     * ボタン・ファイル入力・モーダル・ショートカットなどUI全体のイベントリスナーを設定する。
     */
    attachEventListeners() {
        console.log('イベントリスナー設定開始');
        
        // ボタンイベント
        if (this.elements.generateBtn) {
            this.elements.generateBtn.addEventListener('click', (e) => {
                console.log('🔵 Generate button clicked!');
                console.log('🔍 クリック時の状態:', {
                    isGenerating: this.isGenerating,
                    buttonDisabled: this.elements.generateBtn.disabled,
                    inputValue: this.elements.promptInput ? this.elements.promptInput.value : 'N/A',
                    hasInput: this.elements.promptInput ? this.elements.promptInput.value.trim().length > 0 : false
                });
                e.preventDefault();
                e.stopPropagation(); // イベントの伝播を停止
                this.generateFlow();
            });
            console.log('✅ Generate button イベントリスナー設定完了');
            
            // ボタンの初期状態を確認
            console.log('🔍 初期ボタン状態:', {
                exists: true,
                disabled: this.elements.generateBtn.disabled,
                style: {
                    display: window.getComputedStyle(this.elements.generateBtn).display,
                    visibility: window.getComputedStyle(this.elements.generateBtn).visibility,
                    pointerEvents: window.getComputedStyle(this.elements.generateBtn).pointerEvents
                }
            });
        } else {
            console.error('❌ Generate button が存在しないため、イベントリスナーを設定できません');
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', (e) => {
                console.log('Clear button clicked');
                e.preventDefault();
                this.clearAll();
            });
        } else {
            console.error('Clear button が存在しません');
        }

        if (this.elements.attachBtn && this.elements.fileInput) {
            this.elements.attachBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.elements.fileInput.click();
            });

            this.elements.fileInput.addEventListener('change', async (event) => {
                const input = event.target as HTMLInputElement;
                const files = Array.from(input.files || []);
                if (!files.length) {
                    return;
                }
                console.log('📎 添付ファイル選択:', files.map((file) => `${file.name} (${file.size} bytes)`));
                await this.handleFileAttachments(files);
                input.value = '';
            });
        } else {
            console.warn('添付ファイル入力要素が見つかりません');
        }

        // コピーボタンイベント
        if (this.elements.copySvgBtn) {
            this.elements.copySvgBtn.addEventListener('click', (e) => {
                console.log('Copy drawio button clicked');
                e.preventDefault();
                this.copySvgCode();
            });
            console.log('Copy drawio button イベントリスナー設定完了');
        } else {
            console.error('Copy drawio button が存在しません');
        }
        
        // ダウンロードボタンイベント
        if (this.elements.downloadSvgBtn) {
            this.elements.downloadSvgBtn.addEventListener('click', (e) => {
                console.log('Download drawio button clicked');
                e.preventDefault();
                this.downloadSvgFile();
            });
            console.log('Download drawio button イベントリスナー設定完了');
        } else {
            console.error('Download drawio button が存在しません');
        }

        // モーダル関連のイベント
        if (this.elements.promptModalClose) {
            this.elements.promptModalClose.addEventListener('click', () => {
                this.closePromptModal();
            });
        }

        if (this.elements.promptModal) {
            // モーダル背景クリックで閉じる
            this.elements.promptModal.addEventListener('click', (e) => {
                if (e.target === this.elements.promptModal) {
                    this.closePromptModal();
                }
            });
            
            // ESCキーで閉じる
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.elements.promptModal.classList.contains('show')) {
                    this.closePromptModal();
                }
            });
        }

        // キーボードショートカット
        if (this.elements.promptInput) {
            this.elements.promptInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter' && !this.isGenerating) {
                    e.preventDefault();
                    this.generateFlow();
                }
            });

            // プロンプト入力監視
            this.elements.promptInput.addEventListener('input', (e) => {
                console.log('📝 入力イベント発生:', {
                    value: e.target.value,
                    length: e.target.value.length,
                    trimmedLength: e.target.value.trim().length
                });
                this.updateButtonState();
            });
            console.log('✅ Prompt input イベントリスナー設定完了');
        } else {
            console.error('Prompt input が存在しないため、イベントリスナーを設定できません');
        }
        
        console.log('イベントリスナー設定完了');
    }

    // ボタン状態更新関数
    /**
     * 現在のプロンプト・添付状態・生成フラグから送信ボタンの活性/非活性を制御する。
     */
    updateButtonState() {
        if (!this.elements.generateBtn) {
            console.error('updateButtonState: generateBtn が存在しません');
            return;
        }
        
        if (!this.elements.promptInput) {
            console.error('updateButtonState: promptInput が存在しません');
            return;
        }
        
        const inputValue = this.elements.promptInput.value;
        const hasContent = inputValue.trim().length > 0;
        const hasAttachments = (this.attachments && this.attachments.length > 0);
        const shouldDisable = this.isGenerating || (!hasContent && !hasAttachments);
        
        // ボタンのdisabled属性を設定
        this.elements.generateBtn.disabled = shouldDisable;
        
        // ボタンのスタイルも更新（視覚的なフィードバック）
        if (shouldDisable) {
            this.elements.generateBtn.style.opacity = '0.5';
            this.elements.generateBtn.style.cursor = 'not-allowed';
        } else {
            this.elements.generateBtn.style.opacity = '1';
            this.elements.generateBtn.style.cursor = 'pointer';
        }
        
        this.updateStatus('chat', hasContent || hasAttachments ? '入力済み' : '待機中');
        
        console.log('🔍 ボタン状態更新詳細:', {
            inputValue: inputValue,
            hasContent: hasContent,
            hasAttachments: hasAttachments,
            isGenerating: this.isGenerating,
            shouldDisable: shouldDisable,
            actualDisabled: this.elements.generateBtn.disabled,
            buttonExists: !!this.elements.generateBtn,
            inputExists: !!this.elements.promptInput
        });
    }
    /**
     * 指定パネルのステータス表示テキストを更新する。
     * @param panel chat/code/diagramなどのパネルキー。
     * @param status 表示する文言。
     */
    updateStatus(panel, status) {
        const statusElement = this.elements[`${panel}Status`];
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
    /**
     * 新しい添付ファイルに割り当てる一意なIDを生成する。
     * @returns string 添付ファイル識別子。
     */
    generateAttachmentId() {
        const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
        if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
            return cryptoObj.randomUUID();
        }
        this.attachmentIdCounter += 1;
        return `attachment-${Date.now()}-${this.attachmentIdCounter}`;
    }
    /**
     * バイト数を人間が読みやすい短い文字列へ変換する。
     * @param bytes バイト単位のサイズ。
     * @returns string 可読なサイズ表現。
     */
    formatBytes(bytes) {
        if (bytes < 1024) {
            return `${bytes}B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)}KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
    /**
     * 指定されたファイル群を検証・読み込みして添付リストに追加する。
     * @param files ユーザーが選択したファイル配列。
     * @returns Promise<void> 全ファイル処理後に解決。
     */
    async handleFileAttachments(files: File[]) {
        if (!files || files.length === 0) {
            return;
        }

        const attachmentsToAdd: AttachmentDescriptor[] = [];
        for (const file of files) {
            if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
                this.showError(`${file.name} は最大サイズ（${this.formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}）を超えています`);
                continue;
            }

            try {
                const { content, encoding } = await readAttachmentContent(file);
                attachmentsToAdd.push({
                    id: this.generateAttachmentId(),
                    name: file.name,
                    size: file.size,
                    type: file.type || 'unknown',
                    encoding,
                    content
                });
            } catch (error) {
                console.error('ファイル読み込みエラー:', file.name, error);
                const message = error instanceof Error ? error.message : '不明なエラー';
                this.showError(`${file.name} の読み込みに失敗しました: ${message}`);
            }
        }

        if (attachmentsToAdd.length > 0) {
            this.attachments = this.attachments.concat(attachmentsToAdd);
            this.updateAttachmentListUI();
            this.updateButtonState();
        }
    }
    /**
     * 現在の添付配列をもとにチップ状のリスト表示を再描画する。
     */
    updateAttachmentListUI() {
        const list = this.elements.attachmentList;
        if (!list) {
            return;
        }

        list.innerHTML = '';

        if (!this.attachments || this.attachments.length === 0) {
            list.classList.add('empty');
            const placeholder = document.createElement('span');
            placeholder.className = 'attachment-placeholder';
            placeholder.textContent = '現在、添付ファイルはありません';
            list.appendChild(placeholder);
            return;
        }

        list.classList.remove('empty');
        this.attachments.forEach((attachment) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';

            const icon = document.createElement('i');
            icon.className = 'fas fa-file-alt';
            icon.setAttribute('aria-hidden', 'true');

            const name = document.createElement('span');
            name.className = 'attachment-name';
            name.textContent = attachment.name;
            name.title = attachment.name;

            const meta = document.createElement('span');
            meta.className = 'attachment-meta';
            meta.textContent = `${this.formatBytes(attachment.size)}${attachment.encoding === 'base64' ? ' / base64' : ''}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'attachment-remove';
            removeBtn.type = 'button';
            removeBtn.innerHTML = '&times;';
            removeBtn.setAttribute('aria-label', `${attachment.name} を削除`);
            removeBtn.addEventListener('click', () => this.removeAttachment(attachment.id));

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(meta);
            item.appendChild(removeBtn);
            list.appendChild(item);
        });
    }
    /**
     * 指定IDの添付を削除し、関連UIを更新する。
     * @param attachmentId generateAttachmentIdで発行したID。
     */
    removeAttachment(attachmentId) {
        if (!this.attachments || this.attachments.length === 0) {
            return;
        }

        this.attachments = this.attachments.filter((attachment) => attachment.id !== attachmentId);
        this.updateAttachmentListUI();
        this.updateButtonState();
    }
    /**
     * 添付名とサイズをまとめた短いリスト文字列を生成する。
     * @param attachments 要約対象の添付群。
     * @returns string 要約テキスト。
     */
    buildAttachmentSummary(attachments) {
        if (!attachments || attachments.length === 0) {
            return '';
        }

        return attachments
            .map((attachment, index) => `#${index + 1}: ${attachment.name} (${this.formatBytes(attachment.size)})`)
            .join('\n');
    }
    /**
     * ユーザープロンプトと添付サマリを結合し、チャット用の表示文字列を構築する。
     * @param prompt ユーザー入力。
     * @param attachments プロンプトに紐づく添付。
     * @returns string 結合済みメッセージ。
     */
    buildUserMessageDisplay(prompt, attachments) {
        const trimmedPrompt = (prompt || '').trim();
        const summary = this.buildAttachmentSummary(attachments);

        if (trimmedPrompt && summary) {
            return `${trimmedPrompt}\n\n--- 添付概要 ---\n${summary}`;
        }

        if (!trimmedPrompt && summary) {
            return `添付ファイル (${attachments.length}件)\n${summary}`;
        }

        return trimmedPrompt || '（入力が空です）';
    }
    /**
     * 添付を全てクリアし、必要に応じてボタン状態も更新する。
     * @param options skipButtonUpdateなどのオプション。
     */
    clearAttachments(options: ClearAttachmentsOptions = {}) {
        const { skipButtonUpdate = false } = options;
        this.attachments = [];
        this.updateAttachmentListUI();

        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }

        if (!skipButtonUpdate) {
            this.updateButtonState();
        }
    }
    /**
     * 上流プロキシの接続状態を更新（またはログ出力）する。
     * @param status 内部ステータスキー。
     * @param message 表示用メッセージ。
     */
    updateConnectionStatus(status, message) {
        // 接続ステータス表示は削除済みなので何もしない
        console.log(`接続状態: ${status} - ${message}`);
    }
    /**
     * 送信前にプロキシのヘルスチェックを実行する。
     * @returns Promise<boolean> サーバー応答が成功した場合はtrue。
     */
    async checkConnection() {
        console.log('プロキシサーバー接続確認開始');
        this.updateConnectionStatus('checking', '接続確認中...');
        
        try {
            const response = await fetch(ENDPOINTS.health, {
                method: 'GET',
                // timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('接続成功:', data);
                this.updateConnectionStatus('connected', 'サーバー接続OK');
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('接続失敗:', error);
            this.updateConnectionStatus('disconnected', 'サーバー接続失敗');
            this.showError('プロキシサーバーに接続できません。サーバーが起動しているか確認してください。');
            return false;
        }
    }
    /**
     * トリムした入力と添付内容を結合し、APIへ送る最終プロンプトを構築する。
     * @param userPrompt ユーザー入力テキスト。
     * @param attachments 埋め込む添付情報。
     * @returns string 送信するペイロード。
     */
    preparePrompt(userPrompt, attachments = []) {
        // 2回目以降の修正指示にも対応するため、ユーザー入力と添付情報をまとめる
        console.log('プロンプト準備: セッションID', this.sessionId);
        console.log('ユーザープロンプト:', userPrompt);
        console.log('添付ファイル数:', attachments.length);
        
        const trimmedPrompt = (userPrompt || '').trim();
        if (!attachments || attachments.length === 0) {
            return trimmedPrompt;
        }

        const attachmentDetails = attachments
            .map((attachment, index) => {
                const descriptor = `【添付${index + 1}: ${attachment.name} | ${this.formatBytes(attachment.size)} | ${attachment.encoding === 'text' ? 'text' : 'base64'}】`;
                return `${descriptor}\n${attachment.content}`;
            })
            .join('\n\n');

        if (trimmedPrompt) {
            return `${trimmedPrompt}\n\n--- 添付ファイル詳細 ---\n${attachmentDetails}`;
        }

        return `以下の添付ファイルをもとに業務フロー図を生成してください。\n\n--- 添付ファイル詳細 ---\n${attachmentDetails}`;
    }
    /**
     * 入力検証から送信・ストリーミング/バッチ分岐までの上位フローをまとめて実行する。
     */
    async generateFlow() {
        console.log('🚀 generateFlow() 呼び出し開始');
        console.log('🔍 現在の状態詳細:', {
            isGenerating: this.isGenerating,
            generateBtnExists: !!this.elements.generateBtn,
            generateBtnDisabled: this.elements.generateBtn ? this.elements.generateBtn.disabled : 'N/A',
            promptInputExists: !!this.elements.promptInput,
            promptInputValue: this.elements.promptInput ? this.elements.promptInput.value : 'N/A',
            promptInputLength: this.elements.promptInput ? this.elements.promptInput.value.length : 'N/A'
        });
        
        if (!this.elements.promptInput) {
            console.error('promptInput が存在しません！');
            this.showError('システムエラー: プロンプト入力が見つかりません');
            return;
        }
        
        const rawPrompt = this.elements.promptInput.value || '';
        const userPrompt = rawPrompt.trim();
        const attachmentsSnapshot: AttachmentDescriptor[] = (this.attachments || []).map((attachment) => ({ ...attachment }));
        console.log('📝 ユーザープロンプト:', userPrompt);
        console.log('📎 添付ファイル数:', attachmentsSnapshot.length);
        
        if (!userPrompt && attachmentsSnapshot.length === 0) {
            console.log('⚠️ プロンプトと添付ファイルが空です');
            this.showError('プロンプトまたは添付ファイルを入力してください。');
            return;
        }

        if (this.isGenerating) {
            console.log('⚠️ 既に生成中のため無視');
            return;
        }

        console.log('フロー生成開始:', userPrompt);
        
        try {
            // ユーザーメッセージを追加
            const chatMessage = this.buildUserMessageDisplay(userPrompt, attachmentsSnapshot);
            this.addUserMessage(chatMessage);
            
            // 入力フォームをクリア（送信後すぐにクリア）
            this.elements.promptInput.value = '';
            this.clearAttachments({ skipButtonUpdate: true });
            this.updateButtonState(); // ボタン状態も更新
            console.log('📝 入力フォームをクリアしました');
            
            this.startGenerating();
            
            // 接続確認
            const isConnected = await this.checkConnection();
            if (!isConnected) {
                throw new Error('プロキシサーバーに接続できません');
            }

            const fullPrompt = this.preparePrompt(userPrompt, attachmentsSnapshot);
            const streaming = true;
            
            console.log('送信プロンプト:', fullPrompt);
            console.log('ストリーミング:', streaming);

            if (streaming) {
                await this.generateFlowStreaming(fullPrompt);
            } else {
                await this.generateFlowBatch(fullPrompt);
            }

        } catch (error) {
            console.error('フロー生成エラー:', error);
            this.hideTypingIndicator();
            this.showError(`フロー生成エラー: ${error.message}`);
        } finally {
            // 確実に生成状態を終了
            this.stopGenerating();
            this.hideTypingIndicator();
        }
    }
    /**
     * ストリーミングAPIを呼び出し、レスポンスストリームをリアルタイム処理へ渡す。
     * @param prompt 完成済みプロンプト。
     * @returns Promise<void> ストリーム完了時に解決。
     */
    async generateFlowStreaming(prompt) {
        console.log('ストリーミング生成開始');
        
        this.updateStatus('response', 'ストリーミング中');
        this.updateStatus('code', '解析待機中');
        this.updateStatus('diagram', '描画待機中');

        try {
            const response = await fetch(ENDPOINTS.messages(this.sessionId), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_prompt: prompt,
                    streaming: true,
                    use_agent_mode: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            this.currentStream = response;
            await this.handleStreamingResponse(response);

        } catch (error) {
            console.error('ストリーミングエラー:', error);
            throw error;
        }
    }
    /**
     * 指定ミリ秒だけ待機するユーティリティ。
     * @param ms 待機時間。
     * @returns Promise<void> 待機終了時に解決。
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * fetchのReadableStreamを読み取り、改行区切りJSONを解析しながらUIを逐次更新する。
     * @param response ストリーミングAPIのレスポンス。
     * @returns Promise<void> すべてのチャンク処理後に解決。
     */
    async handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        try {
            while (true) {
                // await this.sleep(1000);
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('ストリーミング完了');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    try {
                        const data = JSON.parse(line);
                        console.log('ストリームデータ:', data);

                        if (data.type === 'start') {
                            console.log('ストリーミング開始:', data.message);
                            this.showTypingIndicator();
                            
                            // 実際のプロンプトを保存（サーバーから送られてきた場合）
                            if (data.actualPrompt && this.currentMessageId) {
                                const promptData = this.promptHistory.get(this.currentMessageId);
                                if (promptData) {
                                    promptData.actualPrompt = data.actualPrompt;
                                    console.log('実際のプロンプトを保存:', this.currentMessageId);
                                }
                            }
                            
                        } else if (data.type === 'content') {
                            fullContent += data.text;
                            this.updateAssistantMessage(fullContent);
                            
                            // リアルタイムSVG処理
                            this.processStreamingSVG(data.text, fullContent);
                            
                        } else if (data.type === 'complete') {
                            console.log('ストリーミング完了イベント受信:', data.totalChunks, 'チャンク');
                            console.log('完了時のコンテンツ長:', data.fullContent ? data.fullContent.length : 'なし');
                            this.hideTypingIndicator();
                            this.updateStatus('chat', '完了');
                            this.finalizeGeneration(data.fullContent || fullContent);
                            
                        } else if (data.type === 'error') {
                            console.error('ストリーミングエラー:', data.error);
                            this.hideTypingIndicator();
                            throw new Error(data.error);
                        }
                    } catch (parseError) {
                        console.warn('JSON解析エラー:', parseError, 'Line:', line);
                    }
                }
            }
        } catch (error) {
            console.error('ストリーミング処理エラー:', error);
            throw error;
        }
    }
    /**
     * ストリーミングできない場合の単発API呼び出しを行う。
     * @param prompt 完成済みプロンプト。
     * @returns Promise<void> バッチ呼び出し完了時に解決。
     */
    async generateFlowBatch(prompt) {
        console.log('バッチ生成開始');
        
        this.updateStatus('chat', 'API呼び出し中');
        this.showTypingIndicator();
        
        try {
            const response = await fetch(ENDPOINTS.messagesBatch, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('バッチ生成完了:', result);

            // 実際のプロンプトを保存（サーバーから送られてきた場合）
            if (result.actualPrompt && this.currentMessageId) {
                const promptData = this.promptHistory.get(this.currentMessageId);
                if (promptData) {
                    promptData.actualPrompt = result.actualPrompt;
                    console.log('実際のプロンプトを保存（バッチ）:', this.currentMessageId);
                }
            }

            this.hideTypingIndicator();
            this.updateAssistantMessage(result.content);
            this.updateStatus('chat', '完了');
            this.finalizeGeneration(result.content);

        } catch (error) {
            console.error('バッチ生成エラー:', error);
            throw error;
        }
    }

    // リアルタイムSVG処理
    /**
     * ストリームの部分文字列からdraw.io出力を検出し、SVG表示と図を同期させる。
     * @param newText 新たに受信したチャンク。
     * @param fullContent これまでに蓄積したアシスタント文。
     */
    processStreamingSVG(newText, fullContent) {
        // drawio開始の検出
        if (!this.svgStarted && (newText.includes('<?xml') || newText.includes('<mxfile'))) {
            console.log('drawioコード開始を検出');
            this.svgStarted = true;
            this.accumulatedSvgCode = '';
            this.updateStatus('code', 'drawio生成中');
        }

        // SVG中の場合、リアルタイムで蓄積
        if (this.svgStarted) {
            this.accumulatedSvgCode += newText;
            
            // リアルタイムでdrawioコードを表示（シンタックスハイライト付き）
            this.displaySVGCode(this.accumulatedSvgCode);
            this.forceScroll(this.elements.svgCode);
            
            // リアルタイムでフロー図を強制更新
            this.forceUpdateFlowDiagram(this.accumulatedSvgCode);
            
            // drawio終了を検出して最終更新
            if (this.accumulatedSvgCode.includes('</mxfile>')) {
                console.log('drawioコード完了を検出');
                this.updateStatus('code', 'drawio完了');
                
                // 完全なdrawioを抽出してフロー図を更新
                const svgMatch = this.accumulatedSvgCode.match(/<\?xml[\s\S]*?<\/mxfile>|<mxfile[\s\S]*?<\/mxfile>/);
                if (svgMatch) {
                    this.updateFlowDiagram(svgMatch[0]);
                }
            }
        }
    }

    // drawioコードのシンタックスハイライト表示（適切なインデント対応）
    /**
     * draw.io XMLを整形し、簡易ハイライトを適用してUIに表示する。
     * @param svgCode 生のdraw.io XML文字列。
     */
    displaySVGCode(svgCode) {
        try {
            console.log('displayDrawioCode - 入力drawioコードの最初の100文字:', svgCode.substring(0, 100));
            
            // インデントを適切に整理
            const formattedCode = this.formatSVGCode(svgCode);
            console.log('formatDrawioCode後の最初の100文字:', formattedCode.substring(0, 100));
            
            // HTMLエスケープ
            let escapedCode = formattedCode
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            // シンタックスハイライト適用（より安全な方法）
            let highlightedCode = escapedCode;
            
            // 各パターンを個別に処理（順序重要）
            // 1. コメントを先に処理
            highlightedCode = highlightedCode.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="svg-comment">$1</span>');
            
            // 2. XML宣言
            highlightedCode = highlightedCode.replace(/(&lt;\?xml[\s\S]*?\?&gt;)/g, '<span class="svg-tag">$1</span>');
            
            // 3. 完全なタグ（開始タグと終了タグ）を一度に処理
            highlightedCode = highlightedCode.replace(/(&lt;\/?)([a-zA-Z][\w\-:]*)((?:\s+[\w\-:]+(?:=&quot;[^&]*&quot;)?)*\s*)(\/?)(&gt;)/g, 
                function(match, openBracket, tagName, attributes, selfClose, closeBracket) {
                    // タグ名とブラケットをハイライト
                    let result = '<span class="svg-tag">' + openBracket + tagName + '</span>';
                    
                    // 属性を処理
                    if (attributes) {
                        result += attributes.replace(/(\s+)([\w\-:]+)(=)(&quot;)([^&]*)(&quot;)/g, 
                            '$1<span class="svg-attribute">$2</span>$3$4<span class="svg-value">$5</span>$6');
                    }
                    
                    // 閉じブラケットをハイライト
                    result += '<span class="svg-tag">' + selfClose + closeBracket + '</span>';
                    
                    return result;
                }
            );

            this.elements.svgCode.innerHTML = highlightedCode;
            // プレースホルダークラスを削除
            this.elements.svgCode.classList.remove('placeholder');
        } catch (error) {
            console.warn('シンタックスハイライトエラー:', error);
            // エラー時はプレーンテキストで表示
            this.elements.svgCode.textContent = svgCode;
            // プレースホルダークラスを削除
            this.elements.svgCode.classList.remove('placeholder');
        }
    }

    // drawioコードのフォーマット（右寄り問題完全解決版）
    /**
     * draw.io XMLのインデントとスペースを正規化する。
     * @param svgCode 生のdraw.io XML文字列。
     * @returns string 整形済みXML。
     */
    formatSVGCode(svgCode) {
        try {
            // 基本的な改行で分割し、完全に新しいインデントを作成
            const lines = svgCode.replace(/>\s*</g, '>\n<').split('\n');
            let indentLevel = 0;
            const indentSize = 2;
            const formattedLines = [];
            
            for (let line of lines) {
                // 全ての先頭・末尾空白を除去
                const cleanLine = line.trim();
                if (!cleanLine) continue;
                
                // 閉じタグ、XMLヘッダー、コメント、自己終了タグの処理
                let isClosingTag = cleanLine.startsWith('</');
                let isXmlHeader = cleanLine.startsWith('<?');
                let isComment = cleanLine.startsWith('<!--');
                let isSelfClosing = cleanLine.endsWith('/>');
                let isTextContent = !cleanLine.startsWith('<');
                
                // 閉じタグは先にインデントを下げる
                if (isClosingTag) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                
                // 完全に新しいインデントを作成（既存の空白は一切考慮しない）
                let finalIndent = '';
                if (!isXmlHeader) { // XMLヘッダーはインデントなし
                    finalIndent = ' '.repeat(indentLevel * indentSize);
                }
                
                // 行を追加
                formattedLines.push(finalIndent + cleanLine);
                
                // 開始タグの場合はインデントを上げる
                if (!isClosingTag && !isXmlHeader && !isComment && !isSelfClosing && !isTextContent && cleanLine.startsWith('<')) {
                    // テキストを含む一行タグでない場合のみインデントを上げる
                    if (!cleanLine.includes('><') && !cleanLine.match(/<[^>]+>[^<]+<\/[^>]+>/)) {
                        indentLevel++;
                    }
                }
            }
            
            const result = formattedLines.join('\n');
            console.log('🎨 drawioフォーマット完了:', { 
                originalLines: lines.length, 
                formattedLines: formattedLines.length,
                maxIndent: Math.max(...formattedLines.map(line => (line.match(/^ */)[0].length) / indentSize))
            });
            
            return result;
            
        } catch (error) {
            console.warn('drawioフォーマットエラー:', error);
            // エラー時はそのまま表示
            return svgCode;
        }
    }

    // 強制リアルタイムフロー図更新
    /**
     * リアルタイム描画をデバウンスしつつ、MXGraph更新をスケジュールする。
     * @param svgCode 部分または完全なdraw.io XML。
     */
    forceUpdateFlowDiagram(svgCode) {
        try {
            // SVGが十分な長さになったら表示を試行
            if (svgCode.length < 200) {
                console.log('svgCode.length < 200');
                return;
            }
            
            // 基本的なdrawio構造をチェック
            if (!svgCode.includes('<mxfile') && !svgCode.includes('<mxGraphModel')) {
                console.log("!svgCode.includes('<mxfile') && !svgCode.includes('<mxGraphModel')");
                return;
            }
            
            // 10msに１度実行
            if (this.updateTimer) return; // すでにタイマー中ならスキップ

            this.updateTimer = setTimeout(() => {
                this._doForceUpdateFlowDiagram(svgCode);
                this.updateTimer = null; // タイマー解除して再実行を許可
            }, 10);

        } catch (error) {
            console.debug('フロー図更新スキップ:', error.message);
        }
    }
    
    // 実際の更新処理
    /**
     * 部分的なdraw.io XMLを使ってリアルタイムのMXGraph描画を試みる。
     * @param drawioCode 描画対象のXML断片。
     */
    _doForceUpdateFlowDiagram(drawioCode) {
        console.log('リアルタイム描画実行:', drawioCode.length, '文字');
        
        // MXGraphが読み込まれているか確認
        if (typeof mxGraph === 'undefined') {
            console.error('MXGraphライブラリが読み込まれていません');
            return;
        }
        
        // 不完全なdrawioコードを補完
        let displayCode = drawioCode;
        
        // XMLヘッダー追加
        const xmlHeaderIndex = displayCode.indexOf('<?xml');
        if (xmlHeaderIndex === -1) {
            displayCode = '<?xml version="1.0" encoding="UTF-8"?>\n' + displayCode;
        } else if (xmlHeaderIndex > 0) {
            displayCode = displayCode.slice(xmlHeaderIndex);
        }

        // 余分な文字列を最後の</mxCell>以降から削除
        const lastMxCellIndex = displayCode.lastIndexOf('</mxCell>');
        if (lastMxCellIndex !== -1) {
            displayCode = displayCode.slice(0, lastMxCellIndex + '</mxCell>'.length);
        }
        
        // 簡易的に不完全タグを補完
        ['</root>', '</mxGraphModel>', '</diagram>', '</mxfile>'].forEach((tag) => {
            if (!displayCode.includes(tag)) {
                displayCode += tag;
            }
        });
        
        // シンプルなリアルタイム描画実装
        try {
            // 毎回コンテナを新しく作成（重要：下に追加されるのを防ぐ）
            console.log('MXGraphコンテナを新規作成');
            this.elements.flowDiagram.innerHTML = '<div id="mxgraph-container" style="width: 100%; height: 100%; min-height: 600px; background: white; overflow: auto;"></div>';
            
            const container = document.getElementById('mxgraph-container');
            if (!container) {
                console.error('コンテナが見つかりません');
                return;
            }
            
            // 単純に毎回新しいグラフを作成
            try {
                const graph = new mxGraph(container);
                graph.setEnabled(false);
                
                // Draw.io互換スタイルを適用
                this.setupGraphStyles(graph);
                
                // XMLエスケープ関数
                const escapeXmlAttribute = (str) => {
                    if (!str) return str;
                    return str
                        .replace(/&(?!amp;|lt;|gt;|quot;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#x27;');
                };
                
                // displayCodeの属性値をエスケープ
                let escapedDisplayCode = displayCode;
                escapedDisplayCode = escapedDisplayCode.replace(/(\w+)="([^"]*)"/g, (match, attrName, attrValue) => {
                    if (attrValue.includes('&lt;') || attrValue.includes('&gt;') || 
                        attrValue.includes('&amp;') || attrValue.includes('&quot;')) {
                        return match;
                    }
                    if (attrValue.includes('<') || attrValue.includes('>') || 
                        attrValue.includes('&') || attrValue.includes('"')) {
                        const escaped = escapeXmlAttribute(attrValue);
                        return `${attrName}="${escaped}"`;
                    }
                    return match;
                });
                
                // drawio XMLをパース
                const parser = new DOMParser();
                const doc = parser.parseFromString(escapedDisplayCode, 'text/xml');
                const codec = new mxCodec();
                
                // mxGraphModelを探す
                const mxGraphModel = doc.querySelector('mxGraphModel');
                if (mxGraphModel) {
                    codec.decode(mxGraphModel, graph.getModel());
                    
                    // スタイルを正確に適用
                    this.fixGraphStyles(graph);
                }
                
                // フロー図をコンテンツに合わせてフィット（リアルタイム）
                try {
                    // 調整中は非表示（ちらつき防止）
                    container.style.visibility = 'hidden';
                    
                    graph.fit();
                    const bounds = graph.getGraphBounds();
                    if (bounds) {
                        const padding = 20;
                        const contentWidth = Math.min(bounds.width + (padding * 2), this.elements.flowDiagram.clientWidth - 10);
                        const contentHeight = Math.max(bounds.height + (padding * 2), 400);
                        
                        // サイズを一度に設定
                        requestAnimationFrame(() => {
                            container.style.width = `${contentWidth}px`;
                            container.style.height = `${contentHeight}px`;
                            container.style.overflow = 'hidden';
                            
                            graph.sizeDidChange();
                            this.alignGraphToTop(graph);
                            
                            // 表示
                            container.style.visibility = 'visible';
                        });
                    } else {
                        container.style.visibility = 'visible';
                    }
                } catch (fitError) {
                    console.log('リアルタイムフィットエラー:', fitError.message);
                    container.style.visibility = 'visible';
                }
                
                graph.refresh();
                console.log('リアルタイム描画成功');
                this.updateStatus('diagram', '描画中');
                
                // 表示完了
                this.elements.flowDiagram.classList.remove('svg-processing');
                this.elements.flowDiagram.classList.add('svg-ready');
                
            } catch (e) {
                console.debug('描画エラー:', e.message);
            }
            
        } catch (displayError) {
            console.error('リアルタイム描画エラー:', displayError);
        }
    }
    
    // リアルタイムグラフの初期化
    /**
     * インクリメンタル描画用のMXGraphインスタンスを初期化し、補助マップをリセットする。
     */
    initializeRealtimeGraph() {
        if (!this.elements.flowDiagram) {
            console.error('フロー図要素が見つかりません');
            return;
        }
        
        // MXGraphライブラリの確認
        if (typeof mxGraph === 'undefined') {
            console.error('MXGraphライブラリが利用できません');
            return;
        }
        
        // 処理中状態にする
        this.elements.flowDiagram.classList.add('svg-processing');
        this.elements.flowDiagram.classList.remove('svg-ready');
        
        // MXGraphコンテナを作成
        this.elements.flowDiagram.innerHTML = '<div id="mxgraph-container" style="width: 100%; height: 100%; background: white; overflow: auto;"></div>';
        const container = document.getElementById('mxgraph-container');
        
        if (!container) {
            console.error('MXGraphコンテナの作成に失敗しました');
            return;
        }
        
        try {
            // グラフオブジェクトを作成
            this.currentGraph = new mxGraph(container);
            this.currentGraph.setEnabled(false); // 編集を無効化
            
            // カスタムスタイルを設定
            this.setupGraphStyles(this.currentGraph);
            
            // リアルタイム描画用のデータ構造を初期化
            this.vertexMap = new Map(); // IDから頂点オブジェクトへのマップ
            this.pendingEdges = []; // 接続先が見つかっていないエッジを保存
            
            console.log('リアルタイムグラフ初期化完了');
        } catch (error) {
            console.error('グラフ初期化エラー:', error);
            throw error;
        }
    }
    
    // グラフのスタイルを設定（Draw.io互換）
    /**
     * MXGraphのスタイルシートを設定し、Draw.ioに近い見た目を再現する。
     * @param graph スタイルを更新するグラフインスタンス。
     */
    setupGraphStyles(graph) {
        if (!graph || !graph.getStylesheet) {
            console.error('グラフオブジェクトが無効です');
            return;
        }
        
        // MXGraphオブジェクトの存在確認
        if (typeof mxConstants === 'undefined') {
            console.warn('mxConstantsが利用できません。基本的なスタイル設定をスキップします');
            return;
        }
        
        if (typeof mxCellRenderer === 'undefined') {
            console.warn('mxCellRendererが利用できません。カスタムシェイプ登録をスキップします');
        }
        
        try {
            const stylesheet = graph.getStylesheet();
            
            // Draw.io互換のデフォルトスタイルを設定
            const defaultVertexStyle = stylesheet.getDefaultVertexStyle();
            defaultVertexStyle[mxConstants.STYLE_FONTCOLOR] = '#000000';
            defaultVertexStyle[mxConstants.STYLE_FONTFAMILY] = 'Helvetica, Arial, sans-serif';
            defaultVertexStyle[mxConstants.STYLE_FONTSIZE] = '12';
            defaultVertexStyle[mxConstants.STYLE_STROKECOLOR] = '#000000';
            defaultVertexStyle[mxConstants.STYLE_STROKEWIDTH] = '1';
            
            // エッジのデフォルトスタイル
            const defaultEdgeStyle = stylesheet.getDefaultEdgeStyle();
            defaultEdgeStyle[mxConstants.STYLE_STROKECOLOR] = '#000000';
            defaultEdgeStyle[mxConstants.STYLE_STROKEWIDTH] = '1';
            defaultEdgeStyle[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC;
            
            // Draw.io互換シェイプの登録（mxCellRendererが利用可能な場合のみ）
            if (typeof mxCellRenderer !== 'undefined') {
                this.registerDrawioCompatibleShapes();
            }
            
            console.log('Draw.io互換スタイルの設定完了');
            
        } catch (error) {
            console.error('スタイル設定エラー:', error);
        }
    }

    // Draw.io互換シェイプの登録
    /**
     * Draw.io固有のシェイプ名を描画できるよう追加のMXGraphシェイプを登録する。
     */
    registerDrawioCompatibleShapes() {
        try {
            // swimlaneシェイプ（スイムレーン）
            if (typeof mxSwimlane !== 'undefined') {
                mxCellRenderer.registerShape('swimlane', mxSwimlane);
                console.log('swimlaneシェイプを登録しました');
            } else {
                console.warn('mxSwimlaneが利用できません');
            }
            
            // groupシェイプ（凡例用）
            if (typeof mxRectangleShape !== 'undefined') {
                mxCellRenderer.registerShape('group', mxRectangleShape);
                console.log('groupシェイプを登録しました');
            }
            
            // rhombusシェイプ（分岐用のひし形）
            if (typeof mxRhombus !== 'undefined') {
                mxCellRenderer.registerShape('rhombus', mxRhombus);
                console.log('rhombusシェイプを登録しました');
            }
            
            // ellipseシェイプ（開始・終了用の丸）
            if (typeof mxEllipse !== 'undefined') {
                mxCellRenderer.registerShape('ellipse', mxEllipse);
                console.log('ellipseシェイプを登録しました');
            }
            
            // cylinder3シェイプ（DBアイコン用）
            if (typeof mxCylinder !== 'undefined') {
                mxCellRenderer.registerShape('cylinder3', mxCylinder);
                mxCellRenderer.registerShape('cylinder', mxCylinder); // 両方の名前で登録
                console.log('cylinder/cylinder3シェイプを登録しました');
            }
            
            // documentシェイプ（Draw.io互換）
            const documentShape = getDrawioDocumentShapeCtor();
            if (documentShape) {
                mxCellRenderer.registerShape('document', documentShape);
                console.log('documentシェイプを登録しました');
            }
            
            // Note/Sticky noteシェイプも追加
            if (typeof mxRectangleShape !== 'undefined') {
                mxCellRenderer.registerShape('note', mxRectangleShape);
            }
            
            // デフォルトの四角形をrounded rectとしても登録
            if (typeof mxRectangleShape !== 'undefined') {
                mxCellRenderer.registerShape('rounded', mxRectangleShape);
            }
            
        } catch (error) {
            console.error('カスタムシェイプ登録エラー:', error);
        }
    }
    
    // drawioのインラインスタイルを正確に適用（Draw.io互換）
    /**
     * 全セルを巡回してスタイルを再適用し、Draw.io互換の見た目に調整する。
     * @param graph 調整対象のグラフ。
     */
    fixGraphStyles(graph) {
        // MXGraphライブラリの存在確認
        if (!graph || !graph.getModel) {
            console.error('グラフオブジェクトが無効です');
            return;
        }
        
        const model = graph.getModel();
        const cells = model.cells;
        
        model.beginUpdate();
        try {
            for (let cellId in cells) {
                const cell = cells[cellId];
                if (!cell || !cell.style) continue;
                
                // スタイル文字列を解析
                let style = cell.style;
                
                // Draw.io互換のシェイプマッピング
                style = this.mapDrawioShapes(style);
                
                // スタイルパラメータを解析して適用
                const styleObj = this.parseStyleString(style);
                
                // Draw.io互換のスタイル調整
                this.adjustDrawioCompatibleStyle(styleObj, cell);
                
                // スタイルを再構築
                const newStyle = this.rebuildStyleString(styleObj);
                
                // セルにスタイルを適用（setStyleメソッドが存在する場合）
                if (typeof cell.setStyle === 'function') {
                    cell.setStyle(newStyle);
                } else {
                    // setStyleがない場合は直接styleプロパティを設定
                    cell.style = newStyle;
                }
            }
        } finally {
            model.endUpdate();
        }
        
        graph.refresh();
    }

    // グラフの描画を水平中央・上揃えに整える
    /**
     * MXGraphビューの平行移動を調整し、横中央・上揃えになるよう配置する。
     * @param graph アライン対象のグラフ。
     */
    alignGraphToTop(graph) {
        if (!graph || !graph.view) {
            return;
        }

        try {
            if (typeof graph.center === 'function') {
                // 横方向のみ中央寄せ
                graph.center(true, false);
            }

            const view = graph.view;
            if (!view) {
                return;
            }

            const currentTranslateX = view.translate ? view.translate.x : 0;
            const setTranslate = typeof view.setTranslate === 'function';
            const targetY = 0;

            if (setTranslate) {
                view.setTranslate(currentTranslateX, targetY);
            } else if (view.translate) {
                view.translate.x = currentTranslateX;
                view.translate.y = targetY;
            }
        } catch (error) {
            console.warn('グラフの上揃えに失敗:', error);
        }
    }
    
    // Draw.ioシェイプマッピング
    /**
     * Draw.ioのスタイル名を最も近いMXGraph表現へ書き換える。
     * @param style mxCellのスタイル文字列。
     * @returns string 変換後のスタイル。
     */
    mapDrawioShapes(style) {
        // shape=rhombusが含まれているか確認（ひし形）
        if (style.includes('rhombus')) {
            console.log('ひし形シェイプを検出:', style);
        }
        
        // shape=ellipseが含まれているか確認（丸）
        if (style.includes('ellipse')) {
            console.log('楕円シェイプを検出:', style);
        }
        
        // shape=documentが含まれているか確認（帳票）
        if (style.includes('document')) {
            console.log('ドキュメントシェイプを検出:', style);
        }
        
        // cylinder3 -> cylinder
        style = style.replace(/shape=cylinder3/g, 'shape=cylinder');
        
        // その他のシェイプマッピング
        style = style.replace(/shape=process/g, 'shape=rectangle');
        style = style.replace(/shape=rhombus/g, 'shape=rhombus');
        
        return style;
    }
    
    // スタイル文字列をオブジェクトに解析
    /**
     * Draw.ioのスタイル文字列を操作しやすいオブジェクトに分解する。
     * @param style セミコロン区切りのスタイル。
     * @returns Record<string, string> 解析結果の連想配列。
     */
    parseStyleString(style) {
        const styleObj = {};
        const pairs = style.split(';');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                styleObj[key.trim()] = value.trim();
            }
        });
        
        return styleObj;
    }
    
    // Draw.io互換のスタイル調整
    /**
     * スタイルオブジェクトに不足している既定値やDraw.io特有の設定を補う。
     * @param styleObj parseStyleStringで得たスタイル辞書。
     * @param cell 対象のMXGraphセル。
     */
    adjustDrawioCompatibleStyle(styleObj, cell) {
        // フォント設定の調整（Draw.ioデフォルト）
        if (!styleObj.fontFamily) {
            styleObj.fontFamily = 'Helvetica';
        }
        
        if (!styleObj.fontSize) {
            styleObj.fontSize = '12';
        }
        
        // フォント色の調整
        if (styleObj.shape === 'ellipse' || styleObj.shape === 'cylinder') {
            if (styleObj.fillColor === '#2196F3' && !styleObj.fontColor) {
                styleObj.fontColor = '#ffffff';
            }
        }
        
        if (!styleObj.fontColor) {
            styleObj.fontColor = '#000000';
        }
        
        // ストロークの調整（Draw.io互換）
        if (!styleObj.strokeWidth) {
            styleObj.strokeWidth = '1';
        }
        
        if (!styleObj.strokeColor && styleObj.shape !== 'ellipse') {
            styleObj.strokeColor = '#000000';
        }
        
        // シェイプ別の微調整
        if (styleObj.shape === 'ellipse') {
            // 楕円形の場合（開始・終了ノード）
            styleObj.aspect = 'fixed'; // アスペクト比固定
        }
        
        if (styleObj.shape === 'cylinder') {
            // シリンダー形状の場合（DB）
            if (!styleObj.size) {
                styleObj.size = '15'; // Draw.ioのデフォルト
            }
        }
        
        if (styleObj.shape === 'rhombus') {
            // ダイヤモンド形状の場合（判断）
            styleObj.perimeter = 'rhombusPerimeter';
        }
        
        // 角丸の調整（Draw.ioとの互換性）
        if (styleObj.shape === 'rectangle' && !styleObj.rounded) {
            // タスクボックスの場合は軽い角丸を適用
            if (styleObj.fillColor === '#f5faff' || styleObj.fillColor === '#ffffff') {
                styleObj.rounded = '1';
                styleObj.arcSize = '10';
            }
        }
        
        // テキスト配置の調整
        if (!styleObj.align) {
            styleObj.align = 'center';
        }
        if (!styleObj.verticalAlign) {
            styleObj.verticalAlign = 'middle';
        }
    }
    
    // スタイルオブジェクトを文字列に再構築
    /**
     * スタイル辞書を再びセミコロン区切り文字列へ変換する。
     * @param styleObj parseStyleStringで得たスタイル辞書。
     * @returns string 再構築したスタイル文字列。
     */
    rebuildStyleString(styleObj) {
        return Object.entries(styleObj)
            .filter(([key, value]) => key && value)
            .map(([key, value]) => `${key}=${value}`)
            .join(';');
    }
    
    // 新しい要素をグラフに追加
    /**
     * 受信したmxCellを解析し、まだ描画していない頂点やエッジをグラフへ追加する。
     * @param drawioCode 新規のdraw.io XML断片。
     */
    addNewElementsToGraph(drawioCode) {
        if (!this.currentGraph) return;
        
        try {
            // XMLエスケープ関数（同じロジック）
            const escapeXmlAttribute = (str) => {
                if (!str) return str;
                return str
                    .replace(/&(?!amp;|lt;|gt;|quot;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            };
            
            // drawioコードの属性値をエスケープ
            let escapedDrawioCode = drawioCode;
            escapedDrawioCode = escapedDrawioCode.replace(/(\w+)="([^"]*)"/g, (match, attrName, attrValue) => {
                if (attrValue.includes('&lt;') || attrValue.includes('&gt;') || 
                    attrValue.includes('&amp;') || attrValue.includes('&quot;')) {
                    return match;
                }
                if (attrValue.includes('<') || attrValue.includes('>') || 
                    attrValue.includes('&') || attrValue.includes('"')) {
                    const escaped = escapeXmlAttribute(attrValue);
                    return `${attrName}="${escaped}"`;
                }
                return match;
            });
            
            // 部分的なXMLをパース
            const parser = new DOMParser();
            const doc = parser.parseFromString(escapedDrawioCode, 'text/xml');
            
            // mxCellを検索
            const cells = doc.querySelectorAll('mxCell');
            const model = this.currentGraph.getModel();
            const parent = this.currentGraph.getDefaultParent();
            
            // モデルの更新を開始
            model.beginUpdate();
            
            try {
                // まず頂点を処理
                cells.forEach((cellElement) => {
                    const cellId = cellElement.getAttribute('id');
                    if (!cellId || this.parsedCells.has(cellId)) return;
                    
                    const vertex = cellElement.getAttribute('vertex') === '1';
                    if (!vertex) return;
                    
                    // 新しいセルの場合のみ追加
                    this.parsedCells.add(cellId);
                    
                    const value = cellElement.getAttribute('value') || '';
                    const style = cellElement.getAttribute('style') || '';
                    const geometry = cellElement.querySelector('mxGeometry');
                    
                    if (geometry) {
                        const x = parseFloat(geometry.getAttribute('x') || '0');
                        const y = parseFloat(geometry.getAttribute('y') || '0');
                        const width = parseFloat(geometry.getAttribute('width') || '100');
                        const height = parseFloat(geometry.getAttribute('height') || '40');
                        
                        try {
                            // 頂点を追加
                            const v = this.currentGraph.insertVertex(
                                parent, cellId, value, x, y, width, height, 
                                this.determineStyleFromDrawio(style)
                            );
                            // 頂点をマップに保存
                            this.vertexMap.set(cellId, v);
                            console.log('頂点追加:', cellId, value);
                        } catch (e) {
                            console.debug('頂点追加エラー:', e);
                        }
                    }
                });
                
                // 次にエッジを処理
                cells.forEach((cellElement) => {
                    const cellId = cellElement.getAttribute('id');
                    if (!cellId || this.parsedCells.has(cellId)) return;
                    
                    const edge = cellElement.getAttribute('edge') === '1';
                    if (!edge) return;
                    
                    // 新しいセルの場合のみ追加
                    this.parsedCells.add(cellId);
                    
                    const value = cellElement.getAttribute('value') || '';
                    const style = cellElement.getAttribute('style') || '';
                    const sourceId = cellElement.getAttribute('source');
                    const targetId = cellElement.getAttribute('target');
                    
                    // エッジの追加を試行
                    this.tryAddEdge(cellId, value, style, sourceId, targetId, cellElement);
                });
                
                // 保留中のエッジを再度試行
                this.processPendingEdges();
                
            } finally {
                // モデルの更新を終了
                model.endUpdate();
            }
            
            // グラフを更新
            this.currentGraph.refresh();
            
            // 初回表示完了時
            if (!this.svgDisplayed && this.parsedCells.size > 0) {
                requestAnimationFrame(() => {
                    this.elements.flowDiagram.classList.remove('svg-processing');
                    this.elements.flowDiagram.classList.add('svg-ready');
                    this.svgDisplayed = true;
                });
            }
            
        } catch (error) {
            console.debug('要素追加エラー:', error);
        }
    }
    
    // drawioスタイルからMXGraphスタイルを判定
    /**
     * Draw.ioの頂点スタイルをプリセット済みのMXGraphスタイル名へマッピングする。
     * @param drawioStyle mxCellのstyle属性。
     * @returns string MXGraph側のスタイル名。
     */
    determineStyleFromDrawio(drawioStyle) {
        // 開始・終了の判定を改善
        if (drawioStyle.includes('ellipse') || drawioStyle.includes('shape=ellipse')) {
            return 'startEnd';
        }
        if (drawioStyle.includes('rhombus') || drawioStyle.includes('shape=rhombus')) {
            return 'decision';
        }
        if (drawioStyle.includes('cylinder') || drawioStyle.includes('shape=cylinder3')) {
            return 'database';
        }
        if (drawioStyle.includes('document') || drawioStyle.includes('shape=document')) {
            return 'document';
        }
        if (drawioStyle.includes('rounded=1')) {
            return 'task';
        }
        return 'task'; // デフォルト
    }
    
    // エッジの追加を試行
    /**
     * ソースとターゲットの頂点が揃っていれば直ちにエッジを追加する。
     * @param cellId エッジID。
     * @param value エッジに保持する値。
     * @param style mxCell由来のスタイル文字列。
     * @param sourceId ソース頂点ID。
     * @param targetId ターゲット頂点ID。
     * @param cellElement 元のmxCell要素。
     */
    tryAddEdge(cellId, value, style, sourceId, targetId, cellElement) {
        const source = this.vertexMap.get(sourceId);
        const target = this.vertexMap.get(targetId);
        
        if (source && target) {
            // source/targetが両方見つかった場合はエッジを追加
            try {
                const parent = this.currentGraph.getDefaultParent();
                const edgeStyle = this.determineEdgeStyle(style);
                
                // mxGeometryからポイント情報を取得
                const geometry = cellElement.querySelector('mxGeometry');
                const points = [];
                if (geometry) {
                    const pointElements = geometry.querySelectorAll('mxPoint');
                    pointElements.forEach(point => {
                        const x = parseFloat(point.getAttribute('x') || '0');
                        const y = parseFloat(point.getAttribute('y') || '0');
                        points.push(new mxPoint(x, y));
                    });
                }
                
                // エッジを追加
                const edge = this.currentGraph.insertEdge(
                    parent, cellId, value, source, target, edgeStyle
                );
                
                // ポイントがある場合は設定
                if (points.length > 0 && edge.geometry) {
                    edge.geometry.points = points;
                }
                
                console.log('エッジ追加:', cellId, sourceId, '->', targetId);
            } catch (e) {
                console.debug('エッジ追加エラー:', e);
            }
        } else {
            // source/targetが見つからない場合は保留
            this.pendingEdges.push({
                cellId, value, style, sourceId, targetId, cellElement
            });
        }
    }
    
    // 保留中のエッジを処理
    /**
     * 頂点不足で保留していたエッジの追加を再試行する。
     */
    processPendingEdges() {
        const remainingEdges = [];
        
        this.pendingEdges.forEach(edge => {
            const source = this.vertexMap.get(edge.sourceId);
            const target = this.vertexMap.get(edge.targetId);
            
            if (source && target) {
                // 今回は追加できる
                this.tryAddEdge(edge.cellId, edge.value, edge.style, 
                               edge.sourceId, edge.targetId, edge.cellElement);
            } else {
                // まだ追加できない
                remainingEdges.push(edge);
            }
        });
        
        this.pendingEdges = remainingEdges;
    }
    
    // エッジのスタイルを決定
    /**
     * Draw.ioのヒントをもとにMXGraphのエッジスタイル文字列を生成する。
     * @param drawioStyle mxCellのstyle属性。
     * @returns string MXGraph用のエッジスタイル。
     */
    determineEdgeStyle(drawioStyle) {
        // デフォルトのエッジスタイル
        let style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';
        
        // 色を判定
        if (drawioStyle.includes('#1E88E5')) {
            style += 'strokeColor=#1E88E5;';
        } else {
            style += 'strokeColor=#333333;';
        }
        
        style += 'strokeWidth=1.5;endArrow=classic;endFill=1;';
        
        return style;
    }
    
    // 部分的なdrawioコードをテキストとして表示（フォールバック）
    /**
     * リアルタイム描画できない際に部分的なdraw.io出力をテキスト表示するフォールバック。
     * @param drawioCode XML断片。
     */
    showPartialDrawioAsText(drawioCode) {
        // リアルタイム描画中はテキスト表示しない
        console.log('部分的なdrawioコード:', drawioCode.length, '文字');
        // リアルタイム描画を継続
    }
    
    // MXGraphエラー時の表示
    /**
     * MXGraphが例外を投げた際にダイアグラム領域へエラーメッセージを描画する。
     * @param drawioCode 直前に失敗したXML。
     * @param error MXGraphのエラー。
     */
    showMXGraphError(drawioCode, error) {
        console.error('MXGraphエラー表示:', error.message);
        // エラーでも空のグラフを表示
        this.elements.flowDiagram.innerHTML = '<div id="mxgraph-container" style="width: 100%; height: 400px; background: white; overflow: auto;"></div>';
        const container = document.getElementById('mxgraph-container');
        if (container && typeof mxGraph !== 'undefined') {
            try {
                const graph = new mxGraph(container);
                graph.setEnabled(false);
                this.setupGraphStyles(graph);
                
                // エラーメッセージを表示
                const parent = graph.getDefaultParent();
                graph.getModel().beginUpdate();
                try {
                    graph.insertVertex(parent, null, 'MXGraphエラー: ' + error.message, 20, 20, 300, 60, 
                        'fillColor=#ffcccc;strokeColor=#cc0000;fontColor=#cc0000');
                } finally {
                    graph.getModel().endUpdate();
                }
            } catch (e) {
                console.error('エラー表示も失敗:', e);
            }
        }
    }
    
    // MXGraphライブラリの再読み込み
    /**
     * MXGraphスクリプトを動的に読み込み、欠如していた場合は再描画を試みる。
     * @param drawioCode 再描画したいXML。
     */
    loadMXGraphAndRetry(drawioCode) {
        console.log('MXGraphライブラリの再読み込みを試行');
        // スクリプトタグを動的に追加
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://jgraph.github.io/mxgraph/javascript/mxClient.js';
        script.onload = () => {
            console.log('MXGraphライブラリ再読み込み完了');
            this.updateFlowDiagram(drawioCode);
        };
        script.onerror = () => {
            console.error('MXGraphライブラリの読み込みに失敗');
            this.showDrawioAsText(drawioCode);
        };
        document.head.appendChild(script);
    }

    // 従来のSVG抽出（バッチモード用）
    /**
     * バッチレスポンスからdraw.io XMLを抽出し、コード表示と図面更新をトリガーする。
     * @param content アシスタント応答テキスト。
     */
    extractAndUpdateSVG(content) {
        console.log('drawio抽出開始, コンテンツ長:', content ? content.length : 0);
        const svgMatch = content.match(/<\?xml[\s\S]*?<\/mxfile>|<mxfile[\s\S]*?<\/mxfile>/);
        if (svgMatch) {
            const svgCode = svgMatch[0];
            console.log('drawio抽出成功, drawio長:', svgCode.length);
            
            // バッチモードでもaccumulatedSvgCodeに保存（コピー機能のため）
            this.accumulatedSvgCode = svgCode;
            console.log('accumulatedSvgCodeに保存しました');
            
            this.displaySVGCode(svgCode);
            this.forceScroll(this.elements.svgCode);
            this.updateStatus('code', 'drawio抽出済み');
            
            // フロー図の更新
            console.log('===== フロー図更新を呼び出し =====');
            console.log('SVGコードの最初の500文字:', svgCode.substring(0, 500));
            this.updateFlowDiagram(svgCode);
        } else {
            console.warn('drawioコードが見つかりませんでした');
            console.log('レスポンス内容の最初の500文字:', content.substring(0, 500));
            console.log('レスポンス内容の最後の500文字:', content.substring(content.length - 500));
            
            // 別のパターンでも探す
            const alternativeMatch = content.match(/<mxfile[\s\S]*?<\/mxfile>/);
            if (alternativeMatch) {
                console.log('代替パターンでdrawioコードを発見！');
                const svgCode = alternativeMatch[0];
                this.accumulatedSvgCode = svgCode;
                this.displaySVGCode(svgCode);
                this.updateFlowDiagram(svgCode);
                return;
            }
            
            this.updateStatus('code', 'drawioなし');
            this.updateStatus('diagram', 'drawioなし');
            
            // エラー表示
            this.showError('drawioコードが生成されませんでした。プロンプトを確認してください。');
        }
    }

    // MXGraphの基本的な動作テスト
    /**
     * 簡易グラフを描画して現在の環境でMXGraphが動作するか検証する。
     * @returns boolean 描画に成功した場合はtrue。
     */
    testBasicMXGraph() {
        console.log('=== MXGraph基本テスト開始 ===');
        
        try {
            // MXGraphライブラリの存在確認
            console.log('mxGraph定義:', typeof mxGraph !== 'undefined');
            console.log('mxUtils定義:', typeof mxUtils !== 'undefined');
            console.log('mxConstants定義:', typeof mxConstants !== 'undefined');
            console.log('mxCellRenderer定義:', typeof mxCellRenderer !== 'undefined');
            
            if (typeof mxGraph === 'undefined') {
                console.error('MXGraphライブラリが読み込まれていません');
                return false;
            }
            
            // コンテナを作成
            this.elements.flowDiagram.innerHTML = '<div id="test-container" style="width: 100%; height: 500px; background: #f0f0f0;"></div>';
            const container = document.getElementById('test-container');
            
            if (!container) {
                console.error('テストコンテナの作成に失敗');
                return false;
            }
            
            // MXGraphを初期化
            const graph = new mxGraph(container);
            graph.setEnabled(false);
            
            const parent = graph.getDefaultParent();
            graph.getModel().beginUpdate();
            
            try {
                // 簡単な要素を追加
                const v1 = graph.insertVertex(parent, null, 'テスト開始', 20, 20, 80, 30, 
                    'fillColor=#2196F3;strokeColor=#0D47A1;fontColor=#ffffff;shape=ellipse');
                const v2 = graph.insertVertex(parent, null, 'タスク1', 150, 20, 100, 40,
                    'fillColor=#f5faff;strokeColor=#2196F3;fontColor=#000000');
                const v3 = graph.insertVertex(parent, null, 'DB', 300, 20, 80, 60,
                    'shape=cylinder;fillColor=#2196F3;strokeColor=#0D47A1;fontColor=#ffffff');
                
                graph.insertEdge(parent, null, '', v1, v2);
                graph.insertEdge(parent, null, '', v2, v3);
                
                console.log('テスト要素の追加成功');
            } finally {
                graph.getModel().endUpdate();
            }
            
            // コンテナの内容を確認
            const svg = container.querySelector('svg');
            if (svg) {
                console.log('SVG要素が作成されました');
                console.log('SVGサイズ:', svg.getAttribute('width'), 'x', svg.getAttribute('height'));
            } else {
                console.error('SVG要素が作成されていません');
            }
            
            console.log('=== MXGraph基本テスト完了 ===');
            return true;
            
        } catch (error) {
            console.error('MXGraph基本テストエラー:', error);
            console.error('エラースタック:', error.stack);
            return false;
        }
    }
    /**
     * ログを出力しつつ、draw.io XMLの描画処理を_performActualDrawingへ委譲する。
     * @param drawioCode 完全なdraw.io XML。
     */
    updateFlowDiagram(drawioCode) {
        console.log('=== updateFlowDiagram開始 ===');
        console.log('drawioコード長:', drawioCode ? drawioCode.length : 0);
        console.log('最初の200文字:', drawioCode ? drawioCode.substring(0, 200) : 'null');
        console.log('mxGraph利用可能:', typeof mxGraph !== 'undefined');
        console.log('flowDiagram要素:', this.elements.flowDiagram);
        
        // デバッグ: フロー図エリアの現在の内容を確認
        console.log('フロー図エリアの子要素数:', this.elements.flowDiagram.children.length);
        console.log('フロー図エリアのinnerHTML長:', this.elements.flowDiagram.innerHTML.length);
        
        // 以前のスキップ処理をコメントアウト（デバッグのため）
        /*
        const existingGraph = document.getElementById('mxgraph-container');
        if (existingGraph && existingGraph.children.length > 0) {
            console.log('フロー図が既に表示されているため、更新をスキップします');
            this.updateStatus('diagram', '表示済み');
            return;
        }
        */
        
        // 直接描画を実行
        console.log('drawio描画を開始...');
        this._performActualDrawing(drawioCode);
    }
    /**
     * 受け取ったdraw.io XMLをMXGraphでフルレンダリングする。
     * @param drawioCode 完全なdraw.io XML。
     */
    _performActualDrawing(drawioCode) {
        console.log('=== 実際のdrawio描画開始 ===');
        
        try {
            // XMLエスケープ関数
            const escapeXmlAttribute = (str) => {
                if (!str) return str;
                // 属性値内の特殊文字をエスケープ
                return str
                    .replace(/&(?!amp;|lt;|gt;|quot;|#x[0-9a-fA-F]+;|#[0-9]+;)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
            };
            
            // drawioコードの属性値をエスケープ
            // 属性値内の < > & " ' をエスケープする
            let escapedDrawioCode = drawioCode;
            
            // 属性値内の未エスケープ文字を検出してエスケープ
            escapedDrawioCode = escapedDrawioCode.replace(/(\w+)="([^"]*)"/g, (match, attrName, attrValue) => {
                // 既にエスケープされているものは除外
                if (attrValue.includes('&lt;') || attrValue.includes('&gt;') || 
                    attrValue.includes('&amp;') || attrValue.includes('&quot;')) {
                    return match;
                }
                // 未エスケープの < > & を含む場合はエスケープ
                if (attrValue.includes('<') || attrValue.includes('>') || 
                    attrValue.includes('&') || attrValue.includes('"')) {
                    const escaped = escapeXmlAttribute(attrValue);
                    return `${attrName}="${escaped}"`;
                }
                return match;
            });
            
            // drawioコードの妥当性確認
            const parser = new DOMParser();
            const doc = parser.parseFromString(escapedDrawioCode, 'text/xml');
            const parseError = doc.querySelector('parsererror');
            
            if (parseError) {
                console.error('XMLパースエラー:', parseError.textContent);
                return;
            }
            console.log('XML解析成功');

            // フロー図エリアを処理中状態にする
            this.elements.flowDiagram.classList.add('svg-processing');
            this.elements.flowDiagram.classList.remove('svg-ready');
            
            // MXGraphコンテナを作成
            console.log('MXGraphコンテナ作成中...');
            console.log('フロー図エリアのサイズ:', this.elements.flowDiagram.offsetWidth, 'x', this.elements.flowDiagram.offsetHeight);
            
            this.elements.flowDiagram.innerHTML = '<div id="mxgraph-container" style="width: 100%; height: 100%; min-height: 600px; background: white; overflow: auto; position: relative;"></div>';
            const container = document.getElementById('mxgraph-container');
            
            if (!container) {
                console.error('コンテナの作成に失敗しました');
                return;
            }
            console.log('コンテナ作成成功');
            
            // MXGraphを初期化してdrawioコードをレンダリング
            console.log('mxGraph利用可能（内部）:', typeof mxGraph !== 'undefined');
            if (typeof mxGraph !== 'undefined') {
                console.log('MXGraphの初期化を開始します');
                try {
                    // グラフオブジェクトを作成
                    const graph = new mxGraph(container);
                    graph.setEnabled(false); // 編集を無効化（表示のみ）
                    
                    // 背景色を設定
                    graph.setBackgroundImage(null);
                    const bg = graph.getView().getBackgroundPane();
                    if (bg) {
                        bg.style.backgroundColor = '#ffffff';
                    }
                    
                    // カスタムスタイルを設定
                    this.setupGraphStyles(graph);
                    
                    // デバッグ用テスト要素は削除（実際のフロー図のみ表示）
                    
                    // drawio XMLをデコード
                    console.log('drawio XMLデコード開始');
                    console.log('doc.documentElement:', doc.documentElement);
                    console.log('doc.documentElement.tagName:', doc.documentElement.tagName);
                    const codec = new mxCodec();
                    const diagramNode = doc.documentElement.querySelector('diagram');
                    console.log('diagramNode存在:', !!diagramNode);
                    console.log('doc全体（最初の500文字）:', new XMLSerializer().serializeToString(doc).substring(0, 500));
                    
                    if (diagramNode) {
                        // Base64デコード（drawioファイルは通常圧縮されている）
                        console.log('diagramコンテンツ長:', diagramNode.textContent ? diagramNode.textContent.length : 0);
                        
                        // diagramノード内に直接mxGraphModelがある場合はそれを使用
                        const innerGraphModel = diagramNode.querySelector('mxGraphModel');
                        if (innerGraphModel) {
                            console.log('diagram内に直接mxGraphModelを発見。圧縮されていないdrawioファイルです。');
                            console.log('innerGraphModel:', innerGraphModel);
                            console.log('innerGraphModel children数:', innerGraphModel.children.length);
                            try {
                                codec.decode(innerGraphModel, graph.getModel());
                                console.log('直接デコード完了');
                                const cellCount = Object.keys(graph.getModel().cells).length;
                                console.log('デコード後のセル数:', cellCount);
                            } catch (decodeError) {
                                console.error('デコードエラー:', decodeError);
                            }
                        } else {
                            // 圧縮されている場合の処理
                            try {
                                const compressed = diagramNode.textContent || diagramNode.innerHTML;
                                console.log('圧縮データをデコード中...');
                                
                                // graph.decompressの代替処理
                                let decompressed;
                                if (typeof graph.decompress === 'function') {
                                    decompressed = graph.decompress(compressed);
                                } else if (typeof mxUtils !== 'undefined' && typeof mxUtils.decompress === 'function') {
                                    decompressed = mxUtils.decompress(compressed);
                                } else {
                                    console.log('デコンプレス機能が利用できません。Base64デコードを試行...');
                                    try {
                                        decompressed = atob(compressed);
                                    } catch (e) {
                                        console.log('Base64デコードも失敗、生データを使用');
                                        decompressed = compressed;
                                    }
                                }
                            
                            console.log('デコード成功、XML解析中...');
                            // mxUtilsが利用できない場合のフォールバック
                            if (typeof mxUtils !== 'undefined' && typeof mxUtils.parseXml === 'function') {
                                const xmlDoc = mxUtils.parseXml(decompressed);
                                codec.decode(xmlDoc.documentElement, graph.getModel());
                            } else {
                                // DOMParserを使用
                                const parser = new DOMParser();
                                const xmlDoc = parser.parseFromString(decompressed, 'text/xml');
                                const mxGraphModel = xmlDoc.querySelector('mxGraphModel');
                                if (mxGraphModel) {
                                    codec.decode(mxGraphModel, graph.getModel());
                                }
                            }
                            console.log('グラフモデルへのデコード完了');
                            } catch (e) {
                                console.log('圧縮デコードエラー:', e.message);
                                // 圧縮されていない場合は直接パース
                                const mxGraphModel = doc.querySelector('mxGraphModel');
                                console.log('mxGraphModel存在:', !!mxGraphModel);
                                if (mxGraphModel) {
                                    console.log('直接デコード実行');
                                    codec.decode(mxGraphModel, graph.getModel());
                                    console.log('直接デコード完了');
                                } else {
                                    console.error('mxGraphModel要素が見つかりません');
                                }
                            }
                        }
                    } else {
                        // diagramNodeがない場合も直接mxGraphModelを探す
                        const mxGraphModel = doc.querySelector('mxGraphModel');
                        console.log('mxGraphModel存在（直接）:', !!mxGraphModel);
                        if (mxGraphModel) {
                            console.log('直接デコード実行（diagramなし）');
                            codec.decode(mxGraphModel, graph.getModel());
                            console.log('直接デコード完了（diagramなし）');
                        }
                    }
                    
                    // スタイルを修正（drawioのインラインスタイルが正しく適用されるように）
                    console.log('スタイル修正前のセル数:', Object.keys(graph.getModel().cells).length);
                    
                    // シェイプの統計を取る
                    const shapeStats = {};
                    const cells = graph.getModel().cells;
                    let swimlaneCount = 0;
                    let groupCount = 0;
                    
                    for (let id in cells) {
                        const cell = cells[id];
                        if (cell && cell.style) {
                            // shape=xxxの形式を検出
                            const shapeMatch = cell.style.match(/shape=(\w+)/);
                            if (shapeMatch) {
                                const shapeName = shapeMatch[1];
                                shapeStats[shapeName] = (shapeStats[shapeName] || 0) + 1;
                                if (shapeName === 'document') {
                                    console.log(`Document shape found: id=${id}, value=${cell.value}, geometry=`, cell.geometry);
                                }
                            }
                            
                            // swimlaneとgroupを特別に検出
                            if (cell.style.includes('swimlane')) {
                                swimlaneCount++;
                                console.log(`Swimlane found: id=${id}, value=${cell.value}, parent=${cell.parent ? cell.parent.id : 'none'}`);
                            }
                            if (cell.style.includes('group')) {
                                groupCount++;
                                console.log(`Group found: id=${id}, value=${cell.value}`);
                            }
                        }
                    }
                    console.log('検出されたシェイプ:', shapeStats);
                    console.log(`スイムレーン数: ${swimlaneCount}, グループ数: ${groupCount}`);
                    
                    try {
                        this.fixGraphStyles(graph);
                        console.log('スタイル修正完了');
                    } catch (styleError) {
                        console.error('スタイル修正エラー:', styleError);
                        console.log('スタイル修正をスキップして続行');
                    }
                    
                    // グラフを上揃え（横は中央）で配置
                    console.log('グラフの位置調整中（上揃え）...');
                    
                    // スクロールバーのちらつきを防ぐため、調整中は非表示
                    container.style.visibility = 'hidden';
                    
                    // フロー図をコンテンツに合わせてフィット
                    try {
                        // まず全体を表示できるようにフィット
                        graph.fit();
                        console.log('graph.fit()実行完了');
                        
                        // コンテンツの境界を取得してコンテナサイズを調整
                        const bounds = graph.getGraphBounds();
                        if (bounds) {
                            const padding = 20; // 余白
                            const contentWidth = Math.min(bounds.width + (padding * 2), this.elements.flowDiagram.clientWidth - 10); // 親要素幅を超えない
                            const contentHeight = Math.max(bounds.height + (padding * 2), 400); // 最小高さ400px
                            
                            console.log(`コンテンツサイズ: ${contentWidth}x${contentHeight}`);
                            
                            // コンテナのサイズを一度に設定（ちらつき防止）
                            requestAnimationFrame(() => {
                                container.style.width = `${contentWidth}px`;
                                container.style.height = `${contentHeight}px`;
                                container.style.overflow = 'hidden'; // スクロールバーを非表示
                                
                                // グラフを再調整
                                graph.sizeDidChange();
                                this.alignGraphToTop(graph);
                                
                                // 調整完了後に表示
                                container.style.visibility = 'visible';
                            });
                        } else {
                            container.style.visibility = 'visible';
                        }
                    } catch (e) {
                        console.log('フィットエラー:', e.message);
                        // フォールバック：標準サイズで上揃え配置
                        this.alignGraphToTop(graph);
                        container.style.visibility = 'visible';
                        console.log('フォールバック上揃え配置完了');
                    }
                    
                    // セルの数を確認（cellsは既に宣言されているので再利用）
                    let vertexCount = 0;
                    let edgeCount = 0;
                    const bounds = [];
                    
                    for (let id in cells) {
                        const cell = cells[id];
                        if (cell && cell.vertex) {
                            vertexCount++;
                            const geo = cell.geometry;
                            if (geo) {
                                bounds.push({
                                    id: cell.id,
                                    value: cell.value,
                                    x: geo.x,
                                    y: geo.y,
                                    width: geo.width,
                                    height: geo.height
                                });
                            }
                        }
                        if (cell && cell.edge) edgeCount++;
                    }
                    console.log(`グラフ内容: 頂点数=${vertexCount}, エッジ数=${edgeCount}`);
                    console.log('最初の5つの要素の位置:', bounds.slice(0, 5));
                    
                    // セルが少ない場合は警告
                    if (vertexCount === 0 && edgeCount === 0) {
                        console.error('警告: グラフに要素が1つもありません！');
                        // テスト要素を追加
                        const parent = graph.getDefaultParent();
                        graph.getModel().beginUpdate();
                        try {
                            graph.insertVertex(parent, null, 'デコードエラー: フロー図が表示されません', 20, 20, 300, 60,
                                'fillColor=#ffcccc;strokeColor=#cc0000;fontColor=#cc0000');
                        } finally {
                            graph.getModel().endUpdate();
                        }
                    }
                    
                    // コンテナのサイズを確認
                    // container変数は既に定義されているので再定義しない
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        console.log(`コンテナサイズ: width=${rect.width}, height=${rect.height}`);
                        console.log(`コンテナ表示状態: display=${window.getComputedStyle(container).display}`);
                    }
                    
                    // グラフのビューポートを確認
                    const view = graph.getView();
                    const scale = view.getScale();
                    const translate = view.getTranslate();
                    console.log(`グラフビュー: scale=${scale}, translate=(${translate.x}, ${translate.y})`);
                    
                    // 強制的に再描画を行う
                    console.log('強制再描画を実行中...');
                    graph.refresh();
                    graph.sizeDidChange();
                    
                    // グラフのSVG要素を直接確認
                    const svg = container.querySelector('svg');
                    if (svg) {
                        console.log('SVG要素が見つかりました');
                        console.log(`SVGサイズ: width=${svg.getAttribute('width')}, height=${svg.getAttribute('height')}`);
                        const gElements = svg.querySelectorAll('g');
                        console.log(`g要素の数: ${gElements.length}`);
                        
                        // SVGが隠れている可能性があるので、強制的に表示
                        svg.style.display = 'block';
                        svg.style.visibility = 'visible';
                        svg.style.opacity = '1';
                        svg.style.position = 'relative';
                        svg.style.zIndex = '1';
                        
                        // コンテナも確実に表示
                        container.style.display = 'block';
                        container.style.visibility = 'visible';
                        container.style.opacity = '1';
                        
                        // SVG内のすべてのパスとテキストを表示
                        const paths = svg.querySelectorAll('path, text, rect, ellipse, polygon');
                        console.log(`SVG内の描画要素数: ${paths.length}`);
                        paths.forEach((el, idx) => {
                            if (idx < 5) {
                                console.log(`要素${idx}: ${el.tagName}, style: ${el.getAttribute('style')}`);
                            }
                        });
                        
                        // デバッグテキストは削除（実際のフロー図を表示するため）
                    } else {
                        console.error('SVG要素が見つかりません');
                        
                        // SVGが作成されていない場合、コンテナの子要素を確認
                        console.log('コンテナの子要素数:', container.children.length);
                        for (let i = 0; i < container.children.length; i++) {
                            console.log(`子要素${i}: ${container.children[i].tagName}, class: ${container.children[i].className}`);
                        }
                    }
                    
                    // 表示完了
                    requestAnimationFrame(() => {
                        this.elements.flowDiagram.classList.remove('svg-processing');
                        this.elements.flowDiagram.classList.add('svg-ready');
                        console.log('表示状態更新完了');
                        
                        // フロー図エリア自体の表示も確認
                        const flowDiagramStyle = window.getComputedStyle(this.elements.flowDiagram);
                        console.log('フロー図エリアの表示状態:');
                        console.log('  display:', flowDiagramStyle.display);
                        console.log('  visibility:', flowDiagramStyle.visibility);
                        console.log('  opacity:', flowDiagramStyle.opacity);
                        console.log('  height:', flowDiagramStyle.height);
                    });
                    
                    this.updateStatus('diagram', '描画完了');
                    console.log('=== MXGraphレンダリング完了 ===');
                    
                } catch (mxError) {
                    console.error('MXGraphレンダリングエラー:', mxError);
                    console.error('エラースタック:', mxError.stack);
                    // エラーでも描画を試行
                    this.showMXGraphError(drawioCode, mxError);
                }
            } else {
                console.warn('MXGraphライブラリが読み込まれていません');
                // MXGraphライブラリの再読み込みを試行
                this.loadMXGraphAndRetry(drawioCode);
            }

        } catch (error) {
            console.error('フロー図更新エラー:', error);
            this.updateStatus('diagram', 'エラー');
            // エラー時も表示状態に戻す
            this.elements.flowDiagram.classList.remove('svg-processing');
            this.elements.flowDiagram.classList.add('svg-ready');
        }
    }
    
    // drawioコードをテキストとして表示（フォールバック）
    /**
     * 描画に失敗した場合でも、ダイアグラム領域に生のdraw.io XMLを表示する。
     * @param drawioCode 表示するXML。
     */
    showDrawioAsText(drawioCode) {
        this.elements.flowDiagram.innerHTML = `
            <div style="padding: 20px; font-family: monospace; font-size: 12px; overflow: auto; background: #f5f5f5; border-radius: 4px;">
                <p style="margin-bottom: 10px; color: #666;">drawioコードが生成されました。draw.ioで開くか、ダウンロードしてください。</p>
                <pre style="white-space: pre-wrap; word-wrap: break-word;">${this.escapeHtml(drawioCode)}</pre>
            </div>
        `;
        
        requestAnimationFrame(() => {
            this.elements.flowDiagram.classList.remove('svg-processing');
            this.elements.flowDiagram.classList.add('svg-ready');
        });
        
        this.updateStatus('diagram', 'テキスト表示');
    }

    // SVG自動フィット機能（フルサイズ表示）
    /**
     * 生成されたSVG要素のサイズ属性を調整し、コンテナにフィットさせる。
     * @param svgElement MXGraphが出力したSVG要素。
     */
    autoFitSVG(svgElement) {
        try {
            const container = this.elements.flowDiagram;
            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width - 20; // 少しのパディング
            const containerHeight = containerRect.height - 20;
            
            console.log(`drawioフルサイズ表示: container ${containerWidth}x${containerHeight}`);
            
            // viewBoxを先に設定（レンダリング前に）
            if (!svgElement.getAttribute('viewBox')) {
                const width = svgElement.getAttribute('width') || 800;
                const height = svgElement.getAttribute('height') || 600;
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            
            // preserveAspectRatioを設定
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            
            // widthとheight属性を削除（viewBoxで制御）
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            
            // CSSでサイズを設定（一度に設定）
            Object.assign(svgElement.style, {
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                margin: '0',
                objectFit: 'contain'
            });
            
        } catch (error) {
            console.error('drawioフィットエラー:', error);
            // エラーの場合はデフォルト表示
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
        }
    }

    // 強制スクロール機能
    /**
     * 最新コンテンツが見えるよう対象要素を強制的に最下部へスクロールさせる。
     * @param element スクロール対象。
     */
    forceScroll(element) {
        try {
            // 即座に最下部へスクロール
            element.scrollTop = element.scrollHeight;
            
            // 念のため再実行
            setTimeout(() => {
                element.scrollTop = element.scrollHeight;
            }, 0);
            
            // さらに念のため再実行
            setTimeout(() => {
                element.scrollTop = element.scrollHeight;
            }, 50);
            
        } catch (error) {
            console.warn('強制スクロールエラー:', error);
        }
    }

    // 従来の自動スクロール機能（互換性保持）
    /**
     * 互換性維持のためforceScrollを呼び出す簡易ラッパー。
     * @param element スクロール対象。
     */
    autoScroll(element) {
        this.forceScroll(element);
    }
    /**
     * ストリーミング終了後の後処理としてSVG抽出や成功通知を実施する。
     * @param content 最終的なアシスタント出力。
     */
    finalizeGeneration(content) {
        console.log('生成処理最終化');
        
        // 入力中インジケーターを確実に非表示
        this.hideTypingIndicator();
        
        // 最終的なSVG抽出
        this.extractAndUpdateSVG(content);
        
        // drawioが見つかった場合のみ成功メッセージを表示
        const svgMatch = content.match(/<\?xml[\s\S]*?<\/mxfile>|<mxfile[\s\S]*?<\/mxfile>/);
        if (svgMatch) {
            // 完了メッセージ
            this.showSuccess('フロー生成が完了しました！');
        }
        
        // 生成状態を終了
        this.stopGenerating();
    }
    /**
     * 生成開始時のフラグ設定、結果クリア、ボタン無効化などを行う。
     */
    startGenerating() {
        console.log('生成状態開始');
        this.isGenerating = true;
        this.svgStarted = false; // SVG状態をリセット
        this.accumulatedSvgCode = ''; // 蓄積drawioコードをリセット
        this.svgDisplayed = false; // drawio表示状態をリセット
        this.lastDisplayedSvgLength = 0; // 表示済みSVG長をリセット
        
        // フロー図エリアを完全にクリア（重要：下に追加されるのを防ぐ）
        this.elements.flowDiagram.innerHTML = '';
        
        this.elements.generateBtn.disabled = true;
        this.elements.btnText.style.display = 'none';
        this.elements.btnSpinner.style.display = 'block';
        
        // パネルの初期化
        this.clearResults();
        this.updateStatus('chat', '処理中');
    }
    /**
     * UIを待機状態へ戻し、残っているストリーム参照をクリアする。
     */
    stopGenerating() {
        console.log('生成状態終了');
        this.isGenerating = false;
        this.elements.btnText.style.display = 'block';
        this.elements.btnSpinner.style.display = 'none';
        this.updateStatus('chat', '完了');
        this.updateStatus('diagram', '描画完了');
        
        // ボタン状態を正しく更新
        this.updateButtonState();
        
        if (this.currentStream) {
            this.currentStream = null;
        }
    }

    // チャット機能の追加
    /**
     * ユーザーメッセージをチャット履歴に追加し、プロンプト履歴にもメタデータを保存する。
     * @param message エスケープ済みのメッセージ。
     */
    addUserMessage(message) {
        if (!this.elements.chatMessages) {
            console.error('chatMessages要素が存在しません');
            return;
        }
        
        const messageId = `msg-${this.messageIdCounter++}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message user';
        messageDiv.setAttribute('data-message-id', messageId);
        messageDiv.innerHTML = `
            <button class="prompt-info-btn" title="実際のプロンプトを表示">?</button>
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        // プロンプト表示ボタンのイベントリスナー
        const promptBtn = messageDiv.querySelector('.prompt-info-btn');
        promptBtn.addEventListener('click', () => {
            this.showPromptModal(messageId);
        });
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.forceScroll(this.elements.chatMessages);
        
        // このメッセージIDを現在の生成セッションに関連付け
        this.currentMessageId = messageId;
        
        // ユーザーの入力を一時的に保存（後で実際のプロンプトで更新される）
        this.promptHistory.set(messageId, {
            userInput: message,
            actualPrompt: null,
            timestamp: new Date()
        });
    }
    /**
     * アシスタントのメッセージブロックを追加または更新し、最新内容を反映する。
     * @param content アシスタントの生出力。
     */
    updateAssistantMessage(content) {
        if (!this.elements.chatMessages) {
            console.error('chatMessages要素が存在しません');
            return;
        }
        
        // 既存のアシスタントメッセージを更新または新規作成
        let assistantMessage = this.elements.chatMessages.querySelector('.chat-message.assistant:last-child');
        
        if (!assistantMessage) {
            assistantMessage = document.createElement('div');
            assistantMessage.className = 'chat-message assistant';
            this.elements.chatMessages.appendChild(assistantMessage);
        }

        // drawioコードを参照メッセージに置き換えた内容を取得
        const processedContent = this.replaceSvgWithReferenceMessage(content);
        
        assistantMessage.innerHTML = `
            <div class="message-content">${processedContent}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        this.forceScroll(this.elements.chatMessages);
    }

    // drawioコードを参照メッセージに置き換える関数（リアルタイム対応）
    /**
     * チャット内でdraw.ioマークアップを短い案内に置き換え、読みやすさを保つ。
     * @param content draw.io XMLを含む可能性のあるコンテンツ。
     * @returns string チャットに安全なHTML文字列。
     */
    replaceSvgWithReferenceMessage(content) {
        try {
            console.log('replaceSvgWithReferenceMessage 処理開始');
            console.log('入力コンテンツ長:', content.length);
            
            // エスケープ処理が必要かチェック
            const needsEscape = content.includes('<') || content.includes('>');
            
            if (!needsEscape) {
                // 既にエスケープ済みの場合（バッチモード）
                console.log('既にエスケープ済みのコンテンツ');
                return content;
            }
            
            // drawioコードの開始位置を検出
            const xmlStart = content.indexOf('<?xml');
            const mxfileStart = content.indexOf('<mxfile');
            
            // drawioコードが存在するかチェック
            if (xmlStart !== -1 || mxfileStart !== -1) {
                console.log('drawioコード検出（完全または不完全）');
                
                // drawioコードの開始位置を特定
                let svgStartIndex = -1;
                if (xmlStart !== -1 && mxfileStart !== -1) {
                    svgStartIndex = Math.min(xmlStart, mxfileStart);
                } else if (xmlStart !== -1) {
                    svgStartIndex = xmlStart;
                } else {
                    svgStartIndex = mxfileStart;
                }
                
                // drawioコードの前のテキストを抽出
                const beforeSvg = content.substring(0, svgStartIndex);
                console.log('drawio前のテキスト:', beforeSvg);
                
                // drawioコードの終了位置を検出
                const mxfileEnd = content.indexOf('</mxfile>');
                
                let afterSvg = '';
                let isComplete = false;
                
                if (mxfileEnd !== -1) {
                    // 完全なdrawioコードの場合
                    afterSvg = content.substring(mxfileEnd + 9); // '</mxfile>' の長さは9
                    isComplete = true;
                    console.log('完全なdrawioコード検出');
                } else {
                    // 不完全なdrawioコード（ストリーミング中）の場合
                    afterSvg = ''; // SVG後のテキストはまだない
                    console.log('不完全なdrawioコード検出（ストリーミング中）');
                }
                
                // 参照メッセージ（ストリーミング中かどうかで変える）
                const referenceMessage = isComplete ? 
                    `<div style="background: #f0f9ff; padding: 10px; border-radius: 6px; margin: 8px 0; border-left: 3px solid #1e40af;">
                        <strong>drawioコード</strong> が生成されました<br>
                        詳細は下部の「drawioコード」パネルおよび右側の「フロー図」パネルでご確認ください
                    </div>` :
                    `<div style="background: #fefce8; padding: 10px; border-radius: 6px; margin: 8px 0; border-left: 3px solid #f59e0b;">
                        <strong>drawioコード</strong> を生成中です...<br>
                        詳細は下部の「drawioコード」パネルでリアルタイムに確認できます
                    </div>`;
                
                // 前後のテキストをエスケープして、参照メッセージと結合
                const processedContent = referenceMessage
                // const processedContent = 
                //     this.escapeHtml(beforeSvg) + 
                //     referenceMessage + 
                //     this.escapeHtml(afterSvg);
                
                return processedContent;
            }
            // drawioコードが見つからない場合（通常のテキスト）
            else {
                console.log('drawioコードなし - 通常のテキスト処理');
                return this.escapeHtml(content);
            }
            
        } catch (error) {
            console.error('drawio置き換えエラー:', error);
            return this.escapeHtml(content);
        }
    }

    // drawioコード出力中かどうかを判定（削除予定 - 互換性のため残す）
    /**
     * アシスタント出力の大半がdraw.io XMLかどうかをヒューリスティックに判定する。
     * @param content アシスタント出力。
     * @returns boolean SVGコード主体ならtrue。
     */
    isSvgCodeContent(content) {
        const hasSvgTags = content.includes('<mxfile') || content.includes('<?xml');
        if (hasSvgTags) {
            const svgMatch = content.match(/<\?\s*xml[\s\S]*?<\/mxfile>|<mxfile[\s\S]*?<\/mxfile>/);
            if (svgMatch) {
                const svgLength = svgMatch[0].length;
                const totalLength = content.length;
                return (svgLength / totalLength) > 0.3; // 閾値を下げて、より早く検出
            }
        }
        return false;
    }
    /**
     * チャット最下部に入力中アニメーションを追加する。
     */
    showTypingIndicator() {
        if (!this.elements.chatMessages) {
            console.error('chatMessages要素が存在しません - タイピングインジケーター表示不可');
            return;
        }
        
        this.hideTypingIndicator(); // 既存の削除
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            入力中 
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.elements.chatMessages.appendChild(typingDiv);
        this.forceScroll(this.elements.chatMessages);
    }
    /**
     * 入力中インジケーター要素があれば削除する。
     */
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    /**
     * 危険な文字をエスケープし、簡易的なMarkdown風整形を行う。
     * @param text エスケープ対象テキスト。
     * @returns string エスケープ済みHTML。
     */
    escapeHtml(text) {
        // HTMLの危険な文字をエスケープ
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // 改行を<br>に変換
        escaped = escaped.replace(/\n/g, '<br>');
        
        // 簡単なマークダウン風の変換
        // リスト項目（- または * で始まる行）
        escaped = escaped.replace(/^([•\-\*])\s+(.+)$/gm, '<li>$2</li>');
        escaped = escaped.replace(/(<li>.*<\/li>(\s*<br>)?)+/g, function(match) {
            return '<ul style="margin: 8px 0; padding-left: 20px;">' + match.replace(/<br>/g, '') + '</ul>';
        });
        
        // 番号付きリスト（数字. で始まる行）
        escaped = escaped.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
        escaped = escaped.replace(/(<li>.*<\/li>(\s*<br>)?)+/g, function(match, offset, string) {
            // 前の文字が'>'でない場合のみ（既にulで囲まれていない場合）
            if (offset === 0 || string[offset - 1] !== '>') {
                return '<ol style="margin: 8px 0; padding-left: 20px;">' + match.replace(/<br>/g, '') + '</ol>';
            }
            return match;
        });
        
        // 太字（**text**）
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // コードブロック（`code`）
        escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
        
        return escaped;
    }
    /**
     * プロンプト・添付・ステータスをリセットし、UIを初期状態に戻す。
     */
    clearAll() {
        console.log('全クリア実行');
        
        this.elements.promptInput.value = '';
        this.clearResults();
        this.clearAttachments({ skipButtonUpdate: true });
        
        // ステータスリセット
        this.updateStatus('chat', '待機中');
        this.updateStatus('code', '待機中');
        this.updateStatus('diagram', '待機中');
        
        // プロンプト入力をクリアした後、手動でinputイベントを発火
        this.elements.promptInput.dispatchEvent(new Event('input'));
        this.updateButtonState();
    }

    // drawioコードをクリップボードにコピー
    /**
     * 現在のdraw.io XMLをクリップボードへコピーし、完了フィードバックを表示する。
     * @returns Promise<void> クリップボード書き込み後に解決。
     */
    async copySvgCode() {
        try {
            // drawioコード要素から実際のコードを取得
            const svgCodeElement = this.elements.svgCode;
            
            // プレースホルダーの場合は何もしない
            if (svgCodeElement.classList.contains('placeholder')) {
                console.log('drawioコードがまだ生成されていません');
                return;
            }
            
            // HTMLタグを除去してプレーンテキストのdrawioコードを取得
            const svgCode = this.extractPlainSvgCode();
            
            if (!svgCode) {
                console.log('drawioコードが見つかりません');
                return;
            }
            
            // クリップボードにコピー
            await navigator.clipboard.writeText(svgCode);
            console.log('drawioコードをクリップボードにコピーしました');
            
            // コピー成功フィードバック
            this.showCopyFeedback();
            
        } catch (error) {
            console.error('コピーエラー:', error);
            // フォールバック：古いブラウザ用
            this.fallbackCopy();
        }
    }

    // プレーンテキストのdrawioコードを抽出
    /**
     * 蓄積済みXMLまたは表示中の内容からdraw.ioコードを取り出して返す。
     * @returns string | null 利用可能なdraw.io XML。
     */
    extractPlainSvgCode() {
        console.log('extractPlainSvgCode開始');
        console.log('accumulatedSvgCode存在チェック:', !!this.accumulatedSvgCode);
        console.log('accumulatedSvgCode長さ:', this.accumulatedSvgCode ? this.accumulatedSvgCode.length : 0);
        
        // 現在保存されているdrawioコードがあればそれを使用（推奨）
        if (this.accumulatedSvgCode && (this.accumulatedSvgCode.includes('<?xml') || this.accumulatedSvgCode.includes('<mxfile'))) {
            console.log('accumulatedSvgCodeから取得 - 最初の100文字:', this.accumulatedSvgCode.substring(0, 100));
            return this.accumulatedSvgCode;
        }
        
        // なければ表示されているテキストから取得
        // innerHTMLから直接取得して、HTMLタグを除去
        const svgCodeElement = this.elements.svgCode;
        if (!svgCodeElement) {
            console.warn('svgCode要素が見つかりません');
            return '';
        }
        let htmlContent = svgCodeElement.innerHTML;
        console.log('innerHTML取得 - 最初の200文字:', htmlContent.substring(0, 200));
        
        // HTMLタグを除去（シンタックスハイライトのspanタグなど）
        htmlContent = htmlContent.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
        console.log('spanタグ除去後 - 最初の200文字:', htmlContent.substring(0, 200));
        
        // HTMLエンティティをデコード（&lt; → < など）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        console.log('HTMLデコード後 - 最初の200文字:', textContent.substring(0, 200));
        
        // drawioコードの開始と終了を探す
        const xmlStart = textContent.indexOf('<?xml');
        const mxfileStart = textContent.indexOf('<mxfile');
        const mxfileEnd = textContent.lastIndexOf('</mxfile>');
        
        console.log('検出位置 - xmlStart:', xmlStart, 'mxfileStart:', mxfileStart, 'mxfileEnd:', mxfileEnd);
        
        // <?xml から始まる場合
        if (xmlStart !== -1 && mxfileEnd !== -1) {
            const extracted = textContent.substring(xmlStart, mxfileEnd + 9);
            console.log('xmlStartから抽出 - 最初の100文字:', extracted.substring(0, 100));
            return extracted;
        }
        
        // <mxfile から始まる場合（XML宣言がない場合）
        if (mxfileStart !== -1 && mxfileEnd !== -1) {
            // XML宣言を追加
            const mxfileContent = textContent.substring(mxfileStart, mxfileEnd + 9);
            const withXmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>\n' + mxfileContent;
            console.log('mxfileStartから抽出（XML宣言追加） - 最初の100文字:', withXmlDeclaration.substring(0, 100));
            return withXmlDeclaration;
        }
        
        console.log('drawioコードを抽出できませんでした');
        return null;
    }

    // コピー成功フィードバック表示
    /**
     * コピー完了を伝えるため一時的にボタン状態を変更する。
     */
    showCopyFeedback() {
        const copyBtn = this.elements.copySvgBtn;
        const tooltip = copyBtn.querySelector('.copy-tooltip');
        const btnText = copyBtn.querySelector('span');
        const btnIcon = copyBtn.querySelector('i');
        
        // ボタンの状態を変更
        copyBtn.classList.add('copied');
        btnText.textContent = 'コピー済み';
        btnIcon.className = 'fas fa-check';
        
        // ツールチップ表示
        tooltip.classList.add('show');
        
        // 2秒後に元に戻す
        setTimeout(() => {
            copyBtn.classList.remove('copied');
            btnText.textContent = 'コピー';
            btnIcon.className = 'fas fa-copy';
            tooltip.classList.remove('show');
        }, 2000);
    }

    // フォールバックコピー（古いブラウザ用）
    /**
     * navigator.clipboardが使えない環境向けにテキストエリアを使ったコピーを実装する。
     */
    fallbackCopy() {
        const svgCode = this.extractPlainSvgCode();
        if (!svgCode) return;
        
        // 一時的なテキストエリアを作成
        const textarea = document.createElement('textarea');
        textarea.value = svgCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        // 選択してコピー
        textarea.select();
        try {
            document.execCommand('copy');
            console.log('フォールバック: drawioコードをコピーしました');
            this.showCopyFeedback();
        } catch (err) {
            console.error('フォールバックコピーも失敗:', err);
        }
        
        // テキストエリアを削除
        document.body.removeChild(textarea);
    }

    // drawioファイルをダウンロード
    /**
     * draw.io XMLをBlob化し、タイムスタンプ付きファイル名でダウンロードさせる。
     * @returns Promise<void> ダウンロード処理完了時に解決。
     */
    async downloadSvgFile() {
        try {
            // drawioコード要素から実際のコードを取得
            const svgCodeElement = this.elements.svgCode;
            
            // プレースホルダーの場合は何もしない
            if (svgCodeElement.classList.contains('placeholder')) {
                console.log('drawioコードがまだ生成されていません');
                return;
            }
            
            // プレーンテキストのdrawioコードを取得
            const svgCode = this.extractPlainSvgCode();
            
            if (!svgCode) {
                console.log('drawioコードが見つかりません');
                return;
            }
            
            // Blobを作成
            const blob = new Blob([svgCode], { type: 'application/xml;charset=utf-8' });
            
            // ダウンロードリンクを作成
            const downloadLink = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            // ファイル名を生成（日付とタイムスタンプを含む）
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `business-flow-${timestamp}.drawio`;
            
            downloadLink.href = url;
            downloadLink.download = filename;
            
            // クリックイベントを発火させてダウンロード
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // URLを解放
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log(`drawioファイルをダウンロードしました: ${filename}`);
            
            // ダウンロード成功フィードバック
            this.showDownloadFeedback();
            
        } catch (error) {
            console.error('ダウンロードエラー:', error);
            this.showError('ダウンロードに失敗しました');
        }
    }

    // ダウンロード成功フィードバック表示
    /**
     * ダウンロード開始後に軽量なツールチップを表示する。
     */
    showDownloadFeedback() {
        const tooltip = document.querySelector('.download-tooltip') as HTMLElement | null;
        if (tooltip) {
            // ツールチップを表示
            tooltip.style.opacity = '1';
            tooltip.style.transform = 'translateX(-50%) translateY(0)';

            // 2秒後に非表示
            setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateX(-50%) translateY(10px)';
            }, 2000);
        }
    }


    // プロンプト表示用に連続する空行を削減
    /**
     * モーダルに表示する前にプロンプトの過剰な空行を間引く。
     * @param prompt 正規化するプロンプト。
     * @returns string 整形後のプロンプト。
     */
    cleanupPromptDisplay(prompt) {
        // 連続する空行を単一の空行に置換
        let cleaned = prompt
            // 3行以上の連続する改行を2行に
            .replace(/\n{3,}/g, '\n\n')
            // 行頭の連続するハイフンやイコール（区切り線）を短縮
            .replace(/^[-=]{40,}$/gm, '--------')
            // 行頭の連続するアンダースコア（区切り線）を短縮
            .replace(/^[_━]{40,}$/gm, '--------')
            // # ---------------------------------------- のような区切りを簡略化
            .replace(/^#\s*[-=]+\s*$/gm, '#--------')
            // 空白だけの行を削除
            .replace(/^\s+$/gm, '');
        
        return cleaned;
    }

    // プロンプトモーダルを表示
    /**
     * 指定メッセージのプロンプト情報でモーダルを構築し表示する。
     * @param messageId promptHistoryのID。
     */
    showPromptModal(messageId) {
        const promptData = this.promptHistory.get(messageId);
        if (!promptData) {
            console.error('プロンプトデータが見つかりません:', messageId);
            return;
        }
        
        // モーダルコンテンツを構築
        let modalContent = `
            <div class="prompt-section">
                <div class="prompt-section-title">ユーザー入力</div>
                <div class="prompt-content">${this.escapeHtml(promptData.userInput)}</div>
            </div>
        `;
        
        if (promptData.actualPrompt) {
            // プロンプトから連続する空行を削減
            const cleanedPrompt = this.cleanupPromptDisplay(promptData.actualPrompt);
            
            modalContent += `
                <div class="prompt-section">
                    <div class="prompt-section-title">実際に送信されたプロンプト</div>
                    <div class="prompt-content">${this.escapeHtml(cleanedPrompt)}</div>
                    <button class="prompt-copy-btn" onclick="window.biTflowDemo.copyPrompt('${messageId}')">
                        <i class="fas fa-copy"></i>
                        <span>プロンプトをコピー</span>
                    </button>
                </div>
            `;
        } else {
            modalContent += `
                <div class="prompt-section">
                    <div class="prompt-section-title">実際に送信されたプロンプト</div>
                    <div class="prompt-content" style="color: #9ca3af; font-style: italic;">
                        プロンプト情報はまだ取得されていません。
                        サーバーからの応答を待っています...
                    </div>
                </div>
            `;
        }
        
        modalContent += `
            <div class="prompt-section">
                <div class="prompt-section-title">送信時刻</div>
                <div class="prompt-content">${promptData.timestamp.toLocaleString()}</div>
            </div>
        `;
        
        this.elements.promptModalBody.innerHTML = modalContent;
        this.elements.promptModal.classList.add('show');
    }
    
    // プロンプトモーダルを閉じる
    /**
     * プロンプトモーダルを非表示にする。
     */
    closePromptModal() {
        this.elements.promptModal.classList.remove('show');
    }
    
    // プロンプトをクリップボードにコピー
    /**
     * 送信済みプロンプトをクリップボードへコピーし、モーダル内でフィードバックを表示する。
     * @param messageId promptHistoryのID。
     */
    async copyPrompt(messageId) {
        const promptData = this.promptHistory.get(messageId);
        if (!promptData || !promptData.actualPrompt) {
            console.error('コピーするプロンプトがありません');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(promptData.actualPrompt);
            
            // コピー成功フィードバック
            const copyBtn = this.elements.promptModalBody.querySelector('.prompt-copy-btn');
            if (copyBtn) {
                copyBtn.classList.add('copied');
                const span = copyBtn.querySelector('span');
                const originalText = span.textContent;
                span.textContent = 'コピーしました！';
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    span.textContent = originalText;
                }, 2000);
            }
        } catch (error) {
            console.error('プロンプトのコピーに失敗:', error);
        }
    }
    /**
     * チャット履歴を残したまま、図面エリアやSVGコード、タイマー類をリセットする。
     */
    clearResults() {
        // チャットメッセージは履歴を保持（システムメッセージのみ保持から全履歴保持に変更）
        // ユーザーとアシスタントのメッセージは保持し、新しい会話を継続できるようにする
        
        // drawioコードをクリア
        this.accumulatedSvgCode = '';
        this.elements.svgCode.innerHTML = '生成されたdrawioコードがここに段階的に表示されます...';
        this.elements.svgCode.classList.add('placeholder');
        
        // フロー図をクリア（表示状態もリセット）
        this.elements.flowDiagram.classList.remove('svg-processing', 'svg-ready');
        this.elements.flowDiagram.innerHTML = '<div class="placeholder">生成された業務フロー図がここに表示されます...</div>';
        
        // タイマーとフラグをリセット
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        this.svgDisplayed = false;
        this.lastDisplayedSvgLength = 0;
    }
    /**
     * チャットパネルにスタイル済みのエラーメッセージを追加し、ログにも記録する。
     * @param message 表示するエラー内容。
     */
    showError(message) {
        if (!this.elements.chatMessages) {
            console.error('chatMessages要素が存在しません - エラーメッセージ:', message);
            return;
        }
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'chat-message system';
        errorMessage.innerHTML = `
            <div class="message-content">エラー: ${this.escapeHtml(message)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        this.elements.chatMessages.appendChild(errorMessage);
        this.forceScroll(this.elements.chatMessages);
        
        console.error('エラー表示:', message);
    }
    /**
     * フロー生成完了を知らせるトースト通知を表示する。
     * @param message 成功メッセージ。
     */
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'completion-notification';
        successDiv.innerHTML = `
            <div class="completion-content">
                <div class="completion-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="completion-text">
                    <div class="completion-title">${message}</div>
                    <div class="completion-subtitle">業務フロー図の生成が正常に完了しました</div>
                </div>
            </div>
        `;
        
        // スタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .completion-notification {
                position: fixed;
                bottom: 24px;
                right: 24px;
                transform: translateX(400px);
                background: #1a1a1a;
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                max-width: 320px;
            }
            
            .completion-notification.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .completion-notification.hide {
                opacity: 0;
                transform: translateX(400px);
            }
            
            .completion-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .completion-icon {
                width: 32px;
                height: 32px;
                background: #10b981;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                flex-shrink: 0;
            }
            
            .completion-icon svg {
                width: 18px;
                height: 18px;
                stroke-width: 3;
            }
            
            .completion-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .completion-title {
                font-size: 15px;
                font-weight: 500;
                color: #ffffff;
                margin-bottom: 2px;
            }
            
            .completion-subtitle {
                font-size: 13px;
                color: #9ca3af;
                line-height: 1.4;
            }
            
            @media (max-width: 640px) {
                .completion-notification {
                    bottom: 16px;
                    right: 16px;
                    left: 16px;
                    max-width: none;
                }
            }
        `;
        
        if (!document.querySelector('#completion-notification-styles')) {
            style.id = 'completion-notification-styles';
            document.head.appendChild(style);
        }
        
        // 表示
        document.body.appendChild(successDiv);
        
        // アニメーション
        requestAnimationFrame(() => {
            successDiv.classList.add('show');
        });
        
        // 自動的に消す
        setTimeout(() => {
            successDiv.classList.remove('show');
            successDiv.classList.add('hide');
            
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 300);
        }, 3500);
        
        console.log('成功表示:', message);
    }
}

declare global {
    interface Window {
        biTflowDemo?: BiTFlowProxyDemo | null;
    }
}
/**
 * windowレベルのエラーハンドラを登録し、未処理の問題を一度だけコンソールに出す。
 * @returns void
 */
function registerGlobalErrorHandlers() {
    if (typeof window === 'undefined' || globalErrorHandlersRegistered) {
        return;
    }
    window.addEventListener('error', (event) => {
        console.error('グローバルエラー:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('未処理Promise拒否:', event.reason);
    });
    globalErrorHandlersRegistered = true;
}
/**
 * MXGraphのグローバルが利用可能になるまでポーリングし、一定時間で打ち切る。
 * @returns Promise<void> MXGraphが準備できるかタイムアウトで解決。
 */
function waitForMxGraphReady() {
    if (typeof window === 'undefined') {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        const start = Date.now();

        const check = () => {
            if (typeof mxGraph !== 'undefined') {
                resolve();
                return;
            }

            if (Date.now() - start >= MX_GRAPH_MAX_WAIT_MS) {
                console.warn('MXGraphライブラリの読み込みに時間がかかっています。継続して初期化を試みます。');
                resolve();
                return;
            }

            setTimeout(check, MX_GRAPH_POLL_INTERVAL_MS);
        };

        check();
    });
}
/**
 * MXGraphの準備完了後にブラウザwindowへBiTFlowProxyDemoインスタンスを作成する。
 * @returns Promise<BiTFlowProxyDemo | null> 生成したインスタンスかnull。
 */
export async function initializeBiTFlowProxyDemo() {
    if (typeof window === 'undefined') {
        return null;
    }

    registerGlobalErrorHandlers();
    await waitForMxGraphReady();

    try {
        const instance = new BiTFlowProxyDemo();
        window.biTflowDemo = instance;
        if (typeof mxClient !== 'undefined' && mxClient?.VERSION) {
            console.log('MXGraphバージョン:', mxClient.VERSION);
        }
        return instance;
    } catch (error) {
        console.error('業務フロー図AI 初期化失敗:', error);
        return null;
    }
}
/**
 * 実行中の生成処理を停止し、window上のデモ参照をクリアする。
 */
export function disposeBiTFlowProxyDemo() {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.biTflowDemo && typeof window.biTflowDemo.stopGenerating === 'function') {
        window.biTflowDemo.stopGenerating();
    }
    window.biTflowDemo = null;
}
