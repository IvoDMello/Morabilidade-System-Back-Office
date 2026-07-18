-- 044_configuracoes.sql
-- Tabela genérica de configurações chave/valor da imobiliária.
--
-- Motivação: o "Demonstrativo de Administração" (cobrança da taxa de adm. ao
-- proprietário) precisa imprimir os dados da conta que RECEBE a taxa, hoje a
-- conta do Rodrigo no Bradesco. Esse dado é institucional (não pertence a
-- contrato nem a cliente) e deve ser editável pelo painel sem deploy. Em vez de
-- criar uma coluna fixa, abrimos uma tabela chave→jsonb que serve para este e
-- futuros parâmetros globais.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + seed com ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS configuracoes (
    chave       text PRIMARY KEY,
    valor       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_configuracoes_updated_at ON configuracoes;
CREATE TRIGGER trg_configuracoes_updated_at
    BEFORE UPDATE ON configuracoes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed: dados de recebimento da taxa de administração (conta da Morabilidade).
-- Valores atuais reproduzem o demonstrativo da Fernanda (maio/2026).
INSERT INTO configuracoes (chave, valor)
VALUES (
    'dados_recebimento',
    jsonb_build_object(
        'titular',  'Rodrigo de Mello Pires Barbosa',
        'banco',    'Bradesco',
        'agencia',  '1745',
        'conta',    '144445-0',
        'pix',      '(21) 99274-3950'
    )
)
ON CONFLICT (chave) DO NOTHING;

-- RLS: nega por padrão para anon/authenticated (mesma lógica das migrations 039
-- e 042). A API acessa via service_role e ignora o RLS.
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
