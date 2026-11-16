-- 062: disponibilidade "em_cadastro".
--
-- Imóvel que já entrou na carteira mas ainda não foi anunciado. Os corretores
-- o enxergam no painel (a lista de Imóveis abre com "disponível e em cadastro")
-- para achar opções que ainda não estão no ar; o site não o mostra. Não há
-- regra nova para isso: todo endpoint público, o match de oportunidades e o
-- relatório de 30 dias ao proprietário já pedem `disponivel` explicitamente.
--
-- Ordem do deploy: aplicar ANTES de publicar a API e o painel novos. Sem ela,
-- salvar um imóvel como "Em cadastro" bate no CHECK e a API responde erro. A
-- API anterior segue funcionando com a migration aplicada.
--
-- Depende de: 001. Idempotente.
--
-- APLICADA no Supabase em 2026-11-16.

ALTER TABLE imoveis
    DROP CONSTRAINT IF EXISTS imoveis_disponibilidade_check;

ALTER TABLE imoveis
    ADD CONSTRAINT imoveis_disponibilidade_check
    CHECK (disponibilidade IN ('disponivel', 'em_cadastro', 'reservado', 'vendido_locado'));
