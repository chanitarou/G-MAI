import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="full-screen-center">
            <p>404</p>
            <h1 className="not-found-title">ページが見つかりません</h1>
            <p>URL をご確認いただくか、トップページに戻ってください。</p>
            <Link href="/" className="not-found-link">
                ホームへ戻る
            </Link>
        </div>
    );
}
