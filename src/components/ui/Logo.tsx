import { cn } from '@/utils/cn'

interface LogoProps {
  /** full = login / destaque | compact = header / sidebar */
  variant?: 'full' | 'compact'
  className?: string
}

const sizeClasses = {
  full: 'h-14 w-auto max-w-[min(100%,320px)] sm:h-[4.25rem]',
  compact: 'h-8 w-auto max-w-[min(100%,200px)]',
} as const

export function Logo({ variant = 'compact', className }: LogoProps) {
  return (
    <img
      src="/brand/stripsteel-logo.png"
      alt="Stripsteel"
      className={cn(
        'object-contain object-left',
        sizeClasses[variant],
        className,
      )}
      draggable={false}
    />
  )
}
