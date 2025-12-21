import { useEffect, useRef } from 'react';

export type ChatMessage = {
    id: string;
    role: 'user' | 'system';
    content: string;
    sentAt: string;
};

type ChatMessagesProps = {
    id?: string;
    messages: ChatMessage[];
};

// チャットメッセージを表示する専用コンテナを提供し、DOM操作用のIDを維持する。
export function ChatMessages({ id = 'chat-messages', messages }: ChatMessagesProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // メッセージ追加時に末尾までスクロールさせる。
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    return (
        <div
            id={id}
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                border: '1px solid rgba(209, 213, 219, 0.3)',
                borderRadius: 12,
                marginBottom: 3,
                background: 'rgba(249, 250, 251, 0.5)'
            }}
        >
            {messages.map((message) => (
                <div
                    key={message.id}
                    style={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        width: '100%'
                    }}
                >
                    <div
                        className={`chat-message ${message.role}`}
                        style={{
                            padding: '10px 12px',
                            marginBottom: 8,
                            borderRadius: 10,
                            background: message.role === 'user' ? '#e5f6ffff' : '#eef2ffbd',
                            border: '1px solid rgba(209, 213, 219, 0.4)',
                            maxWidth: '80%',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            textAlign: 'left',
                            marginLeft: message.role === 'user' ? 'auto' : 0,
                            marginRight: message.role === 'user' ? 0 : 'auto'
                        }}
                    >
                        <div style={{ fontSize: 13, marginBottom: 4, color: '#4b5563' }}>{message.content}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                            {new Date(message.sentAt).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
