from models.case_report import CaseReport


def prepare_global_signal(report: CaseReport) -> dict:
    return {
        "icd10_code": report.icd10_code,
        "reporting_group": report.reporting_group,
        "governorate": report.governorate,
        "age_group": report.age_group,
        "epi_week": report.epi_week,
    }
