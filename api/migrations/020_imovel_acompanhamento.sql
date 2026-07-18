-- Migration 020: Acompanhamento de captação do imóvel.
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase, rodar no SQL Editor antes de usar a aba.
--
-- Três recursos alimentam um único objetivo: gerar transparência pro proprietário
-- sobre o que aconteceu com o imóvel desde que entrou no portfólio.
--
-- 1. imovel_visitas      , histórico de quem visitou (manual + import CSV).
-- 2. imovel_percepcoes   , anotações internas do admin (alimentam o relatório).
-- 3. imoveis.relatorio_30dias_enviado_em, flag para impedir reenvio do relatório.
--
-- Visitas e percepções são preservadas mesmo após o imóvel sair de "disponível"
-- (venda/locação), só somem se o imóvel for deletado (ON DELETE CASCADE).

-- ── Visitas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imovel_visitas (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    imovel_id           uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    visitante_nome      text NOT NULL,
    visitante_telefone  text,
    data_visita         date NOT NULL,
    comentario          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imovel_visitas_imovel
    ON imovel_visitas(imovel_id, data_visita DESC);

COMMENT ON TABLE imovel_visitas IS
    'Visitas registradas manualmente ou importadas via CSV. Alimenta o relatório de 30 dias.';

-- ── Percepções (lista cronológica) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imovel_percepcoes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    imovel_id    uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    texto        text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imovel_percepcoes_imovel
    ON imovel_percepcoes(imovel_id, created_at DESC);

COMMENT ON TABLE imovel_percepcoes IS
    'Histórico de anotações internas do admin sobre o imóvel. Alimenta o relatório de 30 dias.';

-- ── Marcador anti-duplicação do relatório ──────────────────────────────────
ALTER TABLE imoveis
    ADD COLUMN IF NOT EXISTS relatorio_30dias_enviado_em timestamptz;

COMMENT ON COLUMN imoveis.relatorio_30dias_enviado_em IS
    'Timestamp do envio do relatório automático de 30 dias. NULL = ainda não enviado.';
