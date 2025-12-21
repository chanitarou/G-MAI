import { useState, useRef, useEffect, useCallback } from 'react';
import { chatHistory as initialChatHistory } from '../data/dummyData';
import { ChatMessage, SearchResult, Tag } from '../types';
import TagBadge from '../components/TagBadge';
import { fetchDifyTags, sendChatMessage } from '../services/difyApi';

export default function ChatSearch() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatHistory);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadTagsFromDify = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      console.log('Loading tags from Dify...');
      const difyTags = await fetchDifyTags();
      console.log('Fetched tags from Dify:', difyTags);

      // Convert Dify metadata fields to Tag format
      const convertedTags: Tag[] = difyTags.map(field => ({
        id: field.id,
        name: field.name,
        color: 'gray',
      }));

      console.log('Converted tags:', convertedTags);
      setTags(convertedTags);
    } catch (error: any) {
      console.error('Failed to load tags from Dify:', error);
      // Silently fail - don't show error to user for tag loading
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  // Load tags from Dify API on component mount
  useEffect(() => {
    loadTagsFromDify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    // Allow search with tags only or text only or both
    if (!inputValue.trim() && selectedTags.length === 0) return;

    // Build query with tags if selected
    let query = inputValue.trim();
    if (selectedTags.length > 0) {
      const tagString = selectedTags.map(t => `#${t}`).join(' ');
      query = query ? `${query} ${tagString}` : tagString;
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSearching(true);
    setHasSearched(true);

    try {
      // Send message to Dify chatbot
      const response = await sendChatMessage(query, conversationId);

      // Store conversation ID for follow-up messages
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Convert retriever resources to SearchResult format
      const searchResults: SearchResult[] = response.metadata.retriever_resources.map((resource, index) => ({
        id: resource.segment_id || `result-${index}`,
        fileName: resource.document_name,
        matchedText: resource.content,
        pageNumber: resource.position,
        tags: [], // Tags are not included in retriever resources
        uploadDate: new Date(),
      }));

      setResults(searchResults);

      // Format the assistant's response message
      let assistantContent = '';

      // Check if we have a parsed search_response with structured results
      if (response.search_response && response.search_response.results.length > 0) {
        const searchResp = response.search_response;

        // Build a user-friendly summary
        assistantContent = `${searchResp.total_count}件の関連文書が見つかりました。\n\n`;

        searchResp.results.forEach((result, index) => {
          assistantContent += `**${index + 1}. ${result.title}**\n`;
          assistantContent += `📄 ${result.document_name}\n`;
          assistantContent += `${result.summary}\n`;

          if (result.key_points && result.key_points.length > 0) {
            assistantContent += '\n主要なポイント:\n';
            result.key_points.forEach(point => {
              assistantContent += `• ${point}\n`;
            });
          }

          if (result.relevance_score) {
            const scoreLabel = result.relevance_score === 'high' ? '高' :
                             result.relevance_score === 'medium' ? '中' : '低';
            assistantContent += `\n関連度: ${scoreLabel}\n`;
          }

          // Add separator between results
          if (index < searchResp.results.length - 1) {
            assistantContent += '\n---\n\n';
          }
        });

        if (searchResp.suggestion_message) {
          assistantContent += `\n\n💡 ${searchResp.suggestion_message}`;
        }
      } else {
        // Fallback to the original answer if no structured response
        assistantContent = response.answer;
      }

      // Create assistant message with formatted content
      const assistantMessage: ChatMessage = {
        id: response.message_id,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(response.created_at * 1000),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message to Dify:', error);

      // Show error message to user
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `申し訳ございません。エラーが発生しました: ${error.message || '不明なエラー'}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName];

      return newTags;
    });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
      {/* Chat Section */}
      <div className="w-full lg:w-1/2 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">チャット</h2>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded ${
                  message.role === 'user'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">
                  {message.content.split('\n').map((line, idx) => {
                    // Check if line is a heading (starts with **)
                    if (line.startsWith('**') && line.endsWith('**')) {
                      const text = line.slice(2, -2);
                      return (
                        <p key={idx} className="font-semibold mt-2 mb-1">
                          {text}
                        </p>
                      );
                    }
                    // Check if line is a separator
                    if (line.trim() === '---') {
                      return (
                        <hr
                          key={idx}
                          className={`my-3 ${
                            message.role === 'user' ? 'border-gray-600' : 'border-gray-300'
                          }`}
                        />
                      );
                    }
                    // Regular line
                    return line.trim() ? (
                      <p key={idx} className="mb-1">
                        {line}
                      </p>
                    ) : (
                      <br key={idx} />
                    );
                  })}
                </div>
                <p
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          {isSearching && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded">
                <p className="text-sm">検索中...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          {/* Tag Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">
                タグで絞り込み（複数選択可）
              </label>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  disabled={isSearching}
                  className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  すべてクリア
                </button>
              )}
            </div>
            {isLoadingTags ? (
              <div className="flex justify-center items-center py-4 text-xs text-gray-500">
                <div className="animate-pulse">タグを読み込んでいます...</div>
              </div>
            ) : tags.length === 0 ? (
              <div className="text-xs text-gray-500 py-2">
                タグがありません。ファイル管理ページからタグを追加してください。
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    disabled={isSearching}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedTags.includes(tag.name)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTags.length > 0 ? `選択中のタグ: ${selectedTags.map(t => '#' + t).join(' ')}` : "探したいドキュメントについて質問してください..."}
              disabled={isSearching}
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSearching || (!inputValue.trim() && selectedTags.length === 0)}
              className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSearching ? '検索中...' : '送信'}
            </button>
          </div>
        </div>
      </div>

      {/* Search Results Section */}
      <div className="w-full lg:w-1/2 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">検索結果</h2>
          {hasSearched && (
            <p className="text-sm text-gray-500 mt-1">
              {results.length}件の結果が見つかりました
            </p>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!hasSearched ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-sm">検索を実行すると結果がここに表示されます</p>
                <p className="text-xs mt-1">キーワードやタグを選択して検索してください</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-sm">該当する結果が見つかりませんでした</p>
                <p className="text-xs mt-1">別のキーワードやタグでお試しください</p>
              </div>
            </div>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className="bg-white border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      {result.fileName}
                    </h3>
                    {result.pageNumber && (
                      <p className="text-xs text-gray-500 mb-2">
                        ページ {result.pageNumber}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                  {result.matchedText}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {result.tags.map((tag, index) => (
                    <TagBadge key={index} tag={tag} />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {result.uploadDate.toLocaleDateString('ja-JP')}
                  </span>
                  <button
                    type="button"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    ファイルを開く →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
