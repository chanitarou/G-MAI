type VerticalResizerProps = {
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
};

// 左右パネルをドラッグでリサイズするための縦方向リサイズバーを描画する。
export function VerticalResizer({ onMouseDown }: VerticalResizerProps) {
    return <div id="vertical-resizer" className="vertical-resizer" role="separator" aria-label="左右リサイズ" aria-orientation="vertical" onMouseDown={onMouseDown} />;
}
