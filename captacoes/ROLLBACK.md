# Rollback do app de Captações

Ponto de retorno da **v1** (Kanban por colunas de status + raia "Pauta de
gravação"), congelado antes da reformulação de `captacoes.morabilidade.com`.

- **Tag git:** `captacoes-v1-pre-redesign` → commit `8ebe66a`
- **Estado do banco na tag:** migrations `0001` … `0020_share_token.sql`
- **Storage:** bucket `captacoes`
- **Baseline verificado na tag:** `npm run typecheck` limpo e `npm test` com
  160 testes passando (10 arquivos).

---

## 1. Voltar o que está no ar (mais rápido, sem git)

O app é servido pela Vercel, que guarda todos os deploys anteriores:

1. Vercel → projeto de captações → **Deployments**
2. Localizar o deploy do commit `8ebe66a` ("pauta de gravação passa a ser a
   primeira raia do quadro")
3. **⋯ → Promote to Production** (rollback instantâneo, sem rebuild)

Isso resolve qualquer problema **de código**. Se o redesign tiver mexido no
banco, ler a seção 3 antes.

## 2. Voltar o código no repositório

```bash
git fetch --all --tags

# inspecionar a v1 sem mexer em nada
git checkout captacoes-v1-pre-redesign

# desfazer a reformulação preservando histórico (recomendado)
git checkout main
git revert --no-commit <primeiro-commit-do-redesign>..HEAD
git commit -m "revert(captacoes): volta ao quadro v1"

# ou restaurar só a pasta do app, deixando o resto do monorepo intacto
git checkout main
git checkout captacoes-v1-pre-redesign -- captacoes/
git commit -m "revert(captacoes): restaura app da tag captacoes-v1-pre-redesign"
```

Nunca usar `git reset --hard` + `push --force` em `main`: outros apps
(`web/`, `site/`, `whatsapp/`, `api/`) vivem no mesmo repositório.

## 3. Banco de dados

O código da v1 **só enxerga** o schema até a migration `0020`. As migrations do
redesign são `0021_listas.sql`, `0022_retorno_negativa.sql` e
`0023_agendamento_google.sql`, e foram escritas de forma **aditiva e
retrocompatível**:

- adicionar tabelas e colunas novas, nunca renomear/derrubar as existentes;
- valores novos no enum `captacoes.status` são adicionados, nunca removidos
  (Postgres não permite remover valor de enum);
- se um status virar "lista", manter a coluna `status` populada durante a
  transição, para que a v1 continue funcionando se voltar ao ar.

Como isso foi seguido, o rollback de código **não exige** rollback de banco: as
tabelas `lista` e `captacao_lista` e as colunas novas da `captacao` ficam
órfãs, sem quebrar a v1. O que se perde ao voltar são as informações que só a
v2 coleta — listas, motivo da reprovação, responsável e prazo do retorno, e a
hora dos agendamentos —, que continuam gravadas e voltam a aparecer se a v2
subir de novo.

Se ainda assim for preciso voltar o banco:

- **Supabase Pro — daily backup:** Dashboard → Database → Backups → restaurar o
  dia anterior ao deploy. Atenção: restaura o **projeto inteiro**, incluindo os
  schemas dos outros apps (`public`, `whatsapp`). Só usar em último caso.
- **PITR:** não contratado. Não há restauração pontual.
- Preferir sempre uma migration de correção (`down`) escrita à mão sobre o
  restore completo.

## 4. Storage (fotos e documentos)

O daily backup do Supabase cobre o **banco**, não o Storage. Antes de qualquer
migração que mexa em caminhos de arquivo, rodar:

```powershell
./captacoes/scripts/backup-captacoes.ps1 -Destino "G:\Meu Drive\Backups\captacoes"
```

## 5. Checklist antes de subir a reformulação

- [ ] Backup do bucket `captacoes` rodado no dia
- [ ] Migrations `0021`, `0022` e `0023` aplicadas no Supabase, **nesta ordem**
- [ ] `supabase/conferencia-v2.sql` rodado antes e depois: a soma por status bate
      e a consulta 3 (captação sem lista) devolve zero linhas
- [ ] `GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN` na Vercel (sem elas o
      agendamento funciona, mas não espelha na Agenda)
- [ ] `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` limpos
- [ ] Deploy da v1 identificado na Vercel para o *promote* de emergência
