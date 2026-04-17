from supabase import create_client, Client
from app.config import settings

# Cliente com anon key (operações autenticadas via JWT do usuário)
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)

# Cliente com service role (operações administrativas sem RLS)
supabase_admin: Client = create_client(
    settings.supabase_url, settings.supabase_service_role_key
)
