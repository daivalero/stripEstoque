import { avisarMudancaNoHistorico } from '@/services/historicoEventos'
import { supabase } from '@/services/supabase'
import type { EstoqueAlteracao } from '@/types'

export type NovaAlteracao = Omit<EstoqueAlteracao, 'id' | 'created_at'>

export interface AlteracaoComUsuario extends EstoqueAlteracao {
  nome: string
}

function mensagem(error: { message?: string }): string {
  if (error.message?.includes('item_id')) {
    return 'O banco precisa da migração 006_editar_itens.sql para registrar esta alteração.'
  }
  if (error.message?.toLowerCase().includes('row-level security')) {
    return 'Seu usuário não pode registrar esta alteração.'
  }
  return 'Não foi possível salvar a alteração.'
}

export async function listarAlteracoes(limit = 80): Promise<AlteracaoComUsuario[]> {
  const { data, error } = await supabase
    .from('estoque_alteracoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Não foi possível carregar o histórico.')

  const linhas = (data ?? []) as EstoqueAlteracao[]
  const nomes = await buscarNomes(linhas.map((linha) => linha.user_id))

  return linhas.map((linha) => ({
    ...linha,
    nome: nomes.get(linha.user_id) ?? 'Usuário',
  }))
}

/** Nome de cada usuário (id -> nome) para mostrar quem fez a alteração. */
export async function buscarNomes(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)]
  const nomes = new Map<string, string>()
  if (ids.length === 0) return nomes

  const { data: perfis } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  for (const perfil of perfis ?? []) {
    nomes.set(perfil.id as string, (perfil.full_name as string) || 'Usuário')
  }
  return nomes
}
export async function registrarAlteracoes(
  payloads: NovaAlteracao[],
): Promise<void> {
  const { error } = await supabase.from('estoque_alteracoes').insert(payloads)
  if (error) throw new Error(mensagem(error))
  avisarMudancaNoHistorico()
}

