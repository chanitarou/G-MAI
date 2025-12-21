export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

export interface PromptHistoryEntry {
    userInput: string;
    actualPrompt: string | null;
    timestamp: Date;
}
