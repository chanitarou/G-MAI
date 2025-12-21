"""Client wrapper for Anthropic's Claude Messages API."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict

import httpx

from src.settings.settings import AnthropicModelConfig, load_anthropic_model_config

from .base_llm_client import BaseLLMClient, CacheCallback

LOGGER = logging.getLogger("llm.anthropic_llm_client")


class AnthropicLLMClient(BaseLLMClient):
    """Anthropic Claude APIとの通信を扱う非同期クライアント。"""

    def __init__(
        self,
        api_key: str,
        api_url: str,
        chunk_timeout: int = 120,
    ) -> None:
        """クライアントを初期化します。

        Args:
            api_key: Claude APIへ送信する認証キー。
            api_url: メッセージエンドポイントのURL。
            chunk_timeout: ストリームチャンクの最大待機秒数。
        """
        self.api_key = api_key
        self.api_url = api_url
        self.chunk_timeout = chunk_timeout
        self.model_config: AnthropicModelConfig = load_anthropic_model_config()
        self.http_timeout = httpx.Timeout(
            timeout=None,
            connect=30.0,
            read=chunk_timeout + 30.0,
            write=30.0,
            pool=30.0,
        )

    async def send_message(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """ストリーミングを使わずにClaudeメッセージを送信します。

        Args:
            system_prompt: Claudeへ渡すシステムインストラクション。
            user_prompt: ユーザーからの要求文（添付含む）。

        Returns:
            Dict[str, Any]: コンテンツ本文と使用量を含む結果。

        Raises:
            RuntimeError: HTTPエラーやAPI異常応答が発生した場合。
        """
        payload = self._build_payload(system_prompt, user_prompt, stream=False)
        headers = self._build_headers()

        LOGGER.info(payload)

        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            response = await client.post(self.api_url, headers=headers, json=payload)

        if response.is_error:
            raise RuntimeError(f"HTTP {response.status_code}: {response.text}")

        data = response.json()
        content = ""
        if data.get("content"):
            segment = data["content"][0]
            content = segment.get("text", "")

        LOGGER.info(
            "Claude API Success: usage=%s content_len=%s",
            data.get("usage"),
            len(content),
        )

        return {
            "content": content,
            "usage": data.get("usage"),
            "success": True,
        }

    def stream_message(
        self,
        system_prompt: str,
        user_prompt: str,
        session_id: str,
        cache_drawio: CacheCallback,
    ) -> AsyncGenerator[bytes, None]:
        """Claude APIへストリーミング要求を送り、チャンクを返します。

        Args:
            system_prompt: Claudeへ渡すシステムインストラクション。
            user_prompt: ユーザーからの要求文。
            session_id: キャッシュに紐づくセッションID。
            cache_drawio: drawioテキストを保存する非同期コールバック。

        Returns:
            AsyncGenerator[bytes, None]: 改行区切りJSONをバイト列で返すジェネレーター。
        """

        async def generator() -> AsyncGenerator[bytes, None]:
            """Anthropicのストリームを読み取り、イベントを順次yieldします。

            Returns:
                AsyncGenerator[bytes, None]: 呼び出し側へ送るストリームジェネレーター。
            """
            payload = self._build_payload(system_prompt, user_prompt, stream=True)
            headers = self._build_headers()

            chunk_count = 0
            full_content_parts: list[str] = []
            complete_event_sent = False
            error_occurred = False

            yield self._format_chunk(
                {
                    "type": "start",
                    "message": "Claude API ストリーミング開始",
                }
            )

            try:
                async with httpx.AsyncClient(timeout=self.http_timeout) as client:
                    async with client.stream(
                        "POST", self.api_url, headers=headers, json=payload
                    ) as response:
                        if response.is_error:
                            error_text = await response.aread()
                            raise RuntimeError(
                                f"HTTP {response.status_code}: {error_text.decode('utf-8', errors='replace')}"
                            )

                        lines = response.aiter_lines()
                        while True:
                            try:
                                line = await asyncio.wait_for(
                                    lines.__anext__(), timeout=self.chunk_timeout
                                )
                            except StopAsyncIteration:
                                break
                            except asyncio.TimeoutError as exc:
                                raise RuntimeError(
                                    "ストリーミングタイムアウト - 応答が遅すぎます"
                                ) from exc

                            if not line or not line.startswith("data: "):
                                continue

                            data = line[6:]
                            if data == "[DONE]":
                                continue

                            try:
                                parsed = json.loads(data)
                            except json.JSONDecodeError:
                                LOGGER.warning("JSON parse error for line: %s", line)
                                continue

                            if parsed.get("type") == "content_block_delta":
                                text = parsed.get("delta", {}).get("text")
                                if not text:
                                    continue

                                full_content_parts.append(text)
                                chunk_count += 1

                                yield self._format_chunk(
                                    {"type": "content", "text": text, "chunk": chunk_count}
                                )

                                if chunk_count % 10000 == 0:
                                    full_length = sum(len(part) for part in full_content_parts)
                                    LOGGER.info(
                                        "Chunk %s: fullContent length = %s",
                                        chunk_count,
                                        full_length,
                                    )

                            elif parsed.get("type") == "message_start":
                                LOGGER.info("message_start: %s", parsed.get("message"))

                            elif parsed.get("type") == "message_stop":
                                LOGGER.info("message_stop received")
                                complete_event_sent = True
                                full_content = "".join(full_content_parts)
                                if full_content:
                                    await cache_drawio(session_id, full_content)

                                yield self._format_chunk(
                                    {
                                        "type": "complete",
                                        "fullContent": full_content,
                                        "totalChunks": chunk_count,
                                    }
                                )

            except Exception as exc:  # pylint: disable=broad-except
                error_occurred = True
                LOGGER.exception("Streaming error")
                error_message = (
                    "APIとの接続が切断されました。ネットワークを確認して再試行してください。"
                    if "terminated" in str(exc).lower() or "closed" in str(exc).lower()
                    else str(exc)
                )

                content_length = sum(len(part) for part in full_content_parts)
                yield self._format_chunk(
                    {
                        "type": "error",
                        "error": error_message,
                        "details": {
                            "chunkCount": chunk_count,
                            "contentLength": content_length,
                            "partialContent": bool(full_content_parts),
                        },
                    }
                )

            finally:
                if not error_occurred and not complete_event_sent:
                    full_content = "".join(full_content_parts)
                    if full_content:
                        await cache_drawio(session_id, full_content)

                    yield self._format_chunk(
                        {
                            "type": "complete",
                            "fullContent": full_content,
                            "totalChunks": chunk_count,
                        }
                    )

        return generator()

    def _build_payload(self, system_prompt: str, user_prompt: str, stream: bool) -> Dict[str, Any]:
        """Claude APIへ送信するリクエストペイロードを生成します。

        Args:
            system_prompt: Claudeに渡すシステムインストラクション。
            user_prompt: Claudeに渡すユーザーコンテンツ。
            stream: ストリーミング要求かどうか。

        Returns:
            Dict[str, Any]: API仕様に沿った辞書。
        """
        config = self.model_config

        return {
            "model": config.model,
            "max_tokens": config.max_tokens,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": user_prompt,
                }
            ],
            "stream": stream,
        }

    def _build_headers(self) -> Dict[str, str]:
        """HTTPリクエストヘッダーを構築します。

        Returns:
            Dict[str, str]: 認証情報を含むHTTPヘッダー。
        """
        return {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

    def _format_chunk(self, data: Dict[str, Any]) -> bytes:
        """ストリームイベントを改行区切りJSON形式のバイト列へ変換します。

        Args:
            data: クライアントへ送信するイベント辞書。

        Returns:
            bytes: 改行付きJSON文字列をUTF-8でエンコードした値。
        """
        return (json.dumps(data, ensure_ascii=False) + "\n").encode("utf-8")
