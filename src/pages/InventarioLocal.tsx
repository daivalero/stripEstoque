import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CircleHelp, MapPinned, Pencil, ScanLine, Undo2, X } from 'lucide-react'
import { EstoqueImportado } from '@/components/estoque/EstoqueImportado'
import { FichaItem } from '@/components/estoque/FichaItem'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { EtiquetaModificado, HistoricoDoItem } from '@/components/estoque/ModificacoesDoItem'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useHistorico } from '@/contexts/HistoricoContext'
import { useAuth } from '@/hooks/useAuth'
import { useInventarioMarcas, type Marca, type Marcas } from '@/hooks/useInventarioMarcas'
import { registrarAlteracoes } from '@/services/alteracoes'
import {
  apagarConferencia,
  registrarConferencia,
  type Conferencia,
  type StatusConferencia,
} from '@/services/conferencias'
import { montarAlteracoes, salvarEdicao } from '@/services/edicao'
import { buscarImportacaoAtiva, buscarPorCodigo } from '@/services/estoque'
import { buscarPorLotes, chaveDoItem } from '@/services/historico'
import { listarItensDaLocalizacao } from '@/services/inventario'
import type { EstoqueImportacao, EstoqueItem } from '@/types'
import { diferencasEntre, valorPadrao, type Diferenca } from '@/utils/camposEstoque'
import { formatarDataHora } from '@/utils/data'
import {
  comoMaterial,
  formatarMedida,
  formatarQuantidade,
  loteDaEtiqueta,
  normalizarLocalizacao,
} from '@/utils/estoque'

const NAO_ENCONTRADO = 'NÃO ENCONTRADO'

interface FichaAberta {
  original: EstoqueItem
  base: EstoqueItem
  ausente: boolean
}

export function InventarioLocal() {
  const { local: parametro } = useParams()
  const local = parametro ? decodeURIComponent(parametro) : ''
  const { user } = useAuth()
  const { success, error: toastErro, warning } = useToast()

  const [importacao, setImportacao] = useState<EstoqueImportacao | null>(null)
  const [itens, setItens] = useState<EstoqueItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [ficha, setFicha] = useState<FichaAberta | null>(null)
  const [escolha, setEscolha] = useState<{ itens: EstoqueItem[]; codigo: string } | null>(null)
  const [ausentando, setAusentando] = useState<EstoqueItem | null>(null)

  const { porItem, carregado: historicoCarregado, conferencias, conferenciaDe } = useHistorico()
  const [deHistorico, setDeHistorico] = useState<EstoqueItem[]>([])
  const { marcas, marcar, desmarcar } = useInventarioMarcas(importacao?.id ?? null)
  const marcasRef = useRef<Marcas>(marcas)

  useEffect(() => {
    marcasRef.current = marcas
  }, [marcas])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const ativa = await buscarImportacaoAtiva()
        if (!ativo) return
        setImportacao(ativa)
        if (ativa && local) {
          const lista = await listarItensDaLocalizacao(ativa.id, local)
          if (ativo) setItens(lista)
        }
      } catch (error) {
        if (ativo) {
          setErro(error instanceof Error ? error.message : 'Não foi possível abrir a localização.')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [local])

  // Itens que, pelo histórico, foram levados para este local em um estoque anterior,
  // mas que o ERP importado agora ainda mostra em outro lugar.
  useEffect(() => {
    if (!importacao || !historicoCarregado) return
    let ativo = true
    const destino = normalizarLocalizacao(local)
    const chaves = new Set<string>()
    const lotes: string[] = []
    for (const [chave, lista] of porItem) {
      const ultimaMudanca = lista.find((modificacao) => modificacao.campo === 'Localização')
      if (!ultimaMudanca || normalizarLocalizacao(ultimaMudanca.novo) !== destino) continue
      chaves.add(chave)
      if (lista[0].lote) lotes.push(lista[0].lote)
    }

    async function procurarNoEstoque() {
      try {
        const achados = lotes.length > 0 ? await buscarPorLotes(importacao!.id, lotes) : []
        if (!ativo) return
        setDeHistorico(
          achados.filter(
            (item) =>
              chaves.has(chaveDoItem(item.item, item.lote)) &&
              normalizarLocalizacao(item.localizacao) !== destino,
          ),
        )
      } catch {
        if (ativo) setDeHistorico([])
      }
    }

    void procurarNoEstoque()
    return () => {
      ativo = false
    }
  }, [importacao, historicoCarregado, porItem, local])

  const esperadosAqui = useMemo(
    () =>
      deHistorico.filter(
        (item) => !marcas[item.id] && !conferencias.has(chaveDoItem(item.item, item.lote)),
      ),
    [deHistorico, marcas, conferencias],
  )

  const ordenados = useMemo(() => {
    const feito = (item: EstoqueItem) =>
      Boolean(marcas[item.id]) || conferencias.has(chaveDoItem(item.item, item.lote))
    const pendentes = itens.filter((item) => !feito(item))
    const resolvidos = itens.filter(feito)
    return [...pendentes, ...resolvidos]
  }, [itens, marcas, conferencias])

  const encontradosAqui = useMemo(
    () =>
      Object.values(marcas).filter(
        (marca) => marca.status === 'movido' && marca.para === local && marca.item,
      ),
    [marcas, local],
  )

  const resolvidos = itens.filter(
    (item) => marcas[item.id] || conferencias.has(chaveDoItem(item.item, item.lote)),
  ).length
  const percentual = itens.length === 0 ? 0 : Math.round((resolvidos / itens.length) * 100)

  /** Guarda a conferência no banco (vale para os próximos estoques). Falha aqui não trava o inventário. */
  async function guardarConferencia(
    item: Pick<EstoqueItem, 'item' | 'lote'>,
    status: StatusConferencia,
    localizacao: string | null,
  ) {
    try {
      await registrarConferencia({
        userId: user?.id,
        item: item.item,
        lote: item.lote,
        localizacao,
        status,
      })
    } catch (error) {
      warning(error instanceof Error ? error.message : 'A conferência não foi salva no sistema.')
    }
  }

  function conferido(item: EstoqueItem) {
    marcar(item.id, { status: 'ok', de: item.localizacao })
    void guardarConferencia(item, 'ok', local)
  }

  function abrirFicha(original: EstoqueItem) {
    const marca = marcasRef.current[original.id]
    setEscolha(null)
    setFicha({
      original: marca?.original ?? original,
      base: marca?.item ?? original,
      ausente: marca?.status === 'ausente',
    })
  }

  async function salvarFicha(novo: EstoqueItem) {
    if (!ficha) return
    const { original, base, ausente } = ficha

    let diferencas = diferencasEntre(base, novo)
    const localNovo = valorPadrao(novo, 'localizacao')

    // Item que estava marcado como não encontrado: a localização no histórico volta a valer.
    if (ausente) {
      diferencas = diferencas.filter((diferenca) => diferenca.chave !== 'localizacao')
      diferencas.push({
        chave: 'localizacao',
        campo: 'Localização',
        anterior: NAO_ENCONTRADO,
        novo: localNovo,
      })
    }

    setSalvando(true)
    try {
      await salvarEdicao({
        userId: user?.id,
        base,
        novo,
        diferencas,
        origem: 'inventario',
        observacao: `Inventário ${local}: item conferido e corrigido`,
      })

      const localErp = valorPadrao(original, 'localizacao')
      const movido = localNovo !== localErp
      await guardarConferencia(novo, movido ? 'movido' : 'ok', localNovo ?? local)
      marcar(original.id, {
        status: movido ? 'movido' : 'ok',
        de: original.localizacao,
        para: movido ? (localNovo ?? undefined) : undefined,
        item: novo,
        original,
      })

      setFicha(null)
      success(diferencas.length > 0 ? 'Alterações salvas' : 'Item conferido')
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarAusente(item: EstoqueItem) {
    setSalvando(true)
    try {
      if (!user) throw new Error('Sessão expirada. Entre novamente.')
      await registrarAlteracoes(
        montarAlteracoes(
          user.id,
          item,
          [{ chave: 'localizacao', campo: 'Localização', anterior: local, novo: NAO_ENCONTRADO }],
          'inventario',
          `Inventário ${local}: item não encontrado`,
        ),
      )
      marcar(item.id, { status: 'ausente', de: item.localizacao, original: item })
      await guardarConferencia(item, 'ausente', local)
      setAusentando(null)
      success('Item marcado como não encontrado')
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  /** Desfaz a marcação gravando a correção inversa, para o histórico continuar coerente. */
  async function desfazer(item: EstoqueItem) {
    const marca = marcasRef.current[item.id]
    if (!marca) {
      // Conferido em outro estoque importado: só tira a conferência.
      if (conferenciaDe(item.item, item.lote)) {
        setSalvando(true)
        try {
          await apagarConferencia(item.item, item.lote)
          success('Conferência desfeita')
        } catch (error) {
          toastErro(error instanceof Error ? error.message : 'Não foi possível desfazer.')
        } finally {
          setSalvando(false)
        }
      }
      return
    }
    const original = marca.original ?? item

    let diferencas: Diferenca[] = []
    if (marca.status === 'ausente') {
      diferencas = [
        {
          chave: 'localizacao',
          campo: 'Localização',
          anterior: NAO_ENCONTRADO,
          novo: valorPadrao(original, 'localizacao'),
        },
      ]
    } else if (marca.item) {
      diferencas = diferencasEntre(marca.item, original)
    }

    if (diferencas.length === 0) {
      desmarcar(item.id)
      await apagarConferencia(item.item, item.lote).catch(() => undefined)
      return
    }

    setSalvando(true)
    try {
      const observacao = `Inventário ${local}: marcação desfeita`
      if (marca.status === 'ausente') {
        if (!user) throw new Error('Sessão expirada. Entre novamente.')
        await registrarAlteracoes(montarAlteracoes(user.id, original, diferencas, 'inventario', observacao))
      } else if (marca.item) {
        await salvarEdicao({
          userId: user?.id,
          base: marca.item,
          novo: original,
          diferencas,
          origem: 'inventario',
          observacao,
        })
      }
      desmarcar(item.id)
      await apagarConferencia(item.item, item.lote).catch(() => undefined)
      success('Marcação desfeita')
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível desfazer.')
    } finally {
      setSalvando(false)
    }
  }

  async function procurar(texto: string) {
    const termo = texto.trim()
    if (!termo) return

    setEscaneando(false)
    setBuscando(true)
    try {
      const achados = await buscarPorCodigo(termo)
      const nome = loteDaEtiqueta(termo) ?? termo

      if (achados.length === 0) {
        warning(`${nome} não está no estoque importado`)
        return
      }
      if (achados.length === 1) {
        abrirFicha(achados[0])
        return
      }
      setEscolha({ itens: achados, codigo: nome })
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível buscar o código.')
    } finally {
      setBuscando(false)
    }
  }

  function ligarCamera() {
    setTentativa((n) => n + 1)
    setEscaneando(true)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <Link
        to="/inventario"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Inventário
      </Link>

      <div>
        <p className="text-sm text-text-secondary">Localização</p>
        <h2 className="text-[1.9rem] font-extrabold tracking-tight text-text">{local}</h2>
      </div>

      <EstoqueImportado />

      {carregando && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-[var(--radius-card)]" />
          <Skeleton className="h-40 rounded-[var(--radius-card)]" />
        </div>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!carregando && !erro && !importacao && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">Nenhum estoque importado ainda.</p>
        </Card>
      )}

      {!carregando && importacao && (
        <>
          <Card padding="md" gradientTop>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-text-secondary">Conferidos</p>
                <p className="text-2xl font-extrabold text-text">
                  {resolvidos}
                  <span className="text-base font-semibold text-text-muted"> de {itens.length}</span>
                </p>
              </div>
              <p className="text-sm font-semibold text-text-secondary">{percentual}%</p>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full min-w-0 rounded-full bg-success transition-all duration-300"
                style={{ width: `${percentual}%` }}
              />
            </div>
          </Card>

          {escaneando ? (
            <div className="flex flex-col gap-3">
              <BarcodeScanner
                key={tentativa}
                ativo={escaneando && !buscando}
                onDetect={(lido) => void procurar(lido)}
                onErro={(mensagem) => toastErro(mensagem)}
              />
              <Button variant="secondary" size="lg" fullWidth onClick={() => setEscaneando(false)}>
                Parar câmera
              </Button>
            </div>
          ) : (
            <Button size="lg" fullWidth loading={buscando} onClick={ligarCamera}>
              <ScanLine className="size-5" aria-hidden />
              Escanear etiqueta
            </Button>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const texto = codigo
              setCodigo('')
              void procurar(texto)
            }}
          >
            <Input
              name="codigo-inventario"
              aria-label="Digitar lote ou item"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="Digitar lote ou item"
              autoComplete="off"
            />
            <Button type="submit" size="lg" variant="secondary" loading={buscando}>
              Buscar
            </Button>
          </form>

          {itens.length === 0 && (
            <Card padding="lg">
              <p className="text-sm text-text-secondary">
                O ERP não tem itens nesta localização. Escaneie o que encontrar aqui.
              </p>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {ordenados.map((item) => (
              <LinhaItem
                key={item.id}
                original={item}
                marca={marcas[item.id]}
                conferencia={conferenciaDe(item.item, item.lote)}
                ocupado={salvando}
                onConferido={() => conferido(item)}
                onAusente={() => setAusentando(item)}
                onEditar={() => abrirFicha(item)}
                onDesfazer={() => void desfazer(item)}
              />
            ))}
          </div>

          {esperadosAqui.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-warning">
                  Pelo histórico, deveriam estar aqui
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Você já levou estes itens para {local} antes, mas o estoque importado ainda mostra outro
                  local. Confira e salve para atualizar.
                </p>
              </div>
              {esperadosAqui.map((item) => (
                <LinhaItem
                  key={item.id}
                  original={item}
                  marca={undefined}
                  ocupado={salvando}
                  onConferido={() => abrirFicha(item)}
                  onAusente={() => setAusentando(item)}
                  onEditar={() => abrirFicha(item)}
                  onDesfazer={() => undefined}
                />
              ))}
            </section>
          )}

          {encontradosAqui.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Encontrados aqui (vieram de outro local)
              </h3>
              {encontradosAqui.map((marca) => {
                const original = marca.original ?? (marca.item as EstoqueItem)
                return (
                  <LinhaItem
                    key={original.id}
                    original={original}
                    marca={marca}
                    conferencia={conferenciaDe(original.item, original.lote)}
                    ocupado={salvando}
                    onConferido={() => undefined}
                    onAusente={() => undefined}
                    onEditar={() => abrirFicha(original)}
                    onDesfazer={() => void desfazer(original)}
                  />
                )
              })}
            </section>
          )}
        </>
      )}

      {ficha && (
        <FichaItem
          original={ficha.original}
          base={ficha.base}
          localFisico={local}
          estavaAusente={ficha.ausente}
          salvando={salvando}
          onSalvar={(novo) => void salvarFicha(novo)}
          onCancelar={() => setFicha(null)}
        />
      )}

      {escolha && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Escolher item"
        >
          <Card padding="lg" className="max-h-[85vh] w-full max-w-md animate-slide-up overflow-y-auto">
            <h3 className="text-xl font-bold text-text">Mais de um item encontrado</h3>
            <p className="mt-1 text-sm text-text-secondary">{escolha.codigo}: escolha qual é.</p>
            <div className="mt-4 grid gap-3">
              {escolha.itens.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrirFicha(item)}
                  className="rounded-2xl border border-border bg-bg-elevated p-4 text-left transition-colors hover:border-border-strong"
                >
                  <MaterialBadge tipo={comoMaterial(item.material)} />
                  <div className="mt-2 empty:hidden">
                    <EtiquetaModificado item={item.item} lote={item.lote} />
                  </div>
                  <p className="mt-2 text-lg font-extrabold text-text">
                    {formatarMedida(item.espessura, item.largura)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {item.item} · Lote {item.lote ?? '—'} · {formatarQuantidade(item.quantidade)}
                  </p>
                  <p className="text-sm text-text">
                    No ERP: <span className="font-semibold">{item.localizacao ?? 'sem local'}</span>
                  </p>
                </button>
              ))}
            </div>
            <Button
              size="lg"
              fullWidth
              variant="secondary"
              className="mt-4"
              onClick={() => setEscolha(null)}
            >
              Cancelar
            </Button>
          </Card>
        </div>
      )}

      {ausentando && (
        <ConfirmDialog
          titulo="Item não está aqui?"
          confirmar="Sim, não encontrei"
          perigo
          carregando={salvando}
          onConfirmar={() => void confirmarAusente(ausentando)}
          onCancelar={() => setAusentando(null)}
        >
          <p className="text-sm text-text-secondary">
            {ausentando.item} · Lote {ausentando.lote ?? '—'}
          </p>
          <p className="text-sm text-text-secondary">
            Será registrado no histórico que este item não foi encontrado em {local}.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}

interface LinhaItemProps {
  original: EstoqueItem
  marca: Marca | undefined
  conferencia?: Conferencia
  ocupado: boolean
  onConferido: () => void
  onAusente: () => void
  onEditar: () => void
  onDesfazer: () => void
}

function LinhaItem({
  original,
  marca,
  conferencia,
  ocupado,
  onConferido,
  onAusente,
  onEditar,
  onDesfazer,
}: LinhaItemProps) {
  const status = marca?.status ?? conferencia?.status
  const item = marca?.item ?? original
  const alterado = marca?.item ? diferencasEntre(marca.original ?? original, marca.item).length : 0

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <MaterialBadge tipo={comoMaterial(item.material)} />
        {status === 'ok' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <Check className="size-3.5" aria-hidden />
            {alterado > 0 ? 'Corrigido' : 'Conferido'}
          </span>
        )}
        {status === 'ausente' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">
            <X className="size-3.5" aria-hidden />
            Não encontrado
          </span>
        )}
        {status === 'movido' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
            <MapPinned className="size-3.5" aria-hidden />
            {marca?.de
              ? `Veio de ${marca.de}`
              : conferencia?.localizacao
                ? `Movido para ${conferencia.localizacao}`
                : 'Sem local no ERP'}
          </span>
        )}
        {!status && (
          <span className="inline-flex items-center gap-1 rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-text-muted">
            <CircleHelp className="size-3.5" aria-hidden />A conferir
          </span>
        )}
      </div>

      {conferencia && (
        <p className="mt-2 text-xs text-text-muted">
          {conferencia.status === 'ausente' ? 'Não encontrado' : 'Conferido'} em{' '}
          {formatarDataHora(conferencia.conferidoEm)} · {conferencia.nome}
        </p>
      )}

      <p className="mt-3 text-xl font-extrabold tracking-tight text-text">
        {formatarMedida(item.espessura, item.largura)}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-text">{item.item}</p>
          <p className="text-sm text-text-secondary">Lote {item.lote ?? '—'}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-text">
          {formatarQuantidade(item.quantidade)}
        </p>
      </div>
      <div className="mt-3 empty:hidden">
        <HistoricoDoItem item={item.item} lote={item.lote} atual={item} maximo={1} titulo="Já modificado antes" />
      </div>
      {alterado > 0 && (
        <p className="mt-2 text-xs text-warning">
          {alterado} {alterado === 1 ? 'campo corrigido' : 'campos corrigidos'}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {!status && (
          <>
            <Button variant="secondary" disabled={ocupado} onClick={onConferido}>
              <Check className="size-4" aria-hidden />
              Está aqui
            </Button>
            <Button variant="secondary" disabled={ocupado} onClick={onAusente}>
              <X className="size-4" aria-hidden />
              Não está
            </Button>
            <Button variant="ghost" className="col-span-2" disabled={ocupado} onClick={onEditar}>
              <Pencil className="size-4" aria-hidden />
              Ver e editar campos
            </Button>
          </>
        )}
        {status === 'ausente' && (
          <>
            <Button variant="secondary" disabled={ocupado} onClick={onEditar}>
              <Check className="size-4" aria-hidden />
              Achei
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={onDesfazer}>
              <Undo2 className="size-4" aria-hidden />
              Desfazer
            </Button>
          </>
        )}
        {(status === 'ok' || status === 'movido') && (
          <>
            <Button variant="secondary" disabled={ocupado} onClick={onEditar}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={onDesfazer}>
              <Undo2 className="size-4" aria-hidden />
              Desfazer
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
