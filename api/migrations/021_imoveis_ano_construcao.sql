-- Ano de construção do prédio/imóvel. A idade em anos é calculada na exibição.
-- Aceita valores futuros (imóveis na planta) e nulos (desconhecido).

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS ano_construcao SMALLINT;

ALTER TABLE imoveis
  ADD CONSTRAINT imoveis_ano_construcao_check
  CHECK (ano_construcao IS NULL OR ano_construcao BETWEEN 1900 AND 2100);
