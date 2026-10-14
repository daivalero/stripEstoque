import { FileSpreadsheet } from 'lucide-react'
import { useHistorico } from '@/contexts/HistoricoContext'
import { formatarDataHora } from '@/utils/data'
import { cn } from '@/utils/cn'

interface EstoqueImportadoProps {
  className?: string
}

/** Mostra qual estoque (arquivo) está carregado e quando ele foi importado. */
export function EstoqueImportado({ className }: EstoqueImportadoProps) {
  const { importacao, carregado } = useHistorico()

  if (!carregado && !importacao) return null

  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-xs text-text-muted',
        className,
      )}
    >
      <FileSpreadsheet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      {importacao ? (
        <p className="min-w-0 leading-snug">
          <span className="font-semibold text-text">Estoque importado:</span>{' '}
          <span className="break-all">{importacao.arquivo}</span>
          <span className="block">em {formatarDataHora(importacao.created_at)}</span>
        </p>
      ) : (
        <p className="leading-snug">Nenhum estoque importado ainda.</p>
      )}
    </div>
  )
}