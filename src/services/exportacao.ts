import type { Cell, Row, Worksheet } from 'exceljs'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { supabase } from '@/services/supabase'
import type { EstoqueAlteracao, EstoqueItem } from '@/types'
import {
  CAMPOS,
  ROTULOS_NUMERICOS,
  nomeDoMaterial,
  valorLegivel,
  valorPadrao,
  type ChaveCampo,
} from '@/utils/camposEstoque'
import { comoMaterial } from '@/utils/estoque'

const TAMANHO_PAGINA = 1000

/** Não há nada novo para colocar na planilha (não é um erro de verdade). */
export class SemAlteracoesError extends Error {}

export interface PeriodoExportacao {
  /** ISO: só alterações a partir deste momento. */
  desde?: string
  /** ISO: só alterações até este momento. */
  ate?: string
}

export interface ResultadoExportacao {
  arquivo: string
  /** Quantidade de itens corrigidos que foram para a planilha. */
  itens: number
  /** Quantidade de registros no histórico exportado. */
  registros: number
}

// ---------------------------------------------------------------------------
// Colunas do ERP (mesma ordem e mesmos nomes da planilha original)
// ---------------------------------------------------------------------------

interface ColunaErp {
  chave: ChaveCampo
  /** Nome do campo no histórico. */
  rotulo: string
  /** Título igual ao da planilha do ERP. */
  cabecalho: string
  largura: number
  formato?: string
}

const COLUNAS_ERP: ColunaErp[] = [
  { chave: 'descricao', rotulo: 'Descrição', cabecalho: 'Descrição', largura: 38 },
  { chave: 'dep', rotulo: 'Depósito', cabecalho: 'Dep', largura: 10 },
  { chave: 'fam_com', rotulo: 'Família', cabecalho: 'Fam Com', largura: 12 },
  { chave: 'item', rotulo: 'Item', cabecalho: 'Item', largura: 18 },
  { chave: 'espessura', rotulo: 'Espessura', cabecalho: 'Esp', largura: 10, formato: '0.00' },
  { chave: 'estab', rotulo: 'Estabelecimento', cabecalho: 'Estab', largura: 10 },
  { chave: 'largura', rotulo: 'Largura', cabecalho: 'Larg', largura: 10, formato: '0.00' },
  { chave: 'lote', rotulo: 'Lote', cabecalho: 'Lote', largura: 14 },
  { chave: 'localizacao', rotulo: 'Localização', cabecalho: 'Localiz', largura: 13 },
  { chave: 'superficie', rotulo: 'Superfície', cabecalho: 'Superf', largura: 12 },
  { chave: 'quantidade', rotulo: 'Quantidade', cabecalho: 'Qtde Kg', largura: 12, formato: '#,##0.###' },
]

const CABECALHO_POR_ROTULO = new Map<string, string>([
  ...COLUNAS_ERP.map((coluna) => [coluna.rotulo, coluna.cabecalho] as [string, string]),
  ['Material', 'Material'],
])

// ---------------------------------------------------------------------------
// Visual
// ---------------------------------------------------------------------------

const COR = {
  fundoEscuro: 'FF0B1220',
  cinzaEscuro: 'FF334155',
  azul: 'FF1D4ED8',
  texto: 'FF0F172A',
  textoSuave: 'FF64748B',
  zebra: 'FFF8FAFC',
  cinzaClaro: 'FFF1F5F9',
  borda: 'FFE2E8F0',
  amarelo: 'FFFEF08A',
  amareloTexto: 'FF854D0E',
  vermelho: 'FFFECACA',
  vermelhoTexto: 'FF991B1B',
  verde: 'FFDCFCE7',
  verdeTexto: 'FF166534',
}

const COR_MATERIAL: Record<string, string> = {
  '1070_temperado': 'FFEA580C',
  '1070_sem_temperado': 'FF2563EB',
  inox: 'FF16A34A',
  outro: 'FF64748B',
}

const NAO_ENCONTRADO = 'NÃO ENCONTRADO'

function fundo(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } }
}

function borda(argb = COR.borda) {
  const lado = { style: 'thin' as const, color: { argb } }
  return { top: lado, left: lado, bottom: lado, right: lado }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const ORIGENS: Record<string, string> = {
  conferencia_fisica: 'Conferência física',
  inventario: 'Inventário',
  ajuste_manual: 'Edição manual',
  importacao: 'Importação',
}

function origemLegivel(origem: string): string {
  return ORIGENS[origem] ?? origem
}

function dataDe(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function nomeDoArquivo(): string {
  const agora = new Date()
  const parte = (n: number) => String(n).padStart(2, '0')
  const dia = `${agora.getFullYear()}-${parte(agora.getMonth() + 1)}-${parte(agora.getDate())}`
  return `Ajustes_Estoque_${dia}_${parte(agora.getHours())}h${parte(agora.getMinutes())}.xlsx`
}

type Celula = string | number | null

function valorDaCelula(campo: string, valor: string | null): Celula {
  if (valor == null || valor === '') return null
  if (campo === 'Material') return nomeDoMaterial(valor)
  if (ROTULOS_NUMERICOS.has(campo)) {
    const numero = Number(valor)
    if (!Number.isNaN(numero)) return numero
  }
  return valor
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

async function buscarAlteracoes(periodo: PeriodoExportacao): Promise<EstoqueAlteracao[]> {
  const linhas: EstoqueAlteracao[] = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from('estoque_alteracoes')
      .select('*')
      .order('created_at', { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (periodo.desde) consulta = consulta.gte('created_at', periodo.desde)
    if (periodo.ate) consulta = consulta.lte('created_at', periodo.ate)

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

export interface Ajuste {
  /** Identifica o item: id da linha do estoque, ou item|lote nas alterações antigas. */
  chave: string
  itemId: string | null
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
}

/** Junta as alterações do mesmo item e campo: valor de antes -> último valor registrado. */
export function consolidar(linhas: EstoqueAlteracao[], nomes: Map<string, string>): Ajuste[] {
  const porChave = new Map<string, Ajuste>()
  // A identificação do item vem da primeira alteração, antes de qualquer correção.
  const primeiroDoItem = new Map<string, EstoqueAlteracao>()

  for (const linha of linhas) {
    const grupo = linha.item_id ?? `${linha.item}|${linha.lote ?? ''}`
    if (!primeiroDoItem.has(grupo)) primeiroDoItem.set(grupo, linha)
    const chave = `${grupo}|${linha.campo_alterado}`
    const existente = porChave.get(chave)
    const usuario = nomes.get(linha.user_id) ?? 'Usuário'

    if (!existente) {
      const identidade = primeiroDoItem.get(grupo) ?? linha
      porChave.set(chave, {
        chave: grupo,
        itemId: linha.item_id ?? null,
        item: identidade.item,
        lote: identidade.lote,
        material: identidade.material,
        espessura: identidade.espessura,
        largura: identidade.largura,
        campo: linha.campo_alterado,
        original: linha.valor_anterior,
        corrigido: linha.valor_novo,
        origem: linha.origem,
        usuario,
        quando: linha.created_at,
      })
      continue
    }

    existente.corrigido = linha.valor_novo
    existente.origem = linha.origem
    existente.usuario = usuario
    existente.quando = linha.created_at
  }

  return [...porChave.values()].filter(
    (ajuste) => (ajuste.original ?? '') !== (ajuste.corrigido ?? ''),
  )
}

async function buscarItensErp(ajustes: Ajuste[]): Promise<Map<string, EstoqueItem>> {
  const encontrados = new Map<string, EstoqueItem>()

  const ids = [...new Set(ajustes.map((ajuste) => ajuste.itemId).filter(Boolean))] as string[]
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = await supabase
      .from('estoque_itens')
      .select('*')
      .in('id', ids.slice(i, i + 80))
    for (const linha of (data ?? []) as EstoqueItem[]) {
      encontrados.set(linha.id, linha)
    }
  }

  // Alterações antigas (sem item_id): procura pelo lote na importação ativa.
  const antigos = ajustes.filter((ajuste) => !ajuste.itemId)
  if (antigos.length === 0) return encontrados
  const importacao = await buscarImportacaoAtiva().catch(() => null)
  if (!importacao) return encontrados

  const lotes = [...new Set(antigos.map((ajuste) => ajuste.lote).filter(Boolean))] as string[]
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
    ...new Set(antigos.filter((ajuste) => !ajuste.lote).map((ajuste) => ajuste.item)),
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

interface ItemCorrigido {
  antes: Record<string, string | null>
  depois: Record<string, string | null>
  mudancas: Ajuste[]
  ultimo: Ajuste
}

/** Um item corrigido: todos os campos antes e depois, na ordem em que o ERP mostra. */
function montarItens(ajustes: Ajuste[], itensErp: Map<string, EstoqueItem>): ItemCorrigido[] {
  const porItem = new Map<string, Ajuste[]>()
  for (const ajuste of ajustes) {
    porItem.set(ajuste.chave, [...(porItem.get(ajuste.chave) ?? []), ajuste])
  }

  const itens: ItemCorrigido[] = []
  for (const mudancas of porItem.values()) {
    const primeiro = mudancas[0]
    const erp = itensErp.get(primeiro.itemId ?? primeiro.chave)

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
    itens.push({ antes, depois, mudancas, ultimo })
  }

  return itens.sort(
    (a, b) =>
      (a.depois['Localização'] ?? '').localeCompare(b.depois['Localização'] ?? '', 'pt-BR', {
        numeric: true,
      }) || (a.depois.Item ?? '').localeCompare(b.depois.Item ?? '', 'pt-BR', { numeric: true }),
  )
}

function resumoDasMudancas(item: ItemCorrigido): { texto: string; linhas: number } {
  const partes = item.mudancas.map(
    (mudanca) =>
      `${CABECALHO_POR_ROTULO.get(mudanca.campo) ?? mudanca.campo}: ` +
      `${valorLegivel(mudanca.campo, mudanca.original).replace(/ kg$/, '')} → ` +
      `${valorLegivel(mudanca.campo, mudanca.corrigido).replace(/ kg$/, '')}`,
  )
  return { texto: partes.join('\n'), linhas: partes.length }
}

// ---------------------------------------------------------------------------
// Montagem das abas
// ---------------------------------------------------------------------------

function estilizarCabecalho(linha: Row, primeiraAzul: number) {
  linha.height = 28
  linha.eachCell((celula, coluna) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    celula.fill = fundo(coluna >= primeiraAzul ? COR.azul : COR.cinzaEscuro)
    celula.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    celula.border = borda(COR.fundoEscuro)
  })
}

function estiloBase(celula: Cell, zebra: boolean, numerico: boolean) {
  celula.font = { color: { argb: COR.texto }, size: 11 }
  celula.alignment = {
    vertical: 'middle',
    horizontal: numerico ? 'right' : 'left',
    wrapText: false,
  }
  celula.border = borda()
  if (zebra) celula.fill = fundo(COR.zebra)
}

function marcarAlterada(celula: Cell, valor: Celula) {
  const ausente = valor === NAO_ENCONTRADO
  celula.fill = fundo(ausente ? COR.vermelho : COR.amarelo)
  celula.font = {
    bold: true,
    size: 11,
    color: { argb: ausente ? COR.vermelhoTexto : COR.amareloTexto },
  }
}

function prepararAba(aba: Worksheet, colunas: number, congelarColunas = 0) {
  aba.views = [{ state: 'frozen', ySplit: 1, xSplit: congelarColunas, showGridLines: false }]
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas } }
  aba.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }
}

function abaLancarNoErp(aba: Worksheet, itens: ItemCorrigido[]) {
  const infos = ['Data', 'Hora', 'Responsável', 'Material', 'O que mudou']
  const primeiraAzul = infos.length + 1
  const larguras = [13, 10, 20, 18, 46, ...COLUNAS_ERP.map((coluna) => coluna.largura)]
  aba.columns = larguras.map((width) => ({ width }))

  estilizarCabecalho(
    aba.addRow([...infos, ...COLUNAS_ERP.map((coluna) => coluna.cabecalho)]),
    primeiraAzul,
  )

  itens.forEach((item, indice) => {
    const resumo = resumoDasMudancas(item)
    const alterados = new Set(item.mudancas.map((mudanca) => mudanca.campo))
    const material = comoMaterial(item.depois.Material)

    const linha = aba.addRow([
      dataDe(item.ultimo.quando),
      horaDe(item.ultimo.quando),
      item.ultimo.usuario,
      nomeDoMaterial(item.depois.Material),
      resumo.texto,
      ...COLUNAS_ERP.map((coluna) => valorDaCelula(coluna.rotulo, item.depois[coluna.rotulo])),
    ])
    linha.height = Math.max(24, 17 * resumo.linhas + 7)

    linha.eachCell({ includeEmpty: true }, (celula, coluna) => {
      const erp = coluna >= primeiraAzul ? COLUNAS_ERP[coluna - primeiraAzul] : null
      estiloBase(celula, indice % 2 === 1, erp?.formato != null)
      if (erp?.formato) celula.numFmt = erp.formato
      if (coluna === 4) {
        celula.font = {
          bold: true,
          size: 11,
          color: { argb: COR_MATERIAL[material] ?? COR.cinzaEscuro },
        }
        if (alterados.has('Material')) celula.fill = fundo(COR.amarelo)
      }
      if (coluna === 5) {
        celula.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
        celula.font = { size: 10, color: { argb: COR.textoSuave } }
      }
      if (erp && alterados.has(erp.rotulo)) {
        marcarAlterada(celula, valorDaCelula(erp.rotulo, item.depois[erp.rotulo]))
      }
    })
  })

  prepararAba(aba, infos.length + COLUNAS_ERP.length, 0)
}

function abaAntesDepois(aba: Worksheet, itens: ItemCorrigido[]) {
  const cabecalho = [
    'Situação',
    ...COLUNAS_ERP.map((coluna) => coluna.cabecalho),
    'Material',
    'Data',
    'Hora',
    'Responsável',
  ]
  const colunaMaterial = COLUNAS_ERP.length + 2
  aba.columns = [
    { width: 18 },
    ...COLUNAS_ERP.map((coluna) => ({ width: coluna.largura })),
    { width: 18 },
    { width: 13 },
    { width: 10 },
    { width: 20 },
  ]
  estilizarCabecalho(aba.addRow(cabecalho), 2)
  aba.getCell(1, 1).fill = fundo(COR.cinzaEscuro)
  for (let coluna = COLUNAS_ERP.length + 2; coluna <= cabecalho.length; coluna += 1) {
    aba.getCell(1, coluna).fill = fundo(COR.cinzaEscuro)
  }

  for (const item of itens) {
    const alterados = new Set(item.mudancas.map((mudanca) => mudanca.campo))

    const antes = aba.addRow([
      'ANTES (ERP)',
      ...COLUNAS_ERP.map((coluna) => valorDaCelula(coluna.rotulo, item.antes[coluna.rotulo])),
      nomeDoMaterial(item.antes.Material),
      null,
      null,
      null,
    ])
    const depois = aba.addRow([
      'DEPOIS (corrigido)',
      ...COLUNAS_ERP.map((coluna) => valorDaCelula(coluna.rotulo, item.depois[coluna.rotulo])),
      nomeDoMaterial(item.depois.Material),
      dataDe(item.ultimo.quando),
      horaDe(item.ultimo.quando),
      item.ultimo.usuario,
    ])
    antes.height = 22
    depois.height = 22

    antes.eachCell({ includeEmpty: true }, (celula, coluna) => {
      const erp = coluna >= 2 && coluna <= COLUNAS_ERP.length + 1 ? COLUNAS_ERP[coluna - 2] : null
      estiloBase(celula, false, erp?.formato != null)
      if (erp?.formato) celula.numFmt = erp.formato
      celula.fill = fundo(COR.cinzaClaro)
      celula.font = { italic: true, size: 11, color: { argb: COR.textoSuave } }
      celula.border = {
        ...borda(),
        top: { style: 'medium', color: { argb: COR.cinzaEscuro } },
      }
      if (coluna === 1) {
        celula.font = { bold: true, size: 10, color: { argb: COR.cinzaEscuro } }
      }
      if (
        (erp && alterados.has(erp.rotulo)) ||
        (coluna === colunaMaterial && alterados.has('Material'))
      ) {
        celula.font = {
          italic: true,
          strike: true,
          size: 11,
          color: { argb: COR.vermelhoTexto },
        }
      }
    })

    depois.eachCell({ includeEmpty: true }, (celula, coluna) => {
      const erp = coluna >= 2 && coluna <= COLUNAS_ERP.length + 1 ? COLUNAS_ERP[coluna - 2] : null
      estiloBase(celula, false, erp?.formato != null)
      if (erp?.formato) celula.numFmt = erp.formato
      if (coluna === 1) {
        celula.fill = fundo(COR.verde)
        celula.font = { bold: true, size: 10, color: { argb: COR.verdeTexto } }
      }
      if (erp && alterados.has(erp.rotulo)) {
        marcarAlterada(celula, valorDaCelula(erp.rotulo, item.depois[erp.rotulo]))
      }
      if (coluna === colunaMaterial && alterados.has('Material')) {
        marcarAlterada(celula, nomeDoMaterial(item.depois.Material))
      }
    })
  }

  prepararAba(aba, cabecalho.length, 1)
}

function abaHistorico(
  aba: Worksheet,
  alteracoes: EstoqueAlteracao[],
  nomes: Map<string, string>,
) {
  const cabecalho = ['Data', 'Hora', 'Responsável', 'Item', 'Lote', 'Campo', 'Antes', 'Depois', 'Origem', 'Observação']
  aba.columns = [13, 10, 20, 18, 14, 16, 22, 22, 20, 46].map((width) => ({ width }))
  estilizarCabecalho(aba.addRow(cabecalho), 99)

  // Mais recente primeiro.
  const ordenadas = [...alteracoes].sort((a, b) => b.created_at.localeCompare(a.created_at))
  ordenadas.forEach((linha, indice) => {
    const nova = aba.addRow([
      dataDe(linha.created_at),
      horaDe(linha.created_at),
      nomes.get(linha.user_id) ?? 'Usuário',
      linha.item,
      linha.lote,
      linha.campo_alterado,
      valorDaCelula(linha.campo_alterado, linha.valor_anterior),
      valorDaCelula(linha.campo_alterado, linha.valor_novo),
      origemLegivel(linha.origem),
      linha.observacao,
    ])
    nova.height = 22
    nova.eachCell({ includeEmpty: true }, (celula, coluna) => {
      estiloBase(celula, indice % 2 === 1, typeof celula.value === 'number')
      if (coluna === 7) celula.font = { size: 11, color: { argb: COR.vermelhoTexto } }
      if (coluna === 8) celula.font = { bold: true, size: 11, color: { argb: COR.verdeTexto } }
      if (coluna === 10) celula.font = { size: 10, color: { argb: COR.textoSuave } }
    })
  })

  prepararAba(aba, cabecalho.length, 0)
}

function abaComoUsar(aba: Worksheet, itens: number, periodo: string) {
  aba.columns = [{ width: 4 }, { width: 100 }]
  aba.views = [{ showGridLines: false }]

  const titulo = aba.addRow(['', 'Como usar esta planilha'])
  titulo.height = 32
  titulo.getCell(2).font = { bold: true, size: 16, color: { argb: COR.azul } }

  const linhas = [
    `${itens} ${itens === 1 ? 'item corrigido' : 'itens corrigidos'} · ${periodo} · gerada em ${dataDe(new Date().toISOString())} às ${horaDe(new Date().toISOString())}`,
    '',
    'Aba "Lançar no ERP": uma linha por item, com as colunas azuis na mesma ordem do ERP (Descrição … Qtde Kg).',
    'Células AMARELAS são os valores corrigidos. Células VERMELHAS indicam item não encontrado.',
    'Para lançar: filtre ou selecione as colunas azuis, copie (Ctrl+C) e cole (Ctrl+V) no ERP.',
    'A coluna "O que mudou" mostra o valor antigo → novo de cada campo, para conferir antes de colar.',
    '',
    'Aba "Antes e depois": mostra a linha original do ERP e a linha corrigida, lado a lado.',
    'Aba "Histórico": todos os registros, com dia, hora e quem fez, do mais recente para o mais antigo.',
    '',
    'Esta planilha é uma cópia nova. A planilha original e o ERP não são alterados pelo sistema.',
  ]
  for (const texto of linhas) {
    const linha = aba.addRow(['', texto])
    linha.height = texto ? 22 : 10
    linha.getCell(2).font = { size: 12, color: { argb: COR.texto } }
    linha.getCell(2).alignment = { vertical: 'middle', wrapText: true }
  }
}

function descreverPeriodo(periodo: PeriodoExportacao): string {  if (periodo.desde && periodo.ate) {
    return `de ${dataDe(periodo.desde)} a ${dataDe(periodo.ate)}`
  }
  if (periodo.desde) return `desde ${dataDe(periodo.desde)} ${horaDe(periodo.desde)}`
  if (periodo.ate) return `até ${dataDe(periodo.ate)}`
  return 'todo o histórico'
}

function baixar(buffer: ArrayBuffer, arquivo: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Gera a planilha de correções, pronta para copiar e colar no ERP.
 * Nunca altera o arquivo original do ERP: é sempre uma planilha nova.
 */
export async function exportarCorrecoes(
  periodo: PeriodoExportacao = {},
): Promise<ResultadoExportacao> {
  const alteracoes = await buscarAlteracoes(periodo)
  if (alteracoes.length === 0) {
    throw new SemAlteracoesError('Nenhuma alteração registrada nesse período.')
  }

  const nomes = await buscarNomes(alteracoes)
  const ajustes = consolidar(alteracoes, nomes)
  if (ajustes.length === 0) {
    throw new SemAlteracoesError(
      'As alterações desse período voltaram ao valor original. Nada para exportar.',
    )
  }

  const { buffer, itens } = await montarPlanilha(
    alteracoes,
    nomes,
    ajustes,
    await buscarItensErp(ajustes),
    periodo,
  )

  const arquivo = nomeDoArquivo()
  baixar(buffer, arquivo)

  return {
    arquivo,
    itens,
    registros: alteracoes.length,
  }
}

/** Monta o arquivo .xlsx (sem baixar). */
export async function montarPlanilha(
  alteracoes: EstoqueAlteracao[],
  nomes: Map<string, string>,
  ajustes: Ajuste[],
  itensErp: Map<string, EstoqueItem>,
  periodo: PeriodoExportacao,
): Promise<{ buffer: ArrayBuffer; itens: number }> {
  const itens = montarItens(ajustes, itensErp)

  const modulo = await import('exceljs')
  const ExcelJS = modulo.default ?? modulo
  const livro = new ExcelJS.Workbook()
  livro.creator = 'Controle de Estoque'
  livro.created = new Date()

  abaLancarNoErp(livro.addWorksheet('Lançar no ERP', { properties: { tabColor: { argb: COR.azul } } }), itens)
  abaAntesDepois(livro.addWorksheet('Antes e depois', { properties: { tabColor: { argb: 'FF16A34A' } } }), itens)
  abaHistorico(livro.addWorksheet('Histórico', { properties: { tabColor: { argb: 'FF64748B' } } }), alteracoes, nomes)
  abaComoUsar(livro.addWorksheet('Como usar'), itens.length, descreverPeriodo(periodo))

  return { buffer: (await livro.xlsx.writeBuffer()) as ArrayBuffer, itens: itens.length }
}
