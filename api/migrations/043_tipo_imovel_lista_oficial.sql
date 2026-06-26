-- Migration 043: Reduz os tipos de imóvel à lista oficial acordada.
--
-- Decisão (Ivo, 2026-06-26): o cadastro/filtros devem oferecer só:
--   Apartamento, Casa, Casa de vila, Casa de condomínio, Cobertura.
-- "Apartamento térreo" NÃO é um tipo armazenável de imóvel — continua sendo
-- um conceito virtual (apartamento + andar = 1), válido apenas como
-- preferência de cliente e filtro, conforme migrations 014/015.
--
-- Verificado antes de apertar os CHECKs: nenhum registro usa os tipos
-- removidos — imoveis: apartamento/casa/cobertura; cliente_preferencias:
-- apartamento/casa/NULL. Logo, sem migração de dados.
--
-- Alterações:
--   1. imoveis.tipo_imovel               -> 5 tipos (sem apartamento_terreo)
--   2. cliente_preferencias.tipo_imovel  -> 6 tipos (com apartamento_terreo)

-- 1) imoveis: 5 tipos
ALTER TABLE imoveis
    DROP CONSTRAINT IF EXISTS imoveis_tipo_imovel_check;

ALTER TABLE imoveis
    ADD CONSTRAINT imoveis_tipo_imovel_check
    CHECK (tipo_imovel IN (
        'apartamento','casa','casa_vila','casa_condominio','cobertura'
    ));

-- 2) cliente_preferencias: 6 tipos (mantém apartamento_terreo)
ALTER TABLE cliente_preferencias
    DROP CONSTRAINT IF EXISTS cliente_preferencias_tipo_imovel_check;

ALTER TABLE cliente_preferencias
    ADD CONSTRAINT cliente_preferencias_tipo_imovel_check
    CHECK (tipo_imovel IN (
        'apartamento','apartamento_terreo','casa','casa_vila',
        'casa_condominio','cobertura'
    ));
