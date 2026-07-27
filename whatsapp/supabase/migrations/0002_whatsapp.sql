-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: integração WhatsApp (conversas/mensagens) + etiquetas
-- Ver services/whatsapp/ para a camada de provider (mock | cloud-api) que alimenta estas tabelas.

-- Etiquetas livres, definidas pelo usuário — reutilizáveis entre contatos.
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'slate',
  created_at timestamptz not null default now()
);
create unique index if not exists idx_tags_name_lower on tags (lower(name));

create table if not exists contact_tags (
  contact_id uuid not null references contacts (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
create index if not exists idx_contact_tags_tag_id on contact_tags (tag_id);

-- Telefone passa a ser único e normalizado (dígitos + DDI 55) para casar de forma
-- confiável com o remetente do WhatsApp. Normaliza dados existentes antes de travar.
update contacts
set phone = case
  when regexp_replace(phone, '\D', '', 'g') like '55%'
    then regexp_replace(phone, '\D', '', 'g')
  else '55' || regexp_replace(phone, '\D', '', 'g')
end;

alter table contacts add constraint contacts_phone_unique unique (phone);

-- Conversas: 1:1 com contacts (um contato tem no máximo uma conversa de WhatsApp).
create table if not exists whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references contacts (id) on delete cascade,
  wa_phone_number text not null,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text check (last_message_direction in ('inbound', 'outbound')),
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_conversations_last_message_at on whatsapp_conversations (last_message_at desc);
create index if not exists idx_whatsapp_conversations_wa_phone_number on whatsapp_conversations (wa_phone_number);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations (id) on delete cascade,
  wa_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text' check (message_type in ('text', 'unsupported')),
  body text not null,
  status text not null default 'received' check (
    status in ('sent', 'delivered', 'read', 'failed', 'received')
  ),
  error_message text,
  created_by text,
  wa_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);
-- Dedup por id da Meta: retries do webhook não duplicam a mesma mensagem.
create unique index if not exists idx_whatsapp_messages_wa_message_id
  on whatsapp_messages (wa_message_id) where wa_message_id is not null;
create index if not exists idx_whatsapp_messages_conversation_id on whatsapp_messages (conversation_id);
create index if not exists idx_whatsapp_messages_wa_timestamp on whatsapp_messages (wa_timestamp);

drop trigger if exists trg_whatsapp_conversations_updated_at on whatsapp_conversations;
create trigger trg_whatsapp_conversations_updated_at
  before update on whatsapp_conversations
  for each row execute function set_updated_at();

alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table whatsapp_conversations enable row level security;
alter table whatsapp_messages enable row level security;

drop policy if exists "Allow all on tags" on tags;
create policy "Allow all on tags" on tags for all using (true) with check (true);

drop policy if exists "Allow all on contact_tags" on contact_tags;
create policy "Allow all on contact_tags" on contact_tags for all using (true) with check (true);

drop policy if exists "Allow all on whatsapp_conversations" on whatsapp_conversations;
create policy "Allow all on whatsapp_conversations" on whatsapp_conversations for all using (true) with check (true);

drop policy if exists "Allow all on whatsapp_messages" on whatsapp_messages;
create policy "Allow all on whatsapp_messages" on whatsapp_messages for all using (true) with check (true);
