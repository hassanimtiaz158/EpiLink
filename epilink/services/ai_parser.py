import json
import logging
import os
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.input import StructuredReportData, ExtractionWarning
from services.classifier import validate_icd10

logger = logging.getLogger("epilink.ai_parser")


DISEASE_ICD10_KEYWORDS = {
    "cholera": "A00.1",
    "typhoid": "A01.0",
    "dysentery": "A04.0",
    "diarrhea": "A04.0",
    "food poisoning": "A05.0",
    "botulism": "A05.1",
    "anthrax": "A22",
    "brucellosis": "A23",
    "plague": "A20",
    "diphtheria": "A36",
    "pertussis": "A37",
    "whooping cough": "A37",
    "tetanus": "A33",
    "meningitis": "A39.0",
    "covid": "U07.1",
    "covid-19": "U07.1",
    "sars-cov-2": "U07.1",
    "mers": "B34.2",
    "zika": "U06.9",
    "mpox": "B04",
    "monkeypox": "B04",
    "measles": "B05",
    "rubella": "B06",
    "mumps": "B26_MU",
    "hepatitis": "B26",
    "avian influenza": "J09",
    "bird flu": "J09",
    "h5n1": "J09",
    "influenza": "J10",
    "seasonal flu": "J10",
    "rift valley": "A92.4",
    "west nile": "A92.3",
    "crimean-congo": "A98.0",
    "ebola": "A98.4",
    "dengue": "A97",
    "yellow fever": "A95",
    "malaria": "B50",
    "hiv": "B20",
    "aids": "B20",
    "tuberculosis": "A15",
    "tb": "A15",
    "leprosy": "A30",
    "leishmaniasis": "B55",
    "filariasis": "B74",
    "schistosomiasis": "B65",
    "bilharzia": "B65",
    "fascioliasis": "B66",
    "chickenpox": "B01",
    "varicella": "B01",
    "rabies": "A82",
    "encephalitis": "A86",
    "polio": "A80",
    "poliomyelitis": "A80",
}

GOVERNORATES = [
    "Cairo", "Alexandria", "Giza", "Qalyubia", "Sharqia", "Monufia", "Gharbia",
    "Kafr El Sheikh", "Dakahlia", "Damietta", "Port Said", "Ismailia", "Suez",
    "North Sinai", "South Sinai", "Beheira", "Matrouh", "Fayoum", "Beni Suef",
    "Minya", "Assiut", "Sohag", "Qena", "Luxor", "Aswan", "Red Sea", "New Valley",
]

AGE_GROUPS = ["<1", "1-4", "5-14", "15-29", "30-59", "60+"]
SEX_OPTIONS = ["Male", "Female"]
OUTCOMES = ["Alive", "Dead", "Unknown"]
DIAGNOSIS_OPTIONS = ["Clinical", "Lab-confirmed", "Epidemiological link"]


class AIParserService:
    def __init__(self):
        self.client = None
        self.model = "gpt-4o-mini"
        self.confidence_threshold = 0.75
        self._init_client()

    def _init_client(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            try:
                from openai import AsyncOpenAI
                self.client = AsyncOpenAI(api_key=api_key)
                logger.info("OpenAI client initialized successfully")
            except Exception as e:
                logger.warning(f"OpenAI client init failed: {e}")
        else:
            logger.info("OPENAI_API_KEY not set — using rule-based fallback parser")

    def _rule_based_parse(self, text: str) -> tuple[StructuredReportData, float]:
        text_lower = text.lower()
        icd10_code = None
        for keyword, code in DISEASE_ICD10_KEYWORDS.items():
            if keyword in text_lower:
                icd10_code = code
                break

        governorate = None
        for g in GOVERNORATES:
            if g.lower() in text_lower:
                governorate = g
                break

        age_group = None
        for ag in AGE_GROUPS:
            if ag in text_lower:
                age_group = ag
                break

        sex = None
        for s in SEX_OPTIONS:
            if s.lower() in text_lower:
                sex = s
                break

        outcome = None
        for o in OUTCOMES:
            if o.lower() in text_lower:
                outcome = o
                break

        hospitalized = None
        if "hospital" in text_lower or "admitted" in text_lower:
            hospitalized = True
        elif "outpatient" in text_lower or "discharged" in text_lower:
            hospitalized = False

        lab_sample = None
        if "lab" in text_lower or "sample" in text_lower or "test" in text_lower:
            lab_sample = True

        confidence = 0.3
        if icd10_code:
            confidence += 0.3
        if governorate:
            confidence += 0.1
        if age_group:
            confidence += 0.1
        if sex:
            confidence += 0.1

        return StructuredReportData(
            icd10_code=icd10_code,
            governorate=governorate,
            age_group=age_group,
            sex=sex,
            outcome=outcome,
            hospitalized=hospitalized,
            lab_sample_taken=lab_sample,
            submission_mode="text-extracted",
        ), min(1.0, confidence)

    def _build_prompt(self, text: str, translations: dict) -> str:
        return f"""You are a medical data extraction assistant for Egypt's disease surveillance system (DES).
Extract structured case report data from the following clinical text.

INPUT TEXT (English): {translations.get('english', text)}
INPUT TEXT (Arabic): {translations.get('arabic', '')}

VALID EGYPT DES DISEASES (45 notifiable diseases with ICD-10 codes):
- Cholera: A00.1
- Typhoid Fever: A01.0
- Bloody Diarrhea / Dysentery: A04.0
- Acute Food Poisoning: A05.0
- Botulism: A05.1
- Anthrax: A22
- Brucellosis: A23
- Plague: A20
- Diphtheria: A36
- Pertussis (Whooping Cough): A37
- Neonatal Tetanus: A33
- Meningococcal Meningitis: A39.0
- Bacterial Meningitis: G00
- Viral Meningitis: A87
- Rabies: A82
- Viral Encephalitis: A86
- Acute Flaccid Paralysis / Poliomyelitis: A80
- COVID-19: U07.1
- MERS-CoV: B34.2
- Zika Virus Disease: U06.9
- Mpox (Monkeypox): B04
- Measles: B05
- Rubella: B06
- Mumps: B26_MU
- Viral Hepatitis (A, B, C, E): B26
- Avian Influenza H5N1: J09
- Seasonal Influenza: J10
- Rift Valley Fever: A92.4
- West Nile Fever: A92.3
- Crimean-Congo Hemorrhagic Fever: A98.0
- Ebola Virus Disease: A98.4
- Dengue Hemorrhagic Fever: A97
- Yellow Fever: A95
- Malaria (P. falciparum): B50
- Malaria (P. vivax): B51
- HIV / AIDS: B20
- Tuberculosis (TB): A15
- Leprosy: A30
- Leishmaniasis: B55
- Filariasis: B74
- Schistosomiasis (Bilharzia): B65
- Fascioliasis: B66
- Chickenpox (Varicella): B01
- Animal Bite: T01.9

VALID VALUES:
- age_group: "<1", "1-4", "5-14", "15-29", "30-59", "60+"
- sex: "Male", "Female"
- nationality: "Egyptian", "Other"
- diagnosis_basis: "Clinical", "Lab-confirmed", "Epidemiological link"
- outcome: "Alive", "Dead", "Unknown"

Return ONLY valid JSON:
{{
  "facility_id": "string or null",
  "physician_id": "string or null",
  "governorate": "string or null",
  "district": "string or null",
  "age_group": "string or null",
  "sex": "string or null",
  "nationality": "string or null",
  "icd10_code": "string or null",
  "symptom_onset_date": "YYYY-MM-DD or null",
  "diagnosis_basis": "string or null",
  "hospitalized": "boolean or null",
  "outcome": "string or null",
  "lab_sample_taken": "boolean or null",
  "submission_mode": "text-extracted"
}}"""

    async def parse_text(
        self, text: str, translations: dict, db: AsyncSession
    ) -> tuple[StructuredReportData, list[ExtractionWarning], float]:
        warnings = []

        if not self.client:
            logger.info("Using rule-based parser (no OpenAI key)")
            structured, confidence = self._rule_based_parse(text)
            if structured.icd10_code:
                valid = await validate_icd10(db, structured.icd10_code)
                if not valid:
                    warnings.append(ExtractionWarning(
                        field="icd10_code",
                        message=f"Disease '{structured.icd10_code}' detected but not in registry",
                        confidence=0.5,
                    ))
                    structured.icd10_code = None
            else:
                warnings.append(ExtractionWarning(
                    field="icd10_code",
                    message="Could not identify disease from text",
                    confidence=0.0,
                ))
            return structured, warnings, confidence

        prompt = self._build_prompt(text, translations)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a precise medical data extractor. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            parsed = json.loads(content)
            structured = StructuredReportData(**parsed)

            if structured.icd10_code and not await validate_icd10(db, structured.icd10_code):
                warnings.append(ExtractionWarning(
                    field="icd10_code",
                    message=f"ICD-10 code '{structured.icd10_code}' not in Egypt DES registry",
                    confidence=0.0,
                ))
                structured.icd10_code = None

            confidence = self._calculate_confidence(structured, warnings)
            return structured, warnings, confidence

        except Exception as e:
            logger.error(f"AI parsing failed: {e}")
            structured, confidence = self._rule_based_parse(text)
            warnings.append(ExtractionWarning(
                field="all",
                message=f"AI parsing failed, used rule-based fallback: {str(e)}",
                confidence=0.3,
            ))
            return structured, warnings, confidence

    def _calculate_confidence(self, data: StructuredReportData, warnings: list) -> float:
        fields = [
            data.facility_id, data.physician_id, data.governorate, data.district,
            data.age_group, data.sex, data.nationality, data.icd10_code,
            data.symptom_onset_date, data.diagnosis_basis, data.hospitalized,
            data.outcome, data.lab_sample_taken,
        ]
        filled = sum(1 for f in fields if f is not None)
        base = filled / len(fields)
        if warnings:
            base *= 0.7
        if data.icd10_code:
            base = max(base, 0.6)
        return min(1.0, base)


ai_parser_service = AIParserService()