-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 1 do roadmap operacional — próxima ação obrigatória,
-- motivo da perda e favoritos.

alter table contacts add column if not exists next_action text not null default 'aguardar_retorno' check (
  next_action in (
    'ligar', 'agendar_visita', 'enviar_documentacao', 'negociar_proposta',
    'aguardar_retorno', 'outro'
  )
);

alter table contacts add column if not exists is_favorite boolean not null default false;

-- Motivo da perda: guardado como o estado atual do contato (não um log de
-- eventos) — suficiente para exibir na ficha e gerar estatísticas por motivo.
-- Um histórico completo de mudanças de status fica para a Timeline Automática.
alter table contacts add column if not exists loss_reason text check (
  loss_reason in (
    'comprou_concorrente', 'desistiu', 'preco_alto', 'sem_resposta',
    'imovel_inadequado', 'outro'
  )
);
alter table contacts add column if not exists loss_reason_note text;

create index if not exists idx_contacts_next_action on contacts (next_action);
create index if not exists idx_contacts_is_favorite on contacts (is_favorite) where is_favorite = true;
