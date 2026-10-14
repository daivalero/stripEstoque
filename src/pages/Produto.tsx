import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, ScanLine } from 'lucide-react'
import { EstoqueImportado } from '@/components/estoque/EstoqueImportado'
import { FichaItem } from '@/components/estoque/FichaItem'
import { HistoricoDoItem } from '@/components/estoque/ModificacoesDoItem'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { salvarEdicao } from '@/services/edicao'
import { buscarItem } from '@/services/estoque'
import type { EstoqueItem } from '@/types'
import { comoMaterial, formatarMedida, formatarQuantidade } from '@/utils/estoque'

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-sm text-text-secondary">{rotulo}</p>
      <p className="mt-1 text-base font-semibold text-text">{valor}</p>
    </div>
  )
}

export function Produto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<EstoqueItem | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const { user } = useAuth()
  const { success, error: toastErro } = useToast()

  async function salvarEdicaoCompleta(novo: EstoqueItem) {
    if (!item) return
    setSalvando(true)
    try {
      const registradas = await salvarEdicao({
        userId: user?.id,
        base: item,
        novo,
        origem: 'ajuste_manual',
        observacao: 'Edição manual do material',
      })
      setItem(novo)
      setEditando(false)
      if (registradas.length > 0) success('Alterações salvas')
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!id) return
      setCarregando(true)
      try {
        const encontrado = await buscarItem(id)
        if (!ativo) return
        setItem(encontrado)
        if (!encontrado) setErro('Item não encontrado no estoque importado.')
      } catch (error) {
        if (!ativo) return
        setErro(error instanceof Error ? error.message : 'Não foi possível abrir o item.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [id])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <Link
        to="/estoque"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Estoque
      </Link>

      <EstoqueImportado />

      {carregando && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
        </div>
      )}

      {!carregando && erro && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">{erro}</p>
        </Card>
      )}

      {item && (
        <Card gradientTop padding="lg">
          <MaterialBadge tipo={comoMaterial(item.material)} />
          <p className="mt-4 text-[1.75rem] font-extrabold tracking-tight text-text">
            {formatarMedida(item.espessura, item.largura)}
          </p>
          {item.descricao && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {item.descricao}
            </p>
          )}

          <div className="mt-5 empty:hidden">
            <HistoricoDoItem item={item.item} lote={item.lote} atual={item} titulo="Já foi modificado antes" maximo={5} />
          </div>

          <div className="mt-6 grid gap-4">
            <Campo rotulo="Item" valor={item.item} />
            <Campo rotulo="Lote" valor={item.lote ?? '—'} />
            <Campo rotulo="Localização ERP" valor={item.localizacao ?? '—'} />
            <Campo rotulo="Total (kg)" valor={formatarQuantidade(item.quantidade)} />
            <Campo rotulo="Superfície" valor={item.superficie ?? '—'} />
            <Campo rotulo="Família" valor={item.fam_com ?? '—'} />
            <Campo rotulo="Depósito" valor={item.dep ?? '—'} />
            <Campo rotulo="Estabelecimento" valor={item.estab ?? '—'} />
          </div>

          <Button size="lg" fullWidth className="mt-6" onClick={() => setEditando(true)}>
            <Pencil className="size-5" aria-hidden />
            Editar todos os campos
          </Button>
        </Card>
      )}

      {item && editando && (
        <FichaItem
          original={item}
          base={item}
          localFisico={item.localizacao ?? ''}
          textoSemMudanca="Fechar sem alterar"
          salvando={salvando}
          onSalvar={(novo) => void salvarEdicaoCompleta(novo)}
          onCancelar={() => setEditando(false)}
        />
      )}

      {item && (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => navigate('/scanner', { replace: true })}
        >
          <ScanLine className="size-5" aria-hidden />
          Escanear outro
        </Button>
      )}
    </div>
  )
}
