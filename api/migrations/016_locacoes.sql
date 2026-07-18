-- Migration 016: Módulo de Administração de Locações.
--
-- Motivação: a operação de locação (gerar demonstrativo mensal, controlar
-- inadimplência, guardar contrato em PDF) hoje é feita à mão em planilha +
-- Word. Esta migration introduz o modelo mínimo para automatizar:
--
--   1) contratos_locacao , um contrato por unidade locada (imóvel + locatário
--      + proprietário + valores e regras de cobrança).
--   2) locacao_pagamentos, uma linha por mês de competência, com snapshot do
--      valor devido (protege contra mudanças retroativas no contrato) e
--      status pago/pendente/atrasado/parcial.
--   3) locacao_anexos    , arquivos do contrato armazenados no Firebase
--      Storage (mesmo bucket usado por imovel_fotos).
--
-- Regras de cobrança (refletem o demonstrativo Artur Araripe que serve de
-- referência):
--   - Fundo de reserva SEMPRE deduz do total (é responsabilidade do
--     proprietário, não do locatário).
--   - Condomínio, fundo de obra e IPTU entram no total apenas se o checkbox
--     correspondente estiver ligado.
--   - IPTU, quando incluso na cobrança, é dividido em 10 parcelas (regra já
--     consolidada no painel, ver commit 99b2eb3).

-- 1) contratos_locacao -------------------------------------------------------

CREATE TABLE IF NOT EXISTS contratos_locacao (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Partes envolvidas
    imovel_id                   uuid NOT NULL REFERENCES imoveis(id) ON DELETE RESTRICT,
    proprietario_id             uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    locatario_id                uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,

    -- Vigência
    data_inicio                 date NOT NULL,
    data_fim                    date NOT NULL,
    dia_vencimento              smallint NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),

    -- Valores mensais
    aluguel_mensal              numeric(12,2) NOT NULL CHECK (aluguel_mensal >= 0),
    condominio_mensal           numeric(12,2) NOT NULL DEFAULT 0 CHECK (condominio_mensal >= 0),
    incluir_condominio_cobranca boolean NOT NULL DEFAULT true,

    fundo_reserva               numeric(12,2) NOT NULL DEFAULT 0 CHECK (fundo_reserva >= 0),
    -- Fundo de reserva sempre deduz, não há checkbox.

    fundo_obra                  numeric(12,2) NOT NULL DEFAULT 0 CHECK (fundo_obra >= 0),
    incluir_fundo_obra_cobranca boolean NOT NULL DEFAULT false,

    iptu_anual                  numeric(12,2) NOT NULL DEFAULT 0 CHECK (iptu_anual >= 0),
    incluir_iptu_cobranca       boolean NOT NULL DEFAULT false,
    -- Quando incluir_iptu_cobranca=true, o demonstrativo soma iptu_anual/10.

    numero_iptu                 text,

    -- Cobrança / demonstrativo
    dados_cobranca_pix          text,
    observacoes_demonstrativo   text,
    -- Texto livre que aparece no rodapé do PDF, substitui o aviso fixo.

    -- Status
    status                      text NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'em_encerramento', 'rescindido', 'encerrado')),
    motivo_rescisao             text,
    data_rescisao               date,

    -- Metadados
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),

    -- Coerência básica
    CONSTRAINT contratos_locacao_vigencia_check
        CHECK (data_fim > data_inicio),
    CONSTRAINT contratos_locacao_partes_distintas_check
        CHECK (proprietario_id <> locatario_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_locacao_status
    ON contratos_locacao(status);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_data_fim
    ON contratos_locacao(data_fim);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_imovel
    ON contratos_locacao(imovel_id);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_proprietario
    ON contratos_locacao(proprietario_id);
CREATE INDEX IF NOT EXISTS idx_contratos_locacao_locatario
    ON contratos_locacao(locatario_id);

-- Trigger para manter updated_at (reaproveita função existente se houver,
-- senão cria, padrão do projeto já usado em outras tabelas).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contratos_locacao_updated_at ON contratos_locacao;
CREATE TRIGGER trg_contratos_locacao_updated_at
    BEFORE UPDATE ON contratos_locacao
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2) locacao_pagamentos ------------------------------------------------------

CREATE TABLE IF NOT EXISTS locacao_pagamentos (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id                 uuid NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,

    -- Sempre dia 01 (ex: 2026-05-01 = competência maio/2026).
    -- Snapshot no momento da geração, protege relatórios contra alterações
    -- retroativas nos valores do contrato.
    mes_referencia              date NOT NULL,
    valor_devido                numeric(12,2) NOT NULL CHECK (valor_devido >= 0),

    valor_pago                  numeric(12,2),
    data_vencimento             date NOT NULL,
    data_pagamento              date,

    status                      text NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'pago', 'atrasado', 'parcial')),
    observacoes                 text,

    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT locacao_pagamentos_unico_por_mes
        UNIQUE (contrato_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_locacao_pagamentos_contrato_mes
    ON locacao_pagamentos(contrato_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_locacao_pagamentos_status_venc
    ON locacao_pagamentos(status, data_vencimento);

DROP TRIGGER IF EXISTS trg_locacao_pagamentos_updated_at ON locacao_pagamentos;
CREATE TRIGGER trg_locacao_pagamentos_updated_at
    BEFORE UPDATE ON locacao_pagamentos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3) locacao_anexos ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS locacao_anexos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id     uuid NOT NULL REFERENCES contratos_locacao(id) ON DELETE CASCADE,

    tipo            text NOT NULL DEFAULT 'contrato'
        CHECK (tipo IN ('contrato', 'aditivo', 'vistoria', 'outro')),
    nome_arquivo    text NOT NULL,
    firebase_path   text NOT NULL,
    tamanho_bytes   bigint,
    mime_type       text,

    uploaded_by     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locacao_anexos_contrato
    ON locacao_anexos(contrato_id);
