-- =====================================================================
-- Migration 0017, novo status 'publicada'
--
-- Estado terminal do fluxo: a captação foi gravada e o anúncio/vídeo
-- publicado. O cartão sai das colunas ativas do quadro e passa a ser
-- consultável na aba oculta "Publicadas" (com a data em publicada_em,
-- adicionada na 0018).
--
-- IMPORTANTE: rodar SOZINHA no Supabase, antes do deploy. Postgres não
-- permite usar um valor de enum recém-adicionado na mesma transação do
-- ALTER TYPE (a 0018 depende deste valor já existir).
-- =====================================================================

alter type captacoes.status add value if not exists 'publicada';
