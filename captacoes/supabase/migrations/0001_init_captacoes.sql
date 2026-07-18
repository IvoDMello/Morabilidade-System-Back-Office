-- =====================================================================
-- Morabilidade · Kanban de Captações
-- Migration 0001, schema, tabelas, índices, RLS e RPC de movimentação
-- =====================================================================

create schema if not exists captacoes;

-- ---------------------------------------------------------------------
-- Enum de status (colunas do Kanban)
-- ---------------------------------------------------------------------
create type captacoes.status as enum (
  'aguardando_informacoes','novas','em_decisao',
  'pendente_negativa','negativada',
  'pendente_agendar_visita','pendente_agendar_gravacao'
);

-- ---------------------------------------------------------------------
-- Tabela principal: captacao (cartão do Kanban)
-- ---------------------------------------------------------------------
create table captacoes.captacao (
  id                 uuid primary key default gen_random_uuid(),
  status             captacoes.status not null default 'aguardando_informacoes',
  ordem              numeric not null default 0,           -- fractional indexing (sem reindexar)

  endereco           text not null,
  quartos            smallint,
  banheiros          smallint,
  tipo_portaria      text,
  contato_proprietario text,
  observacoes        text,
  pendencias         text,                                  -- "aguardando informações"

  decisao            text check (decisao in ('aprovada','reprovada')),
  decisao_autor      uuid references auth.users(id),
  decisao_em         timestamptz,

  visita_concluida   boolean not null default false,
  visita_data        date,
  gravacao_concluida boolean not null default false,
  gravacao_data      date,

  arquivado_em       timestamptz,                           -- ciclo de vida da mídia (90 dias)
  excluido_em        timestamptz,                           -- soft-delete (preserva auditoria)

  criado_por         uuid references auth.users(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- mantém atualizado_em em cada update
create or replace function captacoes.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_captacao_atualizado_em
  before update on captacoes.captacao
  for each row execute function captacoes.set_atualizado_em();

-- índices de leitura do board e do cron de arquivamento
create index idx_captacao_status_ordem on captacoes.captacao (status, ordem)
  where excluido_em is null;
create index idx_captacao_arquivar on captacoes.captacao (arquivado_em)
  where arquivado_em is not null;

-- ---------------------------------------------------------------------
-- Mídia (fotos no bucket + thumb; vídeos por URL externa)
-- ---------------------------------------------------------------------
create table captacoes.midia (
  id           uuid primary key default gen_random_uuid(),
  captacao_id  uuid not null references captacoes.captacao(id) on delete cascade,
  tipo         text not null check (tipo in ('foto','video')),
  storage_path text,        -- foto no bucket
  thumb_path   text,        -- thumbnail no bucket
  url_externa  text,        -- vídeo (YouTube/Drive)
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now()
);
create index idx_midia_captacao on captacoes.midia (captacao_id);

-- ---------------------------------------------------------------------
-- Documentos (acesso por signed URL de curta duração)
-- ---------------------------------------------------------------------
create table captacoes.documento (
  id            uuid primary key default gen_random_uuid(),
  captacao_id   uuid not null references captacoes.captacao(id) on delete cascade,
  storage_path  text not null,
  nome_original text,
  mime_type     text,
  tamanho_bytes bigint,
  criado_em     timestamptz not null default now()
);
create index idx_documento_captacao on captacoes.documento (captacao_id);

-- ---------------------------------------------------------------------
-- Histórico de movimentação (audit log)
-- ---------------------------------------------------------------------
create table captacoes.historico (
  id          uuid primary key default gen_random_uuid(),
  captacao_id uuid not null references captacoes.captacao(id) on delete cascade,
  de_status   captacoes.status,
  para_status captacoes.status,
  autor       uuid references auth.users(id),
  criado_em   timestamptz not null default now()
);
create index idx_historico_captacao on captacoes.historico (captacao_id);

-- ---------------------------------------------------------------------
-- RPC: movimentação atômica do cartão (status + ordem + histórico + decisão)
-- ---------------------------------------------------------------------
create or replace function captacoes.mover_cartao(
  p_captacao_id uuid,
  p_para_status captacoes.status,
  p_ordem       numeric,
  p_decisao     text default null   -- 'aprovada' | 'reprovada' | null
)
returns captacoes.captacao
language plpgsql
security invoker
as $$
declare
  v_de_status captacoes.status;
  v_row       captacoes.captacao;
begin
  select status into v_de_status
    from captacoes.captacao
   where id = p_captacao_id
   for update;

  if not found then
    raise exception 'captação % não encontrada', p_captacao_id;
  end if;

  update captacoes.captacao
     set status     = p_para_status,
         ordem      = p_ordem,
         decisao    = coalesce(p_decisao, decisao),
         decisao_autor = case when p_decisao is not null then auth.uid() else decisao_autor end,
         decisao_em    = case when p_decisao is not null then now()      else decisao_em end
   where id = p_captacao_id
   returning * into v_row;

  if v_de_status is distinct from p_para_status then
    insert into captacoes.historico (captacao_id, de_status, para_status, autor)
    values (p_captacao_id, v_de_status, p_para_status, auth.uid());
  end if;

  return v_row;
end;
$$;

-- =====================================================================
-- RLS, qualquer usuário autenticado tem leitura/escrita (todos têm acesso)
-- =====================================================================
alter table captacoes.captacao  enable row level security;
alter table captacoes.midia     enable row level security;
alter table captacoes.documento enable row level security;
alter table captacoes.historico enable row level security;

create policy "auth full access" on captacoes.captacao
  for all to authenticated using (true) with check (true);
create policy "auth full access" on captacoes.midia
  for all to authenticated using (true) with check (true);
create policy "auth full access" on captacoes.documento
  for all to authenticated using (true) with check (true);
create policy "auth full access" on captacoes.historico
  for all to authenticated using (true) with check (true);

-- acesso ao schema/sequências para os papéis do PostgREST
grant usage on schema captacoes to authenticated, service_role;
grant all on all tables in schema captacoes to authenticated, service_role;
grant execute on all functions in schema captacoes to authenticated, service_role;
