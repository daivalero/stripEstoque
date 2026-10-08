-- Controle de Estoque — Fase 2: sessões de importação e itens importados do ERP
--
-- Seguro para rodar mais de uma vez (idempotente) e NÃO apaga nem altera dados
-- existentes: só cria tabelas/funções/políticas novas.
-- Pré-requisito: public.profiles (com colunas id e role) já existir.
-- Execute no Supabase: SQL Editor -> New query -> Run

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers de perfil (usados nas políticas RLS)
-- role é comparado como texto para funcionar tanto com enum quanto com text.
-- Só perfis operador/gestor/admin têm acesso ao estoque; qualquer outro valor
-- (ou usuário sem profile) fica sem acesso.
-- ---------------------------------------------------------------------------
create or replace function public.is_operador_or_above()
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
      and role::text in ('operador', 'gestor', 'admin')
  );
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
      and role::text in ('gestor', 'admin')
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
      and role::text = 'admin'
  );
$$;

revoke execute on function public.is_operador_or_above() from public, anon;
revoke execute on function public.is_gestor_or_admin() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_operador_or_above() to authenticated;
grant execute on function public.is_gestor_or_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- estoque_importacoes — sessão de importação (cópia temporária da planilha)
-- status:
--   ativa       importação em uso (só existe uma por vez)
--   substituida foi trocada por uma importação mais nova (dados preservados)
--   concluida   reservado para o fim do ciclo de conferência (fases futuras)
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  usuario_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'ativa'
    check (status in ('ativa', 'substituida', 'concluida')),
  total_itens integer not null default 0 check (total_itens >= 0),
  linhas_ignoradas integer not null default 0 check (linhas_ignoradas >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists estoque_importacoes_created_at_idx
  on public.estoque_importacoes (created_at desc);

create unique index if not exists estoque_importacoes_uma_ativa_idx
  on public.estoque_importacoes ((status))
  where status = 'ativa';

-- ---------------------------------------------------------------------------
-- estoque_itens — linhas importadas do ERP (colunas do ERP nunca são editadas)
-- As colunas *_fisica / status_conferencia / conferido_* já ficam prontas para
-- a conferência física (fase 3); a UI da fase 2 não escreve nelas.
-- ---------------------------------------------------------------------------
create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null
    references public.estoque_importacoes (id) on delete cascade,
  linha_origem integer,
  descricao text,
  dep text,
  familia_comercial text,
  item text not null,
  espessura numeric,
  estab text,
  largura numeric,
  lote text,
  localizacao text,
  superficie text,
  quantidade numeric not null,
  material text not null default 'outro'
    check (material in ('1070_temperado', '1070_sem_temperado', 'inox', 'outro')),
  localizacao_fisica text,
  quantidade_fisica numeric,
  status_conferencia text not null default 'pendente'
    check (status_conferencia in ('pendente', 'conferido', 'divergente', 'nao_localizado')),
  conferido_em timestamptz,
  conferido_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists estoque_itens_importacao_idx
  on public.estoque_itens (importacao_id);
create index if not exists estoque_itens_item_idx
  on public.estoque_itens (importacao_id, item);
create index if not exists estoque_itens_lote_idx
  on public.estoque_itens (importacao_id, lote);
create index if not exists estoque_itens_localizacao_idx
  on public.estoque_itens (importacao_id, localizacao);
create index if not exists estoque_itens_material_idx
  on public.estoque_itens (importacao_id, material);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.estoque_importacoes enable row level security;
alter table public.estoque_itens enable row level security;

-- estoque_importacoes: todos os perfis leem; só admin cria/altera/exclui
drop policy if exists "importacoes_select" on public.estoque_importacoes;
create policy "importacoes_select"
  on public.estoque_importacoes
  for select
  to authenticated
  using (public.is_operador_or_above());

drop policy if exists "importacoes_insert_admin" on public.estoque_importacoes;
create policy "importacoes_insert_admin"
  on public.estoque_importacoes
  for insert
  to authenticated
  with check (public.is_admin() and usuario_id = auth.uid());

drop policy if exists "importacoes_update_admin" on public.estoque_importacoes;
create policy "importacoes_update_admin"
  on public.estoque_importacoes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "importacoes_delete_admin" on public.estoque_importacoes;
create policy "importacoes_delete_admin"
  on public.estoque_importacoes
  for delete
  to authenticated
  using (public.is_admin());

-- estoque_itens: todos os perfis leem; só admin importa/exclui;
-- operador+ pode atualizar apenas as colunas de conferência (ver grants)
drop policy if exists "itens_select" on public.estoque_itens;
create policy "itens_select"
  on public.estoque_itens
  for select
  to authenticated
  using (public.is_operador_or_above());

drop policy if exists "itens_insert_admin" on public.estoque_itens;
create policy "itens_insert_admin"
  on public.estoque_itens
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "itens_update_conferencia" on public.estoque_itens;
create policy "itens_update_conferencia"
  on public.estoque_itens
  for update
  to authenticated
  using (public.is_operador_or_above())
  with check (
    public.is_operador_or_above()
    and (conferido_por is null or conferido_por = auth.uid())
  );

drop policy if exists "itens_delete_admin" on public.estoque_itens;
create policy "itens_delete_admin"
  on public.estoque_itens
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (o Supabase concede tudo por padrão; aqui fica só o necessário)
-- ---------------------------------------------------------------------------
revoke all on table public.estoque_importacoes from anon, authenticated;
revoke all on table public.estoque_itens from anon, authenticated;

grant select, insert, update, delete on public.estoque_importacoes to authenticated;
grant select, insert, delete on public.estoque_itens to authenticated;
grant update (
  localizacao_fisica,
  quantidade_fisica,
  status_conferencia,
  conferido_em,
  conferido_por
) on public.estoque_itens to authenticated;

-- ---------------------------------------------------------------------------
-- importar_estoque — cria a sessão e todos os itens em UMA transação.
-- Se qualquer linha falhar, nada é gravado (sem importação pela metade).
-- A importação anterior vira "substituida": os dados antigos NÃO são apagados.
-- Roda com os privilégios de quem chamou (RLS vale) e exige perfil admin.
-- ---------------------------------------------------------------------------
create or replace function public.importar_estoque(
  p_arquivo text,
  p_itens jsonb,
  p_linhas_ignoradas integer default 0
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_importacao_id uuid;
  v_total integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores podem importar estoque.'
      using errcode = '42501';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item para importar.' using errcode = '22023';
  end if;

  update public.estoque_importacoes
     set status = 'substituida'
   where status = 'ativa';

  insert into public.estoque_importacoes (arquivo_nome, usuario_id, status, linhas_ignoradas)
  values (
    coalesce(nullif(trim(p_arquivo), ''), 'planilha.xlsx'),
    auth.uid(),
    'ativa',
    greatest(coalesce(p_linhas_ignoradas, 0), 0)
  )
  returning id into v_importacao_id;

  insert into public.estoque_itens (
    importacao_id, linha_origem, descricao, dep, familia_comercial, item,
    espessura, estab, largura, lote, localizacao, superficie, quantidade, material
  )
  select
    v_importacao_id,
    x.linha,
    x.descricao,
    x.dep,
    x.familia,
    x.item,
    x.espessura,
    x.estab,
    x.largura,
    x.lote,
    nullif(upper(regexp_replace(trim(coalesce(x.localizacao, '')), '\s+', '', 'g')), ''),
    x.superficie,
    x.quantidade,
    coalesce(nullif(x.material, ''), 'outro')
  from jsonb_to_recordset(p_itens) as x(
    linha integer,
    descricao text,
    dep text,
    familia text,
    item text,
    espessura numeric,
    estab text,
    largura numeric,
    lote text,
    localizacao text,
    superficie text,
    quantidade numeric,
    material text
  );

  get diagnostics v_total = row_count;

  update public.estoque_importacoes
     set total_itens = v_total
   where id = v_importacao_id;

  return v_importacao_id;
end;
$$;

revoke execute on function public.importar_estoque(text, jsonb, integer) from public, anon;
grant execute on function public.importar_estoque(text, jsonb, integer) to authenticated;
