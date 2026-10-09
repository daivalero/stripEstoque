import { registrarAlteracoes, type NovaAlteracao } from '@/services/alteracoes'
import { atualizarItem } from '@/services/estoque'
import type { EstoqueItem } from '@/types'
import { diferencasEntre, type Diferenca } from '@/utils/camposEstoque'

export function montarAlteracoes(
  userId: string,
  item: EstoqueItem,
  diferencas: Diferenca[],
  origem: string,
  observacao: string | null,
): NovaAlteracao[] {
  return diferencas.map((diferenca) => ({
    user_id: userId,
    item_id: item.id,
    item: item.item,
    lote: item.lote,
    material: item.material,
    espessura: item.espessura,
    largura: item.largura,
    campo_alterado: diferenca.campo,
    valor_anterior: diferenca.anterior,
    valor_novo: diferenca.novo,
    origem,
    observacao,
  }))
}

interface SalvarEdicaoParams {
  userId: string | undefined
  /** Item como estava antes da correção. */
  base: EstoqueItem
  /** Item como deve ficar. */
  novo: EstoqueItem
  /** Mudanças a registrar no histórico (por padrão, a diferença entre base e novo). */
  diferencas?: Diferenca[]
  origem: string
  observacao: string | null
}

/**
 * Corrige o item no estoque importado e registra antes/depois no histórico.
 * Se o histórico falhar, a correção do item é desfeita.
 */
export async function salvarEdicao({
  userId,
  base,
  novo,
  diferencas,
  origem,
  observacao,
}: SalvarEdicaoParams): Promise<Diferenca[]> {
  if (!userId) throw new Error('Sessão expirada. Entre novamente.')

  const registrar = diferencas ?? diferencasEntre(base, novo)
  const mudouItem = diferencasEntre(base, novo).length > 0
  if (registrar.length === 0 && !mudouItem) return []

  if (mudouItem) await atualizarItem(novo)

  if (registrar.length > 0) {
    try {
      await registrarAlteracoes(montarAlteracoes(userId, base, registrar, origem, observacao))
    } catch (error) {
      if (mudouItem) await atualizarItem(base).catch(() => undefined)
      throw error
    }
  }

  return registrar
}
