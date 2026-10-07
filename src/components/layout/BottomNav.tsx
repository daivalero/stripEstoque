import { NavLink } from 'react-router-dom'
import { History, Home, Package, ScanLine } from 'lucide-react'
import { cn } from '@/utils/cn'

const items = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/scanner', label: 'Scanner', icon: ScanLine, highlight: true },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/historico', label: 'Histórico', icon: History },
] as const

export function BottomNav() {
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-elevated/95 backdrop-blur-lg lg:hidden"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-4 px-2">
        {items.map((item) => {
          const Icon = item.icon
          const isScanner = 'highlight' in item && item.highlight

          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200',
                    isActive ? 'text-text' : 'text-text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-xl transition-all duration-200',
                        isScanner &&
                          (isActive
                            ? 'bg-primary text-white shadow-soft'
                            : 'bg-primary/15 text-primary-soft'),
                        !isScanner && isActive && 'bg-bg-muted text-text',
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className={cn(isActive && 'text-text')}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
