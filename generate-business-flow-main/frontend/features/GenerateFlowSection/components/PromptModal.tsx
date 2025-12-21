export function PromptModal() {
    return (
        <div id="prompt-modal" className="prompt-modal">
            <div className="prompt-modal-content">
                <div className="prompt-modal-header">
                    <h3 className="prompt-modal-title">実際のプロンプト詳細</h3>
                    <button className="prompt-modal-close" id="prompt-modal-close">
                        <i className="fas fa-times" />
                    </button>
                </div>
                <div className="prompt-modal-body" id="prompt-modal-body">
                    {/* 動的にコンテンツが挿入される */}
                </div>
            </div>
        </div>
    );
}
