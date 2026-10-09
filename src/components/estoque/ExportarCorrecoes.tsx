import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { exportarCorrecoes, type PeriodoExportacao } from '@/services/exportacao'
import type { EstoqueImportacao } from '@/types'

type Opcao = 'hoje' | 'semana' | 'importacao' | 'tudo' | 'datas'

const classeCampo =
  'h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-4 text-[15px] text-text focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30'

function inicioDoDia(data: Date): Date {
  const copia = new Date(data)
  copia.setHours(0, 0, 0, 0)
  return copia
}

function dataLocal(texto: string, fimDoDia: boolean): Date | null {
  if (!texto) return null
  const [ano, mes, dia] = texto.split('-').map(Number)
  if (!ano || !mes || !dia) return null
  return fimDoDia ? new Date(ano, mes - 1, dia, 23, 59, 59, 999) : new Date(ano, mes - 1, dia)
}

function hojeTexto(): string {
  const agora = new Date()
  const parte = (n: number) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${parte(agora.getMonth() + 1)}-${parte(agora.getDate())}`
}

export function ExportarCorrecoes() {
  const { success, error: toastErro } = useToast()
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [opcao, setOpcao] = useState<Opcao>('hoje')
  const [de, setDe] = useState(hojeTexto())
  const [ate, setAte] = useState(hojeTexto())
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

  function periodo(): PeriodoExportacao | null {
    const agora = new Date()
    switch (opcao) {
      case 'hoje':
        return { desde: inicioDoDia(agora).toISOString() }
      case 'semana': {
        const inicio = inicioDoDia(agora)
        inicio.setDate(inicio.getDate() - 6)
        return { desde: inicio.toISOString() }
      }
      case 'importacao':
        return importacao ? { desde: importacao.created_at } : {}
      case 'datas': {
        const inicio = dataLocal(de, false)
        const fim = dataLocal(ate, true)
        if (!inicio || !fim) return null
        if (inicio > fim) return null
        return { desde: inicio.toISOString(), ate: fim.toISOString() }
      }
      default:
        return {}
    }
  }

  async function exportar() {
    const escolhido = periodo()
    if (!escolhido) {
      toastErro('Confira as datas: a data inicial precisa ser antes da final.')
      return
    }

    setExportando(true)
    try {
      const resultado = await exportarCorrecoes(escolhido)
      success(
        resultado.itens === 1
          ? '1 item corrigido na planilha'
          : `${resultado.itens} itens corrigidos na planilha`,
      )
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível exportar.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="periodo-exportacao" className="text-sm font-medium text-text-secondary">
          Período das correções
        </label>
        <select
          id="periodo-exportacao"
          value={opcao}
          onChange={(event) => setOpcao(event.target.value as Opcao)}
          className={classeCampo}
        >
          <option value="hoje">Hoje</option>
          <option value="semana">Últimos 7 dias</option>
          {importacao && <option value="importacao">Desde a importação atual</option>}
          <option value="datas">Escolher dias</option>
          <option value="tudo">Todo o histórico</option>
        </select>
      </div>

      {opcao === 'datas' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exportar-de" className="text-sm font-medium text-text-secondary">
              De
            </label>
            <input
              id="exportar-de"
              type="date"
              value={de}
              max={ate || undefined}
              onChange={(event) => setDe(event.target.value)}
              className={classeCampo}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exportar-ate" className="text-sm font-medium text-text-secondary">
              Até
            </label>
            <input
              id="exportar-ate"
              type="date"
              value={ate}
              min={de || undefined}
              onChange={(event) => setAte(event.target.value)}
              className={classeCampo}
            />
          </div>
        </div>
      )}

      <Button size="lg" fullWidth loading={exportando} onClick={() => void exportar()}>
        <FileSpreadsheet className="size-5" aria-hidden />
        Baixar planilha (.xlsx)
      </Button>
    </div>
  )
}
