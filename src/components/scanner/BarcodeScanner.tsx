import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

interface BarcodeScannerProps {
  ativo: boolean
  onDetect: (codigo: string) => void
  onErro: (mensagem: string) => void
}

function criarLeitor() {
  const dicas = new Map()
  dicas.set(DecodeHintType.TRY_HARDER, true)
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ])
  return new BrowserMultiFormatReader(dicas)
}

export async function lerCodigoDeArquivo(arquivo: File): Promise<string> {
  const leitor = criarLeitor()
  const url = URL.createObjectURL(arquivo)
  try {
    const resultado = await leitor.decodeFromImageUrl(url)
    return resultado.getText().trim()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function BarcodeScanner({ ativo, onDetect, onErro }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ultimoCodigo = useRef('')
  const onDetectRef = useRef(onDetect)
  const onErroRef = useRef(onErro)
  const [status, setStatus] = useState('Abrindo câmera...')

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
    let timer = 0
    let stream: MediaStream | undefined
    const leitor = criarLeitor()
    const canvas = document.createElement('canvas')
    const contexto = canvas.getContext('2d', { willReadFrequently: true })

    function pararCamera() {
      window.clearTimeout(timer)
      stream?.getTracks().forEach((faixa) => faixa.stop())
      stream = undefined
      elemento.srcObject = null
    }

    function lerQuadro() {
      if (parado || !contexto) return

      const largura = elemento.videoWidth
      const altura = elemento.videoHeight
      if (largura > 0 && altura > 0) {
        const recorteLargura = Math.floor(largura * 0.88)
        const recorteAltura = Math.max(80, Math.floor(recorteLargura * 0.38))
        const origemX = Math.floor((largura - recorteLargura) / 2)
        const origemY = Math.floor((altura - recorteAltura) / 2)
        const escala = recorteLargura > 1100 ? 1100 / recorteLargura : 1
        canvas.width = Math.max(1, Math.floor(recorteLargura * escala))
        canvas.height = Math.max(1, Math.floor(recorteAltura * escala))
        contexto.drawImage(
          elemento,
          origemX,
          origemY,
          recorteLargura,
          recorteAltura,
          0,
          0,
          canvas.width,
          canvas.height,
        )

        try {
          const resultado = leitor.decodeFromCanvas(canvas)
          const codigo = resultado.getText().trim()
          if (codigo && codigo !== ultimoCodigo.current) {
            ultimoCodigo.current = codigo
            parado = true
            pararCamera()
            if (typeof navigator.vibrate === 'function') navigator.vibrate(80)
            onDetectRef.current(codigo)
            return
          }
        } catch {
          // Quadro sem código legível. O próximo continua a busca.
        }
      }

      timer = window.setTimeout(lerQuadro, 180)
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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
        const recursos = faixa?.getCapabilities?.() as { focusMode?: string[] } | undefined
        if (faixa && recursos?.focusMode?.includes('continuous')) {
          await faixa.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
          })
        }

        if (!parado) {
          setStatus('Procurando código... mantenha na horizontal, dentro do quadro')
          lerQuadro()
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
    }
  }, [ativo])

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
        <div className="relative h-36 w-[84%] overflow-hidden rounded-2xl border-2 border-white/80">
          <div className="gradient-line absolute inset-x-3 top-0 h-0.5 animate-scan-line" />
        </div>
      </div>
      <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white">
        {status}
      </p>
    </div>
  )
}
