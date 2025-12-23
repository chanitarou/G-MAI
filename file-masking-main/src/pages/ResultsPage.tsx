import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Detection, DetectionType, OkWord } from '../types';
import DetectionModal from '../components/DetectionModal';
import AddOkWordModal from '../components/AddOkWordModal';

// 除外情報付きの検出結果型
interface DetectionWithExclusion extends Detection {
  excluded?: boolean;
  excludedBy?: OkWord;
}

const ResultsPage = () => {
  const { detections, uploadedFiles, parseErrors, imagePdfs, okWords, addOkWord, isWordInNgWords } = useApp();
  const [filterType, setFilterType] = useState<'all' | DetectionType | ''>('all');
  const [selectedFileName, setSelectedFileName] = useState<string>('all');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [addOkWordTarget, setAddOkWordTarget] = useState<Detection | null>(null);

  // 検出結果にOKワード除外情報を付与（完全一致のみ対象）
  const detectionsWithExclusion = useMemo((): DetectionWithExclusion[] => {
    console.log('[OKワードチェック] 開始');
    console.log('[OKワードチェック] 登録済みOKワード:', okWords);
    console.log('[OKワードチェック] 検出結果数:', detections.length);

    const result = detections.map((detection) => {
      // AI検知は除外対象外
      // if (detection.type === 'AI検知') {
      //   console.log(`[OKワードチェック] "${detection.keyword}" - AI検知のためスキップ`);
      //   return detection;
      // }
      // 完全一致の場合、OKワードと照合
      const matchedOkWord = okWords.find((ok) => ok.word === detection.keyword);
      if (matchedOkWord) {
        console.log(`[OKワードチェック] "${detection.keyword}" - OKワードに一致! 除外します (理由: ${matchedOkWord.reason})`);
        return {
          ...detection,
          excluded: true,
          excludedBy: matchedOkWord,
        };
      }
      console.log(`[OKワードチェック] "${detection.keyword}" - OKワードに該当なし`);
      return detection;
    });

    const excludedCount = result.filter(d => 'excluded' in d && d.excluded).length;
    console.log(`[OKワードチェック] 完了 - 除外数: ${excludedCount}/${detections.length}`);

    return result;
  }, [detections, okWords]);

  const filteredDetections = useMemo(() => {
    return detectionsWithExclusion.filter((detection) => {
      // 除外済みの表示/非表示
      if (!showExcluded && detection.excluded) {
        return false;
      }
      const typeMatch =
        filterType === 'all' || filterType === '' || detection.type === filterType;
      const fileMatch =
        selectedFileName === 'all' || detection.fileName === selectedFileName;
      return typeMatch && fileMatch;
    });
  }, [detectionsWithExclusion, filterType, selectedFileName, showExcluded]);

  // 除外されていない検出のみカウント
  const activeDetections = detectionsWithExclusion.filter((d) => !d.excluded);
  const exactMatchCount = activeDetections.filter((d) => d.type === '完全一致').length;
  const aiDetectionCount = activeDetections.filter((d) => d.type === 'AI検知').length;
  const excludedCount = detectionsWithExclusion.filter((d) => d.excluded).length;
  const hasDetections = activeDetections.length > 0;

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

  const handleAddOkWord = async (word: string, reason: string) => {
    await addOkWord(word, reason);
    setAddOkWordTarget(null);
  };

  // OKワードに追加可能かどうか判定
  const canAddToOkWords = (detection: DetectionWithExclusion): boolean => {
    // 既に除外済みなら不可
    if (detection.excluded) return false;
    // AI検知は対象外
    if (detection.type === 'AI検知') return false;
    // NGワードに登録済みなら不可
    if (isWordInNgWords(detection.keyword)) return false;
    // 既にOKワードに登録済みなら不可
    if (okWords.some((ok) => ok.word === detection.keyword)) return false;
    return true;
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">チェック対象ファイル</div>
          <div className="text-2xl font-semibold text-gray-900">
            {uploadedFiles.length}件
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">検出件数</div>
          <div className="text-2xl font-semibold text-gray-900">
            {activeDetections.length}件
          </div>
          <div className="mt-2 text-xs text-gray-500">
            完全一致: {exactMatchCount}件 / AI検知: {aiDetectionCount}件
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">除外済み</div>
          <div className="text-2xl font-semibold text-gray-500">
            {excludedCount}件
          </div>
          <div className="mt-2 text-xs text-gray-500">
            OKワードにより除外
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showExcluded}
                onChange={(e) => setShowExcluded(e.target.checked)}
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
              />
              除外済みを表示
            </label>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDetections.map((detection) => (
                  <tr
                    key={detection.id}
                    onClick={() => setSelectedDetection(detection)}
                    className={`cursor-pointer relative group ${
                      detection.excluded
                        ? 'bg-gray-100 text-gray-400'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* OKワードツールチップ（レコード全体にホバー） */}
                    {detection.excluded && detection.excludedBy && (
                      <div
                        className="fixed z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{
                          top: 'var(--tooltip-top, 0)',
                          left: 'var(--tooltip-left, 0)',
                        }}
                        ref={(el) => {
                          if (el) {
                            const tr = el.closest('tr');
                            if (tr) {
                              const updatePosition = () => {
                                const rect = tr.getBoundingClientRect();
                                el.style.setProperty('--tooltip-top', `${rect.top - 8}px`);
                                el.style.setProperty('--tooltip-left', `${rect.left + rect.width / 2}px`);
                              };
                              updatePosition();
                              tr.addEventListener('mouseenter', updatePosition);
                            }
                          }
                        }}
                      >
                        <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg -translate-x-1/2 -translate-y-full">
                          <div className="whitespace-nowrap">
                            <span className="text-gray-400">OKワード:</span> {detection.excludedBy.word}
                          </div>
                          <div className="whitespace-nowrap">
                            <span className="text-gray-400">理由:</span> {detection.excludedBy.reason}
                          </div>
                          {/* 矢印 */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          detection.excluded
                            ? 'bg-gray-200 text-gray-500'
                            : detection.type === '完全一致'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {detection.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${detection.excluded ? 'text-gray-400' : 'text-gray-900'}`}>
                      <div className="flex items-center gap-2">
                        {detection.keyword}
                        {detection.excluded && detection.excludedBy && (
                          <span className="inline-flex items-center text-green-600">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${detection.excluded ? 'text-gray-400' : 'text-gray-600'}`}>
                      {detection.reason || '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${detection.excluded ? 'text-gray-400' : 'text-gray-600'}`}>
                      {detection.fileName}
                    </td>
                    <td className={`px-4 py-3 text-sm ${detection.excluded ? 'text-gray-400' : 'text-gray-600'}`}>
                      {detection.location}
                    </td>
                    <td className={`px-4 py-3 text-sm max-w-md truncate ${detection.excluded ? 'text-gray-400' : 'text-gray-600'}`}>
                      {detection.excluded ? (
                        detection.context
                      ) : (
                        highlightKeyword(detection.context, detection.keyword)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {canAddToOkWords(detection) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddOkWordTarget(detection);
                          }}
                          className="px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded border border-green-300"
                        >
                          +OKワード
                        </button>
                      )}
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

      {addOkWordTarget && (
        <AddOkWordModal
          word={addOkWordTarget.keyword}
          onSubmit={handleAddOkWord}
          onClose={() => setAddOkWordTarget(null)}
        />
      )}
    </div>
  );
};

export default ResultsPage;
