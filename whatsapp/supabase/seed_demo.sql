-- ============================================================================
-- SEED DE DEMONSTRAÇÃO — schema whatsapp (opcional, para ver as telas populadas)
-- ----------------------------------------------------------------------------
-- Rode no SQL Editor do Supabase. É idempotente (limpa os próprios dados antes
-- de reinserir) e usa UUIDs fixos reconhecíveis (prefixo d0000000-…). Para
-- REMOVER depois, rode só o bloco "LIMPEZA" no rodapé.
--
-- Esta versão traz VOLUME MAIOR e conversas desenhadas para exercitar a IA:
--   • promessa não cumprida (Patrícia, Eduardo)
--   • pergunta do cliente sem resposta (Fernanda, Carla)
--   • lead novo sem primeiro atendimento (Rafael)
--   • conversa resolvida (Sofia) como controle — a IA NÃO deve marcar
-- Todas as conversas "pendentes" têm atividade de HOJE, que é o recorte usado
-- pela análise de pendências do dia.
-- Os templates de mensagem já vêm da migration 0004 — não são recriados aqui.
-- ============================================================================
set search_path to whatsapp, public;

begin;

-- ── LIMPEZA (idempotência) ─────────────────────────────────────────────────
delete from contacts where id in (
  'd0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000006',
  'd0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000010',
  'd0000000-0000-0000-0000-000000000011','d0000000-0000-0000-0000-000000000012'
);

-- ── Etiquetas (reaproveita por nome as que já existirem) ────────────────────
insert into tags (name, color) values
  ('Comprador','emerald'), ('Investidor','violet'), ('Urgente','amber'), ('Locação','blue')
on conflict (lower(name)) do nothing;

-- ── Contatos ───────────────────────────────────────────────────────────────
insert into contacts (id, name, phone, email, category, status, is_favorite, general_notes) values
  ('d0000000-0000-0000-0000-000000000001','Marcos Andrade','5527999900001','marcos@example.com','proprietario','em_atendimento',true,'Tem 3 imóveis na Praia do Canto. Prefere contato à tarde.'),
  ('d0000000-0000-0000-0000-000000000002','Fernanda Lima','5527999900002','fernanda@example.com','cliente','visita_marcada',false,'Procura 2 quartos até R$ 600 mil.'),
  ('d0000000-0000-0000-0000-000000000003','João Pereira','5527999900003',null,'lead','novo',false,null),
  ('d0000000-0000-0000-0000-000000000004','Beatriz Costa','5527999900004','bia@example.com','locatario','aguardando_retorno',false,'Aguardando retorno sobre reajuste.'),
  ('d0000000-0000-0000-0000-000000000005','Carlos Mendes','5527999900005',null,'parceiro','em_atendimento',false,'Corretor parceiro — indica compradores.'),
  ('d0000000-0000-0000-0000-000000000006','Patrícia Nunes','5527999900006','patricia@example.com','cliente','em_atendimento',false,'Interessada em 2 quartos, precisa de financiamento.'),
  ('d0000000-0000-0000-0000-000000000007','Rafael Souza','5527999900007',null,'lead','novo',false,null),
  ('d0000000-0000-0000-0000-000000000008','Carla Dias','5527999900008','carla@example.com','cliente','em_atendimento',false,'Foco em Jardim Camburi, com garagem.'),
  ('d0000000-0000-0000-0000-000000000009','Eduardo Melo','5527999900009','edu@example.com','cliente','visita_marcada',false,'Quer visitar ainda hoje se possível.'),
  ('d0000000-0000-0000-0000-000000000010','Sofia Ramos','5527999900010','sofia@example.com','cliente','documentacao',false,'Gostou do apê na visita; montando proposta.'),
  ('d0000000-0000-0000-0000-000000000011','Lucas Prado','5527999900011',null,'lead','novo',false,'Veio de indicação do Carlos.'),
  ('d0000000-0000-0000-0000-000000000012','Aline Torres','5527999900012','aline@example.com','proprietario','em_atendimento',false,'Quer colocar apê para locação.');

-- ── Vínculos de etiqueta (busca id por nome) ───────────────────────────────
insert into contact_tags (contact_id, tag_id)
select v.contact_id, t.id
from (values
  ('d0000000-0000-0000-0000-000000000001'::uuid,'Comprador'),
  ('d0000000-0000-0000-0000-000000000001'::uuid,'Investidor'),
  ('d0000000-0000-0000-0000-000000000002'::uuid,'Urgente'),
  ('d0000000-0000-0000-0000-000000000003'::uuid,'Comprador'),
  ('d0000000-0000-0000-0000-000000000006'::uuid,'Comprador'),
  ('d0000000-0000-0000-0000-000000000008'::uuid,'Urgente'),
  ('d0000000-0000-0000-0000-000000000012'::uuid,'Locação')
) as v(contact_id, tagname)
join tags t on lower(t.name) = lower(v.tagname)
on conflict do nothing;

-- ── Conversas (last_message_* explícito; status ajustado pelo trigger) ──────
insert into whatsapp_conversations
  (id, contact_id, wa_phone_number, last_message_at, last_message_preview, last_message_direction, unread_count, pinned_at) values
  ('d0000000-0000-0000-0000-00000000b001','d0000000-0000-0000-0000-000000000001','5527999900001', now() - interval '2 hours','Aqui estão as fotos. Quer agendar uma visita?','outbound',0, now() - interval '1 hour'),
  ('d0000000-0000-0000-0000-00000000b002','d0000000-0000-0000-0000-000000000002','5527999900002', now() - interval '30 minutes','Consigo visitar amanhã?','inbound',2, null),
  ('d0000000-0000-0000-0000-00000000b003','d0000000-0000-0000-0000-000000000003','5527999900003', now() - interval '23 hours','É R$ 450/mês.','outbound',0, null),
  ('d0000000-0000-0000-0000-00000000b006','d0000000-0000-0000-0000-000000000006','5527999900006', now() - interval '4 hours','Te envio a simulação de financiamento ainda hoje, tá?','outbound',0, null),
  ('d0000000-0000-0000-0000-00000000b007','d0000000-0000-0000-0000-000000000007','5527999900007', now() - interval '20 minutes','Olá! Tenho interesse no MB-00120. Ainda está disponível?','inbound',1, null),
  ('d0000000-0000-0000-0000-00000000b008','d0000000-0000-0000-0000-000000000008','5527999900008', now() - interval '2 hours','E tem vaga de garagem?','inbound',1, null),
  ('d0000000-0000-0000-0000-00000000b009','d0000000-0000-0000-0000-000000000009','5527999900009', now() - interval '5 hours','Deixa eu confirmar com o proprietário e te retorno até o fim do dia.','outbound',0, null),
  ('d0000000-0000-0000-0000-00000000b010','d0000000-0000-0000-0000-000000000010','5527999900010', now() - interval '110 minutes','Que ótimo, Sofia! Qualquer dúvida na proposta, me chama.','outbound',0, null),
  -- Lucas e Aline: "aguardando" mas na verdade ENCERRAMENTO (a IA deve sinalizar)
  ('d0000000-0000-0000-0000-00000000b011','d0000000-0000-0000-0000-000000000011','5527999900011', now() - interval '1 hour','Obrigado! Pode deixar que eu te retorno assim que conversar em casa.','inbound',1, null),
  ('d0000000-0000-0000-0000-00000000b012','d0000000-0000-0000-0000-000000000012','5527999900012', now() - interval '90 minutes','Perfeito, muito obrigada pela atenção!','inbound',1, null);

-- ── Mensagens ──────────────────────────────────────────────────────────────
insert into whatsapp_messages
  (id, conversation_id, wa_message_id, direction, body, status, wa_timestamp, created_by, reply_to_id, reply_to_body, reply_to_direction) values
  -- Marcos (respondida; cliente é quem não voltou — controle: não é pendência do corretor)
  ('d0000000-0000-0000-0000-00000000c001','d0000000-0000-0000-0000-00000000b001','demo-m01','inbound','Oi! O apê da Praia do Canto ainda está disponível?','received', now() - interval '3 hours', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c002','d0000000-0000-0000-0000-00000000b001','demo-m02','outbound','Oi, Marcos! Está sim. Posso te mandar as fotos?','read', now() - interval '2 hours 50 minutes','Atendente',null,null,null),
  ('d0000000-0000-0000-0000-00000000c003','d0000000-0000-0000-0000-00000000b001','demo-m03','outbound','Aqui estão as fotos. Quer agendar uma visita?','read', now() - interval '2 hours','Atendente',null,null,null),
  -- Fernanda (PERGUNTA SEM RESPOSTA — pendência)
  ('d0000000-0000-0000-0000-00000000c004','d0000000-0000-0000-0000-00000000b002','demo-m04','inbound','Bom dia! Vi o anúncio do MB-00033.','received', now() - interval '40 minutes', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c005','d0000000-0000-0000-0000-00000000b002','demo-m05','inbound','Consigo visitar amanhã?','received', now() - interval '30 minutes', null,null,null,null),
  -- João (resolvida ontem; exemplo de citação — fora do recorte de hoje)
  ('d0000000-0000-0000-0000-00000000c006','d0000000-0000-0000-0000-00000000b003','demo-m06','inbound','Qual o valor do condomínio?','received', now() - interval '1 day', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c007','d0000000-0000-0000-0000-00000000b003','demo-m07','outbound','É R$ 450/mês.','read', now() - interval '23 hours','Atendente','d0000000-0000-0000-0000-00000000c006','Qual o valor do condomínio?','inbound'),
  -- Patrícia (PROMESSA NÃO CUMPRIDA — pendência)
  ('d0000000-0000-0000-0000-00000000c008','d0000000-0000-0000-0000-00000000b006','demo-m08','inbound','Oi! Gostei do apê de 2 quartos. Dá pra financiar?','received', now() - interval '5 hours', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c009','d0000000-0000-0000-0000-00000000b006','demo-m09','outbound','Oi, Patrícia! Dá sim. Te envio a simulação de financiamento ainda hoje, tá?','read', now() - interval '4 hours','Atendente',null,null,null),
  -- Rafael (LEAD NOVO SEM ATENDIMENTO — pendência)
  ('d0000000-0000-0000-0000-00000000c010','d0000000-0000-0000-0000-00000000b007','demo-m10','inbound','Olá! Tenho interesse no MB-00120. Ainda está disponível?','received', now() - interval '20 minutes', null,null,null,null),
  -- Carla (PERGUNTA SEM RESPOSTA após ida e volta — pendência)
  ('d0000000-0000-0000-0000-00000000c011','d0000000-0000-0000-0000-00000000b008','demo-m11','inbound','Qual o valor do IPTU do imóvel de Jardim Camburi?','received', now() - interval '3 hours', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c012','d0000000-0000-0000-0000-00000000b008','demo-m12','outbound','É cerca de R$ 120/mês.','read', now() - interval '2 hours 55 minutes','Atendente',null,null,null),
  ('d0000000-0000-0000-0000-00000000c013','d0000000-0000-0000-0000-00000000b008','demo-m13','inbound','E tem vaga de garagem?','received', now() - interval '2 hours', null,null,null,null),
  -- Eduardo (PROMESSA/COMBINADO CHEGANDO — pendência)
  ('d0000000-0000-0000-0000-00000000c014','d0000000-0000-0000-0000-00000000b009','demo-m14','inbound','Combinamos a visita pra hoje ainda?','received', now() - interval '6 hours', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c015','d0000000-0000-0000-0000-00000000b009','demo-m15','outbound','Deixa eu confirmar com o proprietário e te retorno até o fim do dia.','read', now() - interval '5 hours','Atendente',null,null,null),
  -- Sofia (RESOLVIDA — controle: a IA não deve marcar)
  ('d0000000-0000-0000-0000-00000000c016','d0000000-0000-0000-0000-00000000b010','demo-m16','inbound','Obrigada pela visita, adorei o apê!','received', now() - interval '2 hours', null,null,null,null),
  ('d0000000-0000-0000-0000-00000000c017','d0000000-0000-0000-0000-00000000b010','demo-m17','outbound','Que ótimo, Sofia! Qualquer dúvida na proposta, me chama.','read', now() - interval '110 minutes','Atendente',null,null,null),
  -- Lucas (encerramento: agradece e diz que retorna)
  ('d0000000-0000-0000-0000-00000000c018','d0000000-0000-0000-0000-00000000b011','demo-m18','outbound','Te mandei 3 opções na Praia do Canto na sua faixa. O que achou?','read', now() - interval '90 minutes','Atendente',null,null,null),
  ('d0000000-0000-0000-0000-00000000c019','d0000000-0000-0000-0000-00000000b011','demo-m19','inbound','Obrigado! Pode deixar que eu te retorno assim que conversar em casa.','received', now() - interval '1 hour', null,null,null,null),
  -- Aline (encerramento: agradecimento)
  ('d0000000-0000-0000-0000-00000000c020','d0000000-0000-0000-0000-00000000b012','demo-m20','outbound','Combinado, Aline. Te retorno com a proposta de valor de locação.','read', now() - interval '2 hours','Atendente',null,null,null),
  ('d0000000-0000-0000-0000-00000000c021','d0000000-0000-0000-0000-00000000b012','demo-m21','inbound','Perfeito, muito obrigada pela atenção!','received', now() - interval '90 minutes', null,null,null,null);

-- ── Lembretes ──────────────────────────────────────────────────────────────
insert into contact_reminders (id, contact_id, title, description, reminder_at, status) values
  ('d0000000-0000-0000-0000-00000000e001','d0000000-0000-0000-0000-000000000002','Visita — MB-00033','Confirmar horário com a Fernanda.', now() + interval '1 day','pendente'),
  ('d0000000-0000-0000-0000-00000000e002','d0000000-0000-0000-0000-000000000004','Retornar ligação','Falar sobre o reajuste do aluguel.', now() + interval '2 hours','pendente'),
  ('d0000000-0000-0000-0000-00000000e003','d0000000-0000-0000-0000-000000000006','Enviar simulação de financiamento','Prometida para hoje.', now() + interval '3 hours','pendente'),
  ('d0000000-0000-0000-0000-00000000e004','d0000000-0000-0000-0000-000000000009','Confirmar visita com o proprietário','Retornar ao Eduardo até o fim do dia.', now() + interval '4 hours','pendente');

commit;

-- ============================================================================
-- LIMPEZA (para remover a demonstração depois): rode só isto. Apaga os contatos
-- de demo em cascata (conversas, mensagens, vínculos, lembretes). As etiquetas
-- ficam (podem ser reais); remova-as manualmente se quiser.
--   set search_path to whatsapp, public;
--   delete from contacts where id in (
--     'd0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',
--     'd0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004',
--     'd0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000006',
--     'd0000000-0000-0000-0000-000000000007','d0000000-0000-0000-0000-000000000008',
--     'd0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000010',
--     'd0000000-0000-0000-0000-000000000011','d0000000-0000-0000-0000-000000000012');
-- ============================================================================
