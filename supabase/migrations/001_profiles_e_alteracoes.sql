-- Controle de Estoque — Fase base: profiles + histórico de alterações
-- Execute no Supabase: SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum de perfil
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('operador', 'gestor', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text not null default '',
  role public.user_role not null default 'operador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- estoque_alteracoes (nunca apagar automaticamente)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_alteracoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  item text not null,
  lote text,
  material text,
  espessura numeric,
  largura numeric,
  campo_alterado text not null,
  valor_anterior text,
  valor_novo text,
  origem text not null default 'conferencia_fisica',
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists estoque_alteracoes_created_at_idx
  on public.estoque_alteracoes (created_at desc);

create index if not exists estoque_alteracoes_user_id_idx
  on public.estoque_alteracoes (user_id);

create index if not exists estoque_alteracoes_item_idx
  on public.estoque_alteracoes (item);

-- ---------------------------------------------------------------------------
-- updated_at automático em profiles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Criar profile ao cadastrar usuário no Auth
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, 'usuario'), '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'operador')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers de role (para RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_gestor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('gestor', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.estoque_alteracoes enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id or public.is_admin());

-- estoque_alteracoes
-- operador: inserir e ver as próprias
-- gestor/admin: ver todas
drop policy if exists "alteracoes_select" on public.estoque_alteracoes;
create policy "alteracoes_select"
  on public.estoque_alteracoes
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_gestor_or_admin());

drop policy if exists "alteracoes_insert" on public.estoque_alteracoes;
create policy "alteracoes_insert"
  on public.estoque_alteracoes
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Sem update/delete por padrão (histórico permanente)
-- Admin pode apagar só em casos excepcionais, se quiser descomente:
-- drop policy if exists "alteracoes_delete_admin" on public.estoque_alteracoes;
-- create policy "alteracoes_delete_admin"
--   on public.estoque_alteracoes
--   for delete
--   to authenticated
--   using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant select, insert on public.estoque_alteracoes to authenticated;
