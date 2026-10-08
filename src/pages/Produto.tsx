import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, PackageX } from 'lucide-react'
import { DadoItem } from '@/components/estoque/DadoItem'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProdutoSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { buscarItem } from '@/services/estoque'
import type { EstoqueItem } from '@/types'
import { formatarMedida, formatarQuantidade } from '@/utils/normalize'

export function Produto() {
  const { id } = useParams<{ id: string }>()
  const { isConfigured, isDemo } = useAuth()
  const disponivel = isConfigured && !isDemo

  const [item, setItem] = useState<EstoqueItem | null>(null)
  const [loading, setLoading] = useState(disponivel)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!id || !disponivel) return

    let ativo = true
    setLoading(true)
    setErro(null)

    buscarItem(id)
      .then((resultado) => {
        if (ativo) setItem(resultado)
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar este material.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [id, disponivel, tentativa])

  const voltar = (
    <Link
      to="/estoque"
      className="inline-flex h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Estoque
    </Link>
  )

  if (!disponivel) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        {voltar}
        <EmptyState
          icon={AlertTriangle}
          title="Material indisponível"
          description="Conecte o Supabase (arquivo .env) e entre com um usuário real para ver os materiais."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <ProdutoSkeleton />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        {voltar}
        <EmptyState
          icon={AlertTriangle}
          title="Algo deu errado"
          description={erro}
          action={
            <Button variant="secondary" onClick={() => setTentativa((t) => t + 1)}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        {voltar}
        <EmptyState
          icon={PackageX}
          title="Material não encontrado"
          description="Este item não existe mais no estoque importado."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 animate-fade-in">
      {voltar}

      <Card gradientTop padding="lg">
        <MaterialBadge tipo={item.material} />

        <p className="mt-5 text-sm text-text-secondary">Medida</p>
        <p className="mt-1 text-[2rem] font-extrabold leading-tight tracking-tight text-text">
          {formatarMedida(item.espessura, item.largura)}
        </p>
        {item.descricao && (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.descricao}</p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-6">
          <DadoItem rotulo="Item" valor={item.item} className="col-span-2" />
          <DadoItem rotulo="Lote" valor={item.lote ?? ''} />
          <DadoItem rotulo="Localização ERP" valor={item.localizacao ?? ''} destaque />
          <DadoItem
            rotulo="Quantidade"
            valor={formatarQuantidade(item.quantidade)}
            destaque
            className="col-span-2"
          />
        </dl>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-6">
          <DadoItem rotulo="Superfície" valor={item.superficie ?? ''} />
          <DadoItem rotulo="Família comercial" valor={item.familia_comercial ?? ''} />
          <DadoItem rotulo="Depósito" valor={item.dep ?? ''} />
          <DadoItem rotulo="Estabelecimento" valor={item.estab ?? ''} />
        </dl>
      </Card>
    </div>
  )
}
