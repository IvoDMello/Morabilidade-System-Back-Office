# Morabilidade · Kanban de Captações

Ferramenta interna estilo Trello para gerenciar captações de imóveis.
Projeto separado, reaproveitando Supabase, identidade visual e autenticação do Morabilidade.

> Especificação completa em [Kanban-Captacoes-PRD.md](./Kanban-Captacoes-PRD.md).

## Stack
- **Next.js 15** (App Router) · React 19 · TypeScript
- **Supabase** (Postgres schema `captacoes` + RLS, Auth compartilhado, Storage)
- **@dnd-kit** (drag-and-drop) · **zustand** (estado do board)
- **shadcn/Radix + Tailwind 3** · lucide-react · sonner
- **react-hook-form + zod**
- **Sentry** (monitoramento)

## Decisões-chave
- Kanban de **movimentação livre** (sem validação de transição).
- `ordem` **numeric** (fractional indexing) — reordenar sem reindexar.
- Imagens **comprimidas no cliente** (WebP grande ~1600px + thumb ~400px) e
  **upload direto** ao Storage. Sem `sharp` no servidor (poupa cota e CPU).
- Vídeos só por **URL externa**. Documentos por **signed URL de 5 min**.
- Retenção de mídia: **90 dias** (`arquivado_em`, cron diário).

## Setup
```bash
cp .env.local.example .env.local   # preencher chaves
npm install
npm run dev
```

## Banco
Aplicar as migrations em `supabase/migrations/` (na ordem) no projeto Supabase:
1. `0001_init_captacoes.sql` — schema, tabelas, índices, RLS, RPC `mover_cartao`.
2. `0002_storage_bucket.sql` — bucket privado `captacoes` + políticas.

## Deploy
- **Vercel** (deploy único). Cron de arquivamento em `vercel.json`.
- Domínio: `captacoes.morabilidade.com` (CNAME `cname.vercel-dns.com`).
- Variáveis de ambiente: ver `.env.local.example`.

## Backup
`scripts/backup-captacoes.ps1` — backup do bucket (o daily backup do Supabase
cobre o banco, **não** o Storage).
