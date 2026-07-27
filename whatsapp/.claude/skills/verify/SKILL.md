---
name: verify
description: Como buildar, subir e dirigir o painel-crm para verificar mudanças no app real (Next.js + Supabase, Windows).
---

# Verificar o painel-crm

## Build e servidor

```powershell
npm run build          # Next 16 + Turbopack; roda TypeScript junto (~20s)
npm start -- -p 3111   # servidor de produção em porta alternativa (deixar em background)
```

O `.env.local` já aponta para o Supabase; o seed traz contatos, conversas e
lembretes de exemplo, então as telas nunca ficam vazias.

## Dirigir a UI (headless)

Não há Playwright no projeto, mas `npx playwright` existe globalmente e o
Edge do Windows serve de navegador sem download: instale `playwright-core`
num diretório temporário (scratchpad) e use
`chromium.launch({ channel: "msedge", headless: true })`.

Fluxos que valem dirigir:

- `/` — lista de conversas; clicar em `a[href^="/?c="]` abre a thread
  (bolhas + composer). O composer é um `textarea` com placeholder.
- Tema: botão avatar (aria-label "Menu do usuário", sidebar rodapé ou
  header mobile) → item "Modo claro"/"Modo escuro". next-themes guarda em
  `localStorage.theme` e aplica classe `dark`/`light` no `<html>`.
- `/dashboard`, `/contatos`, `/contatos?view=pipeline`, `/lembretes`.
- Mobile: viewport 390×844 mostra header + bottom nav próprios.

## Pegadinhas

- Tailwind v4: classes desconhecidas somem em silêncio — depois do build,
  confira no CSS de `.next/static/chunks/*.css` se as utilities novas
  (ex.: `text-gold`, `bg-veil/6`) foram geradas.
- Os tokens de cor do tema vivem em `app/globals.css` (`:root` claro,
  `.dark` escuro) e são registrados no `@theme inline`.
