import { MATERIAL_META, type EstoqueItemInput, type MaterialTipo } from '@/types'

const HEADER_ALIASES: Record<string, keyof EstoqueItemInput | 'ignorar'> = {
  descricao: 'descricao',
  desc: 'descricao',
  dep: 'dep',
  'fam com': 'fam_com',
  famcom: 'fam_com',
  'fam comercial': 'fam_com',
  item: 'item',
  esp: 'espessura',
  espessura: 'espessura',
  estab: 'estab',
  estabelecimento: 'estab',
  larg: 'largura',
  largura: 'largura',
  lote: 'lote',
  localiz: 'localizacao',
  localizacao: 'localizacao',
  local: 'localizacao',
  superficie: 'superficie',
  superf: 'superficie',
  total: 'quantidade',
  quantidade: 'quantidade',
  'quant est': 'quantidade',
  quantest: 'quantidade',
  qtd: 'quantidade',
  'qtde kg': 'quantidade',
}

function textoVazio(texto: string): boolean {
  return texto === '-' || texto === '—' || texto === '–'
}

export function normalizarTexto(value: unknown): string | null {
  if (value == null) return null
  const texto = String(value).replace(/\s+/g, ' ').trim()
  if (!texto || textoVazio(texto)) return null
  return texto
}

export function normalizarLocalizacao(value: unknown): string | null {
  const texto = normalizarTexto(value)
  if (!texto) return null
  return texto.replace(/\s+/g, '').toUpperCase()
}

export function parseNumero(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  let texto = String(value).trim().replace(/\s/g, '')
  if (!texto || textoVazio(texto)) return null

  const ultimaVirgula = texto.lastIndexOf(',')
  const ultimoPonto = texto.lastIndexOf('.')
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto =
      ultimaVirgula > ultimoPonto
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto.replace(/,/g, '')
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(',', '.')
  }

  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

export function normalizarCabecalho(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function classificarMaterial(
  descricao: string | null,
  famCom: string | null,
): MaterialTipo {
  const texto = `${descricao ?? ''} ${famCom ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  if (texto.includes('INOX')) return 'inox'

  const familia = (famCom ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
  const semTempera =
    familia.includes('S/T') ||
    texto.includes('ACST') ||
    /SEM\s*TEMP/.test(texto)
  const temperado =
    !semTempera &&
    (familia === 'AC T' || texto.includes('ACT') || texto.includes('TEMPER'))

  if (semTempera) return '1070_sem_temperado'
  if (temperado) return '1070_temperado'
  return 'outro'
}

export function formatarNumero(
  value: number | null | undefined,
  casas = 0,
): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(value)
}

export function formatarQuantidade(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const numero = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value)
  return `${numero} kg`
}

export function formatarMedida(
  espessura: number | null | undefined,
  largura: number | null | undefined,
): string {
  return `${formatarNumero(espessura, 2)} × ${formatarNumero(largura, 2)} mm`
}

function prioridadeQuantidade(nome: string): number {
  if (nome === 'qtde kg' || nome === 'qtdekg') return 3
  if (nome === 'total' || nome === 'quantidade') return 2
  return 1
}

export function mapearCabecalhos(headers: unknown[]): {
  mapa: Partial<Record<keyof EstoqueItemInput, number>>
  faltando: string[]
} {
  const mapa: Partial<Record<keyof EstoqueItemInput, number>> = {}
  let prioridadeAtual = 0

  headers.forEach((header, index) => {
    const nome = normalizarCabecalho(header)
    const chave = HEADER_ALIASES[nome]
    if (!chave || chave === 'ignorar') return

    if (chave === 'quantidade') {
      const prioridade = prioridadeQuantidade(nome)
      if (mapa.quantidade == null || prioridade > prioridadeAtual) {
        mapa.quantidade = index
        prioridadeAtual = prioridade
      }
      return
    }

    if (mapa[chave] != null) return
    mapa[chave] = index
  })

  const obrigatorios: Array<[keyof EstoqueItemInput, string]> = [
    ['item', 'Item'],
    ['localizacao', 'Localiz'],
    ['quantidade', 'Total'],
  ]

  const faltando = obrigatorios
    .filter(([campo]) => mapa[campo] == null)
    .map(([, rotulo]) => rotulo)

  return { mapa, faltando }
}

function celula(
  row: unknown[],
  mapa: Partial<Record<keyof EstoqueItemInput, number>>,
  campo: keyof EstoqueItemInput,
): unknown {
  const index = mapa[campo]
  if (index == null) return null
  return row[index]
}

export function linhaParaItem(
  row: unknown[],
  mapa: Partial<Record<keyof EstoqueItemInput, number>>,
): EstoqueItemInput | null {
  const item = normalizarTexto(celula(row, mapa, 'item'))
  if (!item) return null

  const descricao = normalizarTexto(celula(row, mapa, 'descricao'))
  const famCom = normalizarTexto(celula(row, mapa, 'fam_com'))

  return {
    descricao,
    dep: normalizarTexto(celula(row, mapa, 'dep')),
    fam_com: famCom,
    item,
    espessura: parseNumero(celula(row, mapa, 'espessura')),
    estab: normalizarTexto(celula(row, mapa, 'estab')),
    largura: parseNumero(celula(row, mapa, 'largura')),
    lote: normalizarTexto(celula(row, mapa, 'lote')),
    localizacao: normalizarLocalizacao(celula(row, mapa, 'localizacao')),
    superficie: normalizarTexto(celula(row, mapa, 'superficie'))?.toUpperCase() ?? null,
    quantidade: parseNumero(celula(row, mapa, 'quantidade')),
    material: classificarMaterial(descricao, famCom),
  }
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

export function comoMaterial(value: string | null | undefined): MaterialTipo {
  if (value && value in MATERIAL_META) return value as MaterialTipo
  return 'outro'
}
