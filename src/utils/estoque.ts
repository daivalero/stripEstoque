import {
  MATERIAL_META,
  type EstoqueItemInput,
  type MaterialMeta,
  type MaterialTipo,
} from '@/types'

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

export function termosDeBusca(codigo: string): string[] {
  const termo = codigo.trim()
  const termos = new Set<string>()
  if (!termo) return []
  termos.add(termo)

  for (const parte of termo.split(/[;|]/)) {
    const texto = parte.trim()
    if (/^\d+\/\d+$/.test(texto)) termos.add(texto)
  }

  const pedacos = termo.split('/').map((parte) => parte.trim())
  if (
    pedacos.length === 3 &&
    /^\d{2,4}$/.test(pedacos[0]) &&
    /^\d+$/.test(pedacos[1]) &&
    /^\d+$/.test(pedacos[2])
  ) {
    termos.add(`${pedacos[1]}/${pedacos[2]}`)
  }

  return [...termos]
}

export function loteDaEtiqueta(codigo: string): string | null {
  return termosDeBusca(codigo).find((termo) => /^\d+\/\d+$/.test(termo)) ?? null
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

  const familia = (famCom ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
  const familiaCompacta = familia.replace(/\s+/g, '')
  const eh1070 = texto.includes('1070')
  const semTempera =
    familiaCompacta.includes('S/T') ||
    texto.includes('ACST') ||
    /\bAST(?![A-Z])/.test(texto) ||
    /SEM\s*TEMP/.test(texto)
  const temperado =
    !semTempera &&
    (familiaCompacta === 'ACT' || texto.includes('ACT') || texto.includes('TEMPER'))

  if (eh1070 && semTempera) return '1070_sem_temperado'
  if (eh1070 && temperado) return '1070_temperado'

  // Não reduz famílias como AST1010, ACT1075 etc. a "Outro".
  if (familia) return familia

  const codigoNaDescricao = texto.match(/\b(?:AST|ACT|ACST|SAE|AISI)\s*-?\s*\d{3,4}[A-Z]?\b/)
  if (codigoNaDescricao) return codigoNaDescricao[0].replace(/[\s-]+/g, '')
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
  return value?.trim() || 'outro'
}

const CORES_MATERIAIS_DINAMICOS = [
  { colorClass: 'text-cyan-400', dotClass: 'bg-cyan-400' },
  { colorClass: 'text-amber-400', dotClass: 'bg-amber-400' },
  { colorClass: 'text-fuchsia-400', dotClass: 'bg-fuchsia-400' },
  { colorClass: 'text-lime-400', dotClass: 'bg-lime-400' },
  { colorClass: 'text-sky-400', dotClass: 'bg-sky-400' },
  { colorClass: 'text-rose-400', dotClass: 'bg-rose-400' },
] as const

export function rotuloMaterial(value: string | null | undefined): string {
  const material = comoMaterial(value)
  const conhecido = MATERIAL_META[material]
  if (conhecido) return conhecido.label
  return material
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z]+)(\d+)/g, '$1 $2')
    .replace(/(\d+)([A-Z]+)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

export function metaDoMaterial(value: string | null | undefined): MaterialMeta {
  const material = comoMaterial(value)
  const conhecido = MATERIAL_META[material]
  if (conhecido) return conhecido

  let hash = 0
  for (const caractere of material) {
    hash = (hash * 31 + caractere.charCodeAt(0)) >>> 0
  }
  const cores = CORES_MATERIAIS_DINAMICOS[hash % CORES_MATERIAIS_DINAMICOS.length]
  return {
    id: material,
    label: rotuloMaterial(material),
    ...cores,
  }
}
