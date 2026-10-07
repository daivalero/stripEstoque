import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Card } from '@/components/ui/Card'
import type { LinhaImportada } from '@/services/excel/tipos'
import { formatarMedida, formatarQuantidade } from '@/utils/normalize'

const AMOSTRA = 5

export function AmostraLinhas({ linhas }: { linhas: LinhaImportada[] }) {
  const amostra = linhas.slice(0, AMOSTRA)

  return (
    <section aria-labelledby="amostra-titulo">
      <h3
        id="amostra-titulo"
        className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted"
      >
        Pré-visualização
      </h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {amostra.map((linha) => (
          <Card key={linha.linha} padding="md">
            <div className="flex items-start justify-between gap-3">
              <MaterialBadge tipo={linha.material} />
              <span className="shrink-0 rounded-lg bg-bg-muted px-2.5 py-1 text-sm font-semibold text-text">
                {linha.localizacao || 'Sem local'}
              </span>
            </div>
            <p className="mt-3 text-xl font-extrabold tracking-tight text-text">
              {formatarMedida(linha.espessura, linha.largura)}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-text">{linha.item}</p>
                <p className="truncate text-sm text-text-secondary">
                  Lote {linha.lote || '—'}
                </p>
              </div>
              <p className="shrink-0 text-lg font-bold text-text">
                {formatarQuantidade(linha.quantidade)}
              </p>
            </div>
          </Card>
        ))}
      </div>
      {linhas.length > AMOSTRA && (
        <p className="mt-3 text-sm text-text-muted">
          e mais {(linhas.length - AMOSTRA).toLocaleString('pt-BR')} linhas
        </p>
      )}
    </section>
  )
}
