import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import type { EstoqueItem } from '@/types'
import { comoMaterial, formatarMedida, formatarQuantidade } from '@/utils/estoque'

export function ItemCard({ item }: { item: EstoqueItem }) {
  return (
    <Link to={`/produto/${item.id}`} className="block">
      <Card interactive padding="md" className="h-full">
        <MaterialBadge tipo={comoMaterial(item.material)} />
        <p className="mt-3 text-xl font-extrabold tracking-tight text-text">
          {formatarMedida(item.espessura, item.largura)}
        </p>
        <p className="mt-3 text-xs uppercase tracking-wide text-text-muted">Item</p>
        <p className="text-[15px] font-semibold text-text">{item.item}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Lote</p>
            <p className="text-sm text-text">{item.lote ?? '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-text-muted">
              {item.localizacao ?? 'Sem local'}
            </p>
            <p className="text-sm font-semibold text-text">
              {formatarQuantidade(item.quantidade)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
