import { useRef, useState, type DragEvent } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

interface SeletorArquivoProps {
  onSelecionar: (arquivo: File) => void
  desabilitado?: boolean
}

export function SeletorArquivo({ onSelecionar, desabilitado = false }: SeletorArquivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function aoSoltar(evento: DragEvent<HTMLLabelElement>) {
    evento.preventDefault()
    setArrastando(false)
    const arquivo = evento.dataTransfer.files?.[0]
    if (arquivo && !desabilitado) onSelecionar(arquivo)
  }

  return (
    <Card padding="none" gradientTop>
      <label
        htmlFor="arquivo-planilha"
        onDragOver={(evento) => {
          evento.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 px-6 py-10 text-center transition-colors duration-200',
          arrastando ? 'bg-primary/10' : 'hover:bg-bg-card-hover',
          desabilitado && 'pointer-events-none opacity-60',
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft">
          <FileSpreadsheet className="size-7" aria-hidden />
        </span>
        <span className="text-lg font-bold tracking-tight text-text">Selecionar planilha</span>
        <span className="max-w-xs text-[15px] leading-relaxed text-text-secondary">
          Arquivo .xlsx ou .xls exportado do ERP. Uma cópia é lida no seu aparelho; o arquivo
          original não é alterado.
        </span>
        <input
          ref={inputRef}
          id="arquivo-planilha"
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="sr-only"
          disabled={desabilitado}
          onChange={(evento) => {
            const arquivo = evento.target.files?.[0]
            if (arquivo) onSelecionar(arquivo)
            evento.target.value = ''
          }}
        />
      </label>
    </Card>
  )
}
