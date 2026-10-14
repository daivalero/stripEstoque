-- Permite que o ADMINISTRADOR apague uma modificação do histórico (pela tela Histórico).
-- Operador e gestor continuam sem poder apagar nada.
-- Pode ser executada mais de uma vez sem problema.

grant delete on public.estoque_alteracoes to authenticated;

drop policy if exists "alteracoes_delete_admin" on public.estoque_alteracoes;
create policy "alteracoes_delete_admin"
  on public.estoque_alteracoes
  for delete
  to authenticated
  using (public.is_admin());
