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

- Python 3.12+
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
