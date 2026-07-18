-- 035_autorizacoes_intermediacao.sql
-- Autorização de Intermediação Imobiliária, documento digital assinado pelo
-- PROPRIETÁRIO que autoriza a Morabilidade a intermediar a venda/locação do
-- imóvel e fixa a comissão de corretagem (arts. 722 a 729 do Código Civil).
--
-- Complementa a ficha de visita (migration 034): a ficha amarra o VISITANTE; a
-- autorização amarra o PROPRIETÁRIO. Com exclusividade, a comissão é devida
-- mesmo em venda direta pelo dono no prazo (art. 726 CC).
--
-- Mesma mecânica de assinatura eletrônica simples + trilha de auditoria.

CREATE TABLE IF NOT EXISTS autorizacoes_intermediacao (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    imovel_id                uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    proprietario_id          uuid REFERENCES clientes(id) ON DELETE SET NULL,
    corretor_id              uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    created_by               uuid REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Snapshot do proprietário (signatário).
    proprietario_nome        text NOT NULL,
    proprietario_cpf         text,
    proprietario_telefone    text,
    proprietario_email       text,
    proprietario_endereco    text,

    -- Snapshot do imóvel.
    imovel_codigo            text,
    imovel_endereco          text,
    imovel_bairro            text,
    imovel_cidade            text,
    imovel_matricula         text,

    -- Termos da intermediação.
    tipo_negocio             text NOT NULL DEFAULT 'venda'
                                 CHECK (tipo_negocio IN ('venda', 'locacao', 'ambos')),
    valor_autorizado         numeric(14, 2),
    exclusiva                boolean NOT NULL DEFAULT true,
    comissao_venda_pct       numeric(5, 2),         -- ex.: 6.00 (% sobre a venda)
    comissao_locacao_desc    text,                  -- ex.: 'equivalente ao primeiro aluguel'
    prazo_dias               integer NOT NULL DEFAULT 90,

    corretor_nome            text,
    corretor_creci           text,
    clausula_texto           text NOT NULL,

    -- Estado e link público de assinatura.
    status                   text NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente', 'assinada', 'cancelada', 'expirada')),
    token                    text NOT NULL UNIQUE,
    token_expira_em          timestamptz,

    -- Trilha de auditoria.
    assinada_em              timestamptz,
    assinante_ip             text,
    assinante_user_agent     text,
    assinante_geo            text,
    assinante_assinatura_png text,
    assinante_cpf_confirmado text,
    documento_hash           text,                  -- sha256 hex dos dados essenciais assinados
    pdf_path                 text,

    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autorizacoes_imovel
    ON autorizacoes_intermediacao (imovel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autorizacoes_status
    ON autorizacoes_intermediacao (status);

CREATE INDEX IF NOT EXISTS idx_autorizacoes_proprietario
    ON autorizacoes_intermediacao (proprietario_id);

COMMENT ON TABLE autorizacoes_intermediacao IS
    'Autorização de intermediação assinada pelo proprietário (arts. 722-729 CC). Fixa comissão e, se exclusiva, garante a remuneração ainda em venda direta (art. 726 CC).';
COMMENT ON COLUMN autorizacoes_intermediacao.exclusiva IS
    'true = com exclusividade (comissão devida mesmo em venda direta do dono no prazo, art. 726 CC); false = autorização aberta.';
COMMENT ON COLUMN autorizacoes_intermediacao.clausula_texto IS
    'Texto integral da autorização assinada (versionado). Snapshot, não alterar após a assinatura.';
