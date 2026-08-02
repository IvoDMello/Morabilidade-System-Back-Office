-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Bloco Fundação (parte 2): atribuição a corretor + papel do contato no imóvel.
-- Depende de 0017 (tabela corretores).

-- Responsável pelo contato/lead. on delete set null: apagar um corretor não
-- apaga contatos, só os "desatribui".
alter table contacts add column if not exists corretor_id uuid
  references corretores (id) on delete set null;
create index if not exists idx_contacts_corretor_id on contacts (corretor_id);

-- Quem executa a visita/tarefa do lembrete (alimenta a agenda no próximo bloco).
alter table contact_reminders add column if not exists corretor_id uuid
  references corretores (id) on delete set null;
create index if not exists idx_contact_reminders_corretor_id on contact_reminders (corretor_id);

-- Papel do contato no imóvel (ORTOGONAL ao stage, que é o funil de interesse).
-- Um papel por par contato-imóvel (a PK da tabela continua (contact_id, property_id)).
alter table contact_properties add column if not exists relacao text not null default 'interesse'
  check (relacao in ('proprietario', 'interesse', 'visitado'));

-- Novos eventos automáticos na Timeline: atribuição e mudança de papel.
-- Mantém TODOS os tipos já existentes (inclui contact_blocked/unblocked de
-- migration posterior) e acrescenta os dois novos.
alter table contact_events drop constraint if exists contact_events_type_check;
alter table contact_events add constraint contact_events_type_check check (
  type in (
    'contact_created', 'status_changed', 'reminder_created', 'reminder_completed',
    'reminder_cancelled', 'tag_added', 'tag_removed',
    'property_linked', 'property_stage_changed', 'property_unlinked',
    'contact_blocked', 'contact_unblocked',
    'contact_assigned', 'property_relation_changed'
  )
);
