import { supabase } from '@/services/supabase'
import type { EstoqueImportacao, EstoqueItem, MaterialTipo } from '@/types'

export const TAMANHO_PAGINA = 30

export interface FiltrosEstoque {
  importacaoId: string
  busca: string
  material: MaterialTipo | 'todos'
  pagina: number
}

export interface PaginaEstoque {
  itens: EstoqueItem[]
  total: number
}

const COLUNAS_BUSCA = ['item', 'lote', 'descricao', 'localizacao', 'familia_comercial'] as const

/** Escapa curingas do LIKE e aspas para uso dentro de um valor entre aspas do PostgREST. */
function padraoBusca(termo: string): string {
  const escapado = termo
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/"/g, '\\"')
  return `"%${escapado}%"`
}

export async function buscarImportacaoAtiva(): Promise<EstoqueImportacao | null> {
  const { data, error } = await supabase
    .from('estoque_importacoes')
    .select('*')
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as EstoqueImportacao | null) ?? null
}

export async function listarImportacoes(limite = 5): Promise<EstoqueImportacao[]> {
  const { data, error } = await supabase
    .from('estoque_importacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error
  return (data ?? []) as EstoqueImportacao[]
}

export async function listarEstoque(filtros: FiltrosEstoque): Promise<PaginaEstoque> {
  const { importacaoId, busca, material, pagina } = filtros

  let consulta = supabase
    .from('estoque_itens')
    .select('*', { count: 'exact' })
    .eq('importacao_id', importacaoId)

  if (material !== 'todos') consulta = consulta.eq('material', material)

  const termos = busca.trim().split(/\s+/).filter(Boolean).slice(0, 5)
  for (const termo of termos) {
    const padrao = padraoBusca(termo)
    consulta = consulta.or(COLUNAS_BUSCA.map((coluna) => `${coluna}.ilike.${padrao}`).join(','))
  }

  const inicio = pagina * TAMANHO_PAGINA
  const { data, error, count } = await consulta
    .order('localizacao', { ascending: true, nullsFirst: false })
    .order('item', { ascending: true })
    .order('lote', { ascending: true })
    .range(inicio, inicio + TAMANHO_PAGINA - 1)

  if (error) throw error
  return { itens: (data ?? []) as EstoqueItem[], total: count ?? 0 }
}

export async function buscarItem(id: string): Promise<EstoqueItem | null> {
  const { data, error } = await supabase
    .from('estoque_itens')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as EstoqueItem | null) ?? null
}

export async function contarPorMaterial(
  importacaoId: string,
): Promise<Record<MaterialTipo, number>> {
  const tipos: MaterialTipo[] = ['1070_temperado', '1070_sem_temperado', 'inox', 'outro']

  const contagens = await Promise.all(
    tipos.map(async (tipo) => {
      const { count, error } = await supabase
        .from('estoque_itens')
        .select('id', { count: 'exact', head: true })
        .eq('importacao_id', importacaoId)
        .eq('material', tipo)

      if (error) throw error
      return [tipo, count ?? 0] as const
    }),
  )

  return Object.fromEntries(contagens) as Record<MaterialTipo, number>
}
