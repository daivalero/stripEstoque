import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ScanLine } from 'lucide-react'
import { Conferencia } from '@/components/estoque/Conferencia'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
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
  const [conferindo, setConferindo] = useState(false)

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

          <div className="mt-6 grid gap-4">
            <Campo rotulo="Item" valor={item.item} />
            <Campo rotulo="Lote" valor={item.lote ?? '—'} />
            <Campo rotulo="Localização ERP" valor={item.localizacao ?? '—'} />
            <Campo rotulo="Quantidade" valor={formatarQuantidade(item.quantidade)} />
            <Campo rotulo="Superfície" valor={item.superficie ?? '—'} />
            <Campo rotulo="Família" valor={item.fam_com ?? '—'} />
          </div>

          {!conferindo && (
            <Button size="lg" fullWidth className="mt-6" onClick={() => setConferindo(true)}>
              Conferir material
            </Button>
          )}
        </Card>
      )}

      {item && conferindo && <Conferencia item={item} />}

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
