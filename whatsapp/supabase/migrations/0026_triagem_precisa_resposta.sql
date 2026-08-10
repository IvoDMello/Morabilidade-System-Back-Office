-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- 0026: triagem da IA sobre a fila de "aguardando resposta".
--
-- `status = 'aguardando_resposta'` é regra mecânica: a última mensagem foi do
-- cliente. Na mesma fila caem "consegue visitar sábado?" e "obrigada!" — e uma
-- fila que mistura pergunta com agradecimento para de ser lida, que é o jeito
-- mais silencioso de deixar cliente no vácuo.
--
-- A triagem guarda a leitura da IA na própria conversa. `null` em
-- `triagem_precisa_resposta` significa NÃO TRIADA: nem que precisa, nem que não
-- precisa. Quem nunca foi triado continua aparecendo em "Aguardando".
--
-- `triagem_mensagem_em` guarda o `last_message_at` que a IA leu: se a conversa
-- andou depois disso, a triagem está velha e o job refaz.

alter table whatsapp_conversations
  add column if not exists triagem_precisa_resposta boolean,
  add column if not exists triagem_motivo text,
  add column if not exists triagem_mensagem_em timestamptz,
  add column if not exists triagem_em timestamptz;

-- A aba lê só as marcadas como "precisa responder", que são poucas: índice
-- parcial, como o de conversa fixada (0014), sem pesar na tabela.
create index if not exists whatsapp_conversations_triagem_idx
  on whatsapp_conversations (triagem_precisa_resposta)
  where triagem_precisa_resposta is true;

comment on column whatsapp_conversations.triagem_precisa_resposta is
  'Triagem da IA: true = pede resposta de verdade, false = encerramento, null = não triada.';
