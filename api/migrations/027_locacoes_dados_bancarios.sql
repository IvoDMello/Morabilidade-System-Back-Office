-- Migration 027: Dados bancários do contrato (banco/agência/conta) para sair
-- no demonstrativo PDF, complementando o PIX já existente.
--
-- Motivação:
--   Nem todo locatário paga por PIX; alguns preferem TED/DOC. O demonstrativo
--   precisa imprimir banco + agência + conta para o proprietário receber.
--   Campos opcionais — quando vazios, a seção bancária não aparece no PDF.

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS dados_cobranca_banco text,
    ADD COLUMN IF NOT EXISTS dados_cobranca_agencia text,
    ADD COLUMN IF NOT EXISTS dados_cobranca_conta text;
