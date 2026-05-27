-- Migration 028: Internet mensal no contrato de locação.
--
-- Motivação:
--   Algumas locações incluem internet contratada pela imobiliária e repassada
--   ao locatário no demonstrativo. Mesmo padrão do condomínio: valor mensal
--   fixo + flag "incluir na cobrança".

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS internet_mensal numeric(10,2) NOT NULL DEFAULT 0
        CHECK (internet_mensal >= 0);

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS incluir_internet_cobranca boolean NOT NULL DEFAULT false;
