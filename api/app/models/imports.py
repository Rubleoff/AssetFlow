from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import ImportRowStatus


class ImportJob(TimestampMixin, Base):
    __tablename__ = "imports"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), default="preview")
    summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class ImportRow(TimestampMixin, Base):
    __tablename__ = "import_rows"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    import_job_id: Mapped[str] = mapped_column(ForeignKey("imports.id"), index=True)
    row_number: Mapped[int] = mapped_column(index=True)
    raw_payload: Mapped[dict] = mapped_column(JSON)
    normalized_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[ImportRowStatus] = mapped_column(default=ImportRowStatus.NEW)
    duplicate_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class ImportConflict(TimestampMixin, Base):
    __tablename__ = "import_conflicts"

    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    import_job_id: Mapped[str] = mapped_column(ForeignKey("imports.id"), index=True)
    import_row_id: Mapped[str] = mapped_column(ForeignKey("import_rows.id"), index=True)
    conflict_type: Mapped[str] = mapped_column(String(100))
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
