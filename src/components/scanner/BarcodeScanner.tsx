import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

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

function criarLeitor() {
  const dicas = new Map()
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128])
  return new BrowserMultiFormatReader(dicas)
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
  const texto = codigo.trim()
  if (/^\d{2,4};\d+\/\d+;\d+/.test(texto)) return texto
  if (/^\d{4,}\/\d+$/.test(texto)) return texto
  return null
}

function escolherCodigo(codigos: string[]): string | null {
  for (const codigo of codigos) {
    const etiqueta = codigoDeEtiqueta(codigo)
    if (etiqueta) return etiqueta
  }
  return null
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
  const leitor = criarLeitor()
  const url = URL.createObjectURL(arquivo)
  try {
    const resultado = await leitor.decodeFromImageUrl(url)
    const etiqueta = codigoDeEtiqueta(resultado.getText())
    if (!etiqueta) {
      throw new Error('A foto não mostrou o código da etiqueta. Aproxime só a barra.')
    }
    return etiqueta
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
    let stream: MediaStream | undefined
    const leitor = criarLeitor()
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
      const folgaX = quadroBox.width * 0.06
      const folgaY = quadroBox.height * 0.7

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

    function desenhar(recorte: Recorte) {
      if (!contexto) return
      const limite = 900
      const escala = recorte.w > limite ? limite / recorte.w : 1
      canvas.width = Math.max(1, Math.floor(recorte.w * escala))
      canvas.height = Math.max(1, Math.floor(recorte.h * escala))
      contexto.imageSmoothingEnabled = false
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

    async function lerCanvas(): Promise<string | null> {
      const nativoPromise = nativo
        ? nativo
            .detect(canvas)
            .then((achados) => escolherCodigo(achados.map((item) => item.rawValue ?? '')))
            .catch(() => null)
        : Promise.resolve(null)

      const zxingPromise = Promise.resolve().then(() => {
        try {
          return codigoDeEtiqueta(leitor.decodeFromCanvas(canvas).getText())
        } catch {
          return null
        }
      })

      const [peloNativo, peloZxing] = await Promise.all([nativoPromise, zxingPromise])
      return peloNativo ?? peloZxing
    }

    function aceitar(codigo: string) {
      if (!codigo || codigo === ultimoCodigo.current || parado) return
      ultimoCodigo.current = codigo
      parado = true
      pararCamera()
      if (typeof navigator.vibrate === 'function') navigator.vibrate(80)
      onDetectRef.current(codigo)
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
        desenhar(base)
        const codigo = await lerCanvas()
        if (codigo) {
          aceitar(codigo)
          return
        }
      } finally {
        ocupado = false
        if (!parado) timer = window.setTimeout(() => void lerQuadro(), 30)
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
          | { focusMode?: string[]; torch?: boolean }
          | undefined
        if (faixa && recursos?.focusMode?.includes('continuous')) {
          await faixa.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          })
        }
        if (recursos?.torch) setTemLanterna(true)

        if (!parado) {
          setStatus('Encaixe a barra no quadro')
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
          className="relative h-24 w-[92%] rounded-xl border-[3px] border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
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
