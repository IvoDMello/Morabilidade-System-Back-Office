-- 0000: schema `whatsapp` no Supabase PRINCIPAL do sistema (integração do
-- painel-crm ao monorepo, 2026-07-25).
--
-- Motivação: o CRM foi desenvolvido num Supabase próprio com tabelas no schema
-- public. No banco principal, `tags` colidiria com a tabela homônima da API, e
-- misturar 12 tabelas novas no public dificultaria a operação. Mesmo padrão das
-- captações: schema próprio + client supabase-js com `db: { schema: "whatsapp" }`.
--
-- ATENÇÃO (mesmo drill das captações): depois de rodar, expor o schema em
-- Settings → API → "Exposed schemas" (adicionar `whatsapp`), senão o PostgREST
-- responde 406 para tudo.
--
-- As migrations 0001..0011 seguintes começam com `set search_path to whatsapp;`
-- e devem ser rodadas na ordem numérica, uma por vez, no SQL Editor.

create schema if not exists whatsapp;

-- PostgREST precisa de USAGE para enxergar o schema; os GRANTs de tabela são
-- garantidos pelos default privileges abaixo (valem para objetos futuros).
grant usage on schema whatsapp to anon, authenticated, service_role;

alter default privileges in schema whatsapp
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema whatsapp
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema whatsapp
  grant execute on functions to anon, authenticated, service_role;
