# Handoff: Tela de login — Central de Atendimento (Morabilidade)

## Visão geral
Nova tela de login do chat/Central de Atendimento da Morabilidade, em duas
resoluções: **desktop (split-screen 1440×900)** e **mobile (390×844)**.
Substitui a tela escura atual (formulário centralizado em fundo preto) e alinha
o produto ao padrão de login já usado no Painel Administrativo e na Gestão de
Captações: painel de foto à esquerda com marca + headline, formulário branco à
direita.

## Sobre os arquivos de design
Os arquivos deste pacote são **referências de design feitas em HTML** —
protótipos que mostram aparência e comportamento pretendidos, **não** código de
produção para copiar e colar. A tarefa é **recriar estas telas no ambiente já
existente do projeto** (React, Vue, Blade, etc.), usando os componentes,
tokens e padrões que o codebase já tem. Se ainda não existir um padrão, escolha
o framework/estrutura mais adequado ao projeto e implemente lá.

Importante: reaproveitar os componentes de login já existentes nas outras
aplicações da Morabilidade é o caminho preferido — as telas de referência foram
desenhadas exatamente sobre aquele padrão.

## Fidelidade
**Alta fidelidade (hifi).** Cores, tipografia, espaçamentos, raios e estados
são finais. Reproduzir com precisão, respeitando a biblioteca de componentes do
codebase.

---

## Telas

### 1. Login — Desktop (≥ 1024px)

**Objetivo:** colaborador autentica com e-mail e senha.

**Layout:** grid de 2 colunas em tela cheia, `52% / 48%`, altura 100vh.
No mock o frame é 1440×900 com `border-radius: 18px` e sombra — isso é apenas
apresentação do mock; **em produção a tela é full-bleed, sem raio e sem sombra**.

#### Coluna esquerda — painel de marca (52%)
- `position: relative; overflow: hidden;` fundo de fallback `#3C4A4F`.
- **Foto** cobrindo todo o painel: `object-fit: cover`, `object-position: center`.
- **Scrim** sobre a foto (`position:absolute; inset:0; pointer-events:none`):
  `linear-gradient(180deg, rgba(20,26,24,0.55) 0%, rgba(20,26,24,0.18) 38%, rgba(20,26,24,0.72) 100%)`
- **Conteúdo** por cima: `flex column; justify-content: space-between; padding: 56px 64px;`
  1. **Logo** `assets/logo-morabilidade.png` — `width: 190px; height: auto` (topo/esquerda).
  2. **Bloco de headline** (`flex column; gap: 20px; max-width: 520px`):
     - Eyebrow: `CENTRAL DE ATENDIMENTO` — Archivo 700, 14px, `letter-spacing: .18em`, cor `#CBB26A`, caixa alta.
     - H1: “Toda conversa<br>em um só lugar.” — Archivo 800, 52px, `line-height: 1.06`, `letter-spacing: -0.02em`, `#FFFFFF`.
     - Parágrafo: “Atenda proprietários, inquilinos e corretores pelos canais da Morabilidade, com histórico completo de cada contato.” — Archivo 400, 17px/1.6, `rgba(255,255,255,.78)`, `max-width: 400px`.
  3. **Rodapé** (`flex; justify-content: space-between`; Archivo 400, 13px, `rgba(255,255,255,.6)`):
     - esquerda: `Zona Sul · Rio de Janeiro, RJ`
     - centro: crédito da foto, 11px, `rgba(255,255,255,.42)` — remover quando a foto for própria da Morabilidade
     - direita: `© 2026 Morabilidade`

#### Coluna direita — formulário (48%)
- `display:flex; align-items:center; justify-content:center; padding: 64px;` fundo `#FFFFFF`.
- `<form>` com `width: 352px; flex column; gap: 26px`.

| Elemento | Especificação |
|---|---|
| H2 “Entrar no sistema” | Archivo 700, 28px/1.2, `letter-spacing: -0.015em`, `#1F2320` |
| Subtítulo “Acesso exclusivo para colaboradores” | Archivo 400, 14px/1.5, `#77786F`, gap 6px do H2 |
| Grupo de campos | `flex column; gap: 18px` |
| Label (`E-mail`, `Senha`) | Archivo 600, 13px, `#3F4139`, gap 8px do input |
| Input | altura 46px, `padding: 0 14px`, borda `1px solid #E3E1DB`, raio 10px, fundo `#FFF`, texto Archivo 400 15px `#1F2320` |
| Placeholder | `seu@email.com` / `••••••••` — cor `#A3A3A0` |
| Input :focus | `border-color: #CBB26A; box-shadow: 0 0 0 3px rgba(203,178,106,.22)`; `outline: none`; transição `border-color .15s, box-shadow .15s` |
| Botão olho (senha) | 34×34px, absoluto `top:6px; right:6px`, raio 8px, ícone 19px `stroke: currentColor`, cor `#8B8C82`; hover `background:#F2F1EC; color:#55584A`; `aria-label="Mostrar senha"` |
| Botão “Entrar” | largura total, altura 48px, raio 10px, fundo `#55584A`, texto Archivo 700 15px `#FFF`; hover `#42453A`; transição `background .15s` |
| Link “Esqueci minha senha” | centralizado, Archivo 500 14px, `#6C6D64`, sem sublinhado; hover `#55584A` + sublinhado |
| Espaçamento | grupo de campos → botão: 26px; botão → link: 16px |

### 2. Login — Mobile (< 768px)

**Objetivo:** o mesmo, em coluna única (390×844 de referência).

- **Topo:** painel de foto `height: 358px`, mesmo scrim (paradas 0.55 / 0.25 em 45% / 0.8),
  `padding: 44px 26px`.
  - Logo `width: 140px`.
  - Eyebrow 11px (`letter-spacing: .18em`, `#CBB26A`); H1 Archivo 800 30px/1.1 `#FFF`.
  - O parágrafo descritivo é **omitido** no mobile.
- **Folha branca:** começa em `top: 330px` (sobrepõe a foto em 28px), `border-radius: 24px 24px 0 0`,
  fundo `#FFF`, `padding: 32px 26px 28px`, `flex column; gap: 24px`.
  - H2 24px/1.2; subtítulo 13.5px/1.5.
  - Campos: altura **50px**, raio **12px** (alvo de toque ≥ 44px); gap entre campos 16px.
  - Botão olho 36×36px, `top/right: 7px`.
  - Botão “Entrar”: altura 52px, raio 12px.
  - Link “Esqueci minha senha” centralizado, 14px.
  - Rodapé: `© 2026 Morabilidade · Zona Sul, Rio de Janeiro` — Archivo 400 12px `#A3A49B`, colado na base (`margin-top: auto`).
- **Responsivo:** breakpoint único. Abaixo de 768px vira coluna única; acima, split 52/48.
  Em telas 768–1023px pode-se manter o split reduzindo o H1 para ~40px, ou já usar o layout mobile
  em largura total (decisão do time de front).

---

## Interações e comportamento
- **Mostrar/ocultar senha:** botão alterna `type` entre `password` e `text`; o ícone recebe uma
  barra diagonal quando visível. Estado local booleano, sem persistência.
- **Submit:** valida e-mail (formato) e senha obrigatória. Enquanto a requisição corre, o botão
  entra em estado de carregando (texto “Entrando…”, `opacity: .7`, `pointer-events: none`).
- **Erro de credencial:** mensagem sob o grupo de campos, Archivo 500 13px, cor de erro do
  design system (sugestão `#A4453A`); bordas dos inputs em `#D8B4AE`. Não limpar o e-mail digitado.
- **Foco/teclado:** ordem de tabulação e-mail → senha → olho → Entrar → Esqueci minha senha;
  Enter em qualquer campo submete. Anel de foco dourado descrito acima também no botão e no link.
- **“Esqueci minha senha”:** navega para o fluxo de recuperação já existente.
- **Transições:** apenas `background` e `border-color/box-shadow` em 150ms. Sem animação de entrada.
- **Acessibilidade:** `<label for>` em todos os campos, `autocomplete="email"` e
  `autocomplete="current-password"`, `aria-label` no botão do olho, contraste do texto sobre a
  foto garantido pelo scrim.

## Estado
- `email: string`
- `password: string`
- `showPassword: boolean`
- `loading: boolean`
- `error: string | null`

Autenticação usa o mesmo endpoint/serviço já utilizado pelo Painel Administrativo — nenhum
contrato novo de API é necessário.

## Design tokens

**Cores**
| Uso | Valor |
|---|---|
| Fundo do formulário | `#FFFFFF` |
| Texto principal | `#1F2320` |
| Texto secundário | `#77786F` |
| Label | `#3F4139` |
| Borda de input | `#E3E1DB` |
| Placeholder | `#A3A3A0` |
| Ação primária (oliva) | `#55584A` — hover `#42453A` |
| Acento dourado (eyebrow, foco) | `#CBB26A` — anel `rgba(203,178,106,.22)` |
| Texto de link | `#6C6D64` |
| Rodapé mobile | `#A3A49B` |
| Fallback do painel de foto | `#3C4A4F` |
| Scrim | `rgba(20,26,24,.18–.80)` |
| Fundo do mock (apresentação apenas) | `#ECEAE5` |

**Tipografia** — Archivo (Google Fonts), pesos 400/500/600/700/800.
Escala: 52 / 30 / 28 / 24 / 17 / 15 / 14 / 13.5 / 13 / 12 / 11 px.
Se o codebase já usa outra família de títulos, mantenha a hierarquia e troque a família.

**Espaçamento:** 5 · 6 · 8 · 10 · 16 · 18 · 20 · 22 · 24 · 26 · 32 · 56 · 64 px.

**Raios:** 8 (botão do olho) · 10 (input/botão desktop) · 12 (input/botão mobile) · 24 (folha mobile) · 999 (badge do mock).

**Sombras:** nenhuma na UI. A sombra `0 30px 80px rgba(30,30,26,.18)` existe só nos frames do mock.

## Assets
- `assets/logo-morabilidade.png` — logo oficial enviada pelo cliente, recortada no bounding box
  (1855×890, fundo transparente, wordmark branco + skyline dourado). Usar sobre fundo escuro.
- **Foto do painel esquerdo:** no protótipo é uma foto do Rio de Janeiro do Wikimedia Commons
  (CC BY-SA), usada como placeholder. **Substituir pela foto oficial da Morabilidade** —
  mesma imagem/família usada no Painel Administrativo e na Gestão de Captações. Recomendado:
  1600×2000 px para desktop e 900×900 px para mobile, WebP, `object-fit: cover`.
  Se a foto do Wikimedia for mantida, o crédito no rodapé é obrigatório.

## Arquivos
- `Login Central de Atendimento.dc.html` — protótipo (desktop + mobile, com toggle de senha funcionando).
- `image-slot.js` — utilitário só do protótipo (placeholder de imagem arrastável). **Não portar.**
- `support.js` — runtime do protótipo. **Não portar.**
- `assets/logo-morabilidade.png` — asset real, portar.
- `referencias/` — capturas das telas atuais: login do chat (antes) e os dois logins que
  serviram de base (Painel Administrativo e Gestão de Captações).
