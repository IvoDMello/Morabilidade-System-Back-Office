-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- 0027: remove os doze contatos fictícios de demonstração do schema `whatsapp`.
--
-- Todos entraram de uma vez em 2026-07-27T02:03:53, com telefones sequenciais
-- 5527999900001..012 — assinatura de script de carga, não de gente. Com nomes
-- plausíveis ("Marcos Andrade", "Beatriz Costa") eles ficavam
-- indistinguíveis de cliente de verdade na lista de atendimento, e a dúvida
-- "esse aqui é real?" aparece exatamente na hora de apertar enviar.
--
-- ATENÇÃO à primeira versão deste arquivo, que não apagou nada: ela mirava nos
-- telefones do seed do modo mock (5511987654321 e companhia), que NÃO são os
-- que chegaram a este banco. Dois nomes coincidem entre os dois conjuntos
-- (Marcos Andrade, Fernanda Lima) com telefones diferentes — foi a guarda de
-- "telefone E nome" que impediu o estrago de apagar por coincidência de nome.
-- A mesma guarda continua aqui, agora com os pares certos.
--
-- Idempotente: rodar de novo devolve zero linhas e não faz nada.
--
-- Tudo que pende dos contatos vai junto por ON DELETE CASCADE: conversas e
-- mensagens (0002), notas e lembretes (0001), timeline e etiquetas (0004),
-- vínculos de imóvel (0005) e propostas do agente (0020). São 10 conversas e
-- 26 mensagens no total.

-- Confira antes de apagar, se quiser: troque `delete from` por
-- `select name, phone, status from` no comando abaixo e rode primeiro.
--
-- O `returning` no fim existe porque o SQL Editor do Supabase mostra grade de
-- resultado, mas engole `raise notice` — a versão anterior deste arquivo
-- relatava por notice, e por isso não deu sinal nenhum de vida ao ser rodada.
delete from contacts
 where (phone, name) in (
   ('5527999900001', 'Marcos Andrade'),
   ('5527999900002', 'Fernanda Lima'),
   ('5527999900003', 'João Pereira'),
   ('5527999900004', 'Beatriz Costa'),
   ('5527999900005', 'Carlos Mendes'),
   ('5527999900006', 'Patrícia Nunes'),
   ('5527999900007', 'Rafael Souza'),
   ('5527999900008', 'Carla Dias'),
   ('5527999900009', 'Eduardo Melo'),
   ('5527999900010', 'Sofia Ramos'),
   ('5527999900011', 'Lucas Prado'),
   ('5527999900012', 'Aline Torres')
 )
returning name, phone;


-- ── Sobra fora do schema `whatsapp` ─────────────────────────────────────────
--
-- Dois cadastros fictícios continuam em `public.clientes` depois desta
-- limpeza. Não há FK de lá para cá, então nada os leva junto:
--
--   CLI-0112  Sofia Ramos     27999900010    origem=whatsapp  ativo
--   CLI-0128  Marcos Andrade  5527999900001  origem=whatsapp  ativo
--
-- Só UM dos dois saiu daqui:
--
--   CLI-0128 nasceu da ficha de visita automática (services/ficha-visita.service.ts,
--   `garantirClienteDoContato` antes de criar a ficha — uma ficha com cliente_id
--   nulo não se liga a ninguém). Criado em 2026-08-15T17:11:16, um segundo antes
--   da primeira de QUATRO fichas geradas em 6 segundos, todas do MB-00033 e todas
--   pendentes: é o cron/teste rodado quatro vezes. A digital que confirma o
--   caminho é o `tipo_cliente` vazio — aquele é o único call site que não passa a
--   categoria do contato.
--
--   CLI-0112 NÃO veio do CRM. O telefone está sem o DDI 55 ("27999900010"), e todo
--   caminho daqui envia o número normalizado com 55 (lib/phone.ts). Como a busca
--   da API casa por dígitos absorvendo o 55, o contato do WhatsApp apenas
--   ENCONTROU e vinculou um cliente que já existia — fictício, mas criado por
--   outra porta (back-office ou carga do sistema principal).
--
-- A remoção fica fora deste arquivo de propósito: é outro app. Se for removê-los,
-- rode à mão, NA ORDEM — `fichas_visita.cliente_id` é ON DELETE SET NULL
-- (migration 034 da API), então apagar o cliente primeiro deixaria as quatro
-- fichas órfãs e sem como reencontrá-las:
--
--   -- 1) as quatro fichas fictícias (nenhuma tabela depende de fichas_visita)
--   delete from public.fichas_visita
--    where cliente_id = 'd549a974-adde-4a3f-b38c-85fafe830575'
--   returning imovel_codigo, visitante_nome, status;
--
--   -- 2) os dois cadastros
--   delete from public.clientes
--    where codigo in ('CLI-0112', 'CLI-0128')
--   returning codigo, nome_completo, telefone;
--
-- Conferido antes de escrever isto: os dois não têm preferência, nota, etiqueta,
-- imóvel como proprietário, locação nem autorização. As quatro fichas do CLI-0128
-- são a única dependência dos dois.
--
-- Enquanto estiverem lá, os dois aparecem em /clientes e nas Oportunidades do
-- back-office como qualquer outro cliente ativo.
