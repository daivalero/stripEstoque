import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  BinaryBitmap,
  Code128Reader,
  DecodeHintType,
  HybridBinarizer,
  RGBLuminanceSource,
} from '@zxing/library'

interface BarcodeScannerProps {
  ativo: boolean
  onDetect: (codigo: string) => void
  onErro: (mensagem: string) => void
}

interface Recorte {
  x: number
  y: number
  w: number
  h: number
}

interface LeitorNativo {
  detect: (origem: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>
}

interface Leitura {
  texto: string
  etiqueta: string | null
}

function criarDicas() {
  const dicas = new Map()
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128])
  dicas.set(DecodeHintType.TRY_HARDER, true)
  return dicas
}

function criarLeitorNativo(): LeitorNativo | null {
  const Api = (
    window as unknown as {
      BarcodeDetector?: new (opcoes?: { formats?: string[] }) => LeitorNativo
    }
  ).BarcodeDetector
  if (!Api) return null
  try {
    return new Api({ formats: ['code_128'] })
  } catch {
    try {
      return new Api()
    } catch {
      return null
    }
  }
}

function codigoDeEtiqueta(codigo: string): string | null {
  const texto = codigo.trim().replace(/^\]C\d/, '')
  const etiqueta = texto.match(/\d{2,4};\d+\/\d+;\d+/)
  if (etiqueta) return etiqueta[0]
  if (/^\d{4,}\/\d+$/.test(texto)) return texto
  return null
}

function interpretar(texto: string): Leitura | null {
  const limpo = texto.trim()
  if (!limpo) return null
  return { texto: limpo, etiqueta: codigoDeEtiqueta(limpo) }
}

function limitar(recorte: Recorte, largura: number, altura: number): Recorte | null {
  const x = Math.max(0, recorte.x)
  const y = Math.max(0, recorte.y)
  const direita = Math.min(largura, recorte.x + recorte.w)
  const baixo = Math.min(altura, recorte.y + recorte.h)
  const w = direita - x
  const h = baixo - y
  if (w < 40 || h < 20) return null
  return { x, y, w, h }
}

export async function lerCodigoDeArquivo(arquivo: File): Promise<string> {
  const leitor = new BrowserMultiFormatReader(criarDicas())
  const url = URL.createObjectURL(arquivo)
  try {
    const resultado = await leitor.decodeFromImageUrl(url)
    const texto = resultado.getText().trim()
    return codigoDeEtiqueta(texto) ?? texto
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function BarcodeScanner({ ativo, onDetect, onErro }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const quadroRef = useRef<HTMLDivElement>(null)
  const faixaRef = useRef<MediaStreamTrack | null>(null)
  const ultimoCodigo = useRef('')
  const onDetectRef = useRef(onDetect)
  const onErroRef = useRef(onErro)
  const [status, setStatus] = useState('Abrindo câmera...')
  const [temLanterna, setTemLanterna] = useState(false)
  const [lanterna, setLanterna] = useState(false)

  useEffect(() => {
    onDetectRef.current = onDetect
    onErroRef.current = onErro
  }, [onDetect, onErro])

  useEffect(() => {
    if (!ativo) return
    const video = videoRef.current
    if (!video) return
    const elemento = video

    let parado = false
    let ocupado = false
    let timer = 0
    let passo = 0
    let quadros = 0
    let stream: MediaStream | undefined
    let ultimoRejeitado = ''
    let repeticoes = 0
    const leitor = new Code128Reader()
    const dicas = criarDicas()
    const nativo = criarLeitorNativo()
    const canvas = document.createElement('canvas')
    const contexto = canvas.getContext('2d', { willReadFrequently: true })

    function pararCamera() {
      window.clearTimeout(timer)
      stream?.getTracks().forEach((faixa) => faixa.stop())
      stream = undefined
      faixaRef.current = null
      elemento.srcObject = null
    }

    function recorteDoQuadro(): Recorte | null {
      const quadro = quadroRef.current
      const largura = elemento.videoWidth
      const altura = elemento.videoHeight
      if (!quadro || largura === 0 || altura === 0) return null

      const videoBox = elemento.getBoundingClientRect()
      const quadroBox = quadro.getBoundingClientRect()
      if (videoBox.width === 0 || quadroBox.width === 0) return null

      const escala = Math.max(videoBox.width / largura, videoBox.height / altura)
      const deslocamentoX = (videoBox.width - largura * escala) / 2
      const deslocamentoY = (videoBox.height - altura * escala) / 2
      const folgaX = quadroBox.width * 0.08
      const folgaY = quadroBox.height * 0.6

      return limitar(
        {
          x: (quadroBox.left - folgaX - videoBox.left - deslocamentoX) / escala,
          y: (quadroBox.top - folgaY - videoBox.top - deslocamentoY) / escala,
          w: (quadroBox.width + folgaX * 2) / escala,
          h: (quadroBox.height + folgaY * 2) / escala,
        },
        largura,
        altura,
      )
    }

    function faixaLarga(base: Recorte): Recorte | null {
      const largura = elemento.videoWidth
      const altura = elemento.videoHeight
      const centro = base.y + base.h / 2
      const h = Math.min(altura, base.h * 2.4)
      return limitar({ x: 0, y: centro - h / 2, w: largura, h }, largura, altura)
    }

    function desenhar(recorte: Recorte) {
      if (!contexto) return
      const alvo = 1280
      const escala = recorte.w > alvo ? alvo / recorte.w : recorte.w < 900 ? 900 / recorte.w : 1
      canvas.width = Math.max(1, Math.floor(recorte.w * escala))
      canvas.height = Math.max(1, Math.floor(recorte.h * escala))
      contexto.imageSmoothingEnabled = true
      contexto.imageSmoothingQuality = 'high'
      contexto.drawImage(
        elemento,
        recorte.x,
        recorte.y,
        recorte.w,
        recorte.h,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    }

    function decodificar(reforcar: boolean): string | null {
      if (!contexto) return null
      const largura = canvas.width
      const altura = canvas.height
      const pixels = contexto.getImageData(0, 0, largura, altura).data
      const cinza = new Uint8ClampedArray(largura * altura)

      let menor = 255
      let maior = 0
      for (let i = 0, j = 0; i < pixels.length; i += 4, j += 1) {
        const valor = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000
        cinza[j] = valor
        if (valor < menor) menor = valor
        if (valor > maior) maior = valor
      }

      if (reforcar && maior - menor > 20) {
        const fator = 255 / (maior - menor)
        for (let j = 0; j < cinza.length; j += 1) {
          cinza[j] = (cinza[j] - menor) * fator
        }
      }

      try {
        const fonte = new RGBLuminanceSource(cinza, largura, altura)
        const bitmap = new BinaryBitmap(new HybridBinarizer(fonte))
        return leitor.decode(bitmap, dicas).getText()
      } catch {
        return null
      }
    }

    async function lerVideoNativo(): Promise<string | null> {
      if (!nativo) return null
      try {
        const achados = await nativo.detect(elemento)
        return achados.map((item) => item.rawValue ?? '').find(Boolean) ?? null
      } catch {
        return null
      }
    }

    function entregar(codigo: string) {
      if (!codigo || codigo === ultimoCodigo.current || parado) return
      ultimoCodigo.current = codigo
      parado = true
      pararCamera()
      if (typeof navigator.vibrate === 'function') navigator.vibrate(80)
      onDetectRef.current(codigo)
    }

    function tratar(texto: string | null): boolean {
      if (!texto) return false
      const leitura = interpretar(texto)
      if (!leitura) return false

      if (leitura.etiqueta) {
        entregar(leitura.etiqueta)
        return true
      }

      if (leitura.texto === ultimoRejeitado) {
        repeticoes += 1
      } else {
        ultimoRejeitado = leitura.texto
        repeticoes = 1
      }
      setStatus(`Li "${leitura.texto}", mas não parece a etiqueta`)
      if (repeticoes >= 3) {
        entregar(leitura.texto)
        return true
      }
      return false
    }

    async function lerQuadro() {
      if (parado || ocupado || !contexto) return
      const base = recorteDoQuadro()
      if (!base) {
        timer = window.setTimeout(() => void lerQuadro(), 80)
        return
      }

      ocupado = true
      try {
        passo += 1
        quadros += 1
        const leituraVideo = lerVideoNativo()

        const etapa = passo % 3
        const regiao = etapa === 1 ? (faixaLarga(base) ?? base) : base
        desenhar(regiao)
        const lido = decodificar(etapa === 2)
        if (tratar(lido)) return

        const doVideo = await leituraVideo
        if (tratar(doVideo)) return

        if (quadros % 8 === 0 && !lido) {
          setStatus('Procurando a barra... chegue mais perto e deixe reta')
        }
      } catch {
        setStatus('Erro ao ler o quadro. Tente de novo')
      } finally {
        ocupado = false
        if (!parado) timer = window.setTimeout(() => void lerQuadro(), 20)
      }
    }

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErroRef.current('Este navegador não libera a câmera. Use o Safari no iPhone ou digite o código.')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        if (parado) {
          pararCamera()
          return
        }

        elemento.srcObject = stream
        elemento.muted = true
        elemento.setAttribute('playsinline', 'true')
        await elemento.play()

        const faixa = stream.getVideoTracks()[0]
        faixaRef.current = faixa ?? null
        const recursos = faixa?.getCapabilities?.() as
          | { focusMode?: string[]; exposureMode?: string[]; torch?: boolean }
          | undefined
        const ajustes: MediaTrackConstraintSet[] = []
        if (recursos?.focusMode?.includes('continuous')) {
          ajustes.push({ focusMode: 'continuous' } as MediaTrackConstraintSet)
        }
        if (recursos?.exposureMode?.includes('continuous')) {
          ajustes.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet)
        }
        if (faixa && ajustes.length > 0) {
          try {
            await faixa.applyConstraints({ advanced: ajustes })
          } catch {
            // Alguns aparelhos recusam o ajuste. A leitura segue sem ele.
          }
        }
        if (recursos?.torch) setTemLanterna(true)

        if (!parado) {
          setStatus('Encha o quadro com a barra')
          void lerQuadro()
        }
      } catch {
        if (!parado) {
          onErroRef.current('Não foi possível abrir a câmera. Libere o acesso ou digite o código.')
        }
      }
    }

    void iniciar()

    return () => {
      parado = true
      pararCamera()
      ultimoCodigo.current = ''
      setTemLanterna(false)
      setLanterna(false)
    }
  }, [ativo])

  async function alternarLanterna() {
    const faixa = faixaRef.current
    if (!faixa) return
    const ligada = !lanterna
    try {
      await faixa.applyConstraints({
        advanced: [{ torch: ligada } as MediaTrackConstraintSet],
      })
      setLanterna(ligada)
    } catch {
      setStatus('A lanterna não abriu neste aparelho')
    }
  }

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)] border border-border bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
        autoPlay
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={quadroRef}
          className="relative h-36 w-[96%] rounded-xl border-[3px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
        >
          <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-white" />
        </div>
      </div>
      {temLanterna && (
        <button
          type="button"
          onClick={() => void alternarLanterna()}
          className="absolute top-3 right-3 h-11 rounded-full bg-black/70 px-4 text-sm font-semibold text-white"
        >
          {lanterna ? 'Apagar' : 'Luz'}
        </button>
      )}
      <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white">
        {status}
      </p>
    </div>
  )
}
