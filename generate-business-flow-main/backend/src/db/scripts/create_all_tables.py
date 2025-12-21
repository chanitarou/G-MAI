"""テーブル作成処理をまとめたスクリプトモジュール。"""

from __future__ import annotations

from sqlalchemy.engine import Engine

from src.db.session import Base, get_engine


def create_all_tables(engine: Engine | None = None) -> None:
    # Base.metadata.create_allをラップし、サンプル定義をまとめて作成する
    """接続先データベースに存在しないテーブルを作成します。

    Args:
        engine: 使用するSQLAlchemy Engine。未指定時はデフォルト接続を利用。
    """

    target_engine = engine or get_engine()
    Base.metadata.create_all(target_engine)
