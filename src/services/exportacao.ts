import { buscarImportacaoAtiva } from '@/services/estoque'
import { supabase } from '@/services/supabase'
import { MATERIAL_META, type EstoqueAlteracao, type EstoqueItem } from '@/types'
import {
  CAMPOS,
  ROTULOS_NUMERICOS,
  nomeDoMaterial,
  valorPadrao,
} from '@/utils/camposEstoque'
import { comoMaterial } from '@/utils/estoque'

const TAMANHO_PAGINA = 1000

export interface ResultadoExportacao {
  arquivo: string
  ajustes: number
  registros: number
}

const ORIGENS: Record<string, string> = {
  conferencia_fisica: 'Conferência física',
  inventario: 'Inventário',
  ajuste_manual: 'Ajuste manual',
  importacao: 'Importação',
}

function origemLegivel(origem: string): string {
  return ORIGENS[origem] ?? origem
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function nomeDoArquivo(): string {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `Ajustes_Estoque_${ano}-${mes}-${dia}.xlsx`
}

function valorDaCelula(campo: string, valor: string | null): string | number | null {
  if (valor == null || valor === '') return null
  if (campo === 'Material') return nomeDoMaterial(valor)
  if (ROTULOS_NUMERICOS.has(campo)) {
    const numero = Number(valor)
    if (!Number.isNaN(numero)) return numero
  }
  return valor
}

type Celula = string | number | null

async function buscarItensErp(ajustes: Ajuste[]): Promise<Map<string, EstoqueItem>> {
  const encontrados = new Map<string, EstoqueItem>()
  const importacao = await buscarImportacaoAtiva().catch(() => null)
  if (!importacao) return encontrados

  const lotes = [...new Set(ajustes.map((ajuste) => ajuste.lote).filter(Boolean))] as string[]
  for (let i = 0; i < lotes.length; i += 80) {
    const { data } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacao.id)
      .in('lote', lotes.slice(i, i + 80))
    for (const linha of (data ?? []) as EstoqueItem[]) {
      encontrados.set(`${linha.item}|${linha.lote ?? ''}`, linha)
    }
  }

  const semLote = [
    ...new Set(ajustes.filter((ajuste) => !ajuste.lote).map((ajuste) => ajuste.item)),
  ]
  for (let i = 0; i < semLote.length; i += 80) {
    const { data } = await supabase
      .from('estoque_itens')
      .select('*')
      .eq('importacao_id', importacao.id)
      .is('lote', null)
      .in('item', semLote.slice(i, i + 80))
    for (const linha of (data ?? []) as EstoqueItem[]) {
      encontrados.set(`${linha.item}|`, linha)
    }
  }

  return encontrados
}

/** Uma linha "ANTES" e uma "DEPOIS" por item, com todos os campos lado a lado. */
function montarAntesDepois(
  ajustes: Ajuste[],
  itensErp: Map<string, EstoqueItem>,
): { cabecalho: string[]; linhas: Celula[][] } {
  const cabecalho = [
    'Situação',
    ...CAMPOS.map((campo) => campo.rotulo),
    'Campos alterados',
    'Responsável',
    'Data/Hora',
  ]

  const porItem = new Map<string, Ajuste[]>()
  for (const ajuste of ajustes) {
    const chave = `${ajuste.item}|${ajuste.lote ?? ''}`
    porItem.set(chave, [...(porItem.get(chave) ?? []), ajuste])
  }

  const linhas: Celula[][] = []
  for (const [chave, mudancas] of porItem) {
    const erp = itensErp.get(chave)
    const primeiro = mudancas[0]

    const antes: Record<string, string | null> = {}
    for (const campo of CAMPOS) {
      if (erp) {
        antes[campo.rotulo] = valorPadrao(erp, campo.chave)
      } else if (campo.chave === 'item') {
        antes[campo.rotulo] = primeiro.item
      } else if (campo.chave === 'lote') {
        antes[campo.rotulo] = primeiro.lote
      } else if (campo.chave === 'material') {
        antes[campo.rotulo] = primeiro.material
      } else if (campo.chave === 'espessura') {
        antes[campo.rotulo] = primeiro.espessura == null ? null : String(primeiro.espessura)
      } else if (campo.chave === 'largura') {
        antes[campo.rotulo] = primeiro.largura == null ? null : String(primeiro.largura)
      } else {
        antes[campo.rotulo] = null
      }
    }
    for (const mudanca of mudancas) antes[mudanca.campo] = mudanca.original

    const depois = { ...antes }
    for (const mudanca of mudancas) depois[mudanca.campo] = mudanca.corrigido

    const ultimo = mudancas.reduce((a, b) => (a.quando > b.quando ? a : b))
    const alterados = mudancas.map((mudanca) => mudanca.campo).join(', ')

    linhas.push([
      'ANTES (ERP)',
      ...CAMPOS.map((campo) => valorDaCelula(campo.rotulo, antes[campo.rotulo])),
      null,
      null,
      null,
    ])
    linhas.push([
      'DEPOIS (corrigido)',
      ...CAMPOS.map((campo) => valorDaCelula(campo.rotulo, depois[campo.rotulo])),
      alterados,
      ultimo.usuario,
      dataHora(ultimo.quando),
    ])
    linhas.push(cabecalho.map(() => null))
  }

  return { cabecalho, linhas }
}

async function buscarAlteracoes(desde?: string): Promise<EstoqueAlteracao[]> {
  const linhas: EstoqueAlteracao[] = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from('estoque_alteracoes')
      .select('*')
      .order('created_at', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (desde) consulta = consulta.gte('created_at', desde)

    const { data, error } = await consulta
    if (error) throw new Error('Não foi possível carregar as alterações para exportar.')

    linhas.push(...((data ?? []) as EstoqueAlteracao[]))
    if (!data || data.length < TAMANHO_PAGINA) break
  }

  return linhas
}

async function buscarNomes(linhas: EstoqueAlteracao[]): Promise<Map<string, string>> {
  const nomes = new Map<string, string>()
  const ids = [...new Set(linhas.map((linha) => linha.user_id))]
  if (ids.length === 0) return nomes

  const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  for (const perfil of data ?? []) {
    nomes.set(perfil.id as string, (perfil.full_name as string) || 'Usuário')
  }
  return nomes
}

interface Ajuste {
  item: string
  lote: string | null
  material: string | null
  espessura: number | null
  largura: number | null
  campo: string
  original: string | null
  corrigido: string | null
  origem: string
  usuario: string
  quando: string
  observacao: string | null
}

/** Junta as alterações do mesmo item/lote/campo: valor do ERP -> último valor registrado. */
function consolidar(linhas: EstoqueAlteracao[], nomes: Map<string, string>): Ajuste[] {
  const porChave = new Map<string, Ajuste>()

  for (const linha of linhas) {
    const chave = `${linha.item}|${linha.lote ?? ''}|${linha.campo_alterado}`
    const existente = porChave.get(chave)

    if (!existente) {
      porChave.set(chave, {
        item: linha.item,
        lote: linha.lote,
        material: linha.material,
        espessura: linha.espessura,
        largura: linha.largura,
        campo: linha.campo_alterado,
        original: linha.valor_anterior,
        corrigido: linha.valor_novo,
        origem: linha.origem,
        usuario: nomes.get(linha.user_id) ?? 'Usuário',
        quando: linha.created_at,
        observacao: linha.observacao,
      })
      continue
    }

    existente.corrigido = linha.valor_novo
    existente.origem = linha.origem
    existente.usuario = nomes.get(linha.user_id) ?? 'Usuário'
    existente.quando = linha.created_at
    existente.observacao = linha.observacao ?? existente.observacao
  }

  return [...porChave.values()].filter((ajuste) => (ajuste.original ?? '') !== (ajuste.corrigido ?? ''))
}

function larguraDasColunas(linhas: (string | number | null)[][], cabecalho: string[]): { wch: number }[] {
  return cabecalho.map((titulo, coluna) => {
    let maior = titulo.length
    for (const linha of linhas) {
      const tamanho = String(linha[coluna] ?? '').length
      if (tamanho > maior) maior = tamanho
    }
    return { wch: Math.min(maior + 2, 40) }
  })
}

/**
 * Gera a planilha de correções (Ajustes_Estoque_AAAA-MM-DD.xlsx).
 * Nunca altera o arquivo original do ERP: é sempre uma planilha nova.
 */
export async function exportarCorrecoes(desde?: string): Promise<ResultadoExportacao> {
  const alteracoes = await buscarAlteracoes(desde)
  if (alteracoes.length === 0) {
    throw new Error('Nenhuma alteração registrada para exportar.')
  }

  const nomes = await buscarNomes(alteracoes)
  const ajustes = consolidar(alteracoes, nomes)
  if (ajustes.length === 0) {
    throw new Error('As alterações registradas voltaram ao valor original. Nada para exportar.')
  }

  const XLSX = await import('xlsx')

  const cabecalhoAjustes = [
    'Item',
    'Lote',
    'Material',
    'Espessura',
    'Largura',
    'Campo',
    'Antes (ERP)',
    'Depois (corrigido)',
    'Origem',
    'Responsável',
    'Data/Hora',
    'Observação',
  ]
  const linhasAjustes = ajustes.map((ajuste) => [
    ajuste.item,
    ajuste.lote,
    MATERIAL_META[comoMaterial(ajuste.material)].label,
    ajuste.espessura,
    ajuste.largura,
    ajuste.campo,
    valorDaCelula(ajuste.campo, ajuste.original),
    valorDaCelula(ajuste.campo, ajuste.corrigido),
    origemLegivel(ajuste.origem),
    ajuste.usuario,
    dataHora(ajuste.quando),
    ajuste.observacao,
  ])

  const cabecalhoHistorico = [
    'Data/Hora',
    'Responsável',
    'Item',
    'Lote',
    'Campo',
    'Valor anterior',
    'Valor novo',
    'Origem',
    'Observação',
  ]
  const linhasHistorico = alteracoes.map((linha) => [
    dataHora(linha.created_at),
    nomes.get(linha.user_id) ?? 'Usuário',
    linha.item,
    linha.lote,
    linha.campo_alterado,
    valorDaCelula(linha.campo_alterado, linha.valor_anterior),
    valorDaCelula(linha.campo_alterado, linha.valor_novo),
    origemLegivel(linha.origem),
    linha.observacao,
  ])

  const abaAjustes = XLSX.utils.aoa_to_sheet([cabecalhoAjustes, ...linhasAjustes])
  abaAjustes['!cols'] = larguraDasColunas(linhasAjustes, cabecalhoAjustes)
  const abaHistorico = XLSX.utils.aoa_to_sheet([cabecalhoHistorico, ...linhasHistorico])
  abaHistorico['!cols'] = larguraDasColunas(linhasHistorico, cabecalhoHistorico)

  const itensErp = await buscarItensErp(ajustes)
  const antesDepois = montarAntesDepois(ajustes, itensErp)
  const abaAntesDepois = XLSX.utils.aoa_to_sheet([antesDepois.cabecalho, ...antesDepois.linhas])
  abaAntesDepois['!cols'] = larguraDasColunas(antesDepois.linhas, antesDepois.cabecalho)

  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, abaAntesDepois, 'Antes e depois')
  XLSX.utils.book_append_sheet(livro, abaAjustes, 'Ajustes')
  XLSX.utils.book_append_sheet(livro, abaHistorico, 'Histórico completo')

  const arquivo = nomeDoArquivo()
  XLSX.writeFile(livro, arquivo)

  return { arquivo, ajustes: ajustes.length, registros: alteracoes.length }
}
