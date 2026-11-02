-- 056: MoraMétrica (codinome Radar), consultas da API pública.
--
-- Funções chamadas por /radar/publico/* (app/routers/radar.py). Cada uma
-- devolve um jsonb pronto, numa ida ao banco.
--
-- Resumos usam sempre mediana (percentile_cont), nunca média: o valor
-- declarado tem cauda longa e uma cobertura de R$ 30 milhões puxaria a média de
-- um prédio inteiro. percentile_cont ignora nulos, então transmissão parcial
-- (valor_m2 nulo) fica fora da mediana do m² sem filtro extra.
--
-- Período: p_desde/p_ate são competências (1º dia do mês); nulo = sem limite.
-- Só a service role executa (a API); leitura pública passa pela API.
--
-- Depende de: 055. Idempotente.
--
-- APLICADA no Supabase em 2026-11-02.

-- Bairros com transação, para reconhecer "Ipanema" na busca e no autocomplete.
-- A API guarda em cache por horas.
CREATE OR REPLACE FUNCTION radar_bairros()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'chave', bairro_busca, 'nome', nome, 'transacoes', n
    ) ORDER BY n DESC), '[]'::jsonb)
    FROM (
        SELECT bairro_busca, min(bairro) AS nome, count(*) AS n
        FROM radar_transacoes
        GROUP BY bairro_busca
    ) s;
$$;

-- Logradouros cuja grafia é exatamente a chave digitada ("VIEIRA SOUTO").
-- Mais de um resultado = nome repetido em ruas diferentes (a API pergunta qual).
-- Com número, diz em qual delas o número tem venda.
CREATE OR REPLACE FUNCTION radar_resolver(p_chave text, p_numero integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'cl', l.cl,
        'nome', l.nome,
        'tipo', l.tipo,
        'grafia', n.nome,
        'bairros', l.bairros,
        'transacoes', l.transacoes,
        'predios', l.predios,
        'tem_numero', CASE WHEN p_numero IS NULL THEN NULL ELSE EXISTS (
            SELECT 1 FROM radar_transacoes t WHERE t.cl = l.cl AND t.numero = p_numero
        ) END
    ) ORDER BY l.transacoes DESC), '[]'::jsonb)
    FROM radar_logradouro_nomes n
    JOIN radar_logradouros l USING (cl)
    WHERE n.nome_busca = p_chave;
$$;

-- Autocomplete e "você quis dizer": começo do nome, trecho do nome ou grafia
-- parecida (trigram, pega erro de digitação como "VIERA SOUTO").
CREATE OR REPLACE FUNCTION radar_sugestoes(p_chave text, p_limite integer DEFAULT 8)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
    WITH candidatos AS (
        SELECT DISTINCT ON (n.cl)
            n.cl,
            n.nome AS grafia,
            n.nome_busca LIKE p_chave || '%' AS prefixo,
            similarity(n.nome_busca, p_chave) AS semelhanca
        FROM radar_logradouro_nomes n
        WHERE n.nome_busca LIKE '%' || p_chave || '%' OR n.nome_busca % p_chave
        ORDER BY n.cl, (n.nome_busca LIKE p_chave || '%') DESC, similarity(n.nome_busca, p_chave) DESC
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'cl', cl, 'nome', nome, 'grafia', grafia, 'bairros', bairros,
        'transacoes', transacoes, 'semelhanca', semelhanca
    ) ORDER BY prefixo DESC, semelhanca DESC, transacoes DESC), '[]'::jsonb)
    FROM (
        SELECT c.cl, l.nome, c.grafia, l.bairros[1:3] AS bairros, l.transacoes,
               c.prefixo, c.semelhanca
        FROM candidatos c
        JOIN radar_logradouros l USING (cl)
        ORDER BY c.prefixo DESC, c.semelhanca DESC, l.transacoes DESC
        LIMIT p_limite
    ) s;
$$;

-- Números com venda mais perto do pedido ("Vieira Souto 512" → 510, 516...).
CREATE OR REPLACE FUNCTION radar_numeros_proximos(p_cl integer, p_numero integer, p_limite integer DEFAULT 6)
RETURNS integer[]
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(array_agg(numero ORDER BY numero), '{}')
    FROM (
        SELECT numero
        FROM radar_transacoes
        WHERE cl = p_cl AND numero IS NOT NULL
        GROUP BY numero
        ORDER BY abs(numero - p_numero), numero
        LIMIT p_limite
    ) s;
$$;

-- Um prédio: resumo do período filtrado, tipologias do período (para os
-- filtros) e a página de transações, da mais recente para a mais antiga.
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
                'mediana_m2', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_m2::float8),
                'mediana_valor', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_declarado::float8),
                'mediana_area', percentile_cont(0.5) WITHIN GROUP (ORDER BY area::float8)
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

-- Uma rua inteira agrupada por prédio (número). Transações sem número entram
-- no resumo e em `sem_numero`, mas não na lista de prédios.
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
            percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_m2::float8) AS mediana_m2,
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
                'mediana_m2', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_m2::float8),
                'mediana_valor', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_declarado::float8),
                'mediana_area', percentile_cont(0.5) WITHIN GROUP (ORDER BY area::float8)
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
                'mediana_m2', mediana_m2,
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

-- Um bairro: total, mediana por tipologia e as ruas mais negociadas.
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
                'mediana_m2', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_m2::float8),
                'mediana_valor', percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_declarado::float8),
                'mediana_area', percentile_cont(0.5) WITHIN GROUP (ORDER BY area::float8)
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
                'mediana_m2', mediana_m2,
                'mediana_valor', mediana_valor,
                'mediana_area', mediana_area
            ) ORDER BY n DESC), '[]'::jsonb)
            FROM (
                SELECT
                    tipologia,
                    count(*) AS n,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_m2::float8) AS mediana_m2,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY valor_declarado::float8) AS mediana_valor,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY area::float8) AS mediana_area
                FROM filtrado
                GROUP BY tipologia
            ) s
        ),
        'ruas', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'cl', cl, 'nome', nome, 'transacoes', n, 'mediana_m2', mediana_m2
            ) ORDER BY n DESC, nome), '[]'::jsonb)
            FROM (
                SELECT
                    f.cl,
                    l.nome,
                    count(*) AS n,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY f.valor_m2::float8) AS mediana_m2
                FROM filtrado f
                JOIN radar_logradouros l USING (cl)
                GROUP BY f.cl, l.nome
                ORDER BY count(*) DESC, l.nome
                LIMIT p_limite_ruas
            ) s
        )
    );
$$;

-- Fechadas para anon/authenticated: o site lê pela API.
REVOKE ALL ON FUNCTION radar_bairros() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_resolver(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_sugestoes(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_numeros_proximos(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_predio(integer, integer, date, date, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_rua(integer, date, date, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_bairro(text, date, date, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_bairros() TO service_role;
GRANT EXECUTE ON FUNCTION radar_resolver(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_sugestoes(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_numeros_proximos(integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_predio(integer, integer, date, date, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_rua(integer, date, date, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_bairro(text, date, date, text, integer) TO service_role;
