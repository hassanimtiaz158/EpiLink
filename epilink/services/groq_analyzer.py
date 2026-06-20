import json
import logging
from typing import Optional
from dataclasses import dataclass, field

import httpx

from core.config import settings

logger = logging.getLogger("epilink.groq_analyzer")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

ANALYSIS_PROMPT = """You are an epidemiological AI analyst for Egypt's Disease Surveillance System (DES).
Analyze the following clinical report text and produce a structured JSON analysis.

REPORT TEXT:
{text}

EPIDEMIOLOGICAL DECISION RULES (apply these in strict priority order):
1. TRAVEL HISTORY is the strongest differentiator. If the report mentions travel to a known endemic area, the disease associated with that area MUST be the top differential — even if symptoms alone suggest a different disease.
   - Travel to malaria-endemic areas (Sudan, Sub-Saharan Africa, Southeast Asia) + fever → Malaria (B50/B51) is primary differential.
   - Travel to cholera-endemic areas + watery diarrhea → Cholera (A00.1) is primary differential.
   - Travel to dengue-endemic areas + fever + rash → Dengue (A97) is primary differential.
2. EXPOSURE CONTEXT overrides symptom-only matching. Occupation (e.g. livestock worker → Brucellosis A23), animal contact (→ Rabies A82, Anthrax A22), water contact (→ Schistosomiasis B65), and vector exposure (→ West Nile A92.3, Rift Valley A92.4) are strong signals.
3. PRIOR OUTBREAKS in the area or governorate raise the probability of the same disease recurring.
4. SYMPTOM CLUSTERING: fever + jaundice alone could be Hepatitis or Malaria — but travel history to a malaria-endemic area tips the balance toward Malaria. Always list both as differentials, ranked by epidemiological plausibility.

Return ONLY valid JSON with these fields:
{{
  "disease_name": "detected disease name (primary differential based on epidemiological reasoning above)",
  "icd10_code": "ICD-10 code from Egypt DES list or null",
  "confidence": 0.0 to 1.0,
  "severity": "low" | "moderate" | "high" | "critical",
  "alert_level": "NORMAL" | "REVIEW" | "HIGH",
  "governorate": "detected governorate or null",
  "district": "detected district or null",
  "age_group": "detected age group or null",
  "sex": "Male" or "Female" or null,
  "summary": "1-2 sentence clinical summary",
  "recommendation": "recommended action (e.g. 'dispatch alert', 'escalate to ministry', 'monitor', 'no action needed')",
  "risk_factors": ["list of risk factors identified, prioritize travel/exposure factors"],
  "differential_diagnoses": ["ranked list of top 3-5 differential diagnoses with brief reasoning"],
  "nearby_governorates": ["list of neighboring governorates to monitor"]
}}

EGYPT DES VALID ICD-10 CODES (45 notifiable diseases):
A00.1 Cholera, A01.0 Typhoid, A04.0 Dysentery, A05.0 Food Poisoning,
A05.1 Botulism, A22 Anthrax, A23 Brucellosis, A20 Plague,
A36 Diphtheria, A37 Pertussis, A33 Neonatal Tetanus,
A39.0 Meningococcal Meningitis, G00 Bacterial Meningitis, A87 Viral Meningitis,
A82 Rabies, A86 Viral Encephalitis, A80 Polio,
U07.1 COVID-19, B34.2 MERS-CoV, U06.9 Zika,
B04 Mpox, B05 Measles, B06 Rubella, B26_MU Mumps,
B26 Hepatitis, J09 Avian Influenza, J10 Seasonal Influenza,
A92.4 Rift Valley Fever, A92.3 West Nile, A98.0 Crimean-Congo,
A98.4 Ebola, A97 Dengue, A95 Yellow Fever,
B50/B51 Malaria, B20 HIV/AIDS, A15 Tuberculosis, A30 Leprosy,
B55 Leishmaniasis, B74 Filariasis, B65 Schistosomiasis,
B66 Fascioliasis, B01 Chickenpox, T01.9 Animal Bite

EGYPT GOVERNORATES: Cairo, Alexandria, Giza, Qalyubia, Sharqia, Monufia, Gharbia,
Kafr El Sheikh, Dakahlia, Damietta, Port Said, Ismailia, Suez,
North Sinai, South Sinai, Beheira, Matrouh, Fayoum, Beni Suef,
Minya, Assiut, Sohag, Qena, Luxor, Aswan, Red Sea, New Valley

NEIGHBORING GOVERNORATES MAP:
Cairo: [Giza, Qalyubia, Sharqia], Alexandria: [Beheira, Matrouh],
Giza: [Cairo, Fayoum, Beni Suef, Minya], Minya: [Giza, Assiut, Beni Suef],
Assiut: [Minya, Sohag], Sohag: [Assiut, Qena], Qena: [Sohag, Luxor],
Luxor: [Qena, Aswan], Aswan: [Luxor, Red Sea], Red Sea: [Aswan, Luxor],
Dakahlia: [Damietta, Qalyubia, Sharqia, Monufia, Gharbia],
Gharbia: [Dakahlia, Monufia, Kafr El Sheikh, Beheira],
Kafr El Sheikh: [Gharbia, Beheira, Dakahlia],
Beheira: [Kafr El Sheikh, Gharbia, Monufia, Alexandria, Matrouh],
Sharqia: [Dakahlia, Qalyubia, Cairo, Monufia],
Monufia: [Sharqia, Dakahlia, Gharbia, Beheira, Qalyubia],
Qalyubia: [Cairo, Dakahlia, Sharqia, Monufia],
Fayoum: [Giza, Beni Suef],
Beni Suef: [Fayoum, Giza, Minya],
Damietta: [Dakahlia, Port Said],
Port Said: [Damietta, Ismailia],
Ismailia: [Port Said, Suez, Sharqia, Qalyubia],
Suez: [Ismailia, Red Sea],
North Sinai: [South Sinai],
South Sinai: [North Sinai, Red Sea],
Matrouh: [Alexandria, Beheira, New Valley],
New Valley: [Matrouh, Minya, Assiut, Red Sea]

RESPONSE FORMAT: Return ONLY the JSON object, no markdown, no explanation."""


@dataclass
class AnalysisResult:
    disease_name: str | None = None
    icd10_code: str | None = None
    confidence: float = 0.0
    severity: str = "low"
    alert_level: str = "NORMAL"
    governorate: str | None = None
    district: str | None = None
    age_group: str | None = None
    sex: str | None = None
    summary: str = ""
    recommendation: str = ""
    risk_factors: list[str] = field(default_factory=list)
    differential_diagnoses: list[str] = field(default_factory=list)
    nearby_governorates: list[str] = field(default_factory=list)
    raw_response: str = ""


class GroqAnalyzer:
    def __init__(self):
        self.api_key = settings.groq_api_key
        if not self.api_key:
            logger.warning("GROQ_API_KEY not set — AI analysis will use rule-based fallback")

    async def analyze_text(self, text: str) -> AnalysisResult:
        if not self.api_key:
            return self._rule_based_fallback(text)

        prompt = ANALYSIS_PROMPT.format(text=text)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": "You are a precise epidemiological analyst. Return only valid JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 800,
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                content = content.strip()
                if content.startswith("```"):
                    content = content.split("\n", 1)[1]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()

                parsed = json.loads(content)
                return AnalysisResult(
                    disease_name=parsed.get("disease_name"),
                    icd10_code=parsed.get("icd10_code"),
                    confidence=float(parsed.get("confidence", 0.0)),
                    severity=parsed.get("severity", "low"),
                    alert_level=parsed.get("alert_level", "NORMAL"),
                    governorate=parsed.get("governorate"),
                    district=parsed.get("district"),
                    age_group=parsed.get("age_group"),
                    sex=parsed.get("sex"),
                    summary=parsed.get("summary", ""),
                    recommendation=parsed.get("recommendation", ""),
                    risk_factors=parsed.get("risk_factors", []),
                    differential_diagnoses=parsed.get("differential_diagnoses", []),
                    nearby_governorates=parsed.get("nearby_governorates", []),
                    raw_response=content,
                )
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            return self._rule_based_fallback(text)

    def _rule_based_fallback(self, text: str) -> AnalysisResult:
        from services.ai_parser import DISEASE_ICD10_KEYWORDS, GOVERNORATES

        text_lower = text.lower()
        icd10 = None
        disease = None
        for keyword, code in DISEASE_ICD10_KEYWORDS.items():
            if keyword in text_lower:
                icd10 = code
                disease = keyword.title()
                break

        governorate = None
        for g in GOVERNORATES:
            if g.lower() in text_lower:
                governorate = g
                break

        severity = "moderate"
        alert_level = "REVIEW"
        if icd10 and any(k in text_lower for k in ["dead", "death", "fatal", "outbreak", "cluster"]):
            severity = "high"
            alert_level = "HIGH"

        summary = f"Rule-based analysis: {disease or 'Unknown disease'} detected"
        if governorate:
            summary += f" in {governorate}"

        return AnalysisResult(
            disease_name=disease,
            icd10_code=icd10,
            confidence=0.5 if icd10 else 0.2,
            severity=severity,
            alert_level=alert_level,
            governorate=governorate,
            summary=summary,
            recommendation="Dispatch alert" if alert_level == "HIGH" else "Review manually",
        )


groq_analyzer = GroqAnalyzer()
