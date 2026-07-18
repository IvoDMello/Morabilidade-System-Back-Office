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
    email_from: str = "noreply@morabilidade.com"
    email_contato: str = "contato@morabilidade.com"

    # URLs públicas usadas em e-mails e templates
    site_url: str = "https://morabilidade.com"

    # Segredo compartilhado com o site público para revalidação on-demand do
    # cache ISR (POST {site_url}/api/revalidate). Precisa ser IDÊNTICO ao
    # REVALIDATE_SECRET no projeto Vercel do site. Vazio desliga a integração
    # (o site cai de volta no ISR por tempo).
    site_revalidate_secret: str = ""

    # Dados da empresa para documentos legais (ficha de visita, intermediação).
    # Placeholders até confirmação do CNPJ/CRECI-J jurídico, sobrescrever via env.
    empresa_cnpj: str = ""
    empresa_creci_juridico: str = ""
    empresa_creci_corretor: str = "CRECI-RJ nº 70411"
    empresa_telefone: str = "(21) 99772-9990"

    # Aplicação
    app_env: str = "development"
    app_secret_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Nº de proxies confiáveis na frente da API que ACRESCENTAM ao X-Forwarded-For.
    # No Railway são 2 (borda + LB interno), confirmado empiricamente: numa
    # requisição real o XFF chegou com 2 entradas (cliente, borda). O IP real do
    # cliente fica em xff[-trusted_proxy_hops]; entradas à esquerda são
    # controláveis pelo cliente (spoof). Se um CDN (ex.: Cloudflare) entrar na
    # frente, suba este valor. Usado na trilha de auditoria das assinaturas.
    trusted_proxy_hops: int = 2

    # Monitoramento
    sentry_dsn: str = ""

    # Token compartilhado com o cron externo (Railway Cron) que dispara
    # o relatório automático de 30 dias. Sem token configurado o endpoint
    # interno fica inacessível.
    cron_token: str = ""

    # Token compartilhado para chamadas server-to-server de integração (ex.: o
    # site de captações criando imóvel/proprietário). Quem envia o header
    # X-Internal-Token com este valor escreve sem precisar de perfil admin
    # mas o tráfego normal do painel continua exigindo admin/corretor. Vazio
    # desliga o atalho de integração.
    internal_api_token: str = ""

    # Agendador interno (APScheduler) que dispara o relatório de 30 dias
    # diariamente, dentro do próprio processo web. `scheduler_enabled=false`
    # desliga (kill-switch de ops). Hora no fuso America/Sao_Paulo.
    scheduler_enabled: bool = True
    relatorio_30dias_hora: int = 9
    # Janela de captação: só envia para imóveis que cruzaram os 30 dias nos
    # últimos N dias (idade entre 30 e 30+N). Mantém o histórico antigo de fora
    # (evita disparar o portfólio inteiro no 1º run) e dá folga p/ execução
    # perdida sem reenviar (o flag relatorio_30dias_enviado_em garante 1×).
    relatorio_30dias_janela_dias: int = 7

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
