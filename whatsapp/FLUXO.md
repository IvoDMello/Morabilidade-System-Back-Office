# Mapa do fluxo de atendimento

Extraído do código em 2026-08-02. Serve para responder uma pergunta só: **onde
o tempo da operação vaza, e onde um agente pode entrar sem risco.**

Quem mudar o fluxo (webhook, cron, trigger de status, ação do copiloto) atualiza
este arquivo junto — ele só vale enquanto bater com o código.

> Cores dos diagramas: fundos claros com traço na paleta do produto (oliva
> `#585a4f`, dourado `#9a8d3a`, ember `#b0442e`, jade `#2e7d4a`), para renderizar
> legível tanto no tema claro quanto no escuro do GitHub.

---

## 1. Como o trabalho chega

```mermaid
flowchart TD
    A["Cliente manda mensagem"] --> B["Webhook Meta<br/>campo: messages"]
    A2["Time responde pelo app do celular"] --> B2["Webhook Meta<br/>campo: smb_message_echoes"]
    A3["Time responde pelo painel"] --> S["sendMessage → Cloud API"]

    B --> C["processIncomingMessage"]
    B2 --> C2["processEchoMessage"]

    C --> D{"Contato existe?"}
    D -->|"não"| E["Cria contato<br/>lead · novo · ligar"]
    D -->|"sim"| F["Usa o contato existente"]
    E --> G["getOrCreateConversation"]
    F --> G

    G --> H["Baixa mídia da Meta<br/>bucket privado · best-effort"]
    H --> I["Grava mensagem inbound"]
    C2 --> I2["Grava mensagem outbound"]
    S --> I2

    I --> T["trigger SQL<br/>sync_conversation_status_on_message"]
    I2 --> T
    I --> P["Push notification no celular"]
    T --> ST["Status da conversa muda"]

    I --> A["Copiloto analisa a conversa<br/>depois da resposta HTTP"]
    A --> PR["Propostas gravadas<br/>esperando confirmação humana"]

    style E fill:#f2efdc,stroke:#9a8d3a,color:#2d2f28
    style P fill:#e4f0e8,stroke:#2e7d4a,color:#2d2f28
    style A fill:#e4f0e8,stroke:#2e7d4a,color:#2d2f28
    style PR fill:#e4f0e8,stroke:#2e7d4a,color:#2d2f28
```

**Este diagrama já foi o mapa de onde o automático parava.** Até 2026-08-02 ele
terminava em "grava e notifica": qualquer análise dependia de alguém abrir a
conversa e clicar. Hoje a análise dispara aqui, fora do caminho da resposta
(`after` do Next — a Meta reentrega se o 200 demorar), e o rascunho fica
guardado esperando. O que **não** mudou é a trava: proposta continua sendo
proposta até um humano confirmar.

Três guardas evitam desperdício: dedupe por mensagem (a Meta reentrega),
desistência em rajada (só a última mensagem paga a chamada de modelo) e
supersessão das pendentes quando o assunto muda. Ver
`services/agent-proposals.service.ts`.

---

## 2. Máquina de estados da conversa

Vive num trigger de banco (`0009_fase1_status_conversa.sql`, ajustado em
`0010_fase2_pendencias.sql`) — não em código de aplicação.

```mermaid
stateDiagram-v2
    [*] --> aguardando_resposta: primeira mensagem do cliente

    aguardando_resposta --> respondida: qualquer outbound (painel ou celular)
    respondida --> aguardando_resposta: cliente escreve de novo

    respondida --> follow_up_sugerido: cron horário, 3 dias sem o cliente
    follow_up_sugerido --> respondida: alguém responde
    follow_up_sugerido --> aguardando_resposta: cliente volta

    aguardando_resposta --> encerrada: manual
    respondida --> encerrada: manual
    follow_up_sugerido --> encerrada: manual
```

O botão "Adiar" grava `follow_up_snoozed_until = +1 dia`. Ele **não muda o
status** — só tira a conversa da fila. Qualquer mensagem nova, de qualquer lado,
cancela o adiamento.

**Limitação estrutural:** este estado descreve *quem falou por último*, não *em
que ponto do processo a conversa está*. Não existe nenhum campo dizendo "captação
na etapa 2 de 5" ou "esperando as fotos". Por isso o copiloto reconstrói o
contexto do zero a cada clique, relendo até 60 mensagens.

---

## 3. Gatilhos automáticos que já existem

Todos disparados por relógio — nenhum por evento.

| Quando | Rota | O que faz | Onde mora o agendador |
|---|---|---|---|
| Hora em hora | `/api/cron/follow-up-cooldown` | `respondida` + 3 dias sem o cliente → `follow_up_sugerido` | GitHub Actions |
| Hora em hora | `/api/cron/awaiting-alerts` | `aguardando_resposta` há +2h → alerta no WhatsApp do plantão, máx. 1×/dia por conversa | GitHub Actions |
| Hora em hora | `/api/cron/visita-fichas` | Visita começando em ≤90min → gera a ficha na API principal → link pro cliente → template → plantão | GitHub Actions |
| 18h (21h UTC) | `/api/cron/daily-summary` | Resumo do dia + seção de IA com pendências | `vercel.json` |

> Os horários moram no GitHub Actions porque o plano Hobby da Vercel só executa
> cron 1×/dia e rejeita o deploy inteiro se o `vercel.json` pedir mais.

---

## 4. Onde a IA está hoje — e como ela dispara

```mermaid
flowchart LR
    M1["Copiloto da conversa"] --> BTN["Só roda por clique"]
    M2["Assistente livre"] --> BTN
    M3["Resumo do contato"] --> BTN
    M4["Sugestão de follow-up"] --> BTN
    M5["Revisar encerramentos"] --> BTN

    A1["Pendências do dia"] --> CRON["Roda sozinho<br/>1x por dia, às 18h"]

    style BTN fill:#f6e6e0,stroke:#b0442e,color:#2d2f28
    style CRON fill:#e4f0e8,stroke:#2e7d4a,color:#2d2f28
```

| Recurso | Função | Gatilho |
|---|---|---|
| Copiloto da conversa | `analisarEGuardar` → `proporAcoesDaConversa` | **automático, quando a mensagem chega** |
| Assistente livre | `proporAcoes` (`/assistente`) | botão |
| Resumo do contato | `generateConversationSummary` | botão |
| Sugestão de follow-up | `generateFollowUpSuggestion` | botão |
| Revisar encerramentos | `classificarEncerramentos` | botão |
| Pendências do dia | `gerarAnalisePendenciasDoDia` | **automático, 18h** |

Eram 5 de 6 só por clique. O copiloto da conversa — o de maior uso — passou a
rodar por evento: quando a mensagem chega, não quando alguém lembra. Os outros
quatro continuam manuais.

### Manual de voz

O *processo* (o que propor) mora no prompt de `services/assistant/index.ts`. A
*voz* (como escrever) mora em `VOZ.md`, na raiz, editável por quem atende sem
tocar em código. Cada proposta grava `voz_hash` + `modelo`, para separar "o
modelo mudou" de "mexeram no manual".

### Ações que o modelo pode propor

Três, definidas em `services/assistant/tools.ts`:

| Ferramenta | Efeito | Trava |
|---|---|---|
| `agendar_visita` | Cria lembrete de visita com corretor e código do imóvel | Horário revalidado no servidor: 08–19h, sem domingo, ≤60 dias |
| `criar_captacao` | Cria cartão no Kanban de captações | Endereço obrigatório |
| `sugerir_resposta` | Envia mensagem ao cliente | Texto editável antes do envio |

O contrato é sempre o mesmo: **o modelo propõe, o humano confirma, o servidor
revalida.** `handlers.ts` nunca confia nos argumentos que o modelo devolveu.

---

## 5. Integrações

```mermaid
flowchart LR
    W["CRM WhatsApp<br/>atendimento.morabilidade.com"]

    W -->|"X-Internal-Token"| API["API principal (FastAPI)"]
    API --> I1["GET /imoveis/interno/:codigo"]
    API --> I2["GET /clientes/interno/por-telefone/:tel"]
    API --> I3["POST /fichas-visita"]

    W -->|"mesmo Supabase, schema captacoes"| K["Kanban de captações"]
    W -->|"schema whatsapp"| DB["Contatos · conversas · lembretes · etiquetas"]
    W -->|"Cloud API"| META["Meta / WhatsApp"]

    style W fill:#ebeadf,stroke:#585a4f,color:#2d2f28
```

Tudo em `lib/backoffice-api.ts` é best-effort e devolve `null` em falha — exceto
`criarFichaVisita`, que lança de propósito: o cron precisa distinguir "não deu
para gerar" (vira pendência com o motivo exato) de "gerou".

---

## 6. Os buracos — onde o tempo vaza

| # | Buraco | Situação |
|---|---|---|
| 1 | ~~Nada acontece quando a mensagem chega.~~ | ✅ **Resolvido** — a análise dispara no webhook (`agent-proposals.service.ts`) |
| 2 | **A fila "aguardando resposta" é mecânica.** Um "obrigada!" entra na fila igual a uma pergunta. | Aberto — `classificarEncerramentos` existe, falta o gatilho |
| 3 | **Não existe estado de processo.** A conversa sabe quem falou por último, não em que etapa da captação está. | Parcial — a proposta pendente já carrega o "próximo passo", mas a etapa em si continua implícita |
| 4 | **Não existe roteamento.** Todo contato novo entra como `lead`/`novo`/`ligar`, sem corretor e sem etiqueta — mesmo quando a 1ª mensagem já diz "tenho um apartamento pra alugar". | Aberto — Nível 2 |
| 5 | ~~As propostas do copiloto não persistem.~~ | ✅ **Resolvido** — tabela `agent_proposals` (migration 0020) |
| 6 | **`follow_up_sugerido` não vem com texto.** O cron marca o status; a mensagem só existe se alguém abrir a ficha e clicar. | Aberto — mesma tabela serve, falta ligar no cron |
| 7 | **Fora do horário e fim de semana: silêncio total.** | Aberto — Nível 3 |

---

## 7. Onde o agente entra — escada de autonomia

A régua não é "o agente é bom o bastante?", é **"o que acontece se ele errar?"**.

### Nível 1 — pré-computar (o agente chega antes do humano) — ✅ implementado

Ganho máximo, risco praticamente zero: o agente nunca fala com o cliente, só
deixa o trabalho pronto.

- Mensagem chega → análise dispara no webhook → **rascunho de resposta e ações
  propostas já esperando** quando alguém abre a conversa.
- Resolveu os buracos **1 e 5**; **3** ficou parcial e **6** tem a tabela pronta,
  falta ligar no cron de follow-up.
- Onde mora: `services/agent-proposals.service.ts`, migration `0020`,
  `lib/after-response.ts`, `VOZ.md`.

**Validação em tudo, por enquanto.** Nenhum processo está liberado para agir
sozinho — nem os triviais. O placar em `/pendencias` (taxa de edição e sequência
de aprovações sem edição) é a régua para promover caso a caso, quando houver
base. Ele é indicador, não gatilho: nada muda de comportamento sozinho.

### Nível 2 — executar com veto (reversível, avisa depois)

Coisas em que o erro é barato e desfazível num clique:

- Etiquetar, classificar categoria do contato, atribuir corretor;
- Tirar encerramento da fila (`classificarEncerramentos` já existe — falta o gatilho);
- Abrir captação em rascunho quando um proprietário oferece imóvel;
- Escrever o texto do follow-up junto com a marcação do status.
- Resolve os buracos **2, 4, 6**.

### Nível 3 — responder sozinho, em faixa estreita

Só onde a resposta é **checklist factual**, não julgamento:

- Fora do horário → acusa recebimento e informa o retorno (resolve o buraco 7);
- Proprietário oferecendo imóvel → conduz a coleta (endereço, quartos, banheiros,
  portaria, fotos) até completar e entrega pronto.

O segundo caso é o melhor candidato do sistema inteiro: pergunta fechada,
resposta verificável, e o pior erro possível é perguntar de novo algo que já foi
respondido.

### Nunca autônomo

**Preço, disponibilidade, condição jurídica, negociação.** Numa imobiliária isso
não é risco de experiência — é risco de CRECI.
