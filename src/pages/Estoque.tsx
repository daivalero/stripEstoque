import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, PackageSearch, SearchX, Upload } from 'lucide-react'
import { CampoBusca } from '@/components/estoque/CampoBusca'
import { FiltroMaterial, type FiltroMaterialValor } from '@/components/estoque/FiltroMaterial'
import { ItemCard } from '@/components/estoque/ItemCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListaItensSkeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { useImportacaoAtiva } from '@/hooks/useImportacaoAtiva'
import { listarEstoque } from '@/services/estoque'
import type { EstoqueItem } from '@/types'
import { formatarDataHora } from '@/utils/normalize'

export function Estoque() {
  const { profile } = useAuth()
  const { importacao, loading: carregandoImportacao, erro: erroImportacao, recarregar } =
    useImportacaoAtiva()

  const [busca, setBusca] = useState('')
  const [material, setMaterial] = useState<FiltroMaterialValor>('todos')
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [loading, setLoading] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const requisicao = useRef(0)

  const buscaAtual = useDebounce(busca, 300)
  const importacaoId = importacao?.id

  useEffect(() => {
    if (!importacaoId) return

    const id = ++requisicao.current
    setLoading(true)
    setErro(null)

    listarEstoque({ importacaoId, busca: buscaAtual, material, pagina: 0 })
      .then((resultado) => {
        if (id !== requisicao.current) return
        setItens(resultado.itens)
        setTotal(resultado.total)
        setPagina(0)
      })
      .catch(() => {
        if (id === requisicao.current) setErro('Não foi possível carregar os itens.')
      })
      .finally(() => {
        if (id === requisicao.current) setLoading(false)
      })
  }, [importacaoId, buscaAtual, material, tentativa])

  async function carregarMais() {
    if (!importacaoId || carregandoMais) return
    const id = requisicao.current
    const proxima = pagina + 1
    setCarregandoMais(true)
    try {
      const resultado = await listarEstoque({
        importacaoId,
        busca: buscaAtual,
        material,
        pagina: proxima,
      })
      if (id !== requisicao.current) return
      setItens((anteriores) => [...anteriores, ...resultado.itens])
      setTotal(resultado.total)
      setPagina(proxima)
    } catch {
      setErro('Não foi possível carregar os itens.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const ehAdmin = profile?.role === 'admin'
  const primeiraCarga = loading
  const temMais = itens.length < total

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text lg:text-3xl">
          Estoque
        </h2>
        {importacao ? (
          <p className="mt-1 text-[15px] text-text-secondary">
            {importacao.arquivo_nome} · {formatarDataHora(importacao.created_at)}
          </p>
        ) : (
          <p className="mt-1 text-[15px] text-text-secondary">
            Pesquise os itens importados do ERP.
          </p>
        )}
      </div>

      {carregandoImportacao && <ListaItensSkeleton />}

      {!carregandoImportacao && erroImportacao && (
        <EmptyState
          icon={AlertTriangle}
          title="Estoque indisponível"
          description={erroImportacao}
          action={
            <Button variant="secondary" onClick={recarregar}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!carregandoImportacao && !erroImportacao && !importacao && (
        <EmptyState
          icon={PackageSearch}
          title="Nenhum estoque importado"
          description={
            ehAdmin
              ? 'Importe a planilha do ERP para começar a pesquisar e conferir os materiais.'
              : 'Peça a um administrador para importar a planilha do ERP.'
          }
          action={
            ehAdmin ? (
              <Link to="/importar">
                <Button>
                  <Upload className="size-4" aria-hidden />
                  Importar planilha
                </Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {importacao && (
        <>
          <div className="flex flex-col gap-3">
            <CampoBusca valor={busca} onChange={setBusca} />
            <FiltroMaterial valor={material} onChange={setMaterial} />
          </div>

          {!primeiraCarga && !erro && (
            <p className="text-sm text-text-secondary" aria-live="polite">
              {total === 1 ? '1 item' : `${total.toLocaleString('pt-BR')} itens`}
            </p>
          )}

          {primeiraCarga && <ListaItensSkeleton />}

          {erro && (
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
          )}

          {!primeiraCarga && !erro && itens.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="Nada encontrado"
              description="Nenhum item corresponde à pesquisa. Confira o código ou limpe os filtros."
            />
          )}

          {!primeiraCarga && itens.length > 0 && !erro && (
            <div className="grid gap-3 lg:grid-cols-2">
              {itens.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {!primeiraCarga && itens.length > 0 && temMais && !erro && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={carregandoMais}
              onClick={() => void carregarMais()}
            >
              Carregar mais
            </Button>
          )}
        </>
      )}
    </div>
  )
}
