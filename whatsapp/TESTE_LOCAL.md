# Teste local do CRM (WhatsApp) com dados reais

Objetivo: exercitar, num ambiente de teste, o que foi construído — IA Fase 1
(pendências do dia), Fase 2 (ações guiadas), vínculo de imóvel/cliente,
fixar conversa e gatilho "/". Nada aqui toca a produção do site/painel além de
criar linhas nos schemas `whatsapp` e (se testar captação) `captacoes`.

> Recomendo fazer isto contra o **Supabase de produção do sistema** só se estiver
> confortável — as tabelas ficam isoladas no schema `whatsapp`. Se preferir zero
> risco, use um projeto Supabase separado só para este teste.

---

## 1. Banco — rodar as migrations (uma vez)

No **SQL Editor** do Supabase, rode os arquivos de `whatsapp/supabase/migrations/`
**um de cada vez, na ordem**, colando o conteúdo de cada um e executando:

```
0000_schema.sql        ← cria o schema whatsapp + grants (rode sozinho, primeiro)
0001 … 0011            ← tabelas e evoluções
0012_rls.sql           ← RLS (rode sozinho)
0013_contact_cliente_link.sql   ← cliente_id nos contatos
0014_conversation_pin.sql       ← pinned_at nas conversas
```

Depois, em **Settings → API → Exposed schemas**, adicione **`whatsapp`** à lista
(deixe `public` e `captacoes` como já estão). Sem isso o CRM dá erro de schema.

## 2. Variáveis — `whatsapp/.env.local`

Copie de `.env.local.example` e preencha (o `.example` tem as explicações):

```
NEXT_PUBLIC_DATA_SOURCE=supabase          # usa o banco real
NEXT_PUBLIC_SUPABASE_URL=...              # mesmo do painel/site
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...             # service_role (NUNCA no navegador)

WHATSAPP_PROVIDER=mock                    # simula o WhatsApp sem a Meta

# Liga o CRM ao domínio real (imóvel por código + cliente por telefone):
BACKOFFICE_API_URL=https://api.morabilidade.com
BACKOFFICE_INTERNAL_TOKEN=...             # mesmo INTERNAL_API_TOKEN da API

ANTHROPIC_API_KEY=...                     # para Fase 1 e Fase 2
```

`ALERT_PHONE_NUMBER`/`CRON_SECRET`/push são opcionais para este teste.

## 3. Subir local

```bash
cd whatsapp
npm install
npm run dev        # http://localhost:3000
```

Login: a tela `/login` usa o **Supabase Auth do mesmo projeto** — entre com um
usuário que já exista no painel (mesma conta). Não precisa criar usuário novo.

---

## 4. Roteiro de teste (por feature)

**a) Conversas + fixar + "/"**
- Em `/conversas` (aba Conversas), use o formulário de simulação para criar uma
  mensagem recebida — aparece uma conversa nova.
- Botão direito (ou segurar) na conversa → **Fixar conversa**: ela sobe ao topo
  com o ícone de alfinete. Desafixar volta.
- Abra a conversa, digite **`/`** no campo de mensagem → abre as respostas
  rápidas. Antes, crie 1–2 templates pelo botão de "mensagens prontas".

**b) Vínculo de imóvel (catálogo real)**
- Abra um contato → seção Imóveis → vincule um **código real** (ex.: MB-000xx).
- Deve aparecer, abaixo do código, o **status/bairro/preço** do imóvel de verdade.
- Teste um código de imóvel **reservado/vendido**: também resolve (o endpoint
  interno não filtra por disponibilidade).

**c) Vínculo de cliente (por telefone)**
- Abra um contato cujo telefone exista como **cliente** no painel. No topo da
  ficha deve surgir o badge **"Cliente CL-xxxxx"** (casamento automático).

**d) Assistente — Fase 2 (ações guiadas)**
- Aba **Assistente**. Ex.: "agendar visita com o \<nome\> amanhã às 15h".
  → aparece um card de proposta. **Confirmar** cria o lembrete (veja em Lembretes).
- Teste o range: peça uma visita **domingo** ou **22h** → ao confirmar, o card
  mostra o erro de horário (validação no servidor).
- Ex.: "criar captação: Rua X 123, 3 quartos" → confirma e cria no board de
  captações.

**e) IA — Fase 1 (pendências do dia)**
- A seção "🤖 Assistente" entra no **resumo diário** (cron). Para disparar à mão:
  `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/daily-summary`
  (defina `CRON_SECRET` no `.env.local`). Sem `ALERT_PHONE_NUMBER` ele só devolve
  o texto do resumo na resposta, sem enviar.

---

## 5. O que observar / desfazer

- **Sem `ANTHROPIC_API_KEY`**: os recursos de IA mostram erro amigável e o resto
  funciona — comportamento esperado (best-effort).
- **Sem `BACKOFFICE_*`**: vínculos por código/telefone simplesmente não enriquecem
  (sem badge/detalhes), sem quebrar.
- **Rollback do teste**: como tudo vive no schema `whatsapp` (e a captação de
  teste no `captacoes`), dá para limpar apagando as linhas criadas ou, se for um
  projeto Supabase só de teste, dropando o schema `whatsapp`.
