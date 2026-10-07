import { acharColuna, COLUNAS_ESPERADAS } from '@/services/excel/colunas'
import {
  ErroPlanilha,
  type CampoPlanilha,
  type ColunaMapeada,
  type LinhaImportada,
  type ProblemaLinha,
  type ResultadoLeitura,
} from '@/services/excel/tipos'
import type { MaterialTipo } from '@/types'
import { classificarMaterial } from '@/utils/material'
import {
  limparTexto,
  normalizarLocalizacao,
  PADRAO_LOCALIZACAO,
  parseNumero,
} from '@/utils/normalize'

export type Matriz = unknown[][]

const LINHAS_PARA_PROCURAR_CABECALHO = 25
const MINIMO_COLUNAS_RECONHECIDAS = 3

function celulaVazia(valor: unknown): boolean {
  return valor === null || valor === undefined || String(valor).trim() === ''
}

/** Procura a linha de cabeçalho (a que reconhece mais colunas esperadas). */
export function acharLinhaCabecalho(matriz: Matriz): number {
  let melhorLinha = -1
  let melhorPontos = 0

  const limite = Math.min(matriz.length, LINHAS_PARA_PROCURAR_CABECALHO)
  for (let i = 0; i < limite; i += 1) {
    const campos = new Set<CampoPlanilha>()
    for (const celula of matriz[i] ?? []) {
      const coluna = acharColuna(celula)
      if (coluna) campos.add(coluna.campo)
    }
    if (campos.size > melhorPontos) {
      melhorPontos = campos.size
      melhorLinha = i
    }
  }

  return melhorPontos >= MINIMO_COLUNAS_RECONHECIDAS ? melhorLinha : -1
}

interface OpcoesValidacao {
  arquivoNome: string
  aba: string
  /** Valores brutos (números como número). */
  matrizBruta: Matriz
  /** Valores como aparecem na planilha (texto formatado). */
  matrizTexto: Matriz
  /** Número da linha do Excel correspondente ao índice 0 das matrizes. */
  primeiraLinhaExcel: number
}

function celulaTexto(
  linhaBruta: unknown[],
  linhaTexto: unknown[],
  indice: number,
): string {
  const formatado = linhaTexto[indice]
  const texto = celulaVazia(formatado) ? linhaBruta[indice] : formatado
  return limparTexto(texto)
}

function celulaNumero(
  linhaBruta: unknown[],
  linhaTexto: unknown[],
  indice: number,
): { vazio: boolean; valor: number | null } {
  const bruto = linhaBruta[indice]
  if (celulaVazia(bruto) && celulaVazia(linhaTexto[indice])) {
    return { vazio: true, valor: null }
  }
  const origem = celulaVazia(bruto) ? linhaTexto[indice] : bruto
  return { vazio: false, valor: parseNumero(origem) }
}

export function validarPlanilha(opcoes: OpcoesValidacao): ResultadoLeitura {
  const { arquivoNome, aba, matrizBruta, matrizTexto, primeiraLinhaExcel } = opcoes

  const indiceCabecalho = acharLinhaCabecalho(matrizTexto)
  if (indiceCabecalho < 0) {
    throw new ErroPlanilha(
      'Não encontrei o cabeçalho da planilha. Confira se ela tem colunas como Item, Lote, Localiz e Total.',
    )
  }

  const cabecalhos = matrizTexto[indiceCabecalho] ?? []
  const indicePorCampo = new Map<CampoPlanilha, number>()
  const cabecalhoPorCampo = new Map<CampoPlanilha, string>()
  const cabecalhosDesconhecidos: string[] = []

  cabecalhos.forEach((cabecalho, indice) => {
    if (celulaVazia(cabecalho)) return
    const coluna = acharColuna(cabecalho)
    if (coluna && !indicePorCampo.has(coluna.campo)) {
      indicePorCampo.set(coluna.campo, indice)
      cabecalhoPorCampo.set(coluna.campo, limparTexto(cabecalho))
    } else if (!coluna) {
      cabecalhosDesconhecidos.push(limparTexto(cabecalho))
    }
  })

  const colunas: ColunaMapeada[] = COLUNAS_ESPERADAS.map((coluna) => ({
    campo: coluna.campo,
    rotulo: coluna.rotulo,
    obrigatoria: coluna.obrigatoria,
    cabecalho: cabecalhoPorCampo.get(coluna.campo) ?? null,
  }))
  const colunasObrigatoriasAusentes = colunas.filter(
    (coluna) => coluna.obrigatoria && coluna.cabecalho === null,
  )

  const linhas: LinhaImportada[] = []
  const problemas: ProblemaLinha[] = []
  const porMaterial: Record<MaterialTipo, number> = {
    '1070_temperado': 0,
    '1070_sem_temperado': 0,
    inox: 0,
    outro: 0,
  }
  const chavesVistas = new Map<string, number>()
  let linhasComErro = 0
  let linhasVazias = 0

  if (colunasObrigatoriasAusentes.length === 0) {
    for (let i = indiceCabecalho + 1; i < matrizBruta.length; i += 1) {
      const bruta = matrizBruta[i] ?? []
      const texto = matrizTexto[i] ?? []
      const numeroLinha = primeiraLinhaExcel + i

      const lerTexto = (campo: CampoPlanilha): string => {
        const indice = indicePorCampo.get(campo)
        return indice === undefined ? '' : celulaTexto(bruta, texto, indice)
      }
      const lerNumero = (campo: CampoPlanilha) => {
        const indice = indicePorCampo.get(campo)
        return indice === undefined
          ? { vazio: true, valor: null }
          : celulaNumero(bruta, texto, indice)
      }

      const item = lerTexto('item')
      const lote = lerTexto('lote')
      const descricao = lerTexto('descricao')
      const localizacao = normalizarLocalizacao(lerTexto('localizacao'))

      const semIdentificacao = !item && !lote && !descricao && !localizacao
      if (semIdentificacao) {
        linhasVazias += 1
        continue
      }

      const avisos: string[] = []
      const erros: string[] = []

      if (!item) erros.push('Item vazio')

      const quantidade = lerNumero('quantidade')
      if (quantidade.vazio) erros.push('Total vazio')
      else if (quantidade.valor === null) erros.push('Total não é um número válido')
      else if (quantidade.valor < 0) avisos.push('Total negativo')

      const espessura = lerNumero('espessura')
      if (!espessura.vazio && espessura.valor === null) avisos.push('Espessura inválida')
      else if (espessura.vazio) avisos.push('Espessura vazia')

      const largura = lerNumero('largura')
      if (!largura.vazio && largura.valor === null) avisos.push('Largura inválida')
      else if (largura.vazio) avisos.push('Largura vazia')

      if (!localizacao) avisos.push('Sem localização')
      else if (!PADRAO_LOCALIZACAO.test(localizacao)) {
        avisos.push(`Localização fora do padrão (${localizacao})`)
      }

      if (!lote) avisos.push('Sem lote')

      if (erros.length > 0) {
        linhasComErro += 1
        problemas.push({
          linha: numeroLinha,
          severidade: 'erro',
          mensagem: erros.join(' · '),
        })
        continue
      }

      const chave = `${item}|${lote}|${localizacao}`
      const anterior = chavesVistas.get(chave)
      if (anterior !== undefined) {
        avisos.push(`Mesmo item, lote e localização da linha ${anterior}`)
      } else {
        chavesVistas.set(chave, numeroLinha)
      }

      const familia = lerTexto('familia')
      const material = classificarMaterial(descricao, familia)
      porMaterial[material] += 1

      if (avisos.length > 0) {
        problemas.push({
          linha: numeroLinha,
          severidade: 'aviso',
          mensagem: avisos.join(' · '),
        })
      }

      linhas.push({
        linha: numeroLinha,
        descricao,
        dep: lerTexto('dep'),
        familia,
        item,
        espessura: espessura.valor,
        estab: lerTexto('estab'),
        largura: largura.valor,
        lote,
        localizacao,
        superficie: lerTexto('superficie'),
        quantidade: quantidade.valor as number,
        material,
      })
    }
  }

  return {
    arquivoNome,
    aba,
    colunas,
    cabecalhosDesconhecidos,
    linhas,
    linhasComErro,
    linhasVazias,
    problemas,
    porMaterial,
    colunasObrigatoriasAusentes,
  }
}
