"""任意SQLを簡易実行するスクリプト。"""

from __future__ import annotations

import sys
from typing import List, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Row

from src.db import get_db_session


def execute_raw_sql(sql: str) -> List[Tuple]:
    # 任意のSQLを実行し、結果セットをタプルのリストで返す
    """任意SQLを実行し、結果を返します。

    Args:
        sql: 実行するSQL文字列。

    Returns:
        List[Tuple]: SELECT系の場合は結果の行リスト、更新系の場合は空リスト。
    """

    for session in get_db_session():
        result = session.execute(text(sql))
        if result.returns_rows:
            rows: List[Row] = result.fetchall()
            return [tuple(row) for row in rows]
        session.commit()
        return []


def main(args: list[str]) -> int:
    # CLIエントリーポイント。最初の引数をSQLとして実行する
    """CLIからSQLを受け取り、実行します。

    Args:
        args: コマンドライン引数リスト。

    Returns:
        int: 正常終了は0、引数不足は1。
    """

    if len(args) < 2:
        print("Usage: python -m src.db.run_sql \"SELECT 1\"")
        return 1

    sql = args[1]
    rows = execute_raw_sql(sql)
    for row in rows:
        print(row)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
