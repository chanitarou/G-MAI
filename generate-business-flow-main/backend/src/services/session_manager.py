"""Session tracking for prompts and drawio cache."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple


LOGGER = logging.getLogger("services.session_manager")
_SESSION_MANAGER_SINGLETON: Optional["SessionManager"] = None


class SessionManager:
    """セッションごとのリクエスト状態とdrawioキャッシュを管理します。"""

    def __init__(self) -> None:
        """セッション状態とキャッシュ用のストレージを初期化します。"""
        self._session_data: Dict[str, Dict[str, object]] = {}
        self._drawio_cache: Dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def register_request(self, session_id: str) -> Tuple[bool, Optional[str]]:
        """セッションのリクエスト情報を更新し、前回のdrawioを取得します。

        Args:
            session_id: セッション識別子。

        Returns:
            Tuple[bool, Optional[str]]: (初回フラグ, 前回キャッシュしたdrawio)。
        """
        async with self._lock:
            state = self._session_data.setdefault(
                session_id,
                {
                    "isFirstRequest": True,
                    "requestCount": 0,
                    "lastRequestTime": datetime.now(timezone.utc).isoformat(),
                },
            )

            state["requestCount"] = int(state["requestCount"]) + 1  # type: ignore[arg-type]
            state["lastRequestTime"] = datetime.now(timezone.utc).isoformat()

            is_first_request = bool(state["isFirstRequest"])
            if is_first_request:
                state["isFirstRequest"] = False

            previous_drawio = self._drawio_cache.get(session_id)

        LOGGER.info(
            "Session %s: requestCount=%s first=%s",
            session_id,
            state["requestCount"],
            is_first_request,
        )
        # print(is_first_request)
        # import sys
        # sys.exit()
        return is_first_request, previous_drawio

    async def cache_drawio_if_present(self, session_id: str, content: str) -> None:
        """レスポンスにdrawioが含まれる場合のみキャッシュへ保存します。

        Args:
            session_id: キャッシュに紐づけるセッションID。
            content: Claudeレスポンス本文。

        Returns:
            None: 返り値は使用しません。
        """
        drawio = self._extract_drawio(content)
        if not drawio:
            return

        async with self._lock:
            self._drawio_cache[session_id] = drawio

        LOGGER.info("Cached drawio for session %s", session_id)

    @staticmethod
    def _extract_drawio(content: str) -> Optional[str]:
        """テキストからdrawioのXML断片を抽出します。

        Args:
            content: Claudeレスポンス全文。

        Returns:
            Optional[str]: 抽出したdrawioコード。該当しない場合はNone。
        """
        if not content:
            return None
        match = re.search(r"<\?xml[\s\S]*?</mxfile>|<mxfile[\s\S]*?</mxfile>", content)
        return match.group(0) if match else None


def set_session_manager_singleton(manager: SessionManager) -> None:
    """create_appで生成したSessionManagerインスタンスを共有レジストリに登録。"""
    global _SESSION_MANAGER_SINGLETON
    _SESSION_MANAGER_SINGLETON = manager


def get_session_manager_singleton() -> SessionManager:
    """登録済みのSessionManagerを返却し、未登録なら新規生成する。"""
    global _SESSION_MANAGER_SINGLETON
    if _SESSION_MANAGER_SINGLETON is None:
        _SESSION_MANAGER_SINGLETON = SessionManager()
    return _SESSION_MANAGER_SINGLETON
