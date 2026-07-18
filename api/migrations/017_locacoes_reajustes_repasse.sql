-- Migration 017: Reajuste anual + repasse ao proprietário.
--
-- Motivação:
--   - Hoje o reajuste anual (IGPM/IPCA) é feito editando o aluguel mensal
--     e perdendo o histórico. Esta migration introduz uma tabela de
--     reajustes para auditoria, e formaliza o cálculo de repasse ao
--     proprietário com uma taxa de administração por contrato.
--   - Não buscamos índices externos automaticamente, o usuário informa
--     o percentual (lê IGPM/IPCA por fora) e o sistema registra a
--     aplicação no aniversário do contrato.

-- 1) Taxa de administração por contrato -------------------------------------

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS taxa_administracao_pct numeric(5,2) NOT NULL DEFAULT 0
        CHECK (taxa_administracao_pct >= 0 AND taxa_administracao_pct <= 100);
-- Percentual sobre o aluguel pago que a imobiliária retém antes do repasse.
-- Default 0 mantém comportamento existente para contratos pré-fase 5.


-- 2) Histórico de reajustes -------------------------------------------------

CREATE TABLE IF NOT EXISTS locacao_reajustes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id         uuid NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,

    data_aplicacao      date NOT NULL,
    percentual          numeric(6,3) NOT NULL,
    -- Permite negativo (descontos negociados) e até 3 casas (IGPM costuma
    -- vir com 2-3 decimais publicados pela FGV).

    aluguel_anterior    numeric(12,2) NOT NULL CHECK (aluguel_anterior >= 0),
    aluguel_novo        numeric(12,2) NOT NULL CHECK (aluguel_novo >= 0),

    indice_referencia   text,
    -- 'IGPM', 'IPCA', 'IGPM-12m', etc. Texto livre, não amarra o sistema
    -- a uma lista fechada de índices.
    observacoes         text,

    applied_by          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locacao_reajustes_contrato_data
    ON locacao_reajustes(contrato_id, data_aplicacao DESC);
