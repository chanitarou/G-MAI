import { Card } from '../../components/ui/Card';

export default function AboutPage() {
    return (
        <section className="section-container">
            <Card title="業務フロー図AI作成について" description="ClaudeとMXGraphを組み合わせた業務フロー生成ツールです。">
                <p>
                    テキストベースの要件から draw.io 互換のフロー図を生成するツールです。
                    リアルタイムでチャット・コード・グラフを同期表示します。
                </p>
            </Card>
        </section>
    );
}
