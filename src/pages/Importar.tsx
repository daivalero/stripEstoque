import { useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, History } from 'lucide-react'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useHistorico } from '@/contexts/HistoricoContext'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { importarEstoque } from '@/services/estoque'
import type { PreviaImportacao } from '@/services/excel'
import { chaveDoItem } from '@/services/historico'
import { formatarMedida, formatarQuantidade, isAdmin } from '@/utils/estoque'

export function Importar() {
  const { profile, user } = useAuth()
  const { success, error: toastErro } = useToast()
  const navigate = useNavigate()
  const [lendo, setLendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { porItem } = useHistorico()

  // Itens desta planilha que já foram modificados em algum estoque importado antes.
  const jaModificados = useMemo(() => {
    if (!previa) return 0
    return previa.itens.filter((item) => porItem.has(chaveDoItem(item.item, item.lote))).length
  }, [previa, porItem])

  if (!isAdmin(profile?.role)) {
    return (
      <div className="mx-auto max-w-lg animate-fade-in">
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">
          Atualizar estoque
        </h2>
        <Card padding="lg" className="mt-5">
          <p className="text-sm text-text-secondary">
            Somente administradores podem importar a planilha do ERP.
          </p>
        </Card>
      </div>
    )
  }

  async function aoSelecionar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return

    setErro(null)
    setPrevia(null)
    setLendo(true)
    try {
      const { lerPlanilhaEstoque } = await import('@/services/excel')
      const leitura = await lerPlanilhaEstoque(arquivo)
      setPrevia(leitura)
      if (leitura.faltando.length > 0) {
        setErro(`Cabeçalhos ausentes: ${leitura.faltando.join(', ')}.`)
      } else if (leitura.itens.length === 0) {
        setErro('Nenhum item válido encontrado na planilha.')
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível ler o arquivo.'
      setErro(mensagem)
      toastErro(mensagem)
    } finally {
      setLendo(false)
    }
  }

  async function confirmarImportacao() {
    if (!previa || !user || previa.faltando.length > 0 || previa.itens.length === 0) return

    setImportando(true)
    setErro(null)
    try {
      await importarEstoque({
        arquivo: previa.arquivo,
        usuarioId: user.id,
        itens: previa.itens,
      })
      success('Estoque importado')
      navigate('/estoque')
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível importar o estoque.'
      setErro(mensagem)
      toastErro(mensagem)
    } finally {
      setImportando(false)
    }
  }

  const podeImportar =
    Boolean(previa) &&
    previa!.faltando.length === 0 &&
    previa!.itens.length > 0 &&
    !importando

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">
          Atualizar estoque
        </h2>
        <p className="mt-1 text-[15px] text-text-secondary">
          A planilha original não é alterada. O sistema guarda uma cópia.
        </p>
      </div>

      <Card gradientTop padding="lg">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-soft">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-text">Selecionar arquivo</p>
            <p className="mt-1 text-sm text-text-secondary">Formatos .xlsx e .xls</p>
          </div>
        </div>
        <label className="mt-5 flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-white transition-colors duration-200 hover:bg-primary-hover">
          {lendo ? 'Lendo planilha...' : 'Escolher planilha'}
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => void aoSelecionar(event)}
            disabled={lendo || importando}
          />
        </label>
      </Card>

      {erro && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {erro}
        </div>
      )}

      {previa && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">
            {previa.arquivo} · aba {previa.aba}
          </p>
          <p className="mt-1 text-lg font-bold text-text">
            {previa.itens.length} itens prontos para importar
          </p>
          {previa.linhasIgnoradas > 0 && (
            <p className="mt-1 text-sm text-warning">
              {previa.linhasIgnoradas} linhas sem item foram ignoradas.
            </p>
          )}

          {jaModificados > 0 && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              <History className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>{jaModificados}</strong>{' '}
                {jaModificados === 1 ? 'item desta planilha já foi modificado' : 'itens desta planilha já foram modificados'}{' '}
                no histórico. Depois de importar, cada um aparece marcado com o dia e a hora, no estoque e
                no inventário.
              </span>
            </div>
          )}

          <ul className="mt-5 flex flex-col gap-3">
            {previa.itens.slice(0, 5).map((item, index) => (
              <li key={`${item.item}-${item.lote ?? index}`} className="rounded-xl border border-border p-4">
                <MaterialBadge tipo={item.material} />
                <p className="mt-2 text-lg font-bold text-text">
                  {formatarMedida(item.espessura, item.largura)}
                </p>
                <p className="mt-2 text-sm text-text">
                  {item.item} · {item.lote ?? 'sem lote'} ·                   {item.localizacao ?? 'sem local'} ·{' '}
                  {formatarQuantidade(item.quantidade)}
                </p>
              </li>
            ))}
          </ul>
          {previa.itens.length > 5 && (
            <p className="mt-3 text-sm text-text-muted">
              Mostrando 5 de {previa.itens.length}.
            </p>
          )}

          <Button
            size="lg"
            fullWidth
            className="mt-5"
            disabled={!podeImportar}
            loading={importando}
            onClick={() => void confirmarImportacao()}
          >
            Importar estoque
          </Button>
        </Card>
      )}
    </div>
  )
}
