-- 054: link do vídeo do imóvel no YouTube.
--
-- Irmã de instagram_url (036/050): o mesmo vídeo de apresentação vive nos dois
-- canais, e a página do imóvel no site passa a oferecer os dois botões, um
-- embaixo do outro. Campo público, flui pelo /imoveis/publico/{codigo}.
--
-- APLICADA no Supabase em 2026-09-20. Idempotente (IF NOT EXISTS), não precisa
-- rodar de novo.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

COMMENT ON COLUMN imoveis.youtube_url IS
  'URL pública do vídeo no YouTube; vira o botão "Ver vídeo no YouTube" na página do imóvel.';
