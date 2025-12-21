export function PanelResizer() {
    return (
        <div className="panel-resizer" id="left-panel-resizer" role="separator" aria-label="パネルリサイズ" aria-orientation="horizontal" tabIndex={0}>
            <div className="resizer-grip" aria-hidden="true">
                <span />
                <span />
                <span />
            </div>
        </div>
    );
}
