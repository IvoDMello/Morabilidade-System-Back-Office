-- =====================================================================
-- Migration 0025, apto e unidade separados
--
-- A 0014 criou `unidade` como "Apto / unidade" num campo só, e na prática
-- toda captação guardou ali o número do apartamento (é assim que o quadro
-- mostra: "ap 302"). A equipe quer os dois em campos próprios, então:
--
-- 1. `unidade` vira `apto`, levando junto o que já foi preenchido.
-- 2. Nasce uma `unidade` nova, vazia, para o campo que ocupa o lugar do
--    andar no formulário.
--
-- `andar` sai do formulário (a equipe não usa), mas a coluna fica: o
-- cadastro no back-office e a página pública ainda leem o que já existe.
-- =====================================================================

alter table captacoes.captacao
  rename column unidade to apto;

alter table captacoes.captacao
  add column if not exists unidade text;

notify pgrst, 'reload schema';
