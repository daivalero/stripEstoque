import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { listarAlteracoes, type AlteracaoComUsuario } from '@/services/alteracoes'

interface GrupoHistorico {
  chave: string
  created_at: string
  nome: string
  item: string
  lote: string | null
  origem: string
  observacao: string | null
  campos: { campo: string; anterior: string | null; novo: string | null }[]
}

function agrupar(linhas: AlteracaoComUsuario[]): GrupoHistorico[] {
  const grupos: GrupoHistorico[] = []

  for (const linha of linhas) {
    const ultimo = grupos[grupos.length - 1]
    const perto =
      ultimo &&
      ultimo.item === linha.item &&
      ultimo.nome === linha.nome &&
      Math.abs(new Date(ultimo.created_at).getTime() - new Date(linha.created_at).getTime()) < 8000

    const campo = {
      campo: linha.campo_alterado,
      anterior: linha.valor_anterior,
      novo: linha.valor_novo,
    }

    if (perto && ultimo) {
      ultimo.campos.push(campo)
      continue
    }

    grupos.push({
      chave: linha.id,
      created_at: linha.created_at,
      nome: linha.nome,
      item: linha.item,
      lote: linha.lote,
      origem: linha.origem,
      observacao: linha.observacao,
      campos: [campo],
    })
  }

  return grupos
}

function formatarQuando(iso: string): string {
  const data = new Date(iso)
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)

  if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`
  if (data.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`
  return `${data.toLocaleDateString('pt-BR')}, ${hora}`
}

function origemLegivel(origem: string): string {
  if (origem === 'conferencia_fisica') return 'Conferência física'
  return origem
}

function valorCampo(campo: string, valor: string | null): string {
  if (!valor) return '—'
  if (campo === 'Quantidade') {
    const numero = Number(valor)
    if (!Number.isNaN(numero)) {
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(numero)} kg`
    }
  }
  return valor
}

export function Alteracoes() {
  const [grupos, setGrupos] = useState<GrupoHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    void listarAlteracoes()
      .then((linhas) => {
        if (ativo) setGrupos(agrupar(linhas))
      })
      .catch((error: unknown) => {
        if (ativo) {
          setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.')
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Histórico</h2>
        <p className="mt-1 text-[15px] text-text-secondary">Conferências e correções registradas</p>
      </div>

      {carregando && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
        </div>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!carregando && !erro && grupos.length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">Nenhuma alteração registrada.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {grupos.map((grupo) => (
          <Card key={grupo.chave} padding="lg">
            <p className="text-sm text-text-secondary">{formatarQuando(grupo.created_at)}</p>
            <p className="mt-1 font-semibold text-text">{grupo.nome}</p>
            <p className="mt-3 text-base font-bold text-text">{grupo.item}</p>
            {grupo.lote && <p className="text-sm text-text-secondary">Lote {grupo.lote}</p>}
            <div className="mt-4 grid gap-3">
              {grupo.campos.map((campo) => (
                <div key={campo.campo}>
                  <p className="text-sm text-text-secondary">{campo.campo}</p>
                  <p className="mt-1 text-base font-semibold text-text">
                    {valorCampo(campo.campo, campo.anterior)}
                    <span className="mx-2 text-text-muted">→</span>
                    {valorCampo(campo.campo, campo.novo)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-text-muted">{origemLegivel(grupo.origem)}</p>
            {grupo.observacao && (
              <p className="mt-1 text-sm text-text-secondary">{grupo.observacao}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
