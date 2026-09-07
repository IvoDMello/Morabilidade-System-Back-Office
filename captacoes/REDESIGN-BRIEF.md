# Brief de design — Reformulação do Captações (v2)

> Prompt para o Claude Design. Colar inteiro.
> Ponto de rollback da v1: tag `captacoes-v1-pre-redesign` (ver `ROLLBACK.md`).

---

## 1. O produto

`captacoes.morabilidade.com` é a ferramenta interna da **Morabilidade**
(imobiliária boutique no Rio de Janeiro) onde as captações de imóveis que chegam
todo dia são analisadas, aprovadas ou negativadas, agendadas para visita e para
gravação de vídeo, e finalmente cadastradas no sistema principal como imóvel.

Quem usa: **Rodrigo e Leandro** (sócios, decidem), mais a equipe que alimenta as
captações. O uso é **majoritariamente no celular**, em movimento, entre visitas.
É um PWA instalado.

**Este é um app core da empresa.** Precisa ser bonito e preciso, não um
utilitário interno feio. É a ferramenta que os sócios abrem várias vezes por dia.

## 2. O problema com a versão atual

Hoje é um **Kanban de 9 colunas** (`aguardando_informacoes`, `novas`,
`em_decisao`, `pendente_negativa`, `negativada`, `pendente_agendar_visita`,
`pendente_agendar_gravacao`, `gaveta`, `selecao_especial`) mais uma raia de
"Pauta de gravação", com drag-and-drop.

O que não funciona:

- **Quadro é ruim no celular.** Rolagem horizontal entre colunas, cartões
  pequenos, arrastar com o dedo é impreciso. A tela mais usada é a pior tela.
- **Procurar captação em coluna não escala.** Com 9 colunas, achar um imóvel
  vira caça ao tesouro. **Filtrar é muito mais prático do que navegar entre
  colunas** — essa é a virada conceitual da v2.
- **Colunas viraram um balde de conceitos diferentes.** "Gaveta" e "Seleção
  Especial" não são etapas de um fluxo, são **formas de organizar** um imóvel.
  Estarem como colunas força escolher uma só e some com o imóvel da visão de
  quem decide.
- **As três colunas "pendente de…"** (negativa, agendar visita, agendar
  gravação) são listas de tarefa disfarçadas de etapa. O cartão fica parado ali
  e não existe nada que lembre, cobre ou marque data de verdade.
- **Não há visão de histórico nem contabilidade.** Ver as aprovadas de um
  período, revisitar uma negativada, ou responder "quantos vídeos gravamos este
  mês e de quais imóveis" é garimpo manual.

## 3. Princípios da v2

1. **Poucos agrupamentos, filtro forte.** No máximo **4 abas** — e elas já estão
   todas usadas (§5.1). Nada de proliferar sub-colunas. Se surgir a vontade de
   criar mais uma divisão, ela deve virar um **filtro** ou uma **lista**, não
   uma coluna nem uma aba.
2. **Leitura rápida e ação em um toque.** Aprovar, reprovar e agendar nunca
   escondidos atrás de menu.
3. **Celular primeiro.** O desktop é derivado, não o contrário.
4. **Nenhum dado se perde na virada.** Ver §8.
5. O Kanban sai completamente. **Nada de drag-and-drop entre colunas.**

## 4. Marca e identidade visual

O app já tem identidade definida — **manter e elevar**, não substituir.

### 4.1 Logo

Ativos que já existem no projeto e devem ser usados:

| Arquivo | Uso |
|---|---|
| `public/logo.png` | logo principal, hoje só na tela de login |
| `assets/Logo_fundoTransparente.png` | versão para fundo escuro (header olive) |
| `public/icon-192.png`, `public/icon-512.png` | ícones do PWA instalado |
| `public/login-hero.jpg` | foto do hero do login |

**A logo precisa aparecer no app, não só no login.** Colocá-la no cabeçalho —
versão em fundo transparente sobre o gradiente olive, altura discreta (~22–26px),
alinhada à esquerda, com o nome da seção ao lado. Ela é o que dá ao app cara de
produto da casa e não de ferramenta genérica.

### 4.2 Paleta

**Olive (primária):** `50 #f5f5f3` · `100 #e8e8e4` · `200 #d0d1cb` ·
`300 #b0b2a8` · `400 #888b7e` · `500 #6e7063` · `600 #585a4f` (default) ·
`700 #4a4d43` · `800 #3d3f36` · `900 #2e302a` · `950 #1a1c16`

**Gold (destaque):** `100 #f3f0d0` · `200 #e9e3a8` · `300 #e5da8a` ·
`400 #d8cb6a` (default) · `500 #c5b54a` · `700 #9a8d3a`

**Fundo da app** `#f3f4f0` · **cards** `#ffffff` com borda `#e8e9e3`
**Header hero:** `linear-gradient(150deg,#2c2e28 0%,#585a4f 58%,#454840 100%)`

Proporção 60/30/10: 60% neutros claros, 30% olive, 10% gold. **O gold é
acento** — botão principal, badge de destaque, detalhe da logo. Não usar gold
como fundo de área grande.

**Cores de etapa** (ponto + fundo do badge + texto):

| Etapa | dot | bg | fg |
|---|---|---|---|
| Aguardando informações | `#b0b2a8` | `#ebece7` | `#5f6157` |
| Novas | `#c5b54a` | `#f4f1d4` | `#857727` |
| Em decisão | `#d49a48` | `#f7ecd9` | `#8f6320` |
| Agendar visita | `#5a9a6e` | `#e5efe8` | `#2f6b46` |
| Agendar gravação | `#5887a0` | `#e3edf1` | `#2f5b6f` |
| Pendente de negativa | `#c98a8a` | `#f4e8e8` | `#8a4444` |
| Negativada | `#a85a5a` | `#f0e2e2` | `#7a3434` |
| Publicada | `#5a9a6e` | `#e5efe8` | `#2f6b46` |

### 4.3 Tipografia e forma

- Títulos em **Playfair Display** (500/600/700); corpo e interface em **Inter**.
- Labels de campo em maiúsculas, 11px/600, letter-spacing 0.04em, cor `#9a9c90`.
- **Botões de decisão:** Aprovar sólido `linear-gradient(150deg,#3a8a5c,#2f7350)`
  texto branco; Aprovar suave `#ecf5ef` / borda `#c3e0cd` / texto `#2f6b46`;
  Reprovar suave `#f7ecec` / borda `#e6c5c5` / texto `#9a3b3b`.
- **Raios:** cards 18px · badges 8–9px · pills 11px · chips e inputs 12–13px ·
  botões grandes 14px · FAB 20px.
- **Sombra de card:** `0 1px 2px rgba(46,48,42,.04), 0 10px 24px -16px rgba(46,48,42,.22)`.
- **Ícones:** linha, stroke 1.7–2.2, `currentColor` (equivalentes Lucide).

## 5. Arquitetura: etapa × lista

Dois conceitos que hoje estão misturados numa coisa só:

| | O que é | Quantos por captação |
|---|---|---|
| **Etapa** | Onde está no fluxo: **a decidir → aprovada → negativada → publicada** | exatamente 1 |
| **Lista** | Como a equipe organiza: Prioridade, Seleção Especial, Gaveta, e as que criarem | 0, 1 ou várias |

"Gaveta" e "Seleção Especial" **deixam de ser etapa e viram lista**. Uma captação
aprovada e em Gaveta continua aparecendo entre as aprovadas — só etiquetada.

### 5.1 Abas — quatro, e só quatro

1. **Decidir** — tudo que ainda não tem decisão. Tela de abertura.
2. **Aprovadas** — tudo que foi aprovado, com data de entrada, listas coloridas,
   filtro e **ordenação manual**.
3. **Agenda** — pendências, compromissos, sequência de gravação e o histórico do
   que já foi gravado.
4. **Negativadas** — o que foi reprovado, e sobretudo **os retornos que ainda
   faltam dar ao proprietário** (§6.9). É aba, não item de menu, porque é a
   lembrança de uma promessa feita a um cliente: precisa estar à vista.

**Acesso secundário** (menu ⋯ no cabeçalho): **Publicadas** · **Lixeira**.

### 5.2 A barra de abas

Com quatro destinos, no celular a navegação vai para o **rodapé**, em barra fixa
— alcance de polegar, padrão de app nativo, e libera o topo para a logo e a
busca. Cada item: ícone de linha + rótulo curto + **contador**. O contador de
Negativadas fica **vermelho quando há retorno atrasado**, e só conta o que é
do usuário logado.

No desktop, as mesmas quatro entram como navegação horizontal no cabeçalho.

## 6. As telas

### 6.1 Aba "Decidir"

Fila enxuta e escaneável. O que importa é **decidir rápido** e enxergar o que
trava a decisão.

- Cabeçalho olive com logo, total e busca.
- **Agrupamento por sub-etapa** (seções dentro da mesma rolagem vertical, não
  colunas): "Aguardando informações" (com o texto de pendências em destaque — é
  o que falta chegar), "Novas", "Em decisão".
- **Cartão de decisão:** foto de capa quando houver, endereço + bairro,
  especificações em chips (quartos, suítes, banheiros, vagas, m²), valor de
  venda, quem captou, **há quantos dias está parado** (alerta a partir de 3 dias).
- Botões **Aprovar** e **Reprovar** direto no cartão, sem abrir o detalhe.
- Badge de **opiniões** com contador de não lidas — é como Rodrigo e Leandro
  conversam sobre a captação.
- **Seção final "Engavetadas — reavaliar":** captações da lista Gaveta que ainda
  não têm decisão, recolhida por padrão, ordenada por data de revisão (vencida
  primeiro). Elas não podem poluir a fila do dia, mas também não podem sumir.
- Toque no corpo do cartão abre o **Detalhe**.

### 6.2 Aba "Aprovadas"

A tela mais importante da reformulação.

- **Barra de listas** logo abaixo do cabeçalho: pills roláveis horizontalmente
  com **ponto colorido + nome + contagem** — "Todas", "Prioridade",
  "Seleção Especial", "Gaveta", e as que o usuário criar. Pill ativa filtra.
  Padrão idêntico ao das listas do WhatsApp Business, que a equipe já usa no app
  de atendimento da casa.
- **Última pill "＋ Nova lista"**, abre o diálogo de criação (§6.4).
- **Linha de cada captação** — formato de lista, não card grande; precisa caber
  muita coisa na tela:
  - miniatura da foto de capa (quadrada, cantos arredondados) ou placeholder;
  - endereço em destaque, bairro abaixo;
  - especificações resumidas e valor;
  - **data de entrada** ("aprovada em 12/08" ou "há 26 dias");
  - **pontos coloridos** das listas a que pertence;
  - **selo da próxima pendência**: "Agendar visita" / "Agendar gravação";
  - **selo de gravada** com a data, quando já gravada;
  - **selo "MOR-1234"** quando já cadastrada como imóvel no sistema.
- **Menu do item** (⋯ ou toque longo): adicionar/tirar de listas, agendar,
  cadastrar no sistema, mover na sequência.

### 6.3 Ordenação e **sequência de gravação**

Requisito central: dá para **ordenar a lista à mão**, e essa ordem é a
**sequência do que vai ser gravado**.

- Seletor de ordenação no topo da lista, com **"Sequência (manual)" como opção**
  ao lado de: mais recentes, mais antigas, maior valor, menor valor, paradas há
  mais tempo.
- Em modo Sequência, cada linha ganha:
  - **alça de arrastar** (⠿, à esquerda ou à direita) para reordenar dentro da
    lista — arrastar **verticalmente numa lista** funciona bem no celular, ao
    contrário de arrastar entre colunas;
  - **setas ↑ / ↓** como alternativa acessível, sempre visíveis no celular;
  - **número da posição** (1, 2, 3…) para dar a leitura de fila.
- A ordem é **por lista**: a sequência de "Prioridade" é independente da de
  "Todas". Desenhar isso explicitamente — um rótulo tipo "Sequência de gravação
  · Prioridade" acima da lista.
- Mostrar um **resumo no topo** quando em modo Sequência: "12 na fila · 4 já
  gravadas".

> Nota de arquitetura: já existe no banco a coluna `ordem` com *fractional
> indexing* (`orderBetween`), usada hoje para ordenar dentro de coluna. É ela
> que sustenta essa sequência — reordenar é um `UPDATE` só.

### 6.4 Criar e editar lista

Diálogo simples:

- campo **Nome**;
- **seletor de cor** em grade de amostras circulares. Paleta de 6, alinhada à do
  app de atendimento — Cinza, Azul, Verde, Âmbar, Rosa, Violeta — reinterpretada
  para o olive/gold deste app;
- **prévia ao vivo** da pill como vai aparecer;
- em edição: renomear, trocar cor, excluir. Excluir a lista **não apaga captação
  nenhuma**, só remove a etiqueta — dizer isso na interface, com a contagem
  ("Remove a etiqueta de 14 captações. Nenhuma será excluída.").

### 6.5 Tela de filtros

Painel dedicado, no espírito dos filtros do site público e do sistema da
Morabilidade — **não um dropdown apertado**. Abre por botão no cabeçalho, com
badge da quantidade de filtros ativos. É o substituto das colunas: precisa ser
bom o bastante para ninguém sentir falta delas.

Campos:

- **Listas** — seleção múltipla, com os pontos coloridos.
- **Bairro** — múltipla escolha a partir dos bairros existentes.
- **Faixa de valor de venda** — mínimo e máximo, em R$.
- **Faixa de metragem** — mínimo e máximo, em m².
- **Quartos, suítes, vagas** — mínimos.
- **Período de entrada** — de / até.
- **Situação** (checkboxes): com visita agendada · com gravação agendada · sem
  agendamento · **já gravada** · **não gravada** · já cadastrada no sistema ·
  paradas há 3+ dias.
- Rodapé fixo: **Limpar tudo** e **Aplicar**, com a contagem do resultado
  ("Ver 17 captações").
- Depois de aplicados, os filtros viram **chips removíveis** no topo da lista.

### 6.6 Aba "Agenda"

Substitui as três colunas "pendente de…" por algo que funciona. Quatro seções na
mesma rolagem:

**a) Pendências** — dois grupos com contagem, cada um abrindo a lista:

- **Agendar visita**
- **Agendar gravação**

O retorno negativo **não fica aqui**: ele mora na aba Negativadas (§6.9), porque
é tarefa com prazo e dono, não compromisso de horário, e não vai para o Google
Agenda. Não duplicar a fila nos dois lugares.

**b) Próximos compromissos** — lista cronológica de visitas e gravações
marcadas, agrupada por dia ("Hoje", "Amanhã", depois a data por extenso), com
horário, endereço e tipo.

**c) Pauta de gravação** — a sessão de gravação de um dia/viagem: título, dia
previsto, e os itens na ordem em que serão gravados, com checkbox de concluído.
Um item pode apontar para uma captação.
*Resolver na tela a relação com a sequência do §6.3:* a Pauta é **um recorte
datado** montado a partir da fila ordenada. Desenhar o caminho "puxar da
sequência para a pauta do dia" — não duas listas concorrentes.

**d) Gravadas** — ver §6.7.

### 6.7 Contabilidade de gravações

Requisito explícito: saber **o que foi gravado, em que data, e o código do
imóvel no sistema**.

Seção "Gravadas" dentro da Agenda, com tela própria ao tocar "ver tudo":

- **Cabeçalho de números:** total de gravações no período selecionado, em
  destaque tipográfico (Playfair), com o período ao lado ("Setembro/2026") e
  comparação discreta com o período anterior.
- **Seletor de período:** Este mês · Mês passado · Últimos 90 dias · Personalizado.
- **Tabela/lista**, uma linha por gravação:
  - **data da gravação** (coluna de leitura primária, agrupada por mês);
  - endereço e bairro;
  - **código do imóvel no sistema** (`MOR-1234`) como chip monoespaçado; quando
    ainda não cadastrada, chip vazado "não cadastrada" — que é, em si, uma
    pendência visível;
  - listas a que pertence;
  - se já publicada, selo "publicada".
- **Filtro por bairro e por lista** e ordenação por data (mais recente primeiro,
  padrão) ou por código.
- No desktop, exibir como tabela de verdade, com totais no rodapé.

> Os dados já existem no banco: `gravacao_concluida`, `gravacao_data`,
> `imovel_codigo`, `cadastrado_em`, `publicada_em`. Esta tela é **leitura de
> dado existente**, não coleta nova.

### 6.8 Diálogo de agendamento (Google Agenda)

Aberto ao tocar "Agendar visita" ou "Agendar gravação".

- **Data e hora** — hoje só existe data; a hora é nova e necessária para o evento.
- **Duração**, padrão 1h.
- Atalho **"Visita e gravação no mesmo dia"** — já existe hoje e deve continuar.
- Aviso discreto de que o compromisso **entra na agenda da Morabilidade no
  Google**. A integração usa **conta única da empresa**, mesma abordagem já em
  produção no app de atendimento. **Não há login de Google por pessoa** e não
  deve existir tela de conectar conta.
- Depois de agendado, o item mostra **"na agenda ✓"**; desmarcar remove o evento.
- Se o Google falhar, o agendamento continua salvo no app e a interface avisa que
  o evento não foi criado — **nunca bloquear o fluxo por causa da agenda**.

### 6.9 Aba "Negativadas" — e o retorno ao cliente

Esta aba tem **duas naturezas** e o design precisa separá-las com clareza: em
cima uma **fila de trabalho**, embaixo um **histórico de leitura**.

**a) Retornos pendentes** (topo, é o motivo da aba existir)

Quando uma captação é reprovada, alguém precisa **avisar o proprietário de que
aquele imóvel não vai seguir**. Enquanto esse aviso não é dado, a captação fica
aqui.

- Cada captação reprovada ganha um **responsável pelo retorno** e um **prazo**.
- **Filtro "Suas" ligado por padrão**, com alternância para "Todas" — cada
  pessoa abre a aba e vê primeiro o que é dela, sem perder a visão do time.
- Cada linha: endereço, bairro, nome do proprietário, **prazo**, e o **motivo da
  reprovação** — que é justamente o que a pessoa precisa ter na ponta da língua
  ao ligar. O motivo é conteúdo de primeira linha aqui, não detalhe escondido.
- **Atrasados primeiro**, com tratamento visual de alerta (tom `#a85a5a`);
  depois "hoje", depois os futuros.
- Ações diretas na linha: **abrir conversa no WhatsApp** do proprietário (o
  telefone já está na captação) e **"Retorno dado ✓"**, que carimba quem avisou
  e quando, e move a captação para o histórico abaixo.
- Estado vazio caprichado: "Nenhum retorno pendente" — é uma boa notícia e deve
  parecer uma.

**b) Histórico** (abaixo, recolhido)

- Ordenado por data da decisão, mais recente primeiro.
- Cada linha: endereço, bairro, **data da negativa**, quem decidiu, o motivo, e
  **quem deu o retorno e quando**.
- Filtro por período, por responsável e busca.
- Ação **"Reabrir"** existe, mas é explícita e confirmada — nunca acidental.
- Captações com mídia já arquivada pelo cron continuam legíveis: o registro é
  sempre preservado, só a mídia sai.

### 6.9.1 Diálogo de reprovação

Reprovar deixa de ser um clique solto e passa a coletar o que o retorno exige:

- **Motivo da reprovação** — texto, obrigatório. É o que vai ser dito ao cliente.
- **Responsável pelo retorno** — seletor de pessoa, **pré-selecionado no usuário
  que a equipe definir como padrão** (hoje, o Ivo), trocável a qualquer momento.
- **Prazo** — data, com sugestão padrão de poucos dias à frente.
- Botão de confirmar em tom de reprovação (`#f7ecec` / `#e6c5c5` / `#9a3b3b`).

> Campos novos no banco: responsável pelo retorno, prazo, e o carimbo de
> "retorno dado" (quem e quando). Aditivos, como manda o §8.4.

### 6.10 Detalhe da captação

Conteúdo atual funciona e deve ser **preservado**, ganhando o tratamento visual
novo:

- Cabeçalho com endereço, bairro, badge de etapa, **pills das listas**, chip de
  contato do proprietário (WhatsApp) e botão do anúncio.
- Seções: Dados da captação (grade 2 colunas), Fotos e vídeos, Documentos,
  Anotações, Opiniões, Histórico (timeline).
- Bloco de **situação**: visita (data), gravação (data), cadastro no sistema
  (código do imóvel), publicação.
- Ações: editar, compartilhar por link público, **cadastrar no sistema**, excluir.
- Barra fixa: Aprovar / Reprovar quando não decidida; nas aprovadas, a barra
  passa a ser a **próxima ação pendente** ("Agendar visita").

### 6.11 Cadastrar no sistema — não mexer no fluxo

A captação vira imóvel no back-office por um botão que já existe. Recurso
**crítico, mantido integralmente**: mesmo formulário de confirmação de dados,
mesmo retorno com o código (`MOR-1234`), mesmo selo depois. Só redesenhar a
aparência.

## 7. Inventário: o que já existe × o que é novo

**Já existe e não pode sumir:**
decisão aprovar/reprovar com autor e data · pendências textuais · fotos e vídeos
(upload comprimido no cliente) · documentos por signed URL · opiniões entre os
sócios · histórico de movimentação · duplicadas (por telefone e por URL de
anúncio) · motivo e data de revisão da gaveta · **cadastrar no sistema** ·
**link público de compartilhamento** · aba Publicadas · Lixeira (soft-delete) ·
pauta de gravação · busca acento-insensível · cron diário de arquivamento de
mídia · ordenação manual via `ordem` · PWA instalável.

**Novo nesta reformulação:**
abas no rodapé no lugar de colunas · listas coloridas criadas pelo usuário ·
painel de filtros completo · sequência manual de gravação por lista · hora nos
agendamentos · integração com Google Agenda · tela de contabilidade de gravações
· aba de negativadas com **fila de retorno ao cliente, responsável e prazo** ·
motivo da reprovação como campo obrigatório · logo no cabeçalho do app.

## 8. Migração dos dados existentes — cuidado máximo

O quadro tem captações reais em produção. **Nada pode ser perdido ou
reclassificado errado.** Regras:

### 8.1 O nome da coluna de hoje vira o nome da lista

Cada captação **carrega para a v2 uma lista com o nome exato da coluna em que
está hoje**. Ninguém precisa reclassificar nada à mão, e nenhuma informação de
organização se perde na virada.

### 8.2 Mapa de conversão

| Coluna hoje | Etapa na v2 | Lista aplicada | Pendência marcada |
|---|---|---|---|
| `aguardando_informacoes` | A decidir | *Aguardando informações* | — |
| `novas` | A decidir | *Novas* | — |
| `em_decisao` | A decidir | *Em decisão* | — |
| `pendente_negativa` | **Negativada** | *Pendente de negativa* | Dar retorno negativo |
| `negativada` | **Negativada** (concluída) | *Negativada* | — |
| `pendente_agendar_visita` | **Aprovada** | *Pendente agendar visita* | Agendar visita |
| `pendente_agendar_gravacao` | **Aprovada** | *Pendente agendar gravação* | Agendar gravação |
| `gaveta` | derivada da decisão registrada | **Gaveta** | — |
| `selecao_especial` | derivada da decisão registrada | **Seleção Especial** | — |
| `publicada` | Publicada | *Publicada* | — |

**Gaveta e Seleção Especial** são as duas listas que **nascem permanentes** e
aparecem na barra de listas. As demais nascem como **listas de migração**: ficam
gravadas para não perder contexto, mas recolhidas atrás de "ver todas as listas",
e podem ser apagadas pela equipe depois da virada sem afetar captação nenhuma.
Criar também **"Prioridade"** vazia, pronta para uso.

Para gaveta e seleção especial a etapa vem da decisão já registrada no cartão:
aprovada → Aprovada; reprovada → Negativada; **sem decisão → A decidir**, mas
aparecendo na seção recolhida "Engavetadas — reavaliar" (§6.1), nunca no meio da
fila do dia.

### 8.3 As negativadas

- Uma captação **negativada nunca reaparece** na aba Decidir nem na Aprovadas.
- Preservar quem decidiu, quando, e o motivo.
- `pendente_negativa` e `negativada` são a **mesma etapa** com estados
  diferentes: a primeira ainda deve retorno ao proprietário, a segunda não.
  Distinguir por selo, não por lista separada.
- **Backfill do retorno:** toda captação hoje em `pendente_negativa` entra na v2
  como **retorno pendente**, com o responsável padrão já preenchido e prazo
  vazio (a interface mostra "sem prazo", não trata como atrasado). As que já
  estão em `negativada` entram como **retorno concluído**, sem carimbo de quem
  avisou — o dado não existe e **não deve ser inventado**; exibir "—".
- Captações com mídia já arquivada pelo cron continuam legíveis: o registro é
  sempre preservado, só a mídia sai — a tela precisa lidar com "fotos
  arquivadas" sem parecer erro.

### 8.4 Regra técnica inegociável

A migração é **aditiva**: novas tabelas e colunas, **sem remover valor do enum
`captacoes.status` e sem renomear coluna existente**. O campo `status` continua
populado durante a transição. Isso é o que permite o rollback para a v1 sem
rollback de banco — e o cron diário de arquivamento, que lê `status`, continua
funcionando.

### 8.5 Conferência antes de virar a chave

Antes da migração, contar as captações por status e por decisão, e conferir
depois que a soma bate:

```sql
select status, decisao, count(*)
  from captacoes.captacao
 where excluido_em is null
 group by status, decisao
 order by status, decisao;
```

Atenção especial ao número de `gaveta` e `selecao_especial` **sem decisão**: é
esse grupo que muda de lugar na virada.

## 9. Artboards a produzir

Mobile 390×844 como principal, mais os desktops indicados. **Todos os artboards
mobile mostram a barra de abas do rodapé** (§5.2), com os contadores coerentes
entre si.

1. **Decidir** — mobile, três agrupamentos, um cartão em cada estado, seção
   "Engavetadas" recolhida ao final.
2. **Aprovadas** — mobile, barra de listas, 5–6 linhas cobrindo casos diferentes
   (com pendência, com várias listas, já gravada, já no sistema, sem foto).
3. **Aprovadas — modo Sequência** — mobile, alças de arrastar, números de
   posição, resumo "12 na fila · 4 já gravadas".
4. **Aprovadas — filtrada** — mobile, pill ativa e chips de filtro no topo.
5. **Filtros** — mobile, painel completo com rodapé "Ver N captações".
6. **Nova lista** — mobile, seletor de cor e prévia.
7. **Agenda** — mobile, pendências + próximos compromissos + pauta + entrada de
   Gravadas.
8. **Gravadas** — mobile, cabeçalho de números, seletor de período, lista com
   data e código do imóvel.
9. **Agendar visita** — mobile, data, hora, duração, atalho de mesmo dia, aviso
   do Google Agenda.
10. **Detalhe da captação** — mobile, rolagem completa com barra fixa.
11. **Negativadas — retornos pendentes** — mobile, filtro "Suas" ativo, um item
    atrasado, um de hoje, um futuro, cada um com motivo visível e as ações de
    WhatsApp e "Retorno dado".
12. **Negativadas — histórico** — mobile, seção de baixo expandida, com quem
    deu o retorno e quando.
13. **Reprovar captação** — mobile, diálogo com motivo, responsável pelo retorno
    e prazo.
14. **Aprovadas — desktop** — filtros persistentes à esquerda, lista ao centro,
    prévia da captação selecionada à direita.
15. **Gravadas — desktop** — tabela com totais no rodapé.
16. **Estados vazios** — um artboard reunindo: nada a decidir, lista sem
    resultado após filtro, agenda sem compromissos, nenhuma gravação no período,
    **nenhum retorno pendente**.

## 10. Regras de conteúdo

- Tudo em **português do Brasil**.
- **Moeda:** `R$ 2.450.000` (pt-BR, sem centavos). Ausente → "Não informado".
- **Área:** `120 m²`. **Datas:** `12/08` no ano corrente, `12/08/2025` fora dele;
  tempo relativo ("há 3 dias") para o que é recente.
- **Código do imóvel** em fonte monoespaçada, sempre com o prefixo (`MOR-1234`).
- Ocultar suítes e vagas quando zero; sempre mostrar quartos, banheiros e área.
- Dados de proprietário são **LGPD-sensíveis**: nome e telefone não aparecem em
  listas, só no detalhe.

## 11. Limites — o que não fazer

- **Não** propor drag-and-drop entre colunas nem qualquer quadro Kanban.
  Arrastar só existe para **reordenar verticalmente dentro de uma lista**.
- **Não** criar uma quinta aba. Se faltar lugar para algo, ele é filtro ou lista.
- **Não** duplicar a fila de retorno negativo na Agenda: ela vive só na aba
  Negativadas.
- **Não** remover: cadastrar no sistema, link público de compartilhamento,
  opiniões, histórico, duplicadas, lixeira, publicadas, pauta de gravação.
- **Não** inventar tela de login com Google por usuário — a agenda usa conta
  única da empresa.
- **Não** trocar a paleta nem as fontes, e **não** deixar a logo de fora.
- **Não** desenhar para desktop primeiro. O celular é o uso real.
- **Não** esconder ação primária atrás de menu: aprovar, reprovar e agendar
  precisam estar a um toque.
