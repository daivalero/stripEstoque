-- Controle de Estoque — Fase 2: tabelas de inventário por localização
--
-- Só cria a estrutura (a tela de inventário é da Fase 4). Idempotente e sem
-- alterar dados existentes.
-- Pré-requisito: rodar antes 003_estoque_importacoes_e_itens.sql
-- Execute no Supabase: SQL Editor -> New query -> Run

-- ---------------------------------------------------------------------------
-- inventarios — uma conferência de uma localização (ex.: P0054)
-- ---------------------------------------------------------------------------
create table if not exists public.inventarios (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid references public.estoque_importacoes (id) on delete set null,
  localizacao text not null,
  usuario_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'finalizado')),
  created_at timestamptz not null default now(),
  finalizado_em timestamptz
);

create index if not exists inventarios_localizacao_idx
  on public.inventarios (localizacao);
create index if not exists inventarios_created_at_idx
  on public.inventarios (created_at desc);

-- ---------------------------------------------------------------------------
-- inventario_itens — situação de cada item esperado na localização
-- Itens não encontrados NUNCA são excluídos: ficam como 'nao_localizado'.
-- item_id vira null se os dados temporários da importação forem apagados; os
-- campos item/lote/localizacao_esperada preservam o registro.
-- ---------------------------------------------------------------------------
create table if not exists public.inventario_itens (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios (id) on delete cascade,
  item_id uuid references public.estoque_itens (id) on delete set null,
  item text not null,
  lote text,
  localizacao_esperada text,
  quantidade_esperada numeric,
  status text not null default 'esperado'
    check (status in ('esperado', 'correto', 'divergente', 'nao_localizado')),
  localizacao_encontrada text,
  quantidade_encontrada numeric,
  conferido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inventario_itens_inventario_idx
  on public.inventario_itens (inventario_id);
create index if not exists inventario_itens_item_idx
  on public.inventario_itens (item_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.inventarios enable row level security;
alter table public.inventario_itens enable row level security;

drop policy if exists "inventarios_select" on public.inventarios;
create policy "inventarios_select"
  on public.inventarios
  for select
  to authenticated
  using (public.is_operador_or_above());

drop policy if exists "inventarios_insert" on public.inventarios;
create policy "inventarios_insert"
  on public.inventarios
  for insert
  to authenticated
  with check (public.is_operador_or_above() and usuario_id = auth.uid());

drop policy if exists "inventarios_update" on public.inventarios;
create policy "inventarios_update"
  on public.inventarios
  for update
  to authenticated
  using (public.is_operador_or_above() and (usuario_id = auth.uid() or public.is_admin()))
  with check (public.is_operador_or_above() and (usuario_id = auth.uid() or public.is_admin()));

drop policy if exists "inventarios_delete_admin" on public.inventarios;
create policy "inventarios_delete_admin"
  on public.inventarios
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "inventario_itens_select" on public.inventario_itens;
create policy "inventario_itens_select"
  on public.inventario_itens
  for select
  to authenticated
  using (public.is_operador_or_above());

drop policy if exists "inventario_itens_insert" on public.inventario_itens;
create policy "inventario_itens_insert"
  on public.inventario_itens
  for insert
  to authenticated
  with check (
    public.is_operador_or_above()
    and exists (
      select 1 from public.inventarios i
      where i.id = inventario_id and i.usuario_id = auth.uid()
    )
  );

drop policy if exists "inventario_itens_update" on public.inventario_itens;
create policy "inventario_itens_update"
  on public.inventario_itens
  for update
  to authenticated
  using (
    public.is_operador_or_above()
    and exists (
      select 1 from public.inventarios i
      where i.id = inventario_id and (i.usuario_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    public.is_operador_or_above()
    and exists (
      select 1 from public.inventarios i
      where i.id = inventario_id and (i.usuario_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "inventario_itens_delete_admin" on public.inventario_itens;
create policy "inventario_itens_delete_admin"
  on public.inventario_itens
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on table public.inventarios from anon, authenticated;
revoke all on table public.inventario_itens from anon, authenticated;

grant select, insert, update, delete on public.inventarios to authenticated;
grant select, insert, update, delete on public.inventario_itens to authenticated;
