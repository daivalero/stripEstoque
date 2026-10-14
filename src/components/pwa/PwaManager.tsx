import { useEffect, useState } from 'react'
import { Download, Share, WifiOff, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function PwaManager() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useRegisterSW({
    onRegisterError(error) {
      console.error('Falha ao registrar o service worker:', error)
    },
  })

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setShowInstall(true)
    }
    const handleInstalled = () => {
      setInstallEvent(null)
      setShowInstall(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    const iosTimer = window.setTimeout(() => {
      if (isIos() && !isStandalone()) setShowInstall(true)
    }, 2500)

    return () => {
      window.clearTimeout(iosTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installApp() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setShowInstall(false)
    setInstallEvent(null)
  }

  const shouldShowInstall =
    showInstall && !dismissed && !isStandalone() && (installEvent || isIos())

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          className="safe-top fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-xs font-bold text-slate-950"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Sem internet — reconecte para consultar e atualizar o estoque.
        </div>
      )}

      {shouldShowInstall && (
        <aside
          aria-label="Instalar aplicativo"
          className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-[60] mx-auto max-w-md rounded-2xl border border-border-strong bg-bg-card p-4 shadow-2xl lg:bottom-5"
        >
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-muted hover:text-text"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>

          <div className="flex gap-3 pr-8">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-soft">
              {installEvent ? (
                <Download className="size-5" aria-hidden />
              ) : (
                <Share className="size-5" aria-hidden />
              )}
            </div>
            <div>
              <p className="font-bold text-text">Instale o Estoque</p>
              {installEvent ? (
                <>
                  <p className="mt-1 text-sm leading-5 text-text-secondary">
                    Acesse mais rápido e use o app mesmo com conexão instável.
                  </p>
                  <button
                    type="button"
                    onClick={() => void installApp()}
                    className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                  >
                    Instalar aplicativo
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm leading-5 text-text-secondary">
                  No navegador, toque em <strong className="text-text">Compartilhar</strong>{' '}
                  e depois em <strong className="text-text">Adicionar à Tela de Início</strong>.
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
