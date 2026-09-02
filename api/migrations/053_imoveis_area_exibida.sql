-- 053: metragem exibida do imóvel, para ordenar a listagem por ela
--
-- A metragem que o back-office mostra no card é a área útil, com a total como
-- reserva para o imóvel cadastrado só com ela (migration nenhuma: é regra de
-- tela, ver web/imoveis e `_clausula_metragem` no router). O filtro de
-- metragem já enxerga as duas colunas assim; a ordenação não conseguia, porque
-- o PostgREST só ordena por coluna, não por expressão — ordenar por
-- `area_util` jogaria para o fim da lista justamente os imóveis que aparecem
-- no card com metragem, e a ordem sairia mentindo sobre o que está na tela.
--
-- Daí a coluna gerada: o mesmo coalesce, agora ordenável e indexável. Não
-- substitui `area_util`/`area_total` — o site público ordena por área útil de
-- propósito, e os rótulos de lá dizem isso.

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS area_exibida numeric(10, 2)
    GENERATED ALWAYS AS (COALESCE(area_util, area_total)) STORED;

COMMENT ON COLUMN imoveis.area_exibida IS
  'area_util com area_total de reserva: a metragem que o card do back-office mostra. Só leitura (coluna gerada).';

CREATE INDEX IF NOT EXISTS idx_imoveis_area_exibida
    ON imoveis (area_exibida);
