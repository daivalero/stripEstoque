import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  gradientTop?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    interactive = false,
    gradientTop = false,
    padding = 'md',
    children,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-bg-card shadow-card',
        'transition-all duration-200',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-card-hover active:scale-[0.99]',
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {gradientTop && (
        <div className="gradient-line absolute inset-x-0 top-0 h-0.5" />
      )}
      {children}
    </div>
  )
})
