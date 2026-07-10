-- ============================================================
-- Morabilidade — Migration 047
-- Código curto e legível para clientes (CLI-0001), no mesmo
-- espírito do código de imóvel: citável em conversas, buscas,
-- relatórios e fichas.
--
-- Backfill por ordem de created_at; novos clientes recebem o
-- código automaticamente via DEFAULT com sequence (robusto a
-- inserções concorrentes). O lpad usa greatest() para não
-- truncar quando a numeração passar de 9999.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS clientes_codigo_seq;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Backfill dos clientes existentes por ordem de cadastro.
WITH ordenados AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
  FROM clientes
  WHERE codigo IS NULL
)
UPDATE clientes c
SET codigo = 'CLI-' || lpad(o.n::text, greatest(length(o.n::text), 4), '0')
FROM ordenados o
WHERE c.id = o.id;

-- Sequence continua do maior número já usado.
SELECT setval(
  'clientes_codigo_seq',
  COALESCE((SELECT max((substring(codigo FROM 'CLI-(\d+)'))::bigint) FROM clientes), 0) + 1,
  false
);

-- Função em vez de expressão inline no DEFAULT: garante um único
-- nextval() por linha inserida.
CREATE OR REPLACE FUNCTION gerar_cliente_codigo() RETURNS text AS $$
DECLARE
  n bigint := nextval('clientes_codigo_seq');
BEGIN
  RETURN 'CLI-' || lpad(n::text, greatest(length(n::text), 4), '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE clientes
  ALTER COLUMN codigo SET DEFAULT gerar_cliente_codigo();

ALTER TABLE clientes
  ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes (codigo);

COMMENT ON COLUMN clientes.codigo IS
  'Código curto e legível do cliente (CLI-0001), gerado automaticamente. Análogo ao codigo de imoveis.';
