-- Migration 010: Notas/atividades por cliente
-- Permite registrar um histórico de interações com cada cliente.

CREATE TABLE IF NOT EXISTS cliente_notas (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id  UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conteudo    TEXT        NOT NULL CHECK (char_length(conteudo) > 0),
    autor_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    autor_nome  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_notas_cliente_id ON cliente_notas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_notas_created_at ON cliente_notas(created_at DESC);

-- RLS: apenas usuários autenticados podem ver e inserir notas
ALTER TABLE cliente_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados leem notas"
    ON cliente_notas FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuários autenticados inserem notas"
    ON cliente_notas FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Apenas o autor ou admin pode deletar"
    ON cliente_notas FOR DELETE
    TO authenticated
    USING (autor_id = auth.uid());
