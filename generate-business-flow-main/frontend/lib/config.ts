export const API_BASE_URL = process.env.NEXT_PUBLIC_PROXY_BASE_URL?.replace(/\/$/, '') || '';

export const ENDPOINTS = {
    health: `${API_BASE_URL}/health`,
    messages: (sessionId: string) => `${API_BASE_URL}/sessions/${sessionId}/flows`,
    messagesBatch: `${API_BASE_URL}/api/claude/messages-batch`,
};
