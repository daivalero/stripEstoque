-- Inventário que vale para os próximos estoques importados.
-- Cada item conferido (está aqui / não está / movido) fica salvo no banco, com quem conferiu, dia e hora.
-- Assim, quando um estoque novo for importado, o que já foi conferido continua aparecendo como conferido.
-- Pode ser executada mais de uma vez sem problema.

create table if not exists public.inventario_conferencias (
  id uuid primary key default gen_random_uuid(),
  -- ITEM|LOTE em maiúsculas: liga o mesmo item entre estoques importados diferentes
  chave text not null unique,
  item text not null,
  lote text,
  -- onde o item foi conferido (ou onde estava no ERP, quando não foi encontrado)
  localizacao text,
  status text not null check (status in ('ok', 'ausente', 'movido')),
  user_id uuid not null references public.profiles (id) on delete restrict,
  conferido_em timestamptz not null default now()
);

create index if not exists inventario_conferencias_localizacao_idx
  on public.inventario_conferencias (localizacao);

create index if not exists inventario_conferencias_conferido_em_idx
  on public.inventario_conferencias (conferido_em desc);

alter table public.inventario_conferencias enable row level security;

drop policy if exists "conferencias_select" on public.inventario_conferencias;
create policy "conferencias_select"
  on public.inventario_conferencias
  for select
  to authenticated
  using (true);

drop policy if exists "conferencias_insert" on public.inventario_conferencias;
create policy "conferencias_insert"
  on public.inventario_conferencias
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Qualquer pessoa pode conferir de novo um item que outra já conferiu (vira o responsável).
drop policy if exists "conferencias_update" on public.inventario_conferencias;
create policy "conferencias_update"
  on public.inventario_conferencias
  for update
  to authenticated
  using (true)
  with check (user_id = auth.uid());

-- Desfazer: quem conferiu ou o administrador.
drop policy if exists "conferencias_delete" on public.inventario_conferencias;
create policy "conferencias_delete"
  on public.inventario_conferencias
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.inventario_conferencias to authenticated;
