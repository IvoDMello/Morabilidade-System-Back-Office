-- =====================================================================
-- Fechamento de gaps do fluxo captação → cadastro de imóvel:
--
-- 1. bairro: separado do endereço (o cadastro no back-office exige e
--    antes chegava sempre vazio, obrigando a redigitar).
-- 2. andar: relevante para o negócio (ex.: apartamento térreo) e existe
--    no imóvel do back-office; antes só vivia em observações.
-- 3. valor_aluguel: captações para locação não tinham onde registrar o
--    valor pedido (só havia valor_venda).
-- 4. contato_proprietario: coluna legada sem uso em formulário algum
--    (substituída por proprietario_nome + whatsapp) — removida.
-- 5. buscar_duplicadas ganha comparação por endereço normalizado:
--    duas captações do mesmo imóvel com telefones diferentes (ex.:
--    proprietário e corretor parceiro) passavam despercebidas.
-- =====================================================================

alter table captacoes.captacao
  add column if not exists bairro text,
  add column if not exists andar smallint,
  add column if not exists valor_aluguel numeric(14, 2);

alter table captacoes.captacao
  drop column if exists contato_proprietario;

-- ---------------------------------------------------------------------
-- Endereço normalizado: minúsculas e só letras/números (remove
-- pontuação, espaços e acentos comuns) para comparação tolerante a
-- "Rua X, 100" vs "rua x 100".
-- ---------------------------------------------------------------------
create or replace function captacoes.end_normalizado(p text)
returns text
language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(p, '')),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]', '', 'g')
$$;

-- Assinatura mudou (novo parâmetro): remove a antiga para não deixar
-- sobrecarga ambígua no PostgREST.
drop function if exists captacoes.buscar_duplicadas(text, text);

create or replace function captacoes.buscar_duplicadas(
  p_whatsapp    text default null,
  p_anuncio_url text default null,
  p_endereco    text default null
)
returns table (
  id          uuid,
  endereco    text,
  status      captacoes.status,
  decisao     text,
  criado_em   timestamptz,
  excluido_em timestamptz
)
language sql stable as $$
  select c.id, c.endereco, c.status, c.decisao, c.criado_em, c.excluido_em
    from captacoes.captacao c
   where (nullif(captacoes.tel_normalizado(p_whatsapp), '') is not null
          and captacoes.tel_normalizado(c.whatsapp) = captacoes.tel_normalizado(p_whatsapp))
      or (nullif(lower(trim(trailing '/' from coalesce(p_anuncio_url, ''))), '') is not null
          and lower(trim(trailing '/' from coalesce(c.anuncio_url, ''))) =
              lower(trim(trailing '/' from coalesce(p_anuncio_url, ''))))
      -- Endereço: um contido no outro (mínimo de 8 caracteres úteis para
      -- não casar termos genéricos como "rua").
      or (length(captacoes.end_normalizado(p_endereco)) >= 8
          and length(captacoes.end_normalizado(c.endereco)) >= 8
          and (captacoes.end_normalizado(c.endereco) like '%' || captacoes.end_normalizado(p_endereco) || '%'
               or captacoes.end_normalizado(p_endereco) like '%' || captacoes.end_normalizado(c.endereco) || '%'))
   order by c.criado_em desc
$$;

grant execute on function captacoes.end_normalizado(text) to authenticated, service_role;
grant execute on function captacoes.buscar_duplicadas(text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
