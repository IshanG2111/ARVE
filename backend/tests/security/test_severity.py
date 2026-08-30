"""Unit tests for shared severity taxonomy and normalization."""
import pytest

from app.security.severity import (
    FindingSeverity,
    normalize_cvss_score,
    normalize_severity,
    normalize_textual_severity,
)


class TestCvssNormalization:
    """Test CVSS v3.1 score to FindingSeverity normalization."""

    def test_cvss_critical_band(self):
        assert normalize_cvss_score(10.0) == FindingSeverity.CRITICAL
        assert normalize_cvss_score(9.5) == FindingSeverity.CRITICAL
        assert normalize_cvss_score(9.0) == FindingSeverity.CRITICAL
        assert normalize_cvss_score("9.8") == FindingSeverity.CRITICAL

    def test_cvss_high_band(self):
        assert normalize_cvss_score(8.9) == FindingSeverity.HIGH
        assert normalize_cvss_score(7.5) == FindingSeverity.HIGH
        assert normalize_cvss_score(7.0) == FindingSeverity.HIGH
        assert normalize_cvss_score("7.2") == FindingSeverity.HIGH


    def test_cvss_medium_band(self):
        assert normalize_cvss_score(6.9) == FindingSeverity.MEDIUM
        assert normalize_cvss_score(5.5) == FindingSeverity.MEDIUM
        assert normalize_cvss_score(4.0) == FindingSeverity.MEDIUM
        assert normalize_cvss_score("4.3") == FindingSeverity.MEDIUM

    def test_cvss_low_band(self):
        assert normalize_cvss_score(3.9) == FindingSeverity.LOW
        assert normalize_cvss_score(2.0) == FindingSeverity.LOW
        assert normalize_cvss_score(0.1) == FindingSeverity.LOW
        assert normalize_cvss_score("1.5") == FindingSeverity.LOW

    def test_cvss_info_band(self):
        assert normalize_cvss_score(0.0) == FindingSeverity.INFO
        assert normalize_cvss_score("0.0") == FindingSeverity.INFO

    def test_cvss_invalid_or_missing(self):
        assert normalize_cvss_score(None) == FindingSeverity.MEDIUM
        assert normalize_cvss_score(None, default=FindingSeverity.INFO) == FindingSeverity.INFO
        assert normalize_cvss_score("invalid") == FindingSeverity.MEDIUM
        assert normalize_cvss_score(-5.0) == FindingSeverity.MEDIUM


class TestTextualSeverityNormalization:
    """Test text strings to FindingSeverity normalization."""

    @pytest.mark.parametrize(
        "raw_text,expected",
        [
            ("critical", FindingSeverity.CRITICAL),
            ("CRITICAL", FindingSeverity.CRITICAL),
            ("Crit", FindingSeverity.CRITICAL),
            ("blocker", FindingSeverity.CRITICAL),
            ("p0", FindingSeverity.CRITICAL),
            ("fatal", FindingSeverity.CRITICAL),
            ("high", FindingSeverity.HIGH),
            ("HIGH", FindingSeverity.HIGH),
            ("error", FindingSeverity.HIGH),
            ("ERROR", FindingSeverity.HIGH),
            ("major", FindingSeverity.HIGH),
            ("severe", FindingSeverity.HIGH),
            ("p1", FindingSeverity.HIGH),
            ("medium", FindingSeverity.MEDIUM),
            ("MEDIUM", FindingSeverity.MEDIUM),
            ("moderate", FindingSeverity.MEDIUM),
            ("MODERATE", FindingSeverity.MEDIUM),
            ("mod", FindingSeverity.MEDIUM),
            ("warning", FindingSeverity.MEDIUM),
            ("warn", FindingSeverity.MEDIUM),
            ("p2", FindingSeverity.MEDIUM),
            ("low", FindingSeverity.LOW),
            ("LOW", FindingSeverity.LOW),
            ("minor", FindingSeverity.LOW),
            ("negligible", FindingSeverity.LOW),
            ("p3", FindingSeverity.LOW),
            ("info", FindingSeverity.INFO),
            ("INFO", FindingSeverity.INFO),
            ("informational", FindingSeverity.INFO),
            ("note", FindingSeverity.INFO),
            ("notice", FindingSeverity.INFO),
            ("none", FindingSeverity.INFO),
            ("p4", FindingSeverity.INFO),
        ],
    )
    def test_textual_severity_mappings(self, raw_text, expected):
        assert normalize_textual_severity(raw_text) == expected

    def test_unknown_textual_severity_uses_default(self):
        assert normalize_textual_severity("unknown_level") == FindingSeverity.MEDIUM
        assert normalize_textual_severity("", default=FindingSeverity.INFO) == FindingSeverity.INFO
        assert normalize_textual_severity(None, default=FindingSeverity.LOW) == FindingSeverity.LOW


class TestNormalizeSeverityUnified:
    """Test polymorphic normalize_severity helper."""

    def test_with_enum_instance(self):
        assert normalize_severity(FindingSeverity.CRITICAL) == FindingSeverity.CRITICAL
        assert normalize_severity(FindingSeverity.LOW) == FindingSeverity.LOW

    def test_with_numeric_values(self):
        assert normalize_severity(9.8) == FindingSeverity.CRITICAL
        assert normalize_severity(7) == FindingSeverity.HIGH
        assert normalize_severity(5.0) == FindingSeverity.MEDIUM
        assert normalize_severity(1.2) == FindingSeverity.LOW

    def test_with_numeric_strings(self):
        assert normalize_severity("9.2") == FindingSeverity.CRITICAL
        assert normalize_severity("4.5") == FindingSeverity.MEDIUM

    def test_with_textual_strings(self):
        assert normalize_severity("MODERATE") == FindingSeverity.MEDIUM
        assert normalize_severity("  high  ") == FindingSeverity.HIGH
        assert normalize_severity("CRITICAL") == FindingSeverity.CRITICAL

    def test_with_none_or_invalid(self):
        assert normalize_severity(None) == FindingSeverity.MEDIUM
        assert normalize_severity([], default=FindingSeverity.INFO) == FindingSeverity.INFO
