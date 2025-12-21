import { useEffect, useRef, useState } from 'react';
import { AgentState } from '../GenerateFlow';

type DiagramPanelProps = {
    agentState: AgentState;
    drawioContent: string;
    canDownload: boolean;
    onDownload: () => void;
};

// drawio開始直後にmxfileタグが無い場合、既定のmxfileタグを差し込む。
function insertDefaultMxfileIfMissing(xml: string): string {
    // console.log("call 1")
    const headerMatch = xml.match(/^<\?xml[^>]*\?>\s*/);
    if (!headerMatch) return xml;
    // console.log("call 2")
    const header = headerMatch[0];
    const rest = xml.slice(header.length);
    if (rest.trimStart().startsWith('<mxfile')) {
        return xml;
    }
    // console.log("call 3")
    const defaultMxfile = '<mxfile host="app.diagrams.net" modified="2025-01-24T00:00:00.000Z" agent="Claude" version="24.7.8">';
    const cleanedRest = rest.replace(/^"[^"]*">\s*(?=<diagram)/, '');
    return `${header}${defaultMxfile}${cleanedRest}`;
}

// drawio文字列を安全に描画できるよう不足タグ補完と余分な末尾除去を行う。
function normalizeDrawioCode(raw: string): string {
    let displayCode = raw;
    const xmlHeaderIndex = displayCode.indexOf('<?xml');
    if (xmlHeaderIndex === -1) {
        displayCode = '<?xml version="1.0" encoding="UTF-8"?>\n' + displayCode;
    } else if (xmlHeaderIndex > 0) {
        displayCode = displayCode.slice(xmlHeaderIndex);
    }
    const lastMxCellIndex = displayCode.lastIndexOf('</mxCell>');
    if (lastMxCellIndex !== -1) {
        displayCode = displayCode.slice(0, lastMxCellIndex + '</mxCell>'.length);
    }
    ['</root>', '</mxGraphModel>', '</diagram>', '</mxfile>'].forEach((tag) => {
        if (!displayCode.includes(tag)) {
            displayCode += tag;
        }
    });
    // // console.log(displayCode)
    return displayCode;
}

// フロー図表示パネルと状態表示を行い、ダウンロード操作も提供する。
export function DiagramPanel({ agentState, drawioContent, canDownload, onDownload }: DiagramPanelProps) {
    const agentStateText =
        agentState === 'generating' ? '生成中' : agentState === 'generated' ? '生成完了' : '待機中';
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [drawioContentForRendering, setDrawioContentForRendering] = useState('');
    const [mxLibs, setMxLibs] = useState<{ mxGraph: any; mxCodec: any; mxUtils: any } | null>(null);
    const defaultMxfileInsertedRef = useRef(false);

    // <diagram> 出現後に一度だけ全体へmxfileタグを補完する。
    const ensureDefaultMxfileOnce = (xml: string) => {
        // console.log(defaultMxfileInsertedRef.current)
        if (defaultMxfileInsertedRef.current) return xml;
        // console.log(xml)
        if (!xml.includes('diagram')) return xml;
        const updated = insertDefaultMxfileIfMissing(xml);
        defaultMxfileInsertedRef.current = true;
        return updated;
    };

    // 描画用に受け取ったdrawioContentを局所状態に写す。
    useEffect(() => {
        // console.log("drawioContent updated")
        if (!drawioContent) {
            defaultMxfileInsertedRef.current = false;
            setDrawioContentForRendering('');
            return;
        }
        // console.log("ensureDefaultMxfileOnce called")
        const adjusted = ensureDefaultMxfileOnce(drawioContent);
        setDrawioContentForRendering(adjusted);
    }, [drawioContent]);

    // mxGraph関連のライブラリをstateに保持する。
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const w = window as any;
        if (w.mxGraph && w.mxCodec && w.mxUtils) {
            setMxLibs({ mxGraph: w.mxGraph, mxCodec: w.mxCodec, mxUtils: w.mxUtils });
        }
    }, []);

    // 最小限の_drawioレンダリング（BitFlowExperienceの_performActualDrawing簡略版）
    useEffect(() => {
        if (!drawioContentForRendering || drawioContentForRendering.length < 200 || !containerRef.current) {
            if (containerRef.current) {
                containerRef.current.innerText = '生成された業務フロー図がここに表示されます...';
            }
            return;
        }
        if (typeof window === 'undefined') return;
        if (!mxLibs) {
            containerRef.current.innerText = 'mxGraphが利用できません';
            return;
        }
        const { mxGraph, mxCodec, mxUtils } = mxLibs;

        // コンテナをリセットしてmxGraphの描画領域を作る
        containerRef.current.innerHTML = '<div style="width:100%;height:100%;min-height:800px;background:#fff;"></div>';
        const target = containerRef.current.firstElementChild as HTMLElement | null;
        if (!target) return;

        // XMLパース
        const parser = new DOMParser();
        const doc = parser.parseFromString(normalizeDrawioCode(drawioContentForRendering), 'text/xml');

        const graph = new mxGraph(target);
        graph.setEnabled(false);
        const codec = new mxCodec();

        const diagramNode = doc.documentElement.querySelector('diagram');
        const mxGraphModel = diagramNode?.querySelector('mxGraphModel') || doc.querySelector('mxGraphModel');

        if (mxGraphModel) {
            codec.decode(mxGraphModel, graph.getModel());
        } else if (diagramNode?.textContent) {
            try {
                const decompressed = mxUtils.decompress(diagramNode.textContent);
                const decompressedDoc = mxUtils.parseXml(decompressed);
                codec.decode(decompressedDoc.documentElement, graph.getModel());
            } catch {
                // 最小限の実装なので詳細なエラーハンドリングは後回し
            }
        }

        try {
            graph.fit();
        } catch {
            // 後回し
        }

        // SVGがコンテナ幅いっぱいに広がるようにスタイルを適用
        try {
            const svg = containerRef.current?.querySelector('svg') as SVGElement | null;
            if (svg) {
                svg.setAttribute('width', '100%');
                svg.style.width = '100%';
                svg.style.height = 'auto';
                svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
            }
        } catch {
            // 後回し
        }
    }, [drawioContentForRendering, mxLibs]);

    return (
        <div className="panel" id="diagram-panel">
            <div className="panel-header">
                <span>
                    <i className="fas fa-project-diagram" /> フロー図
                </span>
                <span className="panel-status" id="diagram-status">
                    {agentStateText}
                </span>
            </div>
            <div
                className="panel-content"
                style={{ display: 'flex', flexDirection: 'column', padding: 0, height: 'auto', minHeight: 0 }}
            >
                <button
                    className="download-diagram-btn"
                    id="download-svg-btn"
                    title="drawioファイルをダウンロード"
                    disabled={!canDownload}
                    onClick={onDownload}
                >
                    <i className="fas fa-download" />
                    <span>ダウンロード</span>
                    <div className="download-tooltip">ダウンロードしました！</div>
                </button>
                <div
                    id="flow-diagram"
                    ref={containerRef}
                    className="placeholder"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        width: '100%',
                        maxWidth: '100%',
                        overflowY: 'auto',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        padding: 0
                    }}
                >
                    生成された業務フロー図がここに表示されます...
                </div>
            </div>
        </div>
    );
}
