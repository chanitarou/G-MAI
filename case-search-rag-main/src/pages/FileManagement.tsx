import { useState, useRef, useEffect, useCallback } from 'react';
import { UploadedFile, DocumentMetadata, METADATA_OPTIONS } from '../types';
import Modal from '../components/Modal';
import { fetchDifyDocuments, updateDocumentMetadata, uploadDocumentToDataset, deleteDocumentFromDataset } from '../services/difyApi';

export default function FileManagement() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingMetadata, setEditingMetadata] = useState<DocumentMetadata>({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<UploadedFile | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // トースト表示（自動で消える）
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadFilesFromDify = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      console.log('Loading documents from Dify...');
      const response = await fetchDifyDocuments();
      console.log('Fetched documents from Dify:', response);

      // Convert Dify documents to UploadedFile format
      const convertedFiles: UploadedFile[] = response.data.map(doc => {
        // Extract metadata from doc_metadata
        const metadata: DocumentMetadata = {};
        if (doc.doc_metadata) {
          doc.doc_metadata.forEach(meta => {
            if (meta.id !== 'built-in' && meta.value) {
              if (meta.name === 'sector') metadata.sector = meta.value;
              if (meta.name === 'business_type') metadata.business_type = meta.value;
              if (meta.name === 'client_category') metadata.client_category = meta.value;
            }
          });
        }

        return {
          id: doc.id,
          name: doc.name,
          uploadDate: new Date(doc.created_at * 1000),
          metadata,
          size: doc.data_source_info.size,
        };
      });

      console.log('Converted files:', convertedFiles);
      setFiles(convertedFiles);
    } catch (error: any) {
      console.error('Failed to load documents from Dify:', error);
      showToast(`ファイルの読み込みに失敗しました: ${error.message || '不明なエラー'}`, 'error');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [showToast]);

  // Load documents from Dify API on component mount
  useEffect(() => {
    loadFilesFromDify();
  }, [loadFilesFromDify]);

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

  const handleFiles = async (fileList: FileList) => {
    const filesToUpload = Array.from(fileList);

    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });

    const successfulUploads: UploadedFile[] = [];
    const failedUploads: string[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setUploadProgress({ current: i + 1, total: filesToUpload.length });

      try {
        console.log(`Uploading file ${i + 1}/${filesToUpload.length}: ${file.name}`);
        const response = await uploadDocumentToDataset(file);

        successfulUploads.push({
          id: response.document.id,
          name: response.document.name,
          uploadDate: new Date(response.document.created_at * 1000),
          metadata: {},
          size: file.size,
        });

        console.log(`Successfully uploaded: ${file.name}`);
      } catch (error: any) {
        console.error(`Failed to upload ${file.name}:`, error);
        failedUploads.push(`${file.name}: ${error.message || '不明なエラー'}`);
      }
    }

    if (successfulUploads.length > 0) {
      setFiles(prev => [...successfulUploads, ...prev]);
    }

    if (failedUploads.length > 0) {
      showToast(`アップロード完了（成功: ${successfulUploads.length}件 / 失敗: ${failedUploads.length}件）`, 'error');
    } else if (successfulUploads.length > 0) {
      showToast(`${successfulUploads.length}件のファイルをアップロードしました`, 'success');
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (successfulUploads.length > 0) {
      await loadFilesFromDify();
    }
  };

  const handleDeleteClick = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      setDeleteConfirmFile(file);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmFile(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmFile) return;

    const fileId = deleteConfirmFile.id;
    const fileName = deleteConfirmFile.name;

    setDeletingFileId(fileId);
    setIsDeleting(true);

    try {
      await deleteDocumentFromDataset(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      setDeleteConfirmFile(null);
      showToast('ファイルを削除しました', 'success');
      console.log('File deleted successfully:', fileName);
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      showToast(`削除に失敗しました: ${error.message || '不明なエラー'}`, 'error');
    } finally {
      setDeletingFileId(null);
      setIsDeleting(false);
    }
  };

  const handleEditMetadata = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setEditingFileId(fileId);
    setEditingMetadata({ ...file.metadata });
  };

  const handleSaveMetadata = async () => {
    if (!editingFileId) return;

    setIsSavingMetadata(true);

    try {
      await updateDocumentMetadata(editingFileId, editingMetadata);

      setFiles(prev => prev.map(file =>
        file.id === editingFileId
          ? { ...file, metadata: { ...editingMetadata } }
          : file
      ));

      setEditingFileId(null);
      setEditingMetadata({});
      showToast('メタデータを保存しました', 'success');
    } catch (error: any) {
      console.error('Failed to update metadata:', error);
      showToast(`保存に失敗しました: ${error.message || '不明なエラー'}`, 'error');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingFileId(null);
    setEditingMetadata({});
  };

  // client_categoryの選択肢を取得
  const getClientCategoryOptions = (sector?: string): string[] => {
    if (!sector) return [];
    if (sector === '公共') return [...METADATA_OPTIONS.client_category['公共']];
    if (sector === '民間') return [...METADATA_OPTIONS.client_category['民間']];
    return [];
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // メタデータ表示用のラベル
  const renderMetadataLabels = (metadata: DocumentMetadata) => {
    const labels = [];
    if (metadata.sector) labels.push(metadata.sector);
    if (metadata.business_type) labels.push(metadata.business_type);
    if (metadata.client_category) labels.push(metadata.client_category);

    if (labels.length === 0) {
      return <span className="text-xs text-gray-400">メタデータ未設定</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {labels.map((label, index) => (
          <span
            key={index}
            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
          >
            {label}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          ファイル管理
        </h1>
        <p className="text-sm text-gray-600">
          事例データファイルのアップロードと管理を行います
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`mb-8 border-2 border-dashed rounded p-8 text-center transition-colors ${
          isUploading
            ? 'border-blue-400 bg-blue-50'
            : dragActive
              ? 'border-gray-400 bg-gray-50'
              : 'border-gray-300 bg-white'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
              <p className="text-sm text-gray-700 font-medium mb-2">
                アップロード中...
              </p>
              {uploadProgress && (
                <p className="text-xs text-gray-500">
                  {uploadProgress.current} / {uploadProgress.total} ファイル
                </p>
              )}
            </>
          ) : (
            <>
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
                disabled={isUploading}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                ファイルを選択
              </button>
              <p className="text-xs text-gray-500 mt-4">
                対応形式: PDF, DOCX, TXT (最大10MB)
              </p>
            </>
          )}
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
                      <div className="mb-3 p-4 bg-gray-50 rounded border border-gray-200">
                        <div className="space-y-3">
                          {/* セクター */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              セクター
                            </label>
                            <select
                              value={editingMetadata.sector || ''}
                              onChange={(e) => {
                                setEditingMetadata(prev => ({
                                  ...prev,
                                  sector: e.target.value || undefined,
                                  client_category: undefined, // セクター変更時にクライアント種別をリセット
                                }));
                              }}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              <option value="">選択してください</option>
                              {METADATA_OPTIONS.sector.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          {/* 業務種別 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              業務種別
                            </label>
                            <select
                              value={editingMetadata.business_type || ''}
                              onChange={(e) => setEditingMetadata(prev => ({
                                ...prev,
                                business_type: e.target.value || undefined,
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                            >
                              <option value="">選択してください</option>
                              {METADATA_OPTIONS.business_type.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>

                          {/* クライアント種別 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              クライアント種別
                            </label>
                            <select
                              value={editingMetadata.client_category || ''}
                              onChange={(e) => setEditingMetadata(prev => ({
                                ...prev,
                                client_category: e.target.value || undefined,
                              }))}
                              disabled={!editingMetadata.sector}
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                              <option value="">
                                {editingMetadata.sector ? '選択してください' : 'セクターを先に選択してください'}
                              </option>
                              {getClientCategoryOptions(editingMetadata.sector).map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex space-x-2 mt-4">
                          <button
                            type="button"
                            onClick={handleSaveMetadata}
                            disabled={isSavingMetadata}
                            className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {isSavingMetadata ? '保存中...' : '保存'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingMetadata}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        {renderMetadataLabels(file.metadata)}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditMetadata(file.id)}
                        className="text-xs text-gray-700 hover:text-gray-900 font-medium"
                      >
                        メタデータ編集
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
                    onClick={() => handleDeleteClick(file.id)}
                    disabled={isDeleting && deletingFileId === file.id}
                    className="ml-4 text-sm text-red-600 hover:text-red-800 font-medium disabled:text-red-300 disabled:cursor-not-allowed"
                  >
                    {isDeleting && deletingFileId === file.id ? '削除中...' : '削除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmFile !== null}
        onClose={handleDeleteCancel}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            「<span className="font-medium">{deleteConfirmFile?.name}</span>」を削除しますか？
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-700 text-sm rounded hover:bg-gray-100 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-red-300"
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className={`ml-2 p-1 rounded hover:bg-opacity-20 ${
                toast.type === 'success' ? 'hover:bg-green-600' : 'hover:bg-red-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
