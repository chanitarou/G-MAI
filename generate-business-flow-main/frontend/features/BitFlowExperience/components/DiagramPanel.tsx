export function DiagramPanel() {
    return (
        <div className="panel" id="diagram-panel">
            <div className="panel-header">
                <span>
                    <i className="fas fa-project-diagram" /> フロー図
                </span>
                <span className="panel-status" id="diagram-status">
                    待機中
                </span>
            </div>
            <div className="panel-content">
                <button className="download-diagram-btn" id="download-svg-btn" title="drawioファイルをダウンロード">
                    <i className="fas fa-download" />
                    <span>ダウンロード</span>
                    <div className="download-tooltip">ダウンロードしました！</div>
                </button>
                <div id="flow-diagram" className="placeholder">
                    生成された業務フロー図がここに表示されます...
                </div>
            </div>
        </div>
    );
}
