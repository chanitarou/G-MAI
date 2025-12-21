import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { UploadedFile } from '../types';
import { performCheck } from '../utils/checkLogic';
import { hasGeminiApiKey } from '../utils/geminiApi';

const CheckPage = () => {
  const {
    uploadedFiles,
    addFile,
    removeFile,
    ngWords,
    setDetections,
    setParseErrors,
    setImagePdfs,
  } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [useGemini, setUseGemini] = useState(true);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const navigate = useNavigate();

  const geminiAvailable = hasGeminiApiKey();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    files.forEach((file) => {
      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type || getFileType(file.name),
        file: file,
      };
      addFile(uploadedFile);
    });
  };

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    };
    return typeMap[ext || ''] || 'application/octet-stream';
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      parsing: '解析中',
      checking: 'チェック中',
      ocr: 'OCR処理中',
      ai: 'AI検出中',
      done: '完了',
    };
    return statusMap[status] || status;
  };

  const handleStartCheck = async () => {
    setIsChecking(true);
    setProgressStatus('');

    try {
      const result = await performCheck(uploadedFiles, ngWords, {
        useGemini: useGemini && geminiAvailable,
        onProgress: (fileName, status) => {
          setProgressStatus(`${fileName}: ${getStatusText(status)}`);
        },
      });

      setDetections(result.detections);
      setParseErrors(result.parseErrors);
      setImagePdfs(result.imagePdfs);

      navigate('/check/results');
    } catch (error) {
      console.error('チェック処理でエラーが発生しました:', error);
      alert('チェック処理でエラーが発生しました。');
    } finally {
      setIsChecking(false);
      setProgressStatus('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">ファイルチェック</h2>
        <p className="mt-1 text-sm text-gray-600">
          チェック対象のファイルをアップロードしてください
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded p-8 text-center transition-colors ${
          isDragging
            ? 'border-gray-400 bg-gray-50'
            : 'border-gray-300 bg-white'
        }`}
      >
        <div className="flex flex-col items-center">
          <p className="text-sm text-gray-700 font-medium mb-2">
            ファイルをドラッグ&ドロップ
          </p>
          <p className="text-xs text-gray-500 mb-4">または</p>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <span className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 cursor-pointer inline-block focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
              ファイルを選択
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-4">
            対応形式: PDF, PowerPoint (.pptx), Word (.docx), Excel (.xlsx)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            ※ 旧形式 (.ppt, .doc, .xls) は非対応です
          </p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            アップロード済みファイル ({uploadedFiles.length}件)
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center">
                  <span className="text-sm text-gray-900">{file.name}</span>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gemini設定 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">チェックオプション</h3>
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="use-gemini"
            checked={useGemini}
            onChange={(e) => setUseGemini(e.target.checked)}
            disabled={!geminiAvailable}
            className="h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
          />
          <label htmlFor="use-gemini" className="text-sm text-gray-700">
            Gemini AIによる高度な検出を使用
            {!geminiAvailable && (
              <span className="ml-2 text-xs text-amber-600">
                (APIキーが設定されていません)
              </span>
            )}
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          画像化PDFのOCR処理や、より高度なマスキング漏れ検出を行います
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {isChecking && progressStatus && (
            <span className="animate-pulse">{progressStatus}</span>
          )}
        </div>
        <button
          onClick={handleStartCheck}
          disabled={uploadedFiles.length === 0 || isChecking}
          className={`px-8 py-3 rounded-md font-medium ${
            uploadedFiles.length === 0 || isChecking
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {isChecking ? 'チェック中...' : 'チェック開始'}
        </button>
      </div>
    </div>
  );
};

export default CheckPage;
