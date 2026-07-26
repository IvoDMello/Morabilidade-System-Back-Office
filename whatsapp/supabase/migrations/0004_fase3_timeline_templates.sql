-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 3 do roadmap operacional — timeline automática e templates
-- rápidos de mensagem.

-- Log de eventos automáticos do sistema (não duplica conteúdo já guardado em
-- contact_notes/whatsapp_messages — só um resumo curto + timestamp). A tela de
-- contato mescla contact_events com contact_notes e whatsapp_messages para
-- montar a timeline em ordem cronológica.
create table if not exists contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type text not null check (
    type in (
      'contact_created', 'status_changed', 'reminder_created', 'reminder_completed',
      'reminder_cancelled', 'tag_added', 'tag_removed'
    )
  ),
  summary text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_events_contact_id on contact_events (contact_id);
create index if not exists idx_contact_events_created_at on contact_events (created_at desc);

alter table contact_events enable row level security;
drop policy if exists "Allow all on contact_events" on contact_events;
create policy "Allow all on contact_events" on contact_events for all using (true) with check (true);

-- Biblioteca de mensagens prontas, reutilizáveis em qualquer conversa.
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_templates_created_at on message_templates (created_at);

alter table message_templates enable row level security;
drop policy if exists "Allow all on message_templates" on message_templates;
create policy "Allow all on message_templates" on message_templates for all using (true) with check (true);

insert into message_templates (title, body)
select * from (values
  ('Fotos do imóvel', 'Segue em anexo as fotos do imóvel! Qualquer dúvida, estou à disposição.'),
  ('Localização', 'Aqui está a localização do imóvel: [inserir link do Google Maps]'),
  ('Agendar visita', 'Podemos agendar uma visita? Tenho disponibilidade nos seguintes horários: ...'),
  ('Solicitar documentos', 'Para darmos continuidade, preciso que você envie os seguintes documentos: RG, CPF e comprovante de renda.')
) as defaults (title, body)
where not exists (select 1 from message_templates);
