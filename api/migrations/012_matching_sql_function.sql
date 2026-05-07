-- Migration 012: Função SQL para contagem de oportunidades (matching em banco)
--
-- Problema: resumo_oportunidades() carregava todos os imóveis e todas as
-- preferências em Python e fazia cruzamento O(n×m) na aplicação.
-- Solução: mover o cruzamento para o Postgres, que usa os índices existentes
-- (cidade_norm/bairro_norm trigram, tipo_negocio, dormitorios, valores).
--
-- Depende de: migration 009 (unaccent_immutable, colunas _norm)
--             migration 011 (índices GIN trigram e B-tree)

CREATE OR REPLACE FUNCTION contar_oportunidades()
RETURNS TABLE(total_oportunidades bigint, clientes_com_preferencia bigint)
LANGUAGE sql
STABLE
AS $$
    SELECT
        -- Contagem de pares (preferência × imóvel) que casam
        (
            SELECT COUNT(*)
            FROM cliente_preferencias cp
            CROSS JOIN imoveis i
            WHERE cp.ativa = true
              AND i.disponibilidade = 'disponivel'

              -- Tipo de negócio: pref vazia/ambos aceita tudo; imóvel "ambos" aceita tudo
              AND (
                  cp.tipo_negocio IS NULL
                  OR cp.tipo_negocio = 'ambos'
                  OR i.tipo_negocio = cp.tipo_negocio
                  OR i.tipo_negocio = 'ambos'
              )

              -- Tipo de imóvel: só filtra quando definido na preferência
              AND (
                  cp.tipo_imovel IS NULL
                  OR i.tipo_imovel = cp.tipo_imovel
              )

              -- Cidade: busca normalizada (sem acento, minúsculas) via coluna gerada
              AND (
                  cp.cidade IS NULL
                  OR trim(cp.cidade) = ''
                  OR i.cidade_norm ILIKE '%' || unaccent_immutable(lower(trim(cp.cidade))) || '%'
              )

              -- Dormitórios mínimos
              AND (
                  cp.dormitorios_min IS NULL
                  OR cp.dormitorios_min = 0
                  OR (i.dormitorios IS NOT NULL AND i.dormitorios >= cp.dormitorios_min)
              )

              -- Vagas de garagem mínimas
              AND (
                  cp.vagas_garagem_min IS NULL
                  OR cp.vagas_garagem_min = 0
                  OR (i.vagas_garagem IS NOT NULL AND i.vagas_garagem >= cp.vagas_garagem_min)
              )

              -- Imóveis de venda < R$ 2M são excluídos das oportunidades
              -- (exceção: imóvel "ambos" + pref "locacao" → usa valor_locacao, não bloquear)
              AND NOT (
                  (
                      i.tipo_negocio = 'venda'
                      OR (i.tipo_negocio = 'ambos' AND cp.tipo_negocio IS DISTINCT FROM 'locacao')
                  )
                  AND (i.valor_venda IS NULL OR i.valor_venda < 2000000)
              )

              -- Faixa de valor: escolhe valor_locacao ou valor_venda conforme contexto
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

              -- Bairros: qualquer elemento do array text[] que seja substring de bairro_norm
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

        -- Total de clientes com preferência ativa (independente de matches)
        (
            SELECT COUNT(*)
            FROM cliente_preferencias
            WHERE ativa = true
        ) AS clientes_com_preferencia;
$$;
