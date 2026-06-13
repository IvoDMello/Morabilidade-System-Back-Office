-- 040_assinante_xff.sql
-- Trilha de auditoria das assinaturas eletrônicas: guarda a cadeia
-- X-Forwarded-For crua recebida no momento da assinatura.
--
-- PORQUÊ: o IP do assinante (assinante_ip) passa a ser derivado de xff[-N], onde
-- N = TRUSTED_PROXY_HOPS (2 no Railway). Guardar a cadeia inteira permite
-- re-derivar o IP real caso a topologia de proxy mude no futuro (ex.: entrar um
-- CDN), sem invalidar a prova já registrada. Não entra no hash do documento
-- (que liga o IP resolvido); é só forense.
--
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS).

ALTER TABLE fichas_visita
    ADD COLUMN IF NOT EXISTS assinante_xff text;

ALTER TABLE autorizacao_signatarios
    ADD COLUMN IF NOT EXISTS assinante_xff text;

-- Espelho legado do signatário principal na autorização (ver router autorizacoes).
ALTER TABLE autorizacoes_intermediacao
    ADD COLUMN IF NOT EXISTS assinante_xff text;

COMMENT ON COLUMN fichas_visita.assinante_xff IS
    'Cadeia X-Forwarded-For crua no momento da assinatura (forense). assinante_ip = xff[-TRUSTED_PROXY_HOPS].';
COMMENT ON COLUMN autorizacao_signatarios.assinante_xff IS
    'Cadeia X-Forwarded-For crua no momento da assinatura (forense). assinante_ip = xff[-TRUSTED_PROXY_HOPS].';
