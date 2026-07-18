-- 045_demonstrativo_admin_snapshots.sql
-- Snapshot por competência do Demonstrativo de Administração.
--
-- Motivação: o demonstrativo de administração (cobrança da taxa ao proprietário)
-- é montado a partir da carteira de contratos ATIVOS no momento da geração. Sem
-- congelar esse cálculo, uma 2ª via de um mês passado sairia diferente da 1ª
-- (imóveis entram/saem, aluguéis mudam). Aqui guardamos, por (proprietário, mês),
-- o bloco já calculado e os dados de recebimento vigentes, para que qualquer
-- reemissão daquela competência saia idêntica à original.
--
-- Congela na primeira geração; reemissões da mesma competência reusam o snapshot.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS demonstrativo_admin_snapshots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proprietario_id     uuid NOT NULL,          -- sem FK: snapshot sobrevive à exclusão do cliente
    mes_referencia      date NOT NULL,          -- primeiro dia do mês de competência
    dados               jsonb NOT NULL,         -- AdmCobrancaProprietario serializado (itens, totais, pct)
    dados_recebimento   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- conta que recebe a taxa, congelada
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT demonstrativo_admin_snapshots_unico
        UNIQUE (proprietario_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_demonstrativo_admin_snapshots_prop_mes
    ON demonstrativo_admin_snapshots(proprietario_id, mes_referencia);

-- RLS: nega por padrão para anon/authenticated (mesma lógica das migrations 039,
-- 042 e 044). A API acessa via service_role e ignora o RLS.
ALTER TABLE demonstrativo_admin_snapshots ENABLE ROW LEVEL SECURITY;
