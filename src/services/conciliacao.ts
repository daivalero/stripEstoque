import type { Conferencia } from '@/services/conferencias'
import { chaveDoItem, type Modificacao } from '@/services/historico'
import type { EstoqueItem } from '@/types'
import { CAMPOS, padronizarDigitado, valorPadrao, type ChaveCampo } from '@/utils/camposEstoque'

/**
 * Situação de um campo que foi corrigido no app, comparado com o estoque importado mais novo:
 * - aplicada: o estoque novo já veio com o valor corrigido (o ERP recebeu a correção);
 * - faltando: o estoque novo ainda tem outro valor (a correção não chegou ao ERP);
 * - lancar: a correção foi feita neste mesmo estoque e ainda precisa ser lançada no ERP;
 * - fora: o item não está no estoque importado agora.
 */
export type SituacaoCampo = 'aplicada' | 'faltando' | 'lancar' | 'fora'

export interface CampoConciliado {
  campo: string
  /** Valor existente antes da correção feita no app. */
  anterior: string | null
  /** Valor que o app gravou (o que deveria estar no ERP). */
  esperado: string | null
  /** Valor que o estoque importado tem agora. */
  atual: string | null
  situacao: SituacaoCampo
  feitoEm: string
  nome: string
}

export interface ItemConciliado {
  chave: string
  item: string
  lote: string | null
  situacao: SituacaoCampo
  campos: CampoConciliado[]
  /** Linha do estoque importado (quando o item existe lá). */
  estoque?: EstoqueItem
  ultimaEm: string
}

export interface ResumoInventario {
  total: number
  conferidos: number
  ausentes: number
  movidos: number
  faltam: number
}

export interface LocalPendente {
  localizacao: string
  total: number
  feitos: number
}

export interface Conciliacao {
  itens: ItemConciliado[]
  contagem: Record<SituacaoCampo, number>
  inventario: ResumoInventario
  locais: LocalPendente[]
}

const PRIORIDADE: Record<SituacaoCampo, number> = { faltando: 3, lancar: 2, fora: 1, aplicada: 0 }

function chaveDoCampo(rotulo: string): ChaveCampo | null {
  return CAMPOS.find((campo) => campo.rotulo === rotulo)?.chave ?? null
}

function igual(chave: ChaveCampo, esperado: string | null, atual: EstoqueItem): boolean {
  return padronizarDigitado(chave, esperado ?? '') === valorPadrao(atual, chave)
}

/**
 * Compara tudo o que foi corrigido no app (histórico) com o estoque importado ativo e com o
 * inventário já conferido. Só vale a última correção de cada campo de cada item.
 */
export function conciliar(
  estoque: EstoqueItem[],
  porItem: Map<string, Modificacao[]>,
  conferencias: Map<string, Conferencia>,
  importadoEm: string,
): Conciliacao {
  const importadoMs = new Date(importadoEm).getTime()
  const noEstoque = new Map<string, EstoqueItem>()
  for (const linha of estoque) noEstoque.set(chaveDoItem(linha.item, linha.lote), linha)

  const itens: ItemConciliado[] = []

  for (const [chave, lista] of porItem) {
    // Última correção de cada campo (a lista vem da mais nova para a mais antiga).
    const ultimaPorCampo = new Map<string, Modificacao>()
    for (const modificacao of lista) {
      if (!ultimaPorCampo.has(modificacao.campo)) ultimaPorCampo.set(modificacao.campo, modificacao)
    }

    // Se o código ou o lote foi corrigido, o ERP novo traz o item com o código/lote novo.
    const novoItem = ultimaPorCampo.get('Item')?.novo ?? lista[0].item
    const novoLote = ultimaPorCampo.has('Lote') ? (ultimaPorCampo.get('Lote')?.novo ?? null) : lista[0].lote
    const linha = noEstoque.get(chaveDoItem(novoItem, novoLote)) ?? noEstoque.get(chave)

    const campos: CampoConciliado[] = []
    for (const modificacao of ultimaPorCampo.values()) {
      const campoChave = chaveDoCampo(modificacao.campo)
      if (!campoChave) continue

      let situacao: SituacaoCampo
      let atual: string | null = null

      if (!linha) {
        situacao = 'fora'
      } else {
        atual = valorPadrao(linha, campoChave)
        if (!igual(campoChave, modificacao.novo, linha)) situacao = 'faltando'
        else situacao = new Date(modificacao.criadoEm).getTime() > importadoMs ? 'lancar' : 'aplicada'
      }

      campos.push({
        campo: modificacao.campo,
        anterior: modificacao.anterior,
        esperado: modificacao.novo,
        atual,
        situacao,
        feitoEm: modificacao.criadoEm,
        nome: modificacao.nome,
      })
    }

    if (campos.length === 0) continue

    const situacao = campos.reduce<SituacaoCampo>(
      (pior, campo) => (PRIORIDADE[campo.situacao] > PRIORIDADE[pior] ? campo.situacao : pior),
      'aplicada',
    )

    itens.push({
      chave,
      item: lista[0].item,
      lote: lista[0].lote,
      situacao,
      campos,
      estoque: linha,
      ultimaEm: lista[0].criadoEm,
    })
  }

  itens.sort((a, b) => b.ultimaEm.localeCompare(a.ultimaEm))

  const contagem: Record<SituacaoCampo, number> = { aplicada: 0, faltando: 0, lancar: 0, fora: 0 }
  for (const item of itens) contagem[item.situacao] += 1

  // Inventário: cada item do estoque atual conferido (em qualquer estoque importado) conta como feito.
  const inventario: ResumoInventario = {
    total: estoque.length,
    conferidos: 0,
    ausentes: 0,
    movidos: 0,
    faltam: 0,
  }
  const porLocal = new Map<string, LocalPendente>()

  for (const linha of estoque) {
    const conferencia = conferencias.get(chaveDoItem(linha.item, linha.lote))
    const local = linha.localizacao?.trim() || 'Sem localização'
    const resumo = porLocal.get(local) ?? { localizacao: local, total: 0, feitos: 0 }
    resumo.total += 1
    if (conferencia) {
      resumo.feitos += 1
      if (conferencia.status === 'ok') inventario.conferidos += 1
      else if (conferencia.status === 'ausente') inventario.ausentes += 1
      else inventario.movidos += 1
    } else {
      inventario.faltam += 1
    }
    porLocal.set(local, resumo)
  }

  const locais = [...porLocal.values()]
    .filter((local) => local.feitos < local.total)
    .sort(
      (a, b) =>
        b.total - b.feitos - (a.total - a.feitos) ||
        a.localizacao.localeCompare(b.localizacao, 'pt-BR', { numeric: true }),
    )

  return { itens, contagem, inventario, locais }
}
