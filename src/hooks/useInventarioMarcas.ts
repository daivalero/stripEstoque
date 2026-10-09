import { useCallback, useEffect, useState } from 'react'
import type { EstoqueItem } from '@/types'

export type StatusMarca = 'ok' | 'ausente' | 'movido'

export interface Marca {
  status: StatusMarca
  /** Localização do item no ERP (cópia importada). */
  de: string | null
  /** Para onde o item foi movido (somente quando status = movido). */
  para?: string
  /** Versão atual do item, com as correções feitas na ficha. */
  item?: EstoqueItem
  /** Linha como veio do ERP (antes das correções). */
  original?: EstoqueItem
}

export type Marcas = Record<string, Marca>

const PREFIXO = 'estoque_inventario_marcas_'

function chave(importacaoId: string): string {
  return `${PREFIXO}${importacaoId}`
}

export function lerMarcas(importacaoId: string): Marcas {
  try {
    const texto = window.localStorage.getItem(chave(importacaoId))
    return texto ? (JSON.parse(texto) as Marcas) : {}
  } catch {
    return {}
  }
}

export function apagarMarcasLocais() {
  try {
    const apagar: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const nome = window.localStorage.key(i)
      if (nome?.startsWith(PREFIXO)) apagar.push(nome)
    }
    apagar.forEach((nome) => window.localStorage.removeItem(nome))
  } catch {
    // Sem acesso ao armazenamento local: nada a limpar.
  }
}

/** Conferência do inventário guardada neste aparelho, separada por importação. */
export function useInventarioMarcas(importacaoId: string | null) {
  const [marcas, setMarcas] = useState<Marcas>({})

  useEffect(() => {
    setMarcas(importacaoId ? lerMarcas(importacaoId) : {})
  }, [importacaoId])

  const gravar = useCallback(
    (proximas: Marcas) => {
      setMarcas(proximas)
      if (!importacaoId) return
      try {
        window.localStorage.setItem(chave(importacaoId), JSON.stringify(proximas))
      } catch {
        // Armazenamento cheio ou bloqueado: a marca vale só até fechar a tela.
      }
    },
    [importacaoId],
  )

  const marcar = useCallback(
    (itemId: string, marca: Marca) => {
      if (!importacaoId) return
      gravar({ ...lerMarcas(importacaoId), [itemId]: marca })
    },
    [gravar, importacaoId],
  )

  const desmarcar = useCallback(
    (itemId: string) => {
      if (!importacaoId) return
      const atual = { ...lerMarcas(importacaoId) }
      delete atual[itemId]
      gravar(atual)
    },
    [gravar, importacaoId],
  )

  const limparLocal = useCallback(
    (local: string) => {
      if (!importacaoId) return
      const atual = lerMarcas(importacaoId)
      const proximas: Marcas = {}
      for (const [id, marca] of Object.entries(atual)) {
        if (marca.de === local || marca.para === local) continue
        proximas[id] = marca
      }
      gravar(proximas)
    },
    [gravar, importacaoId],
  )

  return { marcas, marcar, desmarcar, limparLocal }
}

/** Itens do ERP desta localização que já foram resolvidos (conferidos, ausentes ou movidos). */
export function contarResolvidos(marcas: Marcas, local: string): number {
  let total = 0
  for (const marca of Object.values(marcas)) {
    if (marca.de === local) total += 1
  }
  return total
}
