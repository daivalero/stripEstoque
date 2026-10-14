import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, MapPin, Search } from 'lucide-react'
import { EstoqueImportado } from '@/components/estoque/EstoqueImportado'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useHistorico } from '@/contexts/HistoricoContext'
import { contarResolvidos, useInventarioMarcas, type Marcas } from '@/hooks/useInventarioMarcas'
import { buscarImportacaoAtiva } from '@/services/estoque'
import { listarLocalizacoes, type LocalizacaoResumo } from '@/services/inventario'
import type { EstoqueImportacao } from '@/types'
import { formatarNumero } from '@/utils/estoque'

const LIMITE_LISTA = 120

/** Itens da localização já conferidos (no banco, de qualquer estoque, ou neste aparelho). */
function itensFeitos(
  local: LocalizacaoResumo,
  marcas: Marcas,
  conferencias: Map<string, unknown>,
): number {
  const noBanco = local.chaves.filter((chave) => conferencias.has(chave)).length
  return Math.min(Math.max(contarResolvidos(marcas, local.localizacao), noBanco), local.total)
}

export function Inventario() {
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [locais, setLocais] = useState<LocalizacaoResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const { marcas } = useInventarioMarcas(importacao?.id ?? null)
  const { conferencias } = useHistorico()

  const feitosEm = (local: LocalizacaoResumo) => itensFeitos(local, marcas, conferencias)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const ativa = await buscarImportacaoAtiva()
        if (!ativo) return
        setImportacao(ativa)
        if (ativa) {
          const lista = await listarLocalizacoes(ativa.id)
          if (ativo) setLocais(lista)
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : 'Não foi possível carregar o inventário.')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const termo = busca.trim().toUpperCase().replace(/\s+/g, '')
  const filtrados = useMemo(
    () => (termo ? locais.filter((local) => local.localizacao.includes(termo)) : locais),
    [locais, termo],
  )
  const visiveis = filtrados.slice(0, LIMITE_LISTA)

  const resumo = useMemo(() => {
    const total = locais.reduce((soma, local) => soma + local.total, 0)
    const resolvidos = locais.reduce((soma, local) => soma + itensFeitos(local, marcas, conferencias), 0)
    return { total, resolvidos }
  }, [locais, marcas, conferencias])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Inventário</h2>
        <p className="mt-1 text-[15px] text-text-secondary">Confira o estoque por localização</p>
      </div>

      <EstoqueImportado />

      {carregando && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          <Skeleton className="h-20 rounded-[var(--radius-card)]" />
        </div>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!carregando && !erro && !importacao && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">
            Nenhum estoque importado ainda. Peça a um administrador para importar a planilha.
          </p>
        </Card>
      )}

      {!carregando && importacao && (
        <>
          <Card padding="md" gradientTop>
            <p className="text-sm text-text-secondary">Progresso geral</p>
            <p className="mt-1 text-2xl font-extrabold text-text">
              {formatarNumero(resumo.resolvidos)}
              <span className="text-base font-semibold text-text-muted">
                {' '}
                de {formatarNumero(resumo.total)} itens
              </span>
            </p>
            <Barra feito={resumo.resolvidos} total={resumo.total} />
            <p className="mt-3 text-xs text-text-muted">
              A conferência fica salva no sistema e continua valendo nos próximos estoques importados.
            </p>
          </Card>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              name="busca-local"
              aria-label="Buscar localização"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar localização (ex.: P0054)"
              autoCapitalize="characters"
              autoComplete="off"
              className="pl-12"
            />
          </div>

          {filtrados.length === 0 && (
            <Card padding="lg">
              <p className="text-sm text-text-secondary">Nenhuma localização encontrada.</p>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {visiveis.map((local) => {
              const feito = feitosEm(local)
              const completo = feito >= local.total
              return (
                <Link
                  key={local.localizacao}
                  to={`/inventario/${encodeURIComponent(local.localizacao)}`}
                  className="block"
                >
                  <Card interactive padding="md">
                    <div className="flex items-center gap-4">
                      <div
                        className={
                          completo
                            ? 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success'
                            : 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-soft'
                        }
                      >
                        {completo ? (
                          <CheckCircle2 className="size-5" aria-hidden />
                        ) : (
                          <MapPin className="size-5" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-text">{local.localizacao}</p>
                        <p className="text-sm text-text-secondary">
                          {feito} de {local.total} {local.total === 1 ? 'item' : 'itens'}
                        </p>
                        <Barra feito={feito} total={local.total} />
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>

          {filtrados.length > LIMITE_LISTA && (
            <p className="text-center text-sm text-text-muted">
              Mostrando {LIMITE_LISTA} de {filtrados.length}. Use a busca para achar a localização.
            </p>
          )}
        </>
      )}
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
      <div
        className="h-full rounded-full bg-success transition-all duration-300"
        style={{ width: `${percentual}%` }}
      />
    </div>
  )
}
