/* Service worker do Controle de Estoque.
 *
 * Guarda só os arquivos do próprio app (telas, ícones, scanner), para ele abrir mesmo com
 * sinal ruim. Dados do estoque (Supabase) NUNCA passam por aqui: são sempre buscados online.
 * Para forçar a troca do cache em todos os aparelhos, aumente VERSAO.
 */
const VERSAO = 'v1'
const CACHE = `estoque-${VERSAO}`
const BASICO = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(BASICO))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((nome) => nome.startsWith('estoque-') && nome !== CACHE).map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function guardar(requisicao, resposta) {
  if (resposta && resposta.ok && resposta.type === 'basic') {
    const cache = await caches.open(CACHE)
    await cache.put(requisicao, resposta.clone())
  }
  return resposta
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET') return

  const url = new URL(requisicao.url)
  // Só arquivos do próprio site (Supabase e fontes externas não são tocados).
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return

  // Telas: tenta a internet primeiro (pega versão nova) e cai para a última guardada.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => guardar('/', resposta))
        .catch(() => caches.match('/').then((guardada) => guardada || Response.error())),
    )
    return
  }

  // Arquivos com nome único (hash) nunca mudam: pode usar direto do cache.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(requisicao).then((guardada) => guardada || fetch(requisicao).then((resposta) => guardar(requisicao, resposta))),
    )
    return
  }

  // Ícones, logo e manifest: mostra o guardado e atualiza por baixo.
  evento.respondWith(
    caches.match(requisicao).then((guardada) => {
      const rede = fetch(requisicao)
        .then((resposta) => guardar(requisicao, resposta))
        .catch(() => guardada)
      return guardada || rede
    }),
  )
})
