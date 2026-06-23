-- =====================================================================
-- Número de suítes e metragem (área em m²) do imóvel.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists suites   smallint,
  add column if not exists metragem numeric;   -- área em m²

notify pgrst, 'reload schema';
