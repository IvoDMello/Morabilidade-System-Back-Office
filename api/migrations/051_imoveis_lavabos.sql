-- 051: campo lavabos no cadastro de imóveis
-- Lavabo = banheiro social sem chuveiro; contado separado dos banheiros.
ALTER TABLE imoveis ADD COLUMN lavabos integer;
