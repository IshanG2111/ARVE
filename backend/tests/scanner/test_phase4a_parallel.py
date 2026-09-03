"""Phase 4A registry tests for the parallel OSV + Gitleaks path."""

from app.core.config import settings
from app.scanner.parallel import build_security_registry


def test_security_registry_contains_osv_and_gitleaks(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", True)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", True)

    engines = build_security_registry().list()
    assert [engine.name for engine in engines] == ["osv", "gitleaks"]


def test_security_registry_allows_gitleaks_without_osv(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", True)

    engines = build_security_registry().list()
    assert [engine.name for engine in engines] == ["gitleaks"]


def test_security_registry_allows_osv_without_gitleaks(monkeypatch):
    monkeypatch.setattr(settings, "SCANNER_ENABLE_TEST_ENGINE", False)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_OSV", True)
    monkeypatch.setattr(settings, "SCANNER_ENABLE_GITLEAKS", False)

    engines = build_security_registry().list()
    assert [engine.name for engine in engines] == ["osv"]
