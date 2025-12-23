import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Category, NgWord, OkWord } from '../types';

type TabType = 'ng' | 'ok';

const WordsSettingsPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ng');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">ワード設定</h2>
        <p className="mt-1 text-sm text-gray-600">
          チェック対象とする固有名詞（NGワード）と、除外対象（OKワード）を管理します
        </p>
      </div>

      {/* タブ切り替え */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('ng')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ng'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            NGワード
          </button>
          <button
            onClick={() => setActiveTab('ok')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ok'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            OKワード
          </button>
        </nav>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'ng' ? <NgWordsTab /> : <OkWordsTab />}
    </div>
  );
};

// NGワードタブコンポーネント
const NgWordsTab = () => {
  const {
    ngWords,
    ngWordsLoading,
    ngWordsError,
    loadNgWords,
    addNgWord,
    updateNgWord,
    removeNgWord,
  } = useApp();

  const [newWord, setNewWord] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('会社名');
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(
    new Set(['会社名', '人名', '案件名', 'システム名', 'その他'])
  );
  const [editingWord, setEditingWord] = useState<NgWord | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('会社名');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: Category[] = ['会社名', '人名', '案件名', 'システム名', 'その他'];

  const toggleCategory = (category: Category) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleAdd = async () => {
    if (newWord.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await addNgWord(newWord.trim(), selectedCategory);
        setNewWord('');
      } catch {
        alert('追加に失敗しました');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleEdit = (word: NgWord) => {
    setEditingWord(word);
    setEditWord(word.word);
    setEditCategory(word.category);
  };

  const handleCancelEdit = () => {
    setEditingWord(null);
    setEditWord('');
    setEditCategory('会社名');
  };

  const handleSaveEdit = async () => {
    if (editingWord && editWord.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await updateNgWord(editingWord.id!, editWord.trim(), editCategory);
        setEditingWord(null);
        setEditWord('');
        setEditCategory('会社名');
      } catch {
        alert('更新に失敗しました');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('このNGワードを削除しますか？') && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await removeNgWord(id);
      } catch {
        alert('削除に失敗しました');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const groupedWords = ngWords.reduce(
    (acc, word) => {
      if (!acc[word.category]) {
        acc[word.category] = [];
      }
      acc[word.category].push(word);
      return acc;
    },
    {} as Record<Category, NgWord[]>
  );

  if (ngWordsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (ngWordsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 mb-4">{ngWordsError}</p>
        <button
          onClick={loadNgWords}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">NGワードを追加</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="NGワードを入力"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100"
            />
          </div>
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as Category)}
              disabled={isSubmitting}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={isSubmitting || !newWord.trim()}
            className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '追加中...' : '追加'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">登録済みNGワード</h3>
          <span className="text-sm text-gray-500">合計 {ngWords.length} 件</span>
        </div>

        {ngWords.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            登録されているNGワードはありません
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => {
              const wordsInCategory = groupedWords[category] || [];
              if (wordsInCategory.length === 0) return null;

              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="border border-gray-200 rounded-md">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">{category}</span>
                      <span className="text-xs text-gray-500">({wordsInCategory.length}件)</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="p-4 space-y-2 bg-white">
                      {wordsInCategory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-md border border-gray-200"
                        >
                          {editingWord?.id === item.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editWord}
                                onChange={(e) => setEditWord(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                                autoFocus
                              />
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value as Category)}
                                className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                {categories.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSubmitting || !editWord.trim()}
                                className="text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                              >
                                保存
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm text-gray-900">{item.word}</span>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleEdit(item)}
                                  disabled={isSubmitting}
                                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id!)}
                                  disabled={isSubmitting}
                                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:text-gray-400"
                                >
                                  削除
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// OKワードタブコンポーネント
const OkWordsTab = () => {
  const {
    okWords,
    okWordsLoading,
    okWordsError,
    loadOkWords,
    addOkWord,
    updateOkWord,
    removeOkWord,
    isWordInNgWords,
  } = useApp();

  const [newWord, setNewWord] = useState('');
  const [newReason, setNewReason] = useState('');
  const [editingWord, setEditingWord] = useState<OkWord | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newWord.trim()) {
      setError('ワードを入力してください');
      return;
    }
    if (!newReason.trim()) {
      setError('理由を入力してください');
      return;
    }
    if (isWordInNgWords(newWord.trim())) {
      setError('このワードはNGワードに登録されているため、OKワードに追加できません');
      return;
    }
    if (okWords.some((w) => w.word === newWord.trim())) {
      setError('このワードは既に登録されています');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await addOkWord(newWord.trim(), newReason.trim());
      setNewWord('');
      setNewReason('');
    } catch {
      setError('追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleEdit = (word: OkWord) => {
    setEditingWord(word);
    setEditReason(word.reason);
  };

  const handleCancelEdit = () => {
    setEditingWord(null);
    setEditReason('');
  };

  const handleSaveEdit = async () => {
    if (editingWord && editReason.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await updateOkWord(editingWord.id!, editReason.trim());
        setEditingWord(null);
        setEditReason('');
      } catch {
        alert('更新に失敗しました');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('このOKワードを削除しますか？') && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await removeOkWord(id);
      } catch {
        alert('削除に失敗しました');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (okWordsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (okWordsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 mb-4">{okWordsError}</p>
        <button
          onClick={loadOkWords}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">OKワードを追加</h3>
        <p className="text-sm text-gray-600 mb-4">
          OKワードに登録したワードは、完全一致検出の結果から除外されます
        </p>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={newWord}
                onChange={(e) => {
                  setNewWord(e.target.value);
                  setError(null);
                }}
                onKeyPress={handleKeyPress}
                placeholder="OKワードを入力"
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          </div>
          <div>
            <textarea
              value={newReason}
              onChange={(e) => {
                setNewReason(e.target.value);
                setError(null);
              }}
              placeholder="OKとする理由を入力（例：公開情報のため問題なし）"
              disabled={isSubmitting}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100 resize-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={isSubmitting || !newWord.trim() || !newReason.trim()}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '追加中...' : '追加'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">登録済みOKワード</h3>
          <span className="text-sm text-gray-500">合計 {okWords.length} 件</span>
        </div>

        {okWords.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            登録されているOKワードはありません
          </p>
        ) : (
          <div className="space-y-2">
            {okWords.map((item) => {
              const isInNgWords = isWordInNgWords(item.word);

              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between px-4 py-3 rounded-md border ${
                    isInNgWords
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {editingWord?.id === item.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="text-sm font-medium text-gray-900">{item.word}</div>
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSubmitting || !editReason.trim()}
                          className="text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{item.word}</span>
                          {isInNgWords && (
                            <span
                              className="inline-flex items-center text-yellow-600"
                              title="NGワードに登録されているため無効"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{item.reason}</p>
                        {isInNgWords && (
                          <p className="text-xs text-yellow-600 mt-1">
                            NGワードに登録されているため、この設定は無効です
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <button
                          onClick={() => handleEdit(item)}
                          disabled={isSubmitting}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(item.id!)}
                          disabled={isSubmitting}
                          className="text-sm text-red-600 hover:text-red-700 font-medium disabled:text-gray-400"
                        >
                          削除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordsSettingsPage;
