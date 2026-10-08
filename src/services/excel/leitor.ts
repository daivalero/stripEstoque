import { ErroPlanilha, type ResultadoLeitura } from '@/services/excel/tipos'
import { acharLinhaCabecalho, validarPlanilha, type Matriz } from '@/services/excel/validacao'

export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024
export const LINHAS_MAXIMAS = 20000
const EXTENSOES = /\.(xlsx|xls)$/i

/**
 * Lê a planilha do ERP no navegador (somente leitura da cópia selecionada).
 * O arquivo original nunca é alterado e nada é enviado ao servidor aqui.
 */
export async function lerPlanilha(arquivo: File): Promise<ResultadoLeitura> {
  if (!EXTENSOES.test(arquivo.name)) {
    throw new ErroPlanilha('Selecione um arquivo Excel (.xlsx ou .xls).')
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new ErroPlanilha('Arquivo muito grande (limite de 15 MB).')
  }

  const XLSX = await import('xlsx')

  let workbook: import('xlsx').WorkBook
  try {
    workbook = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: false })
  } catch {
    throw new ErroPlanilha('Não foi possível ler o arquivo. Ele pode estar corrompido ou protegido por senha.')
  }

  if (workbook.SheetNames.length === 0) {
    throw new ErroPlanilha('A planilha não tem nenhuma aba.')
  }

  let melhor: { aba: string; matrizTexto: Matriz; matrizBruta: Matriz; primeiraLinha: number } | null = null

  for (const nomeAba of workbook.SheetNames) {
    const sheet = workbook.Sheets[nomeAba]
    if (!sheet?.['!ref']) continue

    const intervalo = XLSX.utils.decode_range(sheet['!ref'])
    if (intervalo.e.r - intervalo.s.r + 1 > LINHAS_MAXIMAS) {
      throw new ErroPlanilha(`A aba "${nomeAba}" tem mais de ${LINHAS_MAXIMAS.toLocaleString('pt-BR')} linhas.`)
    }

    const matrizTexto = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: true,
      defval: null,
    })
    if (acharLinhaCabecalho(matrizTexto) < 0) continue

    const matrizBruta = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      blankrows: true,
      defval: null,
    })

    melhor = { aba: nomeAba, matrizTexto, matrizBruta, primeiraLinha: intervalo.s.r + 1 }
    break
  }

  if (!melhor) {
    throw new ErroPlanilha(
      'Não encontrei o cabeçalho em nenhuma aba. Confira se a planilha tem colunas como Item, Lote, Localiz e Total.',
    )
  }

  return validarPlanilha({
    arquivoNome: arquivo.name,
    aba: melhor.aba,
    matrizBruta: melhor.matrizBruta,
    matrizTexto: melhor.matrizTexto,
    primeiraLinhaExcel: melhor.primeiraLinha,
  })
}
