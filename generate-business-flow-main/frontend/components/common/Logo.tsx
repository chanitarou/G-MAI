export function Logo({ size = 32 }: { size?: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-wide text-slate-800">業務フロー図AI作成</span>
        </div>
    );
}
