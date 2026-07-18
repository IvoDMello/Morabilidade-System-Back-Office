-- 042_imovel_documentos.sql
-- Armazenagem interna de documentos do imóvel (contratos, matrícula, IPTU,
-- escritura, etc.). Espelha a estrutura de locacao_anexos (migration 016): os
-- arquivos vivem no mesmo bucket "media" do Supabase Storage, sob o prefixo
-- imoveis/{imovel_id}/documentos/. O banco guarda apenas os metadados.
--
-- Documentos são internos (uso da imobiliária), nunca expostos no site público.
-- O download usa signed URL de curta duração gerada pela API (service_role),
-- como já acontece com os anexos de locação.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS imovel_documentos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    imovel_id       uuid NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,

    tipo            text NOT NULL DEFAULT 'outro'
        CHECK (tipo IN ('contrato', 'matricula', 'iptu', 'escritura',
                        'planta', 'condominio', 'outro')),
    nome_arquivo    text NOT NULL,
    firebase_path   text NOT NULL,        -- nome legado: é o path no Supabase Storage
    tamanho_bytes   bigint,
    mime_type       text,

    uploaded_by     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imovel_documentos_imovel
    ON imovel_documentos(imovel_id);

-- RLS: liga "negado por padrão" para anon/authenticated (mesma lógica da
-- migration 039). A API acessa via service_role e ignora o RLS; o navegador
-- usa a anon key (pública) e NÃO deve ler documentos internos do imóvel.
ALTER TABLE imovel_documentos ENABLE ROW LEVEL SECURITY;
