"""業務フローのセッションテーブル定義。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


class FlowSession(Base):
    """業務フローのセッション情報を保持するエンティティ。"""

    __tablename__ = "flow_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    requests: Mapped[list["FlowRequest"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
