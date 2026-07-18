# Migration 020: Setup do Acompanhamento de Imóveis

## 1. Rodar SQL no Supabase

Abra **Supabase → SQL Editor** e execute o conteúdo de
[020_imovel_acompanhamento.sql](./020_imovel_acompanhamento.sql).

Cria duas tabelas (`imovel_visitas`, `imovel_percepcoes`) e adiciona a coluna
`imoveis.relatorio_30dias_enviado_em`.

## 2. Variável de ambiente no Railway

Adicione em **Railway → API service → Variables**:

```
CRON_TOKEN=<gerar token aleatório longo, ex: openssl rand -hex 32>
```

Sem essa variável o endpoint `/imoveis/internal/jobs/relatorio-30dias`
fica permanentemente inacessível (retorna 403). Isso é proposital, é a
proteção do job.

## 3. Configurar o cron no Railway

No Railway, crie um **novo serviço do tipo Cron** (ou use um cron externo
como cron-job.org / EasyCron apontando pra API). Comando 1×/dia:

```bash
curl -X POST \
  -H "X-Cron-Token: $CRON_TOKEN" \
  https://api.morabilidade.com.br/imoveis/internal/jobs/relatorio-30dias
```

Schedule sugerido: `0 9 * * *` (todo dia às 9h UTC ≈ 6h BRT).

A resposta vem em JSON:
```json
{"candidatos": 2, "enviados": 2, "erros": []}
```

## 4. Testar manualmente

Para validar antes de esperar o cron:

```bash
curl -X POST \
  -H "X-Cron-Token: SEU_TOKEN_AQUI" \
  https://api.morabilidade.com.br/imoveis/internal/jobs/relatorio-30dias
```

O e-mail vai para `ivompb2000@gmail.com` (configurado em
[imovel_acompanhamento.py](../app/routers/imovel_acompanhamento.py),
constante `RELATORIO_30_DESTINATARIOS`). Quando Rodrigo aprovar o formato,
adicionar o e-mail dele na lista.
