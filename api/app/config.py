from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Firebase
    firebase_credentials_path: str = "firebase-credentials.json"
    firebase_storage_bucket: str

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

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
