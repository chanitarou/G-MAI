"""DBテーブル初期化用のスクリプト。"""

from __future__ import annotations

import sys

from sqlalchemy.engine import Engine

from src.db import get_engine
from src.db.scripts.create_all_tables import create_all_tables


def init_tables(engine: Engine | None = None) -> None:
    # Base.metadata.create_allを呼び出して全テーブルを作成する
    """接続先データベースに存在しないテーブルを作成します。

    Args:
        engine: 使用するSQLAlchemy Engine。未指定時はデフォルト接続を利用。
    """

    target_engine = engine or get_engine()
    create_all_tables(target_engine)


def main() -> int:
    # CLIのエントリーポイント
    """テーブル初期化を実行するCLIエントリーポイントです。

    Returns:
        int: 正常終了時は0。
    """

    init_tables()
    print("テーブルの初期化が完了しました。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
