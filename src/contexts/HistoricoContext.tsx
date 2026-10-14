import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { carregarConferencias, type Conferencia } from '@/services/conferencias'
import {
  agruparPorItem,
  carregarModificacoes,
  chaveDoItem,
  type Modificacao,
} from '@/services/historico'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { EVENTO_HISTORICO } from '@/services/historicoEventos'
import type { EstoqueImportacao } from '@/types'

interface HistoricoContextValor {
  carregado: boolean
  /** Estoque importado que está ativo agora (arquivo e horário da importação). */
  importacao: EstoqueImportacao | null
  /** Todas as modificações já feitas em itens, de qualquer estoque importado. */
  modificacoes: Modificacao[]
  /** Modificações de um item (mesmo item + lote), da mais nova para a mais antiga. */
  modificacoesDe: (item: string | null | undefined, lote: string | null | undefined) => Modificacao[]
  porItem: Map<string, Modificacao[]>
  /** Itens já conferidos no inventário (chave item|lote), de qualquer estoque importado. */
  conferencias: Map<string, Conferencia>
  conferenciaDe: (item: string | null | undefined, lote: string | null | undefined) => Conferencia | undefined
  recarregar: () => Promise<void>
}

const SEM_MODIFICACOES: Modificacao[] = []

const HistoricoContext = createContext<HistoricoContextValor | null>(null)

export function HistoricoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const usuarioId = user?.id ?? null
  const [modificacoes, setModificacoes] = useState<Modificacao[]>([])
  const [conferencias, setConferencias] = useState<Map<string, Conferencia>>(new Map())
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [carregado, setCarregado] = useState(false)

  const recarregar = useCallback(async () => {
    if (!usuarioId) return
    const [historico, inventario, ativa] = await Promise.allSettled([
      carregarModificacoes(),
      carregarConferencias(),
      buscarImportacaoAtiva(),
    ])
    if (ativa.status === 'fulfilled') setImportacao(ativa.value)
    // Se algo falhar, mantém o que já estava na tela (as telas próprias mostram o erro).
    if (historico.status === 'fulfilled') setModificacoes(historico.value)
    if (inventario.status === 'fulfilled') {
      setConferencias(new Map(inventario.value.map((conferencia) => [conferencia.chave, conferencia])))
    }
    setCarregado(true)
  }, [usuarioId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  // Recarrega sozinho quando alguém salva ou apaga uma modificação neste aparelho.
  useEffect(() => {
    const aoMudar = () => void recarregar()
    window.addEventListener(EVENTO_HISTORICO, aoMudar)
    return () => window.removeEventListener(EVENTO_HISTORICO, aoMudar)
  }, [recarregar])

  const porItem = useMemo(() => agruparPorItem(modificacoes), [modificacoes])

  const valor = useMemo<HistoricoContextValor>(
    () => ({
      carregado,
      importacao,
      modificacoes,
      porItem,
      conferencias,
      conferenciaDe: (item, lote) => conferencias.get(chaveDoItem(item, lote)),
      recarregar,
      modificacoesDe: (item, lote) => porItem.get(chaveDoItem(item, lote)) ?? SEM_MODIFICACOES,
    }),
    [carregado, importacao, modificacoes, porItem, conferencias, recarregar],
  )

  return <HistoricoContext.Provider value={valor}>{children}</HistoricoContext.Provider>
}

export function useHistorico(): HistoricoContextValor {
  const contexto = useContext(HistoricoContext)
  if (!contexto) throw new Error('useHistorico precisa estar dentro de HistoricoProvider')
  return contexto
}
