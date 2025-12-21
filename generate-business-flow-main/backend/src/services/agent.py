"""Flow generation agent service orchestrated by LangGraph."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, Optional, TypedDict

from langgraph.graph import START, StateGraph, END
from langgraph.pregel import Pregel

from src.llm.base_llm_client import BaseLLMClient
from src.schemas.requests import LLMMessageRequest
from src.services.prompt_builder import PromptBuilder
from src.services.session_manager import get_session_manager_singleton, SessionManager
from src.settings.settings import Settings
from src.llm.anthropic_llm_client import AnthropicLLMClient

LOGGER = logging.getLogger("services.agent")


@dataclass(frozen=True)
class FlowAgentResult:
    """エージェント処理の結果コンテナ。"""

    streaming: bool
    stream: Optional[AsyncGenerator[bytes, None]] = None
    headers: Optional[Dict[str, str]] = None
    body: Optional[Dict[str, Any]] = None


class FlowAgentState(TypedDict, total=False):
    """LangGraph上で共有する状態を定義します。"""

    user_prompt: str
    generator: AsyncGenerator[bytes, None]


class FlowAgent:
    """LangGraphを利用してフロー生成処理を管理するAIエージェント。"""

    def __init__(
        self,
        session_id: str,
        user_prompt: str
    ) -> None:
        """セッション管理・プロンプトビルダー・LLMクライアントを受け取り初期化します。

        Args:
            session_manager: セッション状態とdrawioキャッシュを扱うマネージャ。
            prompt_builder: system promptをレンダリングするビルダー。
            llm_client: Claude APIへアクセスするクライアント。
        """
        self.session_id = session_id
        self.user_prompt = user_prompt
        self.session_manager = get_session_manager_singleton()
    
    async def set_parameter(self):
        self.settings = Settings.load()
        self.prompt_builder = PromptBuilder(
            self.settings.read_flow_prompt(),
            self.settings.read_flow_modification_prompt(),
        )
        self.is_first, self.previous_drawio = await self.session_manager.register_request(self.session_id)
        self.system_prompt = self.prompt_builder.build_prompt(self.is_first, self.previous_drawio, self.session_id)
        self.client = AnthropicLLMClient(
            api_key=self.settings.api_key,
            api_url=self.settings.api_url,
        )
        LOGGER.info(f"self.is_first: {self.is_first}")

    async def handle_flow_request(
        self,
        session_id: str,
        payload: LLMMessageRequest,
    ) -> FlowAgentResult:
        """flows APIのペイロードを受け取り、LangGraphでLLM処理を実行します。

        Args:
            session_id: ルーターのパスから渡されるセッションID。
            payload: `/sessions/{session_id}/flows` のJSONボディ。

        Returns:
            FlowAgentResult: ストリーミング有無に応じた結果情報。

        Raises:
            ValueError: セッションIDまたはプロンプトが空の場合。
        """
        graph = self._graph or self.create_graph()
        self._graph = graph
        result_state = await graph.ainvoke({"raw_session_id": session_id, "payload": payload})
        agent_result = result_state.get("result")
        if not agent_result:
            raise RuntimeError("FlowAgent result state is missing.")
        return agent_result

    def create_graph(self) -> Pregel:
        """LangGraphの状態遷移を構築します。

        Returns:
            Pregel: コンパイル済みのグラフ。
        """
        workflow = StateGraph(FlowAgentState)

        # workflow.add_node("normalize_input", self._normalize_input)
        # workflow.add_node("prepare_prompt", self._prepare_prompt)
        workflow.add_node("execute_request", self._execute_request)
        workflow.add_node("finalize_result", self._finalize_result)

        workflow.add_edge(START, "execute_request")
        workflow.add_edge("execute_request", "finalize_result")
        workflow.add_edge("finalize_result", END)

        return workflow.compile()

    def _normalize_input(self, state: FlowAgentState) -> Dict[str, Any]:
        """セッションIDとプロンプトを検証し正規化します。

        Args:
            state: LangGraph上の現在状態。

        Returns:
            dict: 正規化された入力情報。

        Raises:
            ValueError: 必須パラメータが欠落している場合。
        """
        raw_session_id = (state.get("raw_session_id") or "").strip()
        if not raw_session_id:
            raise ValueError("セッションIDが指定されていません。")

        payload = state.get("payload")
        if not payload:
            raise ValueError("payloadが提供されていません。")

        user_prompt = (payload.user_prompt or "").strip()
        if not user_prompt:
            raise ValueError("ユーザープロンプトが指定されていません。")

        streaming = True if payload.streaming is None else bool(payload.streaming)
        LOGGER.info(
            "FlowAgent normalize step session=%s streaming=%s",
            raw_session_id,
            streaming,
        )
        return {
            "normalized_session_id": raw_session_id,
            "user_prompt": user_prompt,
            "streaming": streaming,
        }

    async def _prepare_prompt(self, state: FlowAgentState) -> Dict[str, Any]:
        """セッション情報を更新しsystem promptを構築します。

        Args:
            state: LangGraph上の現在状態。

        Returns:
            dict: プロンプト構築結果。
        """
        session_id = state["normalized_session_id"]
        is_first, previous_drawio = await self._session_manager.register_request(session_id)
        system_prompt = self._prompt_builder.build_prompt(is_first, previous_drawio, session_id)
        LOGGER.info(
            "FlowAgent prepare_prompt session=%s first=%s",
            session_id,
            is_first,
        )
        return {
            "is_first_request": is_first,
            "previous_drawio": previous_drawio,
            "system_prompt": system_prompt,
        }

    async def _execute_request(self, state: FlowAgentState) -> Dict[str, Any]:
        """LLMクライアントを呼び出し、結果を状態に反映します。

        Args:
            state: LangGraph上の現在状態。

        Returns:
            dict: LLM呼び出しの結果。
        """
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
        LOGGER.info("FlowAgent execute_request streaming session=%s", self.session_id)
        generator = self.client.stream_message(
            self.system_prompt,
            self.user_prompt,
            self.session_id,
            cache_drawio=self.session_manager.cache_drawio_if_present,
        )
        return {"generator": generator}

    def _finalize_result(self, state: FlowAgentState) -> Dict[str, FlowAgentResult]:
        """LangGraph結果からFlowAgentResultを生成します。

        Args:
            state: LangGraph上の現在状態。

        Returns:
            dict: FlowAgentResultを含む辞書。
        """
        pass


async def define_flow_agent(
    session_id: str,
    user_prompt: str
) -> Pregel:
    """LangGraphを構築して実行し、FlowAgentResultを返すエントリーポイント。

    Args:
        session_id: セッション識別子。
        payload: `/sessions/{session_id}/flows` のリクエストボディ。

    Returns:
        Pregel: コンパイル済みのオブジェクト。
    """
    agent = FlowAgent(session_id, user_prompt)
    await agent.set_parameter()
    return agent.create_graph()
