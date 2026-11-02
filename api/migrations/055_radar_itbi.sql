-- 055: Radar Morabilidade, transações de ITBI da Prefeitura do Rio.
--
-- Base da página pública /radar do site: o visitante digita um endereço ou um
-- bairro e vê por quanto os imóveis foram vendidos, pelos valores declarados à
-- Prefeitura no ITBI. Fonte: planilhas da Secretaria Municipal de Fazenda,
-- importadas por api/scripts/radar_importar.py (lógica em app/services/radar).
--
-- Escrita só com a service role (importação). Leitura pública só pela API, em
-- /radar/publico/*: RLS ligado sem policy, mesmo padrão da 039.
--
-- Tamanho estimado: ~620 mil transações, 250 a 350 MB com índices. As tabelas
-- de logradouros são pequenas (~11 mil ruas, ~17 mil grafias).
--
-- Depende de: 011 (pg_trgm). Idempotente.
--
-- APLICADA no Supabase em 2026-11-02 (primeira carga: 619.027 transações).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Histórico das importações ───────────────────────────────────────────────
-- Uma linha por execução. `arquivos` guarda url + sha256 de cada planilha: se
-- nenhum arquivo mudou desde a última importação ok, a próxima nem processa.
-- `dados_ate` (último mês publicado) alimenta o rodapé da página.
CREATE TABLE IF NOT EXISTS radar_importacoes (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iniciada_em   timestamptz NOT NULL DEFAULT now(),
    concluida_em  timestamptz,
    status        text NOT NULL
                  CHECK (status IN ('rodando', 'ok', 'sem_mudancas', 'erro')),
    arquivos      jsonb NOT NULL DEFAULT '[]'::jsonb,
    linhas_lidas  integer,
    linhas_validas integer,
    descartes     jsonb,
    novas         integer,
    removidas     integer,
    dados_ate     date,
    erro          text
);

CREATE INDEX IF NOT EXISTS idx_radar_importacoes_status
    ON radar_importacoes (status, id DESC);

-- ── Transações ──────────────────────────────────────────────────────────────
-- Uma linha por transação da planilha. `hash` identifica a linha pelos campos
-- da fonte (não pelo texto formatado), então reimportar não duplica.
--
-- A rua é identificada por `cl`, o código de logradouro da Prefeitura: estável
-- entre os arquivos, ao contrário do nome (o arquivo de 2025 abrevia "AVN",
-- "PRA" serve para Praia e Praça). O nome de exibição vem de radar_logradouros.
--
-- `valor_m2` fica nulo nas transmissões parciais (parte transferida < 100%):
-- o valor declarado não corresponde à área inteira.
CREATE TABLE IF NOT EXISTS radar_transacoes (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash              text NOT NULL UNIQUE CHECK (length(hash) = 32),
    competencia       date NOT NULL,          -- 1º dia do mês da transação
    cl                integer NOT NULL,       -- código do logradouro
    trecho            smallint,
    numero            integer,                -- nulo quando a fonte não traz
    complemento       text,
    bairro            text NOT NULL,          -- exibição ("Jardim Botânico")
    bairro_busca      text NOT NULL,          -- "JARDIM BOTANICO"
    tipologia         text NOT NULL,          -- "APARTAMENTO", "SALA"...
    uso               text,                   -- "RESIDENCIAL"...
    parte_transferida numeric(6,2) NOT NULL,
    parcial           boolean NOT NULL DEFAULT false,
    valor_declarado   numeric(14,2) NOT NULL,
    area              numeric(12,2) NOT NULL, -- área do cadastro, em m²
    valor_m2          numeric(14,2),
    criado_em         timestamptz NOT NULL DEFAULT now()
);

-- Prédio (rua + número) e rua inteira (só cl), já ordenáveis por período.
CREATE INDEX IF NOT EXISTS idx_radar_transacoes_cl_numero
    ON radar_transacoes (cl, numero, competencia);

-- Resumo do bairro com filtro de período.
CREATE INDEX IF NOT EXISTS idx_radar_transacoes_bairro
    ON radar_transacoes (bairro_busca, competencia);

COMMENT ON TABLE radar_transacoes IS
    'Transações de ITBI da Prefeitura do Rio (valor declarado). Escrita só pela importação.';

-- ── Logradouros ─────────────────────────────────────────────────────────────
-- Um por código `cl`, com o nome de exibição já resolvido e contagens para o
-- autocomplete. Reescrito a cada importação (`importacao_id` marca a versão;
-- o que sobra de versões anteriores é apagado em radar_limpar_logradouros).
CREATE TABLE IF NOT EXISTS radar_logradouros (
    cl              integer PRIMARY KEY,
    tipo            text,                   -- "AVENIDA", "RUA"...
    nome            text NOT NULL,          -- "Avenida Vieira Souto"
    nome_busca      text NOT NULL,          -- "VIEIRA SOUTO"
    bairros         text[] NOT NULL DEFAULT '{}',  -- do mais ao menos negociado
    transacoes      integer NOT NULL DEFAULT 0,
    predios         integer NOT NULL DEFAULT 0,
    importacao_id   bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_radar_logradouros_nome_busca
    ON radar_logradouros (nome_busca);

-- Todas as grafias já vistas de cada logradouro, inclusive nomes antigos de
-- ruas renomeadas ("Rua Sobreiro" hoje é "Rua Paulo Franchini"). A busca e o
-- autocomplete procuram aqui e chegam ao `cl`.
CREATE TABLE IF NOT EXISTS radar_logradouro_nomes (
    cl              integer NOT NULL REFERENCES radar_logradouros (cl) ON DELETE CASCADE,
    nome_busca      text NOT NULL,
    nome            text NOT NULL,
    importacao_id   bigint NOT NULL,
    PRIMARY KEY (cl, nome_busca)
);

CREATE INDEX IF NOT EXISTS idx_radar_logradouro_nomes_trgm
    ON radar_logradouro_nomes USING gin (nome_busca gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_radar_logradouro_nomes_busca
    ON radar_logradouro_nomes (nome_busca);

-- ── RLS: negado por padrão para anon/authenticated ──────────────────────────
ALTER TABLE radar_importacoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_transacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_logradouros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_logradouro_nomes ENABLE ROW LEVEL SECURITY;

-- ── Funções da importação ───────────────────────────────────────────────────
-- Retornam escalares (text[] / integer) porque o PostgREST corta conjuntos em
-- 1000 linhas; a paginação é por chave (hash > p_depois).

CREATE OR REPLACE FUNCTION radar_listar_hashes(p_depois text DEFAULT '', p_limite integer DEFAULT 50000)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
    SELECT coalesce(array_agg(hash ORDER BY hash), '{}')
    FROM (
        SELECT hash FROM radar_transacoes
        WHERE hash > coalesce(p_depois, '')
        ORDER BY hash
        LIMIT p_limite
    ) s;
$$;

CREATE OR REPLACE FUNCTION radar_remover_hashes(p_hashes text[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    DELETE FROM radar_transacoes WHERE hash = ANY (p_hashes);
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION radar_limpar_logradouros(p_importacao bigint)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    n integer;
BEGIN
    DELETE FROM radar_logradouro_nomes WHERE importacao_id <> p_importacao;
    DELETE FROM radar_logradouros WHERE importacao_id <> p_importacao;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

-- Funções no schema public ficam expostas no PostgREST para qualquer papel.
-- Estas escrevem ou listam a base inteira: só a service role executa.
REVOKE ALL ON FUNCTION radar_listar_hashes(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_remover_hashes(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_limpar_logradouros(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_listar_hashes(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION radar_remover_hashes(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION radar_limpar_logradouros(bigint) TO service_role;
