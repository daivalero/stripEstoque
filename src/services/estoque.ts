import { avisarMudancaNoHistorico } from '@/services/historicoEventos'
import { supabase } from '@/services/supabase'
import { comoMaterial, termosDeBusca } from '@/utils/estoque'
import type { EstoqueImportacao, EstoqueItem, EstoqueItemInput } from '@/types'

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

/** Todas as linhas do estoque importado (pagina de 1000 em 1000). */
export async function listarTodosItens(importacaoId: string): Promise<EstoqueItem[]> {
  const itens: EstoqueItem[] = []
  const tamanho = 1000

  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacaoId)
      .order('item', { ascending: true })
      .range(inicio, inicio + tamanho - 1)

    if (error) throw new Error(mensagemErro(error))
    itens.push(...((data ?? []) as EstoqueItem[]))
    if (!data || data.length < tamanho) break
  }

  return itens
}

export interface OpcoesDeEscolha {
  fam_com: string[]
  localizacao: string[]
  superficie: string[]
}

let opcoesEmCache: { importacaoId: string; opcoes: OpcoesDeEscolha } | null = null

/** Famílias, localizações e superfícies que existem no estoque importado (para as listas de escolha). */
export async function listarOpcoesDeEscolha(): Promise<OpcoesDeEscolha> {
  const importacao = await buscarImportacaoAtiva()
  if (!importacao) return { fam_com: [], localizacao: [], superficie: [] }
  if (opcoesEmCache?.importacaoId === importacao.id) return opcoesEmCache.opcoes

  const conjuntos = {
    fam_com: new Set<string>(),
    localizacao: new Set<string>(),
    superficie: new Set<string>(),
  }
  const tamanho = 1000
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('fam_com, localizacao, superficie')
      .eq('importacao_id', importacao.id)
      .range(inicio, inicio + tamanho - 1)

    if (error) throw new Error(mensagemErro(error))
    for (const linha of data ?? []) {
      for (const chave of ['fam_com', 'localizacao', 'superficie'] as const) {
        const bruto = (linha[chave] as string | null)?.trim()
        const valor = chave === 'localizacao' ? bruto?.toUpperCase() : bruto
        if (valor && valor !== 'NÃO ENCONTRADO') conjuntos[chave].add(valor)
      }
    }
    if (!data || data.length < tamanho) break
  }

  const ordenar = (conjunto: Set<string>) =>
    [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  const opcoes = {
    fam_com: ordenar(conjuntos.fam_com),
    localizacao: ordenar(conjuntos.localizacao),
    superficie: ordenar(conjuntos.superficie),
  }
  opcoesEmCache = { importacaoId: importacao.id, opcoes }
  return opcoes
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
): Promise<Record<string, number>> {
  const contagens: Record<string, number> = {}
  const tamanho = 1000

  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('material')
      .eq('importacao_id', importacaoId)
      .order('id', { ascending: true })
      .range(inicio, inicio + tamanho - 1)

    if (error) throw new Error(mensagemErro(error))
    for (const linha of data ?? []) {
      const material = comoMaterial(linha.material as string | null)
      contagens[material] = (contagens[material] ?? 0) + 1
    }
    if (!data || data.length < tamanho) break
  }

  return contagens
}

const MENSAGEM_MIGRACAO =
  'O banco ainda não permite editar o estoque. Rode a migração 006_editar_itens.sql no Supabase.'

/** Grava na cópia do estoque os valores corrigidos. O histórico é registrado à parte. */
export async function atualizarItem(item: EstoqueItem): Promise<void> {
  const { data, error } = await supabase
    .from('estoque_itens')
    .update({
      descricao: item.descricao,
      dep: item.dep,
      fam_com: item.fam_com,
      item: item.item,
      espessura: item.espessura,
      estab: item.estab,
      largura: item.largura,
      lote: item.lote,
      localizacao: item.localizacao,
      superficie: item.superficie,
      quantidade: item.quantidade,
      material: item.material,
    })
    .eq('id', item.id)
    .select('id')

  if (error) {
    if (error.message?.toLowerCase().includes('permission denied')) {
      throw new Error(MENSAGEM_MIGRACAO)
    }
    throw new Error('Não foi possível salvar o item.')
  }
  // Sem a regra de segurança, o banco responde "ok" sem alterar nada.
  if (!data || data.length === 0) throw new Error(MENSAGEM_MIGRACAO)
}

export async function listarImportacoes(): Promise<EstoqueImportacao[]> {
  const { data, error } = await supabase
    .from('estoque_importacoes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(mensagemErro(error))
  return (data ?? []) as EstoqueImportacao[]
}

/**
 * Apaga a cópia temporária do estoque (importações e itens).
 * O histórico de alterações (estoque_alteracoes) não é tocado.
 */
export async function apagarEstoqueTemporario(): Promise<number> {
  const importacoes = await listarImportacoes()
  if (importacoes.length === 0) return 0
  const ids = importacoes.map((importacao) => importacao.id)

  const { error: erroItens } = await supabase
    .from('estoque_itens')
    .delete()
    .in('importacao_id', ids)
  if (erroItens) throw new Error(mensagemApagar(erroItens))

  const { data: apagadas, error: erroImportacoes } = await supabase
    .from('estoque_importacoes')
    .delete()
    .in('id', ids)
    .select('id')
  if (erroImportacoes) throw new Error(mensagemApagar(erroImportacoes))

  // O banco não avisa quando a regra de segurança bloqueia: confere o que foi apagado.
  if ((apagadas?.length ?? 0) < ids.length) {
    throw new Error('Seu usuário não tem permissão para apagar o estoque importado.')
  }

  avisarMudancaNoHistorico()
  return ids.length
}

function mensagemApagar(error: { code?: string; message?: string }): string {
  if (error.message?.toLowerCase().includes('row-level security')) {
    return 'Seu usuário não tem permissão para apagar o estoque importado.'
  }
  return error.message || 'Não foi possível apagar o estoque importado.'
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

    avisarMudancaNoHistorico()
    return { ...criada, status: 'ativa' }
  } catch (error) {
    await supabase.from('estoque_importacoes').delete().eq('id', criada.id)
    throw error
  }
}
