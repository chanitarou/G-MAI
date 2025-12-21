"""Abstract base class for LLM client implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict


CacheCallback = Callable[[str, str], Awaitable[None]]


class BaseLLMClient(ABC):
    """共通LLMクライアントインターフェース。"""

    @abstractmethod
    async def send_message(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """LLMへ非ストリーミングでリクエストを送信する。"""

    @abstractmethod
    def stream_message(
        self,
        system_prompt: str,
        user_prompt: str,
        session_id: str,
        cache_drawio: CacheCallback,
    ) -> AsyncGenerator[bytes, None]:
        """LLMからのストリーム結果を生成する。"""
