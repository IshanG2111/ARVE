class ScanOrchestrationError(Exception):
    """Base exception for scan orchestration failures."""


class ScanValidationError(ScanOrchestrationError):
    """The Phase 2 snapshot cannot be scanned safely."""


class ScanStateTransitionError(ScanOrchestrationError):
    """An invalid scan lifecycle transition was requested."""


class ScannerExecutionError(ScanOrchestrationError):
    """The scanner infrastructure could not execute an engine."""
