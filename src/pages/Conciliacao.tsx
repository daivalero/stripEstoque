import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock, Search, Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useHistorico } from '@/contexts/HistoricoContext'
import {
  conciliar,
  type CampoConciliado,
  type ItemConciliado,
  type SituacaoCampo,
} from '@/services/conciliacao'
import { buscarImportacaoAtiva, listarTodosItens } from '@/services/estoque'
import type { EstoqueImportacao, EstoqueItem } from '@/types'
import { valorLegivel } from '@/utils/camposEstoque'
import { formatarDataHora } from '@/utils/data'
import { formatarNumero } from '@/utils/estoque'

type Aba = SituacaoCampo | 'inventario'

const LIMITE_LISTA = 60

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'faltando', rotulo: 'Faltando no ERP' },
  { id: 'lancar', rotulo: 'Falta lançar' },
  { id: 'aplicada', rotulo: 'Já no ERP' },
  { id: 'fora', rotulo: 'Fora do estoque' },
  { id: 'inventario', rotulo: 'Inventário' },
]

const TEXTO_DA_SITUACAO: Record<SituacaoCampo, { titulo: string; ajuda: string; classe: string }> = {
  faltando: {
    titulo: 'Faltando no ERP',
    ajuda: 'O estoque importado ainda tem outro valor. A correção feita no app não chegou ao ERP.',
    classe: 'bg-danger-soft text-danger',
  },
  lancar: {
    titulo: 'Falta lançar no ERP',
    ajuda: 'Corrigido neste estoque. Exporte a planilha do Histórico e lance no ERP.',
    classe: 'bg-warning-soft text-warning',
  },
  aplicada: {
    titulo: 'Já está no ERP',
    ajuda: 'O estoque importado já veio com o valor corrigido.',
    classe: 'bg-success-soft text-success',
  },
  fora: {
    titulo: 'Fora do estoque',
    ajuda: 'O item corrigido não está neste estoque importado (saiu, acabou ou mudou de código/lote).',
    classe: 'bg-bg-muted text-text-secondary',
  },
}

export function Conciliacao() {
  const { porItem, conferencias, carregado } = useHistorico()
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [estoque, setEstoque] = useState<EstoqueItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('faltando')
  const [abaEscolhida, setAbaEscolhida] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const ativa = await buscarImportacaoAtiva()
        if (!ativo) return
        setImportacao(ativa)
        if (ativa) {
          const itens = await listarTodosItens(ativa.id)
          if (ativo) setEstoque(itens)
        }
      } catch (error) {
        if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível comparar o estoque.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const resultado = useMemo(
    () => (importacao ? conciliar(estoque, porItem, conferencias, importacao.created_at) : null),
    [importacao, estoque, porItem, conferencias],
  )

  // Abre direto na primeira aba que tem algo para resolver (até a pessoa escolher outra).
  useEffect(() => {
    if (!resultado || abaEscolhida) return
    const primeira = (['faltando', 'lancar'] as const).find((situacao) => resultado.contagem[situacao] > 0)
    if (primeira) setAba(primeira)
  }, [resultado, abaEscolhida])

  const termo = busca.trim().toLowerCase().replace(/\s+/g, '')
  const itensDaAba = useMemo(() => {
    if (!resultado || aba === 'inventario') return []
    return resultado.itens.filter((item) => {
      if (item.situacao !== aba) return false
      if (!termo) return true
      return `${item.item}${item.lote ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(termo)
    })
  }, [resultado, aba, termo])

  const locaisDaAba = useMemo(() => {
    if (!resultado || aba !== 'inventario') return []
    return resultado.locais.filter((local) => !termo || local.localizacao.toLowerCase().replace(/\s+/g, '').includes(termo))
  }, [resultado, aba, termo])

  const pronto = !carregando && carregado

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Conciliação</h2>
        <p className="mt-1 text-[15px] text-text-secondary">
          O que você corrigiu no app comparado com o estoque importado, e o que ainda falta conferir.
        </p>
      </div>

      {!pronto && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        </div>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {pronto && !erro && !importacao && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">Nenhum estoque importado ainda.</p>
        </Card>
      )}

      {pronto && !erro && importacao && resultado && (
        <>
          <Card padding="md" gradientTop>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Upload className="size-4" aria-hidden />
              Estoque de {formatarDataHora(importacao.created_at)}
            </div>
            <p className="mt-1 truncate text-sm text-text-muted">{importacao.arquivo}</p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Resumo valor={resultado.contagem.faltando} rotulo="Faltando" classe="text-danger" />
              <Resumo valor={resultado.contagem.lancar} rotulo="Falta lançar" classe="text-warning" />
              <Resumo valor={resultado.contagem.aplicada} rotulo="Já no ERP" classe="text-success" />
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-sm text-text-secondary">Inventário</p>
              <p className="mt-1 text-xl font-extrabold text-text">
                {formatarNumero(resultado.inventario.total - resultado.inventario.faltam)}
                <span className="text-base font-semibold text-text-muted">
                  {' '}
                  de {formatarNumero(resultado.inventario.total)} itens conferidos
                </span>
              </p>
              <Barra
                feito={resultado.inventario.total - resultado.inventario.faltam}
                total={resultado.inventario.total}
              />
            </div>
          </Card>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
            {ABAS.map((opcao) => {
              const quantidade =
                opcao.id === 'inventario' ? resultado.inventario.faltam : resultado.contagem[opcao.id]
              return (
                <button
                  key={opcao.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === opcao.id}
                  onClick={() => {
                    setAba(opcao.id)
                    setAbaEscolhida(true)
                  }}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    aba === opcao.id
                      ? 'border-primary-soft bg-primary/20 text-text'
                      : 'border-border bg-bg-card text-text-secondary hover:border-border-strong'
                  }`}
                >
                  {opcao.rotulo} <span className="text-text-muted">({quantidade})</span>
                </button>
              )
            })}
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              name="busca-conciliacao"
              aria-label="Buscar"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder={aba === 'inventario' ? 'Buscar localização' : 'Buscar item ou lote'}
              autoComplete="off"
              className="pl-12"
            />
          </div>

          {aba !== 'inventario' && (
            <>
              <p className="text-sm text-text-secondary">{TEXTO_DA_SITUACAO[aba].ajuda}</p>

              {itensDaAba.length === 0 && (
                <Card padding="lg">
                  <p className="text-sm text-text-secondary">
                    {resultado.itens.length === 0
                      ? 'Nenhuma correção feita ainda.'
                      : 'Nada nesta lista.'}
                  </p>
                </Card>
              )}

              <div className="flex flex-col gap-3">
                {itensDaAba.slice(0, LIMITE_LISTA).map((item) => (
                  <CartaoConciliado key={item.chave} item={item} />
                ))}
              </div>
              {itensDaAba.length > LIMITE_LISTA && (
                <p className="text-center text-sm text-text-muted">
                  Mostrando {LIMITE_LISTA} de {itensDaAba.length}. Use a busca para achar um item.
                </p>
              )}
            </>
          )}

          {aba === 'inventario' && (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                <Resumo valor={resultado.inventario.conferidos} rotulo="Conferidos" classe="text-success" />
                <Resumo valor={resultado.inventario.movidos} rotulo="Movidos" classe="text-warning" />
                <Resumo valor={resultado.inventario.ausentes} rotulo="Não achados" classe="text-danger" />
                <Resumo valor={resultado.inventario.faltam} rotulo="Faltam" classe="text-text" />
              </div>

              {resultado.locais.length === 0 && (
                <Card padding="lg">
                  <p className="flex items-center gap-2 text-sm font-semibold text-success">
                    <CheckCircle2 className="size-5" aria-hidden />
                    Todos os itens deste estoque já foram conferidos.
                  </p>
                </Card>
              )}

              <div className="flex flex-col gap-3">
                {locaisDaAba.slice(0, LIMITE_LISTA).map((local) => (
                  <Link
                    key={local.localizacao}
                    to={`/inventario/${encodeURIComponent(local.localizacao)}`}
                    className="block"
                  >
                    <Card interactive padding="md">
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-bold text-text">{local.localizacao}</p>
                          <p className="text-sm text-text-secondary">
                            Faltam {local.total - local.feitos} de {local.total}{' '}
                            {local.total === 1 ? 'item' : 'itens'}
                          </p>
                          <Barra feito={local.feitos} total={local.total} />
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
              {locaisDaAba.length > LIMITE_LISTA && (
                <p className="text-center text-sm text-text-muted">
                  Mostrando {LIMITE_LISTA} de {locaisDaAba.length}. Use a busca para achar a localização.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Resumo({ valor, rotulo, classe }: { valor: number; rotulo: string; classe: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated px-2 py-3">
      <p className={`text-2xl font-extrabold ${classe}`}>{formatarNumero(valor)}</p>
      <p className="mt-0.5 text-xs text-text-secondary">{rotulo}</p>
    </div>
  )
}

function Barra({ feito, total }: { feito: number; total: number }) {
  const percentual = total === 0 ? 0 : Math.round((feito / total) * 100)
  return (
    <div
      className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${percentual}%` }} />
    </div>
  )
}

function CartaoConciliado({ item }: { item: ItemConciliado }) {
  const texto = TEXTO_DA_SITUACAO[item.situacao]
  const conteudo = (
    <Card padding="md" interactive={Boolean(item.estoque)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-text">{item.item}</p>
          <p className="text-sm text-text-secondary">
            {item.lote ? `Lote ${item.lote}` : 'Sem lote'}
            {item.estoque?.localizacao ? ` · ${item.estoque.localizacao}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${texto.classe}`}>
          {texto.titulo}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {item.campos.map((campo) => (
          <div key={campo.campo} className="rounded-xl bg-bg-elevated px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{campo.campo}</p>
            <ComparacaoCampo campo={campo} />
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="size-3" aria-hidden />
              Corrigido em {formatarDataHora(campo.feitoEm)} · {campo.nome}
            </p>
          </div>
        ))}
      </div>

      {item.situacao === 'fora' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <AlertTriangle className="size-3.5" aria-hidden />
          Não encontrado no estoque importado atual.
        </p>
      )}
    </Card>
  )

  return item.estoque ? (
    <Link to={`/produto/${item.estoque.id}`} className="block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  )
}

function ComparacaoCampo({ campo }: { campo: CampoConciliado }) {
  if (campo.situacao === 'lancar') {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-secondary">Era</span>
        <span className="rounded-lg bg-danger-soft px-2.5 py-1 font-medium text-danger line-through decoration-danger/60">
          {valorLegivel(campo.campo, campo.anterior)}
        </span>
        <ArrowRight className="size-4 text-text-muted" aria-hidden />
        <span className="text-text-secondary">corrigido para</span>
        <span className="rounded-lg bg-success-soft px-2.5 py-1 font-bold text-success">
          {valorLegivel(campo.campo, campo.esperado)}
        </span>
      </div>
    )
  }

  if (campo.situacao === 'faltando') {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-text-secondary">Deveria ser</span>
        <span className="rounded-lg bg-success-soft px-2.5 py-1 font-bold text-success">
          {valorLegivel(campo.campo, campo.esperado)}
        </span>
        <ArrowRight className="size-4 text-text-muted" aria-hidden />
        <span className="text-text-secondary">no ERP está</span>
        <span className="rounded-lg bg-danger-soft px-2.5 py-1 font-medium text-danger">
          {valorLegivel(campo.campo, campo.atual)}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-secondary">
        {campo.situacao === 'aplicada' ? 'Confirmado no ERP' : 'Última correção'}
      </span>
      <span className="rounded-lg bg-success-soft px-2.5 py-1 font-bold text-success">
        {valorLegivel(campo.campo, campo.esperado)}
      </span>
    </div>
  )
}
