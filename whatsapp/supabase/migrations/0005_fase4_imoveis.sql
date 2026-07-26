-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 4 do roadmap operacional — integração com imóveis.

-- Imóveis são identificados por um código curto (ex.: MB-00033) — não guardamos
-- ficha completa do imóvel aqui, só o suficiente para vincular a contatos.
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_properties_code_lower on properties (lower(code));

-- Relação N:N contato-imóvel com a etapa atual do interesse (não é um log de
-- eventos — a Timeline automática, via contact_events, cobre o histórico).
create table if not exists contact_properties (
  contact_id uuid not null references contacts (id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  stage text not null default 'interesse' check (stage in ('interesse', 'visita', 'proposta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (contact_id, property_id)
);
create index if not exists idx_contact_properties_property_id on contact_properties (property_id);

drop trigger if exists trg_contact_properties_updated_at on contact_properties;
create trigger trg_contact_properties_updated_at
  before update on contact_properties
  for each row execute function set_updated_at();

alter table properties enable row level security;
alter table contact_properties enable row level security;

drop policy if exists "Allow all on properties" on properties;
create policy "Allow all on properties" on properties for all using (true) with check (true);

drop policy if exists "Allow all on contact_properties" on contact_properties;
create policy "Allow all on contact_properties" on contact_properties for all using (true) with check (true);

-- Estende o log de eventos automáticos (Fase 3) para cobrir vínculos de imóvel.
alter table contact_events drop constraint if exists contact_events_type_check;
alter table contact_events add constraint contact_events_type_check check (
  type in (
    'contact_created', 'status_changed', 'reminder_created', 'reminder_completed',
    'reminder_cancelled', 'tag_added', 'tag_removed',
    'property_linked', 'property_stage_changed', 'property_unlinked'
  )
);
