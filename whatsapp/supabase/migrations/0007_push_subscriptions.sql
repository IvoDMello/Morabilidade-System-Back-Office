-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Inscrições de Web Push (notificação no celular/desktop ao chegar mensagem).
-- Sem vínculo com usuário (sem autenticação nesta fase) — qualquer dispositivo
-- inscrito recebe as notificações de todas as mensagens recebidas.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Allow all on push_subscriptions" on push_subscriptions;
create policy "Allow all on push_subscriptions" on push_subscriptions for all using (true) with check (true);
