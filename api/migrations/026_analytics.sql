-- ============================================================
-- Migration 026: Analytics de acesso ao site público
--
-- Objetivo: monitorar acesso ao site de forma honesta e simples.
-- - Visitas/sessões totais (distinct session_id em janela de tempo)
-- - Views por imóvel (filtrando por imovel_id)
--
-- Privacidade/LGPD: nenhum IP, sem fingerprint. session_id é
-- gerado no navegador (sessionStorage) e dura apenas a sessão.
-- ============================================================

CREATE TABLE IF NOT EXISTS page_views (
  id             BIGSERIAL PRIMARY KEY,
  session_id     TEXT NOT NULL,
  path           TEXT NOT NULL,
  imovel_id      UUID REFERENCES imoveis(id) ON DELETE SET NULL,
  imovel_codigo  TEXT,
  referrer       TEXT,
  user_agent     TEXT,
  is_bot         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Janelas de tempo (dashboards: últimos 7/30 dias)
CREATE INDEX IF NOT EXISTS idx_page_views_created_at
  ON page_views(created_at DESC)
  WHERE is_bot = FALSE;

-- Views por imóvel (ranking + contador no detalhe)
CREATE INDEX IF NOT EXISTS idx_page_views_imovel_created
  ON page_views(imovel_id, created_at DESC)
  WHERE is_bot = FALSE AND imovel_id IS NOT NULL;

-- Contagem de sessões únicas
CREATE INDEX IF NOT EXISTS idx_page_views_session_created
  ON page_views(session_id, created_at DESC)
  WHERE is_bot = FALSE;


-- ============================================================
-- FUNÇÕES de agregação para o dashboard
-- supabase-py não tem DISTINCT count nem GROUP BY direto;
-- estas funções rodam no Postgres e voltam JSON pra API.
-- ============================================================

-- Resumo geral em uma janela de N dias.
-- Retorna { total_views, sessoes_unicas, views_imovel } para um intervalo.
CREATE OR REPLACE FUNCTION analytics_resumo(dias INTEGER)
RETURNS TABLE (
  total_views      BIGINT,
  sessoes_unicas   BIGINT,
  views_imovel     BIGINT
) AS $$
  SELECT
    COUNT(*)::BIGINT AS total_views,
    COUNT(DISTINCT session_id)::BIGINT AS sessoes_unicas,
    COUNT(*) FILTER (WHERE imovel_id IS NOT NULL)::BIGINT AS views_imovel
  FROM page_views
  WHERE is_bot = FALSE
    AND created_at >= NOW() - (dias || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;


-- Top N imóveis mais vistos numa janela de dias.
-- Retorna codigo + titulo + bairro + cidade + total_views + sessoes_unicas.
CREATE OR REPLACE FUNCTION analytics_top_imoveis(dias INTEGER, limite INTEGER)
RETURNS TABLE (
  imovel_id        UUID,
  codigo           TEXT,
  titulo           TEXT,
  bairro           TEXT,
  cidade           TEXT,
  total_views      BIGINT,
  sessoes_unicas   BIGINT
) AS $$
  SELECT
    pv.imovel_id,
    i.codigo,
    i.titulo,
    i.bairro,
    i.cidade,
    COUNT(*)::BIGINT AS total_views,
    COUNT(DISTINCT pv.session_id)::BIGINT AS sessoes_unicas
  FROM page_views pv
  JOIN imoveis i ON i.id = pv.imovel_id
  WHERE pv.is_bot = FALSE
    AND pv.imovel_id IS NOT NULL
    AND pv.created_at >= NOW() - (dias || ' days')::INTERVAL
  GROUP BY pv.imovel_id, i.codigo, i.titulo, i.bairro, i.cidade
  ORDER BY total_views DESC
  LIMIT limite;
$$ LANGUAGE SQL STABLE;


-- Estatísticas de um imóvel específico (total + janelas).
CREATE OR REPLACE FUNCTION analytics_imovel(p_imovel_id UUID)
RETURNS TABLE (
  total_views      BIGINT,
  views_30d        BIGINT,
  views_7d         BIGINT,
  sessoes_unicas_30d BIGINT
) AS $$
  SELECT
    COUNT(*)::BIGINT AS total_views,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT AS views_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::BIGINT  AS views_7d,
    COUNT(DISTINCT session_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::BIGINT AS sessoes_unicas_30d
  FROM page_views
  WHERE imovel_id = p_imovel_id
    AND is_bot = FALSE;
$$ LANGUAGE SQL STABLE;


-- Série diária de visitas (últimos N dias) para gráfico de tendência.
CREATE OR REPLACE FUNCTION analytics_serie_diaria(dias INTEGER)
RETURNS TABLE (
  dia              DATE,
  total_views      BIGINT,
  sessoes_unicas   BIGINT
) AS $$
  SELECT
    (created_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS dia,
    COUNT(*)::BIGINT AS total_views,
    COUNT(DISTINCT session_id)::BIGINT AS sessoes_unicas
  FROM page_views
  WHERE is_bot = FALSE
    AND created_at >= NOW() - (dias || ' days')::INTERVAL
  GROUP BY dia
  ORDER BY dia ASC;
$$ LANGUAGE SQL STABLE;
