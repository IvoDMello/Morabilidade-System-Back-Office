-- =====================================================================
-- Migration 0024, listas permanentes protegidas no banco
--
-- Até aqui a proteção das três listas permanentes (Prioridade, Seleção
-- Especial e Gaveta) era só de interface: o ListaDialog esconde o botão
-- "Apagar" quando `permanente` é true, mas a RLS da 0021 é
-- `for all to authenticated using (true) with check (true)` — qualquer
-- pessoa autenticada apaga qualquer lista direto pela API do Supabase.
--
-- Como apagar uma lista cascateia em captacao_lista, perder a Gaveta
-- levaria junto a etiqueta de todas as captações engavetadas, sem
-- confirmação nenhuma e sem desfazer.
--
-- O modelo de acesso do schema NÃO muda: todo usuário autenticado continua
-- lendo e escrevendo tudo, inclusive criando, renomeando e apagando as
-- listas que a equipe cria. O que a trigger trava é só o caso destrutivo e
-- irreversível — e trava para o dono da sessão também, não só para a UI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Não apagar lista permanente
-- ---------------------------------------------------------------------
create or replace function captacoes.impede_apagar_lista_permanente()
returns trigger language plpgsql as $$
begin
  if old.permanente then
    raise exception 'A lista "%" é permanente e não pode ser apagada.', old.nome
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_lista_permanente_nao_apaga on captacoes.lista;
create trigger trg_lista_permanente_nao_apaga
  before delete on captacoes.lista
  for each row execute function captacoes.impede_apagar_lista_permanente();

-- ---------------------------------------------------------------------
-- 2. Não desmarcar `permanente` para contornar a trava
--
-- Sem isto a proteção seria teatro: bastaria um update pondo
-- permanente = false antes do delete. Marcar uma lista COMO permanente
-- segue liberado — só o caminho de saída é que fecha.
-- ---------------------------------------------------------------------
create or replace function captacoes.impede_despromover_lista()
returns trigger language plpgsql as $$
begin
  if old.permanente and not new.permanente then
    raise exception 'A lista "%" é permanente; desmarcar isso abriria caminho para apagá-la.', old.nome
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lista_permanente_nao_despromove on captacoes.lista;
create trigger trg_lista_permanente_nao_despromove
  before update on captacoes.lista
  for each row execute function captacoes.impede_despromover_lista();
