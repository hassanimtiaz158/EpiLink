from datetime import date


def parse_sms(body: str):
    """Parse fixed-position SMS format: RPT#FACILITYID#ICD10CODE#AGEGROUP#SEX#OUTCOME
    Returns dict compatible with ReportSchema or None on any parse failure.
    """
    try:
        parts = body.strip().split("#")
        if len(parts) != 6:
            return None
        if parts[0] != "RPT":
            return None

        facility_id = parts[1]
        icd10_code = parts[2]
        age_group = parts[3]
        sex_raw = parts[4]
        outcome_raw = parts[5]

        sex_map = {"M": "Male", "F": "Female"}
        if sex_raw not in sex_map:
            return None

        outcome_map = {"ALIVE": "Alive", "DEAD": "Dead", "UNK": "Unknown"}
        if outcome_raw not in outcome_map:
            return None

        age_options = {"<1", "1-4", "5-14", "15-29", "30-59", "60+"}
        if age_group not in age_options:
            return None

        return {
            "facility_id": facility_id,
            "physician_id": f"SMS-{facility_id}-AUTO",
            "governorate": "Unknown",
            "district": "Unknown",
            "age_group": age_group,
            "sex": sex_map[sex_raw],
            "nationality": "Egyptian",
            "icd10_code": icd10_code,
            "symptom_onset_date": date.today(),
            "diagnosis_basis": "Clinical",
            "hospitalized": False,
            "outcome": outcome_map[outcome_raw],
            "lab_sample_taken": False,
            "submission_mode": "sms-fallback",
        }
    except Exception:
        return None