-- Campo título para imóveis.
-- titulo: rótulo público exibido na página de detalhe do imóvel
-- (substitui a exibição do endereço completo no site público).

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS titulo TEXT;