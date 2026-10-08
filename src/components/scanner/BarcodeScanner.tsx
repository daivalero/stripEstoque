import { useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface BarcodeScannerProps {
  ativo: boolean
  onDetect: (codigo: string) => void
  onErro: (mensagem: string) => void
}

export function BarcodeScanner({ ativo, onDetect, onErro }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const ultimoCodigo = useRef('')
  const onDetectRef = useRef(onDetect)
  const onErroRef = useRef(onErro)

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
    const leitor = new BrowserMultiFormatReader()
    let controles: { stop: () => void } | undefined

    async function iniciar() {
      try {
        controles = await leitor.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          elemento,
          (resultado) => {
            if (!resultado || parado) return
            const codigo = resultado.getText().trim()
            if (!codigo || codigo === ultimoCodigo.current) return
            ultimoCodigo.current = codigo
            parado = true
            controles?.stop()
            if (typeof navigator.vibrate === 'function') navigator.vibrate(80)
            onDetectRef.current(codigo)
          },
        )
      } catch {
        if (!parado) {
          onErroRef.current('Não foi possível abrir a câmera. Libere o acesso ou digite o código.')
        }
      }
    }

    void iniciar()

    return () => {
      parado = true
      controles?.stop()
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
        <div className="relative h-40 w-64 overflow-hidden rounded-2xl border-2 border-white/80">
          <div className="gradient-line absolute inset-x-3 top-0 h-0.5 animate-scan-line" />
        </div>
      </div>
    </div>
  )
}
