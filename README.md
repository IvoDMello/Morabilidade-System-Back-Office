# Morabilidade — Sistema de Gestão (Back-Office)

Sistema interno de gestão imobiliária. Acesso restrito à equipe administrativa.

## Estrutura do Repositório

```
.
├── api/          # Back-end: Python + FastAPI
└── web/          # Front-end: Next.js + shadcn/ui (painel administrativo)
```

O **site público** (vitrine) está em repositório separado e consome a API deste sistema para exibir os imóveis em tempo real.

## Stack

| Camada | Tecnologia |
|---|---|
| API | Python 3.12 + FastAPI |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | Supabase Auth (e-mail + senha, JWT) |
| Armazenamento de imagens | Firebase Storage (plano Spark) |
| Front-end | Next.js 14 + React + shadcn/ui |
| Hospedagem API | Railway ou Render |
| Hospedagem Front-end | Vercel |
| E-mail transacional | Resend |

## Pré-requisitos

- Python 3.12++
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Conta no [Firebase](https://firebase.google.com)
- Conta no [Resend](https://resend.com) (ou SendGrid)

## Início Rápido

### 1. API (FastAPI)

```bash
cd api
cp .env.example .env
# Preencha as variáveis no .env

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

Documentação interativa disponível em: `http://localhost:8000/docs`

### 2. Front-end (Next.js)

```bash
cd web
cp .env.local.example .env.local
# Preencha as variáveis no .env.local

npm install
npm run dev
```

Painel disponível em: `http://localhost:3000`

### 3. Migrations

Execute o arquivo `api/migrations/001_initial.sql` no SQL Editor do Supabase para criar as tabelas.

## Módulos

- **Autenticação** — Login, recuperação de senha, RBAC (Admin / Administrativo)
- **Imóveis** — CRUD completo com upload de fotos (Firebase Storage)
- **Clientes** — Cadastro de leads e clientes
- **Tags** — Etiquetas configuráveis pelo admin (Destaque, Novo, Oportunidade…)
- **Usuários** — Gestão de usuários internos (somente Admin)

## Fases de Desenvolvimento

| Fase | Descrição |
|---|---|
| 1 | Setup, autenticação, layout base |
| 2 | Cadastro de imóveis + upload de fotos |
| 3 | Listagem e filtros de imóveis |
| 4 | Cadastro de clientes |
| 5 | MVP do site público |
| 6 | Ajustes, testes e deploy final |


Morabilidade-System-Back-Office/
├── .gitignore
├── README.md
│
├── api/                                   # FastAPI back-end
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   ├── migrations/
│   │   └── 001_initial.sql               # Schema completo para o Supabase
│   └── app/
│       ├── main.py                        # Entry point + CORS
│       ├── config.py                      # Variáveis de ambiente (pydantic-settings)
│       ├── database.py                    # Clientes Supabase (anon + service_role)
│       ├── auth/
│       │   ├── router.py                  # Login, logout, recuperar senha
│       │   ├── dependencies.py            # get_current_user, require_admin
│       │   └── schemas.py
│       ├── routers/
│       │   ├── imoveis.py                 # CRUD + upload fotos + endpoints públicos
│       │   ├── clientes.py                # CRUD de clientes/leads
│       │   ├── tags.py                    # CRUD de tags (admin only)
│       │   └── users.py                   # CRUD de usuários internos
│       ├── schemas/                       # Pydantic models para todos os módulos
│       └── services/
│           ├── firebase.py               # Upload/delete Firebase Storage + compressão
│           └── email.py                  # Envio via Resend
│
└── web/                                   # Next.js 15 — painel administrativo
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts / postcss.config.mjs
    ├── tsconfig.json
    ├── .env.local.example
    └── src/
        ├── middleware.ts                  # Proteção de rotas (redirect para /login)
        ├── types/index.ts                 # Todos os tipos TypeScript
        ├── lib/
        │   ├── api.ts                     # Axios com interceptor JWT + 401 handler
        │   ├── auth-store.ts              # Zustand store (token + user)
        │   └── utils.ts                   # cn(), formatarMoeda(), formatarArea()
        ├── components/layout/
        │   ├── Sidebar.tsx               # Menu lateral com RBAC
        │   └── Header.tsx
        └── app/
            ├── (auth)/login/             # Página de login
            ├── (auth)/recuperar-senha/   # Recuperação de senha
            └── (dashboard)/
                ├── page.tsx              # Painel (cards de estatísticas)
                ├── imoveis/              # Lista, novo, editar
                ├── clientes/             # Lista, novo
                ├── tags/
                └── usuarios/


Estrutura do Projeto
O projeto é um sistema de gestão imobiliária (back-office) composto por dois sub-projetos dentro do mesmo repositório:


Morabilidade-System-Back-Office/
├── api/          → Python 3.12 + FastAPI (back-end)
└── web/          → Next.js 15 + React 19 (front-end)
Stack completa:

Camada	Tecnologia
API	Python + FastAPI
Banco de dados	PostgreSQL via Supabase
Autenticação	Supabase Auth (JWT)
Storage de imagens	Firebase Storage
Front-end	Next.js 15 + shadcn/ui + Tailwind
E-mail	Resend
Estado global	Zustand
Deploy API	Railway / Render
Deploy Front	Vercel
Estrutura da API (back-end)

api/app/
├── main.py          → inicialização do FastAPI, CORS, routers
├── config.py        → variáveis de ambiente (Pydantic Settings)
├── database.py      → cliente Supabase
├── auth/
│   ├── router.py    → POST /auth/login, /logout, /recuperar-senha
│   └── dependencies.py → get_current_user(), require_admin()
├── routers/
│   ├── imoveis.py   → CRUD completo + upload de fotos + endpoints públicos
│   ├── clientes.py  → CRUD completo
│   ├── tags.py      → CRUD (admin only)
│   └── users.py     → CRUD (admin only) + perfil próprio
├── schemas/         → modelos Pydantic para validação
└── services/
    ├── firebase.py  → upload/delete de imagens (compressão automática)
    └── email.py     → envio via Resend
Estrutura do Front-end

web/src/
├── middleware.ts          → proteção de rotas
├── lib/
│   ├── api.ts             → axios com interceptores (auth + 401 redirect)
│   ├── auth-store.ts      → Zustand (token + user + logout)
│   └── utils.ts           → cn(), formatarMoeda(), formatarArea()
├── components/layout/
│   ├── Sidebar.tsx         → navegação com RBAC (itens admin ocultos)
│   └── Header.tsx          → título dinâmico + info do usuário
└── app/
    ├── (auth)/login/       → formulário login com Zod ✅
    ├── (auth)/recuperar-senha/ → recuperação ✅
    └── (dashboard)/
        ├── page.tsx         → home do dashboard
        ├── imoveis/         → listagem + novo + [id]
        ├── clientes/        → listagem + novo
        ├── tags/            → gestão de tags
        └── usuarios/        → gestão de usuários
Banco de Dados (6 tabelas)
Tabela	Função
usuarios	Perfis internos (admin / administrativo)
imoveis	Cadastro central de imóveis (30+ campos)
imovel_fotos	URLs das fotos no Firebase (ordenadas)
imovel_tags	Relacionamento N:N imóvel ↔ tag
tags	Etiquetas configuráveis pelo admin
clientes	Leads/clientes com dados completos
RLS (Row Level Security) habilitado; API usa service role key para bypass.


para testar: 

# API
cd api && venv/Scripts/uvicorn app.main:app --reload

# Web (outro terminal)
cd web && npm run dev
-

O que fazer para validar o sistema
1. Rodar os testes (a partir de agora)
Backend — execute dentro de api/:


source venv/Scripts/activate
python -m pytest -v
Frontend — execute dentro de web/:


npm test
2. Testar manualmente no browser (validação funcional)
Com os servidores rodando (uvicorn + next dev), valide cada módulo:

Módulo	O que verificar
Login	Acesso com credenciais corretas e erradas
Dashboard	Números reais aparecem nos cards
Imóveis	Criar, editar, fazer upload de foto, excluir
Clientes	Criar, editar, filtrar por status, excluir
Tags	Criar com cor, editar inline, excluir
Usuários	Criar usuário (como admin), ver lista
RBAC	Logar como administrativo → botões de admin devem estar ocultos
3. Configurar o banco (Supabase)
Verifique se as tabelas estão criadas com as migrations corretas. Os testes não tocam no banco real — valide com dados reais que:

A sequência proxima_sequencia_imovel existe no Supabase
As políticas RLS estão configuradas corretamente
O storage do Firebase aceita uploads

para rodar o SISTEMA:
Terminal 1 — FastAPI:

cd api
uvicorn app.main:app --reload
Terminal 2 — Next.js:

cd web
npm run dev