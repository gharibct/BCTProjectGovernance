from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/project_governance"
    api_key: str = "change-me-local-dev-key"
    cors_origins: str = "http://localhost:3000"
    document_storage_dir: str = "./storage/documents"

    # "no_password" (dev-only identifier lookup) or "onelogin" (OIDC SSO).
    auth_type: str = "no_password"
    session_secret: str = "change-me-session-secret"
    session_ttl_minutes: int = 480
    # False on plain-HTTP internal envs; set True once served over HTTPS.
    session_cookie_secure: bool = False
    frontend_base_url: str = "http://localhost:3000"

    # Only required when auth_type=onelogin.
    onelogin_client_id: str = ""
    onelogin_client_secret: str = ""
    onelogin_issuer: str = ""
    onelogin_redirect_uri: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
