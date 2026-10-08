import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { buscarImportacaoAtiva } from '@/services/estoque'
import type { EstoqueImportacao } from '@/types'

interface EstadoImportacaoAtiva {
  importacao: EstoqueImportacao | null
  loading: boolean
  erro: string | null
  recarregar: () => void
}

/** Importação (sessão) ativa: é dela que saem todos os itens exibidos. */
export function useImportacaoAtiva(): EstadoImportacaoAtiva {
  const { isConfigured, isDemo } = useAuth()
  const disponivel = isConfigured && !isDemo
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [loading, setLoading] = useState(disponivel)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!disponivel) return

    let ativo = true
    setLoading(true)
    setErro(null)

    buscarImportacaoAtiva()
      .then((resultado) => {
        if (ativo) setImportacao(resultado)
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar o estoque importado.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [disponivel, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  return {
    importacao: disponivel ? importacao : null,
    loading: disponivel ? loading : false,
    erro: disponivel
      ? erro
      : 'Conecte o Supabase (arquivo .env) e entre com um usuário real para ver o estoque.',
    recarregar,
  }
}
