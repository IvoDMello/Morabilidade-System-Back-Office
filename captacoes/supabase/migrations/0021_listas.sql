-- =====================================================================
-- Migration 0021, listas (etiquetas coloridas) — reformulação v2
--
-- O quadro deixa de organizar por coluna e passa a organizar por LISTA.
-- A coluna `status` da captação CONTINUA EXISTINDO e populada: ela vira a
-- "etapa" (uma só por captação) e é o que permite voltar para a v1 sem
-- rollback de banco. Ver captacoes/ROLLBACK.md §3.
--
-- Nada é removido aqui: nenhum valor sai do enum captacoes.status, nenhuma
-- coluna é renomeada. O cron de arquivamento (api/cron/arquivar) lê `status`
-- direto e continua funcionando.
--
-- A seção 3 faz a MIGRAÇÃO DOS DADOS: cada captação existente ganha uma
-- lista com o nome exato da coluna em que está hoje, para que nenhuma
-- classificação se perca na virada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lista
--
-- `permanente` marca as três que a equipe usa no dia a dia e que aparecem
-- sempre na barra de listas. As criadas pela migração dos dados nascem com
-- permanente = false: ficam recolhidas atrás de "ver todas as listas" e
-- podem ser apagadas depois da virada sem afetar captação nenhuma.
-- ---------------------------------------------------------------------
create table captacoes.lista (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(trim(nome)) between 1 and 40),
  cor           text not null default 'cinza'
                  check (cor in ('cinza','azul','verde','ambar','rosa','violeta')),
  permanente    boolean not null default false,
  ordem         numeric not null default 0,
  criado_por    uuid references auth.users(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Nome único ignorando caixa: evita "Gaveta" e "gaveta" convivendo.
create unique index idx_lista_nome on captacoes.lista (lower(trim(nome)));

create trigger trg_lista_atualizado_em
  before update on captacoes.lista
  for each row execute function captacoes.set_atualizado_em();

-- ---------------------------------------------------------------------
-- 2. Vínculo captação ↔ lista
--
-- `ordem` é a SEQUÊNCIA DE GRAVAÇÃO dentro daquela lista (fractional
-- indexing, igual à captacao.ordem): a fila de "Prioridade" é independente
-- da de qualquer outra lista. A ordem da visão "Todas" continua sendo
-- captacao.ordem.
-- ---------------------------------------------------------------------
create table captacoes.captacao_lista (
  captacao_id uuid not null references captacoes.captacao(id) on delete cascade,
  lista_id    uuid not null references captacoes.lista(id)    on delete cascade,
  ordem       numeric not null default 0,
  criado_em   timestamptz not null default now(),
  primary key (captacao_id, lista_id)
);

create index idx_captacao_lista_sequencia on captacoes.captacao_lista (lista_id, ordem);
create index idx_captacao_lista_captacao  on captacoes.captacao_lista (captacao_id);

-- ---------------------------------------------------------------------
-- 3. Migração dos dados existentes
-- ---------------------------------------------------------------------

-- 3a. As três permanentes. Prioridade nasce vazia, pronta para uso; Gaveta e
-- Seleção Especial recebem, logo abaixo, quem está nessas colunas hoje.
insert into captacoes.lista (nome, cor, permanente, ordem)
values
  ('Prioridade',       'ambar', true, 1000),
  ('Seleção Especial', 'rosa',  true, 2000),
  ('Gaveta',           'cinza', true, 3000)
on conflict do nothing;

-- 3b. Uma lista de migração por coluna que tem captação viva hoje.
--     O nome é o rótulo exato da coluna no quadro v1.
insert into captacoes.lista (nome, cor, permanente, ordem)
select m.rotulo, 'cinza', false, m.ordem
  from (values
    ('aguardando_informacoes',   'Aguardando informações',   4000),
    ('novas',                    'Novas',                    4100),
    ('em_decisao',               'Em decisão',               4200),
    ('pendente_negativa',        'Pendente de negativa',     4300),
    ('negativada',               'Negativada',               4400),
    ('pendente_agendar_visita',  'Pendente agendar visita',  4500),
    ('pendente_agendar_gravacao','Pendente agendar gravação',4600),
    ('publicada',                'Publicada',                4700)
  ) as m(status, rotulo, ordem)
 where exists (
   select 1 from captacoes.captacao c
    where c.status::text = m.status and c.excluido_em is null
 )
on conflict do nothing;

-- 3c. Cada captação entra na lista com o nome da coluna em que está.
--     Gaveta e Seleção Especial caem nas permanentes criadas em 3a.
--     A ordem dentro da lista começa igual à ordem que o cartão já tinha.
insert into captacoes.captacao_lista (captacao_id, lista_id, ordem)
select c.id, l.id, c.ordem
  from captacoes.captacao c
  join (values
    ('aguardando_informacoes',   'Aguardando informações'),
    ('novas',                    'Novas'),
    ('em_decisao',               'Em decisão'),
    ('pendente_negativa',        'Pendente de negativa'),
    ('negativada',               'Negativada'),
    ('pendente_agendar_visita',  'Pendente agendar visita'),
    ('pendente_agendar_gravacao','Pendente agendar gravação'),
    ('gaveta',                   'Gaveta'),
    ('selecao_especial',         'Seleção Especial'),
    ('publicada',                'Publicada')
  ) as m(status, rotulo) on m.status = c.status::text
  join captacoes.lista l on lower(trim(l.nome)) = lower(trim(m.rotulo))
 where c.excluido_em is null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. RLS e realtime (mesmo modelo do resto do schema: todo usuário
--    autenticado lê e escreve)
-- ---------------------------------------------------------------------
alter table captacoes.lista          enable row level security;
alter table captacoes.captacao_lista enable row level security;

create policy "auth full access" on captacoes.lista
  for all to authenticated using (true) with check (true);
create policy "auth full access" on captacoes.captacao_lista
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table captacoes.lista;
alter publication supabase_realtime add table captacoes.captacao_lista;
alter table captacoes.captacao_lista replica identity full;

grant all on captacoes.lista, captacoes.captacao_lista to authenticated, service_role;
