import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/** Faixa que aparece quando o aparelho fica sem internet. */
export function AvisoOffline() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const aoMudar = () => setOnline(navigator.onLine)
    window.addEventListener('online', aoMudar)
    window.addEventListener('offline', aoMudar)
    return () => {
      window.removeEventListener('online', aoMudar)
      window.removeEventListener('offline', aoMudar)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="safe-top flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-semibold text-black"
    >
      <WifiOff className="size-4" aria-hidden />
      Sem internet — as alterações não serão salvas até voltar o sinal.
    </div>
  )
}
