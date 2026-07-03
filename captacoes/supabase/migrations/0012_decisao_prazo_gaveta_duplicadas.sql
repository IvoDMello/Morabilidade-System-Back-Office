-- =====================================================================
-- Migration 0012 — prazo de decisão, metadados da gaveta e duplicadas
-- (rodar DEPOIS da 0011, em transação separada)
--
-- 1. Default de status passa a ser 'novas' (fluxo: nasce em Novas).
-- 2. em_decisao_desde: início da regressiva de 5 dias em "Decisão".
-- 3. gaveta_motivo / gaveta_revisao_em: por que engavetou e quando reavaliar.
-- 4. mover_cartao passa a manter esses campos automaticamente.
-- 5. buscar_duplicadas: mesma captação por telefone normalizado ou URL do anúncio.
-- =====================================================================

alter table captacoes.captacao alter column status set default 'novas';

alter table captacoes.captacao
  add column if not exists em_decisao_desde  timestamptz,
  add column if not exists gaveta_motivo     text,
  add column if not exists gaveta_revisao_em date;

-- Backfill: cartões já em decisão herdam a data da última entrada na coluna.
update captacoes.captacao c
   set em_decisao_desde = coalesce(
         (select max(h.criado_em)
            from captacoes.historico h
           where h.captacao_id = c.id
             and h.para_status = 'em_decisao'),
         c.atualizado_em)
 where c.status = 'em_decisao'
   and c.em_decisao_desde is null;

-- ---------------------------------------------------------------------
-- Telefone normalizado: só dígitos, sem o DDI 55 (mesma regra do front).
-- ---------------------------------------------------------------------
create or replace function captacoes.tel_normalizado(t text)
returns text language sql immutable as $$
  select case when d ~ '^55' and length(d) > 11 then substr(d, 3) else d end
    from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) s
$$;

create index if not exists idx_captacao_tel_normalizado
  on captacoes.captacao (captacoes.tel_normalizado(whatsapp));

-- ---------------------------------------------------------------------
-- Duplicadas: todas as captações (qualquer status, inclusive lixeira)
-- com o mesmo telefone ou o mesmo anúncio.
-- ---------------------------------------------------------------------
create or replace function captacoes.buscar_duplicadas(
  p_whatsapp    text default null,
  p_anuncio_url text default null
)
returns table (
  id          uuid,
  endereco    text,
  status      captacoes.status,
  decisao     text,
  criado_em   timestamptz,
  excluido_em timestamptz
)
language sql stable as $$
  select c.id, c.endereco, c.status, c.decisao, c.criado_em, c.excluido_em
    from captacoes.captacao c
   where (nullif(captacoes.tel_normalizado(p_whatsapp), '') is not null
          and captacoes.tel_normalizado(c.whatsapp) = captacoes.tel_normalizado(p_whatsapp))
      or (nullif(lower(trim(trailing '/' from coalesce(p_anuncio_url, ''))), '') is not null
          and lower(trim(trailing '/' from coalesce(c.anuncio_url, ''))) =
              lower(trim(trailing '/' from coalesce(p_anuncio_url, ''))))
   order by c.criado_em desc
$$;

-- ---------------------------------------------------------------------
-- mover_cartao: além do que já fazia, mantém em_decisao_desde e limpa
-- os metadados da gaveta quando o cartão sai dela.
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
         decisao_em    = case when p_decisao is not null then now()      else decisao_em end,
         em_decisao_desde = case
           when p_para_status = 'em_decisao' and v_de_status is distinct from 'em_decisao' then now()
           when p_para_status <> 'em_decisao' then null
           else em_decisao_desde
         end,
         gaveta_motivo     = case when p_para_status <> 'gaveta' then null else gaveta_motivo end,
         gaveta_revisao_em = case when p_para_status <> 'gaveta' then null else gaveta_revisao_em end
   where id = p_captacao_id
   returning * into v_row;

  if v_de_status is distinct from p_para_status then
    insert into captacoes.historico (captacao_id, de_status, para_status, autor)
    values (p_captacao_id, v_de_status, p_para_status, auth.uid());
  end if;

  return v_row;
end;
$$;

grant execute on function captacoes.tel_normalizado(text) to authenticated, service_role;
grant execute on function captacoes.buscar_duplicadas(text, text) to authenticated, service_role;
grant execute on function captacoes.mover_cartao(uuid, captacoes.status, numeric, text) to authenticated, service_role;
