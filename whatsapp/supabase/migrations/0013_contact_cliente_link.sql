-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Liga o contato do WhatsApp ao cliente real do sistema (tabela public.clientes,
-- gerida pela API principal). O casamento é feito por telefone pelo CRM; aqui só
-- guardamos a referência (id) e um snapshot do código para exibir sem consultar
-- a API. Sem FK para public.clientes de propósito: os dois lados evoluem por
-- migrations independentes e não queremos acoplar o schema whatsapp ao catálogo.

alter table contacts add column if not exists cliente_id uuid;
alter table contacts add column if not exists cliente_codigo text;

-- Buscas por "contatos já vinculados a um cliente" e o guard de idempotência do
-- casamento automático (só tenta quando cliente_id is null).
create index if not exists contacts_cliente_id_idx on contacts (cliente_id);
