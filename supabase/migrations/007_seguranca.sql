-- Fase 5 — Revisão de segurança (RLS e permissões).
-- Pode ser executada mais de uma vez sem problema.
-- Execute no Supabase: SQL Editor -> New query -> Run

-- ---------------------------------------------------------------------------
-- 1) Ninguém vira admin sozinho.
--    A política de profiles deixa cada usuário atualizar a própria linha, e isso incluía a
--    coluna "role": um operador conseguiria se promover a admin. Agora só um admin troca perfis
--    (o SQL Editor e a service role continuam livres, pois não têm auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.proteger_troca_de_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar o perfil de acesso.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_proteger_role on public.profiles;
create trigger profiles_proteger_role
  before update on public.profiles
  for each row
  execute function public.proteger_troca_de_perfil();

-- ---------------------------------------------------------------------------
-- 2) Quem cria a própria linha em profiles só pode ser "operador".
--    (Antes, se não existisse linha, o usuário podia inserir a sua já como admin.)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (auth.uid() = id and role::text = 'operador')
  );

-- ---------------------------------------------------------------------------
-- 3) Cadastro novo nunca escolhe o próprio perfil.
--    Se a função handle_new_user ainda lê o "role" dos metadados do cadastro (que o próprio
--    usuário controla), troca essa leitura por 'operador'. Se já estiver diferente, não muda nada.
-- ---------------------------------------------------------------------------
do $$
declare
  definicao text;
  ajustada text;
begin
  select pg_get_functiondef(p.oid) into definicao
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'handle_new_user'
  limit 1;

  if definicao is null then
    return;
  end if;

  ajustada := replace(
    definicao,
    'coalesce((new.raw_user_meta_data ->> ''role'')::public.user_role, ''operador'')',
    '''operador'''
  );

  if ajustada <> definicao then
    execute ajustada;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Edição do estoque: só as colunas que o app realmente corrige.
--    Ninguém consegue mover uma linha para outra importação, trocar o id etc.
-- ---------------------------------------------------------------------------
revoke update on public.estoque_itens from authenticated;
grant update (
  descricao, dep, fam_com, item, espessura, estab, largura,
  lote, localizacao, superficie, quantidade, material
) on public.estoque_itens to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Histórico à prova de adulteração: só entra registro novo, nunca muda nem apaga
--    (nem pelo app). Quem usa o SQL Editor continua podendo, em caso excepcional.
-- ---------------------------------------------------------------------------
revoke update, delete on public.estoque_alteracoes from authenticated;
grant select, insert on public.estoque_alteracoes to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Garante que o RLS está ligado em todas as tabelas do app.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.estoque_alteracoes enable row level security;
alter table public.estoque_importacoes enable row level security;
alter table public.estoque_itens enable row level security;
