export function DrawioCodeSection() {
    return (
        <div className="code-section" id="code-section">
            <div className="panel" id="code-panel">
                <div className="panel-header">
                    <span>
                        <i className="fas fa-code" /> drawioコード
                    </span>
                    <span className="panel-status" id="code-status">
                        待機中
                    </span>
                </div>
                <div className="panel-content">
                    <button className="copy-code-btn" id="copy-svg-btn" title="drawioコードをコピー">
                        <i className="fas fa-copy" />
                        <span>コピー</span>
                        <div className="copy-tooltip">drawioコードをコピーしました！</div>
                    </button>
                    <div id="svg-code" className="placeholder">
                        生成されたdrawioコードがここに段階的に表示されます...
                    </div>
                </div>
            </div>
        </div>
    );
}
