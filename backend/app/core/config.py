from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/project_governance"
    api_key: str = "change-me-local-dev-key"
    cors_origins: str = "http://localhost:3000"
    document_storage_dir: str = "./storage/documents"
    # Hand-formatted Excel import templates ("<slug>-template.xlsx"); a screen
    # falls back to its auto-generated template when the file is absent.
    import_template_dir: str = "./import_templates"

    # "no_password" (dev-only identifier lookup), "password" (identifier + a
    # local scrypt-hashed password, see app/core/security.py), or "onelogin"
    # (OIDC SSO).
    auth_type: str = "no_password"
    session_secret: str = "change-me-session-secret"
    session_ttl_minutes: int = 480
    # False on plain-HTTP internal envs; set True once served over HTTPS.
    session_cookie_secure: bool = False
    frontend_base_url: str = "http://localhost:3000"

    # Background notification scans (overdue assessments / report defaulters /
    # actions due). The APScheduler job runs from main.py's lifespan, which
    # httpx.ASGITransport does not fire — so this is effectively off under pytest.
    enable_scheduler: bool = True
    notification_scan_hour: int = 7  # local server hour for the daily run

    # Only required when auth_type=onelogin.
    onelogin_client_id: str = ""
    onelogin_client_secret: str = ""
    onelogin_issuer: str = ""
    onelogin_redirect_uri: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
