import { buscarNomes } from '@/services/alteracoes'
import { atualizarItem, buscarItem } from '@/services/estoque'
import { avisarMudancaNoHistorico } from '@/services/historicoEventos'
import { supabase } from '@/services/supabase'
import type { EstoqueAlteracao, EstoqueItem } from '@/types'
import {
  CAMPOS,
  aplicarFormulario,
  diferencasEntre,
  formularioDe,
} from '@/utils/camposEstoque'
import { removerMarcasDoItem } from '@/hooks/useInventarioMarcas'

/** Uma modificação já feita em um item, em qualquer estoque importado antes. */
export interface Modificacao {
  id: string
  itemId: string | null
  item: string
  lote: string | null
  campo: string
  anterior: string | null
  novo: string | null
  criadoEm: string
  nome: string
  origem: string
  observacao: string | null
}

const TAMANHO_PAGINA = 1000

/** Chave que liga o mesmo item entre estoques importados diferentes (item + lote). */
export function chaveDoItem(item: string | null | undefined, lote: string | null | undefined): string {
  return `${(item ?? '').trim().toUpperCase()}|${(lote ?? '').trim().toUpperCase()}`
}

/** Todas as modificações do histórico, da mais nova para a mais antiga. */
export async function carregarModificacoes(): Promise<Modificacao[]> {
  const linhas: EstoqueAlteracao[] = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('estoque_alteracoes')
      .select('id, user_id, item_id, item, lote, campo_alterado, valor_anterior, valor_novo, origem, observacao, created_at')
      .order('created_at', { ascending: false })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error) throw new Error('Não foi possível carregar o histórico.')
    linhas.push(...((data ?? []) as EstoqueAlteracao[]))
    if (!data || data.length < TAMANHO_PAGINA) break
  }

  const nomes = await buscarNomes(linhas.map((linha) => linha.user_id))

  return linhas.map((linha) => ({
    id: linha.id,
    itemId: linha.item_id ?? null,
    item: linha.item,
    lote: linha.lote,
    campo: linha.campo_alterado,
    anterior: linha.valor_anterior,
    novo: linha.valor_novo,
    criadoEm: linha.created_at,
    nome: nomes.get(linha.user_id) ?? 'Usuário',
    origem: linha.origem,
    observacao: linha.observacao,
  }))
}

/** Agrupa as modificações por item + lote (cada lista da mais nova para a mais antiga). */
export function agruparPorItem(modificacoes: Modificacao[]): Map<string, Modificacao[]> {
  const mapa = new Map<string, Modificacao[]>()
  for (const modificacao of modificacoes) {
    const chave = chaveDoItem(modificacao.item, modificacao.lote)
    const lista = mapa.get(chave)
    if (lista) lista.push(modificacao)
    else mapa.set(chave, [modificacao])
  }
  return mapa
}

/** Junta os campos mudados quase no mesmo instante (uma única edição) pela mesma pessoa. */
export interface EdicaoAgrupada {
  chave: string
  criadoEm: string
  nome: string
  origem: string
  observacao: string | null
  campos: Modificacao[]
}

export function agruparEdicoes(modificacoes: Modificacao[]): EdicaoAgrupada[] {
  const edicoes: EdicaoAgrupada[] = []
  for (const modificacao of modificacoes) {
    const ultima = edicoes[edicoes.length - 1]
    const perto =
      ultima &&
      ultima.nome === modificacao.nome &&
      ultima.origem === modificacao.origem &&
      Math.abs(new Date(ultima.criadoEm).getTime() - new Date(modificacao.criadoEm).getTime()) < 8000

    if (perto && ultima) {
      ultima.campos.push(modificacao)
    } else {
      edicoes.push({
        chave: modificacao.id,
        criadoEm: modificacao.criadoEm,
        nome: modificacao.nome,
        origem: modificacao.origem,
        observacao: modificacao.observacao,
        campos: [modificacao],
      })
    }
  }
  return edicoes
}

const TAMANHO_LOTE_BUSCA = 100

/** Itens do estoque importado que têm um destes lotes. */
export async function buscarPorLotes(importacaoId: string, lotes: string[]): Promise<EstoqueItem[]> {
  const unicos = [...new Set(lotes.filter(Boolean))]
  const achados: EstoqueItem[] = []

  for (let inicio = 0; inicio < unicos.length; inicio += TAMANHO_LOTE_BUSCA) {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacaoId)
      .in('lote', unicos.slice(inicio, inicio + TAMANHO_LOTE_BUSCA))

    if (error) throw new Error('Não foi possível conferir o histórico deste local.')
    achados.push(...((data ?? []) as EstoqueItem[]))
  }

  return achados
}

/** Texto de um valor do histórico como campo do formulário (números com vírgula). */
function comoTextoDeCampo(valor: string | null, numerico: boolean): string {
  if (valor == null) return ''
  return numerico ? valor.replace('.', ',') : valor
}

/**
 * Apaga modificações do histórico e devolve cada campo ao valor que tinha antes dela, no estoque
 * importado. Se o banco não deixar apagar, o estoque volta como estava (nada fica pela metade).
 */
export async function apagarModificacoes(
  linhas: Pick<Modificacao, 'id' | 'itemId' | 'campo' | 'anterior' | 'novo'>[],
): Promise<{ apagadas: number; revertidos: number }> {
  if (linhas.length === 0) return { apagadas: 0, revertidos: 0 }

  const anteriores: EstoqueItem[] = []

  const porItem = new Map<string, typeof linhas>()
  for (const linha of linhas) {
    if (!linha.itemId) continue
    porItem.set(linha.itemId, [...(porItem.get(linha.itemId) ?? []), linha])
  }

  for (const [itemId, doItem] of porItem) {
    const atual = await buscarItem(itemId)
    if (!atual) continue

    const formulario = formularioDe(atual)
    for (const linha of doItem) {
      const campo = CAMPOS.find((definicao) => definicao.rotulo === linha.campo)
      if (!campo) continue
      formulario[campo.chave] = comoTextoDeCampo(linha.anterior, campo.tipo === 'numero')
    }

    const revertido = aplicarFormulario(atual, formulario)
    if (diferencasEntre(atual, revertido).length === 0) continue

    await atualizarItem(revertido)
    anteriores.push(atual)
  }
  const ids = linhas.map((linha) => linha.id)
  const { data, error } = await supabase.from('estoque_alteracoes').delete().in('id', ids).select('id')

  if (error || (data?.length ?? 0) !== ids.length) {
    // Não apagou: devolve o estoque como estava para não ficar diferente do histórico.
    for (const item of anteriores) await atualizarItem(item).catch(() => undefined)
    if ((data?.length ?? 0) > 0) avisarMudancaNoHistorico()
    throw new Error(
      error
        ? 'Não foi possível apagar do histórico.'
        : 'O banco não permitiu apagar. Rode a migração 008_apagar_historico.sql no Supabase (somente administrador apaga).',
    )
  }

  for (const linha of linhas) {
    if (linha.itemId) removerMarcasDoItem(linha.itemId)
  }
  avisarMudancaNoHistorico()
  return { apagadas: ids.length, revertidos: anteriores.length }
}
