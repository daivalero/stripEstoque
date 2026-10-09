import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import type { EstoqueItem } from '@/types'
import {
  CAMPOS,
  OPCOES_MATERIAL,
  ajustarCodigoDoMaterial,
  aplicarFormulario,
  diferencasEntre,
  formularioDe,
  padronizarDigitado,
  valorLegivel,
  valorPadrao,
  type ChaveCampo,
  type Formulario,
} from '@/utils/camposEstoque'
import { comoMaterial } from '@/utils/estoque'

interface FichaItemProps {
  /** Linha como veio do ERP (nunca muda). */
  original: EstoqueItem
  /** Versão atual, já com correções feitas antes neste aparelho. */
  base: EstoqueItem
  /** Localização onde o item está sendo conferido agora. */
  localFisico: string
  /** Texto do botão quando nada foi alterado. */
  textoSemMudanca?: string
  /** O item foi marcado como não encontrado antes. */
  estavaAusente?: boolean
  salvando: boolean
  onSalvar: (item: EstoqueItem) => void
  onCancelar: () => void
}

export function FichaItem({
  original,
  base,
  localFisico,
  textoSemMudanca = 'Está tudo certo — conferido',
  estavaAusente = false,
  salvando,
  onSalvar,
  onCancelar,
}: FichaItemProps) {
  const [formulario, setFormulario] = useState<Formulario>(() => ({
    ...formularioDe(base),
    localizacao: localFisico,
  }))
  const [erro, setErro] = useState<string | null>(null)

  const novoItem = useMemo(() => aplicarFormulario(base, formulario), [base, formulario])
  const mudancas = useMemo(() => {
    const lista = diferencasEntre(base, novoItem)
    if (estavaAusente && !lista.some((diferenca) => diferenca.chave === 'localizacao')) {
      return [
        ...lista,
        { chave: 'localizacao' as const, campo: 'Localização', anterior: null, novo: null },
      ]
    }
    return lista
  }, [base, novoItem, estavaAusente])

  function alterar(chave: ChaveCampo, valor: string) {
    setErro(null)
    setFormulario((atual) => {
      const proximo = { ...atual, [chave]: valor }
      // Trocar o material troca também o código ACT/AST na descrição e na família.
      if (chave === 'material') {
        const material = comoMaterial(valor)
        proximo.descricao = ajustarCodigoDoMaterial(atual.descricao, material)
        proximo.fam_com = ajustarCodigoDoMaterial(atual.fam_com, material)
      }
      return proximo
    })
  }

  function salvar() {
    if (!padronizarDigitado('item', formulario.item)) {
      setErro('O código do item não pode ficar vazio.')
      return
    }
    onSalvar(novoItem)
  }

  const nomeLocalErp = valorPadrao(original, 'localizacao')
  const mudaDeLocal = nomeLocalErp !== valorPadrao(novoItem, 'localizacao')

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha do item"
    >
      <div className="mx-auto flex min-h-full max-w-lg items-end p-3 sm:items-center">
        <Card padding="lg" className="my-3 w-full animate-slide-up">
          <MaterialBadge tipo={comoMaterial(novoItem.material)} />
          <h3 className="mt-3 text-xl font-extrabold text-text">{original.item}</h3>
          <p className="text-sm text-text-secondary">
            Lote {original.lote ?? '—'} · Confira e corrija o que estiver diferente
          </p>

          {mudaDeLocal && (
            <div className="mt-4 flex gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Antes este item estava em{' '}
                <strong>{nomeLocalErp ?? 'sem localização'}</strong>. Será registrado em{' '}
                <strong>{valorPadrao(novoItem, 'localizacao') ?? 'sem localização'}</strong>.
              </span>
            </div>
          )}

          <div className="mt-5 grid gap-4">
            {CAMPOS.map((campo) => {
              const digitado = padronizarDigitado(campo.chave, formulario[campo.chave])
              const noErp = valorPadrao(original, campo.chave)
              const diferente = digitado !== noErp
              const dica = diferente ? `Antes: ${valorLegivel(campo.rotulo, noErp)}` : undefined

              if (campo.tipo === 'material') {
                return (
                  <div key={campo.chave} className="flex flex-col gap-1.5">
                    <label
                      htmlFor="ficha-material"
                      className="text-sm font-medium text-text-secondary"
                    >
                      {campo.titulo}
                    </label>
                    <select
                      id="ficha-material"
                      value={comoMaterial(formulario.material)}
                      onChange={(event) => alterar('material', event.target.value)}
                      className="h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-4 text-[15px] text-text focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30"
                    >
                      {OPCOES_MATERIAL.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </select>
                    {dica && <p className="text-sm text-warning">{dica}</p>}
                  </div>
                )
              }

              return (
                <div key={campo.chave} className="flex flex-col gap-1.5">
                  <Input
                    label={campo.titulo}
                    name={`ficha-${campo.chave}`}
                    value={formulario[campo.chave]}
                    onChange={(event) => alterar(campo.chave, event.target.value)}
                    inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
                    autoCapitalize={campo.tipo === 'local' ? 'characters' : undefined}
                    autoComplete="off"
                  />
                  {dica && <p className="text-sm text-warning">{dica}</p>}
                </div>
              )
            })}
          </div>

          {erro && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {erro}
            </p>
          )}

          <div className="mt-6 grid gap-3">
            <Button size="lg" fullWidth loading={salvando} onClick={salvar}>
              {mudancas.length > 0
                ? `Salvar alterações (${mudancas.length})`
                : textoSemMudanca}
            </Button>
            <Button
              size="lg"
              fullWidth
              variant="secondary"
              disabled={salvando}
              onClick={onCancelar}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
