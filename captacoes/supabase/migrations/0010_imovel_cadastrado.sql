-- =====================================================================
-- Vínculo da captação com o imóvel cadastrado no back-office (schema public).
-- Preenchido pelo botão "Cadastrar imóvel no sistema" na tela de detalhe.
-- imovel_id/codigo referenciam o registro em public.imoveis (banco compartilhado).
-- =====================================================================

alter table captacoes.captacao
  add column if not exists imovel_id      uuid,
  add column if not exists imovel_codigo  text,
  add column if not exists cadastrado_em  timestamptz,
  add column if not exists cadastrado_por uuid references auth.users(id);

notify pgrst, 'reload schema';
