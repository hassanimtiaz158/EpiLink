import pytest
from httpx import AsyncClient


class TestReport:
    @pytest.mark.asyncio
    async def test_submit_group_a_report(self, client: AsyncClient, seed_diseases):
        payload = {
            "facility_id": "EGY001",
            "physician_id": "dr_ahmed_01",
            "governorate": "Cairo",
            "district": "Maadi",
            "age_group": "15-29",
            "sex": "M",
            "nationality": "Egyptian",
            "icd10_code": "A39.0",
            "symptom_onset_date": "2026-06-10",
            "diagnosis_basis": "Clinical",
            "hospitalized": True,
            "outcome": "Alive",
            "lab_sample_taken": True,
            "submission_mode": "online",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "received"
        assert data["reporting_group"] == "A"
        assert len(data["report_id"]) > 0

    @pytest.mark.asyncio
    async def test_submit_group_b_report(self, client: AsyncClient, seed_diseases):
        payload = {
            "facility_id": "EGY002",
            "physician_id": "dr_sara_02",
            "governorate": "Alexandria",
            "district": "Montaza",
            "age_group": "30-59",
            "sex": "F",
            "nationality": "Egyptian",
            "icd10_code": "B26",
            "symptom_onset_date": "2026-06-08",
            "diagnosis_basis": "Lab-confirmed",
            "hospitalized": False,
            "outcome": "Alive",
            "lab_sample_taken": True,
            "submission_mode": "online",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "received"
        assert data["reporting_group"] == "B"

    @pytest.mark.asyncio
    async def test_invalid_icd10(self, client: AsyncClient, seed_diseases):
        payload = {
            "facility_id": "EGY003",
            "physician_id": "dr_test",
            "governorate": "Giza",
            "district": "Dokki",
            "age_group": "5-14",
            "sex": "M",
            "icd10_code": "INVALID99",
            "symptom_onset_date": "2026-06-10",
            "diagnosis_basis": "Clinical",
            "hospitalized": False,
            "outcome": "Alive",
            "lab_sample_taken": False,
            "submission_mode": "online",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 400
        data = response.json()
        assert "INVALID_ICD10" in str(data)

    @pytest.mark.asyncio
    async def test_offline_sync_submission(self, client: AsyncClient, seed_diseases):
        payload = {
            "facility_id": "EGY010",
            "physician_id": "dr_offline",
            "governorate": "Luxor",
            "district": "City Center",
            "age_group": "60+",
            "sex": "F",
            "icd10_code": "A39.0",
            "symptom_onset_date": "2026-06-09",
            "diagnosis_basis": "Clinical",
            "hospitalized": False,
            "outcome": "Unknown",
            "lab_sample_taken": False,
            "submission_mode": "offline-cached",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "received"
        assert data["reporting_group"] == "A"
