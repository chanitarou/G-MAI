import { ENDPOINTS } from './config';
import { MOCK_DRAWIO_XML } from './mock-drawio';

export type HealthStatus = {
    status: string;
    timestamp: string;
    service: string;
};

// 暫定的にモックストリームを強制するフラグ（環境変数ではなくベタ書き）
const USE_MOCK_STREAM = false;

export async function fetchHealth(): Promise<HealthStatus> {
    const response = await fetch(ENDPOINTS.health, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
    }
    return response.json();
}

export function streamMessages(sessionId: string, prompt: string): Promise<Response> {
    if (USE_MOCK_STREAM) {
        return Promise.resolve(createMockStreamResponse());
    }
    return fetch(ENDPOINTS.messages(sessionId), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_prompt: prompt,
            streaming: true,
            use_agent_mode: true
        })
    });
}

export async function postMessages(body: Record<string, unknown>) {
    const response = await fetch(ENDPOINTS.messagesBatch, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Message request failed with status ${response.status}`);
    }
    return response.json();
}

// 既存のdrawioサンプルを用いてストリーミングレスポンスをエミュレートする。
function createMockStreamResponse(): Response {
    const encoder = new TextEncoder();
    const chunkSize = 4000;
    const chunkTexts: string[] = [];
    for (let i = 0; i < MOCK_DRAWIO_XML.length; i += chunkSize) {
        chunkTexts.push(MOCK_DRAWIO_XML.slice(i, i + chunkSize));
    }

    const events = [
        { type: 'start', message: 'mock stream started' },
        ...chunkTexts.map((text, index) => ({ type: 'content', text, chunk: index + 1 })),
        { type: 'complete', fullContent: MOCK_DRAWIO_XML, totalChunks: chunkTexts.length || 1 }
    ];

    const stream = new ReadableStream({
        async start(controller) {
            // 実際のストリーミングを模して、イベントを逐次送信する。
            for (const event of events) {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
                // 短い間隔を挟んで疑似ストリームを演出
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
            controller.close();
        }
    });

    // statusを明示して`ok`をtrueにし、`body`も確実に持たせる。
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
}
