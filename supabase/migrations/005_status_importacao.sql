-- A tabela antiga não aceitava o status "arquivada".
-- O banco só pode ter uma importação "ativa" por vez.

alter table public.estoque_importacoes
  drop constraint if exists estoque_importacoes_status_check;

alter table public.estoque_importacoes
  add constraint estoque_importacoes_status_check
  check (status in ('ativa', 'arquivada'));
