from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://epilink:password@localhost:5432/epilink_db"
    ministry_webhook_url: str = "https://mock-ministry.epilink.io/webhook"
    who_fhir_url: str = Field(default="https://mock-who.epilink.io/fhir", alias="WHO_WEBHOOK_URL")
    admin_webhook_url: str = "https://mock-admin.epilink.io/webhook"
    twilio_account_sid: str = "ACxxxxxxxx"
    twilio_auth_token: str = "xxxxxxxx"
    twilio_phone_number: str = ""
    secret_key: str = "change-me-in-production"
    environment: str = "development"
    groq_api_key: str = ""
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        case_sensitive = False
        populate_by_name = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()