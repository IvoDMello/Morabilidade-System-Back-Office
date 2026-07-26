-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: schema inicial (contatos, anotações, lembretes)
-- Categorias e status ficam como TEXT + CHECK (em vez de ENUM do Postgres)
-- para permitir adicionar novos valores sem precisar de ALTER TYPE.

create extension if not exists "pgcrypto";

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  category text not null check (
    category in ('proprietario', 'cliente', 'locatario', 'lead', 'parceiro', 'outro')
  ),
  status text not null default 'novo' check (
    status in (
      'novo', 'em_atendimento', 'aguardando_retorno', 'visita_marcada',
      'documentacao', 'finalizado', 'perdido'
    )
  ),
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico permanente de anotações: apenas insert, nunca update/delete pela aplicação.
create table if not exists contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  note text not null,
  -- TODO(futuro/multi-atendente): trocar para uuid references auth.users(id)
  -- quando o controle de usuários/permissões for implementado.
  created_by text not null default 'Sistema',
  created_at timestamptz not null default now()
);

create table if not exists contact_reminders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  title text not null,
  description text,
  reminder_at timestamptz not null,
  status text not null default 'pendente' check (
    status in ('pendente', 'concluido', 'cancelado')
  ),
  -- TODO(futuro/multi-atendente): trocar para uuid references auth.users(id).
  created_by text not null default 'Sistema',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_category on contacts (category);
create index if not exists idx_contacts_status on contacts (status);
create index if not exists idx_contacts_updated_at on contacts (updated_at desc);

create index if not exists idx_contact_notes_contact_id on contact_notes (contact_id);

create index if not exists idx_contact_reminders_contact_id on contact_reminders (contact_id);
create index if not exists idx_contact_reminders_reminder_at on contact_reminders (reminder_at);
create index if not exists idx_contact_reminders_status on contact_reminders (status);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_contacts_updated_at on contacts;
create trigger trg_contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

drop trigger if exists trg_contact_reminders_updated_at on contact_reminders;
create trigger trg_contact_reminders_updated_at
  before update on contact_reminders
  for each row execute function set_updated_at();

-- RLS habilitado desde já para preparar o terreno para autenticação futura.
-- Por enquanto, política permissiva (sem login nesta fase 1) — restringir quando
-- o controle de usuários/permissões (item 13 do escopo) for implementado.
alter table contacts enable row level security;
alter table contact_notes enable row level security;
alter table contact_reminders enable row level security;

drop policy if exists "Allow all on contacts" on contacts;
create policy "Allow all on contacts" on contacts for all using (true) with check (true);

drop policy if exists "Allow all on contact_notes" on contact_notes;
create policy "Allow all on contact_notes" on contact_notes for all using (true) with check (true);

drop policy if exists "Allow all on contact_reminders" on contact_reminders;
create policy "Allow all on contact_reminders" on contact_reminders for all using (true) with check (true);
