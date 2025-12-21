import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from 'react';

type UsePanelResizeResult = {
    leftPanelWidth: number;
    containerRef: React.RefObject<HTMLDivElement>;
    handleMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

// 左右のパネルをドラッグでリサイズするためのフック。初期値は1:2の比率を維持する。
export function usePanelResize(): UsePanelResizeResult {
    const [leftPanelWidth, setLeftPanelWidth] = useState<number>(480);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const initialWidthSetRef = useRef(false);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!dragStateRef.current || !containerRef.current) return;
        const { startX, startWidth } = dragStateRef.current;
        const delta = event.clientX - startX;
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const newWidth = Math.min(Math.max(startWidth + delta, 320), containerWidth - 320);
        setLeftPanelWidth(newWidth);
        document.body.classList.add('is-resizing');
    }, []);

    const handleMouseUp = useCallback(() => {
        dragStateRef.current = null;
        document.body.classList.remove('is-resizing');
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        dragStateRef.current = { startX: event.clientX, startWidth: leftPanelWidth };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [leftPanelWidth, handleMouseMove, handleMouseUp]);

    // 初回レンダー時に1:2（左:右）の比率を適用する。
    useEffect(() => {
        if (initialWidthSetRef.current) return;
        const containerWidth = containerRef.current?.getBoundingClientRect().width;
        if (!containerWidth) return;
        const suggested = containerWidth / 3; // 左:右=1:2のため1/3を初期幅とする
        const clamped = Math.min(Math.max(suggested, 320), containerWidth - 320);
        setLeftPanelWidth(clamped);
        initialWidthSetRef.current = true;
    }, []);

    // アンマウント時にイベントリスナーを解除する。
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return { leftPanelWidth, containerRef, handleMouseDown };
}
