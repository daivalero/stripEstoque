import type { MaterialTipo } from '@/types'
import { semAcentos } from '@/utils/normalize'

/**
 * Classifica o material a partir da descrição e da família comercial do ERP.
 *
 * Regras (ajuste aqui se o ERP usar outras palavras):
 * - Inox: "INOX", "AISI" ou famílias AST 3xx/4xx (ex.: AST304, AST430)
 * - 1070: descrição ou família contém "1070"
 *     - com "SEM TEMPERA", "S/TEMPERA", "NAO TEMPERADO"... -> 1070 Sem Têmpera
 *     - com "TEMPERADO", "TEMPERA", "TEMP" -> 1070 Temperado
 * - qualquer outro caso (ex.: AST1010) -> Outro
 */
export function classificarMaterial(
  descricao: string | null | undefined,
  familia: string | null | undefined,
): MaterialTipo {
  const texto = semAcentos(`${descricao ?? ''} ${familia ?? ''}`).toUpperCase()

  if (/\bINOX\b|\bAISI\b|\bAST\s?[34]\d\d\b/.test(texto)) return 'inox'

  if (/1070/.test(texto)) {
    const semTempera =
      /\b(SEM|S\/|S\.|S-|NAO|N\/)\s?TEMP/.test(texto) || /\bSTEMP/.test(texto)
    if (semTempera) return '1070_sem_temperado'
    if (/TEMP/.test(texto)) return '1070_temperado'
  }

  return 'outro'
}
