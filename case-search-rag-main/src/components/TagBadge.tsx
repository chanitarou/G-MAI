interface TagBadgeProps {
  tag: string;
  onRemove?: () => void;
}

export default function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 border border-gray-300"
    >
      #{tag}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:text-gray-900"
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}
