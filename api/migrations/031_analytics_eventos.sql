-- Migration 031: Eventos de analytics expandidos (buscas, favoritos, shares)
-- e RPCs do novo dashboard /audiencia.
--
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase, rodar no SQL Editor antes de usar.
--
-- Motivação: o redesign da aba /audiencia precisa de métricas que a
-- migration 026 (só page_views) não cobre: buscas realizadas, termos,
-- favoritos e compartilhamentos por imóvel. Todas as tabelas aqui são
-- append-only, escritas via endpoints públicos rate-limited.

-- ── search_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_events (
    id                BIGSERIAL PRIMARY KEY,
    session_id        TEXT NOT NULL,
    termo             TEXT,
    filtros           JSONB NOT NULL DEFAULT '{}'::JSONB,
    resultados_count  INTEGER NOT NULL,
    is_bot            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_events_created
    ON search_events(created_at DESC) WHERE is_bot = FALSE;

-- ── imovel_favoritos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imovel_favoritos (
    id           BIGSERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,
    imovel_id    UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    acao         TEXT NOT NULL CHECK (acao IN ('add','remove')),
    is_bot       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_favoritos_created
    ON imovel_favoritos(created_at DESC) WHERE is_bot = FALSE;
CREATE INDEX IF NOT EXISTS idx_favoritos_imovel
    ON imovel_favoritos(imovel_id, created_at DESC) WHERE is_bot = FALSE;

-- ── imovel_shares ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imovel_shares (
    id           BIGSERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,
    imovel_id    UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    canal        TEXT,
    is_bot       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shares_created
    ON imovel_shares(created_at DESC) WHERE is_bot = FALSE;
CREATE INDEX IF NOT EXISTS idx_shares_imovel
    ON imovel_shares(imovel_id, created_at DESC) WHERE is_bot = FALSE;


-- ═════════════════════════════════════════════════════════════════════════════
-- RPCs
-- ═════════════════════════════════════════════════════════════════════════════
-- Convenção: quando `prev` = true, a janela é deslocada uma janela para trás,
-- para permitir comparação "vs período anterior" (delta %). Ex.: dias=30, prev=true
-- → de 60 dias atrás até 30 dias atrás.

-- KPIs principais (4 cards)
CREATE OR REPLACE FUNCTION analytics_kpis(dias INTEGER, prev BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
    visitantes_unicos  BIGINT,
    vistas_imovel      BIGINT,
    buscas             BIGINT,
    favoritos          BIGINT
) AS $$
    WITH janela AS (
        SELECT
            CASE WHEN prev THEN NOW() - (dias * 2 || ' days')::INTERVAL
                 ELSE NOW() - (dias || ' days')::INTERVAL END AS ini,
            CASE WHEN prev THEN NOW() - (dias || ' days')::INTERVAL
                 ELSE NOW() END AS fim
    )
    SELECT
        (SELECT COUNT(DISTINCT session_id) FROM page_views, janela
            WHERE is_bot = FALSE AND created_at >= janela.ini AND created_at < janela.fim)::BIGINT,
        (SELECT COUNT(*) FROM page_views, janela
            WHERE is_bot = FALSE AND imovel_id IS NOT NULL
              AND created_at >= janela.ini AND created_at < janela.fim)::BIGINT,
        (SELECT COUNT(*) FROM search_events, janela
            WHERE is_bot = FALSE AND created_at >= janela.ini AND created_at < janela.fim)::BIGINT,
        (SELECT COUNT(*) FROM imovel_favoritos, janela
            WHERE is_bot = FALSE AND acao = 'add'
              AND created_at >= janela.ini AND created_at < janela.fim)::BIGINT;
$$ LANGUAGE SQL STABLE;


-- Série diária visitantes + views (para gráfico de tendência)
CREATE OR REPLACE FUNCTION analytics_serie(dias INTEGER)
RETURNS TABLE (
    dia              DATE,
    visitantes       BIGINT,
    views            BIGINT
) AS $$
    SELECT
        (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia,
        COUNT(DISTINCT session_id)::BIGINT,
        COUNT(*)::BIGINT
    FROM page_views
    WHERE is_bot = FALSE
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY dia
    ORDER BY dia ASC;
$$ LANGUAGE SQL STABLE;


-- Funil: visitaram → buscaram → abriram ficha → favoritaram
CREATE OR REPLACE FUNCTION analytics_funil(dias INTEGER)
RETURNS TABLE (
    visitaram   BIGINT,
    buscaram    BIGINT,
    abriram     BIGINT,
    favoritaram BIGINT
) AS $$
    WITH cutoff AS (SELECT NOW() - (dias || ' days')::INTERVAL AS ini)
    SELECT
        (SELECT COUNT(DISTINCT session_id) FROM page_views, cutoff
            WHERE is_bot = FALSE AND created_at >= cutoff.ini)::BIGINT,
        (SELECT COUNT(DISTINCT session_id) FROM search_events, cutoff
            WHERE is_bot = FALSE AND created_at >= cutoff.ini)::BIGINT,
        (SELECT COUNT(DISTINCT session_id) FROM page_views, cutoff
            WHERE is_bot = FALSE AND imovel_id IS NOT NULL
              AND created_at >= cutoff.ini)::BIGINT,
        (SELECT COUNT(DISTINCT session_id) FROM imovel_favoritos, cutoff
            WHERE is_bot = FALSE AND acao = 'add'
              AND created_at >= cutoff.ini)::BIGINT;
$$ LANGUAGE SQL STABLE;


-- Origem do tráfego (classifica referrer)
CREATE OR REPLACE FUNCTION analytics_origem(dias INTEGER)
RETURNS TABLE (
    origem  TEXT,
    total   BIGINT
) AS $$
    SELECT
        CASE
            WHEN referrer IS NULL OR referrer = '' THEN 'Acesso direto'
            WHEN referrer ILIKE '%instagram.%' OR referrer ILIKE '%l.instagram.%' THEN 'Instagram'
            WHEN referrer ILIKE '%google.%' THEN 'Google · Orgânico'
            WHEN referrer ILIKE '%whatsapp.%' OR referrer ILIKE '%wa.me%' THEN 'WhatsApp'
            WHEN referrer ILIKE '%facebook.%' OR referrer ILIKE '%fb.com%' THEN 'Facebook'
            ELSE 'Outros'
        END AS origem,
        COUNT(*)::BIGINT
    FROM page_views
    WHERE is_bot = FALSE
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY origem
    ORDER BY 2 DESC;
$$ LANGUAGE SQL STABLE;


-- Top imóveis com favoritos e shares
CREATE OR REPLACE FUNCTION analytics_top_imoveis_v2(dias INTEGER, limite INTEGER)
RETURNS TABLE (
    imovel_id    UUID,
    codigo       TEXT,
    titulo       TEXT,
    bairro       TEXT,
    cidade       TEXT,
    tipo_negocio TEXT,
    total_views  BIGINT,
    favoritos    BIGINT,
    shares       BIGINT
) AS $$
    WITH cutoff AS (SELECT NOW() - (dias || ' days')::INTERVAL AS ini),
    views AS (
        SELECT pv.imovel_id, COUNT(*)::BIGINT AS total_views
        FROM page_views pv, cutoff
        WHERE pv.is_bot = FALSE AND pv.imovel_id IS NOT NULL
          AND pv.created_at >= cutoff.ini
        GROUP BY pv.imovel_id
    ),
    favs AS (
        SELECT imovel_id, COUNT(*)::BIGINT AS favoritos
        FROM imovel_favoritos, cutoff
        WHERE is_bot = FALSE AND acao = 'add' AND created_at >= cutoff.ini
        GROUP BY imovel_id
    ),
    shrs AS (
        SELECT imovel_id, COUNT(*)::BIGINT AS shares
        FROM imovel_shares, cutoff
        WHERE is_bot = FALSE AND created_at >= cutoff.ini
        GROUP BY imovel_id
    )
    SELECT
        i.id, i.codigo, i.titulo, i.bairro, i.cidade, i.tipo_negocio,
        COALESCE(v.total_views, 0),
        COALESCE(f.favoritos, 0),
        COALESCE(s.shares, 0)
    FROM views v
    JOIN imoveis i ON i.id = v.imovel_id
    LEFT JOIN favs f ON f.imovel_id = v.imovel_id
    LEFT JOIN shrs s ON s.imovel_id = v.imovel_id
    ORDER BY v.total_views DESC
    LIMIT limite;
$$ LANGUAGE SQL STABLE;


-- Bairros: buscas (filtros.bairro) vs vistas (imovel.bairro)
CREATE OR REPLACE FUNCTION analytics_bairros(dias INTEGER, limite INTEGER)
RETURNS TABLE (
    bairro   TEXT,
    buscas   BIGINT,
    vistas   BIGINT
) AS $$
    WITH cutoff AS (SELECT NOW() - (dias || ' days')::INTERVAL AS ini),
    buscas AS (
        SELECT b.value::TEXT AS bairro, COUNT(*)::BIGINT AS n
        FROM search_events se, cutoff,
             jsonb_array_elements_text(COALESCE(se.filtros->'bairro', '[]'::jsonb)) AS b(value)
        WHERE se.is_bot = FALSE AND se.created_at >= cutoff.ini
        GROUP BY b.value
    ),
    vistas AS (
        SELECT i.bairro, COUNT(*)::BIGINT AS n
        FROM page_views pv
        CROSS JOIN cutoff
        JOIN imoveis i ON i.id = pv.imovel_id
        WHERE pv.is_bot = FALSE AND pv.imovel_id IS NOT NULL
          AND pv.created_at >= cutoff.ini AND i.bairro IS NOT NULL
        GROUP BY i.bairro
    )
    SELECT
        COALESCE(b.bairro, v.bairro) AS bairro,
        COALESCE(b.n, 0),
        COALESCE(v.n, 0)
    FROM buscas b
    FULL OUTER JOIN vistas v ON v.bairro = b.bairro
    WHERE COALESCE(b.bairro, v.bairro) IS NOT NULL
    ORDER BY (COALESCE(b.n, 0) + COALESCE(v.n, 0)) DESC
    LIMIT limite;
$$ LANGUAGE SQL STABLE;


-- Dispositivos (parse simples de user_agent)
CREATE OR REPLACE FUNCTION analytics_dispositivos(dias INTEGER)
RETURNS TABLE (
    dispositivo  TEXT,
    total        BIGINT
) AS $$
    SELECT
        CASE
            WHEN user_agent ~* 'tablet|ipad' THEN 'Tablet'
            WHEN user_agent ~* 'mobile|iphone|android' THEN 'Celular'
            ELSE 'Computador'
        END AS dispositivo,
        COUNT(*)::BIGINT
    FROM page_views
    WHERE is_bot = FALSE
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY dispositivo
    ORDER BY 2 DESC;
$$ LANGUAGE SQL STABLE;


-- Heatmap hora × dia da semana (timezone America/Sao_Paulo)
CREATE OR REPLACE FUNCTION analytics_heatmap(dias INTEGER)
RETURNS TABLE (
    dow   INTEGER,   -- 0=domingo ... 6=sábado
    hora  INTEGER,   -- 0..23
    total BIGINT
) AS $$
    SELECT
        EXTRACT(DOW FROM created_at AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS dow,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS hora,
        COUNT(*)::BIGINT AS total
    FROM page_views
    WHERE is_bot = FALSE
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY 1, 2
    ORDER BY 1, 2;
$$ LANGUAGE SQL STABLE;


-- Termos mais buscados (com resultados)
CREATE OR REPLACE FUNCTION analytics_termos(dias INTEGER, limite INTEGER)
RETURNS TABLE (
    termo  TEXT,
    total  BIGINT
) AS $$
    SELECT LOWER(TRIM(termo)) AS termo, COUNT(*)::BIGINT
    FROM search_events
    WHERE is_bot = FALSE
      AND termo IS NOT NULL AND TRIM(termo) <> ''
      AND resultados_count > 0
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY LOWER(TRIM(termo))
    ORDER BY 2 DESC
    LIMIT limite;
$$ LANGUAGE SQL STABLE;


-- Buscas sem resultado (mais frequentes)
CREATE OR REPLACE FUNCTION analytics_buscas_vazias(dias INTEGER, limite INTEGER)
RETURNS TABLE (
    termo   TEXT,
    pessoas BIGINT
) AS $$
    SELECT LOWER(TRIM(termo)) AS termo, COUNT(DISTINCT session_id)::BIGINT
    FROM search_events
    WHERE is_bot = FALSE
      AND termo IS NOT NULL AND TRIM(termo) <> ''
      AND resultados_count = 0
      AND created_at >= NOW() - (dias || ' days')::INTERVAL
    GROUP BY LOWER(TRIM(termo))
    ORDER BY 2 DESC
    LIMIT limite;
$$ LANGUAGE SQL STABLE;


COMMENT ON TABLE search_events    IS 'Eventos de busca no site público (snapshot dos filtros + termo + resultados).';
COMMENT ON TABLE imovel_favoritos IS 'Append-only: toggle de favorito por sessão. Net = sum(add) - sum(remove).';
COMMENT ON TABLE imovel_shares    IS 'Append-only: clique no compartilhar (whatsapp/web_share/copy_link).';
