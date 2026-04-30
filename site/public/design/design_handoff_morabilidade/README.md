# Handoff: Morabilidade — Redesign das Abas Início, Imóveis, Sobre e Contato

## Overview

Este pacote contém o redesign completo de quatro páginas do site da Morabilidade:
- **Início** — página principal com hero, destaques, diferenciais, depoimentos, história e CTA
- **Imóveis** — portfólio com filtros em barra horizontal e grid de cards editoriais
- **Sobre** — história da empresa, diferenciais, como funciona, depoimentos completos
- **Contato** — canais de atendimento (WhatsApp e Instagram)

## Sobre os Arquivos de Design

O arquivo `Morabilidade Redesign v2.html` é um **protótipo de referência em HTML/React** — não é código de produção. A tarefa é **recriar estas telas no projeto real existente** (site + sistema + API já integrados), respeitando os padrões, frameworks e componentes já estabelecidos no codebase.

O protótipo usa React com Babel inline apenas para fins de visualização. No projeto real, adapte para a estrutura existente.

## Fidelidade

**Alta fidelidade (hifi).** As cores, tipografia, espaçamentos e interações são finais e devem ser reproduzidos com precisão. O cliente aprovou este visual.

---

## Design Tokens

### Cores (identidade visual aprovada — não alterar)

| Papel | Nome | Hex |
|-------|------|-----|
| Primária (60%) | Olive | `#585a4f` |
| Destaque (30%) | Dourado | `#d8cb6a` |
| Fundo/Conteúdo (10%) | Off-white | `#fcfcfc` |
| Olive escuro (nav/dark sections) | Olive Dark | `#3e4037` |
| Olive claro (texto secundário) | Olive Light | `#6e7063` |
| Dourado claro (itálicos hero) | Gold Light | `#e8dea0` |
| Fundo suave | Background | `#f7f6f2` |
| Bordas | Border | `#e4e1d6` |
| Texto principal | Text | `#2d2f28` |
| Texto secundário | Text Muted | `#7a7c72` |

### Tipografia

| Uso | Fonte | Peso | Tamanho típico |
|-----|-------|------|----------------|
| Títulos / headlines | Playfair Display | 400, 500, 600 | clamp(24px–52px) |
| Corpo / UI | Inter | 300, 400, 500, 600, 700 | 12px–16px |

Google Fonts:
```
https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap
```

### Espaçamento

Usar `clamp()` para responsividade fluida:
- Padding horizontal de seções: `clamp(20px, 5vw, 48px)`
- Padding vertical de seções: `clamp(48px, 6vw, 80px)`
- Max-width do conteúdo: `1080px` (centralizado com `margin: 0 auto`)
- Gap entre cards: `clamp(16px, 3vw, 28px)`

### Border Radius

- Cards grandes: `14px`
- Cards pequenos / botões: `8px–12px`
- Pills / tags: `100px`
- Badges: `100px`

### Sombras

- Card repouso: `0 2px 10px rgba(88,90,79,0.08)`
- Card hover: `0 16px 40px rgba(88,90,79,0.20)`

---

## Assets

| Arquivo | Uso |
|---------|-----|
| `Logo_fundoTransparente-7574853e.png` | Logo no nav (altura 46px) e na página Sobre |

O logo deve aparecer **sem alterações** — não trocar cor, não recriar em SVG.

---

## Páginas / Telas

---

### 1. Navegação (Nav) — compartilhada em todas as páginas

**Layout:** `position: sticky; top: 0; z-index: 500`  
Altura: `60px` | Background: `#585a4f`  
Padding horizontal: `clamp(20px, 5vw, 48px)`  
Flex: `justify-content: space-between; align-items: center`

**Esquerda:** Logo PNG — `height: 46px`

**Direita (desktop):** Links de navegação + divisor + ícone Instagram + botão CTA
- Links: Inter 14px, cor `rgba(252,252,252,0.6)`, hover `#fcfcfc`
- Link ativo: cor `#fcfcfc` + `border-bottom: 1.5px solid #d8cb6a`
- Botão "Ver imóveis": background `#d8cb6a`, cor `#3e4037`, Inter 13px bold, padding `7px 16px`, border-radius `6px`

**Mobile:** Hamburger icon, abre menu fullscreen sobre `#3e4037` com links em Playfair Display 22px e botão CTA dourado

---

### 2. Página: Início

#### 2.1 Hero
- Posição: relative, `min-height: clamp(480px, 70vh, 700px)`
- Imagem de fundo: foto do Rio de Janeiro (full cover)
- Overlay: `linear-gradient(to bottom, rgba(45,47,40,0.62) 0%, rgba(30,32,25,0.78) 100%)`
- Conteúdo centralizado, `max-width: 780px`, `text-align: center`

**Tag badge:** background `rgba(216,203,106,0.15)`, border `1px solid rgba(216,203,106,0.35)`, border-radius `100px`, padding `5px 14px`
- Ponto dourado `6px` + texto: Inter 11px, `#d8cb6a`, uppercase, `letter-spacing: 0.16em`
- Copy: **"Imobiliária de confiança"**

**Headline:** Playfair Display, `clamp(32px, 5.5vw, 62px)`, branco, `line-height: 1.1`
- Copy: **"Encontre o imóvel"** (branco) + **"ideal para você"** (itálico, `#e8dea0`)

**Subtítulo:** Inter 17px, `rgba(252,252,252,0.65)`, `line-height: 1.7`
- Copy: **"Casas, apartamentos e muito mais para venda e locação nas melhores regiões."**

**Tabs Tudo/Comprar/Alugar:**
- Container: `background: rgba(255,255,255,0.1)`, border-radius `100px`, padding `4px`
- Tab ativo: background `#d8cb6a`, cor `#3e4037`, bold
- Tab inativo: transparent, cor `rgba(252,252,252,0.7)`

**Barra de busca:** background `#fcfcfc`, border-radius `12px`, padding `10px`, max-width `580px`, box-shadow `0 8px 32px rgba(0,0,0,0.18)`
- Select de tipo + divisor + input de localização com ícone pin + botão "Buscar" (`#d8cb6a`, bold)

**Contador:** Inter 12px, `rgba(252,252,252,0.38)` — ex: "4 imóveis disponíveis agora" (dado real da API)

---

#### 2.2 Destaques ("Selecionados a dedo")
- Background: `#fcfcfc`
- Header da seção: label uppercase dourado + título Playfair + subtítulo + link "Ver todos →" alinhado à direita
- **Scroll horizontal** de cards `width: clamp(260px, 30vw, 320px)` com `overflow-x: auto`
- CTA: botão "Ver todos os imóveis →" centralizado, background `#585a4f`

**Card destaque:**
- Border-radius `14px`, overflow hidden
- Imagem: `padding-top: 65%` (aspect ratio), cover, hover scale `1.05`
- Badge negócio (Venda/Locação): topo esquerdo — Venda=`#d8cb6a`/texto escuro, Locação=`#585a4f`/texto branco
- Body: tipo (uppercase 12px muted), preço (Playfair 17px), localização com ícone pin, quartos + área, link "Ver mais →"

---

#### 2.3 Faixa Região
- Height: `160px`, imagem full cover com overlay `rgba(30,32,25,0.72)`
- Label uppercase dourado + texto Playfair: **"Zona Sul · Rio de Janeiro, RJ"**

---

#### 2.4 Por que escolher a Morabilidade?
- Background: `#f7f6f2`
- 3 cards em grid `repeat(auto-fit, minmax(240px, 1fr))`
- Cada card: background `#fcfcfc`, border `1px solid #e4e1d6`, border-radius `14px`, padding `28px 24px`
- Ícone decorativo dourado + título bold 15px + texto muted 14px

---

#### 2.5 Depoimentos (carrossel)
- Background: `#fcfcfc`, max-width `800px` centralizado
- Estrelas douradas, citação em Playfair itálico, nome em Inter bold olive
- Dots de navegação: ativo = `#d8cb6a` width `24px`, inativo = `#e4e1d6` width `8px`, height `8px`

---

#### 2.6 História (split)
- Background: `#f7f6f2`
- Grid: `clamp(220px, 38%, 380px) 1fr`, gap `clamp(32px, 6vw, 80px)`
- **Esquerda:** label + título Playfair + box "+10 anos" (background `#585a4f`, número Playfair 36px dourado) + link "Conhecer mais sobre nós →"
- **Direita:** 2 parágrafos + citação em blockquote com `border-left: 4px solid #d8cb6a`
- Citação: **"Esse apartamento tem morabilidade, uma palavra que não existe, mas a gente sabe o que significa."**

---

#### 2.7 CTA Final
- Background: `#3e4037` (sólido, sem imagem)
- Texto centralizado: label dourado + headline Playfair + subtítulo + botão "Falar com um corretor" com ícone WhatsApp

---

### 3. Página: Imóveis

#### 3.1 Header
- Background `#585a4f`, padding `clamp(36px,5vw,56px)`
- Label: **"Portfólio · Curadoria"** | Headline: **"Cada imóvel tem / uma história"** (itálico na segunda linha) | Subtítulo muted

#### 3.2 Barra de Filtros
- Background `#fcfcfc`, `position: sticky; top: 60px; z-index: 90`
- Height: `60px`, `overflow-x: auto`
- Conteúdo: ícone filtro + label "Filtros" + divisor + pills Tudo/Venda/Locação + divisor + selects de bairro e tipo + contador à direita

**Pills:** border-radius `100px`
- Ativo: background `#585a4f`, cor branca, border olive
- Inativo: background `#fcfcfc`, cor olive, border `#e4e1d6`

**Selects:** `appearance: none`, border `1.5px solid #e4e1d6`, border-radius `100px`, padding `7px 34px 7px 16px`, com chevron custom

#### 3.3 Grid de Cards
- `grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr))`
- Gap: `clamp(16px, 3vw, 28px)`
- Padding bottom `100px` (espaço para o switcher de preview)

**Card imóvel (completo):**
- Border-radius `14px`, border `1px solid #e4e1d6` (repouso) / sem border (hover)
- **Imagem:** `padding-top: 64%`, cover, hover scale `1.05` / translateY `-4px`
- **Badge negócio:** topo esquerdo (Venda=dourado, Locação=olive)
- **Badge bairro:** fundo branco 92% opacidade, cor olive, ícone pin, bottom esquerdo
- **Body:** tipo uppercase muted + preço Playfair 19px + quartos + área à direita
- **Nota editorial:** texto itálico entre aspas, border-top `1px solid #e4e1d6`
- **Link:** "Ver detalhes →" Inter 13px bold olive, border-bottom dourado

**Filtros funcionam via API** — os valores de negócio, bairro e tipo devem ser conectados aos filtros reais da API já existente.

---

### 4. Página: Sobre

#### 4.1 Hero
- Background `#585a4f`
- Label + headline **"Imobiliária feita para o mundo digital"** + subtítulo
- Badge Instagram: background `rgba(252,252,252,0.08)`, border-radius `100px` — ícone IG + "@morabilidade" + divisor + **"+80k seguidores"** dourado

#### 4.2 Nossa História (split)
- Background `#fcfcfc`, grid `1fr clamp(200px,30%,300px)`
- **Esquerda:** 3 parágrafos sobre a história da empresa
- **Direita:** card com logo PNG + texto "Imobiliária 100% digital" em itálico

#### 4.3 Morabilidade em Números
- Background `#585a4f`
- 4 stats em grid `repeat(auto-fit, minmax(180px, 1fr))`: **+10** anos, **+80k** seguidores, **100%** digital, **ZS** Zona Sul
- Cada stat: Playfair 36px dourado + legenda muted, border `rgba(252,252,252,0.1)`

#### 4.4 Por que escolher (6 cards)
- Background `#f7f6f2`, grid `repeat(auto-fit, minmax(280px, 1fr))`
- 6 cards: 100% digital | Atendimento personalizado | Agilidade via WhatsApp | Curadoria de imóveis | Transparência total | Comunidade engajada
- Cada card: ponto dourado `8px` + título bold + texto muted

#### 4.5 Como funciona (timeline)
- Background `#fcfcfc`, max-width `680px` centralizado
- 5 passos verticais com linha conectora
- Círculo: `40px`, background `#585a4f`, número dourado Inter bold
- Linha entre passos: `1px solid #e4e1d6`
- Título: 14px bold olive | Texto: 14px muted

**Passos:**
1. Entre em contato — WhatsApp ou Instagram
2. Entendemos seu perfil — sem questionários longos
3. Selecionamos as melhores opções — sem perda de tempo
4. Agendamos a visita — no horário conveniente
5. Negociação e fechamento — da proposta à escritura

#### 4.6 Depoimentos (grid 2×2)
- Background `#f7f6f2`, grid `repeat(auto-fit, minmax(300px, 1fr))`
- 4 cards com: estrelas + citação itálica + divisor + avatar circular (inicial) + nome
- Avatar: `34px`, background `#585a4f`, inicial dourada

**Clientes:**
- Marcelo Guidini (M)
- Juliana Paiva (J)
- Fabiano Sanches (F)
- Fernanda Cozac (F)

#### 4.7 CTA Final
- Background `#3e4037`
- Headline + subtítulo + 2 botões lado a lado:
  - **"Ver imóveis →"** — background `#d8cb6a`, texto escuro
  - **"Falar com a equipe"** — borda `1.5px solid rgba(252,252,252,0.3)`, texto branco, ícone WA

---

### 5. Página: Contato

#### 5.1 Hero (split)
- Background `#585a4f`
- Grid: `clamp(240px,55%,560px) 1fr`
- **Esquerda:** tag badge + headline **"Simples. / Eficiente. / Humanizada."** (última linha itálico `#e8dea0`) + subtítulo + localização
- **Direita (desktop):** 3 stats em grid vertical: "+10 anos de mercado" | "100% atendimento online" | "Zona Sul Rio de Janeiro · RJ"
  - Cada stat: background `rgba(252,252,252,0.06)`, border `rgba(252,252,252,0.09)`, número Playfair dourado

#### 5.2 Canais
- max-width `680px`, centralizado
- Label: **"Fale com a gente"** uppercase muted
- 2 cards: WhatsApp e Instagram (sem e-mail)

**Card de canal:**
- Flex, gap `18px`, padding `22px 24px`, border-radius `14px`
- Repouso: background `#fcfcfc`, border `1.5px solid #e4e1d6`
- Hover: background `#585a4f`, border olive, seta dourada
- Ícone em círculo `48px` (olive → dourado no hover)
- Label uppercase 10px + título Playfair 18px + subtítulo muted

**WhatsApp:**
- Título: **(21) 99772 9990**
- Sub: "Atendimento direto, sem robôs. Horário comercial."
- Link: `https://wa.link/we06jw`

**Instagram:**
- Título: **@morabilidade**
- Sub: "Imóveis, bastidores e novidades do mercado carioca."
- Link: `https://instagram.com/morabilidade`

#### 5.3 Rodapé da seção
- Linha divisora com texto central: "Imobiliária 100% digital · sem sede física"

---

## Interações e Comportamento

| Elemento | Comportamento |
|----------|--------------|
| Cards de imóvel | Hover: translateY(-4px) + box-shadow elevado + zoom na foto |
| Cards de canal | Hover: background olive escuro + seta dourada |
| Pills de filtro | Click: toggle ativo/inativo, re-filtra grid |
| Tabs hero (Tudo/Comprar/Alugar) | Click: altera tab ativo, deve filtrar busca |
| Dots depoimentos | Click: troca depoimento exibido |
| Scroll horizontal destaques | scrollbar fina customizada |
| Nav mobile | Hamburger → overlay fullscreen |
| Transição de página | `opacity 0→1 + translateY(4px→0)`, 200ms ease |

---

## Responsividade

- Breakpoint mobile: `768px`
- Nav: hamburger abaixo de 768px
- Grids: `auto-fit` com `minmax` colapsam para 1 coluna no mobile
- Tipografia: `clamp()` em todos os títulos
- Padding: `clamp(20px, 5vw, 48px)` horizontal em todas as seções
- Split layouts (história, hero contato): colapsam para coluna única no mobile

---

## Arquivos Incluídos

| Arquivo | Descrição |
|---------|-----------|
| `Morabilidade Redesign v2.html` | Protótipo completo com as 4 páginas interativas |
| `Logo_fundoTransparente-7574853e.png` | Logo oficial da marca |

---

## Notas para Implementação

1. **Filtros da aba Imóveis** devem ser conectados à API real — os dados mocados no protótipo são apenas ilustrativos
2. **Destaques na Início** devem buscar imóveis reais da API (ex: marcados como `destaque=true`)
3. **Contador do hero** ("X imóveis disponíveis agora") deve refletir o total real da API
4. **Logo:** usar sempre o arquivo PNG original, sem modificações de cor ou forma
5. **Travessão (—):** não usar em nenhum copy — substituir por vírgula, ponto ou `·`
6. **WhatsApp flutuante** (já existente no site) deve ser mantido
