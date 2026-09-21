-- 054: link do vídeo do imóvel no YouTube.
--
-- Irmã de instagram_url (036/050): o mesmo vídeo de apresentação vive nos dois
-- canais, e a página do imóvel no site passa a oferecer os dois botões, um
-- embaixo do outro. Campo público, flui pelo /imoveis/publico/{codigo}.
--
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase, rodar no SQL Editor antes do deploy da
-- API que já grava a coluna.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

COMMENT ON COLUMN imoveis.youtube_url IS
  'URL pública do vídeo no YouTube; vira o botão "Ver vídeo no YouTube" na página do imóvel.';
