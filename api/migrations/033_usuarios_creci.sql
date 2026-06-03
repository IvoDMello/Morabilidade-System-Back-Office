-- 033_usuarios_creci.sql
-- Adiciona o número CRECI do corretor ao perfil de usuário.
-- Usado para auto-preencher a ficha de visita (campo "CORRETOR RESPONSÁVEL").

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS creci text;

COMMENT ON COLUMN usuarios.creci IS
    'Número de inscrição CRECI do corretor. Exibido na ficha de visita e em documentos de intermediação.';
