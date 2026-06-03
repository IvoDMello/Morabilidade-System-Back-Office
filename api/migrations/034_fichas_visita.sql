-- 034_fichas_visita.sql
-- Ficha / Termo de Visita a Imóvel — documento digital que vincula o visitante
-- ao pagamento da corretagem caso o negócio se concretize (direta ou
-- indiretamente, inclusive com o proprietário) dentro do prazo, nos termos dos
-- arts. 725 e 727 do Código Civil. Assinatura eletrônica simples com trilha de
-- auditoria (IP, data/hora, geolocalização e hash do PDF) — válida entre
-- particulares (art. 107 CC + Lei 14.063/2020).
--
-- Nomenclatura: 'fichas_visita' (distinta de 'imovel_visitas' da migration 020,
-- que é o registro interno de acompanhamento do imóvel).

CREATE TABLE IF NOT EXISTS fichas_visita (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos. O imóvel é obrigatório; corretor/cliente podem ser
    -- desvinculados sem apagar a ficha (a prova vive nos snapshots abaixo).
    imovel_id                uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    corretor_id              uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    cliente_id               uuid REFERENCES clientes(id) ON DELETE SET NULL,
    created_by               uuid REFERENCES usuarios(id) ON DELETE SET NULL,

    -- Snapshot do visitante (dados informados no momento da geração).
    visitante_nome           text NOT NULL,
    visitante_cpf            text,
    visitante_rg             text,
    visitante_telefone       text,
    visitante_email          text,

    -- Snapshot imutável do imóvel/corretor/cláusula no momento da geração.
    -- Garante que edições futuras no imóvel não alterem o documento assinado.
    imovel_codigo            text,
    imovel_endereco          text,
    imovel_bairro            text,
    imovel_cidade            text,
    imovel_valor             numeric(14, 2),
    proprietario_nome        text,
    corretor_nome            text,
    corretor_creci           text,
    clausula_texto           text NOT NULL,
    prazo_meses              integer NOT NULL DEFAULT 12,

    -- Estado e link público de assinatura.
    status                   text NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente', 'assinada', 'cancelada', 'expirada')),
    token                    text NOT NULL UNIQUE,
    token_expira_em          timestamptz,

    -- Trilha de auditoria da assinatura eletrônica.
    assinada_em              timestamptz,
    assinante_ip             text,
    assinante_user_agent     text,
    assinante_geo            text,
    assinante_assinatura_png text,            -- data URL base64 do traço (opcional)
    assinante_cpf_confirmado text,
    documento_hash           text,            -- sha256 hex dos dados essenciais assinados
    pdf_path                 text,            -- caminho no storage (bucket 'media')

    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichas_visita_imovel
    ON fichas_visita (imovel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fichas_visita_status
    ON fichas_visita (status);

CREATE INDEX IF NOT EXISTS idx_fichas_visita_cliente
    ON fichas_visita (cliente_id);

COMMENT ON TABLE fichas_visita IS
    'Termo de visita a imóvel com assinatura eletrônica simples. Vincula o visitante à corretagem (arts. 725/727 CC) e guarda trilha de auditoria como prova.';
COMMENT ON COLUMN fichas_visita.clausula_texto IS
    'Texto integral da declaração assinada (versionado). Snapshot — não alterar após a assinatura.';
COMMENT ON COLUMN fichas_visita.documento_hash IS
    'SHA-256 dos dados essenciais assinados (id, imóvel, visitante, CPF, cláusula, data/hora, IP, geo). Comprova a integridade do acordo; estável e determinístico (ao contrário do PDF renderizado).';
