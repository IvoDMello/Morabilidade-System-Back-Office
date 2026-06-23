-- =====================================================================
-- Capa do cartão: thumb_path da foto escolhida como capa, desnormalizada
-- na própria captação para o board carregar rápido (sem join por cartão).
-- =====================================================================

alter table captacoes.captacao
  add column if not exists capa_path text;
