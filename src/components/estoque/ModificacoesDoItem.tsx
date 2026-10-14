import { ArrowRight, History } from 'lucide-react'
import { useHistorico } from '@/contexts/HistoricoContext'
import { agruparEdicoes, type Modificacao } from '@/services/historico'
import type { EstoqueItem } from '@/types'
import { CAMPOS, padronizarDigitado, valorLegivel, valorPadrao } from '@/utils/camposEstoque'
import { formatarDataHora } from '@/utils/data'

const ROTULO_ORIGEM: Record<string, string> = {
  conferencia_fisica: 'Conferência',
  inventario: 'Inventário',
  ajuste_manual: 'Edição',
}

/** Etiqueta curta "Modificado em 14/10/2026 às 09:32", ou nada se o item nunca foi mexido. */
export function EtiquetaModificado({ item, lote }: { item: string; lote: string | null }) {
  const { modificacoesDe } = useHistorico()
  const lista = modificacoesDe(item, lote)
  if (lista.length === 0) return null

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
      <History className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">Já modificado · {formatarDataHora(lista[0].criadoEm)}</span>
    </span>
  )
}

interface HistoricoDoItemProps {
  item: string
  lote: string | null
  /** Item como está agora no estoque importado (para avisar se o valor ainda não bate). */
  atual?: EstoqueItem
  /** Quantas edições mostrar (as mais novas). */
  maximo?: number
  titulo?: string
}

/** Lista o que já foi modificado neste item: quando, por quem e o que mudou. */
export function HistoricoDoItem({
  item,
  lote,
  atual,
  maximo = 3,
  titulo = 'Este item já foi modificado',
}: HistoricoDoItemProps) {
  const { modificacoesDe } = useHistorico()
  const modificacoes = modificacoesDe(item, lote)
  if (modificacoes.length === 0) return null

  const edicoes = agruparEdicoes(modificacoes)
  const mostradas = edicoes.slice(0, maximo)
  const maisNovaPorCampo = new Map<string, Modificacao>()
  for (const modificacao of modificacoes) {
    if (!maisNovaPorCampo.has(modificacao.campo)) maisNovaPorCampo.set(modificacao.campo, modificacao)
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-bold text-warning">
        <History className="size-4" aria-hidden />
        {titulo}
      </p>

      <div className="mt-3 grid gap-3">
        {mostradas.map((edicao) => (
          <div key={edicao.chave}>
            <p className="text-xs font-semibold text-text">
              {formatarDataHora(edicao.criadoEm)}{' '}
              <span className="font-normal text-text-secondary">
                · {edicao.nome} · {ROTULO_ORIGEM[edicao.origem] ?? edicao.origem}
              </span>
            </p>
            <div className="mt-1.5 grid gap-1.5">
              {edicao.campos.map((campo) => {
                const definicao = CAMPOS.find((candidato) => candidato.rotulo === campo.campo)
                const valorAtual =
                  atual && definicao && maisNovaPorCampo.get(campo.campo)?.id === campo.id
                    ? valorPadrao(atual, definicao.chave)
                    : undefined
                const gravado = definicao ? padronizarDigitado(definicao.chave, campo.novo ?? '') : campo.novo
                const naoBate = valorAtual !== undefined && valorAtual !== gravado

                return (
                  <div key={campo.id}>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold uppercase tracking-wide text-text-muted">
                        {campo.campo}
                      </span>
                      <span className="rounded-md bg-danger-soft px-2 py-0.5 text-danger line-through decoration-danger/60">
                        {valorLegivel(campo.campo, campo.anterior)}
                      </span>
                      <ArrowRight className="size-3 text-text-muted" aria-hidden />
                      <span className="rounded-md bg-success-soft px-2 py-0.5 font-bold text-success">
                        {valorLegivel(campo.campo, campo.novo)}
                      </span>
                    </div>
                    {naoBate && (
                      <p className="mt-1 text-xs text-warning">
                        No estoque importado agora está: {valorLegivel(campo.campo, valorAtual ?? null)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {edicoes.length > maximo && (
        <p className="mt-3 text-xs text-text-muted">
          + {edicoes.length - maximo} {edicoes.length - maximo === 1 ? 'edição mais antiga' : 'edições mais antigas'} no Histórico
        </p>
      )}
    </div>
  )
}
