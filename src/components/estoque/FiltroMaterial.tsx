import { MATERIAL_META, type MaterialTipo } from '@/types'
import { cn } from '@/utils/cn'

export type FiltroMaterialValor = MaterialTipo | 'todos'

const opcoes: { valor: FiltroMaterialValor; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: '1070_temperado', rotulo: MATERIAL_META['1070_temperado'].label },
  { valor: '1070_sem_temperado', rotulo: MATERIAL_META['1070_sem_temperado'].label },
  { valor: 'inox', rotulo: MATERIAL_META.inox.label },
  { valor: 'outro', rotulo: MATERIAL_META.outro.label },
]

interface FiltroMaterialProps {
  valor: FiltroMaterialValor
  onChange: (valor: FiltroMaterialValor) => void
}

export function FiltroMaterial({ valor, onChange }: FiltroMaterialProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar por material"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97]',
              ativo
                ? 'border-primary-soft bg-primary/15 text-text'
                : 'border-border bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text',
            )}
          >
            {opcao.valor !== 'todos' && (
              <span
                className={cn('size-2.5 rounded-full', MATERIAL_META[opcao.valor].dotClass)}
                aria-hidden
              />
            )}
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
