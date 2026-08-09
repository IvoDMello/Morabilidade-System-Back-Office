-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Bloco Fundação: entidade "corretor". Até aqui o autor de tudo era a constante
-- fixa "Atendente" (constants/current-user.ts); agora contatos/visitas podem ter
-- um responsável de verdade, o que destrava agenda, playbooks e o "sem resposta".
--
-- auth_user_id é OPCIONAL e desacoplado do login: dá pra atribuir a um corretor
-- mesmo que ele não use o app; ligando o auth_user_id (por e-mail, num passo
-- posterior) a atribuição automática e o filtro "meus contatos" passam a valer.

create table if not exists corretores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  cor text not null default 'slate',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_corretores_nome_lower on corretores (lower(nome));
create index if not exists idx_corretores_ativo on corretores (ativo);

-- Seed idempotente dos corretores da operação (auth_user_id fica null até ligar).
insert into corretores (nome, cor)
select v.nome, v.cor
from (values ('Rodrigo', 'blue'), ('Leandro', 'emerald'), ('Ivo', 'violet')) as v(nome, cor)
where not exists (select 1 from corretores c where lower(c.nome) = lower(v.nome));

-- RLS no mesmo modelo das demais tabelas (0012): autenticado tem acesso pleno,
-- anon não enxerga nada; o servidor usa service_role (ignora RLS).
alter table corretores enable row level security;
drop policy if exists "auth full access" on corretores;
create policy "auth full access" on corretores
  for all to authenticated using (true) with check (true);
