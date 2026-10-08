import * as XLSX from 'xlsx'
import type { EstoqueItemInput } from '@/types'
import { linhaParaItem, mapearCabecalhos } from '@/utils/estoque'

export interface PreviaImportacao {
  arquivo: string
  aba: string
  cabecalhos: string[]
  faltando: string[]
  itens: EstoqueItemInput[]
  linhasIgnoradas: number
}

export async function lerPlanilhaEstoque(file: File): Promise<PreviaImportacao> {
  const nome = file.name.toLowerCase()
  if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls')) {
    throw new Error('Use um arquivo .xlsx ou .xls.')
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const encontrada = encontrarTabela(workbook)
  if (!encontrada) {
    throw new Error('Não encontrei as colunas Item e Localiz nesta planilha.')
  }

  const { rows, headerIndex, sheetName } = encontrada
  const cabecalhosBrutos = (rows[headerIndex] ?? []).map((celula) =>
    celula == null ? '' : String(celula),
  )
  const { mapa, faltando } = mapearCabecalhos(cabecalhosBrutos)

  const itens: EstoqueItemInput[] = []
  let linhasIgnoradas = 0

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row || row.every((celula) => celula == null || String(celula).trim() === '')) {
      continue
    }
    const item = linhaParaItem(row, mapa)
    if (!item) {
      linhasIgnoradas += 1
      continue
    }
    itens.push(item)
  }

  return {
    arquivo: file.name,
    aba: sheetName,
    cabecalhos: cabecalhosBrutos.filter((cabecalho) => cabecalho.trim()),
    faltando,
    itens,
    linhasIgnoradas,
  }
}

function encontrarTabela(workbook: XLSX.WorkBook): {
  rows: (string | number | null)[][]
  headerIndex: number
  sheetName: string
} | null {
  const nomes = [...workbook.SheetNames].sort((a, b) => {
    const prioridade = (nome: string) =>
      nome.toLowerCase().includes('dados') ? 0 : 1
    return prioridade(a) - prioridade(b)
  })

  for (const sheetName of nomes) {
    const sheet = workbook.Sheets[sheetName]
    apararPlanilha(sheet)
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    })

    const limite = Math.min(rows.length, 25)
    for (let indice = 0; indice < limite; indice += 1) {
      const { mapa } = mapearCabecalhos(rows[indice] ?? [])
      if (mapa.item != null && mapa.localizacao != null) {
        return { rows, headerIndex: indice, sheetName }
      }
    }
  }

  return null
}

function apararPlanilha(sheet: XLSX.WorkSheet) {
  if (!sheet['!ref']) return

  let ultimaLinha = 0
  for (const chave of Object.keys(sheet)) {
    if (chave.startsWith('!')) continue
    const linha = XLSX.utils.decode_cell(chave).r
    if (linha > ultimaLinha) ultimaLinha = linha
  }

  const intervalo = XLSX.utils.decode_range(sheet['!ref'])
  if (intervalo.e.r > ultimaLinha) {
    intervalo.e.r = ultimaLinha
    sheet['!ref'] = XLSX.utils.encode_range(intervalo)
  }
}
