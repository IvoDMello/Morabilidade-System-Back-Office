-- 039_rls_lockdown.sql
-- Habilita Row Level Security (RLS) nas tabelas que ainda estavam sem ele.
--
-- CONTEXTO / PORQUÊ
-- A API acessa o banco com a service_role key, que IGNORA o RLS, então ligar
-- RLS não afeta a API. O back-office no navegador usa a anon key apenas para
-- supabase.auth.* (reset de senha) e NÃO consulta estas tabelas; o site público
-- consome a API (não o Supabase direto). Todas as escritas de analytics passam
-- por endpoints /publico/* da API (service_role).
--
-- Sem RLS, porém, os grants padrão do Supabase deixam os papéis anon/authenticated
-- lerem a tabela direto pelo PostgREST com a anon key, que é PÚBLICA (vai no
-- bundle do navegador). Isto exporia contratos (dados bancários), CPF/assinaturas
-- e os próprios tokens de assinatura. As tabelas da migration 001 já tinham RLS;
-- as criadas depois (011+) não. Esta migration fecha essa lacuna.
--
-- EFEITO: RLS ligado SEM policy = "negado por padrão" para anon/authenticated.
-- Ninguém que deveria ter acesso perde acesso (a API usa service_role); só o
-- acesso direto via anon key é bloqueado. Não criamos policies de leitura porque
-- a aplicação autoriza no código (get_current_user/require_admin), não no banco.
--
-- Idempotente: ENABLE RLS em tabela já habilitada é no-op; o DO só toca em
-- tabelas que existem (robusto contra migrations aplicadas parcialmente).

DO $$
DECLARE
    t text;
    alvos text[] := ARRAY[
        'acao_audit_log',
        'autorizacao_signatarios',
        'autorizacoes_intermediacao',
        'contratos_locacao',
        'fichas_visita',
        'imovel_favoritos',
        'imovel_percepcoes',
        'imovel_shares',
        'imovel_video_clicks',
        'imovel_visitas',
        'locacao_anexos',
        'locacao_audit_log',
        'locacao_pagamentos',
        'locacao_reajustes',
        'page_views',
        'search_events'
    ];
BEGIN
    FOREACH t IN ARRAY alvos LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            RAISE NOTICE 'RLS habilitado em %', t;
        ELSE
            RAISE NOTICE 'Tabela % não existe, ignorada', t;
        END IF;
    END LOOP;
END $$;

-- VERIFICAÇÃO (rode após aplicar): toda tabela do schema public deve ter
-- rowsecurity = true. Linhas retornadas = tabelas ainda desprotegidas.
--
--   SELECT tablename
--   FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false
--   ORDER BY tablename;
