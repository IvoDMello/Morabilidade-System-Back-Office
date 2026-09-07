-- =====================================================================
-- Migration 0022, retorno ao proprietário nas captações reprovadas
--
-- Reprovar deixa de ser um clique solto: passa a registrar o MOTIVO (que é
-- o que vai ser dito ao proprietário), um RESPONSÁVEL pelo retorno e um
-- PRAZO. Enquanto o retorno não é dado, a captação fica na fila da aba
-- Negativadas.
--
-- Não é evento de agenda: é tarefa com dono e prazo. Nada aqui toca o
-- Google Agenda.
--
-- Aditiva: só colunas novas na captacao, nenhuma removida ou renomeada.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists decisao_motivo       text,
  add column if not exists retorno_responsavel  uuid references auth.users(id),
  add column if not exists retorno_prazo        date,
  add column if not exists retorno_feito        boolean not null default false,
  add column if not exists retorno_feito_em     timestamptz,
  add column if not exists retorno_feito_por    uuid references auth.users(id);

-- Fila de retornos pendentes: só as reprovadas que ainda devem aviso.
create index if not exists idx_captacao_retorno_pendente
  on captacoes.captacao (retorno_responsavel, retorno_prazo)
  where retorno_feito = false and excluido_em is null;

-- ---------------------------------------------------------------------
-- Backfill do que já existe
--
-- `negativada` = retorno já dado. NÃO inventamos quem avisou nem quando:
-- esse dado não existe hoje, então retorno_feito_por e retorno_feito_em
-- ficam nulos e a interface mostra "—".
-- ---------------------------------------------------------------------
update captacoes.captacao
   set retorno_feito = true
 where status = 'negativada'
   and excluido_em is null;

-- `pendente_negativa` = retorno ainda devido. Prazo fica nulo de propósito:
-- a interface mostra "sem prazo" e NÃO trata como atrasado, para o primeiro
-- dia depois da virada não abrir numa parede vermelha.
update captacoes.captacao
   set retorno_feito = false
 where status = 'pendente_negativa'
   and excluido_em is null;

-- Responsável padrão dos retornos já pendentes. Hoje é o Ivo, que é quem faz
-- esses retornos; se o e-mail não existir no auth.users, ninguém é atribuído
-- e as captações aparecem em "Todas" (a interface permite atribuir depois).
update captacoes.captacao c
   set retorno_responsavel = u.id
  from auth.users u
 where u.email = 'ivompb2000@gmail.com'
   and c.status = 'pendente_negativa'
   and c.retorno_responsavel is null
   and c.excluido_em is null;

comment on column captacoes.captacao.decisao_motivo is
  'Motivo da reprovação — é o que vai ser dito ao proprietário no retorno.';
comment on column captacoes.captacao.retorno_feito is
  'true quando alguém já avisou o proprietário de que a captação não segue.';
