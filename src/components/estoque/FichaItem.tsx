import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { listarOpcoesDeEscolha, type OpcoesDeEscolha } from '@/services/estoque'
import type { EstoqueItem } from '@/types'
import {
  CAMPOS,
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

/** Campos que a pessoa pode alterar (o resto acompanha sozinho ou fica como veio do ERP). */
const CHAVES_EDITAVEIS: ChaveCampo[] = [
  'item',
  'lote',
  'localizacao',
  'fam_com',
  'espessura',
  'largura',
  'superficie',
  'quantidade',
]

const OUTRA_OPCAO = '__outra__'

/** Campos escolhidos numa lista (com a opção Outro para digitar). */
const CAMPOS_DE_ESCOLHA = ['localizacao', 'fam_com', 'superficie'] as const
type ChaveEscolha = (typeof CAMPOS_DE_ESCOLHA)[number]

const EXEMPLOS: Record<ChaveEscolha, string> = {
  localizacao: 'Ex.: A-01-2',
  fam_com: 'Ex.: ACT1075',
  superficie: 'Ex.: BR',
}

const CLASSE_SELECT =
  'h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-4 text-[15px] text-text focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30'

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
  const [listas, setListas] = useState<OpcoesDeEscolha>({
    fam_com: [],
    localizacao: [],
    superficie: [],
  })
  const [digitando, setDigitando] = useState<Record<ChaveEscolha, boolean>>({
    localizacao: false,
    fam_com: false,
    superficie: false,
  })

  useEffect(() => {
    let ativo = true
    listarOpcoesDeEscolha()
      .then((opcoes) => {
        if (ativo) setListas(opcoes)
      })
      .catch(() => {
        // Sem a lista, o campo continua funcionando pela opção "Outro".
      })
    return () => {
      ativo = false
    }
  }, [])

  // Opções de cada lista: as do estoque, mais o valor atual (mesmo que não esteja no estoque).
  const opcoes = useMemo(() => {
    const montar = (chave: ChaveEscolha) => {
      const lista = new Set(listas[chave])
      const atual = padronizarDigitado(chave, formularioDe(base)[chave])
      if (atual) lista.add(atual)
      const local = chave === 'localizacao' ? padronizarDigitado('localizacao', localFisico) : null
      if (local) lista.add(local)
      return [...lista].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    }
    return {
      localizacao: montar('localizacao'),
      fam_com: montar('fam_com'),
      superficie: montar('superficie'),
    }
  }, [listas, base, localFisico])

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
    setFormulario((atual) => ({ ...atual, [chave]: valor }))
  }

  function escolher(chave: ChaveEscolha, valor: string) {
    if (valor === OUTRA_OPCAO) {
      setDigitando((atual) => ({ ...atual, [chave]: true }))
      return
    }
    setDigitando((atual) => ({ ...atual, [chave]: false }))
    alterar(chave, valor)
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
      className="safe-top safe-bottom fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/70"
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
            {CHAVES_EDITAVEIS.map((chave) => {
              const campo = CAMPOS.find((definicao) => definicao.chave === chave)
              if (!campo) return null

              const digitado = padronizarDigitado(chave, formulario[chave])
              const noErp = valorPadrao(original, chave)
              const dica =
                digitado !== noErp ? `Antes: ${valorLegivel(campo.rotulo, noErp)}` : undefined

              if ((CAMPOS_DE_ESCOLHA as readonly string[]).includes(chave)) {
                const escolha = chave as ChaveEscolha
                const textoAtual = formulario[escolha]
                const valorPadronizado = padronizarDigitado(escolha, textoAtual) ?? ''
                const valorDaLista = digitando[escolha] ? OUTRA_OPCAO : valorPadronizado
                return (
                  <div key={chave} className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`ficha-${chave}`}
                      className="text-sm font-medium text-text-secondary"
                    >
                      {campo.titulo}
                    </label>
                    <select
                      id={`ficha-${chave}`}
                      value={valorDaLista}
                      onChange={(event) => escolher(escolha, event.target.value)}
                      className={CLASSE_SELECT}
                    >
                      {!valorDaLista && <option value="">Escolha…</option>}
                      {opcoes[escolha].map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
                        </option>
                      ))}
                      <option value={OUTRA_OPCAO}>Outro (digitar)</option>
                    </select>
                    {digitando[escolha] && (
                      <Input
                        aria-label={`Digite: ${campo.titulo}`}
                        name={`ficha-${chave}-outro`}
                        placeholder={EXEMPLOS[escolha]}
                        value={textoAtual}
                        onChange={(event) => alterar(escolha, event.target.value)}
                        autoCapitalize="characters"
                        autoComplete="off"
                        autoFocus
                      />
                    )}
                    {dica && <p className="text-sm text-warning">{dica}</p>}
                  </div>
                )
              }
              return (
                <div key={chave} className="flex flex-col gap-1.5">
                  <Input
                    label={campo.titulo}
                    name={`ficha-${chave}`}
                    value={formulario[chave]}
                    onChange={(event) => alterar(chave, event.target.value)}
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
