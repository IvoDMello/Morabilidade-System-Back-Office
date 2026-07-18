-- =====================================================================
-- Migration 0011, novo status 'gaveta'
--
-- IMPORTANTE: rodar SEPARADO da 0012. Postgres não permite usar um valor
-- de enum recém-adicionado na mesma transação do ALTER TYPE.
-- =====================================================================

alter type captacoes.status add value if not exists 'gaveta';
