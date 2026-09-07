-- =====================================================================
-- Migration 0023, agendamento com hora + espelho na Google Agenda
--
-- Visita e gravação passam a ter HORA, não só data — o evento no Google
-- precisa de início e fim. As colunas antigas `visita_data` e
-- `gravacao_data` (date) CONTINUAM existindo e populadas: são o que a v1
-- lê, e são o fallback de exibição de tudo que foi agendado antes desta
-- migration.
--
-- De propósito NÃO há backfill de `*_em` a partir de `*_data`: inventar um
-- horário para agendamento antigo criaria compromisso falso na agenda. Onde
-- `*_em` é nulo, a interface mostra só a data.
--
-- Os `*_google_event_id` guardam o id do evento espelhado, para conseguir
-- APAGAR o evento quando o agendamento é desfeito — mesmo padrão de
-- whatsapp/services/google-calendar.service.ts, que já roda em produção.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists visita_em                  timestamptz,
  add column if not exists gravacao_em                timestamptz,
  add column if not exists visita_duracao_min         smallint not null default 60,
  add column if not exists gravacao_duracao_min       smallint not null default 60,
  add column if not exists visita_google_event_id     text,
  add column if not exists gravacao_google_event_id   text;

-- Agenda: próximos compromissos em ordem cronológica.
create index if not exists idx_captacao_visita_em
  on captacoes.captacao (visita_em)
  where visita_em is not null and excluido_em is null;

create index if not exists idx_captacao_gravacao_em
  on captacoes.captacao (gravacao_em)
  where gravacao_em is not null and excluido_em is null;

-- Contabilidade de gravações: "quantas gravamos no período, e quais já têm
-- código de imóvel no sistema".
create index if not exists idx_captacao_gravadas
  on captacoes.captacao (gravacao_data desc)
  where gravacao_concluida = true and excluido_em is null;

comment on column captacoes.captacao.visita_em is
  'Data e hora da visita. Nulo em agendamento anterior à v2 — cair em visita_data.';
comment on column captacoes.captacao.visita_google_event_id is
  'Id do evento espelhado na agenda única da empresa; permite apagá-lo ao desmarcar.';
