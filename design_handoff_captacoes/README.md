# Handoff: Redesign do fluxo de Captações (Mora)

## Overview
Redesign mobile-first do app de **Captações** (captacoes.morabilidade.com): um quadro estilo kanban de captações de imóveis e a tela de detalhe onde dois usuários analisam e decidem (aprovar/reprovar) cada captação. O objetivo é deixar o visual mais bonito e alinhado a padrões de UI/UX, mantendo o fluxo atual.

## About the Design Files
O arquivo deste pacote (`Captacoes Mora.dc.html`) é uma **referência de design feita em HTML**, um protótipo que mostra a aparência e o comportamento pretendidos, **não** código de produção para copiar e colar. A tarefa é **recriar este design no ambiente existente do projeto** (o app real, provavelmente React) usando os componentes, libs e padrões já estabelecidos no codebase. As cores, tipografia, espaçamentos e medidas abaixo são a fonte de verdade.

> Observação técnica: o arquivo `.dc.html` roda sobre um runtime próprio de protótipo (`support.js`), ignore esse runtime. Interessam apenas o markup, os estilos inline e a lógica de estado descritos aqui.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos e interações são finais. Recriar pixel-perfect com a stack do projeto.

---

## Design Tokens

### Cores: Olive (primária)
| Tom | Hex |
|---|---|
| 50 | `#f5f5f3` |
| 100 | `#e8e8e4` |
| 200 | `#d0d1cb` |
| 300 | `#b0b2a8` |
| 400 | `#888b7e` |
| 500 | `#6e7063` |
| 600 | `#585a4f` ← DEFAULT |
| 700 | `#4a4d43` |
| 800 | `#3d3f36` |
| 900 | `#2e302a` |
| 950 | `#1a1c16` |

### Cores: Gold (destaque)
| Tom | Hex |
|---|---|
| 50 | `#faf9ef` |
| 100 | `#f3f0d0` |
| 200 | `#e9e3a8` |
| 300 | `#e5da8a` |
| 400 | `#d8cb6a` ← DEFAULT |
| 500 | `#c5b54a` |
| 600 | `#b5a94a` |
| 700 | `#9a8d3a` |

### Cores de status (colunas), usadas no ponto + badge
Cada status tem: `dot` (cor do ponto), `bg` (fundo do badge), `fg` (texto do badge).
| Status (key) | Rótulo completo | Rótulo curto (badge) | dot | bg | fg |
|---|---|---|---|---|---|
| `aguardando` | Aguardando informações | Aguardando info | `#b0b2a8` | `#ebece7` | `#5f6157` |
| `novas` | Novas | Novas | `#c5b54a` | `#f4f1d4` | `#857727` |
| `decisao` | Decisão: aprovar / reprovar | Em decisão | `#d49a48` | `#f7ecd9` | `#8f6320` |
| `agendar_visita` | Pendente agendar visita | Agendar visita | `#5a9a6e` | `#e5efe8` | `#2f6b46` |
| `agendar_gravacao` | Pendente agendar gravação | Agendar gravação | `#5887a0` | `#e3edf1` | `#2f5b6f` |
| `pendente_negativa` | Pendente de negativa | Pend. negativa | `#c98a8a` | `#f4e8e8` | `#8a4444` |
| `negativada` | Negativada | Negativada | `#a85a5a` | `#f0e2e2` | `#7a3434` |

Ordem das colunas: `aguardando → novas → decisao → agendar_visita → agendar_gravacao → pendente_negativa → negativada`.

### Botões de decisão
- **Aprovar (sólido, barra inferior do detalhe):** fundo `linear-gradient(150deg,#3a8a5c,#2f7350)`, texto `#fff`, sombra `0 8px 18px -8px rgba(47,107,70,0.6)`.
- **Aprovar (suave, no card):** fundo `#ecf5ef`, borda `#c3e0cd`, texto `#2f6b46`.
- **Reprovar (suave, no card):** fundo `#f7ecec`, borda `#e6c5c5`, texto `#9a3b3b`.
- **Reprovar (outline, barra inferior):** fundo `#fff`, borda `#e6c5c5`, texto `#9a3b3b`.

### Tipografia
- **Serif (títulos/destaques):** `'Playfair Display', serif`, pesos 500/600/700.
  - Título do header ("Seu quadro"): 30px / 600 / line-height 1.
  - Endereço no detalhe: 25px / 600 / line-height 1.18 / letter-spacing -0.01em.
  - Títulos de seção ("Dados da captação", etc.): 18px / 600.
- **Sans (corpo/UI):** `'Inter', system-ui, sans-serif`, pesos 400/500/600/700.
  - Endereço no card: 17px / 600 / line-height 1.28.
  - Specs, captador, labels: 13–14px.
  - Labels de campo (uppercase): 11px / 600 / letter-spacing 0.04em / `#9a9c90`.

### Outros tokens
- **Background da app:** `#f3f4f0`. Cards: `#ffffff`, borda `#e8e9e3`.
- **Gradiente do header (hero):** `linear-gradient(150deg,#2c2e28 0%,#585a4f 58%,#454840 100%)`, texto `#f3f4f0`.
- **Raios:** cards 18px; badges 8–9px; pills 11px; chips/inputs 12–13px; botões grandes 14px; FAB 20px; avatar/dot circulares.
- **Sombras:** card `0 1px 2px rgba(46,48,42,0.04), 0 10px 24px -16px rgba(46,48,42,0.22)`; FAB `0 12px 28px -8px rgba(157,141,58,0.6)`; barra de decisão (topo) `0 -6px 20px -12px rgba(46,48,42,0.2)`. Sombras baseadas no olive-900 `rgba(46,48,42, …)`.
- **Espaçamento:** padding de card 17px; gap entre cards 14px; gap interno de seções 14px; padding do conteúdo 16–18px.

---

## Screens / Views

### 1. Quadro (board)
**Propósito:** ver todas as captações, filtrar por status e agir rápido nas que estão "Em decisão".

**Layout (vertical, scroll único):**
1. **Status bar** (mock de celular), fundo olive `#2a2c26`, texto `#eef0ea`. Em produção, ignorar (é o chrome do device).
2. **Header olive** (gradiente hero, padding 18/22/22): 
   - eyebrow "CAPTAÇÕES" (11px / 600 / letter-spacing 0.2em / gold `#d8cb6a`);
   - título "Seu quadro" (Playfair 30/600);
   - subtítulo com ícone de grade + "{N} no quadro" (`#cfd0c9`);
   - à direita: avatar circular 40px (gold `#d8cb6a`, texto `#3a3408`, iniciais do usuário) + ícone de logout;
   - **busca**: input pill translúcido (`rgba(255,255,255,0.14)`, borda `rgba(255,255,255,0.18)`) com ícone de lupa + placeholder "Buscar por endereço…", e um botão quadrado de filtros (ícone sliders) ao lado.
3. **Sub-header sticky** (`position:sticky; top:0`, fundo `rgba(243,244,240,0.92)` + blur, borda inferior `#e2e3dd`):
   - linha com botão "Ordem manual" (ícone de ordenação) + texto auxiliar "Toque para analisar";
   - **pills de status** roláveis horizontalmente: "Todas" + uma por coluna. Cada pill: ponto colorido (cor do status) + rótulo + contagem. Ativa = fundo olive `#585a4f`, texto `#f3f4f0`, ponto branco; inativa = fundo branco, borda `#e2e3dd`, texto `#4a4d43`.
4. **Lista de cards** (padding 16/18, gap 14).
5. **FAB** (`position:absolute; bottom:26; right:22`): 60×60, raio 20, fundo `linear-gradient(150deg,#e0d27a,#c5b54a)`, ícone "+" `#3a3408`. Ação: criar nova captação.

**Card de captação:**
- Linha topo: **badge de status** (ponto + rótulo curto, cores da tabela) à esquerda; botão chevron (expandir) 30×30 fundo `#f3f4f0` à direita.
- **Endereço** (Inter 17/600, `#2e302a`).
- **Bairro**: ícone de pin (gold `#9a8d3a`) + nome do bairro (13.5px / 500 / `#6e7063`). *(novo: bairro aparece antes de expandir)*
- **Specs** (chips `#f5f6f1`, borda `#ebece6`, raio 9, ícone `#888b7e`): quartos (cama), suítes (só se > 0, ícone de porta, sufixo " suíte"), banheiros (banheira), vagas (só se > 0, carro), área (ícone scan, sufixo "m²").
- **Valores** (quando informados, separados por borda-topo): "Venda" (label uppercase) + valor (16.5px / 700 / `#3d3f36`) e "Condomínio" + valor (14px / 600 / `#6e7063`). Formato `R$ 2.450.000` (pt-BR, sem centavos).
- **Expandido** (ao tocar o chevron): proprietário + link "Ver anúncio publicado" (gold), com borda tracejada acima.
- **Botões Aprovar / Reprovar**: aparecem **somente** quando `status === 'decisao'` (versões suaves).
- **Rodapé**: avatar de iniciais 26px (`#e8e8e4` / `#585a4f`) + nome do captador (13px / `#6e7063`), separado por borda-topo.
- **Tocar no corpo do card** → abre o Detalhe. Botões e chevron usam `stopPropagation`.

### 2. Detalhe da captação
**Propósito:** analisar a captação a fundo e decidir.

**Layout (header fixo + scroll + barra fixa):**
1. **Top bar** (fundo branco, borda inferior `#e6e7e1`): botão "← Voltar ao quadro" (`#4a4d43`) à esquerda; "🗑 Excluir" (`#a85a5a`) à direita.
2. **Hero** (fundo branco): badge de status (rótulo **completo**); endereço (Playfair 25/600); bairro com pin; linha com **chip de contato/WhatsApp** (fundo `#eef4f0`, borda `#d8e7df`, ícone de balão verde `#2f6b46`, nome + telefone) e botão **"Anúncio"** (fundo `#faf7e8`, borda `#ece4b8`, texto gold `#9a8d3a`, ícone de link).
3. **Conteúdo** (padding 16/18, gap 14), seções em cards brancos:
   - **Dados da captação**, título Playfair + botão "Editar" (chip `#f3f4f0`). Grade 2-col com divisórias de 1px (`#eef0ea`): Endereço (full), Quartos, Suítes, Banheiros, Vagas, Metragem, Portaria, Proprietário (full). Cada célula: label uppercase + valor (14.5px / 600 / `#3d3f36`). Abaixo, bloco de **valores**: "Valor de venda" (card `#faf9ef`/borda `#ece9cf`, valor 18/700) e "Condomínio" (card `#f5f6f1`).
   - **Fotos e vídeos**, galeria horizontal de miniaturas (no protótipo são placeholders listrados 128×96; no app, usar as fotos reais) + tile tracejado "Adicionar". Abaixo: input "Link de vídeo (YouTube)" + botão "Adicionar" (ícone de vídeo).
   - **Documentos**, lista de docs (ícone de arquivo + nome + meta "240 KB · há 2 dias") + botão tracejado "Anexar documento".
   - **Anotações**, caixa de texto (`#fafbf8`, borda `#eef0ea`) + botão "Salvar" (gold gradient `linear-gradient(150deg,#e0d27a,#c5b54a)`, texto `#3a3408`).
   - **Histórico**, timeline vertical: ponto colorido + linha conectora `#eceee8`; cada item "De → Para" (14/600) + tempo ("há 12 horas").
4. **Barra de decisão fixa** (rodapé, fundo branco, borda-topo, sombra para cima): **Reprovar** (outline vermelho) + **Aprovar captação** (verde sólido, flex maior). Aparece quando `status === 'decisao'`.

---

## Interactions & Behavior
- **Abrir detalhe:** tocar no corpo de um card → tela de detalhe da captação selecionada.
- **Voltar:** botão "Voltar ao quadro" → volta ao board.
- **Filtrar:** tocar numa pill de status filtra a lista; "Todas" remove o filtro. Contagens por status são derivadas dos dados.
- **Expandir card:** chevron alterna info extra (proprietário + link de anúncio).
- **Decidir:**
  - **Aprovar** → move a captação para `agendar_visita` ("Pendente agendar visita").
  - **Reprovar** → move para `pendente_negativa` ("Pendente de negativa").
  - Dispara um **toast** no rodapé (verde `#2f6b46` para aprovar, vermelho `#9a3b3b` para reprovar) que some após ~2.8s. No detalhe, decidir também volta ao board.
- **Transições:** cards entram com fade/translateY (`cardIn`, .3s ease); toast com `toastIn` (.25s). Mantenha sutil.

## State Management
- `screen`: `'board' | 'detail'`.
- `selectedId`: id da captação aberta no detalhe.
- `filter`: `'all'` ou uma key de status.
- `expanded`: mapa `{ [id]: boolean }` para expandir cards.
- `toast`: `{ text, tone } | null`.
- `items`: lista de captações. Cada item:
  `{ id, address, bairro, captador, initials, phone, beds, suites, baths, parking, area, venda, cond, iptu, portaria, proprietario, anuncio (bool), status }`.
- Contagens das pills = derivadas de `items` por `status`.
- **Mapa de decisão:** aprovar → `agendar_visita`; reprovar → `pendente_negativa`.
- Em produção, `items` virá da API; persistir a mudança de status no backend ao decidir.

## Formatação
- **Moeda:** `R$ ` + `valor.toLocaleString('pt-BR')` (sem centavos). Valores ausentes → "Não informado".
- **Specs:** ocultar suíte/vagas quando 0; sempre mostrar quartos, banheiros e área.

## Assets
- **Ícones:** estilo *line* (Lucide-equivalente), stroke 1.7–2.2, `currentColor`. Usados: grade, logout, lupa, sliders, ordenação, pin, cama, porta, banheira, carro, scan, chevron, "+", link, balão de chat, lápis (editar), imagem, vídeo, arquivo, upload, lixeira, check, x. Use a biblioteca de ícones já adotada no projeto.
- **Fonts:** Inter + Playfair Display (Google Fonts). Use o que o projeto já carrega; senão, importe ambas.
- **Fotos/vídeos/docs:** placeholders no protótipo, ligar aos dados reais da captação.

## Files
- `Captacoes Mora.dc.html`, protótipo de referência (board + detalhe, interativo). Abrir no navegador para ver comportamento e medidas.
