"""Prompt construction helpers."""

from __future__ import annotations

import logging
from typing import Optional

from jinja2 import Template

LOGGER = logging.getLogger("services.prompt_builder")


class PromptBuilder:
    """ユーザー入力からClaude向けの最終プロンプトを生成するヘルパー。"""

    def __init__(
        self,
        flow_generation_prompt: Optional[str],
        flow_modification_prompt: Optional[str],
    ) -> None:
        """FlowGenerationPromptとFlowModificationPromptテンプレートを保持します。

        Args:
            flow_generation_prompt: FlowGenerationPrompt.mdの内容。読み込めない場合はNone。
            flow_modification_prompt: FlowModificationPrompt.mdの内容。読み込めない場合はNone。
        """
        self.flow_generation_prompt = flow_generation_prompt
        self.flow_modification_prompt = flow_modification_prompt
        self.generation_template = (
            Template(flow_generation_prompt) if flow_generation_prompt else None
        )
        self.modification_template = (
            Template(flow_modification_prompt) if flow_modification_prompt else None
        )

    def build_prompt(
        self, is_first_request: bool, previous_drawio: Optional[str], session_id: str
    ) -> str:
        """セッション状態に応じたsystem promptのみを構築します。

        Args:
            user_prompt: ユーザーからの要求文。
            is_first_request: 初回リクエストかどうか。
            previous_drawio: 直前に生成したdrawio文字列。
            session_id: セッション識別子。ログ出力に使用。

        Returns:
            str: Claudeへ送信するプロンプト。
        """
        if is_first_request:
            return self._build_full_prompt()
        return self._build_modification_prompt(previous_drawio, session_id)

    def _build_full_prompt(self) -> str:
        """初回リクエスト用にFlowGenerationPromptを組み合わせたsystem promptを作成します。"""
        if not self.generation_template:
            LOGGER.error("FlowGenerationPrompt.md is not loaded")
            raise Exception("FlowGenerationPrompt.md not found.")

        # テンプレートのレンダリング（現時点では変数なし）
        rendered = self.generation_template.render()
        LOGGER.info("FlowGenerationPrompt rendered: %d chars", len(rendered))
        return rendered

    def _build_modification_prompt(self, previous_drawio: Optional[str], session_id: str) -> str:
        """既存drawioを基に修正指示を反映させるプロンプトを生成します。

        Args:
            previous_drawio: 修正対象となる直前のdrawioコード。
            session_id: キャッシュ未命中時のログ出力に使用するID。

        Returns:
            str: 修正内容を反映したプロンプト。
        """
        if not previous_drawio:
            LOGGER.warning(
                "Previous drawio for session %s not found. Falling back to full prompt.",
                session_id,
            )
            return self._build_full_prompt()

        if not self.modification_template:
            LOGGER.error("FlowModificationPrompt.md is not loaded for session %s", session_id)
            raise Exception("FlowModificationPrompt.md not found.")

        return self.modification_template.render(previous_drawio=previous_drawio)
