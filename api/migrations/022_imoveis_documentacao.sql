-- Campos de documentação e idade do prédio para imóveis.
-- idade_predio: idade em anos (campo informativo quando ano_construcao é desconhecido).
-- inscricao_municipal, rgi, numero_matricula: documentos do imóvel.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS idade_predio SMALLINT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS rgi TEXT,
  ADD COLUMN IF NOT EXISTS numero_matricula TEXT;

ALTER TABLE imoveis
  ADD CONSTRAINT imoveis_idade_predio_check
  CHECK (idade_predio IS NULL OR idade_predio BETWEEN 0 AND 500);
