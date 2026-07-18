-- Observações internas, texto livre, visível apenas para perfil admin.
-- Filtro do back-office e detalhe do imóvel devem omitir o campo para corretores.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT;
