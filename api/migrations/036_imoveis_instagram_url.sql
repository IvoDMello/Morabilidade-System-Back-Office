-- Link do anúncio do imóvel no Instagram (@morabilidade).
-- instagram_url: URL pública do post/reel exibida na página do imóvel no site.
-- Campo público (não é documentação interna), flui pelo endpoint /imoveis/publico/{codigo}.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;
