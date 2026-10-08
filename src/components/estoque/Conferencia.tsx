import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { registrarAlteracoes } from '@/services/alteracoes'
import type { EstoqueItem } from '@/types'
import { formatarQuantidade, normalizarLocalizacao, parseNumero } from '@/utils/estoque'

interface ConferenciaProps {
  item: EstoqueItem
}

export function Conferencia({ item }: ConferenciaProps) {
  const { user } = useAuth()
  const { success, error: toastErro } = useToast()
  const [localFisica, setLocalFisica] = useState(item.localizacao ?? '')
  const [quantidadeFisica, setQuantidadeFisica] = useState(
    item.quantidade == null ? '' : String(item.quantidade).replace('.', ','),
  )
  const [observacao, setObservacao] = useState('')
  const [comparado, setComparado] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const localErp = normalizarLocalizacao(item.localizacao)
  const localInformada = normalizarLocalizacao(localFisica)
  const qtdErp = item.quantidade == null ? null : Number(item.quantidade)
  const qtdInformada = parseNumero(quantidadeFisica)
  const localMudou = localInformada !== localErp
  const qtdMudou = qtdInformada !== qtdErp
  const igual = comparado && !localMudou && !qtdMudou
  const divergente = comparado && (localMudou || qtdMudou)

  function comparar() {
    if (qtdInformada == null) {
      toastErro('Informe a quantidade encontrada.')
      return
    }
    setComparado(true)
    setSalvo(false)
  }

  async function confirmar() {
    if (!user) return
    const alteracoes = []

    if (localMudou) {
      alteracoes.push({
        user_id: user.id,
        item: item.item,
        lote: item.lote,
        material: item.material,
        espessura: item.espessura,
        largura: item.largura,
        campo_alterado: 'Localização',
        valor_anterior: localErp,
        valor_novo: localInformada,
        origem: 'conferencia_fisica',
        observacao: observacao.trim() || null,
      })
    }

    if (qtdMudou) {
      alteracoes.push({
        user_id: user.id,
        item: item.item,
        lote: item.lote,
        material: item.material,
        espessura: item.espessura,
        largura: item.largura,
        campo_alterado: 'Quantidade',
        valor_anterior: qtdErp == null ? null : String(qtdErp),
        valor_novo: qtdInformada == null ? null : String(qtdInformada),
        origem: 'conferencia_fisica',
        observacao: observacao.trim() || null,
      })
    }

    setSalvando(true)
    try {
      await registrarAlteracoes(alteracoes)
      setModalAberto(false)
      setSalvo(true)
      success('Alteração salva')
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível salvar a alteração.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Dados do ERP
        </p>
        <div className="mt-4 grid gap-4">
          <Campo rotulo="Localização" valor={localErp ?? '—'} />
          <Campo rotulo="Quantidade" valor={formatarQuantidade(qtdErp)} />
        </div>
      </Card>

      <Card padding="lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Encontrado fisicamente
        </p>
        <div className="mt-4 grid gap-4">
          <Input
            label="Localização"
            name="local_fisica"
            value={localFisica}
            onChange={(event) => {
              setLocalFisica(event.target.value)
              setComparado(false)
            }}
            placeholder="P0061"
            autoCapitalize="characters"
          />
          <Input
            label="Quantidade (kg)"
            name="qtd_fisica"
            inputMode="decimal"
            value={quantidadeFisica}
            onChange={(event) => {
              setQuantidadeFisica(event.target.value)
              setComparado(false)
            }}
            placeholder="140"
          />
          <Input
            label="Observação"
            name="observacao"
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
            placeholder="Opcional"
          />
        </div>
        <Button size="lg" fullWidth className="mt-5" onClick={comparar}>
          Comparar
        </Button>
      </Card>

      {igual && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden />
          Estoque conferido
        </div>
      )}

      {divergente && (
        <Card padding="lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="size-5" aria-hidden />
            Divergência encontrada
          </div>
          <div className="mt-4 grid gap-4">
            {localMudou && (
              <Troca
                rotulo="Localização"
                anterior={localErp ?? '—'}
                novo={localInformada ?? '—'}
              />
            )}
            {qtdMudou && (
              <Troca
                rotulo="Quantidade"
                anterior={formatarQuantidade(qtdErp)}
                novo={formatarQuantidade(qtdInformada)}
              />
            )}
          </div>
          <Button
            size="lg"
            fullWidth
            className="mt-5"
            disabled={salvo}
            onClick={() => setModalAberto(true)}
          >
            {salvo ? 'Alteração salva' : 'Confirmar correção'}
          </Button>
        </Card>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <Card padding="lg" className="w-full max-w-md animate-slide-up">
            <h3 className="text-xl font-bold text-text">Confirmar alteração?</h3>
            <div className="mt-4 grid gap-4">
              {localMudou && (
                <Troca rotulo="Localização" anterior={localErp ?? '—'} novo={localInformada ?? '—'} />
              )}
              {qtdMudou && (
                <Troca
                  rotulo="Quantidade"
                  anterior={formatarQuantidade(qtdErp)}
                  novo={formatarQuantidade(qtdInformada)}
                />
              )}
            </div>
            <div className="mt-5 grid gap-3">
              <Button size="lg" fullWidth loading={salvando} onClick={() => void confirmar()}>
                Confirmar
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="secondary"
                disabled={salvando}
                onClick={() => setModalAberto(false)}
              >
                Voltar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-sm text-text-secondary">{rotulo}</p>
      <p className="mt-1 text-base font-semibold text-text">{valor}</p>
    </div>
  )
}

function Troca({
  rotulo,
  anterior,
  novo,
}: {
  rotulo: string
  anterior: string
  novo: string
}) {
  return (
    <div>
      <p className="text-sm text-text-secondary">{rotulo}</p>
      <p className="mt-1 text-base font-semibold text-text">
        {anterior}
        <span className="mx-2 text-text-muted">↓</span>
        {novo}
      </p>
    </div>
  )
}
