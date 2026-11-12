from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    app_name: str = "HRMS"
    # Fail-closed: set ENVIRONMENT=development in your local .env
    environment: str = "production"

    database_url: str

    secret_key: str
    algorithm: str = "HS256"
    # Short-lived access token + longer-lived refresh token (both HttpOnly cookies)
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    access_cookie_name: str = "access_token"
    refresh_cookie_name: str = "refresh_token"

    cors_origins: str = "http://localhost:5173"

    login_max_attempts: int = 5
    login_lock_minutes: int = 15

    # Email. Leave smtp_host empty in development: emails print to the console.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def _check_secret(self):
        if self.secret_key in ("", "change-me") or len(self.secret_key) < 32:
            raise ValueError(
                "SECRET_KEY must be a random string of at least 32 characters"
            )
        return self

    @property
    def cookie_secure(self) -> bool:
        # Cookies are HTTPS-only everywhere except local development
        return self.environment != "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()