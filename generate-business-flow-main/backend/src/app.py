"""FastAPI application factory for the Claude proxy server."""

from __future__ import annotations

import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.routes import register_routes
from src.constants import file_names
from src.settings.settings import Settings
from src.llm.anthropic_llm_client import AnthropicLLMClient
from src.services.prompt_builder import PromptBuilder
from src.services.session_manager import SessionManager, set_session_manager_singleton


LOGGER = logging.getLogger("app")


def create_app() -> FastAPI:
    """FastAPIアプリを構築し、すべての依存関係を束ねます。

    Returns:
        FastAPI: ルーティングやミドルウェアを設定済みのアプリケーション。
    """
    settings = Settings.load()
    session_manager = SessionManager()
    set_session_manager_singleton(session_manager)
    llm_client = AnthropicLLMClient(  # いずれはymlからとってきてFactoryで振り分ける
        api_key=settings.api_key,
        api_url=settings.api_url,
    )

    app = FastAPI(title="Claude Proxy Server", version="1.0.0")
    _configure_logging()
    _setup_middleware(app)

    # 定義順にルーティング先を走査するため、staticなコンテンツ（"/"は最後に持ってくる必要あり）
    register_routes(app)
    _setup_static_files(app, settings)
    return app


def _configure_logging() -> None:
    """アプリ全体で利用するロギング設定を適用します。"""
    if getattr(_configure_logging, "_configured", False):
        return

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s")

    # プロジェクトルート配下にログディレクトリを強制生成
    project_root = Path(__file__).resolve().parent.parent.parent
    log_dir = project_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "app.log"

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
    )

    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=7,
        encoding="utf-8",
    )
    file_handler.suffix = "%Y%m%d"
    file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)

    _configure_logging._configured = True


def _setup_middleware(app: FastAPI) -> None:
    """CORSとリクエストロギングのミドルウェアを登録します。

    Args:
        app: ミドルウェアを追加するFastAPIインスタンス。

    Returns:
        None: 返り値は使用しません。
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "x-api-key", "anthropic-version"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):  # type: ignore[override]
        """各HTTPリクエストを記録し、後続処理のレスポンスを返します。

        Args:
            request: 受信したHTTPリクエスト。
            call_next: 次のミドルウェアまたはエンドポイントを呼び出すコールバック。

        Returns:
            Response: 下流の処理から返却されるFastAPIレスポンス。
        """
        LOGGER.info("%s %s", request.method, request.url.path)
        response = await call_next(request)
        return response


def _setup_static_files(app: FastAPI, settings: Settings) -> None:
    """静的ファイルを /static パスで提供します。"""
    static_dir = settings.base_dir / file_names.STATIC_DIR
    if not static_dir.exists():
        LOGGER.warning("Static directory not found: %s", static_dir)
        return
    # app.mount("/", StaticFiles(directory=static_dir), name="static")
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = Settings.load()
    uvicorn.run(app, host="0.0.0.0", port=settings.port, log_level="info")
