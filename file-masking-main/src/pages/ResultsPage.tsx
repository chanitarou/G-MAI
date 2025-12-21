import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Detection, DetectionType } from '../types';
import DetectionModal from '../components/DetectionModal';

const ResultsPage = () => {
  const { detections, uploadedFiles, parseErrors, imagePdfs } = useApp();
  const [filterType, setFilterType] = useState<'all' | DetectionType | ''>('all');
  const [selectedFileName, setSelectedFileName] = useState<string>('all');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const filteredDetections = useMemo(() => {
    return detections.filter((detection) => {
      const typeMatch =
        filterType === 'all' || filterType === '' || detection.type === filterType;
      const fileMatch =
        selectedFileName === 'all' || detection.fileName === selectedFileName;
      return typeMatch && fileMatch;
    });
  }, [detections, filterType, selectedFileName]);

  const exactMatchCount = detections.filter((d) => d.type === '完全一致').length;
  const aiDetectionCount = detections.filter((d) => d.type === 'AI検知').length;
  const hasDetections = detections.length > 0;

  const uniqueFileNames = Array.from(new Set(detections.map((d) => d.fileName)));

  const highlightKeyword = (text: string, keyword: string): JSX.Element => {
    const parts = text.split(keyword);
    return (
      <>
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="bg-yellow-200 font-semibold">{keyword}</span>
            )}
          </span>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">検出結果</h2>
        <p className="mt-1 text-sm text-gray-600">
          マスキング漏れの可能性がある箇所を表示しています
        </p>
      </div>

      {/* 解析エラー警告 */}
      {parseErrors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-medium flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            解析できなかったファイル ({parseErrors.length}件)
          </h3>
          <ul className="mt-2 text-sm text-yellow-700 space-y-1">
            {parseErrors.map((error, idx) => (
              <li key={idx} className="flex items-start">
                <span className="font-medium mr-2">{error.fileName}:</span>
                <span>{error.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 画像化PDF通知 */}
      {imagePdfs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-medium flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            画像化PDFが検出されました ({imagePdfs.length}件)
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            以下のファイルはテキストが埋め込まれていないPDFです。Gemini AI-OCR機能を使用すると文字認識が可能です。
          </p>
          <ul className="mt-2 text-sm text-blue-700">
            {imagePdfs.map((name, idx) => (
              <li key={idx} className="ml-4">- {name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">チェック対象ファイル</div>
          <div className="text-2xl font-semibold text-gray-900">
            {uploadedFiles.length}件
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">検出件数</div>
          <div className="text-2xl font-semibold text-gray-900">
            {detections.length}件
          </div>
          <div className="mt-2 text-xs text-gray-500">
            完全一致: {exactMatchCount}件 / AI検知: {aiDetectionCount}件
          </div>
        </div>
        <div
          className={`border rounded-lg p-4 ${
            hasDetections
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="text-sm text-gray-600 mb-1">ステータス</div>
          <div
            className={`text-2xl font-semibold ${
              hasDetections ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {hasDetections ? '検出あり' : '検出なし'}
          </div>
        </div>
      </div>

      {/* フィルタバー */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 text-sm rounded-md border ${
                filterType === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilterType('完全一致')}
              className={`px-4 py-2 text-sm rounded-md border ${
                filterType === '完全一致'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              完全一致のみ
            </button>
            <button
              onClick={() => setFilterType('AI検知')}
              className={`px-4 py-2 text-sm rounded-md border ${
                filterType === 'AI検知'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              AI検知のみ
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-700">ファイル:</label>
            <select
              value={selectedFileName}
              onChange={(e) => setSelectedFileName(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="all">すべて</option>
              {uniqueFileNames.map((fileName) => (
                <option key={fileName} value={fileName}>
                  {fileName}
                </option>
              ))}
            </select>
          </div>
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
            CSVエクスポート
          </button>
        </div>
      </div>

      {/* 検出結果テーブル */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredDetections.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {detections.length === 0
              ? '検出された問題はありません'
              : 'フィルタ条件に一致する検出はありません'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    種別
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    検出文言
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    検知理由
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    該当箇所
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    周辺テキスト
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDetections.map((detection) => (
                  <tr
                    key={detection.id}
                    onClick={() => setSelectedDetection(detection)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          detection.type === '完全一致'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {detection.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {detection.keyword}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {detection.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {detection.fileName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {detection.location}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
                      {highlightKeyword(detection.context, detection.keyword)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDetection && (
        <DetectionModal
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
        />
      )}
    </div>
  );
};

export default ResultsPage;
