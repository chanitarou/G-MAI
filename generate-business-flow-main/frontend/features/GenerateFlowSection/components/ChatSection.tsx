import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { AgentState, AttachmentItem } from '../GenerateFlow';
import { readAttachmentContent } from '../utils/attachmentReaders';
import { ChatMessage, ChatMessages } from './ChatMessages';

type ChatSectionProps = {
    agentState: AgentState;
    setAgentState: Dispatch<SetStateAction<AgentState>>;
    prompt: string;
    onPromptChange: (value: string) => void;
    onClear: () => void;
    onGenerate: (prompt: string, attachments: AttachmentItem[]) => void;
    attachments: AttachmentItem[];
    onAttachmentsChange: Dispatch<SetStateAction<AttachmentItem[]>>;
};

// チャットUIを描画し、AIエージェントの状態をヘッダーに表示する。
export function ChatSection({
    agentState,
    setAgentState,
    prompt,
    onPromptChange,
    onClear,
    onGenerate,
    attachments,
    onAttachmentsChange
}: ChatSectionProps) {
    // ハイドレーションエラー回避のため、初期メッセージのsentAtは空文字で初期化し、useEffectで設定する。
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'system-initial',
            role: 'system',
            content: '生成したい業務フローに関連するファイルを添付し、指示を入力してください。',
            sentAt: ''
        }
    ]);
    const [isClient, setIsClient] = useState(false);

    // クライアント側でのみ初期メッセージのsentAtを設定する。
    useEffect(() => {
        if (!isClient) {
            setIsClient(true);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === 'system-initial' && !msg.sentAt
                        ? { ...msg, sentAt: new Date().toISOString() }
                        : msg
                )
            );
        }
    }, [isClient]);
    const [showHint, setShowHint] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const agentStateText =
        agentState === 'generating' ? '生成中' : agentState === 'generated' ? '生成完了' : '入力待ち';

    const handleSend = () => {
        const trimmed = prompt.trim();
        // テキストがなくても添付ファイルがあれば送信可能
        if (!trimmed && attachments.length === 0) return;

        // 添付ファイル名のリストを作成
        const attachmentNames = attachments.map((a) => a.file.name).join(', ');
        const displayContent = trimmed
            ? (attachments.length > 0 ? `${trimmed}\n\n添付: ${attachmentNames}` : trimmed)
            : `添付: ${attachmentNames}`;

        const message: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: displayContent,
            sentAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, message]);
        onGenerate(trimmed, attachments);
        onPromptChange('');
    };

    // 添付ファイルを検証しつつステートに積み増す。
    const handleAttachFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const acceptedExtensions = ['pdf', 'txt', 'md', 'csv', 'docx', 'xls', 'xlsx'];
        const maxSize = 2 * 1024 * 1024; // 2MB
        const newItems: AttachmentItem[] = [];
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
            if (!acceptedExtensions.includes(ext)) continue;
            if (file.size > maxSize) continue;
            try {
                const { content, encoding } = await readAttachmentContent(file);
                newItems.push({
                    id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    file,
                    content,
                    encoding
                });
                console.log(content);
            } catch (error) {
                console.error('添付ファイルの読み込みに失敗しました', error);
            }
        }
        if (newItems.length > 0) {
            onAttachmentsChange((prev) => [...prev, ...newItems]);
        }
    };

    const handleRemoveAttachment = (id: string) => {
        onAttachmentsChange((prev) => prev.filter((item) => item.id !== id));
    };

    // 添付ファイルサイズを人間が読みやすい表記に変換する。
    const formatBytes = (size: number) => {
        if (size < 1024) return `${size}B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
        return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    };

    useEffect(() => {
        // inputWaitingの初期メッセージはuseStateで設定済みなので、ここでは追加しない
        if (agentState === 'inputWaiting') return;

        let systemContent: string | null = null;
        if (agentState === 'generated') {
            systemContent = '生成が完了しました。結果を確認してください。';
        } else if (agentState === 'generating') {
            systemContent = '生成中です。しばらくお待ちください。';
        }
        if (!systemContent) return;
        const systemMessage: ChatMessage = {
            id: `system-${Date.now()}`,
            role: 'system',
            content: systemContent,
            sentAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, systemMessage]);
    }, [agentState]);

    // ドラッグ＆ドロップのハンドラ
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleAttachFiles(files);
        }
    };

    return (
        <div className="chat-section" id="chat-section">
            <div className="panel" id="chat-panel">
                <div className="panel-header">
                    <span>
                        <i className="fas fa-comments" /> チャット
                    </span>
                    <span className="panel-status" id="chat-status">
                        {agentStateText}
                    </span>
                </div>
                <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <ChatMessages messages={messages} />

                    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                        <textarea
                            id="prompt-input"
                            placeholder={'業務フロー図を生成したい内容を入力してください。\n例: ECサイトの注文処理業務フローを描いて'}
                            value={prompt}
                            onChange={(event) => onPromptChange(event.target.value)}
                            style={{
                                flex: 1,
                                resize: 'none',
                                height: 60,
                                border: '2px solid rgba(209, 213, 219, 0.3)',
                                borderRadius: 12,
                                padding: 12,
                                fontSize: 14,
                                background: 'rgba(255, 255, 255, 0.9)',
                                fontFamily: 'inherit'
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button
                                className="btn btn-primary"
                                id="generate-btn"
                                style={{ height: 32, padding: '6px 16px' }}
                                onClick={handleSend}
                            >
                                <span id="btn-text">送信</span>
                                <div id="btn-spinner" className="loading-spinner" style={{ display: 'none' }} />
                            </button>
                            <button
                                className="btn btn-secondary"
                                id="clear-btn"
                                style={{ height: 26, padding: '4px 12px', fontSize: 12 }}
                                onClick={() => {
                                    setAgentState('inputWaiting');
                                    onClear();
                                }}
                            >
                                クリア
                            </button>
                        </div>
                    </div>

                    <div
                        className="attachment-area"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: isDragging ? '2px dashed #3b82f6' : undefined,
                            backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : undefined,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div className="attachment-controls">
                            <div className="attachment-label">
                                <i className="fas fa-paperclip" />
                                添付ファイル
                            </div>
                            <button
                                className="btn btn-ghost"
                                id="attach-btn"
                                type="button"
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <i className="fas fa-plus" />
                                ファイルを選択
                            </button>
                            <button
                                type="button"
                                className="attachment-hint-toggle"
                                aria-expanded={showHint}
                                onClick={() => setShowHint((prev) => !prev)}
                            >
                                <i className="fas fa-question-circle" aria-hidden />
                                <span className="sr-only">対応ファイル形式を表示</span>
                            </button>
                            {showHint ? (
                                <span className="attachment-hint">対応: .pdf /.txt / .md / .csv / .docx / .xls / .xlsx （最大2MB・複数可）</span>
                            ) : null}
                            <input
                                type="file"
                                id="file-input"
                                multiple
                                accept=".txt,.md,.csv,.pdf,.docx,.xls,.xlsx"
                                style={{ display: 'none' }}
                                onChange={(event) => handleAttachFiles(event.target.files)}
                            />
                        </div>
                        <div id="attachment-list" className={`attachment-list ${attachments.length === 0 ? 'empty' : ''}`}>
                            {attachments.length === 0 ? (
                                <span className="attachment-placeholder">現在、添付ファイルはありません</span>
                            ) : (
                                attachments.map((item) => (
                                    <div key={item.id} className="attachment-item">
                                        <i className="fas fa-file-alt" aria-hidden />
                                        <div className="attachment-name" title={item.file.name}>
                                            {item.file.name}
                                        </div>
                                        <span className="attachment-meta">{formatBytes(item.file.size)}</span>
                                        <button
                                            className="attachment-remove"
                                            type="button"
                                            aria-label={`${item.file.name} を削除`}
                                            onClick={() => handleRemoveAttachment(item.id)}
                                        >
                                            <i className="fas fa-times" aria-hidden />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
