import type { Metadata } from 'next';
import { ReactNode } from 'react';
import Script from 'next/script';

import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import '../styles/variables.css';
import '../styles/globals.css';

export const metadata: Metadata = {
    title: '業務フロー図AI作成',
    description: '業務フロー図生成AI',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ja">
            <head>
                <link
                    rel="stylesheet"
                    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
                    referrerPolicy="no-referrer"
                />
            </head>
            <body>
                <Header />
                <main className="site-main">{children}</main>
                <Script id="mxgraph-config" strategy="beforeInteractive">{`
                    window.mxLoadResources = false;
                    window.mxBasePath = 'https://jgraph.github.io/mxgraph/javascript/src';
                    window.mxLoadStylesheets = false;
                    window.mxImageBasePath = 'https://jgraph.github.io/mxgraph/javascript/src/images';
                    window.mxDebug = false;
                `}</Script>
                <Script
                    id="mxgraph-lib"
                    src="https://jgraph.github.io/mxgraph/javascript/mxClient.js"
                    strategy="beforeInteractive"
                />
            </body>
        </html>
    );
}
