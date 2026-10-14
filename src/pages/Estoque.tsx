import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ItemCard } from '@/components/estoque/ItemCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { buscarImportacaoAtiva, listarItens, listarOpcoesFiltro, type OpcoesFiltro } from '@/services/estoque'
import type { EstoqueImportacao, EstoqueItem } from '@/types'
import { formatarNumero, isAdmin, rotuloMaterial } from '@/utils/estoque'

export function Estoque() {
  const { profile } = useAuth()
  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [total, setTotal] = useState(0)
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [material, setMaterial] = useState('')
  const [localizacao, setLocalizacao] = useState('')
  const [superficie, setSuperficie] = useState('')
  const [espessura, setEspessura] = useState('')
  const [largura, setLargura] = useState('')
  const [opcoes, setOpcoes] = useState<OpcoesFiltro | null>(null)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTermo(busca.trim())
      setPagina(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [busca])

  useEffect(() => {
    if (!importacao?.id) return
    let ativo = true
    void listarOpcoesFiltro(importacao.id)
      .then((resultado) => {
        if (ativo) setOpcoes(resultado)
      })
      .catch(() => {
        if (ativo) setOpcoes(null)
      })
    return () => {
      ativo = false
    }
  }, [importacao?.id])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const atual = await buscarImportacaoAtiva()
        if (!ativo) return
        setImportacao(atual)

        if (!atual) {
          setItens([])
          setTotal(0)
          return
        }

        const resultado = await listarItens({
          importacaoId: atual.id,
          busca: termo,
          pagina,
          material,
          localizacao,
          superficie,
          espessura: espessura === '' ? null : Number(espessura),
          largura: largura === '' ? null : Number(largura),
        })
        if (!ativo) return
        setItens((anteriores) =>
          pagina === 0 ? resultado.itens : [...anteriores, ...resultado.itens],
        )
        setTotal(resultado.total)
      } catch (error) {
        if (!ativo) return
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar o estoque.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [termo, pagina, material, localizacao, superficie, espessura, largura])

  const temMais = itens.length < total
  const filtrosAtivos = Boolean(material || localizacao || superficie || espessura || largura)

  function limparFiltros() {
    setMaterial('')
    setLocalizacao('')
    setSuperficie('')
    setEspessura('')
    setLargura('')
    setBusca('')
    setPagina(0)
  }

  function aoFiltrar(atualizar: () => void) {
    atualizar()
    setPagina(0)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Estoque</h2>
        <p className="mt-1 text-[15px] text-text-secondary">
          {importacao
            ? `${importacao.total_itens} itens · ${importacao.arquivo}`
            : 'Nenhuma planilha importada'}
        </p>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-[2.65rem] left-3.5 size-5 text-text-muted"
          aria-hidden
        />
        <Input
          label="Pesquisar"
          name="busca"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Item, lote ou descrição"
          className="pl-11"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Filtros
          </p>
          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="min-h-11 text-sm font-semibold text-primary-soft"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FiltroSelect
            label="Material"
            value={material}
            onChange={(valor) => aoFiltrar(() => setMaterial(valor))}
            opcoes={(opcoes?.materiais ?? []).map((valor) => ({
              valor,
              rotulo: rotuloMaterial(valor),
            }))}
          />
          <FiltroSelect
            label="Localização"
            value={localizacao}
            onChange={(valor) => aoFiltrar(() => setLocalizacao(valor))}
            opcoes={(opcoes?.localizacoes ?? []).map((valor) => ({
              valor,
              rotulo: valor === '__vazio__' ? 'Em branco' : valor,
            }))}
          />
          <FiltroSelect
            label="Superfície"
            value={superficie}
            onChange={(valor) => aoFiltrar(() => setSuperficie(valor))}
            opcoes={(opcoes?.superficies ?? []).map((valor) => ({
              valor,
              rotulo: valor === '__vazio__' ? 'Em branco' : valor,
            }))}
          />
          <FiltroSelect
            label="Espessura"
            value={espessura}
            onChange={(valor) => aoFiltrar(() => setEspessura(valor))}
            opcoes={(opcoes?.espessuras ?? []).map((valor) => ({
              valor: String(valor),
              rotulo: `${formatarNumero(valor, 2)} mm`,
            }))}
          />
          <FiltroSelect
            label="Largura"
            value={largura}
            onChange={(valor) => aoFiltrar(() => setLargura(valor))}
            opcoes={(opcoes?.larguras ?? []).map((valor) => ({
              valor: String(valor),
              rotulo: `${formatarNumero(valor, 2)} mm`,
            }))}
          />
        </div>
      </div>

      {importacao && (
        <p className="text-sm text-text-secondary">
          {total} {total === 1 ? 'item encontrado' : 'itens encontrados'}
        </p>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!erro && !carregando && !importacao && (
        <Card gradientTop padding="lg">
          <p className="text-base font-semibold text-text">Estoque ainda vazio</p>
          <p className="mt-2 text-sm text-text-secondary">
            Importe a planilha do ERP para consultar os itens.
          </p>
          {isAdmin(profile?.role) && (
            <Link to="/importar" className="mt-4 inline-flex">
              <Button>Importar planilha</Button>
            </Link>
          )}
        </Card>
      )}

      {carregando && pagina === 0 && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
        </div>
      )}

      {!erro && itens.length > 0 && (
        <div className="flex flex-col gap-3">
          {itens.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {!erro && !carregando && importacao && itens.length === 0 && (
        <Card padding="md">
          <p className="text-sm text-text-secondary">Nenhum item encontrado.</p>
        </Card>
      )}

      {temMais && (
        <Button
          variant="secondary"
          fullWidth
          loading={carregando && pagina > 0}
          onClick={() => setPagina((atual) => atual + 1)}
        >
          Carregar mais
        </Button>
      )}
    </div>
  )
}

function FiltroSelect({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  opcoes: { valor: string; rotulo: string }[]
}) {
  const id = label.toLowerCase()

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated px-3 text-[15px] text-text"
      >
        <option value="">Todos</option>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}
