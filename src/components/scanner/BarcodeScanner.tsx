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

type Decodificador = (imagem: ImageData, reforcar: boolean) => Promise<string | null>

interface Passo {
  regiao: 'visivel' | 'faixa'
  angulo: number
  reforcar?: boolean
}

/** Ordem em que cada quadro da câmera é analisado. Cobre barra torta até ~30 graus. */
const PASSOS: Passo[] = [
  { regiao: 'visivel', angulo: 0 },
  { regiao: 'faixa', angulo: 0 },
  { regiao: 'visivel', angulo: 12 },
  { regiao: 'visivel', angulo: -12 },
  { regiao: 'faixa', angulo: 0, reforcar: true },
  { regiao: 'visivel', angulo: 24 },
  { regiao: 'visivel', angulo: -24 },
]

const LADO_MAXIMO = 1280

function criarDicasJs() {
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

/** Aumenta o contraste da imagem inteira para barras desbotadas ou com reflexo. */
function realcarContraste(imagem: ImageData) {
  const dados = imagem.data
  let menor = 255
  let maior = 0
  for (let i = 0; i < dados.length; i += 4) {
    const valor = (dados[i] * 299 + dados[i + 1] * 587 + dados[i + 2] * 114) / 1000
    if (valor < menor) menor = valor
    if (valor > maior) maior = valor
  }
  if (maior - menor < 20) return
  const fator = 255 / (maior - menor)
  for (let i = 0; i < dados.length; i += 4) {
    const valor = (dados[i] * 299 + dados[i + 1] * 587 + dados[i + 2] * 114) / 1000
    const novo = (valor - menor) * fator
    dados[i] = novo
    dados[i + 1] = novo
    dados[i + 2] = novo
  }
}

function decodificadorJs(): Decodificador {
  const leitor = new Code128Reader()
  const dicas = criarDicasJs()
  return async (imagem, reforcar) => {
    if (reforcar) realcarContraste(imagem)
    const { data, width, height } = imagem
    const cinza = new Uint8ClampedArray(width * height)
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      cinza[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
    }
    try {
      const fonte = new RGBLuminanceSource(cinza, width, height)
      const bitmap = new BinaryBitmap(new HybridBinarizer(fonte))
      return leitor.decode(bitmap, dicas).getText()
    } catch {
      return null
    }
  }
}

async function decodificadorWasm(): Promise<Decodificador> {
  const [modulo, arquivo] = await Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  const enderecoWasm = arquivo.default
  await modulo.prepareZXingModule({
    overrides: {
      locateFile: (caminho: string, prefixo: string) =>
        caminho.endsWith('.wasm') ? enderecoWasm : prefixo + caminho,
    },
    fireImmediately: true,
  })

  return async (imagem, reforcar) => {
    if (reforcar) realcarContraste(imagem)
    const resultados = await modulo.readBarcodes(imagem, {
      formats: ['Code128'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: false,
      tryDownscale: true,
      maxNumberOfSymbols: 1,
    })
    return resultados[0]?.text ?? null
  }
}

let decodificadorCarregado: Promise<Decodificador> | null = null

function carregarDecodificador(): Promise<Decodificador> {
  if (!decodificadorCarregado) {
    decodificadorCarregado = decodificadorWasm().catch(() => decodificadorJs())
  }
  return decodificadorCarregado
}

export async function lerCodigoDeArquivo(arquivo: File): Promise<string> {
  const leitor = new BrowserMultiFormatReader(criarDicasJs())
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
    let iniciado = false
    let reiniciando = false
    let timer = 0
    let passo = 0
    let quadros = 0
    let falhasVigia = 0
    let stream: MediaStream | undefined
    let decodificar: Decodificador | null = null
    let ultimoRejeitado = ''
    let repeticoes = 0
    const nativo = criarLeitorNativo()
    const canvas = document.createElement('canvas')
    const contexto = canvas.getContext('2d', { willReadFrequently: true })

    void carregarDecodificador().then((funcao) => {
      decodificar = funcao
    })

    function pararCamera() {
      window.clearTimeout(timer)
      const atual = stream
      stream = undefined
      atual?.getTracks().forEach((faixa) => faixa.stop())
      if (atual && elemento.srcObject === atual) elemento.srcObject = null
      if (atual && faixaRef.current && atual.getTracks().includes(faixaRef.current)) {
        faixaRef.current = null
      }
    }

    function regiaoVisivel(): Recorte | null {
      const largura = elemento.videoWidth
      const altura = elemento.videoHeight
      if (largura === 0 || altura === 0) return null

      const caixa = elemento.getBoundingClientRect()
      if (caixa.width === 0 || caixa.height === 0) return null

      const escala = Math.max(caixa.width / largura, caixa.height / altura)
      const visivelW = caixa.width / escala
      const visivelH = caixa.height / escala
      return limitar(
        { x: (largura - visivelW) / 2, y: (altura - visivelH) / 2, w: visivelW, h: visivelH },
        largura,
        altura,
      )
    }

    function faixaDoQuadro(visivel: Recorte): Recorte | null {
      const quadro = quadroRef.current
      const caixa = elemento.getBoundingClientRect()
      if (!quadro || caixa.width === 0) return null
      const quadroBox = quadro.getBoundingClientRect()
      const escala = visivel.w / caixa.width

      const folgaY = quadroBox.height * 0.8
      return limitar(
        {
          x: visivel.x,
          y: visivel.y + (quadroBox.top - folgaY - caixa.top) * escala,
          w: visivel.w,
          h: (quadroBox.height + folgaY * 2) * escala,
        },
        elemento.videoWidth,
        elemento.videoHeight,
      )
    }

    function desenhar(recorte: Recorte, angulo: number): ImageData | null {
      if (!contexto) return null
      const escala = Math.min(1, LADO_MAXIMO / Math.max(recorte.w, recorte.h))
      const largura = Math.max(1, Math.floor(recorte.w * escala))
      const altura = Math.max(1, Math.floor(recorte.h * escala))
      canvas.width = largura
      canvas.height = altura

      contexto.setTransform(1, 0, 0, 1, 0, 0)
      contexto.fillStyle = '#808080'
      contexto.fillRect(0, 0, largura, altura)
      contexto.translate(largura / 2, altura / 2)
      contexto.rotate((angulo * Math.PI) / 180)
      contexto.drawImage(
        elemento,
        recorte.x,
        recorte.y,
        recorte.w,
        recorte.h,
        -largura / 2,
        -altura / 2,
        largura,
        altura,
      )
      contexto.setTransform(1, 0, 0, 1, 0, 0)
      return contexto.getImageData(0, 0, largura, altura)
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
      const visivel = regiaoVisivel()
      if (!visivel || !decodificar) {
        timer = window.setTimeout(() => void lerQuadro(), 60)
        return
      }

      ocupado = true
      try {
        quadros += 1
        const leituraVideo = lerVideoNativo()

        const etapa = PASSOS[passo % PASSOS.length]
        passo += 1
        const regiao = etapa.regiao === 'faixa' ? (faixaDoQuadro(visivel) ?? visivel) : visivel
        const imagem = desenhar(regiao, etapa.angulo)
        const lido = imagem ? await decodificar(imagem, Boolean(etapa.reforcar)) : null
        if (parado) return
        if (tratar(lido)) return

        const doVideo = await leituraVideo
        if (tratar(doVideo)) return

        if (quadros % 12 === 0 && !lido) {
          setStatus('Procurando a barra... chegue um pouco mais perto')
        }
      } catch {
        setStatus('Erro ao ler o quadro. Tentando de novo')
      } finally {
        ocupado = false
        if (!parado) timer = window.setTimeout(() => void lerQuadro(), 0)
      }
    }

    async function abrirCamera() {
      pararCamera()
      const novo = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (parado) {
        novo.getTracks().forEach((faixa) => faixa.stop())
        return
      }

      stream = novo
      elemento.srcObject = novo
      elemento.muted = true
      elemento.setAttribute('playsinline', 'true')
      await elemento.play()

      const faixa = novo.getVideoTracks()[0]
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
      setTemLanterna(Boolean(recursos?.torch))
    }

    async function iniciar(tentativa = 0): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        onErroRef.current('Este navegador não libera a câmera. Use o Safari no iPhone ou digite o código.')
        return
      }

      try {
        await abrirCamera()
        if (parado) return
        iniciado = true
        setStatus('Aponte para a barra')
        window.clearTimeout(timer)
        void lerQuadro()
      } catch {
        if (parado) return
        if (tentativa < 3) {
          setStatus('Reabrindo a câmera...')
          await new Promise((resolver) => window.setTimeout(resolver, 600))
          return iniciar(tentativa + 1)
        }
        onErroRef.current('Não foi possível abrir a câmera. Libere o acesso ou digite o código.')
      }
    }

    async function reiniciarCamera() {
      if (parado || reiniciando) return
      reiniciando = true
      setStatus('Reabrindo a câmera...')
      pararCamera()
      try {
        await iniciar()
      } finally {
        reiniciando = false
        falhasVigia = 0
      }
    }

    // Se a câmera congelar ou for tomada por outra tela, abre de novo sozinha.
    const vigia = window.setInterval(() => {
      if (parado || !iniciado || reiniciando) return
      const faixa = stream?.getVideoTracks()[0]
      const morta = !faixa || faixa.readyState === 'ended'
      const congelada = elemento.videoWidth === 0 || elemento.readyState < 2 || elemento.paused
      if (morta || congelada) falhasVigia += 1
      else falhasVigia = 0
      if (falhasVigia >= 2) void reiniciarCamera()
    }, 1500)

    function aoVoltarParaAba() {
      if (document.visibilityState !== 'visible' || parado || !iniciado) return
      const faixa = stream?.getVideoTracks()[0]
      if (!faixa || faixa.readyState === 'ended') void reiniciarCamera()
    }
    document.addEventListener('visibilitychange', aoVoltarParaAba)

    void iniciar()

    return () => {
      parado = true
      window.clearInterval(vigia)
      document.removeEventListener('visibilitychange', aoVoltarParaAba)
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
          className="relative h-36 w-[96%] rounded-xl border-[3px] border-white/90"
        >
          <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-white/80" />
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
