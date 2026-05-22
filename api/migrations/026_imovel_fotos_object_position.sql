-- Migration 026: ponto focal das fotos de imovel.
--
-- O site usa object-fit: cover em cards/galerias. Esta coluna guarda o
-- object-position escolhido no painel (ex: "50% 30%") para preservar o assunto
-- principal da foto quando houver corte.

ALTER TABLE imovel_fotos
  ADD COLUMN IF NOT EXISTS object_position text NOT NULL DEFAULT '50% 50%';

ALTER TABLE imovel_fotos
  DROP CONSTRAINT IF EXISTS imovel_fotos_object_position_check;

ALTER TABLE imovel_fotos
  ADD CONSTRAINT imovel_fotos_object_position_check
  CHECK (
    object_position ~ '^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)%[[:space:]]+(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)%$'
  );
