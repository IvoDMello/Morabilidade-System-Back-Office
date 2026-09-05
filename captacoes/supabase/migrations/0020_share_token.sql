-- =====================================================================
-- Link público de compartilhamento (WhatsApp): página /p/[token] mostra a
-- captação SEM dados sensíveis (proprietário, telefone, observações).
-- O token aleatório é a única forma de acesso; sem listagem pública.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists idx_captacao_share_token
  on captacoes.captacao (share_token);
