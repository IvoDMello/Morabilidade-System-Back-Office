-- =====================================================================
-- Migration 0018, data de publicação + mover_cartao ciente de 'publicada'
-- (rodar DEPOIS da 0017, em transação separada)
--
-- 1. publicada_em: quando a captação foi marcada como publicada.
-- 2. mover_cartao carimba publicada_em ao entrar em 'publicada' e limpa
--    ao sair (reverter publicação), do mesmo jeito que já faz com a gaveta.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists publicada_em timestamptz;

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
         gaveta_revisao_em = case when p_para_status <> 'gaveta' then null else gaveta_revisao_em end,
         publicada_em      = case
           when p_para_status = 'publicada' then coalesce(publicada_em, now())
           else null
         end
   where id = p_captacao_id
   returning * into v_row;

  if v_de_status is distinct from p_para_status then
    insert into captacoes.historico (captacao_id, de_status, para_status, autor)
    values (p_captacao_id, v_de_status, p_para_status, auth.uid());
  end if;

  return v_row;
end;
$$;

grant execute on function captacoes.mover_cartao(uuid, captacoes.status, numeric, text) to authenticated, service_role;
