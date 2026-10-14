import { cn } from '@/utils/cn'
import { metaDoMaterial } from '@/utils/estoque'

interface MaterialBadgeProps {
  tipo: string | null | undefined
  className?: string
}

export function MaterialBadge({ tipo, className }: MaterialBadgeProps) {
  const meta = metaDoMaterial(tipo)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide',
        meta.colorClass,
        className,
      )}
    >
      <span
        className={cn('size-2.5 rounded-full', meta.dotClass)}
        aria-hidden
      />
      {meta.label}
    </span>
  )
}
