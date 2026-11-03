-- 060: Audiência do site com histórico, e buscas da MoraMétrica.
--
-- Os eventos brutos (page_views, search_events...) continuam sendo apagados
-- após 90 dias pelo purge_old_logs (032/036b): session_id, user agent e
-- referrer não precisam viver mais que isso. O que muda é que, antes de
-- apagar, a contagem de cada dia vai para analytics_diario, que nunca é
-- apagada. É o "dados de navegação são mantidos em forma agregada" da
-- política de privacidade.
--
-- Colunas de analytics_diario (sem bots, dia no fuso de Brasília):
--   visitas           sessões distintas no dia. A sessão vive no
--                     sessionStorage, uma por aba: não é "pessoa única"
--   acessos           páginas vistas
--   vistas_imovel     páginas de imóvel vistas
--   buscas            buscas de imóveis (search_events)
--   favoritos         imóveis favoritados
--   mm_visitas        sessões que abriram a MoraMétrica
--   mm_acessos        aberturas da página /morametrica
--   mm_buscas         buscas feitas na MoraMétrica (morametrica_buscas, nova)
--   mm_sem_resultado  dessas, as que não acharam nada ou deram erro
--   origens           visitas por origem, pela primeira página da sessão no
--                     dia ({"Instagram": 120, "Google · Orgânico": 80, ...})
--
-- A busca da MoraMétrica muda só a query string (/morametrica?q=...), que o
-- page_views não registra; por isso a tabela própria. Ela guarda só o tipo
-- de resultado, nunca o endereço buscado.
--
-- Origem: o navegador interno do Instagram não manda referrer, e em out/2026
-- um terço das visitas "diretas" vinha dele. analytics_origem_de olha o user
-- agent antes do referrer. As origens antigas (analytics_origem, por página
-- vista e sem essa regra) ficam como estavam: a API deixa de usá-las.
--
-- O histórico começa no dia mais antigo ainda em page_views. A coleta
-- começou em 26/05/2026, mas o que veio antes de 04/08 já tinha sido
-- apagado quando esta migration foi escrita. O primeiro dia sai com uns
-- minutos a menos: o purge corta às 00:15 de Brasília.
--
-- Ordem do deploy: aplicar antes de publicar a API que lê analytics_dias. A
-- API anterior segue funcionando com esta migration aplicada.
--
-- Depende de: 026, 031, 036b. Idempotente.
--
-- APLICADA no Supabase em 2026-11-02 (90 dias consolidados, de 04/08 a 01/11).

-- ── Buscas da MoraMétrica ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS morametrica_buscas (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN (
                    'predio', 'unidade', 'rua', 'bairro', 'ambiguo', 'nenhum', 'erro'
                )),
    is_bot      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_morametrica_buscas_created
    ON morametrica_buscas(created_at DESC) WHERE is_bot = FALSE;

COMMENT ON TABLE morametrica_buscas IS
    'Append-only: busca feita na MoraMétrica (só o tipo de resultado). Apagada após 90 dias.';

ALTER TABLE morametrica_buscas ENABLE ROW LEVEL SECURITY;

-- ── Contagem diária ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_diario (
    dia               DATE PRIMARY KEY,
    visitas           INTEGER NOT NULL,
    acessos           INTEGER NOT NULL,
    vistas_imovel     INTEGER NOT NULL,
    buscas            INTEGER NOT NULL,
    favoritos         INTEGER NOT NULL,
    mm_visitas        INTEGER NOT NULL,
    mm_acessos        INTEGER NOT NULL,
    mm_buscas         INTEGER NOT NULL,
    mm_sem_resultado  INTEGER NOT NULL,
    origens           JSONB NOT NULL DEFAULT '{}'::JSONB,
    consolidado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE analytics_diario IS
    'Audiência do site por dia, agregada e sem identificar ninguém. Nunca é apagada.';

ALTER TABLE analytics_diario ENABLE ROW LEVEL SECURITY;

-- ── Origem de uma visita ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION analytics_origem_de(p_referrer TEXT, p_user_agent TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        -- Navegadores internos dos apps: o referrer vem vazio
        WHEN p_user_agent LIKE '%Instagram%' THEN 'Instagram'
        WHEN p_user_agent ~ 'FBAN|FBAV|FB_IAB' THEN 'Facebook'
        WHEN p_referrer IS NULL OR p_referrer = '' THEN 'Acesso direto'
        WHEN p_referrer ILIKE '%instagram.%' THEN 'Instagram'
        WHEN p_referrer ILIKE '%google.%' THEN 'Google · Orgânico'
        WHEN p_referrer ILIKE '%whatsapp.%' OR p_referrer ILIKE '%wa.me%'
          OR p_referrer ILIKE '%wl.co%' THEN 'WhatsApp'
        WHEN p_referrer ILIKE '%facebook.%' OR p_referrer ILIKE '%fb.com%' THEN 'Facebook'
        WHEN p_referrer ILIKE '%youtube.%' OR p_referrer ILIKE '%youtu.be%' THEN 'YouTube'
        -- Link do próprio site aberto em outra aba: a aba nova é outra sessão
        WHEN p_referrer ILIKE '%morabilidade.com%' THEN 'Navegação interna'
        ELSE 'Outros'
    END;
$$;

-- ── Cálculo a partir dos eventos brutos ──────────────────────────────────────
-- Um registro por dia entre p_desde e p_ate, dias sem movimento com zero.
-- Começa no primeiro dia que ainda tem page_views: antes disso os eventos já
-- foram apagados e o zero seria mentira.
CREATE OR REPLACE FUNCTION analytics_calcular_dias(p_desde DATE, p_ate DATE)
RETURNS SETOF analytics_diario
LANGUAGE sql STABLE
AS $$
    WITH limites AS (
        SELECT greatest(p_desde, primeiro) AS desde
        FROM (
            SELECT (min(created_at) AT TIME ZONE 'America/Sao_Paulo')::DATE AS primeiro
            FROM page_views WHERE is_bot = FALSE
        ) p
        WHERE primeiro IS NOT NULL
    ), janela AS (
        SELECT
            desde,
            desde::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS ini,
            (p_ate + 1)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS fim
        FROM limites
    ), pv AS (
        SELECT
            (p.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia,
            p.session_id, p.path, p.imovel_id, p.referrer, p.user_agent, p.created_at
        FROM page_views p, janela j
        WHERE p.is_bot = FALSE AND p.created_at >= j.ini AND p.created_at < j.fim
    ), pv_dia AS (
        SELECT
            dia,
            count(DISTINCT session_id) AS visitas,
            count(*) AS acessos,
            count(*) FILTER (WHERE imovel_id IS NOT NULL) AS vistas_imovel,
            count(DISTINCT session_id) FILTER (WHERE path = '/morametrica') AS mm_visitas,
            count(*) FILTER (WHERE path = '/morametrica') AS mm_acessos
        FROM pv
        GROUP BY dia
    ), origem_dia AS (
        SELECT dia, jsonb_object_agg(origem, n) AS origens
        FROM (
            SELECT dia, origem, count(*) AS n
            FROM (
                SELECT DISTINCT ON (dia, session_id)
                    dia, analytics_origem_de(referrer, user_agent) AS origem
                FROM pv
                ORDER BY dia, session_id, created_at
            ) primeira_pagina
            GROUP BY dia, origem
        ) s
        GROUP BY dia
    ), buscas_dia AS (
        SELECT (s.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia, count(*) AS n
        FROM search_events s, janela j
        WHERE s.is_bot = FALSE AND s.created_at >= j.ini AND s.created_at < j.fim
        GROUP BY 1
    ), favoritos_dia AS (
        SELECT (f.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia, count(*) AS n
        FROM imovel_favoritos f, janela j
        WHERE f.is_bot = FALSE AND f.acao = 'add'
          AND f.created_at >= j.ini AND f.created_at < j.fim
        GROUP BY 1
    ), mm_dia AS (
        SELECT
            (m.created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia,
            count(*) AS buscas,
            count(*) FILTER (WHERE m.tipo IN ('nenhum', 'erro')) AS sem_resultado
        FROM morametrica_buscas m, janela j
        WHERE m.is_bot = FALSE AND m.created_at >= j.ini AND m.created_at < j.fim
        GROUP BY 1
    )
    SELECT
        g.d::DATE,
        coalesce(pv_dia.visitas, 0)::INTEGER,
        coalesce(pv_dia.acessos, 0)::INTEGER,
        coalesce(pv_dia.vistas_imovel, 0)::INTEGER,
        coalesce(buscas_dia.n, 0)::INTEGER,
        coalesce(favoritos_dia.n, 0)::INTEGER,
        coalesce(pv_dia.mm_visitas, 0)::INTEGER,
        coalesce(pv_dia.mm_acessos, 0)::INTEGER,
        coalesce(mm_dia.buscas, 0)::INTEGER,
        coalesce(mm_dia.sem_resultado, 0)::INTEGER,
        coalesce(origem_dia.origens, '{}'::JSONB),
        NOW()
    FROM janela j
    CROSS JOIN LATERAL generate_series(j.desde::TIMESTAMP, p_ate::TIMESTAMP, INTERVAL '1 day') AS g(d)
    LEFT JOIN pv_dia ON pv_dia.dia = g.d::DATE
    LEFT JOIN origem_dia ON origem_dia.dia = g.d::DATE
    LEFT JOIN buscas_dia ON buscas_dia.dia = g.d::DATE
    LEFT JOIN favoritos_dia ON favoritos_dia.dia = g.d::DATE
    LEFT JOIN mm_dia ON mm_dia.dia = g.d::DATE
    ORDER BY 1;
$$;

-- ── Leitura para o painel ────────────────────────────────────────────────────
-- Dias já consolidados vêm de analytics_diario; os seguintes (hoje, ou
-- qualquer dia que o cron não tenha consolidado) são calculados na hora.
CREATE OR REPLACE FUNCTION analytics_dias(p_desde DATE, p_ate DATE)
RETURNS SETOF analytics_diario
LANGUAGE sql STABLE
AS $$
    SELECT * FROM (
        SELECT * FROM analytics_diario WHERE dia BETWEEN p_desde AND p_ate
        UNION ALL
        SELECT * FROM analytics_calcular_dias(
            greatest(p_desde, (SELECT max(dia) + 1 FROM analytics_diario)),
            p_ate
        )
    ) dias
    ORDER BY dia;
$$;

-- ── Consolidação ─────────────────────────────────────────────────────────────
-- Grava os dias fechados que faltam, e refaz os dois últimos para pegar
-- evento que tenha chegado depois da meia-noite. Na primeira vez, grava tudo
-- o que ainda existe em page_views. Devolve quantos dias gravou.
CREATE OR REPLACE FUNCTION analytics_consolidar()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    ontem DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE - 1;
    desde DATE;
    n     INTEGER;
BEGIN
    SELECT CASE
        WHEN max(dia) IS NULL THEN DATE '2000-01-01'  -- calcular_dias corta no 1º dia com dado
        ELSE least(max(dia) + 1, ontem - 1)
    END INTO desde
    FROM analytics_diario;

    INSERT INTO analytics_diario
    SELECT * FROM analytics_calcular_dias(desde, ontem)
    ON CONFLICT (dia) DO UPDATE SET
        visitas = EXCLUDED.visitas,
        acessos = EXCLUDED.acessos,
        vistas_imovel = EXCLUDED.vistas_imovel,
        buscas = EXCLUDED.buscas,
        favoritos = EXCLUDED.favoritos,
        mm_visitas = EXCLUDED.mm_visitas,
        mm_acessos = EXCLUDED.mm_acessos,
        mm_buscas = EXCLUDED.mm_buscas,
        mm_sem_resultado = EXCLUDED.mm_sem_resultado,
        origens = EXCLUDED.origens,
        consolidado_em = EXCLUDED.consolidado_em;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

-- ── Retenção: consolida antes de apagar ──────────────────────────────────────
-- Mesma função da 036b, com a consolidação no começo e morametrica_buscas no
-- purge. Se a consolidação falhar, a transação inteira volta e nada é
-- apagado. O agendamento da 032 (purge_old_logs_daily, 03:15 UTC = 00:15 de
-- Brasília) continua chamando esta função.
CREATE OR REPLACE FUNCTION purge_old_logs()
RETURNS TABLE (
    tabela       TEXT,
    removidas    BIGINT
) AS $$
DECLARE
    cutoff TIMESTAMPTZ := NOW() - INTERVAL '90 days';
    n      BIGINT;
BEGIN
    PERFORM analytics_consolidar();

    DELETE FROM search_events WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'search_events'; removidas := n; RETURN NEXT;

    DELETE FROM imovel_favoritos WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_favoritos'; removidas := n; RETURN NEXT;

    DELETE FROM imovel_shares WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_shares'; removidas := n; RETURN NEXT;

    DELETE FROM imovel_video_clicks WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_video_clicks'; removidas := n; RETURN NEXT;

    DELETE FROM morametrica_buscas WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'morametrica_buscas'; removidas := n; RETURN NEXT;

    DELETE FROM acao_audit_log WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'acao_audit_log'; removidas := n; RETURN NEXT;

    DELETE FROM page_views WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'page_views'; removidas := n; RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ── Permissões ───────────────────────────────────────────────────────────────
-- Só a service role (API) chama; o pg_cron roda como dono das funções.
REVOKE ALL ON FUNCTION analytics_origem_de(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_calcular_dias(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_dias(DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION analytics_consolidar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_origem_de(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_calcular_dias(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_dias(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION analytics_consolidar() TO service_role;

-- ── Histórico: grava agora o que ainda existe ────────────────────────────────
SELECT analytics_consolidar() AS dias_consolidados;

-- VERIFICAÇÃO (rode após aplicar):
--
--   SELECT min(dia), max(dia), count(*), sum(visitas), sum(acessos)
--   FROM analytics_diario;
--
-- min = dia mais antigo em page_views, max = ontem, count = dias entre eles.
