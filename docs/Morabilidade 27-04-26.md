# Morabilidade — Snapshot do Projeto e Próximos Passos

_Documento gerado em 27/04/2026._
_Atualiza e substitui o `próximos_passos.md`, que estava majoritariamente concluído._

---

## 1. Estado atual — o que está consolidado

### 1.1 Backend (`api/`)
- **FastAPI 0.115 + Python 3.12** rodando em `localhost:8000`.
- **Supabase (Postgres)** como banco; **Firebase Storage** para fotos; **Resend** para e-mail; **Sentry** para monitoramento (commit `aa597c7`).
- **Routers ativos:** `auth`, `usuarios`, `imoveis`, `clientes`, `tags`, `contato`. Todos com schemas Pydantic e RBAC (`admin` x `administrativo`).
- **Endpoints públicos** para o site (`/imoveis/publico/disponiveis`, `/imoveis/publico/{codigo}`, `/contato`).
- **Rate limiting** com `slowapi` (dual-limiter, commit `59d8adc`).
- **Testes:** **97 testes passando** (auth, clientes, contato, imóveis, schemas, tags, users) com mocks em `tests/conftest.py`.
- **Migrations aplicáveis:**
  - `001_initial.sql` — schema base.
  - `002_clientes_instagram_pais.sql`.
  - `003_clientes_email_opcional.sql`.
  - `004_clientes_imovel_proprietario.sql` (nova — **precisa ser rodada no Supabase**).

### 1.2 Painel (`web/`)
- **Next.js 15 + React 19 + Tailwind + shadcn/ui** em `localhost:3000`.
- Auth via **Supabase Auth + JWT no Zustand** (`auth-store.ts`), middleware de proteção de rotas, route handlers de proxy/login/logout próprios (`/api/auth/*`, `/api/proxy/[...path]`).
- **Páginas operacionais funcionando:**
  - `/` (dashboard com cards de estatísticas)
  - `/imoveis` (listagem + filtros + criar/editar/excluir + upload de fotos)
  - `/clientes` (listagem + filtros + criar/editar/excluir; **agora com código do imóvel para proprietários e observação truncada no grid**)
  - `/perfil`, `/tags` (admin), `/usuarios` (admin)
  - `/login`, `/recuperar-senha`, `/redefinir-senha`
- **Testes web:** Vitest configurado, com `auth-store.test.ts` e `login.test.tsx`.

### 1.3 Site público (`site/`)
- **Next.js 15 + Tailwind puro** em `localhost:3001`.
- **Páginas:** Home, `/imoveis` (listagem com filtros), `/imoveis/[codigo]` (detalhe com Galeria, Schema.org, Open Graph, Google Maps), `/contato`, `/sobre`.
- **Conversão:** WhatsApp flutuante em todas as páginas, botões "Tenho Interesse" no detalhe (commits `512bae8` e `e0515ac`).
- **SEO:** sitemap dinâmico, robots, Schema.org `RealEstateListing`, Open Graph (commit `c0e62be`).
- **Branding:** Instagram @morabilidade no Navbar/Footer, depoimentos na home.
- **Vitest** instalado com suite de testes (commit `9201648`).

### 1.4 Infraestrutura e deploy
- **Railway:** API com `Dockerfile`, `railway.toml`, Firebase via env var (commits `b63fdf4`, `058eaff`, `af13c4a`).
- **Vercel:** front-ends.
- **Sentry:** API instrumentada; site também (commit `aa597c7`).
- **CI/CD:** workflows existem para testes do site (commit `59d8adc`).

---

## 2. Roadmap anterior (`próximos_passos.md`) — status

| # | Item | Status |
|---|---|---|
| P0-1 | Commitar `site/next.config.ts` | concluído |
| P0-2 | WhatsApp flutuante no site | concluído (`512bae8`) |
| P0-3 | Instagram no Navbar/Footer | concluído (`8ed30fa`) |
| P0-4 | "Tenho Interesse" no detalhe do imóvel | concluído (`e0515ac`) |
| P0-5 | Página `/sobre` profissional | concluído (`3b6d4b5`) |
| P1-6 | SEO técnico (sitemap, robots, Schema.org, OG) | concluído (`c0e62be`) |
| P1-7 | Depoimentos na home | concluído (`b7109f0`) |
| P1-8 | Google Maps no detalhe | concluído (`3a288a2`) |
| P1-9 | Sentry na API e no site | concluído (`aa597c7`) |
| P2-10 | Export CSV (imóveis e clientes) | **pendente** |
| P2-11 | Templates HTML de e-mail com branding | **pendente** |
| P2-12 | Gráficos no dashboard (Recharts) | **pendente** |
| P2-13 | Rate limiting nas rotas públicas (60 req/min/IP) | parcial — `slowapi` instalado, **falta aplicar nas rotas públicas** |
| P3-14 | Módulo Match imóvel × cliente | **pendente** |

---

## 3. Próximos passos sugeridos

Ordenados por impacto operacional / esforço.

### 3.1 P0 imediato (até esta semana)

1. **Rodar a migration `004` no Supabase.** A coluna `imovel_codigo` ainda não existe em produção — sem isso, listar/cadastrar cliente vai quebrar.
2. **Commitar e fazer push** das mudanças pendentes (clientes — código do imóvel + observação no grid).
3. **Atualizar/remover o `próximos_passos.md`** ou redirecionar para este documento, evitando ambiguidade sobre o que é "o plano atual".
4. **Renomear ou descrever melhor o último commit `ff38966 .`** — mensagens vazias dificultam recuperar contexto depois.

### 3.2 Operacional do back-office (P1 novo)

5. **Export CSV** de imóveis e clientes (P2-10 herdado). Essencial para a equipe levar dados para fora do sistema (relatórios, repasse para parceiros).
6. **Templates HTML de e-mail** para `/contato` e notificação interna de novo lead (P2-11). Hoje o e-mail provavelmente é texto cru — perde profissionalismo.
7. **Gráficos no dashboard** (P2-12): origem de leads (pizza) e status de clientes (barras) com Recharts.
8. **Rate limiting nas rotas públicas** (P2-13): finalizar a aplicação do `slowapi` em `/imoveis/publico/*` e `/contato` para conter abuso vindo da internet.

### 3.3 Conversão e SEO (incremental)

9. **Captação de lead via Instagram** (origem dominante): rever o formulário/landing para uso direto a partir do bio link e medir conversão por origem (`origem_lead`).
10. **Otimização de imagens**: garantir que `next/image` está com `sizes` correto na listagem; verificar peso real das fotos no Storage (a compressão Pillow já existe em `services/storage.py`).
11. **Tags filtráveis no site público:** hoje as tags aparecem no card mas não filtram. Acrescentar filtro pode ajudar a destacar oportunidades.
12. **Sitemap por bairro/cidade** para SEO local — Morabilidade opera por demanda regional; um sitemap segmentado pode ajudar.

### 3.4 Grande feature (P2 novo)

13. **Módulo Match imóvel × cliente** (P3-14 herdado). Pré-requisitos sugeridos antes de atacar:
    - Definir se preferências serão **estruturadas** (faixa de preço, dormitórios, etc.) ou **livres** (campo de texto + IA).
    - Criar tabela `cliente_preferencias` (1:N com clientes).
    - Job em background (FastAPI `BackgroundTasks` ou cron) para gerar matches ao publicar imóvel.
    - Notificação por Resend usando templates do item 6.
    - Aba "Matches" no detalhe do cliente.

### 3.5 Qualidade, DX e segurança

14. **Subir cobertura de testes do painel:** hoje só `auth-store` e `login` têm testes. Cobrir cliente-form, imovel-form e fluxos de listagem cobriria onde mais nascem bugs.
15. **Documentar variáveis de ambiente de produção** num arquivo separado (não no README) — o `.env.example` cobre dev mas não distingue prod.
16. **Auditoria de RLS no Supabase:** o RLS está ativado mas a API usa `service_role` que faz bypass. Confirmar quais policies estão valendo e se algum cliente direto (ex: front no futuro) corre risco.
17. **Plano de backup do banco** (Supabase oferece backups; documentar a janela e como restaurar).
18. **Checklist de pré-deploy** (lint, testes, migrations pendentes, smoke test) — útil para consolidar a rotina.

---

## 4. Pontos de atenção

- **`Pendencias_Sistema_imobiliario.docx`** está na raiz mas é um Word — fora do versionamento útil. Sugiro converter para `.md` ou descontinuar; do contrário, o conteúdo fica fora do alcance de quem lê o repo.
- **`requisitos_sistema_imobiliario_v1.2.docx`**: mesmo ponto — vale exportar a parte ainda relevante para Markdown.
- **Migrations não automatizadas:** rodar manualmente no SQL Editor do Supabase é frágil. Conforme o sistema cresce, vale considerar uma ferramenta (sqitch, dbmate, ou gerenciamento via Supabase CLI) e um log de "qual migration está aplicada em qual ambiente".
- **Mensagens de commit pobres** (`.`, "ajustes1.2.1") — em equipe pequena passa, mas dificulta auditar incidentes. Convém manter o padrão do tipo `feat(api): ...` que aparece em vários commits anteriores.
- **`firebase-credentials.json`** em `api/`: confirmar que está no `.gitignore` e que a versão de produção usa env var (já está para Railway).
- **CORS:** `settings.cors_origins_list` precisa incluir o domínio público de produção do site e do painel — checar antes do go-live.
- **SMTP do Supabase no plano gratuito** limita a 3 e-mails/h — considerar trocar para SMTP via Resend para "esqueci a senha" (já documentado no README seção 7).
- **Sentry sample rate** está em 0.1 (10%) — adequado para começar; revisar custo após 1 mês de produção.

---

## 5. Sugestão de prioridade para as próximas 2 semanas

| Semana | Foco |
|---|---|
| Esta semana | Migration 004 no Supabase + commit/push + export CSV de clientes |
| Próxima | Export CSV imóveis + templates de e-mail + rate limit nas rotas públicas |
| Em seguida | Gráficos no dashboard + cobertura de testes do painel |
| Depois | Iniciar módulo Match (especificação primeiro, código depois) |

---

_Para alterações estruturais, atualizar este documento em vez de criar um novo `próximos_passos.md`._
