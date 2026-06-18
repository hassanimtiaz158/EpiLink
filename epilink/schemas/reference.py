import uuid
from pydantic import BaseModel, ConfigDict


class DiseaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    icd10_code: str
    name: str
    group_label: str
    alert_minutes: int | None = None
    description: str | None = None
