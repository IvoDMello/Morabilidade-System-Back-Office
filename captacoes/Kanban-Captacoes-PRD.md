# Kanban de Captações — Morabilidade

> Documento de requisitos e especificação técnica.
> Projeto **separado** do sistema principal (repositório GitHub próprio),
> reaproveitando identidade visual, stack e infraestrutura Supabase do Morabilidade.

---

## 1. Visão geral

Ferramenta interna no estilo **Trello/Kanban** para gerenciar as captações de
imóveis recebidas diariamente. Cada captação é um **cartão** que percorre colunas
representando as etapas do fluxo de aprovação e agendamento.

- **Acesso:** todos os usuários do Morabilidade (login compartilhado).
- **Repositório:** novo repo GitHub, isolado do sistema principal.
- **Infra:** reusa o projeto **Supabase Pro** existente (schema e bucket próprios).

---

## 2. Modelo de negócio

### 2.1 Conteúdo de cada captação (cartão)
- Endereço completo
- Nº de quartos e nº de banheiros
- Tipo de portaria
- Fotos e vídeos (vídeos via **link externo** — YouTube/Drive)
- Contato do proprietário
- Observações
- Documentos anexados
- Campo de **pendências/dificuldades** (relevante na 1ª coluna)

### 2.2 Fluxo de colunas (Kanban)

```
┌─────────────────────┐   ┌────────┐   ┌──────────────────┐
│ Aguardando          │ → │ Novas  │ → │ Decisão:         │
│ informações         │   │        │   │ aprovar/reprovar │
│ (+ pendências)      │   │        │   │                  │
└─────────────────────┘   └────────┘   └────────┬─────────┘
                                                 │
                  ┌──────────────────────────────┴───────────────┐
                  │ REPROVADA                      APROVADA        │
                  ▼                                ▼               │
         ┌────────────────────┐         ┌──────────────────────┐  │
         │ Pendente de        │         │ Pendente agendar     │  │
         │ negativa           │         │ visita               │  │
         └─────────┬──────────┘         └──────────┬───────────┘  │
                   ▼                               ▼               │
         ┌────────────────────┐         ┌──────────────────────┐  │
         │ Negativada         │         │ Pendente agendar     │  │
         │                    │         │ gravação             │  │
         └────────────────────┘         └──────────────────────┘  │
```

Colunas (enum de status):
1. `aguardando_informacoes`
2. `novas`
3. `em_decisao`
4. `pendente_negativa`  *(ramo reprovado)*
5. `negativada`         *(ramo reprovado)*
6. `pendente_agendar_visita`   *(ramo aprovado)*
7. `pendente_agendar_gravacao` *(ramo aprovado)*

### 2.3 Regras de agendamento
- **Visita** e **gravação**: cada uma tem checkbox "concluído" + campo de data.
- Opção **"visita e gravação no mesmo dia"** preenche ambas as datas de uma vez.

---

## 3. Requisitos funcionais

| ID | Requisito |
|----|-----------|
| RF01 | Quadro Kanban com colunas fixas do fluxo e cartões arrastáveis (drag-and-drop) entre colunas. |
| RF02 | Criar captação (cartão) com todos os campos da seção 2.1. |
| RF03 | Editar campos do cartão a qualquer momento. |
| RF04 | Coluna "Aguardando informações" exibe e destaca o campo de pendências. |
| RF05 | Etapa de decisão registra **aprovar/reprovar**, com autor e data (auditoria). |
| RF06 | Reprovação encaminha para `pendente_negativa` → `negativada`. |
| RF07 | Aprovação encaminha para `pendente_agendar_visita` → `pendente_agendar_gravacao`. |
| RF08 | Agendamento de visita: checkbox concluído + data. |
| RF09 | Agendamento de gravação: checkbox concluído + data. |
| RF10 | Atalho "visita e gravação no mesmo dia". |
| RF11 | Upload de fotos com **compressão/resize no cliente** (versão grande ~1600px + thumbnail ~400px, WebP) e **upload direto ao Storage** via signed upload URL. |
| RF12 | Registro de vídeos via URL externa (YouTube/Drive). |
| RF13 | Upload/armazenamento de documentos, servidos por **signed URL de curta duração**. |
| RF14 | Histórico de movimentação do cartão entre colunas (audit log). |
| RF15 | Autenticação via Supabase Auth (mesmos usuários do Morabilidade). |
| RF16 | Arquivamento da mídia após captação negativada/positivada (ver seção 7). |

---

## 4. Requisitos não-funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | Identidade visual idêntica ao Morabilidade (paleta 60/30/10). |
| RNF02 | Responsivo / mobile-first real (não micro-ajustes). |
| RNF03 | Não consumir a cota de Image Transformation do Supabase (thumbs gerados no cliente, sem `sharp` no servidor). |
| RNF04 | Documentos com dados do proprietário acessíveis só por signed URL (LGPD). Modelo aceito: qualquer usuário autenticado tem acesso; o signed URL protege contra link vazado, não contra usuário interno. |
| RNF05 | Backup do novo bucket incluído desde o início. |
| RNF06 | **Monitoramento de erros via Sentry, desde o início** (`@sentry/nextjs`). |
| RNF07 | Custo de storage controlado (vídeos fora do Supabase + imagens comprimidas no cliente). |
| RNF08 | Board carrega apenas thumbnails (lazy); imagem grande só no detalhe do cartão. |

---

## 5. Especificação visual

Reaproveitada de `web/src/app/globals.css` do Morabilidade — sistema **60/30/10**:

| Papel | Cor | HSL (CSS var) | Token |
|-------|-----|---------------|-------|
| 60% — fundos escuros, sidebar | olive `#585a4f` | `71 6% 33%` | `secondary` |
| 30% — botões, destaques | dourado `#d8cb6a` | `53 55% 63%` | `primary` |
| 10% — conteúdo/texto sobre escuro | off-white `#fcfcfc` | `71 5% 96%` | `background` |
| Destrutivo | vermelho | `0 84% 60%` | `destructive` |

- **Raio padrão:** `0.5rem`.
- **Tema:** CSS variables em HSL + Tailwind lendo `hsl(var(--…))`.
- **Tipografia/componentes:** shadcn/Radix + Tailwind (copiar a pasta `ui/` do `web/`).
- **Ícones:** lucide-react. **Toasts:** sonner.

### Mapeamento de cor das colunas (sugerido)
- `aguardando_informacoes` — muted/cinza
- `novas` — dourado (primary)
- `em_decisao` — olive
- `pendente_negativa` / `negativada` — vermelho/destrutivo
- `pendente_agendar_visita` / `pendente_agendar_gravacao` — verde/positivo

---

## 6. Decisões técnicas

| Tema | Decisão |
|------|---------|
| Front + Back | **Next.js 15 full-stack** (App Router + route handlers), React 19, TS. Deploy único na **Vercel**. |
| UI | shadcn/Radix + Tailwind 3, lucide-react, sonner, react-hook-form + zod, zustand. |
| Drag-and-drop | **@dnd-kit**. |
| Banco | **Supabase Pro existente**, schema novo `captacoes`, com **RLS**. |
| Auth | Supabase Auth compartilhado (`auth.users`) — todos os usuários têm acesso. |
| Kanban | **Movimentação livre** entre colunas (sem validação de transição); confia no usuário. |
| Ordenação | Campo `ordem` **numeric** (fractional indexing) — insere entre dois cartões sem reindexar a coluna. |
| Storage | Bucket novo `captacoes`. **Compressão/resize no cliente** (`browser-image-compression`): grande ~1600px + thumb ~400px em WebP, **upload direto** ao Storage via signed upload URL (API só assina, não recebe o arquivo). |
| Vídeos | Apenas URL externa no banco (sem upload no Supabase). |
| Documentos | Bucket `captacoes`, acesso por **signed URL de 5 min**. |
| Monitoramento | **Sentry** (`@sentry/nextjs`) configurado desde o início. |
| Backup | Estender script PowerShell existente para incluir o bucket `captacoes`. |

---

## 7. Ciclo de vida e arquivamento de arquivos

- Captação negativada/positivada **mantém a mídia** no bucket por um prazo
  (sugestão: **90 dias** — `arquivado_em`).
- **Job de limpeza/arquivamento** (cron Vercel) após o prazo move os arquivos
  para storage frio. Opções, em ordem de simplicidade:
  1. Backup já existente no Google Drive Desktop (mais simples).
  2. Bucket `captacoes-arquivo` separado.
  3. Cloudflare R2 / Backblaze B2 (egress barato) para arquivo real.
- O **registro/metadados no banco é sempre preservado**; só a mídia migra.
- Daily backup do Supabase Pro cobre o **banco** (inclui o schema novo);
  o **Storage não** — por isso o backup externo do bucket é obrigatório.

---

## 8. Modelo de dados (esboço — schema `captacoes`)

```sql
-- enum de status / coluna do kanban
create type captacoes.status as enum (
  'aguardando_informacoes','novas','em_decisao',
  'pendente_negativa','negativada',
  'pendente_agendar_visita','pendente_agendar_gravacao'
);

create table captacoes.captacao (
  id                 uuid primary key default gen_random_uuid(),
  status             captacoes.status not null default 'aguardando_informacoes',
  ordem              numeric not null default 0,           -- fractional indexing (sem reindexar)

  endereco           text not null,
  quartos            smallint,
  banheiros          smallint,
  tipo_portaria      text,
  contato_proprietario text,
  observacoes        text,
  pendencias         text,                                 -- "aguardando informações"

  decisao            text check (decisao in ('aprovada','reprovada')),
  decisao_autor      uuid references auth.users(id),
  decisao_em         timestamptz,

  visita_concluida   boolean not null default false,
  visita_data        date,
  gravacao_concluida boolean not null default false,
  gravacao_data      date,

  arquivado_em       timestamptz,                          -- ciclo de vida da mídia (90 dias)
  excluido_em        timestamptz,                          -- soft-delete (preserva auditoria)

  criado_por         uuid references auth.users(id),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- mantém atualizado_em em cada update
create or replace function captacoes.set_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;
create trigger trg_captacao_atualizado_em
  before update on captacoes.captacao
  for each row execute function captacoes.set_atualizado_em();

-- índices de leitura do board e do cron de arquivamento
create index idx_captacao_status_ordem on captacoes.captacao (status, ordem)
  where excluido_em is null;
create index idx_captacao_arquivar on captacoes.captacao (arquivado_em)
  where arquivado_em is not null;

create table captacoes.midia (
  id           uuid primary key default gen_random_uuid(),
  captacao_id  uuid not null references captacoes.captacao(id) on delete cascade,
  tipo         text not null check (tipo in ('foto','video')),
  storage_path text,        -- foto no bucket
  thumb_path   text,        -- thumbnail no bucket
  url_externa  text,        -- vídeo (YouTube/Drive)
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now()
);
create index idx_midia_captacao on captacoes.midia (captacao_id);

create table captacoes.documento (
  id            uuid primary key default gen_random_uuid(),
  captacao_id   uuid not null references captacoes.captacao(id) on delete cascade,
  storage_path  text not null,
  nome_original text,
  mime_type     text,
  tamanho_bytes bigint,
  criado_em     timestamptz not null default now()
);
create index idx_documento_captacao on captacoes.documento (captacao_id);

create table captacoes.historico (
  id          uuid primary key default gen_random_uuid(),
  captacao_id uuid not null references captacoes.captacao(id) on delete cascade,
  de_status   captacoes.status,
  para_status captacoes.status,
  autor       uuid references auth.users(id),
  criado_em   timestamptz not null default now()
);
create index idx_historico_captacao on captacoes.historico (captacao_id);
```

> RLS: liberar leitura/escrita a qualquer usuário autenticado (todos têm acesso).

> **Movimentação atômica:** a troca de coluna (status + ordem + registro no
> `historico`, e na decisão também `decisao`/`decisao_autor`/`decisao_em`) deve
> rodar numa única função RPC `captacoes.mover_cartao(...)` para garantir
> atomicidade.

---

## 9. Estrutura de pastas sugerida

```
morabilidade-captacoes/                  # repositório GitHub novo
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── board/page.tsx                # quadro Kanban
│   │   ├── captacao/[id]/page.tsx        # detalhe do cartão
│   │   └── api/
│   │       ├── captacoes/route.ts        # CRUD
│   │       ├── captacoes/[id]/mover/route.ts
│   │       ├── upload/sign/route.ts      # gera signed upload URL (cliente sobe direto)
│   │       └── documentos/[id]/url/route.ts   # signed URL (download)
│   ├── components/
│   │   ├── kanban/                       # Board, Column, Card (@dnd-kit)
│   │   ├── captacao/                     # form, galeria, agendamento, pendencias, docs
│   │   └── ui/                           # shadcn (copiado do web/)
│   ├── lib/
│   │   ├── supabase/                     # client + admin
│   │   ├── image.ts                      # compressão/resize no cliente (grande + thumb, WebP)
│   │   ├── storage.ts                    # upload direto, signed url
│   │   └── schemas.ts                    # zod
│   ├── stores/                           # zustand (estado do board)
│   └── types/
├── sentry.client.config.ts               # monitoramento de erros
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── src/app/globals.css                   # tokens 60/30/10
├── supabase/migrations/                  # schema captacoes + RLS
├── scripts/backup-captacoes.ps1          # backup do bucket
├── .env.local.example
├── package.json
└── README.md
```

---

## 10. Decisões resolvidas

1. ~~Notificações~~ → **Resolvido:** fora do escopo inicial (fase futura).
2. ~~Quem pode aprovar/reprovar~~ → **Resolvido:** sem diferença de permissões num
   primeiro momento. Todos os usuários têm acesso e a decisão é livre.
3. ~~Conversão para imóvel~~ → **Resolvido:** num primeiro momento é **manual**.
   Ao positivar, o cadastro do imóvel no sistema principal é feito à mão
   (integração automática fica para uma fase futura).
4. ~~Prazo de retenção de mídia~~ → **Resolvido: 90 dias** (`arquivado_em`).
5. ~~Sentry~~ → **Resolvido: sim, desde o início** (`@sentry/nextjs`).
6. ~~Domínio~~ → **Resolvido: `captacoes.morabilidade.com`** (subdomínio via CNAME
   `cname.vercel-dns.com`), reaproveitando a autenticação do Morabilidade.
7. ~~Movimentação no Kanban~~ → **Resolvido: livre**, sem validação de transição.
8. ~~Ordenação~~ → **Resolvido: `ordem numeric`** (fractional indexing).
9. ~~Processamento de imagem~~ → **Resolvido:** compressão/resize **no cliente**
   (grande ~1600px + thumb ~400px, WebP) + **upload direto** ao Storage via signed
   upload URL. Sem `sharp` no servidor.

---

## 11. Próximos passos

1. Validar este documento.
2. Criar o repositório GitHub.
3. Gerar migrations (schema `captacoes` + RLS) e scaffolding Next.js.
4. Implementar board, cartão e uploads.
5. Configurar backup do bucket e deploy na Vercel.
