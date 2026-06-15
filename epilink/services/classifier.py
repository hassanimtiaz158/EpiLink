from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.disease_registry import DiseaseRegistry


DISEASE_ICD10_MAP = {
    "Acute Flaccid Paralysis / Poliomyelitis": "A80",
    "Diphtheria": "A36",
    "Pertussis (Whooping Cough)": "A37",
    "Neonatal Tetanus": "A33",
    "COVID-19": "U07.1",
    "MERS-CoV": "B34.2",
    "Meningococcal Meningitis": "A39.0",
    "Bacterial Meningitis": "G00",
    "Viral Meningitis": "A87",
    "Acute Food Poisoning": "A05.0",
    "Rabies": "A82",
    "Rift Valley Fever": "A92.4",
    "Plague": "A20",
    "Malaria (P. falciparum)": "B50",
    "Malaria (P. vivax)": "B51",
    "HIV / AIDS": "B20",
    "Zika Virus Disease": "U06.9",
    "Mpox (Monkeypox)": "B04",
    "Measles": "B05",
    "Rubella": "B06",
    "Mumps": "B26_MU",
    "Avian Influenza H5N1": "J09",
    "Cholera": "A00.1",
    "Viral Encephalitis": "A86",
    "Botulism": "A05.1",
    "Anthrax": "A22",
    "Crimean-Congo Hemorrhagic Fever": "A98.0",
    "West Nile Fever": "A92.3",
    "Ebola Virus Disease": "A98.4",
    "Dengue Hemorrhagic Fever": "A97",
    "Yellow Fever": "A95",
    "Any Public Health Event of Concern": "PHE.ANY",
    "Viral Hepatitis (A, B, C, E)": "B26",
    "Typhoid Fever": "A01.0",
    "Bloody Diarrhea / Dysentery": "A04.0",
    "Brucellosis": "A23",
    "Animal Bite": "T01.9",
    "Filariasis": "B74",
    "Chickenpox (Varicella)": "B01",
    "Seasonal Influenza": "J10",
    "Tuberculosis (TB)": "A15",
    "Leprosy": "A30",
    "Leishmaniasis": "B55",
    "Fascioliasis": "B66",
    "Schistosomiasis (Bilharzia)": "B65",
}

GROUP_A_CODES = {
    "A80", "A36", "A37", "A33", "U07.1", "B34.2", "A39.0", "G00", "A87",
    "A05.0", "A82", "A92.4", "A20", "B50", "B51", "B20", "U06.9", "B04",
    "B05", "B06", "B26_MU", "J09", "A00.1", "A86", "A05.1", "A22",
    "A98.0", "A92.3", "A98.4", "A97", "A95", "PHE.ANY"
}

GROUP_B_CODES = {
    "B26", "A01.0", "A04.0", "A23", "T01.9", "B74", "B01", "J10",
    "A15", "A30", "B55", "B66", "B65"
}


async def validate_icd10(db: AsyncSession, icd10_code: str) -> bool:
    result = await db.execute(
        select(DiseaseRegistry).where(DiseaseRegistry.icd10_code == icd10_code)
    )
    return result.scalar_one_or_none() is not None


def classify_reporting_group(icd10_code: str) -> str:
    if icd10_code in GROUP_A_CODES:
        return "A"
    elif icd10_code in GROUP_B_CODES:
        return "B"
    else:
        raise ValueError(f"ICD-10 code {icd10_code} not found in disease registry")


async def get_alert_window_minutes(
    db: AsyncSession, icd10_code: str
) -> Optional[int]:
    result = await db.execute(
        select(DiseaseRegistry.alert_minutes).where(
            DiseaseRegistry.icd10_code == icd10_code
        )
    )
    return result.scalar_one_or_none()


async def is_immediate_alert(db: AsyncSession, icd10_code: str) -> bool:
    minutes = await get_alert_window_minutes(db, icd10_code)
    return minutes is not None and minutes == 60


async def get_disease_name(db: AsyncSession, icd10_code: str) -> str:
    result = await db.execute(
        select(DiseaseRegistry.name).where(
            DiseaseRegistry.icd10_code == icd10_code
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError(f"ICD-10 code {icd10_code} not found in disease registry")
    return row