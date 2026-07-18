-- Migration 029: Observações internas no contrato de locação.
--
-- Motivação:
--   Campo de texto livre para a equipe da imobiliária anotar instruções
--   internas sobre o contrato, por exemplo, "como baixar o boleto desta
--   locação". NÃO aparece no demonstrativo PDF enviado ao locatário (é
--   distinto de `observacoes_demonstrativo`, que é externo).

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS observacoes_internas TEXT;
