import { NavLink } from 'react-router-dom'
import {
  ClipboardCheck,
  History,
  Home,
  LogOut,
  Package,
  ScanLine,
  Settings,
  Upload,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import { isAdmin } from '@/utils/estoque'

const mainNav = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/scanner', label: 'Scanner', icon: ScanLine },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/inventario', label: 'Inventário', icon: ClipboardCheck },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/importar', label: 'Importar', icon: Upload },
] as const

export function Sidebar() {
  const { displayName, signOut, profile } = useAuth()

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg-elevated lg:flex">
      <div className="safe-top px-4 py-5">
        <Logo variant="compact" className="h-9 max-w-[220px]" />
        <p className="mt-3 px-1 text-xs text-text-secondary">
          Controle de estoque
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Menu lateral">
        {mainNav.filter((item) => item.to !== '/importar' || isAdmin(profile?.role)).map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-text'
                    : 'text-text-secondary hover:bg-bg-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-5',
                      isActive ? 'text-primary-soft' : 'text-text-muted',
                    )}
                    aria-hidden
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-border p-4">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary/15 text-text'
                : 'text-text-secondary hover:bg-bg-muted hover:text-text',
            )
          }
        >
          <Settings className="size-5 text-text-muted" aria-hidden />
          Configurações
        </NavLink>

        <div className="rounded-xl border border-border bg-bg-card px-3 py-3">
          <p className="truncate text-sm font-semibold text-text">
            {displayName}
          </p>
          <p className="truncate text-xs capitalize text-text-secondary">
            {profile?.role ?? 'operador'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-200 hover:bg-bg-muted hover:text-text"
        >
          <LogOut className="size-5" aria-hidden />
          Sair
        </button>
      </div>
    </aside>
  )
}
