-- 058: MoraMétrica, média no lugar de mediana.
--
-- Decisão de produto (02/11/2026): os resumos de prédio, rua e bairro passam a
-- usar a média simples do período. Recria radar_predio, radar_rua e
-- radar_bairro (056) com avg() no lugar de percentile_cont, e as chaves do
-- jsonb passam de mediana_* para media_*.
--
-- avg() ignora nulos como percentile_cont: vendas parciais e frações ideais
-- (valor_m2 nulo, ver 057) continuam fora da média do m².
--
-- A API publicada depois desta migration lê media_*. Aplicar logo antes do
-- deploy: no intervalo, a API antiga não acha mediana_* e mostra "Sem dado"
-- nas buscas que não estão em cache.
--
-- Depende de: 056. Idempotente. Mantém as permissões da 056.
--
-- APLICADA no Supabase em 2026-11-02.

CREATE OR REPLACE FUNCTION radar_predio(
    p_cl integer,
    p_numero integer,
    p_desde date DEFAULT NULL,
    p_ate date DEFAULT NULL,
    p_tipologia text DEFAULT NULL,
    p_limite integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    WITH predio AS (
        SELECT * FROM radar_transacoes WHERE cl = p_cl AND numero = p_numero
    ), periodo AS (
        SELECT * FROM predio
        WHERE (p_desde IS NULL OR competencia >= p_desde)
          AND (p_ate IS NULL OR competencia <= p_ate)
    ), filtrado AS (
        SELECT * FROM periodo WHERE p_tipologia IS NULL OR tipologia = p_tipologia
    )
    SELECT jsonb_build_object(
        'total_historico', (SELECT count(*) FROM predio),
        'primeira', (SELECT min(competencia) FROM predio),
        'ultima', (SELECT max(competencia) FROM predio),
        'bairro', (SELECT bairro FROM predio GROUP BY bairro ORDER BY count(*) DESC LIMIT 1),
        'resumo', (
            SELECT jsonb_build_object(
                'transacoes', count(*),
                'media_m2', avg(valor_m2),
                'media_valor', avg(valor_declarado),
                'media_area', avg(area)
            ) FROM filtrado
        ),
        'tipologias', (
            SELECT coalesce(jsonb_agg(jsonb_build_object('valor', tipologia, 'transacoes', n) ORDER BY n DESC), '[]'::jsonb)
            FROM (SELECT tipologia, count(*) AS n FROM periodo GROUP BY tipologia) s
        ),
        'transacoes', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'competencia', competencia,
                'tipologia', tipologia,
                'complemento', complemento,
                'area', area,
                'valor_declarado', valor_declarado,
                'valor_m2', valor_m2,
                'parcial', parcial
            ) ORDER BY competencia DESC, id DESC), '[]'::jsonb)
            FROM (
                SELECT * FROM filtrado
                ORDER BY competencia DESC, id DESC
                LIMIT p_limite OFFSET p_offset
            ) s
        )
    );
$$;

CREATE OR REPLACE FUNCTION radar_rua(
    p_cl integer,
    p_desde date DEFAULT NULL,
    p_ate date DEFAULT NULL,
    p_tipologia text DEFAULT NULL,
    p_ordem text DEFAULT 'numero',
    p_limite integer DEFAULT 20,
    p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    WITH periodo AS (
        SELECT numero, competencia, tipologia, valor_m2, valor_declarado, area
        FROM radar_transacoes
        WHERE cl = p_cl
          AND (p_desde IS NULL OR competencia >= p_desde)
          AND (p_ate IS NULL OR competencia <= p_ate)
    ), filtrado AS (
        SELECT * FROM periodo WHERE p_tipologia IS NULL OR tipologia = p_tipologia
    ), predios AS (
        SELECT
            numero,
            count(*) AS n,
            avg(valor_m2) AS media_m2,
            max(competencia) AS ultima,
            mode() WITHIN GROUP (ORDER BY tipologia) AS tipologia
        FROM filtrado
        WHERE numero IS NOT NULL
        GROUP BY numero
    )
    SELECT jsonb_build_object(
        'total_historico', (SELECT count(*) FROM radar_transacoes WHERE cl = p_cl),
        'resumo', (
            SELECT jsonb_build_object(
                'transacoes', count(*),
                'media_m2', avg(valor_m2),
                'media_valor', avg(valor_declarado),
                'media_area', avg(area)
            ) FROM filtrado
        ),
        'sem_numero', (SELECT count(*) FROM filtrado WHERE numero IS NULL),
        'tipologias', (
            SELECT coalesce(jsonb_agg(jsonb_build_object('valor', tipologia, 'transacoes', n) ORDER BY n DESC), '[]'::jsonb)
            FROM (SELECT tipologia, count(*) AS n FROM periodo GROUP BY tipologia) s
        ),
        'total_predios', (SELECT count(*) FROM predios),
        'predios', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'numero', numero,
                'transacoes', n,
                'media_m2', media_m2,
                'ultima', ultima,
                'tipologia', tipologia
            ) ORDER BY ordem), '[]'::jsonb)
            FROM (
                SELECT *, row_number() OVER (
                    ORDER BY CASE WHEN p_ordem = 'transacoes' THEN n END DESC NULLS LAST, numero
                ) AS ordem
                FROM predios
                ORDER BY ordem
                LIMIT p_limite OFFSET p_offset
            ) s
        )
    );
$$;

CREATE OR REPLACE FUNCTION radar_bairro(
    p_bairro text,
    p_desde date DEFAULT NULL,
    p_ate date DEFAULT NULL,
    p_tipologia text DEFAULT NULL,
    p_limite_ruas integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    WITH periodo AS (
        SELECT cl, tipologia, valor_m2, valor_declarado, area
        FROM radar_transacoes
        WHERE bairro_busca = p_bairro
          AND (p_desde IS NULL OR competencia >= p_desde)
          AND (p_ate IS NULL OR competencia <= p_ate)
    ), filtrado AS (
        SELECT * FROM periodo WHERE p_tipologia IS NULL OR tipologia = p_tipologia
    )
    SELECT jsonb_build_object(
        'total_historico', (SELECT count(*) FROM radar_transacoes WHERE bairro_busca = p_bairro),
        'resumo', (
            SELECT jsonb_build_object(
                'transacoes', count(*),
                'media_m2', avg(valor_m2),
                'media_valor', avg(valor_declarado),
                'media_area', avg(area)
            ) FROM filtrado
        ),
        'tipologias', (
            SELECT coalesce(jsonb_agg(jsonb_build_object('valor', tipologia, 'transacoes', n) ORDER BY n DESC), '[]'::jsonb)
            FROM (SELECT tipologia, count(*) AS n FROM periodo GROUP BY tipologia) s
        ),
        'por_tipologia', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'valor', tipologia,
                'transacoes', n,
                'media_m2', media_m2,
                'media_valor', media_valor,
                'media_area', media_area
            ) ORDER BY n DESC), '[]'::jsonb)
            FROM (
                SELECT
                    tipologia,
                    count(*) AS n,
                    avg(valor_m2) AS media_m2,
                    avg(valor_declarado) AS media_valor,
                    avg(area) AS media_area
                FROM filtrado
                GROUP BY tipologia
            ) s
        ),
        'ruas', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'cl', cl, 'nome', nome, 'transacoes', n, 'media_m2', media_m2
            ) ORDER BY n DESC, nome), '[]'::jsonb)
            FROM (
                SELECT
                    f.cl,
                    l.nome,
                    count(*) AS n,
                    avg(f.valor_m2) AS media_m2
                FROM filtrado f
                JOIN radar_logradouros l USING (cl)
                GROUP BY f.cl, l.nome
                ORDER BY count(*) DESC, l.nome
                LIMIT p_limite_ruas
            ) s
        )
    );
$$;
