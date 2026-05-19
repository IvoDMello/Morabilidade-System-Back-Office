-- Migration 024: FK direta do proprietário em imoveis.
--
-- Antes: a relação imóvel ↔ proprietário existia só de forma indireta, via
-- `clientes.imovel_codigo` (texto) + tipo_cliente='proprietario'. Frágil
-- (sem FK, suscetível a typo no código) e exigia join por código no listar.
--
-- Agora: coluna `proprietario_id uuid REFERENCES clientes(id)` em imoveis,
-- sincronizada bidirecionalmente com `contratos_locacao.proprietario_id`
-- na camada de aplicação. O campo `clientes.imovel_codigo` continua
-- existindo para retro-compatibilidade do CSV import, mas a fonte da
-- verdade passa a ser `imoveis.proprietario_id`.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS proprietario_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_proprietario
  ON imoveis(proprietario_id);

COMMENT ON COLUMN imoveis.proprietario_id IS
  'FK direta para o cliente proprietário. Sincroniza com contratos_locacao.proprietario_id.';

-- Backfill: para cada imóvel sem proprietario_id, tenta resolver a partir
-- do cliente com tipo_cliente='proprietario' e imovel_codigo correspondente.
-- Em caso de múltiplos clientes apontando para o mesmo código (situação
-- anômala, mas possível dado que imovel_codigo é texto livre), o backfill
-- pega o mais antigo (DISTINCT ON + ORDER BY created_at).
UPDATE imoveis i
SET proprietario_id = sub.cliente_id
FROM (
  SELECT DISTINCT ON (imovel_codigo)
    imovel_codigo,
    id AS cliente_id
  FROM clientes
  WHERE tipo_cliente = 'proprietario'
    AND imovel_codigo IS NOT NULL
    AND imovel_codigo <> ''
  ORDER BY imovel_codigo, created_at ASC
) sub
WHERE i.codigo = sub.imovel_codigo
  AND i.proprietario_id IS NULL;
