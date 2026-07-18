-- 037_ficha_visita_crm.sql
-- Integra a Ficha de Visita ao CRM de clientes:
--
--   1. Novo valor 'ficha_visita' em clientes.origem_lead, visitante é
--      cadastrado automaticamente como cliente ao gerar a ficha (quando não
--      existe cadastro com o mesmo CPF/telefone/e-mail).
--
--   2. Coluna 'origem' em cliente_preferencias, distingue a preferência
--      cadastrada manualmente pelo corretor da inferida a partir das fichas
--      de visita assinadas. A inferência (services/cliente_da_ficha.py) só
--      cria/recalcula preferências com origem 'ficha_visita'; editar uma
--      inferida no back-office a converte em manual e congela a inferência.

ALTER TABLE clientes
    DROP CONSTRAINT IF EXISTS clientes_origem_lead_check;

ALTER TABLE clientes
    ADD CONSTRAINT clientes_origem_lead_check
    CHECK (origem_lead IN ('site', 'indicacao', 'ligacao', 'whatsapp', 'instagram', 'facebook', 'ficha_visita', 'outro'));

ALTER TABLE cliente_preferencias
    ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
        CHECK (origem IN ('manual', 'ficha_visita'));

COMMENT ON COLUMN cliente_preferencias.origem IS
    'manual = cadastrada pelo corretor; ficha_visita = inferida das fichas de visita assinadas (recalculada a cada assinatura enquanto não houver edição manual).';
