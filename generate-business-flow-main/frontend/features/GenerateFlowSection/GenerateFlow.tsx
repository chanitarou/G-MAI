'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatSection } from './components/ChatSection';
import { DiagramPanel } from './components/DiagramPanel';
import { DrawioCodeSection } from './components/DrawioCodeSection';
import { PromptModal } from './components/PromptModal';
import { VerticalResizer } from './components/VerticalResizer';
import { streamMessages } from '../../lib/api-client';
import { usePanelResize } from './hooks/usePanelResize';

export type AgentState = 'inputWaiting' | 'generating' | 'generated';
export type AttachmentItem = { id: string; file: File; content: string; encoding: 'text' | 'base64' };

export default function GenerateFlow() {
    // 入力待ち/生成中/生成完了の3状態を保持する。
    const [agentState, setAgentState] = useState<AgentState>('inputWaiting');
    // ユーザーの入力プロンプトを管理する。
    const [userPrompt, setUserPrompt] = useState('');
    // ストリーミングで受け取るdrawioコードを保持する。
    const [drawioContent, setDrawioContent] = useState('');
    // API呼び出しで使用するフローID（UUID）を一度だけ生成する。
    const [flowId] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'flow-' + Math.random().toString(36).slice(2)));
    // 添付ファイルを管理する。
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

    // 先頭/末尾の検出は一度だけ行うためのフラグと全体バッファを保持する。
    const xmlStartedRef = useRef(false);
    const xmlEndedRef = useRef(false);
    const streamBufferRef = useRef('');
    // 高頻度のチャンクを一定間隔でまとめて反映するためのタイマー。
    const flushTimerRef = useRef<number | null>(null);
    // 左ペインの幅とリサイズ用ハンドラを管理する。
    const { leftPanelWidth, containerRef, handleMouseDown } = usePanelResize();

    // XML開始位置を検出し、開始前のデータは切り捨てる。
    const extractFromXmlStart = useCallback((working: string) => {
        if (xmlStartedRef.current) return working;
        const startIndex = working.indexOf('<?xml');
        if (startIndex === -1) {
            return null;
        }
        xmlStartedRef.current = true;
        return working.slice(startIndex);
    }, []);

    // XML終了位置を検出し、終了後は切り捨てる。
    const cutAtXmlEnd = useCallback((working: string) => {
        const endIndex = working.indexOf('</mxfile>');
        if (endIndex !== -1) {
            xmlEndedRef.current = true;
            return working.slice(0, endIndex + '</mxfile>'.length);
        }
        return working;
    }, []);

    // バッファをStateに反映し、タイマーをリセットする。
    const flushPendingContent = useCallback(() => {
        setDrawioContent(streamBufferRef.current);
        flushTimerRef.current = null;
    }, []);

    // デバッグ用: drawioContent更新をログ出力する。
    useEffect(() => {
        if (drawioContent) {
            console.log('drawioContent updated in GenerateFlow', drawioContent);
        }
    }, [drawioContent]);

    // まだタイマーがセットされていなければ一定時間後のフラッシュを予約する。
    const scheduleFlush = useCallback(() => {
        if (flushTimerRef.current !== null) return;
        flushTimerRef.current = window.setTimeout(flushPendingContent, 200);
    }, [flushPendingContent]);

    // チャンクを取り込みつつ、一度だけ先頭/末尾を検出して切り出す。
    // xmlタグ内のみを抽出するところまでが責務。xmlとして成立する（部分をrendering可能な形式）形式にするのはDiagramPanel側の責務とする
    const appendDrawioContent = useCallback((chunk: string) => {
        if (xmlEndedRef.current) return;
        streamBufferRef.current += chunk;

        const started = extractFromXmlStart(streamBufferRef.current);
        if (started === null) {
            // メモリ肥大防止のため、先頭が見つからない場合は末尾だけ保持
            streamBufferRef.current = streamBufferRef.current.slice(-200);
            return;
        }
        streamBufferRef.current = started;
        streamBufferRef.current = cutAtXmlEnd(streamBufferRef.current);

        if (streamBufferRef.current) {
            scheduleFlush();
        }
    }, [cutAtXmlEnd, extractFromXmlStart, scheduleFlush]);

    // 添付ファイルをLLMに渡しやすい文字列へまとめる。
    const buildAttachmentPrompt = useCallback((attachedFiles: AttachmentItem[]) => {
        if (!attachedFiles || attachedFiles.length === 0) {
            return '';
        }
        return attachedFiles
            .map(
                (attachment, index) =>
                    `#${index + 1}: ${attachment.file.name}\nencoding: ${attachment.encoding}\n${attachment.content}`
            )
            .join('\n\n');
    }, []);

    // 最小限のサンプルとして、送信ボタンでAPIクライアントを呼び出しステータスを更新する。
    const handleGenerate = useCallback(async (prompt: string, attachedFiles: AttachmentItem[]) => {
        setAgentState('generating');
        setDrawioContent('');
        xmlStartedRef.current = false;
        xmlEndedRef.current = false;
        streamBufferRef.current = '';
        if (flushTimerRef.current !== null) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        try {
            const attachmentPrompt = buildAttachmentPrompt(attachedFiles);
            const combinedPrompt = attachmentPrompt
                ? `${prompt}\n\n--- 添付ファイル ---\n${attachmentPrompt}`
                : prompt;

            // TODO: 添付ファイルをFormDataで送信する設計に拡張する。
            const response = await streamMessages(flowId, combinedPrompt);
            if (!response.ok || !response.body) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let completed = false;

            // ストリームを読み取りつつdrawioコードを随時蓄積する。
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === 'content' && typeof event.text === 'string') {
                            appendDrawioContent(event.text);
                        }
                        if (event.type === 'complete' && typeof event.fullContent === 'string') {
                            appendDrawioContent(event.fullContent);
                            flushPendingContent();
                            setAgentState('generated');
                            completed = true;
                        }
                    } catch (parseError) {
                        console.warn('ストリームイベントのパースに失敗しました', parseError);
                    }
                }
            }
        } catch (error) {
            console.error('API呼び出しに失敗しました', error);
            setAgentState('inputWaiting');
        }
    }, [flowId, appendDrawioContent, flushPendingContent]);

    // drawioContentをローカルにダウンロードする。
    const handleDownload = useCallback(() => {
        if (!drawioContent) return;
        const blob = new Blob([drawioContent], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'flow.drawio';
        anchor.click();
        URL.revokeObjectURL(url);
    }, [drawioContent]);

    // アンマウント時にタイマーを掃除する。
    useEffect(() => {
        return () => {
            if (flushTimerRef.current !== null) {
                clearTimeout(flushTimerRef.current);
            }
        };
    }, []);

    const handleClear = useCallback(() => {
        setUserPrompt('');
        setAttachments([]);
        setDrawioContent('');
        xmlStartedRef.current = false;
        xmlEndedRef.current = false;
        streamBufferRef.current = '';
        if (flushTimerRef.current !== null) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    }, []);

    return (
        <>
            <div className="demo-container" ref={containerRef}>
                <div className="left-panel" style={{ width: leftPanelWidth }}>
                    <ChatSection
                        agentState={agentState}
                        setAgentState={setAgentState}
                        prompt={userPrompt}
                        onPromptChange={setUserPrompt}
                        onClear={handleClear}
                        onGenerate={handleGenerate}
                        attachments={attachments}
                        onAttachmentsChange={setAttachments}
                    />
                </div>
                <VerticalResizer onMouseDown={handleMouseDown} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <DiagramPanel
                        agentState={agentState}
                        drawioContent={drawioContent}
                        canDownload={agentState === 'generated' && !!drawioContent}
                        onDownload={handleDownload}
                    />
                </div>
            </div>
            <PromptModal />
        </>
    );
}
