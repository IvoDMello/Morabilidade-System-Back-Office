-- "Sob consulta": esconde os valores do imóvel no site público mantendo-os
-- registrados internamente. Quando true, os endpoints públicos não enviam
-- valor_venda/valor_locacao, o site exibe "Sob consulta" no lugar.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS valor_sob_consulta BOOLEAN NOT NULL DEFAULT false;
