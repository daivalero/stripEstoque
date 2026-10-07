import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, ...props },
  ref,
) {
  const inputId = id ?? props.name

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'h-12 w-full rounded-[var(--radius-input)] border bg-bg-elevated px-4 text-[15px] text-text',
          'placeholder:text-text-muted',
          'transition-colors duration-200',
          'hover:border-border-strong',
          'focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-sm text-text-muted">{hint}</p>
      )}
    </div>
  )
})
