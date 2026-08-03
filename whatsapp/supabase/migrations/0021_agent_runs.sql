-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Livro-razão das chamadas de modelo — medição e teto.
--
-- Com a 0020 a análise deixou de ser um botão e passou a rodar sozinha quando a
-- mensagem chega. Isso resolveu a latência e criou um problema novo: **cada
-- mensagem recebida vale uma chamada de modelo sobre até 60 mensagens de
-- histórico**. Enquanto o provider estava em mock isso custava zero. No dia em
-- que a coexistência entrar e o volume real começar, o custo passa a ser função
-- de quantas mensagens os clientes mandam — que é exatamente a variável que a
-- gente não controla.
--
-- Não dá pra pôr teto no que não se mede, então esta tabela faz as duas coisas:
--   1. MEDE — um registro por chamada, com tokens de entrada e saída. É a única
--      fonte de "quanto a IA custou ontem" que o sistema tem.
--   2. LIMITA — `dentroDoOrcamento()` conta as chamadas automáticas da última
--      hora antes de gastar a próxima (ver services/ai-budget.service.ts).
--
-- O teto vale só para o caminho AUTOMÁTICO. Clique de humano nunca é barrado:
-- quem clicou tem intenção, e negar isso custa mais caro (em confiança) do que
-- a chamada custa em dinheiro.

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),

  -- Nulo quando a chamada não é de uma conversa específica (assistente livre,
  -- análise do dia). O `on delete set null` preserva o custo já gasto mesmo se
  -- a conversa for apagada — a contabilidade não pode sumir com o dado de origem.
  conversation_id uuid references whatsapp_conversations (id) on delete set null,

  -- De onde partiu. É o que separa o que o teto controla (webhook, cron) do que
  -- ele nunca barra (painel).
  origem text not null check (origem in ('webhook', 'painel', 'cron')),

  -- Qual recurso gastou. Texto livre de propósito: recursos novos de IA entram
  -- sem migration, e um check aqui só criaria um acoplamento sem ganho.
  recurso text not null,

  modelo text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,

  -- Tokens de cache, separados porque têm preço próprio: leitura custa ~10% de
  -- uma entrada normal, e escrita custa 25% A MAIS. Somados aos de entrada
  -- esconderiam exatamente o número que diz se o cache está valendo a pena.
  -- Zero em `cache_read` por várias rodadas seguidas significa que o prefixo
  -- não está sendo reaproveitado (curto demais, ou algo volátil no meio dele).
  cache_creation_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,

  -- Qual conjunto de ferramentas a chamada usou. É o que separa a triagem
  -- organizacional (barata, sem manual de voz no prompt) da análise completa.
  modo text not null default 'organizacional'
    check (modo in ('organizacional', 'completo')),

  -- Preenchido quando a chamada falhou. Uma chamada que deu erro também custou
  -- tempo e pode ter custado tokens, então ela entra no livro do mesmo jeito.
  erro text,

  created_at timestamptz not null default now()
);

-- O índice serve à pergunta quente: "quantas chamadas automáticas na última
-- hora?". Parcial porque o teto só olha o caminho automático.
create index if not exists idx_agent_runs_recentes
  on agent_runs (created_at desc)
  where origem in ('webhook', 'cron');

create index if not exists idx_agent_runs_created_at on agent_runs (created_at desc);

alter table agent_runs enable row level security;

-- Mesmo padrão das demais tabelas: o acesso do app é via service_role, que
-- ignora RLS; a policy existe para não deixar a tabela sem definição explícita.
drop policy if exists "Service role manages agent_runs" on agent_runs;
create policy "Service role manages agent_runs" on agent_runs
  for all using (true) with check (true);
