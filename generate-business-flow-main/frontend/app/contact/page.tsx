import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function ContactPage() {
    return (
        <section className="section-container">
            <Card title="Contact" description="お気軽にお問い合わせください。">
                <p>ご質問やコラボレーションのご相談は以下のメールまでご連絡ください。</p>
                <Button as="a" href="mailto:info@bit-flow.example" className="ui-button--block">
                    info@bit-flow.example
                </Button>
            </Card>
        </section>
    );
}
