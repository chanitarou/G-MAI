"""業務フローのリクエストテーブル定義。"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base

if TYPE_CHECKING:
    from src.db.models.flow_session import FlowSession


class FlowRequest(Base):
    """各リクエストのプロンプトと生成結果を保持するエンティティ。"""

    __tablename__ = "flow_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("flow_sessions.id"), index=True)
    user_prompt: Mapped[str] = mapped_column(Text())
    drawio_xml: Mapped[str | None] = mapped_column(Text(), nullable=True)
    is_initial: Mapped[bool] = mapped_column(Boolean(), default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    session: Mapped["FlowSession"] = relationship(back_populates="requests")
