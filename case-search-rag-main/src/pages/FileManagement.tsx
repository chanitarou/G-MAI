import { useState, useRef, useEffect, useCallback } from 'react';
import { UploadedFile, Tag } from '../types';
import TagBadge from '../components/TagBadge';
import Modal from '../components/Modal';
import { createDifyTag, fetchDifyTags, fetchDifyDocuments, updateDocumentMetadata } from '../services/difyApi';

export default function FileManagement() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFilesFromDify = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      console.log('Loading documents from Dify...');
      const response = await fetchDifyDocuments();
      console.log('Fetched documents from Dify:', response);

      // Convert Dify documents to UploadedFile format
      const convertedFiles: UploadedFile[] = response.data.map(doc => {
        // Extract tag names from doc_metadata
        const tagNames: string[] = [];
        if (doc.doc_metadata) {
          doc.doc_metadata.forEach(meta => {
            // Skip built-in fields
            if (meta.id !== 'built-in' && meta.value) {
              tagNames.push(meta.name);
            }
          });
        }

        return {
          id: doc.id,
          name: doc.name,
          uploadDate: new Date(doc.created_at * 1000), // Convert Unix timestamp to Date
          tags: tagNames,
          size: doc.data_source_info.size,
        };
      });

      console.log('Converted files:', convertedFiles);
      setFiles(convertedFiles);
    } catch (error: any) {
      console.error('Failed to load documents from Dify:', error);
      alert(`ファイルの読み込みに失敗しました: ${error.message || '不明なエラー'}`);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

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
      alert(`タグの読み込みに失敗しました: ${error.message || '不明なエラー'}`);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  // Load documents from Dify API on component mount
  useEffect(() => {
    loadFilesFromDify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tags from Dify API when tag management modal opens
  useEffect(() => {
    if (isTagManagementOpen) {
      loadTagsFromDify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTagManagementOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      uploadDate: new Date(),
      tags: [],
      size: file.size,
    }));

    setFiles(prev => [...newFiles, ...prev]);
  };

  const handleDeleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    const tagExists = tags.some(t => t.name === newTagName.trim());
    if (tagExists) {
      alert('そのタグは既に存在します');
      return;
    }

    setIsCreatingTag(true);

    try {
      // Call Dify API to create tag
      await createDifyTag(newTagName.trim());

      // Success notification
      alert('タグが正常に作成されました');

      // Clear input
      setNewTagName('');

      // Reload tags from Dify to get the latest list with the new tag
      await loadTagsFromDify();
    } catch (error: any) {
      // Handle API errors
      console.error('Failed to create tag in Dify:', error);
      const errorMessage = error.message || 'タグの作成に失敗しました';
      alert(`エラー: ${errorMessage}`);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = (tagId: string) => {
    const tagToDelete = tags.find(t => t.id === tagId);
    if (!tagToDelete) return;

    // ファイルからもタグを削除
    setFiles(prev => prev.map(file => ({
      ...file,
      tags: file.tags.filter(t => t !== tagToDelete.name),
    })));

    setTags(prev => prev.filter(t => t.id !== tagId));
  };

  const handleEditFileTags = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setEditingFileId(fileId);
    setSelectedTags(file.tags);

    // Load tags from Dify if not already loaded
    if (tags.length === 0) {
      await loadTagsFromDify();
    }
  };

  const handleToggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleSaveFileTags = async () => {
    if (!editingFileId) return;

    setIsSavingTags(true);

    try {
      // Update Dify document metadata
      await updateDocumentMetadata(editingFileId, selectedTags);

      // Update local state
      setFiles(prev => prev.map(file =>
        file.id === editingFileId
          ? { ...file, tags: selectedTags }
          : file
      ));

      setEditingFileId(null);
      setSelectedTags([]);

      console.log('Document tags updated successfully in Dify');
    } catch (error: any) {
      console.error('Failed to update document tags in Dify:', error);
      alert(`タグの保存に失敗しました: ${error.message || '不明なエラー'}`);
    } finally {
      setIsSavingTags(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            ファイル管理
          </h1>
          <p className="text-sm text-gray-600">
            事例データファイルのアップロードと管理を行います
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsTagManagementOpen(true)}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          タグ管理
        </button>
      </div>

      {/* Upload Area */}
      <div
        className={`mb-8 border-2 border-dashed rounded p-8 text-center transition-colors ${
          dragActive
            ? 'border-gray-400 bg-gray-50'
            : 'border-gray-300 bg-white'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-700 font-medium mb-2">
            ファイルをドラッグ&ドロップ
          </p>
          <p className="text-xs text-gray-500 mb-4">または</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.docx,.txt"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            ファイルを選択
          </button>
          <p className="text-xs text-gray-500 mt-4">
            対応形式: PDF, DOCX, TXT (最大10MB)
          </p>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            アップロード済みファイル
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isLoadingFiles ? '読み込み中...' : `${files.length}件のファイル`}
          </p>
        </div>

        {isLoadingFiles ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-sm text-gray-500">
              <div className="animate-pulse">Difyからファイルを読み込んでいます...</div>
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              ファイルがありません。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
            <div key={file.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    {file.name}
                  </h3>

                  <div className="flex items-center text-xs text-gray-500 mb-3">
                    <span>{file.uploadDate.toLocaleDateString('ja-JP')}</span>
                    <span className="mx-2">•</span>
                    <span>{formatFileSize(file.size)}</span>
                  </div>

                  {editingFileId === file.id ? (
                    <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        タグを選択してください
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleToggleTag(tag.name)}
                            className={`px-3 py-1 text-xs rounded border transition-colors ${
                              selectedTags.includes(tag.name)
                                ? 'bg-gray-900 border-gray-900 text-white'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            #{tag.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleSaveFileTags}
                          disabled={isSavingTags}
                          className="px-3 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[60px]"
                        >
                          {isSavingTags ? '保存中...' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFileId(null)}
                          disabled={isSavingTags}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {file.tags.map((tagName, index) => (
                        <TagBadge key={index} tag={tagName} />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleEditFileTags(file.id)}
                      className="text-xs text-gray-700 hover:text-gray-900 font-medium"
                    >
                      タグ編集
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      ダウンロード
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteFile(file.id)}
                  className="ml-4 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Tag Management Modal */}
      <Modal
        isOpen={isTagManagementOpen}
        onClose={() => setIsTagManagementOpen(false)}
        title="タグ管理"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              新しいタグを追加
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isCreatingTag && handleAddTag()}
                disabled={isCreatingTag}
                placeholder="タグ名を入力（例: 公共、DX）"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={isCreatingTag}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[60px]"
              >
                {isCreatingTag ? '作成中...' : '追加'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              登録済みタグ（{tags.length}件）
            </label>
            {isLoadingTags ? (
              <div className="flex justify-center items-center py-8 border border-gray-200 rounded bg-gray-50">
                <div className="text-sm text-gray-500">
                  <div className="animate-pulse">Difyからタグを読み込んでいます...</div>
                </div>
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8 border border-gray-200 rounded bg-gray-50">
                タグがありません。新しいタグを追加してください。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded bg-gray-50">
                {tags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag.name}
                    onRemove={() => handleDeleteTag(tag.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsTagManagementOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              閉じる
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
