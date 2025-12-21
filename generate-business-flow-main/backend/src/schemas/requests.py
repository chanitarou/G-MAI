"""Request schemas for API endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class LLMMessageRequest(BaseModel):
    """ストリーミングメッセージエンドポイントの入力スキーマ。"""

    user_prompt: str
    streaming: Optional[bool] = True
    use_agent_mode: Optional[bool] = False


class LLMBatchRequest(BaseModel):
    """バッチメッセージエンドポイントの入力スキーマ。"""

    user_prompt: str
    sessionId: Optional[str] = "default"
