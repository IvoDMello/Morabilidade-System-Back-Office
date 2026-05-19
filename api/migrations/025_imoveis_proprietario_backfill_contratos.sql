-- Migration 025: Backfill adicional de imoveis.proprietario_id via contratos.
--
-- A migration 024 só conseguia preencher imoveis.proprietario_id quando o
-- proprietário estava cadastrado em `clientes` com `imovel_codigo` apontando
-- para o imóvel. Mas a operação tem imóveis cujo proprietário existia apenas
-- no contrato de locação (contratos_locacao.proprietario_id) — não havia
-- nenhum vínculo em clientes.imovel_codigo.
--
-- Resultado: para esses imóveis, a tela "Editar imóvel" abria com o campo
-- Proprietário vazio mesmo havendo locação ativa. Esta migration corrige.
--
-- Critério: usa o contrato MAIS RECENTE (qualquer status) do imóvel, dando
-- preferência aos ativos. DISTINCT ON garante 1 linha por imóvel.

UPDATE imoveis i
SET proprietario_id = sub.proprietario_id
FROM (
  SELECT DISTINCT ON (imovel_id)
    imovel_id,
    proprietario_id
  FROM contratos_locacao
  WHERE proprietario_id IS NOT NULL
  ORDER BY
    imovel_id,
    -- Ativos primeiro, depois encerrados/rescindidos
    CASE status
      WHEN 'ativo' THEN 0
      WHEN 'em_encerramento' THEN 1
      WHEN 'rescindido' THEN 2
      WHEN 'encerrado' THEN 3
      ELSE 9
    END,
    created_at DESC
) sub
WHERE i.id = sub.imovel_id
  AND i.proprietario_id IS NULL;
