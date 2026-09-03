-- =====================================================================
-- Migration 0019, raia "Pauta de gravação"
--
-- Raia especial do quadro, fora do fluxo de status das captações: serve
-- para montar a sequência do que vai ser gravado (uma agenda). Cada
-- cartão de pauta é uma lista ordenada de itens; o item é texto livre e
-- pode (opcionalmente) apontar para uma captação do quadro.
--
-- Ordenação usa `ordem numeric` (fractional indexing), igual à captacao:
-- mover um cartão/item é um UPDATE só, sem reindexar a lista.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cartão de pauta
-- ---------------------------------------------------------------------
create table captacoes.pauta (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (char_length(trim(titulo)) between 1 and 120),
  descricao     text check (char_length(descricao) <= 2000),
  data_alvo     date,                                  -- dia previsto de gravação (agenda)
  ordem         numeric not null default 0,
  concluida     boolean not null default false,
  excluido_em   timestamptz,                           -- soft-delete, igual à captacao
  criado_por    uuid references auth.users(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_pauta_ordem on captacoes.pauta (ordem)
  where excluido_em is null;

create trigger trg_pauta_atualizado_em
  before update on captacoes.pauta
  for each row execute function captacoes.set_atualizado_em();

-- ---------------------------------------------------------------------
-- Item da pauta (texto livre + link opcional para uma captação)
--
-- on delete set null na captação: apagar/limpar uma captação não pode
-- sumir com a linha da agenda — o texto do item continua valendo.
-- ---------------------------------------------------------------------
create table captacoes.pauta_item (
  id            uuid primary key default gen_random_uuid(),
  pauta_id      uuid not null references captacoes.pauta(id) on delete cascade,
  texto         text not null check (char_length(trim(texto)) between 1 and 500),
  captacao_id   uuid references captacoes.captacao(id) on delete set null,
  concluido     boolean not null default false,
  ordem         numeric not null default 0,
  criado_por    uuid references auth.users(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_pauta_item_pauta on captacoes.pauta_item (pauta_id, ordem);
create index idx_pauta_item_captacao on captacoes.pauta_item (captacao_id)
  where captacao_id is not null;

create trigger trg_pauta_item_atualizado_em
  before update on captacoes.pauta_item
  for each row execute function captacoes.set_atualizado_em();

-- ---------------------------------------------------------------------
-- RLS: mesma regra do resto do app (todo autenticado tem acesso total)
-- ---------------------------------------------------------------------
alter table captacoes.pauta      enable row level security;
alter table captacoes.pauta_item enable row level security;

create policy "auth full access" on captacoes.pauta
  for all to authenticated using (true) with check (true);
create policy "auth full access" on captacoes.pauta_item
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Realtime: a agenda é montada a quatro mãos, precisa refletir na hora.
-- replica identity full para o payload de UPDATE/DELETE trazer a linha
-- inteira (o board detecta soft-delete por excluido_em).
-- ---------------------------------------------------------------------
alter table captacoes.pauta      replica identity full;
alter table captacoes.pauta_item replica identity full;

alter publication supabase_realtime add table captacoes.pauta;
alter publication supabase_realtime add table captacoes.pauta_item;

grant all on captacoes.pauta, captacoes.pauta_item to authenticated, service_role;
