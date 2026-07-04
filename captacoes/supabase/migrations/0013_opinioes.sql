-- =====================================================================
-- Migration 0013 — opiniões da equipe
--
-- 1. perfil: nome de exibição de cada usuário (avatar/autoria).
-- 2. opiniao: comentários da equipe por captação.
-- 3. opiniao_leitura: marca "li até aqui" por usuário+captação
--    (não lida = opinião de outra pessoa mais nova que o lido_em).
-- 4. opinioes_resumo(): totais e não lidas por captação para o quadro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfil (nome de exibição)
-- ---------------------------------------------------------------------
create table captacoes.perfil (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  nome          text not null check (char_length(trim(nome)) between 1 and 40),
  atualizado_em timestamptz not null default now()
);

alter table captacoes.perfil enable row level security;

create policy "perfil leitura geral" on captacoes.perfil
  for select to authenticated using (true);
create policy "perfil escreve o proprio" on captacoes.perfil
  for insert to authenticated with check (user_id = auth.uid());
create policy "perfil edita o proprio" on captacoes.perfil
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Opiniões
-- ---------------------------------------------------------------------
create table captacoes.opiniao (
  id          uuid primary key default gen_random_uuid(),
  captacao_id uuid not null references captacoes.captacao(id) on delete cascade,
  autor       uuid not null references auth.users(id),
  texto       text not null check (char_length(trim(texto)) between 1 and 2000),
  criado_em   timestamptz not null default now()
);
create index idx_opiniao_captacao on captacoes.opiniao (captacao_id, criado_em);

alter table captacoes.opiniao enable row level security;

create policy "opiniao leitura geral" on captacoes.opiniao
  for select to authenticated using (true);
create policy "opiniao cria como autor" on captacoes.opiniao
  for insert to authenticated with check (autor = auth.uid());
create policy "opiniao apaga a propria" on captacoes.opiniao
  for delete to authenticated using (autor = auth.uid());

-- ---------------------------------------------------------------------
-- Leitura (marcador por usuário+captação)
-- ---------------------------------------------------------------------
create table captacoes.opiniao_leitura (
  user_id     uuid not null references auth.users(id) on delete cascade,
  captacao_id uuid not null references captacoes.captacao(id) on delete cascade,
  lido_em     timestamptz not null default now(),
  primary key (user_id, captacao_id)
);

alter table captacoes.opiniao_leitura enable row level security;

create policy "leitura so a propria" on captacoes.opiniao_leitura
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Resumo para o quadro: total e não lidas por captação (do usuário atual).
-- Opinião própria nunca conta como não lida.
-- ---------------------------------------------------------------------
create or replace function captacoes.opinioes_resumo()
returns table (captacao_id uuid, total bigint, nao_lidas bigint)
language sql stable
security invoker
as $$
  select o.captacao_id,
         count(*) as total,
         count(*) filter (
           where o.autor <> auth.uid()
             and o.criado_em > coalesce(l.lido_em, '-infinity'::timestamptz)
         ) as nao_lidas
    from captacoes.opiniao o
    left join captacoes.opiniao_leitura l
      on l.captacao_id = o.captacao_id and l.user_id = auth.uid()
   group by o.captacao_id
$$;

-- Realtime: novas opiniões atualizam os badges do quadro na hora.
alter publication supabase_realtime add table captacoes.opiniao;

grant all on captacoes.perfil, captacoes.opiniao, captacoes.opiniao_leitura to authenticated, service_role;
grant execute on function captacoes.opinioes_resumo() to authenticated, service_role;
