import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Card } from '@/components/ui/Card'
import type { EstoqueItem } from '@/types'
import { formatarMedida, formatarQuantidade } from '@/utils/normalize'

export function ItemCard({ item }: { item: EstoqueItem }) {
  return (
    <Link
      to={`/estoque/${item.id}`}
      className="block rounded-[var(--radius-card)]"
      aria-label={`Abrir ${item.item}, lote ${item.lote ?? 'sem lote'}`}
    >
      <Card interactive padding="md" className="animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <MaterialBadge tipo={item.material} />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-bg-muted px-2.5 py-1 text-sm font-semibold text-text">
            <MapPin className="size-3.5 text-text-secondary" aria-hidden />
            {item.localizacao ?? 'Sem local'}
          </span>
        </div>

        <p className="mt-3 text-2xl font-extrabold tracking-tight text-text">
          {formatarMedida(item.espessura, item.largura)}
        </p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-text">{item.item}</p>
            <p className="mt-0.5 truncate text-sm text-text-secondary">
              Lote {item.lote ?? '—'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-text-muted">Quantidade</p>
              <p className="text-lg font-bold text-text">{formatarQuantidade(item.quantidade)}</p>
            </div>
            <ChevronRight className="size-5 text-text-muted" aria-hidden />
          </div>
        </div>
      </Card>
    </Link>
  )
}
