-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- 0025: a categoria do contato passa a ser o PAPEL dele no negócio, e só isso:
-- comprador, locatário, proprietário, investidor.
--
-- As seis anteriores misturavam papel com temperatura de funil: "Lead" e
-- "Cliente" são a mesma pessoa em momentos diferentes (o momento já é o
-- `status`), e "Outro" era o balde de quem ninguém classificou. Ver
-- constants/contact-categories.ts.
--
-- Nada se perde: quem era 'parceiro' ou 'outro' ganha uma etiqueta com o nome
-- da categoria antiga antes da conversão, e as etiquetas livres seguem
-- existindo para tudo que não é papel (Urgente, VIP, Financiamento…).

-- 1. Garante as etiquetas de resgate.
insert into tags (name, color)
select v.name, v.color
from (values
  ('Parceiro', 'pink'),
  ('Sem categoria', 'slate')
) as v(name, color)
where not exists (select 1 from tags t where lower(t.name) = lower(v.name));

-- 2. Marca os contatos afetados antes de reescrever a categoria.
insert into contact_tags (contact_id, tag_id)
select c.id, t.id
from contacts c
join tags t on lower(t.name) = 'parceiro'
where c.category = 'parceiro'
on conflict do nothing;

insert into contact_tags (contact_id, tag_id)
select c.id, t.id
from contacts c
join tags t on lower(t.name) = 'sem categoria'
where c.category = 'outro'
on conflict do nothing;

-- 3. Solta a trava antiga para poder reescrever os valores.
--
-- O check nasceu inline na coluna (0001_init.sql), então o nome foi gerado pelo
-- Postgres. Em vez de apostar em `contacts_category_check`, procura qualquer
-- check da tabela que fale de `category` e derruba — apostar no nome daria um
-- `drop if exists` silencioso seguido de um UPDATE que falha por violar a trava
-- que continuava lá.
do $$
declare
  nome text;
begin
  for nome in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'whatsapp'
      and rel.relname = 'contacts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table whatsapp.contacts drop constraint %I', nome);
  end loop;
end $$;

-- 4. Converte. 'cliente' e 'lead' são compra em momentos diferentes do funil;
--    'parceiro' e 'outro' não têm papel, e caem no padrão de quem chega sem
--    classificação (a etiqueta acima preserva de onde vieram).
update contacts
set category = case category
  when 'cliente' then 'comprador'
  when 'lead' then 'comprador'
  when 'parceiro' then 'comprador'
  when 'outro' then 'comprador'
  else category
end
where category in ('cliente', 'lead', 'parceiro', 'outro');

-- 5. Trava de novo, agora nos quatro papéis.
alter table contacts add constraint contacts_category_check
  check (category in ('comprador', 'locatario', 'proprietario', 'investidor'));
