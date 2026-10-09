import { Link } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'

const classeBotao =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors duration-200 hover:bg-bg-muted hover:text-text'

export function Header() {
  const { signOut } = useAuth()

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
        <Logo variant="compact" />
        <div className="flex items-center">
          <Link to="/configuracoes" className={classeBotao} aria-label="Configurações">
            <Settings className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className={classeBotao}
            aria-label="Sair da conta"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
