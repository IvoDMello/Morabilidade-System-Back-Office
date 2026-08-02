-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Nível 1 do agente ("chegar antes do humano") + esteira de coleta de voz.
--
-- Até aqui as propostas do copiloto morriam no componente React: analisar a
-- conversa devolvia um array pra tela e acabava. Isso impedia as duas coisas
-- que a operação precisa:
--
--   1. PRÉ-COMPUTAR — a análise dispara quando a mensagem chega (webhook), não
--      quando alguém clica. Sem um lugar pra guardar, não há o que pré-computar.
--   2. APRENDER A VOZ — cada desfecho (aprovada / editada / descartada) é um
--      exemplo rotulado. A EDIÇÃO é o sinal mais valioso: o diff entre o que o
--      agente escreveu e o que de fato foi enviado é literalmente "como eu teria
--      dito". Guardamos os dois textos justamente para extrair esse diff.
--
-- A trava de segurança não muda: proposta nunca executa sozinha. Esta tabela
-- guarda intenção e desfecho; quem executa continua sendo handlers.ts, depois
-- da confirmação humana.

create type agent_proposal_status as enum (
  'pendente',    -- esperando decisão humana
  'aprovada',    -- confirmada sem alterar o texto
  'editada',     -- confirmada, mas o humano reescreveu antes de enviar
  'descartada',  -- humano dispensou
  'superada'     -- chegou mensagem nova e a análise ficou obsoleta antes de decidirem
);

create table if not exists agent_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,

  -- Mensagem que disparou a análise. Serve de dedupe (uma análise por mensagem
  -- recebida) e de âncora pra saber se a proposta ainda é sobre o assunto atual.
  trigger_message_id uuid references whatsapp_messages (id) on delete set null,

  tool text not null check (tool in ('agendar_visita', 'criar_captacao', 'sugerir_resposta')),
  args jsonb not null default '{}'::jsonb,
  resumo text not null,

  status agent_proposal_status not null default 'pendente',

  -- Só em sugerir_resposta. texto_sugerido é o que o agente escreveu;
  -- texto_final é o que saiu de verdade. Diferentes => status 'editada', e o
  -- par vira exemplo de treino de voz.
  texto_sugerido text,
  texto_final text,

  decidido_por text,
  decidido_em timestamptz,

  -- Rastreabilidade: com qual modelo e qual versão do manual de voz a proposta
  -- foi gerada. Sem isso não dá pra saber se uma piora veio do modelo ou do VOZ.md.
  modelo text,
  voz_hash text,

  -- 'webhook' = pré-computada quando a mensagem chegou; 'painel' = alguém clicou.
  origem text not null default 'webhook' check (origem in ('webhook', 'painel')),

  created_at timestamptz not null default now()
);

-- A leitura quente: propostas pendentes de um contato, ao abrir a conversa.
create index if not exists idx_agent_proposals_pendentes
  on agent_proposals (contact_id, created_at desc)
  where status = 'pendente';

-- Dedupe da análise: já analisamos esta mensagem recebida?
create index if not exists idx_agent_proposals_trigger
  on agent_proposals (trigger_message_id)
  where trigger_message_id is not null;

-- Métricas de graduação (taxa de edição por ferramenta) varrem por tool + desfecho.
create index if not exists idx_agent_proposals_metricas
  on agent_proposals (tool, decidido_em desc)
  where status in ('aprovada', 'editada', 'descartada');

-- Mesmo modelo de RLS das demais tabelas (ver 0012): autenticado lê e escreve,
-- anon não enxerga nada. Webhook e crons usam service_role, que ignora RLS.
alter table agent_proposals enable row level security;

drop policy if exists "auth full access" on whatsapp.agent_proposals;
create policy "auth full access" on whatsapp.agent_proposals
  for all to authenticated using (true) with check (true);
