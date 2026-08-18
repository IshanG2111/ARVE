"""Persistent scan lifecycle state machine."""
from __future__ import annotations

from enum import Enum

from app.scanner.exceptions import ScanStateTransitionError


class ScanStatus(str, Enum):
    QUEUED = "QUEUED"
    INGESTING = "INGESTING"
    SCANNING = "SCANNING"
    NORMALIZING = "NORMALIZING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


_ALLOWED: dict[ScanStatus, set[ScanStatus]] = {
    ScanStatus.QUEUED: {ScanStatus.INGESTING, ScanStatus.FAILED, ScanStatus.CANCELLED},
    ScanStatus.INGESTING: {ScanStatus.SCANNING, ScanStatus.FAILED, ScanStatus.CANCELLED},
    ScanStatus.SCANNING: {
        ScanStatus.NORMALIZING,
        ScanStatus.PARTIAL,
        ScanStatus.FAILED,
        ScanStatus.CANCELLED,
    },
    ScanStatus.NORMALIZING: {ScanStatus.COMPLETED, ScanStatus.PARTIAL, ScanStatus.FAILED, ScanStatus.CANCELLED},
    ScanStatus.COMPLETED: set(),
    ScanStatus.PARTIAL: set(),
    ScanStatus.FAILED: set(),
    ScanStatus.CANCELLED: set(),
}


class ScanStateMachine:
    @staticmethod
    def normalize(status: str | ScanStatus) -> ScanStatus:
        try:
            return status if isinstance(status, ScanStatus) else ScanStatus(status.upper())
        except ValueError as exc:
            raise ScanStateTransitionError(f"Unknown scan status: {status}") from exc

    @classmethod
    def can_transition(cls, current: str | ScanStatus, target: str | ScanStatus) -> bool:
        current_status = cls.normalize(current)
        target_status = cls.normalize(target)
        return target_status in _ALLOWED[current_status]

    @classmethod
    def transition(cls, current: str | ScanStatus, target: str | ScanStatus) -> ScanStatus:
        current_status = cls.normalize(current)
        target_status = cls.normalize(target)
        if not cls.can_transition(current_status, target_status):
            raise ScanStateTransitionError(
                f"Invalid scan transition: {current_status.value} -> {target_status.value}"
            )
        return target_status
