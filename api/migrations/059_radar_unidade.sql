-- 059: MoraMétrica, busca por unidade.
--
-- "Rua Bom Pastor, 521, BL-001 Apto 0801" passa a mostrar só as vendas daquele
-- apartamento. O complemento da Prefeitura é texto livre ("BL-001 APTO 0801",
-- "APT 302 FTE", "COB 01"), então a unidade é comparada pelos seus números,
-- sem zeros à esquerda e sem ordem: "bloco 1 apto 801" e "apto 801 bl 1" dão
-- {1, 801}. A busca exige todos os números digitados ("apto 801" sozinho traz
-- o 801 de todos os blocos). radar_tokens_unidade espelha tokens_unidade em
-- app/services/radar/normalizacao.py.
--
-- radar_predio ganha p_unidade. A versão de 7 parâmetros é removida, senão o
-- PostgREST não saberia qual das duas chamar; quem chama sem p_unidade (a API
-- já publicada) continua funcionando com a nova.
--
-- Depende de: 058. Idempotente.
--
-- APLICADA no Supabase em 2026-11-02.

CREATE OR REPLACE FUNCTION radar_tokens_unidade(p_complemento text)
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT coalesce(array_agg(DISTINCT t ORDER BY t), '{}')
    FROM (
        SELECT (m[1]::numeric)::text AS t
        FROM regexp_matches(upper(coalesce(p_complemento, '')), '([0-9]+)([A-Z]?)', 'g') AS m
        UNION ALL
        SELECT (m[1]::numeric)::text || m[2]
        FROM regexp_matches(upper(coalesce(p_complemento, '')), '([0-9]+)([A-Z]?)', 'g') AS m
        WHERE m[2] <> ''
        UNION ALL
        SELECT 'COB' WHERE upper(coalesce(p_complemento, '')) ~ '(^|[^A-Z])COB'
    ) s;
$$;

DROP FUNCTION IF EXISTS radar_predio(integer, integer, date, date, text, integer, integer);

CREATE OR REPLACE FUNCTION radar_predio(
    p_cl integer,
    p_numero integer,
    p_desde date DEFAULT NULL,
    p_ate date DEFAULT NULL,
    p_tipologia text DEFAULT NULL,
    p_limite integer DEFAULT 20,
    p_offset integer DEFAULT 0,
    p_unidade text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    WITH predio AS (
        SELECT * FROM radar_transacoes WHERE cl = p_cl AND numero = p_numero
    ), unidade AS (
        SELECT * FROM predio
        WHERE p_unidade IS NULL OR radar_tokens_unidade(complemento) @> p_unidade
    ), periodo AS (
        SELECT * FROM unidade
        WHERE (p_desde IS NULL OR competencia >= p_desde)
          AND (p_ate IS NULL OR competencia <= p_ate)
    ), filtrado AS (
        SELECT * FROM periodo WHERE p_tipologia IS NULL OR tipologia = p_tipologia
    )
    SELECT jsonb_build_object(
        'total_predio', (SELECT count(*) FROM predio),
        'total_historico', (SELECT count(*) FROM unidade),
        'primeira', (SELECT min(competencia) FROM unidade),
        'ultima', (SELECT max(competencia) FROM unidade),
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

-- O DROP levou as permissões junto: refaz as da 056.
REVOKE ALL ON FUNCTION radar_predio(integer, integer, date, date, text, integer, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_tokens_unidade(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_predio(integer, integer, date, date, text, integer, integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION radar_tokens_unidade(text) TO service_role;
