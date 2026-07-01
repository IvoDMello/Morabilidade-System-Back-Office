-- Unifica os dois campos de link do Instagram em um só (instagram_url).
-- video_url (botão "Ver vídeo no Instagram" no site) e instagram_url (pill no site
-- + indicador rosa na listagem do painel) guardavam o mesmo tipo de link.
--
-- ORDEM: rodar DEPOIS do deploy da API que remove video_url do código —
-- a API antiga ainda insere/seleciona a coluna e quebraria com ela dropada.

UPDATE imoveis
   SET instagram_url = video_url
 WHERE instagram_url IS NULL
   AND video_url IS NOT NULL;

ALTER TABLE imoveis
  DROP COLUMN IF EXISTS video_url;
