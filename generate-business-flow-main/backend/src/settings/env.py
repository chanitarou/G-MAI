"""Environment helpers for the Claude proxy."""

from __future__ import annotations

import os
from pathlib import Path


def load_env_file(env_file: Path) -> None:
    """依存ライブラリなしで簡易的に.envを読み込みます。

    Args:
        env_file: 読み込む.envファイルのパス。

    Returns:
        None: 返り値は使用しません。
    """

    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]

        if key and key not in os.environ:
            os.environ[key] = value
