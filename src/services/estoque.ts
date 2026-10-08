import { supabase } from '@/services/supabase'
import { termosDeBusca } from '@/utils/estoque'
import type { EstoqueImportacao, EstoqueItem, EstoqueItemInput, MaterialTipo } from '@/types'

const PAGINA = 40

function mensagemErro(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST205') {
    return 'As tabelas de estoque ainda não existem. Rode o SQL da Fase 2 no Supabase.'
  }
  if (error.code === 'PGRST204' || error.code === '42703') {
    return 'Falta uma coluna na tabela. Rode o SQL 004 no Supabase e tente de novo.'
  }
  if (error.message?.toLowerCase().includes('row-level security')) {
    return 'Seu usuário não tem permissão para importar.'
  }
  return error.message || 'Não foi possível concluir a operação.'
}

export async function buscarImportacaoAtiva(): Promise<EstoqueImportacao | null> {
  const { data, error } = await supabase
    .from('estoque_importacoes')
    .select('*')
    .eq('status', 'ativa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(mensagemErro(error))
  return data as EstoqueImportacao | null
}

export async function listarItens(params: {
  importacaoId: string
  busca?: string
  pagina?: number
  material?: string
  localizacao?: string
  superficie?: string
  espessura?: number | null
  largura?: number | null
}): Promise<{ itens: EstoqueItem[]; total: number }> {
  const pagina = params.pagina ?? 0
  const inicio = pagina * PAGINA
  const fim = inicio + PAGINA - 1
  const termo = (params.busca ?? '').replace(/[%_,]/g, ' ').trim()
  const localizacao = (params.localizacao ?? '').replace(/[%_,]/g, '').trim()
  const superficie = (params.superficie ?? '').replace(/[%_,]/g, ' ').trim()

  let query = supabase
    .from('estoque_itens')
    .select('*', { count: 'exact' })
    .eq('importacao_id', params.importacaoId)
    .order('item', { ascending: true })
    .range(inicio, fim)

  if (termo) {
    query = query.or(
      `item.ilike.%${termo}%,lote.ilike.%${termo}%,localizacao.ilike.%${termo}%,descricao.ilike.%${termo}%`,
    )
  }

  if (params.material) query = query.eq('material', params.material)
  if (localizacao === '__vazio__') query = query.is('localizacao', null)
  else if (localizacao) query = query.eq('localizacao', localizacao)
  if (superficie === '__vazio__') query = query.is('superficie', null)
  else if (superficie) query = query.eq('superficie', superficie)
  if (params.espessura != null) query = query.eq('espessura', params.espessura)
  if (params.largura != null) query = query.eq('largura', params.largura)

  const { data, error, count } = await query
  if (error) throw new Error(mensagemErro(error))

  return {
    itens: (data ?? []) as EstoqueItem[],
    total: count ?? 0,
  }
}

export interface OpcoesFiltro {
  materiais: string[]
  localizacoes: string[]
  superficies: string[]
  espessuras: number[]
  larguras: number[]
}

export async function listarOpcoesFiltro(importacaoId: string): Promise<OpcoesFiltro> {
  const linhas: Pick<
    EstoqueItem,
    'material' | 'localizacao' | 'superficie' | 'espessura' | 'largura'
  >[] = []
  const tamanho = 1000

  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('material, localizacao, superficie, espessura, largura')
      .eq('importacao_id', importacaoId)
      .range(inicio, inicio + tamanho - 1)

    if (error) throw new Error(mensagemErro(error))
    linhas.push(...(data ?? []))
    if (!data || data.length < tamanho) break
  }

  const materiais = new Set<string>()
  const localizacoes = new Set<string>()
  const superficies = new Set<string>()
  const espessuras = new Set<number>()
  const larguras = new Set<number>()

  for (const linha of linhas) {
    if (linha.material) materiais.add(linha.material)
    localizacoes.add(linha.localizacao?.trim() || '__vazio__')
    superficies.add(linha.superficie?.trim() || '__vazio__')
    if (linha.espessura != null) espessuras.add(Number(linha.espessura))
    if (linha.largura != null) larguras.add(Number(linha.largura))
  }

  const texto = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true })

  return {
    materiais: [...materiais].sort(texto),
    localizacoes: [...localizacoes].sort(texto),
    superficies: [...superficies].sort(texto),
    espessuras: [...espessuras].sort((a, b) => a - b),
    larguras: [...larguras].sort((a, b) => a - b),
  }
}

export async function buscarPorCodigo(codigo: string): Promise<EstoqueItem[]> {
  const importacao = await buscarImportacaoAtiva()
  if (!importacao) return []

  const termos = termosDeBusca(codigo)
  if (termos.length === 0) return []

  const consulta = (coluna: 'item' | 'lote') =>
    supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacao.id)
      .in(coluna, termos)
      .limit(20)

  const [porItem, porLote] = await Promise.all([consulta('item'), consulta('lote')])
  if (porItem.error) throw new Error(mensagemErro(porItem.error))
  if (porLote.error) throw new Error(mensagemErro(porLote.error))

  const vistos = new Set<string>()
  const itens: EstoqueItem[] = []
  for (const linha of [...(porLote.data ?? []), ...(porItem.data ?? [])]) {
    const item = linha as EstoqueItem
    if (vistos.has(item.id)) continue
    vistos.add(item.id)
    itens.push(item)
  }
  return itens
}

export async function buscarItem(id: string): Promise<EstoqueItem | null> {
  const { data, error } = await supabase
    .from('estoque_itens')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(mensagemErro(error))
  return data as EstoqueItem | null
}

export async function contarPorMaterial(
  importacaoId: string,
): Promise<Record<MaterialTipo, number>> {
  const tipos: MaterialTipo[] = [
    '1070_temperado',
    '1070_sem_temperado',
    'inox',
    'outro',
  ]

  const contagens = await Promise.all(
    tipos.map(async (tipo) => {
      const { count, error } = await supabase
        .from('estoque_itens')
        .select('id', { count: 'exact', head: true })
        .eq('importacao_id', importacaoId)
        .eq('material', tipo)

      if (error) throw new Error(mensagemErro(error))
      return [tipo, count ?? 0] as const
    }),
  )

  return Object.fromEntries(contagens) as Record<MaterialTipo, number>
}

export async function importarEstoque(params: {
  arquivo: string
  usuarioId: string
  itens: EstoqueItemInput[]
}): Promise<EstoqueImportacao> {
  const { data: importacao, error: erroImportacao } = await supabase
    .from('estoque_importacoes')
    .insert({
      arquivo: params.arquivo,
      arquivo_nome: params.arquivo,
      usuario_id: params.usuarioId,
      status: 'arquivada',
      total_itens: params.itens.length,
    })
    .select('*')
    .single()

  if (erroImportacao || !importacao) {
    throw new Error(mensagemErro(erroImportacao ?? { message: 'sem retorno' }))
  }

  const criada = importacao as EstoqueImportacao
  const lote = 200

  try {
    for (let indice = 0; indice < params.itens.length; indice += lote) {
      const bloco = params.itens.slice(indice, indice + lote).map((item) => ({
        ...item,
        importacao_id: criada.id,
      }))

      const { error } = await supabase.from('estoque_itens').insert(bloco)
      if (error) throw new Error(mensagemErro(error))
    }

    const { error: erroArquivar } = await supabase
      .from('estoque_importacoes')
      .update({ status: 'arquivada' })
      .eq('status', 'ativa')

    if (erroArquivar) throw new Error(mensagemErro(erroArquivar))

    const { error: erroAtivar } = await supabase
      .from('estoque_importacoes')
      .update({ status: 'ativa' })
      .eq('id', criada.id)

    if (erroAtivar) throw new Error(mensagemErro(erroAtivar))

    return { ...criada, status: 'ativa' }
  } catch (error) {
    await supabase.from('estoque_importacoes').delete().eq('id', criada.id)
    throw error
  }
}
