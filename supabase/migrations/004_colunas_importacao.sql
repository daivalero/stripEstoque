-- A tabela já existia sem estas colunas, então o CREATE anterior não as adicionou.

alter table public.estoque_importacoes
  add column if not exists arquivo text;

alter table public.estoque_itens
  add column if not exists fam_com text;

grant select, insert, update, delete on public.estoque_importacoes to authenticated;
grant select, insert, delete on public.estoque_itens to authenticated;
