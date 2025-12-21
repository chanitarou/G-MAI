import { useState } from 'react';

export function ChatSection() {
    const [showHint, setShowHint] = useState(false);

    return (
        <div className="chat-section" id="chat-section">
            <div className="panel" id="chat-panel">
                <div className="panel-header">
                    <span>
                        <i className="fas fa-comments" /> チャット
                    </span>
                    <span className="panel-status" id="chat-status">
                        待機中
                    </span>
                </div>
                <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div
                        id="chat-messages"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: 16,
                            border: '1px solid rgba(209, 213, 219, 0.3)',
                            borderRadius: 12,
                            marginBottom: 3,
                            background: 'rgba(249, 250, 251, 0.5)'
                        }}
                    />

                    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
                        <textarea
                            id="prompt-input"
                            placeholder={'業務フロー図を生成したい内容を入力してください。\n例: ECサイトの注文処理業務フローを描いて'}
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
                            <button className="btn btn-primary" id="generate-btn" style={{ height: 32, padding: '6px 16px' }}>
                                <span id="btn-text">送信</span>
                                <div id="btn-spinner" className="loading-spinner" style={{ display: 'none' }} />
                            </button>
                            <button className="btn btn-secondary" id="clear-btn" style={{ height: 26, padding: '4px 12px', fontSize: 12 }}>
                                クリア
                            </button>
                        </div>
                    </div>

                    <div className="attachment-area">
                        <div className="attachment-controls">
                            <div className="attachment-label">
                                <i className="fas fa-paperclip" />
                                添付ファイル
                            </div>
                            <button className="btn btn-ghost" id="attach-btn" type="button">
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
                            <input type="file" id="file-input" multiple accept=".txt,.md,.csv,.pdf,.docx,.xls,.xlsx" style={{ display: 'none' }} />
                        </div>
                        <div id="attachment-list" className="attachment-list empty">
                            <span className="attachment-placeholder">現在、添付ファイルはありません</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
