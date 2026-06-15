import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_db_file: str = _tmp.name
_tmp.close()

TEST_ENGINE = create_async_engine(
    f"sqlite+aiosqlite:///{_db_file}?check_same_thread=False",
    echo=False,
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(
    TEST_ENGINE, class_=AsyncSession, expire_on_commit=False
)

# Must patch BEFORE importing main/app so all modules see the test factory
from core import database as core_database
core_database.async_session_factory = TestSessionLocal

from core.database import Base, get_db
from main import app


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def session_cleanup():
    yield
    if os.path.exists(_db_file):
        try:
            os.unlink(_db_file)
        except PermissionError:
            pass


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def seed_diseases(db_session: AsyncSession):
    from models.disease_registry import DiseaseRegistry

    group_a = [
        ("A39.0", "Meningococcal Meningitis", "A", 60),
        ("A80", "Acute Flaccid Paralysis", "A", 60),
        ("A00.1", "Cholera", "A", 60),
        ("B26_MU", "Mumps", "A", 60),
    ]
    group_b = [
        ("B26", "Viral Hepatitis", "B", None),
        ("A01.0", "Typhoid Fever", "B", None),
    ]
    all_diseases = group_a + group_b
    for code, name, grp, mins in all_diseases:
        d = DiseaseRegistry(
            icd10_code=code,
            name=name,
            group_label=grp,
            alert_minutes=mins,
        )
        db_session.add(d)
    await db_session.commit()