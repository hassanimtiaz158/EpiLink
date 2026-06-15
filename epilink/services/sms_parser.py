from datetime import date


def parse_sms(body: str) -> dict:
    parts = body.strip().split("#")
    if len(parts) != 6:
        raise ValueError(
            f"Invalid SMS format: expected 6 fields separated by '#', got {len(parts)}"
        )
    if parts[0] != "RPT":
        raise ValueError(f"Invalid SMS format: expected first field 'RPT', got '{parts[0]}'")

    facility_id = parts[1]
    icd10_code = parts[2]
    age_group = parts[3]
    sex_raw = parts[4]
    outcome_raw = parts[5]

    sex_map = {"M": "M", "F": "F"}
    if sex_raw not in sex_map:
        raise ValueError(f"Invalid sex: '{sex_raw}', expected 'M' or 'F'")

    outcome_map = {"ALIVE": "Alive", "DEAD": "Dead", "UNK": "Unknown"}
    if outcome_raw not in outcome_map:
        raise ValueError(
            f"Invalid outcome: '{outcome_raw}', expected 'ALIVE', 'DEAD', or 'UNK'"
        )

    age_options = {"<1", "1-4", "5-14", "15-29", "30-59", "60+"}
    if age_group not in age_options:
        raise ValueError(
            f"Invalid age_group: '{age_group}', expected one of {age_options}"
        )

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
