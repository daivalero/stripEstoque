/** Registra o service worker (só no site publicado, nunca no localhost de desenvolvimento). */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o app funciona igual, só não abre offline.
    })
  })
}
