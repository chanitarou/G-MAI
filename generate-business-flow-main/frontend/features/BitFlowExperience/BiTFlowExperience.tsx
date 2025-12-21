'use client';

import { useEffect } from 'react';

import { ChatSection } from './components/ChatSection';
import { DiagramPanel } from './components/DiagramPanel';
import { DrawioCodeSection } from './components/DrawioCodeSection';
import { PanelResizer } from './components/PanelResizer';
import { PromptModal } from './components/PromptModal';
import { disposeBiTFlowProxyDemo, initializeBiTFlowProxyDemo } from './components/bitFlowProxyDemo';

export default function BiTFlowExperience() {
    useEffect(() => {
        initializeBiTFlowProxyDemo().catch((error) => {
            console.error('業務フロー図AI UI 初期化エラー:', error);
        });

        return () => {
            disposeBiTFlowProxyDemo();
        };
    }, []);

    return (
        <>
            <div className="demo-container">
                <div className="left-panel">
                    <ChatSection />
                    <PanelResizer />
                    <DrawioCodeSection />
                </div>
                <DiagramPanel />
            </div>
            <PromptModal />
        </>
    );
}
