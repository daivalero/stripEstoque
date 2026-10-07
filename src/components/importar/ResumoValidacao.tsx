import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { ResultadoLeitura } from '@/services/excel/tipos'
import { MATERIAL_META, type MaterialTipo } from '@/types'
import { cn } from '@/utils/cn'

function Numero({
  valor,
  rotulo,
  tom = 'neutro',
}: {
  valor: number
  rotulo: string
  tom?: 'neutro' | 'ok' | 'aviso' | 'erro'
}) {
  return (
    <div>
      <p
        className={cn(
          'text-2xl font-extrabold tracking-tight',
          tom === 'ok' && 'text-success',
          tom === 'aviso' && 'text-warning',
          tom === 'erro' && 'text-danger',
          tom === 'neutro' && 'text-text',
        )}
      >
        {valor.toLocaleString('pt-BR')}
      </p>
      <p className="mt-0.5 text-sm text-text-secondary">{rotulo}</p>
    </div>
  )
}

export function ResumoValidacao({ resultado }: { resultado: ResultadoLeitura }) {
  const avisos = resultado.problemas.filter((p) => p.severidade === 'aviso').length
  const materiais = (Object.keys(MATERIAL_META) as MaterialTipo[]).filter(
    (tipo) => resultado.porMaterial[tipo] > 0,
  )

  return (
    <div className="flex flex-col gap-3">
      <Card padding="md">
        <p className="truncate text-[15px] font-semibold text-text">{resultado.arquivoNome}</p>
        <p className="mt-0.5 text-sm text-text-secondary">Aba “{resultado.aba}”</p>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <Numero valor={resultado.linhas.length} rotulo="Prontas" tom="ok" />
          <Numero
            valor={avisos}
            rotulo="Com aviso"
            tom={avisos > 0 ? 'aviso' : 'neutro'}
          />
          <Numero
            valor={resultado.linhasComErro}
            rotulo="Com erro"
            tom={resultado.linhasComErro > 0 ? 'erro' : 'neutro'}
          />
        </div>

        {materiais.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
            {materiais.map((tipo) => (
              <li key={tipo} className="flex items-center justify-between gap-3 text-[15px]">
                <span className="inline-flex items-center gap-2 text-text">
                  <span
                    className={cn('size-2.5 rounded-full', MATERIAL_META[tipo].dotClass)}
                    aria-hidden
                  />
                  {MATERIAL_META[tipo].label}
                </span>
                <span className="font-semibold text-text">
                  {resultado.porMaterial[tipo].toLocaleString('pt-BR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="md">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Colunas
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {resultado.colunas.map((coluna) => {
            const encontrada = coluna.cabecalho !== null
            const Icone = encontrada
              ? CheckCircle2
              : coluna.obrigatoria
                ? XCircle
                : AlertTriangle
            return (
              <li key={coluna.campo} className="flex items-center gap-2 text-[15px]">
                <Icone
                  className={cn(
                    'size-4 shrink-0',
                    encontrada && 'text-success',
                    !encontrada && coluna.obrigatoria && 'text-danger',
                    !encontrada && !coluna.obrigatoria && 'text-warning',
                  )}
                  aria-hidden
                />
                <span className={encontrada ? 'text-text' : 'text-text-secondary'}>
                  {coluna.rotulo}
                </span>
                {!encontrada && (
                  <span className="text-sm text-text-muted">
                    {coluna.obrigatoria ? 'não encontrada' : 'ausente (opcional)'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {resultado.cabecalhosDesconhecidos.length > 0 && (
          <p className="mt-3 text-sm text-text-muted">
            Colunas ignoradas: {resultado.cabecalhosDesconhecidos.join(', ')}
          </p>
        )}
      </Card>
    </div>
  )
}
