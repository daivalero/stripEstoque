import { supabase } from '@/services/supabase'
import type { EstoqueItem } from '@/types'

export interface LocalizacaoResumo {
  localizacao: string
  total: number
}

const TAMANHO_PAGINA = 1000

function comparar(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true })
}

export async function listarLocalizacoes(importacaoId: string): Promise<LocalizacaoResumo[]> {
  const contagem = new Map<string, number>()

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('localizacao')
      .eq('importacao_id', importacaoId)
      .not('localizacao', 'is', null)
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error) throw new Error('Não foi possível carregar as localizações.')

    for (const linha of data ?? []) {
      const local = (linha.localizacao as string | null)?.trim()
      if (local) contagem.set(local, (contagem.get(local) ?? 0) + 1)
    }

    if (!data || data.length < TAMANHO_PAGINA) break
  }

  return [...contagem.entries()]
    .map(([localizacao, total]) => ({ localizacao, total }))
    .sort((a, b) => comparar(a.localizacao, b.localizacao))
}

export async function listarItensDaLocalizacao(
  importacaoId: string,
  localizacao: string,
): Promise<EstoqueItem[]> {
  const itens: EstoqueItem[] = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacaoId)
      .eq('localizacao', localizacao)
      .order('item', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error) throw new Error('Não foi possível carregar os itens desta localização.')

    itens.push(...((data ?? []) as EstoqueItem[]))
    if (!data || data.length < TAMANHO_PAGINA) break
  }

  return itens
}
