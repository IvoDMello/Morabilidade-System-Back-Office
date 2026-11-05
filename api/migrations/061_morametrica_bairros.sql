-- 061: MoraMétrica, bairros e ruas mais buscados.
--
-- Até a 060, morametrica_buscas guardava só o tipo de resultado. Agora guarda
-- também onde a busca caiu, para o ranking do painel (Relatórios > Audiência):
--   bairro  nome do bairro como está na base ("Jardim Botânico"). A API
--           confere com os bairros da MoraMétrica antes de gravar.
--   cl      código do logradouro (radar_logradouros) nas buscas de rua,
--           prédio e unidade.
-- O número do prédio e a unidade continuam fora: o ranking não precisa deles,
-- e o apartamento apontaria para uma família.
--
-- Em que bairro a busca conta: a de prédio ou unidade, no bairro do prédio; a
-- de rua, no bairro onde a rua tem mais vendas (o primeiro de
-- radar_logradouros.bairros); a de bairro, no próprio. Ambíguo, nenhum e erro
-- ficam sem bairro.
--
-- As colunas seguem a regra da tabela: saem com a linha após 90 dias
-- (purge_old_logs). Buscas anteriores a esta migration não têm bairro.
--
-- Ordem do deploy: aplicar ANTES de publicar a API nova. Ela grava nestas
-- colunas e o painel chama analytics_morametrica_bairros: sem a migration, as
-- buscas com bairro deixam de ser registradas e o painel não abre. A API
-- anterior segue funcionando com a migration aplicada.
--
-- Depende de: 055, 060. Idempotente.
--
-- ⚠️ PENDENTE: rodar no SQL Editor do Supabase.

ALTER TABLE morametrica_buscas
    ADD COLUMN IF NOT EXISTS cl     INTEGER,
    ADD COLUMN IF NOT EXISTS bairro TEXT CHECK (length(bairro) <= 80);

COMMENT ON TABLE morametrica_buscas IS
    'Append-only: busca feita na MoraMétrica (tipo de resultado, rua e bairro; nunca número nem unidade). Apagada após 90 dias.';

-- Top bairros dos últimos `dias` dias, cada um com as suas ruas mais
-- buscadas, numa ida ao banco. `buscas` do bairro soma todas as buscas que
-- caíram nele; `buscas_bairro` é a parte que foi pelo bairro inteiro, sem rua.
-- Rua que saiu da base numa importação some da lista, mas segue no total.
CREATE OR REPLACE FUNCTION analytics_morametrica_bairros(dias INTEGER, limite INTEGER, limite_ruas INTEGER)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
    WITH buscas AS (
        SELECT m.tipo, m.cl, m.bairro
        FROM morametrica_buscas m
        WHERE m.is_bot = FALSE
          AND m.bairro IS NOT NULL
          AND m.created_at >= NOW() - make_interval(days => dias)
    ),
    top_bairros AS (
        SELECT bairro,
               count(*) AS buscas,
               count(*) FILTER (WHERE tipo = 'bairro') AS buscas_bairro
        FROM buscas
        GROUP BY bairro
        ORDER BY count(*) DESC, bairro
        LIMIT limite
    ),
    ruas AS (
        SELECT b.bairro, b.cl, l.nome AS rua, count(*) AS buscas,
               row_number() OVER (PARTITION BY b.bairro ORDER BY count(*) DESC, l.nome) AS posicao
        FROM buscas b
        JOIN top_bairros t ON t.bairro = b.bairro
        JOIN radar_logradouros l ON l.cl = b.cl
        GROUP BY b.bairro, b.cl, l.nome
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'bairro', t.bairro,
        'buscas', t.buscas,
        'buscas_bairro', t.buscas_bairro,
        'ruas', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'cl', r.cl, 'rua', r.rua, 'buscas', r.buscas
            ) ORDER BY r.posicao)
            FROM ruas r
            WHERE r.bairro = t.bairro AND r.posicao <= limite_ruas
        ), '[]'::jsonb)
    ) ORDER BY t.buscas DESC, t.bairro), '[]'::jsonb)
    FROM top_bairros t;
$$;

-- Só a service role (API) chama.
REVOKE ALL ON FUNCTION analytics_morametrica_bairros(INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION analytics_morametrica_bairros(INTEGER, INTEGER, INTEGER) TO service_role;

-- VERIFICAÇÃO (rode depois de aplicar e de fazer duas ou três buscas no site):
--
--   SELECT tipo, bairro, cl, created_at FROM morametrica_buscas ORDER BY id DESC LIMIT 5;
--   SELECT analytics_morametrica_bairros(30, 15, 15);
--
-- As buscas novas trazem bairro (e cl, quando foram de rua ou prédio), e a
-- função devolve esses bairros com as ruas.
