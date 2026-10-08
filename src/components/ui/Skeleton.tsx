import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-bg-muted/80',
        className,
      )}
      aria-hidden
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-36 w-full rounded-[var(--radius-card)]" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  )
}

export function ListaItensSkeleton({ quantidade = 5 }: { quantidade?: number }) {
  return (
    <div className="flex flex-col gap-3 animate-fade-in" aria-hidden>
      {Array.from({ length: quantidade }, (_, indice) => (
        <Skeleton key={indice} className="h-[8.5rem] w-full rounded-[var(--radius-card)]" />
      ))}
    </div>
  )
}

export function ProdutoSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-fade-in" aria-hidden>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-[26rem] w-full rounded-[var(--radius-card)]" />
    </div>
  )
}
