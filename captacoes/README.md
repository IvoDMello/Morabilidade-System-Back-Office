# Morabilidade · Captações

Ferramenta interna para gerenciar as captações de imóveis: decidir, organizar
em listas, agendar visitas e gravações, e cobrar o retorno ao proprietário.
Projeto separado, reaproveitando Supabase, identidade visual e autenticação do
Morabilidade.

> A v1 era um Kanban de colunas; a **v2** trocou as colunas por quatro abas e
> por listas coloridas — ver [REDESIGN-BRIEF.md](./REDESIGN-BRIEF.md) para o
> raciocínio e [ROLLBACK.md](./ROLLBACK.md) para o caminho de volta.
> Especificação original em [Kanban-Captacoes-PRD.md](./Kanban-Captacoes-PRD.md).

## Stack
- **Next.js 15** (App Router) · React 19 · TypeScript
- **Supabase** (Postgres schema `captacoes` + RLS, Auth compartilhado, Storage)
- **zustand** (estado do app) · **@dnd-kit** (reordenar fotos na galeria)
- **shadcn/Radix + Tailwind 3** · lucide-react · sonner
- **react-hook-form + zod**
- **Sentry** (monitoramento)

## Decisões-chave
- **Etapa × lista.** `status` continua no banco e vira a *etapa* (uma por
  captação, define a aba); as *listas* (`lista` + `captacao_lista`) são
  etiquetas coloridas, várias por captação. Gaveta e Seleção Especial deixaram
  de ser coluna e viraram lista.
- **Filtro no lugar de coluna.** Achar imóvel é filtrar, não navegar — daí o
  painel de filtros ser tão completo.
- `ordem` **numeric** (fractional indexing), reordenar sem reindexar. Em
  `captacao_lista.ordem` ela é a **sequência de gravação** daquela lista.
- **Retorno negativo é tarefa, não evento**: tem dono e prazo, vive na aba
  Negativadas e **não** vai para o Google Agenda.
- **Google Agenda em conta única da empresa** (sem OAuth por usuário), via REST
  direto — best-effort: falhar lá nunca bloqueia o agendamento aqui.
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
1. `0001_init_captacoes.sql`, schema, tabelas, índices, RLS, RPC `mover_cartao`.
2. `0002_storage_bucket.sql`, bucket privado `captacoes` + políticas.
3. Demais migrations em ordem numérica.
4. **Reformulação v2** (`0021`–`0023`), aplicar antes do deploy:
   - `0021_listas.sql`, tabelas `lista` e `captacao_lista` **e a migração dos
     dados**: cada captação ganha uma lista com o nome da coluna em que estava
     no quadro v1. Ver `REDESIGN-BRIEF.md` §8.
   - `0022_retorno_negativa.sql`, motivo da reprovação + responsável, prazo e
     carimbo do retorno ao proprietário.
   - `0023_agendamento_google.sql`, hora nos agendamentos e id do evento
     espelhado na Google Agenda.

   As três são **aditivas**: nada sai do enum `captacoes.status`, nenhuma coluna
   é renomeada. É isso que permite voltar para a v1 sem rollback de banco — e o
   cron de arquivamento, que lê `status` direto, continua funcionando.

## Deploy
- **Vercel** (deploy único). Cron de arquivamento em `vercel.json`.
- Domínio: `captacoes.morabilidade.com` (CNAME `cname.vercel-dns.com`).
- Variáveis de ambiente: ver `.env.local.example`.

## Backup
`scripts/backup-captacoes.ps1`, backup do bucket (o daily backup do Supabase
cobre o banco, **não** o Storage).
