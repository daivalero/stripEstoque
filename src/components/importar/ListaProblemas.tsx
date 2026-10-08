import { Card } from '@/components/ui/Card'
import type { ProblemaLinha } from '@/services/excel/tipos'
import { cn } from '@/utils/cn'

const LIMITE = 40

export function ListaProblemas({ problemas }: { problemas: ProblemaLinha[] }) {
  if (problemas.length === 0) return null

  const ordenados = [...problemas].sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === 'erro' ? -1 : 1
    return a.linha - b.linha
  })
  const visiveis = ordenados.slice(0, LIMITE)

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
        Avisos e erros
      </h3>
      <ul className="mt-3 flex flex-col divide-y divide-border">
        {visiveis.map((problema) => (
          <li
            key={`${problema.linha}-${problema.mensagem}`}
            className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
                problema.severidade === 'erro'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-warning-soft text-warning',
              )}
            >
              {problema.severidade === 'erro' ? 'Erro' : 'Aviso'}
            </span>
            <p className="min-w-0 text-[15px] text-text">
              <span className="font-semibold">Linha {problema.linha}</span>
              <span className="text-text-secondary"> — {problema.mensagem}</span>
            </p>
          </li>
        ))}
      </ul>
      {ordenados.length > LIMITE && (
        <p className="mt-3 text-sm text-text-muted">
          Mostrando {LIMITE} de {ordenados.length.toLocaleString('pt-BR')}.
        </p>
      )}
    </Card>
  )
}
