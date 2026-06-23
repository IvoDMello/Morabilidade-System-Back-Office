-- =====================================================================
-- Habilita Realtime para o quadro Kanban (sincronização multiusuário).
-- Publica as mudanças da tabela captacao no canal do Supabase Realtime.
-- =====================================================================

alter publication supabase_realtime add table captacoes.captacao;

-- replica identity full: garante que o payload de UPDATE/DELETE traga a linha
-- completa (necessário para detectar soft-delete via excluido_em).
alter table captacoes.captacao replica identity full;
