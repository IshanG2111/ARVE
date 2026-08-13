"""
Language detector package.
"""
from app.ingestion.detector.language_detector import LanguageDetector
from app.ingestion.detector.framework_detector import FrameworkDetector

__all__ = ["LanguageDetector", "FrameworkDetector"]
