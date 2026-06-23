-- =====================================================================
-- Valores do imóvel: condomínio, IPTU e valor de venda.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists valor_condominio numeric,
  add column if not exists valor_iptu       numeric,
  add column if not exists valor_venda      numeric;

notify pgrst, 'reload schema';
