-- Cria apenas o histórico de alterações.
-- A tabela public.profiles já existe neste projeto.

create extension if not exists "pgcrypto";

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

-- Helpers (se ainda não existirem)
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

alter table public.estoque_alteracoes enable row level security;

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

grant select, insert on public.estoque_alteracoes to authenticated;
