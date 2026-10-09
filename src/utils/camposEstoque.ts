import { MATERIAL_META, type EstoqueItem, type MaterialTipo } from '@/types'
import { comoMaterial, normalizarLocalizacao, parseNumero } from '@/utils/estoque'

export type ChaveCampo =
  | 'item'
  | 'lote'
  | 'localizacao'
  | 'quantidade'
  | 'material'
  | 'espessura'
  | 'largura'
  | 'descricao'
  | 'dep'
  | 'fam_com'
  | 'estab'
  | 'superficie'

export type TipoCampo = 'texto' | 'numero' | 'local' | 'material'

export interface DefinicaoCampo {
  chave: ChaveCampo
  /** Nome gravado no histórico e usado na planilha (campo_alterado). */
  rotulo: string
  /** Nome mostrado no formulário. */
  titulo: string
  tipo: TipoCampo
}

export const CAMPOS: DefinicaoCampo[] = [
  { chave: 'item', rotulo: 'Item', titulo: 'Item', tipo: 'texto' },
  { chave: 'lote', rotulo: 'Lote', titulo: 'Lote', tipo: 'texto' },
  { chave: 'localizacao', rotulo: 'Localização', titulo: 'Localização', tipo: 'local' },
  { chave: 'quantidade', rotulo: 'Quantidade', titulo: 'Quantidade (kg)', tipo: 'numero' },
  { chave: 'material', rotulo: 'Material', titulo: 'Material', tipo: 'material' },
  { chave: 'espessura', rotulo: 'Espessura', titulo: 'Espessura (mm)', tipo: 'numero' },
  { chave: 'largura', rotulo: 'Largura', titulo: 'Largura (mm)', tipo: 'numero' },
  { chave: 'descricao', rotulo: 'Descrição', titulo: 'Descrição', tipo: 'texto' },
  { chave: 'dep', rotulo: 'Depósito', titulo: 'Depósito', tipo: 'texto' },
  { chave: 'fam_com', rotulo: 'Família', titulo: 'Família comercial', tipo: 'texto' },
  { chave: 'estab', rotulo: 'Estabelecimento', titulo: 'Estabelecimento', tipo: 'texto' },
  { chave: 'superficie', rotulo: 'Superfície', titulo: 'Superfície', tipo: 'texto' },
]

export const ROTULOS_NUMERICOS = new Set(
  CAMPOS.filter((campo) => campo.tipo === 'numero').map((campo) => campo.rotulo),
)

export type Formulario = Record<ChaveCampo, string>

export interface Diferenca {
  chave: ChaveCampo
  campo: string
  anterior: string | null
  novo: string | null
}

function textoLimpo(valor: unknown): string | null {
  if (valor == null) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}

/** Valor do campo em texto padronizado (é o que vai para o histórico). */
export function valorPadrao(item: EstoqueItem, chave: ChaveCampo): string | null {
  const definicao = CAMPOS.find((campo) => campo.chave === chave)
  const bruto = item[chave]

  if (definicao?.tipo === 'numero') {
    const numero = parseNumero(bruto)
    return numero == null ? null : String(numero)
  }
  if (definicao?.tipo === 'local') return normalizarLocalizacao(bruto)
  if (definicao?.tipo === 'material') return textoLimpo(comoMaterial(textoLimpo(bruto)))
  return textoLimpo(bruto)
}

function paraCampoDeTexto(valor: string | null, tipo: TipoCampo): string {
  if (valor == null) return ''
  return tipo === 'numero' ? valor.replace('.', ',') : valor
}

export function formularioDe(item: EstoqueItem): Formulario {
  const formulario = {} as Formulario
  for (const campo of CAMPOS) {
    formulario[campo.chave] = paraCampoDeTexto(valorPadrao(item, campo.chave), campo.tipo)
  }
  return formulario
}

/** Converte o que foi digitado para o texto padronizado do campo. */
export function padronizarDigitado(chave: ChaveCampo, digitado: string): string | null {
  const definicao = CAMPOS.find((campo) => campo.chave === chave)
  if (definicao?.tipo === 'numero') {
    const numero = parseNumero(digitado)
    return numero == null ? null : String(numero)
  }
  if (definicao?.tipo === 'local') return normalizarLocalizacao(digitado)
  return textoLimpo(digitado)
}

/** Aplica o formulário sobre um item e devolve a nova versão. */
export function aplicarFormulario(base: EstoqueItem, formulario: Formulario): EstoqueItem {
  const novo: EstoqueItem = { ...base }
  for (const campo of CAMPOS) {
    const valor = padronizarDigitado(campo.chave, formulario[campo.chave])
    if (campo.tipo === 'numero') {
      ;(novo as unknown as Record<string, unknown>)[campo.chave] = valor == null ? null : Number(valor)
    } else if (campo.chave === 'item') {
      novo.item = valor ?? base.item
    } else {
      ;(novo as unknown as Record<string, unknown>)[campo.chave] = valor
    }
  }
  return novo
}

export function diferencasEntre(antes: EstoqueItem, depois: EstoqueItem): Diferenca[] {
  const lista: Diferenca[] = []
  for (const campo of CAMPOS) {
    const anterior = valorPadrao(antes, campo.chave)
    const novo = valorPadrao(depois, campo.chave)
    if (anterior !== novo) {
      lista.push({ chave: campo.chave, campo: campo.rotulo, anterior, novo })
    }
  }
  return lista
}

export function nomeDoMaterial(valor: string | null): string {
  if (!valor) return ''
  return MATERIAL_META[comoMaterial(valor)].label
}

export const OPCOES_MATERIAL: { valor: MaterialTipo; rotulo: string }[] = (
  Object.keys(MATERIAL_META) as MaterialTipo[]
).map((valor) => ({ valor, rotulo: MATERIAL_META[valor].label }))

/** Texto legível de um valor do histórico (para tela e planilha). */
export function valorLegivel(rotulo: string, valor: string | null): string {
  if (valor == null || valor === '') return '—'
  if (rotulo === 'Material') return nomeDoMaterial(valor)
  if (rotulo === 'Quantidade') {
    const numero = Number(valor)
    if (!Number.isNaN(numero)) {
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(numero)} kg`
    }
  }
  if (ROTULOS_NUMERICOS.has(rotulo)) {
    const numero = Number(valor)
    if (!Number.isNaN(numero)) {
      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(numero)
    }
  }
  return valor
}
