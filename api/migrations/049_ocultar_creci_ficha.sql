-- 049_ocultar_creci_ficha.sql
-- Flag no perfil do usuário para NÃO exibir o CRECI na ficha de visita,
-- e snapshot da escolha na própria ficha (a ficha é um documento congelado:
-- mudar a flag depois não pode alterar PDFs já emitidos).

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ocultar_creci_ficha boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN usuarios.ocultar_creci_ficha IS
    'Se true, o CRECI do corretor não é exibido na ficha de visita (PDF e página de assinatura).';

ALTER TABLE fichas_visita ADD COLUMN IF NOT EXISTS ocultar_creci boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN fichas_visita.ocultar_creci IS
    'Snapshot da flag usuarios.ocultar_creci_ficha no momento da emissão da ficha.';
