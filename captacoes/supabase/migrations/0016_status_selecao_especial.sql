-- =====================================================================
-- Migration 0016, novo status 'selecao_especial'
--
-- Coluna para imóveis fora dos bairros habituais que merecem atenção
-- especial (meta: 1 por mês).
--
-- IMPORTANTE: rodar SOZINHA no Supabase, antes do deploy. Postgres não
-- permite usar um valor de enum recém-adicionado na mesma transação do
-- ALTER TYPE.
-- =====================================================================

alter type captacoes.status add value if not exists 'selecao_especial';
