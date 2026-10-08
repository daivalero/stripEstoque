import { cn } from '@/utils/cn'

interface DadoItemProps {
  rotulo: string
  valor: string
  destaque?: boolean
  className?: string
}

export function DadoItem({ rotulo, valor, destaque = false, className }: DadoItemProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm text-text-secondary">{rotulo}</dt>
      <dd
        className={cn(
          'mt-1 break-words font-semibold text-text',
          destaque ? 'text-2xl tracking-tight' : 'text-base',
        )}
      >
        {valor || '—'}
      </dd>
    </div>
  )
}
