-- =====================================================================
-- Link do anúncio: quando o proprietário manda o link do anúncio
-- em vez de fotos. Clicável no card e no detalhe.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists anuncio_url text;
