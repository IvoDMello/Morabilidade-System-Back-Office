from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # E-mail
    resend_api_key: str
    email_from: str = "noreply@morabilidade.com.br"
    email_contato: str = "contato@morabilidade.com.br"

    # Aplicação
    app_env: str = "development"
    app_secret_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Monitoramento
    sentry_dsn: str = ""

    @model_validator(mode="after")
    def validate_cors_production(self) -> "Settings":
        if self.app_env == "production" and "localhost" in self.cors_origins:
            raise ValueError(
                "CORS_ORIGINS não pode conter localhost em produção. "
                "Defina a variável de ambiente CORS_ORIGINS com os domínios reais."
            )
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
