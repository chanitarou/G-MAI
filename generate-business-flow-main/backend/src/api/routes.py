"""FastAPI route registrations."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from src.constants import file_names
from src.settings.settings import Settings
from src.llm.base_llm_client import BaseLLMClient
from src.schemas.requests import LLMBatchRequest, LLMMessageRequest
from src.services.agent import define_flow_agent
from src.services.prompt_builder import PromptBuilder
from src.services.session_manager import SessionManager


def register_routes(
    app: FastAPI
) -> None:
    """FastAPIアプリへAPIルート群を登録します。

    Args:
        app: ルータを取り付けるFastAPIインスタンス。

    Returns:
        None: 返り値は使用しません。
    """
    router = APIRouter()
    logger = logging.getLogger(__name__)

    async def wrap_stream_with_logging(stream):
        """ストリームレスポンスをログへ書き込みつつ透過的に返却します。

        Args:
            stream: LLMから受け取るストリームジェネレーター。

        Yields:
            Any: ストリーミングされたチャンク。
        """
        async for chunk in stream:
            logger.info("stream_response_chunk: %s", chunk)
            yield chunk

    @router.get("/health")
    async def health_check():
        """APIの稼働状況を返却します。

        Returns:
            dict: 稼働ステータスとタイムスタンプを含む情報。
        """
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "LLM Proxy Server",
        }

    @router.put("/sessions/{session_id}/flows")
    async def llm_messages(session_id: str, payload: LLMMessageRequest):
        """業務フロー生成を実行し、結果をストリーミングで返すエンドポイントです。

        Args:
            session_id: パスで指定されたセッションID。
            payload: プロンプト・セッション・ストリーミング指定を含むリクエスト。

        Returns:
            Response: ストリーミング時はStreamingResponse、非ストリーミング時はJSONResponse。

        Raises:
            HTTPException: プロンプトが空の場合に400エラーを送出。
        """

        user_prompt = (payload.user_prompt or "").strip()
        logger.info("llm_messages payload: %s", user_prompt)

        if not user_prompt:
            raise HTTPException(status_code=400, detail="プロンプトが必要です")

        if not session_id or not session_id.strip():
            raise HTTPException(status_code=400, detail="session_id path parameter is required")
        session_id = session_id.strip()

        use_agent_mode = bool(payload.use_agent_mode)
        logger.info(session_id, use_agent_mode)

        if use_agent_mode:
            agent_graph = await define_flow_agent(
                session_id,
                user_prompt,
            )
            initial_state = {
                "user_prompt": user_prompt,
            }
            state = await agent_graph.ainvoke(initial_state)
            stream = state.get("generator")
            if stream is None:
                raise HTTPException(status_code=500, detail="エージェントがストリームを返しませんでした")

            headers = {
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
            }
            return StreamingResponse(
                wrap_stream_with_logging(stream),
                media_type="text/plain; charset=utf-8",
                headers=headers,
            )
        
        else:
            pass
            # streaming = True if payload.streaming is None else payload.streaming

            # is_first, previous_drawio = await session_manager.register_request(session_id)
            # system_prompt = prompt_builder.build_prompt(is_first, previous_drawio, session_id)

            # if streaming:
            #     generator = llm_client.stream_message(
            #         system_prompt,
            #         user_prompt,
            #         session_id,
            #         cache_drawio=session_manager.cache_drawio_if_present,
            #     )
            #     headers = {
            #         "Cache-Control": "no-cache",
            #         "Connection": "keep-alive",
            #         "Access-Control-Allow-Origin": "*",
            #     }
            #     return StreamingResponse(
            #         generator,
            #         media_type="text/plain; charset=utf-8",
            #         headers=headers,
            #     )

            # result = await llm_client.send_message(system_prompt, user_prompt)
            # content = result.get("content", "")
            # if content:
            #     await session_manager.cache_drawio_if_present(session_id, content)

            # return JSONResponse({**result, "actualPrompt": system_prompt})

    # @router.post("/api/llm/messages-batch")
    # async def llm_messages_batch(payload: LLMBatchRequest):
    #     """バッチモードでLLMメッセージを生成します。

    #     Args:
    #         payload: プロンプトとセッションIDを含むリクエスト。

    #     Returns:
    #         JSONResponse: LLM APIからの結果をまとめたJSONレスポンス。

    #     Raises:
    #         HTTPException: プロンプトが空の場合に400エラーを送出。
    #     """
    #     logger.info("llm_messages_batch payload: %s", payload.dict())
    #     user_prompt = (payload.user_prompt or "").strip()
    #     if not user_prompt:
    #         raise HTTPException(status_code=400, detail="プロンプトが必要です")

    #     session_id = (payload.sessionId or "default").strip() or "default"
    #     is_first, previous_drawio = await session_manager.register_request(session_id)
    #     system_prompt = prompt_builder.build_prompt(user_prompt, is_first, previous_drawio, session_id)

    #     result = await llm_client.send_message(system_prompt, user_prompt)
    #     content = result.get("content", "")
    #     if content:
    #         await session_manager.cache_drawio_if_present(session_id, content)

    #     return JSONResponse({**result, "actualPrompt": user_prompt})

    # @router.get("/")
    # async def root():
    #     """デモUIのHTMLを返却します。

    #     Returns:
    #         FileResponse: index.html のファイルレスポンス。

    #     Raises:
    #         HTTPException: UIファイルが存在しない場合に404エラーを送出。
    #     """
    #     demo_path = settings.demo_ui_path
    #     if not demo_path.exists():
    #         raise HTTPException(status_code=404, detail=f"{file_names.DEMO_UI_HTML} が見つかりません")
    #     return FileResponse(demo_path)

    app.include_router(router)
