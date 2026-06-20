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
from services.anomaly import OutbreakDetector


class TestZScore:
    """Verify z_score is non-zero for repeated cases with no historical baseline."""

    @pytest.mark.asyncio
    async def test_zscore_nonzero_for_single_case(
        self, db_session: AsyncSession, seed_diseases
    ):
        """Even a single case with no baseline produces a non-zero z_score."""
        icd10_code = "A80"
        governorate = "Cairo"
        now = datetime.now(timezone.utc)

        report = CaseReport(
            id=uuid.uuid4(),
            report_id=uuid.uuid4(),
            submitted_at=now,
            epi_week=now.isocalendar()[1],
            facility_id="EGY-ZSCORE-SINGLE",
            physician_id="dr-single",
            governorate=governorate,
            district="Heliopolis",
            age_group="5-14",
            sex="Male",
            icd10_code=icd10_code,
            disease_name="Acute Flaccid Paralysis",
            reporting_group="A",
            symptom_onset_date=now.date(),
            diagnosis_basis="Clinical",
            hospitalized=True,
            outcome="Alive",
            lab_sample_taken=True,
            submission_mode="online",
        )
        db_session.add(report)
        await db_session.commit()

        detector = OutbreakDetector()
        alert_level, z_score, confidence = await detector.check_cluster(
            db_session, governorate, icd10_code
        )

        assert z_score > 0, f"Single case should have z_score > 0, got {z_score}"
        assert confidence == pytest.approx(0.1, abs=0.01)
        # z = (1 - 0.5) / sqrt(0.5) ≈ 0.71
        assert z_score == pytest.approx(0.71, abs=0.05)

    @pytest.mark.asyncio
    async def test_zscore_nonzero_for_cluster(
        self, db_session: AsyncSession, seed_diseases, auth_headers, httpx_mock
    ):
        icd10_code = "A39.0"
        governorate = "Cairo"
        now = datetime.now(timezone.utc)
        epi_week = now.isocalendar()[1]

        for i in range(6):
            report = CaseReport(
                id=uuid.uuid4(),
                report_id=uuid.uuid4(),
                submitted_at=now - timedelta(minutes=5 * i),
                epi_week=epi_week,
                facility_id=f"EGY-ZSCORE-{i}",
                physician_id=f"dr-zscore-{i}",
                governorate=governorate,
                district="Nasr City",
                age_group="30-59",
                sex="Male",
                icd10_code=icd10_code,
                disease_name="Meningococcal Meningitis",
                reporting_group="A",
                symptom_onset_date=now.date(),
                diagnosis_basis="Clinical",
                hospitalized=True,
                outcome="Alive",
                lab_sample_taken=True,
                submission_mode="online",
            )
            db_session.add(report)
        await db_session.commit()

        detector = OutbreakDetector()
        alert_level, z_score, confidence = await detector.check_cluster(
            db_session, governorate, icd10_code
        )

        assert confidence > 0, f"Expected confidence > 0, got {confidence}"
        assert z_score > 0, f"Expected z_score > 0, got {z_score}"
        assert confidence == pytest.approx(0.6, abs=0.01)

    @pytest.mark.asyncio
    async def test_zscore_increases_with_more_cases(
        self, db_session: AsyncSession, seed_diseases
    ):
        icd10_code = "A00.1"
        governorate = "Cairo"
        now = datetime.now(timezone.utc)
        epi_week = now.isocalendar()[1]

        for i in range(4):
            report = CaseReport(
                id=uuid.uuid4(),
                report_id=uuid.uuid4(),
                submitted_at=now - timedelta(minutes=3 * i),
                epi_week=epi_week,
                facility_id=f"EGY-ZSCORE2-{i}",
                physician_id=f"dr-zscore2-{i}",
                governorate=governorate,
                district="Multiple",
                age_group="30-59",
                sex="Male",
                icd10_code=icd10_code,
                disease_name="Cholera",
                reporting_group="A",
                symptom_onset_date=now.date(),
                diagnosis_basis="Lab-confirmed",
                hospitalized=True,
                outcome="Alive",
                lab_sample_taken=True,
                submission_mode="online",
            )
            db_session.add(report)
        await db_session.commit()

        detector = OutbreakDetector()
        _, z_score_4, confidence_4 = await detector.check_cluster(
            db_session, governorate, icd10_code
        )

        for i in range(6):
            report = CaseReport(
                id=uuid.uuid4(),
                report_id=uuid.uuid4(),
                submitted_at=now - timedelta(minutes=i),
                epi_week=epi_week,
                facility_id=f"EGY-ZSCORE2-B-{i}",
                physician_id=f"dr-zscore2-b-{i}",
                governorate=governorate,
                district="Multiple",
                age_group="15-29",
                sex="Female",
                icd10_code=icd10_code,
                disease_name="Cholera",
                reporting_group="A",
                symptom_onset_date=now.date(),
                diagnosis_basis="Clinical",
                hospitalized=True,
                outcome="Alive",
                lab_sample_taken=True,
                submission_mode="online",
            )
            db_session.add(report)
        await db_session.commit()

        _, z_score_10, confidence_10 = await detector.check_cluster(
            db_session, governorate, icd10_code
        )

        assert z_score_10 >= z_score_4, (
            f"Expected z_score to increase with more cases: {z_score_10} >= {z_score_4}"
        )


class TestAutoConfirm:
    """Verify high confidence (>=85%) auto-confirms alert."""

    @pytest.mark.asyncio
    async def test_low_confidence_stays_pending(
        self, client: AsyncClient, db_session: AsyncSession, seed_diseases, httpx_mock, auth_headers
    ):
        payload = {
            "facility_id": "EGY-AC-01",
            "physician_id": "dr-auto-01",
            "governorate": "Cairo",
            "district": "Nasr City",
            "age_group": "30-59",
            "sex": "Male",
            "icd10_code": "A39.0",
            "symptom_onset_date": "2026-06-15",
            "diagnosis_basis": "Clinical",
            "hospitalized": True,
            "outcome": "Alive",
            "lab_sample_taken": True,
            "submission_mode": "online",
        }
        response = await client.post("/api/v1/report", json=payload, headers=auth_headers)
        assert response.status_code == 201

        await asyncio.sleep(0.5)

        result = await db_session.execute(
            select(Alert)
            .where(Alert.icd10_code == "A39.0")
            .order_by(Alert.created_at.desc())
        )
        alert = result.scalars().first()
        assert alert is not None
        assert alert.status == "pending", f"Single report should be pending, got {alert.status}"
        assert alert.confidence < 0.85

    @pytest.mark.asyncio
    async def test_high_confidence_auto_confirms(
        self, db_session: AsyncSession, seed_diseases, httpx_mock
    ):
        icd10_code = "A39.0"
        governorate = "Cairo"
        now = datetime.now(timezone.utc)
        epi_week = now.isocalendar()[1]

        for i in range(12):
            report = CaseReport(
                id=uuid.uuid4(),
                report_id=uuid.uuid4(),
                submitted_at=now - timedelta(minutes=2 * i),
                epi_week=epi_week,
                facility_id=f"EGY-AC-{i}",
                physician_id=f"dr-auto-{i}",
                governorate=governorate,
                district="Nasr City",
                age_group="30-59",
                sex="Male",
                icd10_code=icd10_code,
                disease_name="Meningococcal Meningitis",
                reporting_group="A",
                symptom_onset_date=now.date(),
                diagnosis_basis="Clinical",
                hospitalized=True,
                outcome="Alive",
                lab_sample_taken=True,
                submission_mode="online",
            )
            db_session.add(report)
        await db_session.commit()

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

        from services.anomaly import OutbreakDetector
        from services.alert_dispatcher import trigger_immediate_alert

        detector = OutbreakDetector()
        alert_level, z_score, confidence = await detector.check_cluster(
            db_session, governorate, icd10_code
        )

        assert confidence >= 0.85, f"Expected confidence >= 0.85, got {confidence}"

        alert = await trigger_immediate_alert(
            db_session, report, alert_level, z_score, confidence
        )
        assert alert.status == "confirmed", f"High confidence should be confirmed, got {alert.status}"
