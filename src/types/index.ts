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
  /** Linha do estoque alterada (ausente em registros antigos). */
  item_id?: string | null
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

/**
 * Identificador do material. Os quatro valores abaixo têm visual próprio, mas
 * outras famílias vindas da coluna "Fam Com." também são preservadas.
 */
export type MaterialTipo = string

export interface MaterialMeta {
  id: MaterialTipo
  label: string
  colorClass: string
  dotClass: string
}

export type ImportacaoStatus = 'ativa' | 'arquivada'

export interface EstoqueImportacao {
  id: string
  arquivo: string
  usuario_id: string
  status: ImportacaoStatus
  total_itens: number
  created_at: string
}

export interface EstoqueItem {
  id: string
  importacao_id: string
  descricao: string | null
  dep: string | null
  fam_com: string | null
  item: string
  espessura: number | null
  estab: string | null
  largura: number | null
  lote: string | null
  localizacao: string | null
  superficie: string | null
  quantidade: number | null
  material: MaterialTipo | string | null
  created_at: string
}

export interface EstoqueItemInput {
  descricao: string | null
  dep: string | null
  fam_com: string | null
  item: string
  espessura: number | null
  estab: string | null
  largura: number | null
  lote: string | null
  localizacao: string | null
  superficie: string | null
  quantidade: number | null
  material: MaterialTipo
}

export const MATERIAL_META: Record<string, MaterialMeta> = {
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
