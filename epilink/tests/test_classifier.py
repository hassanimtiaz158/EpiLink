import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from services.classifier import (
    classify_reporting_group,
    get_alert_window_minutes,
    is_immediate_alert,
    validate_icd10,
    get_disease_name,
)


class TestClassifier:
    @pytest.mark.asyncio
    async def test_validate_icd10_found(self, db_session: AsyncSession, seed_diseases):
        assert await validate_icd10(db_session, "A39.0") is True
        assert await validate_icd10(db_session, "B26") is True

    @pytest.mark.asyncio
    async def test_validate_icd10_not_found(self, db_session: AsyncSession, seed_diseases):
        assert await validate_icd10(db_session, "ZZZ99") is False

    @pytest.mark.asyncio
    async def test_classify_group_a(self, db_session: AsyncSession, seed_diseases):
        assert await classify_reporting_group(db_session, "A39.0") == "A"
        assert await classify_reporting_group(db_session, "A00.1") == "A"

    @pytest.mark.asyncio
    async def test_classify_group_b(self, db_session: AsyncSession, seed_diseases):
        assert await classify_reporting_group(db_session, "B26") == "B"

    @pytest.mark.asyncio
    async def test_classify_not_found(self, db_session: AsyncSession, seed_diseases):
        with pytest.raises(ValueError, match="not found"):
            await classify_reporting_group(db_session, "INVALID")

    @pytest.mark.asyncio
    async def test_alert_window_minutes(self, db_session: AsyncSession, seed_diseases):
        assert await get_alert_window_minutes(db_session, "A39.0") == 60
        assert await get_alert_window_minutes(db_session, "B26") is None

    @pytest.mark.asyncio
    async def test_is_immediate_alert(self, db_session: AsyncSession, seed_diseases):
        assert await is_immediate_alert(db_session, "A39.0") is True
        assert await is_immediate_alert(db_session, "B26") is False

    @pytest.mark.asyncio
    async def test_get_disease_name(self, db_session: AsyncSession, seed_diseases):
        assert await get_disease_name(db_session, "A39.0") == "Meningococcal Meningitis"
        assert await get_disease_name(db_session, "B26") == "Viral Hepatitis"

    @pytest.mark.asyncio
    async def test_b26_mu_classification(self, db_session: AsyncSession, seed_diseases):
        assert await classify_reporting_group(db_session, "B26_MU") == "A"
        assert await is_immediate_alert(db_session, "B26_MU") is True
