import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ConfirmDialogProps {
  titulo: string
  children?: ReactNode
  confirmar: string
  cancelar?: string
  perigo?: boolean
  carregando?: boolean
  desabilitarConfirmar?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmDialog({
  titulo,
  children,
  confirmar,
  cancelar = 'Voltar',
  perigo = false,
  carregando = false,
  desabilitarConfirmar = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <Card padding="lg" className="w-full max-w-md animate-slide-up">
        <h3 className="text-xl font-bold text-text">{titulo}</h3>
        {children && <div className="mt-4 grid gap-3">{children}</div>}
        <div className="mt-5 grid gap-3">
          <Button
            size="lg"
            fullWidth
            variant={perigo ? 'danger' : 'primary'}
            loading={carregando}
            disabled={desabilitarConfirmar}
            onClick={onConfirmar}
          >
            {confirmar}
          </Button>
          <Button
            size="lg"
            fullWidth
            variant="secondary"
            disabled={carregando}
            onClick={onCancelar}
          >
            {cancelar}
          </Button>
        </div>
      </Card>
    </div>
  )
}
