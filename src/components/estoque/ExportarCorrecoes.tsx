import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { exportarCorrecoes } from '@/services/exportacao'
import type { EstoqueImportacao } from '@/types'

interface ExportarCorrecoesProps {
  /** Mostra só o botão, sem a escolha de período. */
  compacto?: boolean
}

type Periodo = 'importacao' | 'tudo'

export function ExportarCorrecoes({ compacto = false }: ExportarCorrecoesProps) {
  const { success, error: toastErro } = useToast()
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('importacao')
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    let ativo = true
    void buscarImportacaoAtiva()
      .then((encontrada) => {
        if (ativo) setImportacao(encontrada)
      })
      .catch(() => {
        if (ativo) setImportacao(null)
      })
    return () => {
      ativo = false
    }
  }, [])

  const usarImportacao = periodo === 'importacao' && importacao != null

  async function exportar() {
    setExportando(true)
    try {
      const resultado = await exportarCorrecoes(usarImportacao ? importacao?.created_at : undefined)
      success(
        resultado.ajustes === 1
          ? '1 correção exportada'
          : `${resultado.ajustes} correções exportadas`,
      )
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível exportar.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!compacto && importacao && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodo-exportacao" className="text-sm font-medium text-text-secondary">
            Período
          </label>
          <select
            id="periodo-exportacao"
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value as Periodo)}
            className="h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-4 text-[15px] text-text focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30"
          >
            <option value="importacao">Desde a importação atual</option>
            <option value="tudo">Todo o histórico</option>
          </select>
        </div>
      )}
      <Button
        size="lg"
        fullWidth
        variant={compacto ? 'secondary' : 'primary'}
        loading={exportando}
        onClick={() => void exportar()}
      >
        <FileSpreadsheet className="size-5" aria-hidden />
        Exportar correções (.xlsx)
      </Button>
    </div>
  )
}
