-- Migration 032: RPCs de /stats e /relatorios + retenção 90d dos logs.
-- Executada no Supabase em 2026-05-31.
--
-- Motivação:
--   - /stats fazia 9 .execute() em sequência (~270ms só de rede).
--   - /relatorios fazia SELECT * em imoveis e clientes e agregava em Python.
--   - search_events / imovel_favoritos / imovel_shares / acao_audit_log
--     crescem para sempre, sem TTL, queries de analytics degradam ao
--     atingir centenas de milhares de linhas.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1) RETENÇÃO: purge de logs com mais de 90 dias
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purge_old_logs()
RETURNS TABLE (
    tabela       TEXT,
    removidas    BIGINT
) AS $$
DECLARE
    cutoff TIMESTAMPTZ := NOW() - INTERVAL '90 days';
    n      BIGINT;
BEGIN
    DELETE FROM search_events WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'search_events'; removidas := n; RETURN NEXT;

    DELETE FROM imovel_favoritos WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_favoritos'; removidas := n; RETURN NEXT;

    DELETE FROM imovel_shares WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_shares'; removidas := n; RETURN NEXT;

    DELETE FROM acao_audit_log WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'acao_audit_log'; removidas := n; RETURN NEXT;

    -- page_views também, embora venha da 026, segue mesma lógica.
    DELETE FROM page_views WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'page_views'; removidas := n; RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_old_logs() IS
    'Apaga linhas com mais de 90 dias das tabelas append-only. Agendado via pg_cron diariamente às 03:15 UTC.';

-- Agendamento via pg_cron. A extensão NÃO vem habilitada por padrão no
-- Supabase, precisa ser ligada manualmente em:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- Depois de habilitada, rode SÓ o bloco abaixo:
--
--   SELECT cron.schedule(
--     'purge_old_logs_daily',
--     '15 3 * * *',
--     $$SELECT purge_old_logs();$$
--   );
--
-- Sem pg_cron, a função `purge_old_logs()` ainda funciona, basta chamar
-- manualmente periodicamente (`SELECT purge_old_logs();`) ou agendar via
-- Supabase Edge Function com schedule. O DO block abaixo tenta agendar
-- silenciosamente; se cron não existir, apenas pula sem travar a migration.
DO $$
BEGIN
    -- Limpa agenda anterior (idempotência em re-deploys).
    PERFORM cron.unschedule(jobid)
        FROM cron.job WHERE jobname = 'purge_old_logs_daily';
    -- Agenda novamente.
    PERFORM cron.schedule(
        'purge_old_logs_daily',
        '15 3 * * *',
        'SELECT purge_old_logs();'
    );
    RAISE NOTICE 'pg_cron: purge_old_logs_daily agendado para 03:15 UTC.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron não está habilitado (ou falhou ao agendar: %), função criada mas não agendada. Habilite a extensão e rode SELECT cron.schedule(...) manualmente.', SQLERRM;
END $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2) RPC: stats_dashboard() , substitui as 9 queries do /stats
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION stats_dashboard()
RETURNS JSONB AS $$
    WITH
    base_imoveis AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE disponibilidade = 'disponivel')::BIGINT AS disponiveis,
            COUNT(*) FILTER (WHERE disponibilidade = 'reservado')::BIGINT AS reservados
        FROM imoveis
    ),
    base_clientes AS (
        SELECT
            COUNT(*)::BIGINT AS total,
            COUNT(*) FILTER (WHERE status = 'em_negociacao')::BIGINT AS em_negociacao,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::BIGINT AS leads_7d
        FROM clientes
    ),
    mais_antigo AS (
        SELECT codigo, created_at
        FROM imoveis
        WHERE disponibilidade IN ('disponivel', 'reservado')
        ORDER BY created_at ASC
        LIMIT 1
    ),
    -- Imóveis (não-locação) sem nenhuma foto: anti-join via LEFT JOIN ... IS NULL.
    sem_foto AS (
        SELECT COUNT(*)::BIGINT AS n
        FROM imoveis i
        LEFT JOIN imovel_fotos f ON f.imovel_id = i.id
        WHERE i.tipo_negocio <> 'locacao'
          AND f.id IS NULL
    )
    SELECT jsonb_build_object(
        'total_imoveis',          (SELECT total FROM base_imoveis),
        'imoveis_disponiveis',    (SELECT disponiveis FROM base_imoveis),
        'imoveis_reservados',     (SELECT reservados FROM base_imoveis),
        'imoveis_sem_foto',       (SELECT n FROM sem_foto),
        'total_clientes',         (SELECT total FROM base_clientes),
        'clientes_em_negociacao', (SELECT em_negociacao FROM base_clientes),
        'leads_ultimos_7_dias',   (SELECT leads_7d FROM base_clientes),
        'imovel_mais_antigo',     (SELECT row_to_json(m) FROM mais_antigo m)
    );
$$ LANGUAGE SQL STABLE;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3) RPC: relatorios_dashboard() , substitui o /relatorios
-- ═════════════════════════════════════════════════════════════════════════════
-- Retorna agregações em vez de SELECT * (cortando payload de ~milhares de
-- registros pra Python). Tudo na mesma transação SQL.

CREATE OR REPLACE FUNCTION relatorios_dashboard()
RETURNS JSONB AS $$
    WITH
    -- Últimos 12 meses no fuso BR (lista completa, mesmo meses zerados).
    meses AS (
        SELECT TO_CHAR(d, 'YYYY-MM') AS mes
        FROM generate_series(
            DATE_TRUNC('month', (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '11 months'),
            DATE_TRUNC('month', (NOW() AT TIME ZONE 'America/Sao_Paulo')),
            INTERVAL '1 month'
        ) AS d
    ),
    -- Imóveis por mês (zero quando não houve cadastro).
    imoveis_mes AS (
        SELECT
            m.mes,
            COUNT(i.id)::BIGINT AS n
        FROM meses m
        LEFT JOIN imoveis i
          ON TO_CHAR((i.created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.mes
        GROUP BY m.mes
        ORDER BY m.mes
    ),
    clientes_mes AS (
        SELECT
            m.mes,
            COUNT(c.id)::BIGINT AS n
        FROM meses m
        LEFT JOIN clientes c
          ON TO_CHAR((c.created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM') = m.mes
        GROUP BY m.mes
        ORDER BY m.mes
    ),
    por_tipo_imovel AS (
        SELECT COALESCE(tipo_imovel, 'outro') AS k, COUNT(*)::BIGINT AS n
        FROM imoveis GROUP BY 1
    ),
    por_tipo_negocio AS (
        SELECT COALESCE(tipo_negocio, 'indefinido') AS k, COUNT(*)::BIGINT AS n
        FROM imoveis GROUP BY 1
    ),
    por_disponibilidade AS (
        SELECT COALESCE(disponibilidade, 'indefinido') AS k, COUNT(*)::BIGINT AS n
        FROM imoveis GROUP BY 1
    ),
    top_bairros AS (
        SELECT bairro AS k, COUNT(*)::BIGINT AS n
        FROM imoveis
        WHERE bairro IS NOT NULL AND TRIM(bairro) <> ''
        GROUP BY bairro
        ORDER BY n DESC
        LIMIT 10
    ),
    preco_medio AS (
        SELECT
            COALESCE(tipo_imovel, 'outro') AS k,
            ROUND(AVG(valor_venda))::BIGINT AS media
        FROM imoveis
        WHERE valor_venda IS NOT NULL AND valor_venda > 0
        GROUP BY 1
    ),
    por_status_cliente AS (
        SELECT COALESCE(status, 'indefinido') AS k, COUNT(*)::BIGINT AS n
        FROM clientes GROUP BY 1
    ),
    por_origem_cliente AS (
        SELECT COALESCE(origem_lead, 'indefinido') AS k, COUNT(*)::BIGINT AS n
        FROM clientes GROUP BY 1
    )
    SELECT jsonb_build_object(
        'meses_labels',              (SELECT jsonb_agg(mes ORDER BY mes) FROM meses),
        'imoveis_por_mes',           (SELECT jsonb_object_agg(mes, n) FROM imoveis_mes),
        'clientes_por_mes',          (SELECT jsonb_object_agg(mes, n) FROM clientes_mes),
        'imoveis_por_tipo',          (SELECT jsonb_object_agg(k, n) FROM por_tipo_imovel),
        'imoveis_por_tipo_negocio',  (SELECT jsonb_object_agg(k, n) FROM por_tipo_negocio),
        'imoveis_por_disponibilidade', (SELECT jsonb_object_agg(k, n) FROM por_disponibilidade),
        'top_bairros',               (SELECT jsonb_object_agg(k, n) FROM top_bairros),
        'preco_medio_por_tipo',      (SELECT jsonb_object_agg(k, media) FROM preco_medio),
        'clientes_por_status',       (SELECT jsonb_object_agg(k, n) FROM por_status_cliente),
        'clientes_por_origem',       (SELECT jsonb_object_agg(k, n) FROM por_origem_cliente)
    );
$$ LANGUAGE SQL STABLE;


COMMENT ON FUNCTION stats_dashboard()      IS 'KPIs do painel inicial em 1 query (substitui as 9 do /stats).';
COMMENT ON FUNCTION relatorios_dashboard() IS 'Agregações da aba Relatórios em 1 query (substitui SELECT * + Python).';
