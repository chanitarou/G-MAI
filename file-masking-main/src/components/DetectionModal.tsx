import { Detection } from '../types';

interface DetectionModalProps {
  detection: Detection;
  onClose: () => void;
}

const DetectionModal = ({ detection, onClose }: DetectionModalProps) => {
  const highlightKeyword = (text: string, keyword: string): JSX.Element => {
    const parts = text.split(keyword);
    return (
      <>
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <span className="bg-yellow-200 font-semibold px-1">{keyword}</span>
            )}
          </span>
        ))}
      </>
    );
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackgroundClick}
    >
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">検出詳細</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                検出種別
              </label>
              <span
                className={`inline-flex px-3 py-1 text-sm font-medium rounded ${
                  detection.type === '完全一致'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-orange-100 text-orange-800'
                }`}
              >
                {detection.type}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                検出文言
              </label>
              <p className="text-sm text-gray-900 font-semibold">
                {detection.keyword}
              </p>
            </div>

            {detection.reason && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  検知理由
                </label>
                <p className="text-sm text-gray-900">{detection.reason}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ファイル名
              </label>
              <p className="text-sm text-gray-900">{detection.fileName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                該当箇所
              </label>
              <p className="text-sm text-gray-900">{detection.location}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                全文
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-900 leading-relaxed">
                {highlightKeyword(detection.fullText, detection.keyword)}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionModal;
