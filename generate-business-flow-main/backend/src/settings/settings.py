"""Application settings and helpers."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from src.constants import file_names
from src.settings.env import load_env_file


LOGGER = logging.getLogger("core.settings")


SRC_DIR = Path(__file__).resolve().parent.parent
ANTHROPIC_CONFIG_FILE = "anthropic_llm_config.yaml"


@dataclass
class Settings:
    """アプリ稼働に必要な設定をまとめるデータクラス。"""

    port: int
    api_key: str
    base_dir: Path
    flow_prompt_path: Path
    flow_modification_prompt_path: Path
    api_url: str = "https://api.anthropic.com/v1/messages"

    @classmethod
    def load(cls) -> "Settings":
        """環境変数と.envを読み込み、設定インスタンスを生成します。

        Returns:
            Settings: APIキーやポート情報を含む設定オブジェクト。

        Raises:
            RuntimeError: CLAUDE_API_KEYが設定されていない場合。
        """
        load_env_file(SRC_DIR / ".env")

        api_key = os.getenv("CLAUDE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "CLAUDE_API_KEY is not set. Define it in .env or the process environment."
            )

        port = int(os.getenv("PORT", "3002"))

        return cls(
            port=port,
            api_key=api_key,
            base_dir=SRC_DIR,
            flow_prompt_path=SRC_DIR / file_names.PROMPTS_DIR / file_names.FLOW_PROMPT_TEMPLATE,
            flow_modification_prompt_path=SRC_DIR
            / file_names.PROMPTS_DIR
            / file_names.FLOW_MODIFICATION_PROMPT_TEMPLATE,
        )

    def read_flow_prompt(self) -> Optional[str]:
        """FlowGenerationPrompt.mdからプロンプトテンプレートを読み込みます。

        Returns:
            Optional[str]: 読み込んだファイルの文字列。失敗時はNone。
        """
        try:
            return self.flow_prompt_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            LOGGER.warning(
                "%s not found: %s", file_names.FLOW_PROMPT_TEMPLATE, self.flow_prompt_path
            )
            return None
        except OSError as exc:
            LOGGER.error("Failed to read %s: %s", file_names.FLOW_PROMPT_TEMPLATE, exc)
            return None

    def read_flow_modification_prompt(self) -> Optional[str]:
        """FlowModificationPrompt.mdから修正用プロンプトテンプレートを読み込みます。

        Returns:
            Optional[str]: 読み込んだファイルの文字列。失敗時はNone。
        """
        try:
            return self.flow_modification_prompt_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            LOGGER.warning(
                "%s not found: %s",
                file_names.FLOW_MODIFICATION_PROMPT_TEMPLATE,
                self.flow_modification_prompt_path,
            )
            return None
        except OSError as exc:
            LOGGER.error("Failed to read %s: %s", file_names.FLOW_MODIFICATION_PROMPT_TEMPLATE, exc)
            return None

    @property
    def demo_ui_path(self) -> Path:
        """デモUI HTMLファイルの絶対パスを返します。

        Returns:
            Path: `index.html` のパス。
        """
        return self.base_dir / file_names.STATIC_DIR / file_names.DEMO_UI_HTML


@dataclass(frozen=True)
class AnthropicModelConfig:
    """Anthropic向けのモデル設定。"""

    model: str
    max_tokens: int


@lru_cache(maxsize=1)
def load_anthropic_model_config(
    config_path: Optional[Path] = None, vendor: str = "claude"
) -> AnthropicModelConfig:
    """Anthropic LLMクライアントの設定をYAMLから読み込みます。

    Args:
        config_path: 明示的な設定ファイルパス。省略時はcoreディレクトリ内を参照。
        vendor: 取得したいベンダー識別子。デフォルトはClaude。

    Returns:
        AnthropicModelConfig: モデル名とmax_tokensを含む設定。

    Raises:
        RuntimeError: 読み込みやバリデーションに失敗した場合。
    """
    path = config_path or (SRC_DIR / file_names.CORE_DIR / ANTHROPIC_CONFIG_FILE)
    try:
        with path.open("r", encoding="utf-8") as stream:
            data = yaml.safe_load(stream) or {}
    except FileNotFoundError as exc:
        LOGGER.error("Anthropic config file not found: %s", path)
        raise RuntimeError(f"Anthropic config file not found: {path}") from exc
    except OSError as exc:  # pragma: no cover - filesystem errors are unexpected
        LOGGER.error("Failed to read Anthropic config file %s: %s", path, exc)
        raise RuntimeError(f"Failed to read Anthropic config file: {path}") from exc
    except yaml.YAMLError as exc:
        LOGGER.error("Invalid YAML in Anthropic config: %s", exc)
        raise RuntimeError("Failed to parse Anthropic config YAML.") from exc

    if not isinstance(data, dict):
        LOGGER.error("Anthropic config must be a mapping. Got: %s", type(data))
        raise RuntimeError("Anthropic config must be a mapping of vendor keys to values.")

    vendor_key = vendor.strip().lower()
    vendor_config = data.get(vendor_key)
    if not isinstance(vendor_config, dict):
        LOGGER.error("Anthropic config for vendor '%s' is missing or invalid.", vendor_key)
        raise RuntimeError(f"Anthropic config for vendor '{vendor}' is missing or invalid.")

    model = vendor_config.get("model")
    max_tokens = vendor_config.get("max_tokens")

    if not isinstance(model, str) or not model.strip():
        raise RuntimeError("Anthropic config 'model' must be a non-empty string.")
    if not isinstance(max_tokens, int):
        raise RuntimeError("Anthropic config 'max_tokens' must be an integer.")

    return AnthropicModelConfig(model=model.strip(), max_tokens=max_tokens)
