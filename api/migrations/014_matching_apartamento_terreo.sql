-- Migration 014: Suporte a "apartamento térreo" em preferências de cliente.
--
-- O HeroSearch do site público (site/src/components/home/HeroSearch.tsx)
-- oferece "Apartamento térreo" como filtro, mapeando para
-- tipo_imovel = apartamento + andar = 1. Esta migration espelha o mesmo
-- comportamento no formulário de preferências e na função de contagem
-- de oportunidades:
--   1. Aceita o valor 'apartamento_terreo' na coluna
--      cliente_preferencias.tipo_imovel.
--   2. Atualiza contar_oportunidades() para que essa preferência case com
--      imóveis cujo tipo_imovel = 'apartamento' E andar = 1.

-- 1) CHECK constraint
ALTER TABLE cliente_preferencias
    DROP CONSTRAINT IF EXISTS cliente_preferencias_tipo_imovel_check;

ALTER TABLE cliente_preferencias
    ADD CONSTRAINT cliente_preferencias_tipo_imovel_check
    CHECK (tipo_imovel IN (
        'casa','apartamento','apartamento_terreo','terreno',
        'sala','galpao','loja','cobertura','kitnet','outro'
    ));


-- 2) Re-cria a função contar_oportunidades() com o caso especial.
CREATE OR REPLACE FUNCTION contar_oportunidades()
RETURNS TABLE(total_oportunidades bigint, clientes_com_preferencia bigint)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (
            SELECT COUNT(*)
            FROM cliente_preferencias cp
            CROSS JOIN imoveis i
            WHERE cp.ativa = true
              AND i.disponibilidade = 'disponivel'

              AND (
                  cp.tipo_negocio IS NULL
                  OR cp.tipo_negocio = 'ambos'
                  OR i.tipo_negocio = cp.tipo_negocio
                  OR i.tipo_negocio = 'ambos'
              )

              -- Tipo de imóvel: 'apartamento_terreo' casa com apartamentos
              -- no andar 1 (espelha o HeroSearch). Demais tipos: igualdade exata.
              AND (
                  cp.tipo_imovel IS NULL
                  OR (
                      cp.tipo_imovel = 'apartamento_terreo'
                      AND i.tipo_imovel = 'apartamento'
                      AND i.andar = 1
                  )
                  OR (
                      cp.tipo_imovel <> 'apartamento_terreo'
                      AND i.tipo_imovel = cp.tipo_imovel
                  )
              )

              AND (
                  cp.cidade IS NULL
                  OR trim(cp.cidade) = ''
                  OR i.cidade_norm ILIKE '%' || unaccent_immutable(lower(trim(cp.cidade))) || '%'
              )

              AND (
                  cp.dormitorios_min IS NULL
                  OR cp.dormitorios_min = 0
                  OR (i.dormitorios IS NOT NULL AND i.dormitorios >= cp.dormitorios_min)
              )

              AND (
                  cp.vagas_garagem_min IS NULL
                  OR cp.vagas_garagem_min = 0
                  OR (i.vagas_garagem IS NOT NULL AND i.vagas_garagem >= cp.vagas_garagem_min)
              )

              AND NOT (
                  (
                      i.tipo_negocio = 'venda'
                      OR (i.tipo_negocio = 'ambos' AND cp.tipo_negocio IS DISTINCT FROM 'locacao')
                  )
                  AND (i.valor_venda IS NULL OR i.valor_venda < 2000000)
              )

              AND (
                  (cp.valor_min IS NULL AND cp.valor_max IS NULL)
                  OR (
                      CASE
                          WHEN i.tipo_negocio = 'locacao'
                               OR (i.tipo_negocio = 'ambos' AND cp.tipo_negocio = 'locacao')
                          THEN i.valor_locacao
                          ELSE i.valor_venda
                      END IS NOT NULL
                      AND (
                          cp.valor_min IS NULL
                          OR CASE
                                 WHEN i.tipo_negocio = 'locacao'
                                      OR (i.tipo_negocio = 'ambos' AND cp.tipo_negocio = 'locacao')
                                 THEN i.valor_locacao
                                 ELSE i.valor_venda
                             END >= cp.valor_min
                      )
                      AND (
                          cp.valor_max IS NULL
                          OR CASE
                                 WHEN i.tipo_negocio = 'locacao'
                                      OR (i.tipo_negocio = 'ambos' AND cp.tipo_negocio = 'locacao')
                                 THEN i.valor_locacao
                                 ELSE i.valor_venda
                             END <= cp.valor_max
                      )
                  )
              )

              AND (
                  cp.bairros IS NULL
                  OR cardinality(cp.bairros) = 0
                  OR EXISTS (
                      SELECT 1
                      FROM unnest(cp.bairros) AS b(bairro)
                      WHERE trim(b.bairro) != ''
                        AND i.bairro_norm ILIKE '%' || unaccent_immutable(lower(trim(b.bairro))) || '%'
                  )
              )
        ) AS total_oportunidades,

        (
            SELECT COUNT(*)
            FROM cliente_preferencias
            WHERE ativa = true
        ) AS clientes_com_preferencia;
$$;
