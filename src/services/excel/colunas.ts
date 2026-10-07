import type { CampoPlanilha } from '@/services/excel/tipos'
import { semAcentos } from '@/utils/normalize'

export interface DefinicaoColuna {
  campo: CampoPlanilha
  rotulo: string
  obrigatoria: boolean
  tipo: 'texto' | 'numero'
  /** Variações aceitas do cabeçalho, já na forma normalizada (ver chaveCabecalho). */
  apelidos: string[]
}

/** Colunas esperadas da planilha do ERP. */
export const COLUNAS_ESPERADAS: DefinicaoColuna[] = [
  {
    campo: 'descricao',
    rotulo: 'Descricao',
    obrigatoria: false,
    tipo: 'texto',
    apelidos: ['descricao', 'descr', 'descricaodoitem'],
  },
  { campo: 'dep', rotulo: 'Dep', obrigatoria: false, tipo: 'texto', apelidos: ['dep', 'deposito'] },
  {
    campo: 'familia',
    rotulo: 'Fam Com.',
    obrigatoria: false,
    tipo: 'texto',
    apelidos: ['famcom', 'familiacomercial', 'familia', 'famcomercial'],
  },
  { campo: 'item', rotulo: 'Item', obrigatoria: true, tipo: 'texto', apelidos: ['item', 'codigo', 'codigoitem'] },
  {
    campo: 'espessura',
    rotulo: 'Esp.',
    obrigatoria: true,
    tipo: 'numero',
    apelidos: ['esp', 'espessura'],
  },
  { campo: 'estab', rotulo: 'Estab', obrigatoria: false, tipo: 'texto', apelidos: ['estab', 'estabelecimento'] },
  {
    campo: 'largura',
    rotulo: 'Larg',
    obrigatoria: true,
    tipo: 'numero',
    apelidos: ['larg', 'largura'],
  },
  { campo: 'lote', rotulo: 'Lote', obrigatoria: true, tipo: 'texto', apelidos: ['lote'] },
  {
    campo: 'localizacao',
    rotulo: 'Localiz',
    obrigatoria: true,
    tipo: 'texto',
    apelidos: ['localiz', 'localizacao', 'local'],
  },
  {
    campo: 'superficie',
    rotulo: 'Superficie',
    obrigatoria: false,
    tipo: 'texto',
    apelidos: ['superficie', 'superf', 'sup'],
  },
  {
    campo: 'quantidade',
    rotulo: 'Total',
    obrigatoria: true,
    tipo: 'numero',
    apelidos: ['total', 'quantidade', 'qtde', 'qtd', 'saldo'],
  },
]

/** "Fam Com." -> "famcom", "Localização" -> "localizacao" */
export function chaveCabecalho(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return semAcentos(String(valor))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function acharColuna(cabecalho: unknown): DefinicaoColuna | null {
  const chave = chaveCabecalho(cabecalho)
  if (!chave) return null
  return COLUNAS_ESPERADAS.find((coluna) => coluna.apelidos.includes(chave)) ?? null
}
