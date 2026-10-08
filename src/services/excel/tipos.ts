import type { MaterialTipo } from '@/types'

export type CampoPlanilha =
  | 'descricao'
  | 'dep'
  | 'familia'
  | 'item'
  | 'espessura'
  | 'estab'
  | 'largura'
  | 'lote'
  | 'localizacao'
  | 'superficie'
  | 'quantidade'

/** Linha já validada e normalizada, pronta para gravar em estoque_itens. */
export interface LinhaImportada {
  /** Número da linha na planilha original (começa em 1, como no Excel). */
  linha: number
  descricao: string
  dep: string
  familia: string
  item: string
  espessura: number | null
  estab: string
  largura: number | null
  lote: string
  localizacao: string
  superficie: string
  quantidade: number
  material: MaterialTipo
}

export type SeveridadeProblema = 'erro' | 'aviso'

export interface ProblemaLinha {
  linha: number
  severidade: SeveridadeProblema
  mensagem: string
}

export interface ColunaMapeada {
  campo: CampoPlanilha
  rotulo: string
  obrigatoria: boolean
  /** Cabeçalho encontrado na planilha, ou null se a coluna não existe. */
  cabecalho: string | null
}

export interface ResultadoLeitura {
  arquivoNome: string
  aba: string
  colunas: ColunaMapeada[]
  cabecalhosDesconhecidos: string[]
  /** Linhas válidas (sem erro) que serão importadas. */
  linhas: LinhaImportada[]
  /** Linhas com erro, que NÃO serão importadas. */
  linhasComErro: number
  /** Linhas totalmente vazias ou de rodapé, ignoradas sem aviso. */
  linhasVazias: number
  problemas: ProblemaLinha[]
  /** Quantidade de linhas por material (somente linhas válidas). */
  porMaterial: Record<MaterialTipo, number>
  /** Colunas obrigatórias que não foram encontradas. */
  colunasObrigatoriasAusentes: ColunaMapeada[]
}

export class ErroPlanilha extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErroPlanilha'
  }
}
