-- Permite corrigir os dados da cópia do estoque (nunca o ERP nem a planilha original).
-- Cada correção continua registrada em estoque_alteracoes (antes -> depois).

alter table public.estoque_alteracoes
  add column if not exists item_id uuid;

create index if not exists estoque_alteracoes_item_id_idx
  on public.estoque_alteracoes (item_id);

grant update on public.estoque_itens to authenticated;

drop policy if exists "itens_update" on public.estoque_itens;
create policy "itens_update"
  on public.estoque_itens
  for update
  to authenticated
  using (true)
  with check (true);
