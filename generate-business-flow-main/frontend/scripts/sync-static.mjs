import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FRONTEND_DIR = resolve(process.cwd());
const OUT_DIR = join(FRONTEND_DIR, 'out');
const BACKEND_STATIC_DIR = resolve(FRONTEND_DIR, '..', 'backend', 'src', 'static');

if (!existsSync(OUT_DIR)) {
    console.error('Next.js export 出力(out/)が見つかりません。先に `next export` を完了してください。');
    process.exit(1);
}

rmSync(BACKEND_STATIC_DIR, { recursive: true, force: true });
mkdirSync(BACKEND_STATIC_DIR, { recursive: true });
cpSync(OUT_DIR, BACKEND_STATIC_DIR, { recursive: true });

console.log(`✅ 静的資産を ${OUT_DIR} から ${BACKEND_STATIC_DIR} に同期しました。`);
