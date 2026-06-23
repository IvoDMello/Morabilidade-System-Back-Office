-- =====================================================================
-- Vagas de garagem.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists vagas smallint;

notify pgrst, 'reload schema';
