import { MATERIAL_META, type MaterialTipo } from '@/types'
import { cn } from '@/utils/cn'

interface MaterialBadgeProps {
  tipo: MaterialTipo
  className?: string
}

export function MaterialBadge({ tipo, className }: MaterialBadgeProps) {
  const meta = MATERIAL_META[tipo]

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
