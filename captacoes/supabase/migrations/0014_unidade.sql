-- =====================================================================
-- Número do apartamento / unidade (ex.: "302", "Bloco B ap 104").
-- =====================================================================

alter table captacoes.captacao
  add column if not exists unidade text;

notify pgrst, 'reload schema';
