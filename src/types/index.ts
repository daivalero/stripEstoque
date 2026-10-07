export type UserRole = 'operador' | 'gestor' | 'admin'

/** Espelha a tabela public.profiles já existente no Supabase */
export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole | string
  meta_individual?: number | null
}

export type AlteracaoOrigem =
  | 'conferencia_fisica'
  | 'inventario'
  | 'ajuste_manual'
  | 'importacao'

export interface EstoqueAlteracao {
  id: string
  user_id: string
  item: string
  lote: string | null
  material: string | null
  espessura: number | null
  largura: number | null
  campo_alterado: string
  valor_anterior: string | null
  valor_novo: string | null
  origem: AlteracaoOrigem | string
  observacao: string | null
  created_at: string
}

export type MaterialTipo = '1070_temperado' | '1070_sem_temperado' | 'inox' | 'outro'

export interface MaterialMeta {
  id: MaterialTipo
  label: string
  colorClass: string
  dotClass: string
}

export const MATERIAL_META: Record<MaterialTipo, MaterialMeta> = {
  '1070_temperado': {
    id: '1070_temperado',
    label: '1070 Temperado',
    colorClass: 'text-material-temperado',
    dotClass: 'bg-material-temperado',
  },
  '1070_sem_temperado': {
    id: '1070_sem_temperado',
    label: '1070 Sem Têmpera',
    colorClass: 'text-material-sem-temperado',
    dotClass: 'bg-material-sem-temperado',
  },
  inox: {
    id: 'inox',
    label: 'Inox',
    colorClass: 'text-material-inox',
    dotClass: 'bg-material-inox',
  },
  outro: {
    id: 'outro',
    label: 'Outro',
    colorClass: 'text-text-secondary',
    dotClass: 'bg-text-muted',
  },
}

export type ImportacaoStatus = 'ativa' | 'substituida' | 'concluida'

export interface EstoqueImportacao {
  id: string
  arquivo_nome: string
  usuario_id: string
  status: ImportacaoStatus
  total_itens: number
  linhas_ignoradas: number
  observacao: string | null
  created_at: string
}

export type StatusConferencia =
  | 'pendente'
  | 'conferido'
  | 'divergente'
  | 'nao_localizado'

/** Linha importada do ERP (tabela public.estoque_itens) */
export interface EstoqueItem {
  id: string
  importacao_id: string
  linha_origem: number | null
  descricao: string | null
  dep: string | null
  familia_comercial: string | null
  item: string
  espessura: number | null
  estab: string | null
  largura: number | null
  lote: string | null
  localizacao: string | null
  superficie: string | null
  quantidade: number
  material: MaterialTipo
  localizacao_fisica: string | null
  quantidade_fisica: number | null
  status_conferencia: StatusConferencia
  conferido_em: string | null
  conferido_por: string | null
  created_at: string
}
