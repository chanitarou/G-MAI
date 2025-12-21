import { AgentState } from '../GenerateFlow';

type DrawioCodeSectionProps = {
    agentState: AgentState;
    drawioContent: string;
};

// drawioコード表示パネルと状態表示を行う。
export function DrawioCodeSection({ agentState, drawioContent }: DrawioCodeSectionProps) {
    const agentStateText =
        agentState === 'generating' ? '生成中' : agentState === 'generated' ? '生成完了' : '待機中';

    return (
        <div className="code-section" id="code-section">
            <div className="panel" id="code-panel">
                <div className="panel-header">
                    <span>
                        <i className="fas fa-code" /> drawioコード
                    </span>
                    <span className="panel-status" id="code-status">
                        {agentStateText}
                    </span>
                </div>
                <div className="panel-content">
                    <button className="copy-code-btn" id="copy-svg-btn" title="drawioコードをコピー">
                        <i className="fas fa-copy" />
                        <span>コピー</span>
                        <div className="copy-tooltip">drawioコードをコピーしました！</div>
                    </button>
                    <div id="svg-code" className="placeholder">
                        {drawioContent || '生成されたdrawioコードがここに段階的に表示されます...'}
                    </div>
                </div>
            </div>
        </div>
    );
}
