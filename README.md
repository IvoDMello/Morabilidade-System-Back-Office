# Morabilidade — Sistema de Gestão (Back-Office)

Sistema interno de gestão imobiliária. Painel administrativo restrito à equipe + site público que consome a mesma API.

---

## Índice

1. [O que existe no repositório](#1-o-que-existe-no-repositório)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Como rodar o projeto](#3-como-rodar-o-projeto)
4. [Estrutura da API (back-end)](#4-estrutura-da-api-back-end)
5. [Estrutura do Painel (front-end)](#5-estrutura-do-painel-front-end)
6. [Estrutura do Site público](#6-estrutura-do-site-público)
7. [Banco de dados](#7-banco-de-dados)
8. [Autenticação e permissões](#8-autenticação-e-permissões)
9. [Guia de orientação para manutenção](#9-guia-de-orientação-para-manutenção)
10. [Variáveis de ambiente](#10-variáveis-de-ambiente)
11. [Validando o sistema manualmente](#11-validando-o-sistema-manualmente)

---

## 1. O que existe no repositório

Este repositório contém **três sub-projetos** independentes que funcionam em conjunto:

```
Morabilidade-System-Back-Office/
├── api/     → Back-end: Python 3.12 + FastAPI  (porta 8000)
├── web/     → Painel administrativo: Next.js 15 (porta 3000)
└── site/    → Site público: Next.js 15           (porta 3001)
```

- **`api/`** é o núcleo. Tudo passa por ela — o painel e o site consomem endpoints desta API.
- **`web/`** é o back-office: onde a equipe cadastra imóveis, gerencia clientes e usuários.
- **`site/`** é a vitrine pública: o que os clientes finais acessam. Usa apenas endpoints públicos da API.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| API | Python 3.12 + FastAPI 0.115 |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth (e-mail + senha, JWT) |
| Armazenamento de imagens | Firebase Storage (plano Spark gratuito) |
| Painel administrativo | Next.js 15 + React 19 + shadcn/ui + Tailwind |
| Site público | Next.js 15 + Tailwind (sem UI lib externa) |
| Estado global (painel) | Zustand |
| Formulários | React Hook Form + Zod |
| E-mail transacional | Resend |
| Deploy API | Railway ou Render (Docker) |
| Deploy front-ends | Vercel |

---

## 3. Como rodar o projeto

São **3 terminais** rodando em paralelo. A API deve ser iniciada primeiro — o painel e o site dependem dela.

> **Pré-requisitos:** Python 3.12+, Node.js 18+, contas no [Supabase](https://supabase.com), [Firebase](https://firebase.google.com) e [Resend](https://resend.com), e banco inicializado (ver [seção 7](#7-banco-de-dados)).

---

### Resumo rápido (uso diário)

| Terminal | Pasta | Comando | URL |
|---|---|---|---|
| 1 — API | `cd api` | `uvicorn app.main:app --reload` | `localhost:8000` |
| 2 — Painel | `cd web` | `npm run dev` | `localhost:3000` |
| 3 — Site | `cd site` | `npm run dev` | `localhost:3001` |

---

### Terminal 1 — API (FastAPI)

```bash
cd api
```

**Primeira vez:**
```bash
python -m venv venv
pip install -r requirements.txt
cp .env.example .env
# Preencha o .env com suas credenciais (ver seção 10)
```

**Rodar:**
```bash
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Documentação interativa: `http://localhost:8000/docs`

---

### Terminal 2 — Painel administrativo (Next.js)

```bash
cd web
```

**Primeira vez:**
```bash
npm install
cp .env.local.example .env.local
# Preencha o .env.local com suas credenciais (ver seção 10)
```

**Rodar:**
```bash
npm run dev
```

- Painel: `http://localhost:3000`

---

### Terminal 3 — Site público (Next.js)

```bash
cd site
```

**Primeira vez:**
```bash
npm install
cp .env.local.example .env.local
# Preencha o .env.local com suas credenciais (ver seção 10)
```

**Rodar:**
```bash
npm run dev
```

- Site: `http://localhost:3001`

---

## 4. Estrutura da API (back-end)

```
api/
├── Dockerfile                    → Build para deploy (Railway/Render)
├── requirements.txt              → Dependências de produção
├── requirements-dev.txt          → pytest, httpx, pytest-mock
├── .env.example                  → Template de variáveis de ambiente
├── migrations/
│   └── 001_initial.sql           → Schema completo do banco (rodar no Supabase)
├── tests/
│   ├── conftest.py               → Fixtures compartilhadas
│   ├── test_auth.py
│   ├── test_imoveis.py
│   ├── test_clientes.py
│   ├── test_tags.py
│   └── test_schemas.py
└── app/
    ├── main.py                   → Inicialização, CORS, registro de routers
    ├── config.py                 → Variáveis de ambiente (Pydantic Settings)
    ├── database.py               → Clientes Supabase (anon + service_role)
    ├── auth/
    │   ├── router.py             → POST /auth/login, /logout, /recuperar-senha
    │   ├── dependencies.py       → get_current_user(), require_admin()
    │   └── schemas.py            → LoginRequest, LoginResponse
    ├── routers/
    │   ├── imoveis.py            → 13 endpoints: CRUD + upload fotos + endpoints públicos
    │   ├── clientes.py           → 6 endpoints: CRUD completo
    │   ├── tags.py               → 6 endpoints: CRUD (admin only) + listagem pública
    │   ├── users.py              → 10 endpoints: CRUD + perfil + troca de senha
    │   └── contato.py            → 1 endpoint: POST /contato (público, envia e-mail)
    ├── schemas/
    │   ├── imovel.py             → ImovelCreate, ImovelUpdate, ImovelOut + Enums
    │   ├── cliente.py            → ClienteCreate, ClienteUpdate, ClienteOut
    │   ├── tag.py                → TagCreate, TagUpdate, TagOut
    │   └── user.py               → UserCreate, UserUpdate, UserChangePassword, UserOut
    └── services/
        ├── firebase.py           → Upload/delete de imagens + compressão automática (Pillow)
        └── email.py              → Envio de e-mails via Resend
```

### Endpoints por módulo

| Módulo | Endpoints | Observações |
|---|---|---|
| Auth | 3 | Login, logout, recuperar senha |
| Imóveis | 13 | CRUD + upload de fotos + endpoints sem autenticação para o site |
| Clientes | 6 | CRUD completo (autenticado) |
| Tags | 6 | CRUD admin + GET público para o site |
| Usuários | 10 | CRUD + perfil + troca de senha |
| Contato | 1 | POST público — dispara e-mail em background |
| Health | 2 | GET `/` e `/stats` — health check e dados do dashboard |

---

## 5. Estrutura do Painel (front-end)

```
web/src/
├── middleware.ts                 → Proteção de rotas: redireciona para /login se sem JWT
├── types/index.ts                → Todos os tipos TypeScript centralizados aqui
├── lib/
│   ├── api.ts                    → Instância Axios com interceptor JWT + redirect 401
│   ├── auth-store.ts             → Zustand: token, dados do usuário, função logout
│   └── utils.ts                  → cn(), formatarMoeda(), formatarArea()
├── components/
│   ├── layout/
│   │   ├── Header.tsx            → Topo: título dinâmico + info do usuário logado
│   │   └── Sidebar.tsx           → Menu lateral com itens filtrados por role (RBAC)
│   ├── imoveis/
│   │   └── imovel-form.tsx       → Formulário de cadastro/edição de imóvel
│   └── clientes/
│       └── cliente-form.tsx      → Formulário de cadastro/edição de cliente
└── app/
    ├── (auth)/                   → Rotas públicas (sem sidebar)
    │   ├── login/page.tsx        → Formulário com validação Zod
    │   └── recuperar-senha/page.tsx
    └── (dashboard)/              → Rotas protegidas (com sidebar)
        ├── page.tsx              → Home: 4 cards de estatísticas (imóveis, clientes, etc.)
        ├── imoveis/
        │   ├── page.tsx          → Listagem com filtros e paginação
        │   ├── novo/page.tsx     → Formulário de criação
        │   └── [id]/page.tsx     → Formulário de edição
        ├── clientes/
        │   ├── page.tsx          → Listagem com filtro por status
        │   ├── novo/page.tsx     → Formulário de criação
        │   └── [id]/page.tsx     → Formulário de edição
        ├── perfil/page.tsx       → Configurações do usuário logado
        ├── tags/page.tsx         → Gestão de tags (visível só para admin)
        └── usuarios/page.tsx     → Gestão de usuários internos (visível só para admin)
```

---

## 6. Estrutura do Site público

```
site/src/
├── types/index.ts
├── lib/
│   ├── api.ts                    → fetch para endpoints públicos da API
│   └── utils.ts                  → formatarMoeda, labels de tipos
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx            → Sticky, com menu hamburguer mobile
│   │   └── Footer.tsx            → Contato (placeholders a preencher)
│   └── imoveis/
│       ├── ImovelCard.tsx        → Card: foto, preço, área, tags
│       ├── FiltrosBusca.tsx      → 9 filtros que atualizam a URL (search params)
│       └── Galeria.tsx           → Foto principal + miniaturas clicáveis
└── app/
    ├── page.tsx                  → Homepage (server component, SSR)
    ├── imoveis/
    │   ├── page.tsx              → Listagem com filtros e paginação (client)
    │   └── [codigo]/page.tsx     → Detalhe do imóvel (SSR + generateMetadata para SEO)
    ├── contato/page.tsx          → Formulário de contato
    └── sobre/page.tsx            → Sobre a imobiliária (tem placeholders — ver abaixo)
```

**Atenção — Textos a personalizar no site:**
Os textos marcados com `[X]` na página `/sobre` e no `Footer.tsx` precisam ser substituídos pelas informações reais: anos de mercado, número de imóveis negociados, endereço e telefone.

---

## 7. Banco de dados

O banco é PostgreSQL hospedado no Supabase. Há 6 tabelas:

| Tabela | Função |
|---|---|
| `usuarios` | Perfis internos (admin / administrativo) — complementa auth.users do Supabase |
| `imoveis` | Cadastro central dos imóveis (30+ campos: localização, preço, descrição, etc.) |
| `imovel_fotos` | URLs das fotos no Firebase Storage, com ordenação |
| `imovel_tags` | Relacionamento N:N entre imóveis e tags |
| `tags` | Etiquetas configuráveis: Destaque, Novo, Oportunidade, etc. |
| `clientes` | Leads e clientes com dados de contato e status |

**Inicializar o banco (fazer uma vez):**
1. Acesse o SQL Editor no painel do Supabase
2. Execute o arquivo `api/migrations/001_initial.sql`
3. Isso cria todas as tabelas, índices, triggers e políticas RLS

**Sobre o RLS (Row Level Security):**
O RLS está habilitado nas tabelas. A API usa a `service_role key` do Supabase, que bypassa o RLS por design. Isso é intencional — a segurança é feita via JWT + dependências do FastAPI (`get_current_user`, `require_admin`).

---

## 8. Autenticação e permissões

### Fluxo de autenticação

1. Usuário faz login no painel → `POST /auth/login` com e-mail e senha
2. A API chama o Supabase Auth, que retorna um JWT
3. O JWT é guardado no Zustand (`auth-store.ts`) e enviado em cada request via `Authorization: Bearer <token>`
4. O `middleware.ts` do Next.js verifica o token antes de renderizar qualquer página do dashboard
5. Na API, `get_current_user()` em `auth/dependencies.py` valida o token em cada endpoint protegido

### Roles (RBAC)

| Role | Acesso |
|---|---|
| `admin` | Tudo: imóveis, clientes, tags, usuários |
| `administrativo` | Imóveis e clientes apenas (sem gestão de tags e usuários) |

- No **painel**: a `Sidebar.tsx` oculta itens de admin para o role `administrativo`
- Na **API**: `require_admin` bloqueia os endpoints de tags e usuários para não-admins

---

## 9. Guia de orientação para manutenção

Esta seção explica **onde mexer** quando você precisar fazer mudanças comuns.

### "Quero adicionar um campo novo ao cadastro de imóvel"

1. **Banco** → `api/migrations/` — crie uma nova migration SQL com `ALTER TABLE imoveis ADD COLUMN ...`
2. **Schema da API** → `api/app/schemas/imovel.py` — adicione o campo em `ImovelCreate`, `ImovelUpdate` e `ImovelOut`
3. **Router da API** → `api/app/routers/imoveis.py` — inclua o campo nas operações de INSERT e UPDATE
4. **Tipo TypeScript** → `web/src/types/index.ts` — atualize a interface `Imovel`
5. **Formulário do painel** → `web/src/components/imoveis/imovel-form.tsx` — adicione o input
6. **Página de detalhe no site** → `site/src/app/imoveis/[codigo]/page.tsx` — exiba o campo

### "Quero mudar a aparência do painel"

- Cores e tema → `web/tailwind.config.ts`
- Layout geral (sidebar + header) → `web/src/components/layout/`
- Estilo global → `web/src/app/globals.css`
- Componentes de UI usam shadcn/ui — consulte a documentação do shadcn para customizar

### "Quero mudar a aparência do site público"

- Cores da marca (olive/gold) → `site/tailwind.config.ts`
- Navbar e Footer → `site/src/components/layout/`
- Cards de imóveis → `site/src/components/imoveis/ImovelCard.tsx`
- Filtros de busca → `site/src/components/imoveis/FiltrosBusca.tsx`

### "Quero adicionar uma nova página ao painel"

1. Crie a pasta em `web/src/app/(dashboard)/nome-da-pagina/page.tsx`
2. A proteção de rota é automática via `middleware.ts` (qualquer rota dentro de `(dashboard)` é protegida)
3. Adicione o link de navegação em `web/src/components/layout/Sidebar.tsx`
4. Se for restrito a admin, envolva o link com uma verificação de role no Sidebar

### "Quero criar um novo endpoint na API"

1. Crie ou edite o arquivo em `api/app/routers/`
2. Defina os schemas Pydantic correspondentes em `api/app/schemas/`
3. Registre o router em `api/app/main.py` com `app.include_router(...)`
4. Use `Depends(get_current_user)` para proteger o endpoint
5. Use `Depends(require_admin)` se for exclusivo de admin

### "Quero mudar como as fotos são tratadas"

- Upload e compressão → `api/app/services/firebase.py`
- A compressão usa Pillow automaticamente antes do upload
- O componente de galeria no site → `site/src/components/imoveis/Galeria.tsx`
- Para habilitar um novo domínio de imagens no Next.js → `web/next.config.ts` e `site/next.config.ts`

### "Quero alterar os e-mails transacionais"

- Lógica de envio → `api/app/services/email.py`
- Endpoint de contato (e-mail do site) → `api/app/routers/contato.py`
- Remetente e destinatário configurados nas variáveis `EMAIL_FROM` e `EMAIL_CONTATO` no `.env`

### "Quero entender por que um usuário não consegue acessar algo"

1. Verifique se o JWT está sendo enviado → inspecione o Axios em `web/src/lib/api.ts`
2. Verifique o token no store → `web/src/lib/auth-store.ts`
3. Verifique o middleware → `web/src/middleware.ts`
4. Verifique a dependência na API → `api/app/auth/dependencies.py`
5. Verifique o role do usuário na tabela `usuarios` no Supabase

### Onde ficam os tipos TypeScript

- **Painel**: todos os tipos centralizados em `web/src/types/index.ts`
- **Site**: tipos em `site/src/types/index.ts`
- Mantenha estes arquivos como fonte de verdade — evite criar tipos inline nos componentes

---

## 10. Variáveis de ambiente

### API (`api/.env`)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...

# Firebase (caminho para o JSON de credenciais)
FIREBASE_CREDENTIALS_PATH=../../firebase-credentials.json
FIREBASE_STORAGE_BUCKET=xxx.appspot.com

# Resend (e-mail)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@seudominio.com
EMAIL_CONTATO=contato@seudominio.com

# App
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Painel (`web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Site (`site/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 11. Validando o sistema manualmente

Com os três servidores rodando, valide cada módulo:

| Módulo | O que verificar |
|---|---|
| **Login** | Acesso com credenciais corretas → entra. Credenciais erradas → mensagem de erro |
| **Dashboard** | Cards mostram números reais (imóveis, clientes, disponíveis, em negociação) |
| **Imóveis** | Criar imóvel, fazer upload de foto, editar, excluir |
| **Clientes** | Criar cliente, editar status, filtrar por status, excluir |
| **Tags** | Criar tag com cor, editar inline, excluir (como admin) |
| **Usuários** | Criar usuário interno, ver lista (como admin) |
| **RBAC** | Logar como `administrativo` → itens Tags e Usuários devem estar ocultos |
| **Site público** | Acessar `localhost:3001`, filtrar imóveis, abrir detalhe, enviar formulário de contato |

### Rodando os testes automatizados

```bash
# Backend
cd api
source venv/bin/activate  # ou venv\Scripts\activate no Windows
python -m pytest -v

# Frontend (painel)
cd web
npm test
```

### Verificações no Supabase

- As 6 tabelas existem e têm dados
- A sequence `proxima_sequencia_imovel` existe (usada para gerar códigos de imóveis)
- As políticas RLS estão ativas nas tabelas
- O Firebase Storage aceita uploads (regras permitem escrita autenticada via service account)
