-- Migration 011: Índices de performance para filtros e buscas frequentes

-- Extensão para busca textual com ILIKE substring (%valor%)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- IMÓVEIS: busca textual (bairro_norm e cidade_norm)
-- Colunas geradas usadas com ILIKE '%valor%', requerem trigram
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_imoveis_bairro_norm_trgm
    ON imoveis USING gin(bairro_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_imoveis_cidade_norm_trgm
    ON imoveis USING gin(cidade_norm gin_trgm_ops);

-- ============================================================
-- IMÓVEIS: filtros numéricos (dormitorios, preço)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_imoveis_dormitorios
    ON imoveis(dormitorios);

CREATE INDEX IF NOT EXISTS idx_imoveis_valor_venda
    ON imoveis(valor_venda)
    WHERE valor_venda IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_valor_locacao
    ON imoveis(valor_locacao)
    WHERE valor_locacao IS NOT NULL;

-- ============================================================
-- IMÓVEIS: filtros enum/booleano
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_imoveis_mobiliado
    ON imoveis(mobiliado);

CREATE INDEX IF NOT EXISTS idx_imoveis_condicao
    ON imoveis(condicao);

-- ============================================================
-- IMÓVEIS: índice composto para o par de filtros mais comum
-- (disponibilidade + tipo_negocio aparece em quase toda listagem)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_imoveis_disponibilidade_tipo_negocio
    ON imoveis(disponibilidade, tipo_negocio);

-- ============================================================
-- CLIENTES: busca por nome (ILIKE '%nome%')
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm
    ON clientes USING gin(nome_completo gin_trgm_ops);

-- ============================================================
-- CLIENTES: filtro por tipo (usado na busca de proprietários)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_cliente
    ON clientes(tipo_cliente);
