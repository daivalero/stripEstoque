import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { exportarCorrecoes, type PeriodoExportacao } from '@/services/exportacao'
import type { EstoqueImportacao } from '@/types'

type Opcao = 'hoje' | 'semana' | 'importacao' | 'tudo' | 'datas'

const classeCampo =
  'h-12 min-w-0 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-3 text-[15px] text-text focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30 sm:px-4'

function inicioDoDia(data: Date): Date {
  const copia = new Date(data)
  copia.setHours(0, 0, 0, 0)
  return copia
}

function dataHoraLocal(dataTexto: string, horaTexto: string, fimDoMinuto: boolean): Date | null {
  if (!dataTexto || !horaTexto) return null
  const [ano, mes, dia] = dataTexto.split('-').map(Number)
  const [hora, minuto] = horaTexto.split(':').map(Number)
  if (
    !ano ||
    !mes ||
    !dia ||
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null
  }

  const data = new Date(
    ano,
    mes - 1,
    dia,
    hora,
    minuto,
    fimDoMinuto ? 59 : 0,
    fimDoMinuto ? 999 : 0,
  )
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null
  }
  return data
}

function dataTexto(data = new Date()): string {
  const parte = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${parte(data.getMonth() + 1)}-${parte(data.getDate())}`
}

export function ExportarCorrecoes() {
  const { success, error: toastErro } = useToast()
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [opcao, setOpcao] = useState<Opcao>('hoje')
  const [de, setDe] = useState(dataTexto())
  const [ate, setAte] = useState(dataTexto())
  const [horaDe, setHoraDe] = useState('00:00')
  const [horaAte, setHoraAte] = useState('23:59')
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
      case 'hoje': {
        const inicio = dataHoraLocal(dataTexto(agora), horaDe, false)
        const fim = dataHoraLocal(dataTexto(agora), horaAte, true)
        if (!inicio || !fim || inicio > fim) return null
        return { desde: inicio.toISOString(), ate: fim.toISOString() }
      }
      case 'semana': {
        const inicio = inicioDoDia(agora)
        inicio.setDate(inicio.getDate() - 6)
        const comHora = dataHoraLocal(dataTexto(inicio), horaDe, false)
        const fim = dataHoraLocal(dataTexto(agora), horaAte, true)
        if (!comHora || !fim || comHora > fim) return null
        return { desde: comHora.toISOString(), ate: fim.toISOString() }
      }
      case 'importacao':
        return importacao ? { desde: importacao.created_at } : {}
      case 'datas': {
        const inicio = dataHoraLocal(de, horaDe, false)
        const fim = dataHoraLocal(ate, horaAte, true)
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
      toastErro('Confira as datas e horários: o início precisa ser antes do final.')
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
          <option value="datas">Escolher dias e horários</option>
          <option value="tudo">Todo o histórico</option>
        </select>
      </div>

      {opcao === 'datas' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exportar-de" className="text-sm font-medium text-text-secondary">
              Data inicial
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
              Data final
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

      {(opcao === 'hoje' || opcao === 'semana' || opcao === 'datas') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exportar-hora-de" className="text-sm font-medium text-text-secondary">
              Horário inicial
            </label>
            <input
              id="exportar-hora-de"
              type="time"
              value={horaDe}
              onChange={(event) => setHoraDe(event.target.value)}
              className={classeCampo}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exportar-hora-ate" className="text-sm font-medium text-text-secondary">
              Horário final
            </label>
            <input
              id="exportar-hora-ate"
              type="time"
              value={horaAte}
              onChange={(event) => setHoraAte(event.target.value)}
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
