-- Migration 036: cliques no botão "Ver vídeo no Instagram" da página do imóvel.
--
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase, rodar no SQL Editor antes de usar.
--
-- Motivação: o CTA de vídeo (reel do Instagram) foi adicionado à página de
-- detalhe do imóvel. Para medir se ele engaja, registramos cada clique numa
-- tabela append-only própria (mesma mecânica de imovel_shares/favoritos da 031),
-- evitando poluir a métrica de "shares". Escrita via POST /publico/video,
-- rate-limited e sem IP.

-- ── imovel_video_clicks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imovel_video_clicks (
    id           BIGSERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,
    imovel_id    UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
    is_bot       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_clicks_created
    ON imovel_video_clicks(created_at DESC) WHERE is_bot = FALSE;
CREATE INDEX IF NOT EXISTS idx_video_clicks_imovel
    ON imovel_video_clicks(imovel_id, created_at DESC) WHERE is_bot = FALSE;

COMMENT ON TABLE imovel_video_clicks IS
    'Append-only: clique no botão "Ver vídeo no Instagram" da página do imóvel.';


-- ── Retenção: inclui a nova tabela no purge de 90 dias (migration 032) ────────
-- Recria a função adicionando o DELETE de imovel_video_clicks. O agendamento
-- via pg_cron da 032 (purge_old_logs_daily) continua chamando esta função.
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

    DELETE FROM imovel_video_clicks WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'imovel_video_clicks'; removidas := n; RETURN NEXT;

    DELETE FROM acao_audit_log WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'acao_audit_log'; removidas := n; RETURN NEXT;

    DELETE FROM page_views WHERE created_at < cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    tabela := 'page_views'; removidas := n; RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
