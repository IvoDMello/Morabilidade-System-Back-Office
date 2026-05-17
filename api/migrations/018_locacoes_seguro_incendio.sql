-- Migration 018: Seguro incêndio anual no contrato de locação.
--
-- Motivação:
--   Padrão de mercado (Jetmob, locação residencial) — a apólice é anual
--   mas costuma ser cobrada em 12 parcelas mensais junto ao aluguel.
--   Tratamos como o IPTU: campo anual + flag "incluir na cobrança".
--   Divisor fixo em 12 (regra de mercado); IPTU usa 10 porque é municipal RJ.

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS seguro_incendio_anual numeric(10,2) NOT NULL DEFAULT 0
        CHECK (seguro_incendio_anual >= 0);

ALTER TABLE contratos_locacao
    ADD COLUMN IF NOT EXISTS incluir_seguro_incendio_cobranca boolean NOT NULL DEFAULT false;
