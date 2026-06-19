import base64
import io
import json
import logging
from typing import Optional

import httpx
from PIL import Image

from core.config import settings

logger = logging.getLogger("epilink.ocr")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


class OCRService:
    def __init__(self):
        self.supported_formats = {"jpeg", "png", "pdf", "webp", "gif"}
        self.groq_api_key = settings.groq_api_key

    def _prepare_image(self, image_base64: str, image_format: str) -> str:
        try:
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))
            if image.mode != "RGB":
                image = image.convert("RGB")
            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=95)
            return base64.b64encode(buf.getvalue()).decode()
        except Exception as e:
            logger.warning(f"Image preprocessing failed, using original: {e}")
            return image_base64

    async def extract_text_with_groq(
        self, image_base64: str, image_format: str = "jpeg"
    ) -> tuple[str, float]:
        if not self.groq_api_key:
            logger.info("No GROQ_API_KEY — skipping vision OCR")
            return "", 0.0

        prepared = self._prepare_image(image_base64, image_format)
        data_url = f"data:image/jpeg;base64,{prepared}"

        prompt = (
            "Extract ALL text from this medical report image. "
            "Return the complete text content exactly as it appears, preserving structure. "
            "Include all patient info, disease names, symptoms, dates, locations, lab results, "
            "diagnoses, doctor notes, and any other text. "
            "If Arabic text is present, include it as-is. "
            "Return ONLY the extracted text, no commentary."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GROQ_VISION_MODEL,
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": data_url},
                                    },
                                ],
                            }
                        ],
                        "temperature": 0.1,
                        "max_tokens": 2000,
                    },
                )
                response.raise_for_status()
                data = response.json()
                text = data["choices"][0]["message"]["content"].strip()

                if not text:
                    return "", 0.0

                logger.info(f"Groq vision extracted {len(text)} chars from image")
                return text, 0.85

        except Exception as e:
            logger.error(f"Groq vision OCR failed: {e}")
            return "", 0.0

    def extract_text_with_tesseract(
        self, image_base64: str, image_format: str = "jpeg", lang: str = "eng+ara"
    ) -> tuple[str, float]:
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
        except Exception:
            logger.info("Tesseract not available")
            return "", 0.0

        try:
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))
            if image.mode != "RGB":
                image = image.convert("RGB")

            custom_config = r"--oem 3 --psm 6"
            text = pytesseract.image_to_string(image, lang=lang, config=custom_config)
            text = text.strip()

            if not text:
                return "", 0.0

            data = pytesseract.image_to_data(
                image, lang=lang, config=custom_config, output_type=pytesseract.Output.DICT
            )
            confidences = [int(c) for c in data["conf"] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            logger.info(f"Tesseract extracted {len(text)} chars, confidence {avg_confidence:.1f}%")
            return text, avg_confidence / 100.0

        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            return "", 0.0

    async def extract_text_from_base64(
        self, image_base64: str, image_format: str = "jpeg", lang: str = "eng+ara"
    ) -> tuple[str, float]:
        text, conf = await self.extract_text_with_groq(image_base64, image_format)
        if text:
            return text, conf

        text, conf = self.extract_text_with_tesseract(image_base64, image_format, lang)
        if text:
            return text, conf

        logger.warning("No OCR engine could extract text from image")
        return "", 0.0


ocr_service = OCRService()
