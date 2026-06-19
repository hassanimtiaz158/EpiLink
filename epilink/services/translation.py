import logging
import os
from typing import Optional

logger = logging.getLogger("epilink.translation")


class TranslationService:
    """Translation service using OpenAI or simple heuristics as fallback."""

    def __init__(self):
        self.target_languages = ["en", "ar"]
        self.client = None
        self._init_client()

    def _init_client(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                from openai import AsyncOpenAI
                self.client = AsyncOpenAI(api_key=api_key)
                logger.info("OpenAI client initialized for translation")
            except Exception as e:
                logger.warning(f"OpenAI client init failed for translation: {e}")
        else:
            logger.info("No OPENAI_API_KEY — translation will use heuristic fallback")

    async def detect_language(self, text: str) -> str:
        try:
            arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
            english_chars = sum(1 for c in text if "a" <= c.lower() <= "z")
            if arabic_chars > english_chars:
                return "ar"
            return "en"
        except Exception:
            return "en"

    async def translate_to_english(self, text: str, source_lang: Optional[str] = None) -> tuple[str, float]:
        if not text or not text.strip():
            return "", 0.0

        detected = source_lang or await self.detect_language(text)
        if detected == "en":
            return text.strip(), 1.0

        if self.client:
            try:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Translate this medical text to English. Return only the translation."},
                        {"role": "user", "content": text},
                    ],
                    temperature=0.1,
                    max_tokens=500,
                )
                return response.choices[0].message.content.strip(), 0.85
            except Exception as e:
                logger.warning(f"OpenAI translation failed: {e}")

        logger.warning("Translation unavailable, returning original text")
        return text.strip(), 0.3

    async def translate_to_arabic(self, text: str) -> tuple[str, float]:
        if not text or not text.strip():
            return "", 0.0

        if self.client:
            try:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "Translate this medical text to Arabic. Return only the translation."},
                        {"role": "user", "content": text},
                    ],
                    temperature=0.1,
                    max_tokens=500,
                )
                return response.choices[0].message.content.strip(), 0.85
            except Exception as e:
                logger.warning(f"OpenAI Arabic translation failed: {e}")

        return "", 0.0

    async def translate_both(self, text: str, source_lang: Optional[str] = None) -> dict:
        en_text, en_conf = await self.translate_to_english(text, source_lang)
        ar_text, ar_conf = await self.translate_to_arabic(en_text)
        return {
            "english": en_text,
            "arabic": ar_text,
            "english_confidence": en_conf,
            "arabic_confidence": ar_conf,
        }


translation_service = TranslationService()