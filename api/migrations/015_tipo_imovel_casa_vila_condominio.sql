-- Migration 015: Adiciona "casa_vila" e "casa_condominio" como tipos de imóvel.
--
-- Motivação: o mercado-alvo (Zona Sul RJ) faz distinção entre casa solta,
-- casa em condomínio fechado e casa de vila, buscas e cadastros precisam
-- separar esses três casos.
--
-- Alterações:
--   1. CHECK constraint de imoveis.tipo_imovel
--   2. CHECK constraint de cliente_preferencias.tipo_imovel
--   3. Função contar_oportunidades(), apenas re-criada para herdar a nova
--      CHECK constraint (a lógica de matching não muda; igualdade exata por tipo).

-- 1) imoveis
ALTER TABLE imoveis
    DROP CONSTRAINT IF EXISTS imoveis_tipo_imovel_check;

ALTER TABLE imoveis
    ADD CONSTRAINT imoveis_tipo_imovel_check
    CHECK (tipo_imovel IN (
        'casa','casa_vila','casa_condominio','apartamento','terreno',
        'sala','galpao','loja','cobertura','kitnet','outro'
    ));

-- 2) cliente_preferencias (inclui também 'apartamento_terreo' herdado da migration 014)
ALTER TABLE cliente_preferencias
    DROP CONSTRAINT IF EXISTS cliente_preferencias_tipo_imovel_check;

ALTER TABLE cliente_preferencias
    ADD CONSTRAINT cliente_preferencias_tipo_imovel_check
    CHECK (tipo_imovel IN (
        'casa','casa_vila','casa_condominio','apartamento','apartamento_terreo',
        'terreno','sala','galpao','loja','cobertura','kitnet','outro'
    ));
