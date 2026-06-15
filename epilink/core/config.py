from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://epilink:password@localhost:5432/epilink_db"
    ministry_webhook_url: str = "https://mock-ministry.epilink.io/webhook"
    who_webhook_url: str = "https://mock-who.epilink.io/webhook"
    admin_webhook_url: str = "https://mock-admin.epilink.io/webhook"
    twilio_account_sid: str = "ACxxxxxxxx"
    twilio_auth_token: str = "xxxxxxxx"
    secret_key: str = "change-me-in-production"
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
