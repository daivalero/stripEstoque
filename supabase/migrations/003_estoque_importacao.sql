-- Cópia temporária do estoque importado do ERP.
-- Não apaga estoque_alteracoes.

create extension if not exists "pgcrypto";

create table if not exists public.estoque_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  usuario_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'ativa' check (status in ('ativa', 'arquivada')),
  total_itens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists estoque_importacoes_status_idx
  on public.estoque_importacoes (status, created_at desc);

create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.estoque_importacoes (id) on delete cascade,
  descricao text,
  dep text,
  fam_com text,
  item text not null,
  espessura numeric,
  estab text,
  largura numeric,
  lote text,
  localizacao text,
  superficie text,
  quantidade numeric,
  material text,
  created_at timestamptz not null default now()
);

create index if not exists estoque_itens_importacao_idx
  on public.estoque_itens (importacao_id);

create index if not exists estoque_itens_item_idx
  on public.estoque_itens (item);

create index if not exists estoque_itens_lote_idx
  on public.estoque_itens (lote);

create index if not exists estoque_itens_localizacao_idx
  on public.estoque_itens (localizacao);

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

alter table public.estoque_importacoes enable row level security;
alter table public.estoque_itens enable row level security;

drop policy if exists "importacoes_select" on public.estoque_importacoes;
create policy "importacoes_select"
  on public.estoque_importacoes
  for select
  to authenticated
  using (true);

drop policy if exists "importacoes_insert" on public.estoque_importacoes;
create policy "importacoes_insert"
  on public.estoque_importacoes
  for insert
  to authenticated
  with check (public.is_admin() and usuario_id = auth.uid());

drop policy if exists "importacoes_update" on public.estoque_importacoes;
create policy "importacoes_update"
  on public.estoque_importacoes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "importacoes_delete" on public.estoque_importacoes;
create policy "importacoes_delete"
  on public.estoque_importacoes
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "itens_select" on public.estoque_itens;
create policy "itens_select"
  on public.estoque_itens
  for select
  to authenticated
  using (true);

drop policy if exists "itens_insert" on public.estoque_itens;
create policy "itens_insert"
  on public.estoque_itens
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "itens_delete" on public.estoque_itens;
create policy "itens_delete"
  on public.estoque_itens
  for delete
  to authenticated
  using (public.is_admin());

grant select on public.estoque_importacoes to authenticated;
grant insert, update, delete on public.estoque_importacoes to authenticated;
grant select, insert, delete on public.estoque_itens to authenticated;
