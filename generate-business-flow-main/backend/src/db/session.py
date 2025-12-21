"""SQLAlchemyによるDB接続とセッション管理の最小ユーティリティ。"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from src.settings.env import load_env_file


PROJECT_ROOT = Path(__file__).resolve().parents[3]
Base = declarative_base()


@lru_cache(maxsize=1)
def _load_env() -> None:
    # ルートとbackend配下の.envを一度だけ読み込む
    """環境変数をロードして再読込を防止します。"""

    load_env_file(PROJECT_ROOT / ".env")


def _build_database_url() -> str:
    # docker-composeのpostgresサービスに接続するURLを構築する
    """環境変数からDATABASE_URLを決定します。

    Returns:
        str: SQLAlchemyが利用する接続URL。

    Raises:
        RuntimeError: 必要な情報が不足している場合。
    """

    _load_env()
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "bit_flow")

    if not user or not host or not db_name:
        raise RuntimeError(
            "DATABASE_URLもしくはPOSTGRES_*環境変数が設定されていません。"
        )

    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{db_name}"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    # DATABASE_URLを解決してEngineをシングルトンで返す
    """DATABASE_URLを基にSQLAlchemyのEngineを生成します。

    Returns:
        Engine: 接続済みのSQLAlchemyエンジン。

    Raises:
        RuntimeError: 接続先URLが決定できない場合。
    """

    database_url = _build_database_url()
    return create_engine(database_url, future=True)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    # Engineに紐づくセッションファクトリを遅延生成する
    """EngineにバインドされたSessionファクトリを返します。

    Returns:
        sessionmaker[Session]: セッション生成用のファクトリ。
    """

    engine = get_engine()
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db_session() -> Iterator[Session]:
    # FastAPIのDependsなどで使えるセッション提供ジェネレータ
    """コンテキストマネージャ形式でDBセッションを提供します。

    Yields:
        Session: 呼び出し元が利用するDBセッション。
    """

    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
