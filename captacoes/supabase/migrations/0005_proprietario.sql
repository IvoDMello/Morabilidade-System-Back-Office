-- =====================================================================
-- Dados do proprietário: nome + WhatsApp (clicável via wa.me).
-- Mantém o campo legado contato_proprietario para registros antigos.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists proprietario_nome text,
  add column if not exists whatsapp text;            -- guardado só com dígitos
