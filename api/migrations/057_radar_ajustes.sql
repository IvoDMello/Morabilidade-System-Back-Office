-- 057: MoraMétrica, ajustes depois do teste com os dados reais.
--
-- 1. Resumo de bairros pronto. radar_bairros() (056) agregava as ~620 mil
--    transações a cada chamada: 6,7 s com o banco frio, e a primeira chamada
--    real estourou o limite de 8 s da service role ("canceling statement due to
--    statement timeout"). Agora a importação grava os 164 bairros prontos em
--    radar_bairros_resumo e a função só lê. Esta migration já preenche a tabela.
--
-- 2. Fração ideal de lançamento. Unidades vendidas na planta aparecem como
--    TERRENO com a área do lote inteiro: a Rua Rino Levi (Barra) tem 568
--    "vendas" do mesmo lote de 5.370 m², e a mediana do R$/m² de terreno na
--    Barra dava R$ 4,49. Mesmo lote (rua, número e área) de 1.000 m² ou mais
--    vendido 10 vezes ou mais passa a contar como fração: fica na lista, mas
--    sem R$/m² e fora da mediana (parcial = true). Com 5 vendas a regra pegava
--    lotes reais de área redonda (1.000 m² no Joá a R$ 2 mil/m²).
--
-- 3. Autocomplete: entre ruas que começam com o texto digitado, a mais
--    negociada vem primeiro ("vieira" → Avenida Vieira Souto antes da Travessa
--    Vieira; "delfim" → Avenida Delfim Moreira antes da Rua Delfim).
--
-- Depende de: 055, 056. Idempotente.
--
-- APLICADA no Supabase em 2026-11-02 (marcou 2.827 frações ideais).

-- ── 1. Resumo de bairros ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS radar_bairros_resumo (
    chave           text PRIMARY KEY,       -- "JARDIM BOTANICO" (= bairro_busca)
    nome            text NOT NULL,          -- "Jardim Botânico"
    transacoes      integer NOT NULL,
    importacao_id   bigint NOT NULL
);

ALTER TABLE radar_bairros_resumo ENABLE ROW LEVEL SECURITY;

INSERT INTO radar_bairros_resumo (chave, nome, transacoes, importacao_id)
SELECT
    bairro_busca,
    min(bairro),
    count(*),
    coalesce((SELECT max(id) FROM radar_importacoes WHERE status = 'ok'), 0)
FROM radar_transacoes
GROUP BY bairro_busca
ON CONFLICT (chave) DO UPDATE
    SET nome = excluded.nome,
        transacoes = excluded.transacoes,
        importacao_id = excluded.importacao_id;

CREATE OR REPLACE FUNCTION radar_bairros()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'chave', chave, 'nome', nome, 'transacoes', transacoes
    ) ORDER BY transacoes DESC), '[]'::jsonb)
    FROM radar_bairros_resumo;
$$;

-- A limpeza pós-importação passa a cuidar também dos bairros.
CREATE OR REPLACE FUNCTION radar_limpar_logradouros(p_importacao bigint)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    DELETE FROM radar_logradouro_nomes WHERE importacao_id <> p_importacao;
    DELETE FROM radar_bairros_resumo WHERE importacao_id <> p_importacao;
    DELETE FROM radar_logradouros WHERE importacao_id <> p_importacao;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

-- ── 2. Fração ideal ─────────────────────────────────────────────────────────

-- Só ~20 mil das 620 mil linhas são TERRENO: índice parcial pequeno.
CREATE INDEX IF NOT EXISTS idx_radar_transacoes_terreno
    ON radar_transacoes (cl, numero, area)
    WHERE tipologia = 'TERRENO';

-- Chamada pela importação depois de inserir as linhas novas: um lançamento
-- cruza o limite de 10 vendas aos poucos, então a marcação é refeita na base
-- toda (barato, só olha terrenos).
CREATE OR REPLACE FUNCTION radar_marcar_fracoes()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    UPDATE radar_transacoes t
    SET parcial = true, valor_m2 = NULL
    FROM (
        SELECT cl, numero, area
        FROM radar_transacoes
        WHERE tipologia = 'TERRENO' AND area >= 1000
        GROUP BY cl, numero, area
        HAVING count(*) >= 10
    ) f
    WHERE t.tipologia = 'TERRENO'
      AND t.cl = f.cl
      AND t.numero IS NOT DISTINCT FROM f.numero
      AND t.area = f.area
      AND (t.valor_m2 IS NOT NULL OR NOT t.parcial);
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

SELECT radar_marcar_fracoes();

-- ── 3. Ordem do autocomplete ────────────────────────────────────────────────

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
    ), ordenados AS (
        SELECT c.cl, l.nome, c.grafia, l.bairros[1:3] AS bairros, l.transacoes, c.semelhanca,
               row_number() OVER (
                   ORDER BY c.prefixo DESC,
                            CASE WHEN c.prefixo THEN l.transacoes END DESC NULLS LAST,
                            c.semelhanca DESC,
                            l.transacoes DESC
               ) AS ordem
        FROM candidatos c
        JOIN radar_logradouros l USING (cl)
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'cl', cl, 'nome', nome, 'grafia', grafia, 'bairros', bairros,
        'transacoes', transacoes, 'semelhanca', semelhanca
    ) ORDER BY ordem), '[]'::jsonb)
    FROM ordenados
    WHERE ordem <= p_limite;
$$;

REVOKE ALL ON FUNCTION radar_bairros() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_limpar_logradouros(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_marcar_fracoes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_sugestoes(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_bairros() TO service_role;
GRANT EXECUTE ON FUNCTION radar_limpar_logradouros(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION radar_marcar_fracoes() TO service_role;
GRANT EXECUTE ON FUNCTION radar_sugestoes(text, integer) TO service_role;
