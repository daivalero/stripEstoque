/** Remove acentos e passa para maiúsculas — usado para comparar textos. */
export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Remove espaços extras (inclui espaços não separáveis) nas pontas e no meio. */
export function limparTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).replace(/\s+/g, ' ').trim()
}

/** "p0054" / " P 0054 " -> "P0054". Não inventa outro padrão de localização. */
export function normalizarLocalizacao(valor: unknown): string {
  return limparTexto(valor).replace(/\s+/g, '').toUpperCase()
}

/** Padrão de localização já usado no ERP (P0051, P0052, P0054, P0060...). */
export const PADRAO_LOCALIZACAO = /^P\d{4}$/

/**
 * Converte número vindo do Excel.
 * - número nativo do Excel: usado como está
 * - texto pt-BR: "1.234,56" -> 1234.56, "0,10" -> 0.1
 * - texto com ponto decimal simples: "0.10" -> 0.1
 * Retorna null se vazio e NaN-safe (null) se não for número.
 */
export function parseNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

  let texto = String(valor).replace(/\s+/g, '').trim()
  if (!texto) return null

  texto = texto.replace(/^[^\d+\-.,]+|[^\d.,]+$/g, '')
  if (!/^[+-]?[\d.,]+$/.test(texto)) return null

  const temVirgula = texto.includes(',')
  const temPonto = texto.includes('.')

  if (temVirgula && temPonto) {
    const ultimaVirgula = texto.lastIndexOf(',')
    const ultimoPonto = texto.lastIndexOf('.')
    texto =
      ultimaVirgula > ultimoPonto
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto.replace(/,/g, '')
  } else if (temVirgula) {
    if ((texto.match(/,/g) ?? []).length > 1) {
      texto = texto.replace(/,/g, '')
    } else {
      texto = texto.replace(',', '.')
    }
  } else if (temPonto) {
    const partes = texto.split('.')
    const milhar =
      partes.length > 2 ||
      (partes.length === 2 && partes[1].length === 3 && partes[0].length <= 3 && partes[0] !== '0')
    if (milhar) texto = texto.replace(/\./g, '')
  }

  const numero = Number(texto)
  return Number.isFinite(numero) ? numero : null
}

const formatadorMedida = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatadorQuantidade = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
})

export function formatarMedidaNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return formatadorMedida.format(valor)
}

/** Ex.: 0,5 e 19,05 -> "0,50 × 19,05 mm" */
export function formatarMedida(
  espessura: number | null | undefined,
  largura: number | null | undefined,
): string {
  if (
    (espessura === null || espessura === undefined) &&
    (largura === null || largura === undefined)
  ) {
    return '—'
  }
  return `${formatarMedidaNumero(espessura)} × ${formatarMedidaNumero(largura)} mm`
}

export function formatarQuantidade(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  return formatadorQuantidade.format(valor)
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
