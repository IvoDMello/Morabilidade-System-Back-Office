# Painel CRM (WhatsApp)

CRM de atendimento via WhatsApp para operação imobiliária: contatos (proprietários,
clientes, locatários, leads, parceiros), anotações permanentes, lembretes, central
de lembretes, etiquetas e conversas de WhatsApp.

## Integração ao monorepo (2026-07-25)

Este projeto nasceu isolado (`victorbathich/painel-crm`) e foi incorporado ao
monorepo Morabilidade como subprojeto `whatsapp/`, no mesmo padrão de
`captacoes/`. O que mudou na integração:

- **Banco**: usa o **Supabase principal** do sistema, com todas as tabelas no
  schema **`whatsapp`** (evita colisão com `tags` etc. do sistema). Migrations
  `0000_schema.sql` → `0012_rls.sql`, rodadas na ordem, uma por vez, no SQL
  Editor. Depois de rodar, **expor o schema** em Settings → API → Exposed
  schemas (senão o PostgREST devolve 406).
- **Segurança** (o projeto original não tinha nenhuma):
  - Login obrigatório via Supabase Auth (`/login` + `middleware.ts`), mesmos
    usuários das captações. Webhook e crons ficam fora do guard — têm
    autenticação própria (assinatura da Meta / `CRON_SECRET`).
  - **RLS em todas as tabelas** (migration 0012): anon não lê nada.
  - Acesso a dados no servidor via **service_role**
    (`SUPABASE_SERVICE_ROLE_KEY`, nova env obrigatória no modo supabase).
- **Idempotência**: entrega duplicada de webhook (mesmo `wamid`) vira no-op em
  vez de erro 500.
- **CI**: job `whatsapp` no workflow do monorepo (typecheck + build + checagem
  de migration duplicada).

**Próximos passos planejados** (nesta ordem):
1. **Ligar ao domínio real**: `properties` passa a consultar a API principal
   (imóveis reais por código, via `X-Internal-Token`, como as captações fazem) e
   `contacts` ganha `cliente_id` referenciando o cadastro de clientes — decisão
   de 2026-07-25, elimina o cadastro paralelo.
2. Crons de hora em hora via GitHub Actions do monorepo (a pendência do plano
   Hobby descrita abaixo).
3. Deploy: projeto Vercel próprio com Root Directory `whatsapp` (padrão
   captações), subdomínio via CNAME `cname.vercel-dns.com`.

---

## Rodando localmente

Pré-requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O sistema já funciona sem
nenhuma configuração adicional: por padrão usa uma fonte de dados **mock** (em
memória), seedada com contatos, anotações, lembretes e uma conversa de WhatsApp
de exemplo — incluindo lembretes vencidos, de hoje e futuros, para o Dashboard e
a Central de Lembretes ficarem preenchidos desde o primeiro acesso.

> O modo mock guarda os dados apenas em memória do processo do servidor: um
> `npm run dev` novo reseta os dados para o seed original. Isso é esperado nesta
> fase — é só para testar a interface.

## Conectando ao Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode todas as migrations em `supabase/migrations/` **na ordem numérica**
   (`0001_init.sql` até a mais recente) pelo SQL Editor do painel do Supabase,
   ou via Supabase CLI: `supabase db push`.
3. Copie `.env.local.example` para `.env.local` e preencha:

   ```bash
   NEXT_PUBLIC_DATA_SOURCE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
   ```

4. Reinicie `npm run dev`.

Trocar `NEXT_PUBLIC_DATA_SOURCE` entre `mock` e `supabase` é a única mudança
necessária — a aplicação não precisa de nenhum outro ajuste porque toda a
UI conversa apenas com `services/*.service.ts`, que por sua vez delega para a
fonte de dados escolhida (ver `services/data/`).

> Nota: `0002_whatsapp.sql` torna o telefone do contato **único e normalizado**
> (dígitos + DDI 55). Se você já tiver dois contatos de teste com o mesmo
> telefone, a migration vai falhar ao criar essa restrição — apague um deles
> antes de rodar.

## Notificações push (celular/desktop)

Opcional. Quando chega uma mensagem (mock ou webhook real), o painel envia uma
notificação push pros dispositivos inscritos, mesmo com o navegador fechado.

1. Gere o par de chaves VAPID:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Preencha no `.env.local`:

   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=xxxxx
   VAPID_PRIVATE_KEY=xxxxx
   ```

3. Rode a migration `0007_push_subscriptions.sql` (mesma ordem numérica das
   demais) se estiver usando Supabase.
4. No celular, abra o painel pelo navegador e **adicione à tela de início**
   (no iPhone: compartilhar → "Adicionar à Tela de Início" — o iOS só entrega
   push pra apps instalados assim). Depois, no menu do usuário (rodapé da
   sidebar), toque em "Ativar notificações".

Sem essas duas variáveis, o item "Ativar notificações" simplesmente não
aparece no menu — o resto do painel funciona normalmente.

## Conectando o WhatsApp (Cloud API)

Por padrão (`WHATSAPP_PROVIDER=mock`), o painel **simula** o recebimento de
mensagens: acesse `/conversas` e use o formulário "Simular mensagem recebida"
para testar todo o fluxo (contato criado automaticamente, conversa, resposta,
etiqueta, anotação, lembrete) sem nenhuma credencial da Meta.

Quando você tiver uma conta Meta Business com a WhatsApp Cloud API configurada:

1. No [Meta for Developers](https://developers.facebook.com/), crie um app,
   adicione o produto **WhatsApp** e pegue: `WHATSAPP_CLOUD_API_TOKEN` (token de
   acesso), `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_BUSINESS_ACCOUNT_ID`.
2. Em **App Settings → Basic**, copie o **App Secret** →
   `WHATSAPP_APP_SECRET`.
3. Escolha um valor qualquer para `WHATSAPP_VERIFY_TOKEN` (uma senha que só você
   e a Meta conhecem).
4. Preencha as 5 variáveis no `.env.local` e troque `WHATSAPP_PROVIDER=cloud-api`.
5. Publique o app (ou use um túnel como `ngrok` para testar localmente) e, no
   painel da Meta, configure o webhook apontando para
   `https://SEU_DOMINIO/api/whatsapp/webhook`, usando o mesmo
   `WHATSAPP_VERIFY_TOKEN` do passo 3. Inscreva o campo `messages`.

Nenhuma mudança de código é necessária — a rota `/api/whatsapp/webhook` e o
envio de mensagens já funcionam com as variáveis reais assim que
`WHATSAPP_PROVIDER=cloud-api` estiver definido (ver `services/whatsapp/`).

## Jobs de follow-up (esfriamento, alerta e resumo diário)

Três rotas de job, mas só uma está de fato agendada em `vercel.json` hoje:

> **Pendência conhecida**: o projeto está no plano **Hobby** da Vercel, que só
> executa cron 1x/dia — e **rejeita o deploy inteiro** se o `vercel.json`
> tiver algum cron mais frequente que isso. Por isso `follow-up-cooldown` e
> `awaiting-alerts` (pensados para hora em hora) **não estão** no
> `vercel.json`; só `daily-summary` (1x/dia) está. As rotas em si não
> dependem da Vercel (só checam `CRON_SECRET`), então o gatilho horário pode
> vir de qualquer lugar — a ideia é usar um GitHub Actions agendado, mas isso
> fica pra depois da unificação deste repositório no repositório principal
> (sistema + site + captações). Até lá, os dois primeiros jobs só rodam via
> disparo manual (`curl`, ver abaixo).

- `/api/cron/follow-up-cooldown` (pensado para hora em hora): conversas
  `respondida` em que o cliente sumiu há 3 dias ou mais viram
  `follow_up_sugerido` (aparecem na aba de mesmo nome em `/pendencias`).
- `/api/cron/awaiting-alerts` (pensado para hora em hora): conversas
  `aguardando_resposta` há mais de 2h disparam um alerta via WhatsApp para
  `ALERT_PHONE_NUMBER`, no máximo uma vez por dia por conversa.
- `/api/cron/daily-summary` (18h America/Sao_Paulo = 21h UTC no
  `vercel.json`, offset fixo já que o Brasil não tem mais horário de verão):
  resumo do dia — quantas conversas aguardando resposta (e há quanto tempo
  está a mais antiga), quantos follow-ups sugeridos (até 5 nomes + imóvel,
  depois "e mais X") e quantas conversas novas chegaram. Sem nenhuma
  pendência, manda só uma confirmação curta de que está tudo em dia.

Configure no `.env.local` (e nas env vars do projeto na Vercel):

- `ALERT_PHONE_NUMBER`: seu número (formato `55DDDNNNNNNNNN`) — pra onde vão
  os alertas e o resumo diário.
- `CRON_SECRET`: protege as três rotas. A Vercel envia esse valor sozinha em
  `Authorization: Bearer $CRON_SECRET` quando a env var está configurada no
  projeto — não precisa configurar nada além de definir o valor.

Pra testar localmente sem esperar o horário virar:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/follow-up-cooldown
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/awaiting-alerts
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-summary
```

> Sem um template aprovado na Meta, o alerta e o resumo diário são enviados
> como texto livre — só chegam de verdade se `ALERT_PHONE_NUMBER` tiver
> mandado mensagem pro bot nas últimas 24h (janela de atendimento da Cloud
> API). Fora da janela, a Meta rejeita o envio e o job segue em frente (no
> alerta, marca como alertado mesmo assim, pra não tentar de novo até o dia
> seguinte). Pra alertas e resumos confiáveis a qualquer hora, criar um
> template de utilidade na Meta Business Manager e trocar `sendTextMessage`
> por um envio de template em `services/jobs.service.ts`.

## Recursos de IA (resumo e sugestão de follow-up)

Na ficha de cada contato existem dois recursos que usam a API da Anthropic
(Claude):

- **Resumo com IA**: analisa a conversa de WhatsApp e as anotações do contato
  e extrai objetivo, orçamento, localização desejada, estágio atual e próximos
  passos. Gerado sob demanda (botão "Gerar resumo"/"Atualizar resumo") — não
  roda automaticamente.
- **Sugestão de Follow-up**: aparece na ficha de contatos sem interação há 7
  dias ou mais (e que não estão finalizados/perdidos). Gera uma mensagem de
  retomada personalizada, que pode ser copiada, editada no próprio campo e
  enviada direto pelo WhatsApp.

Para habilitar, preencha `ANTHROPIC_API_KEY` no `.env.local` com uma chave
gerada em [console.anthropic.com](https://console.anthropic.com/settings/keys)
e reinicie `npm run dev`. Sem essa variável, os botões de IA mostram um erro
amigável pedindo para configurá-la — o resto do painel continua funcionando
normalmente.

## Estrutura do projeto

```
app/            rotas (App Router): dashboard, contatos, conversas, lembretes,
                webhook do WhatsApp (app/api/whatsapp/webhook), server actions
components/     ui/ (shadcn), layout/ (sidebar, topbar), shared/ (genéricos)
features/       componentes específicos de cada domínio (dashboard, contacts,
                reminders-hub, whatsapp)
services/       regras de negócio (contacts/notes/reminders/tags/whatsapp/dashboard)
services/data/  contrato DataSource + implementações mock/ e supabase/
services/whatsapp/  contrato WhatsAppProvider + implementações mock/ e cloud-api/
lib/            utils, clientes Supabase, validações Zod, helpers de telefone/WhatsApp
hooks/          hooks utilitários (debounce, media query)
types/          tipos de domínio (Contact, ContactNote, ContactReminder, Tag,
                WhatsAppConversation, WhatsAppMessage, ...)
constants/      categorias, status, navegação — únicas fontes de verdade reutilizadas em toda a UI
supabase/       migrations SQL
```

Este projeto é **independente** do sistema principal: nenhuma integração foi
feita nesta fase. A separação em `services/` (regras de negócio) e
`services/data/`/`services/whatsapp/` (acesso a dados e a provedor de mensagens,
ambos plugáveis) foi pensada para que, quando a integração futura for decidida,
baste trocar a implementação ou expor os `services/*.service.ts` para outro
consumidor, sem reescrever a UI.

### Preparado para o futuro (não implementado nesta fase)

- Múltiplos atendentes e controle de permissões (`created_by` já existe como
  texto livre nas tabelas de anotação/lembrete/mensagem — ver comentário `TODO`
  na migration para a futura FK em `auth.users`)
- Mensagens de mídia (imagem/áudio/documento) recebidas do WhatsApp são
  guardadas com um texto de aviso, mas não exibidas de fato — suporte completo
  fica para depois
- Gestão global de etiquetas (renomear, mesclar duplicadas)
- Agenda e automações de atendimento

## Dados de teste (mock)

Seed em `services/data/mock/seed.ts`: 12 contatos cobrindo todas as categorias
e status, anotações de exemplo, lembretes distribuídos entre vencidos/hoje/
próximos, algumas etiquetas de exemplo e uma conversa de WhatsApp com histórico
de mensagens — o suficiente para exercitar o Dashboard, a busca/filtros de
Contatos, a Central de Lembretes e a tela de Conversas sem cadastrar nada.
