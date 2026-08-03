-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Livro das entregas que o webhook RECUSOU ou não conseguiu processar.
--
-- O buraco que isto fecha: quando a assinatura não confere, a rota devolve 401.
-- A Meta reentrega algumas vezes e desiste. Não sobra log, não sobra alerta,
-- não sobra linha em lugar nenhum — a mensagem do cliente simplesmente nunca
-- existiu para o sistema. E o gatilho mais provável disso é banal:
-- `WHATSAPP_APP_SECRET` ausente ou errada faz TODA mensagem ser recusada.
--
-- Só entram aqui as entregas com PROBLEMA. Gravar as bem-sucedidas duplicaria
-- `whatsapp_messages` e faria a tabela crescer com o volume normal de operação.
-- Mantendo só as falhas, vale a invariante que torna a tabela útil de olhar:
-- **qualquer linha aqui é uma perda real.** Tabela vazia é sistema saudável.
--
-- Não guardamos o corpo da entrega. Numa recusa por assinatura o conteúdo é,
-- por definição, não confiável; e quando é legítimo, é mensagem de cliente —
-- PII que já tem lugar próprio. O `wamid` basta para responder a pergunta que
-- importa ("aquela mensagem chegou?") sem duplicar conteúdo.

create type webhook_delivery_motivo as enum (
  -- Configuração nossa: a variável não está no ambiente. Rejeita 100% das
  -- mensagens e é o modo de falha mais provável de todos.
  'sem_segredo',
  -- Segredo configurado mas diferente do app da Meta. Mesmo efeito, outra causa.
  'assinatura_invalida',
  -- Assinatura conferiu e o processamento estourou (banco fora, bug).
  'erro_processamento'
);

create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),

  motivo webhook_delivery_motivo not null,

  -- Quantos eventos vinham no lote e quantos foram gravados. Numa recusa por
  -- assinatura os dois são 0 (nem chegamos a ler o corpo).
  eventos integer not null default 0,
  processados integer not null default 0,

  -- Identificadores das mensagens que falharam, quando dá para saber. É o que
  -- permite cruzar com o app do celular: "chegou lá e não aqui".
  wamids text[] not null default '{}',

  erro text,

  created_at timestamptz not null default now()
);

-- A pergunta quente é sempre "aconteceu alguma coisa recentemente?".
create index if not exists idx_webhook_deliveries_recentes
  on webhook_deliveries (created_at desc);

alter table webhook_deliveries enable row level security;

-- Mesmo padrão das demais: o app acessa via service_role, que ignora RLS; a
-- policy existe para a tabela não ficar sem definição explícita.
drop policy if exists "Service role manages webhook_deliveries" on webhook_deliveries;
create policy "Service role manages webhook_deliveries" on webhook_deliveries
  for all using (true) with check (true);
