import { supabase } from '@/services/supabase'
import type { EstoqueAlteracao } from '@/types'

export type NovaAlteracao = Omit<EstoqueAlteracao, 'id' | 'created_at'>

export async function listarAlteracoes(limit = 50): Promise<EstoqueAlteracao[]> {
  const { data, error } = await supabase
    .from('estoque_alteracoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as EstoqueAlteracao[]
}

export async function registrarAlteracao(
  payload: NovaAlteracao,
): Promise<EstoqueAlteracao> {
  const { data, error } = await supabase
    .from('estoque_alteracoes')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return data as EstoqueAlteracao
}
