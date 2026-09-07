-- =====================================================================
-- Conferência da virada para a v2 (REDESIGN-BRIEF.md §8.5)
--
-- Rodar no SQL Editor do Supabase. Não altera nada — é só leitura.
--
--   1. ANTES de aplicar 0021: rodar as consultas 1 e 2 e GUARDAR o resultado.
--   2. Aplicar 0021 → 0022 → 0023, nesta ordem.
--   3. DEPOIS: rodar o arquivo inteiro e comparar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Retrato por status × decisão. É a foto que tem de bater no fim.
--
-- Atenção especial a gaveta e selecao_especial com decisao NULL: é esse
-- grupo que muda de lugar na virada (vai para a seção recolhida
-- "Engavetadas — reavaliar", dentro da aba Decidir).
-- ---------------------------------------------------------------------
select status,
       coalesce(decisao, '— sem decisão —') as decisao,
       count(*) as captacoes
  from captacoes.captacao
 where excluido_em is null
 group by status, decisao
 order by status, decisao;

-- ---------------------------------------------------------------------
-- 2. Total vivo. Este número não pode mudar em nenhuma etapa.
-- ---------------------------------------------------------------------
select count(*) as total_vivas
  from captacoes.captacao
 where excluido_em is null;

-- =====================================================================
-- Daqui para baixo, só depois de aplicar as migrations.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3. TESTE PRINCIPAL: nenhuma captação viva pode ter ficado sem lista.
--    Espera-se ZERO linhas. Qualquer linha aqui é uma classificação
--    perdida na virada — investigar antes de fazer o deploy.
-- ---------------------------------------------------------------------
select c.id, c.status, c.endereco, c.criado_em
  from captacoes.captacao c
  left join captacoes.captacao_lista cl on cl.captacao_id = c.id
 where c.excluido_em is null
   and cl.captacao_id is null
 order by c.criado_em;

-- ---------------------------------------------------------------------
-- 4. Quantas captações caíram em cada lista, e se a lista é permanente
--    (aparece sempre na barra) ou de migração (recolhida, descartável).
--    A soma da coluna `captacoes` pode passar do total da consulta 2:
--    uma captação pode estar em várias listas. Na virada, não passa —
--    cada uma entra em exatamente uma.
-- ---------------------------------------------------------------------
select l.nome,
       l.cor,
       l.permanente,
       count(cl.captacao_id) as captacoes
  from captacoes.lista l
  left join captacoes.captacao_lista cl on cl.lista_id = l.id
  left join captacoes.captacao c
         on c.id = cl.captacao_id and c.excluido_em is null
 group by l.id, l.nome, l.cor, l.permanente, l.ordem
 order by l.permanente desc, l.ordem;

-- ---------------------------------------------------------------------
-- 5. Fila de retornos ao proprietário depois do backfill da 0022.
--    - `pendente_negativa` deve virar retorno_feito = false, com
--      responsável preenchido e prazo NULO (sem prazo NÃO é atraso).
--    - `negativada` deve virar retorno_feito = true, sem carimbo de quem
--      avisou — esse dado não existia e não foi inventado.
-- ---------------------------------------------------------------------
select c.status,
       c.retorno_feito,
       count(*) filter (where c.retorno_responsavel is not null) as com_responsavel,
       count(*) filter (where c.retorno_prazo is not null) as com_prazo,
       count(*) as total
  from captacoes.captacao c
 where c.excluido_em is null
   and c.decisao = 'reprovada'
 group by c.status, c.retorno_feito
 order by c.status;

-- ---------------------------------------------------------------------
-- 6. Se a consulta 5 mostrar `com_responsavel = 0` nas pendentes, o
--    e-mail do backfill da 0022 não existe no auth.users. Descobrir o id
--    certo aqui e atribuir à mão (ou atribuir pela interface, em
--    Negativadas → Todas).
-- ---------------------------------------------------------------------
select u.id, u.email, p.nome
  from auth.users u
  left join captacoes.perfil p on p.user_id = u.id
 order by u.created_at;
