import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card padding="lg" className="animate-fade-in text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-bg-muted text-text-secondary">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-text">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  )
}
