import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import database as core_db
from core.config import settings
from models.alert import Alert
from models.case_report import CaseReport
from models.disease_registry import DiseaseRegistry
from models.drift_report import DriftReport
from services.drift_monitor import weekly_drift_check


async def _poll_alert(icd10_code: str, timeout: float = 5.0):
    """Poll for alert with pending status using a fresh session."""
    start = datetime.now()
    while (datetime.now() - start).total_seconds() < timeout:
        async with core_db.async_session_factory() as db:
            result = await db.execute(
                select(Alert)
                .where(Alert.icd10_code == icd10_code)
                .order_by(Alert.created_at.desc())
            )
            alert = result.scalars().first()
            if alert is not None and alert.status == "pending":
                return alert
        await asyncio.sleep(0.1)
    return None


async def _poll_alert_any(icd10_code: str, timeout: float = 5.0):
    start = datetime.now()
    while (datetime.now() - start).total_seconds() < timeout:
        async with core_db.async_session_factory() as db:
            result = await db.execute(
                select(Alert)
                .where(Alert.icd10_code == icd10_code)
                .order_by(Alert.created_at.desc())
            )
            alert = result.scalars().first()
            if alert is not None:
                return alert
        await asyncio.sleep(0.1)
    return None


class TestDemoScenario1_GroupAOnlineHappyPath:
    @pytest.mark.asyncio
    async def test_full_alert_lifecycle(
        self, client: AsyncClient, db_session: AsyncSession, seed_diseases, httpx_mock
    ):
        payload = {
            "facility_id": "EGY001",
            "physician_id": "dr_test_01",
            "governorate": "Cairo",
            "district": "Nasr City",
            "age_group": "30-59",
            "sex": "Male",
            "icd10_code": "A39.0",
            "symptom_onset_date": "2026-06-10",
            "diagnosis_basis": "Clinical",
            "hospitalized": True,
            "outcome": "Alive",
            "lab_sample_taken": True,
            "submission_mode": "online",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "received"
        assert data["reporting_group"] == "A"
        assert data["alert_triggered"] is True

        report_result = await db_session.execute(
            select(CaseReport).where(
                CaseReport.report_id == uuid.UUID(data["report_id"])
            )
        )
        report = report_result.scalar_one_or_none()
        assert report is not None

        await asyncio.sleep(0.1)

        alert = await _poll_alert("A39.0", timeout=5.0)
        assert alert is not None, "Alert was not created by background task"
        assert alert.icd10_code == "A39.0"
        assert alert.status == "pending"
        assert alert.confidence > 0

        httpx_mock.add_response(
            url=settings.ministry_webhook_url,
            method="POST",
            status_code=200,
            text="ok",
        )
        httpx_mock.add_response(
            url=settings.who_fhir_url + "/Bundle",
            method="POST",
            status_code=200,
            text="ok",
        )

        patch_response = await client.patch(
            f"/api/v1/alerts/{alert.id}/review",
            json={"decision": "confirmed", "reviewed_by": "epi-officer-01", "notes": "Confirmed cluster"},
        )
        assert patch_response.status_code == 200
        patch_data = patch_response.json()
        assert patch_data["status"] == "confirmed"
        assert patch_data["alert_id"] == str(alert.id)

        await asyncio.sleep(0.2)


class TestDemoScenario2_OfflineSync:
    @pytest.mark.asyncio
    async def test_offline_cached_report(
        self, client: AsyncClient, db_session: AsyncSession, seed_diseases
    ):
        payload = {
            "facility_id": "EGY050",
            "physician_id": "dr_offline_test",
            "governorate": "Giza",
            "district": "Haram",
            "age_group": "1-4",
            "sex": "Female",
            "icd10_code": "A01.0",
            "symptom_onset_date": "2026-06-08",
            "diagnosis_basis": "Lab-confirmed",
            "hospitalized": False,
            "outcome": "Alive",
            "lab_sample_taken": True,
            "submission_mode": "offline-cached",
        }
        response = await client.post("/api/v1/report", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "received"
        assert data["reporting_group"] == "B"

        result = await db_session.execute(
            select(CaseReport).where(
                CaseReport.report_id == uuid.UUID(data["report_id"])
            )
        )
        report = result.scalar_one_or_none()
        assert report is not None
        assert report.submission_mode == "offline-cached"
        assert report.reporting_group == "B"


class TestDemoScenario3_SMSFallback:
    @pytest.mark.asyncio
    async def test_sms_webhook(
        self, client: AsyncClient, db_session: AsyncSession, seed_diseases, httpx_mock
    ):
        response = await client.post(
            "/api/v1/sms-webhook",
            data={"Body": "RPT#EGY042#A39.0#15-29#M#ALIVE"},
        )
        assert response.status_code == 200
        assert "Report received" in response.text

        report_result = await db_session.execute(
            select(CaseReport).order_by(CaseReport.created_at.desc())
        )
        report = report_result.scalars().first()
        assert report is not None
        assert report.submission_mode == "sms-fallback"
        assert report.facility_id == "EGY042"
        assert report.icd10_code == "A39.0"

        alert = await _poll_alert_any("A39.0", timeout=5.0)
        assert alert is not None, "Alert was not created by background task"
        assert alert.icd10_code == "A39.0"
        assert alert.status == "pending"


class TestDemoScenario4_DriftDetection:
    @pytest.mark.asyncio
    async def test_drift_detection(
        self, db_session: AsyncSession, seed_diseases, httpx_mock
    ):
        httpx_mock.add_response(
            url=settings.admin_webhook_url,
            method="POST",
            status_code=200,
            text="ok",
        )

        code = "A00.1"
        governorate = "Cairo"

        now = datetime.now(timezone.utc)
        today = now.date()

        # Create baseline data for 12 weeks (48 reports)
        for week_offset in range(1, 13):
            week_start = today - timedelta(weeks=week_offset)
            for _ in range(4):
                report_date = week_start + timedelta(
                    days=hash(str(week_offset) + str(_)) % 7
                )
                report_dt = datetime.combine(
                    report_date, datetime.min.time(), tzinfo=timezone.utc
                )
                epi = report_date.isocalendar()[1]
                report = CaseReport(
                    id=uuid.uuid4(),
                    report_id=uuid.uuid4(),
                    submitted_at=report_dt,
                    epi_week=epi,
                    facility_id=f"EGY-BASE-{week_offset}",
                    physician_id="abc123",
                    governorate=governorate,
                    district="Multiple",
                    age_group="30-59",
                    sex="Male",
                    icd10_code=code,
                    disease_name="Cholera",
                    reporting_group="A",
                    symptom_onset_date=report_date,
                    diagnosis_basis="Lab-confirmed",
                    hospitalized=True,
                    outcome="Alive",
                    lab_sample_taken=True,
                    submission_mode="online",
                )
                db_session.add(report)

        # Create spike: 50 reports this week (alert rate = 0 alerts / 50 reports = 0 < 0.005)
        current_week_start = today - timedelta(days=today.weekday())
        for i in range(50):
            report_date = current_week_start + timedelta(days=i % 7)
            report_dt = datetime.combine(
                report_date, datetime.min.time(), tzinfo=timezone.utc
            )
            epi = report_date.isocalendar()[1]
            spike = CaseReport(
                id=uuid.uuid4(),
                report_id=uuid.uuid4(),
                submitted_at=report_dt,
                epi_week=epi,
                facility_id=f"EGY-SPIKE-{i}",
                physician_id="abc456",
                governorate=governorate,
                district="Multiple",
                age_group="30-59",
                sex="Female",
                icd10_code=code,
                disease_name="Cholera",
                reporting_group="A",
                symptom_onset_date=report_date,
                diagnosis_basis="Clinical",
                hospitalized=True,
                outcome="Alive",
                lab_sample_taken=True,
                submission_mode="online",
            )
            db_session.add(spike)

        await db_session.commit()

        drift = await weekly_drift_check(db_session)

        assert drift is not None
        assert drift["drift_detected"] is True