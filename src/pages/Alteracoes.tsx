import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  Pencil,
  ScanLine,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { ExportarCorrecoes } from '@/components/estoque/ExportarCorrecoes'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { listarAlteracoes, type AlteracaoComUsuario } from '@/services/alteracoes'
import { apagarModificacoes } from '@/services/historico'
import { valorLegivel } from '@/utils/camposEstoque'
import { isAdmin } from '@/utils/estoque'

const PAGINA = 200

interface GrupoHistorico {
  chave: string
  created_at: string
  nome: string
  item: string
  lote: string | null
  origem: string
  observacao: string | null
  campos: {
    id: string
    itemId: string | null
    campo: string
    anterior: string | null
    novo: string | null
  }[]
}

interface DiaHistorico {
  chave: string
  titulo: string
  grupos: GrupoHistorico[]
}

interface OrigemVisual {
  rotulo: string
  icone: LucideIcon
  classe: string
}

const ORIGENS: Record<string, OrigemVisual> = {
  conferencia_fisica: {
    rotulo: 'Conferência',
    icone: ScanLine,
    classe: 'bg-primary/15 text-primary-soft',
  },
  inventario: {
    rotulo: 'Inventário',
    icone: ClipboardCheck,
    classe: 'bg-success-soft text-success',
  },
  ajuste_manual: {
    rotulo: 'Edição',
    icone: Pencil,
    classe: 'bg-warning-soft text-warning',
  },
}

const FILTROS = [
  { id: 'todos', rotulo: 'Tudo' },
  { id: 'conferencia_fisica', rotulo: 'Conferência' },
  { id: 'inventario', rotulo: 'Inventário' },
  { id: 'ajuste_manual', rotulo: 'Edição' },
] as const

function origemVisual(origem: string): OrigemVisual {
  return (
    ORIGENS[origem] ?? {
      rotulo: origem,
      icone: Pencil,
      classe: 'bg-bg-muted text-text-secondary',
    }
  )
}

function agrupar(linhas: AlteracaoComUsuario[]): GrupoHistorico[] {
  const grupos: GrupoHistorico[] = []

  for (const linha of linhas) {
    const ultimo = grupos[grupos.length - 1]
    const perto =
      ultimo &&
      ultimo.item === linha.item &&
      ultimo.nome === linha.nome &&
      ultimo.origem === linha.origem &&
      Math.abs(new Date(ultimo.created_at).getTime() - new Date(linha.created_at).getTime()) < 8000

    const campo = {
      id: linha.id,
      itemId: linha.item_id ?? null,
      campo: linha.campo_alterado,
      anterior: linha.valor_anterior,
      novo: linha.valor_novo,
    }

    if (perto && ultimo) {
      ultimo.campos.push(campo)
      continue
    }

    grupos.push({
      chave: linha.id,
      created_at: linha.created_at,
      nome: linha.nome,
      item: linha.item,
      lote: linha.lote,
      origem: linha.origem,
      observacao: linha.observacao,
      campos: [campo],
    })
  }

  return grupos
}

function chaveDoDia(iso: string): string {
  const data = new Date(iso)
  const parte = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${parte(data.getMonth() + 1)}-${parte(data.getDate())}`
}

function tituloDoDia(iso: string): string {
  const data = new Date(iso)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)

  const completo = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (data.toDateString() === hoje.toDateString()) return `Hoje · ${completo}`
  if (data.toDateString() === ontem.toDateString()) return `Ontem · ${completo}`
  return completo.charAt(0).toUpperCase() + completo.slice(1)
}

function agruparPorDia(grupos: GrupoHistorico[]): DiaHistorico[] {
  const dias: DiaHistorico[] = []
  for (const grupo of grupos) {
    const chave = chaveDoDia(grupo.created_at)
    const atual = dias[dias.length - 1]
    if (atual && atual.chave === chave) {
      atual.grupos.push(grupo)
    } else {
      dias.push({ chave, titulo: tituloDoDia(grupo.created_at), grupos: [grupo] })
    }
  }
  return dias
}

function dataHoraDoGrupo(iso: string): string {
  return `${new Date(iso).toLocaleDateString('pt-BR')} às ${hora(iso)}`
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function Alteracoes() {
  const { profile } = useAuth()
  const admin = isAdmin(profile?.role)

  const [linhas, setLinhas] = useState<AlteracaoComUsuario[]>([])
  const [limite, setLimite] = useState(PAGINA)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('todos')
  const [busca, setBusca] = useState('')
  const [exportarAberto, setExportarAberto] = useState(false)
  const [apagando, setApagando] = useState<GrupoHistorico | null>(null)
  const [apagandoAgora, setApagandoAgora] = useState(false)
  const { success, error: toastErro } = useToast()

  async function confirmarApagar() {
    if (!apagando) return
    setApagandoAgora(true)
    try {
      const resultado = await apagarModificacoes(
        apagando.campos.map((campo) => ({
          id: campo.id,
          itemId: campo.itemId,
          campo: campo.campo,
          anterior: campo.anterior,
          novo: campo.novo,
        })),
      )
      const ids = new Set(apagando.campos.map((campo) => campo.id))
      setLinhas((atuais) => atuais.filter((linha) => !ids.has(linha.id)))
      setApagando(null)
      success(
        resultado.revertidos > 0
          ? 'Apagado do histórico e valor anterior restaurado'
          : 'Apagado do histórico',
      )
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível apagar.')
    } finally {
      setApagandoAgora(false)
    }
  }

  useEffect(() => {
    let ativo = true
    void listarAlteracoes(limite)
      .then((resultado) => {
        if (!ativo) return
        setLinhas(resultado)
        setErro(null)
      })
      .catch((error: unknown) => {
        if (ativo) {
          setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico.')
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [limite])

  const termo = busca.trim().toLowerCase()
  const filtradas = useMemo(
    () =>
      linhas.filter((linha) => {
        if (filtro !== 'todos' && linha.origem !== filtro) return false
        if (!termo) return true
        return (
          linha.item.toLowerCase().includes(termo) ||
          (linha.lote ?? '').toLowerCase().includes(termo) ||
          linha.nome.toLowerCase().includes(termo)
        )
      }),
    [linhas, filtro, termo],
  )

  const dias = useMemo(() => agruparPorDia(agrupar(filtradas)), [filtradas])

  const resumoHoje = useMemo(() => {
    const hoje = chaveDoDia(new Date().toISOString())
    const doDia = linhas.filter((linha) => chaveDoDia(linha.created_at) === hoje)
    return {
      correcoes: doDia.length,
      itens: new Set(doDia.map((linha) => `${linha.item}|${linha.lote ?? ''}`)).size,
    }
  }, [linhas])

  const podeVerMais = linhas.length >= limite

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Histórico</h2>
          <p className="mt-1 text-[15px] text-text-secondary">
            Registrado sozinho, com dia, hora e responsável
          </p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => setExportarAberto((aberto) => !aberto)}
            aria-expanded={exportarAberto}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-bg-card px-4 text-sm font-semibold text-text transition-colors hover:border-border-strong hover:bg-bg-card-hover"
          >
            <FileSpreadsheet className="size-4 text-success" aria-hidden />
            Exportar
            <ChevronDown
              className={`size-4 text-text-muted transition-transform ${exportarAberto ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        )}
      </div>

      {admin && exportarAberto && (
        <Card padding="lg" gradientTop className="animate-slide-up">
          <p className="text-base font-bold text-text">Planilha para lançar no ERP</p>
          <p className="mb-4 mt-1 text-sm text-text-secondary">
            Uma linha por item, na ordem das colunas do ERP, com o que mudou em destaque. Pronta para
            copiar e colar.
          </p>
          <ExportarCorrecoes />
        </Card>
      )}

      {!carregando && !erro && linhas.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card padding="md">
            <p className="text-xs uppercase tracking-wide text-text-muted">Hoje</p>
            <p className="mt-1 text-2xl font-extrabold text-text">{resumoHoje.itens}</p>
            <p className="text-sm text-text-secondary">
              {resumoHoje.itens === 1 ? 'item corrigido' : 'itens corrigidos'}
            </p>
          </Card>
          <Card padding="md">
            <p className="text-xs uppercase tracking-wide text-text-muted">Última correção</p>
            <p className="mt-1 text-2xl font-extrabold text-text">{hora(linhas[0].created_at)}</p>
            <p className="truncate text-sm text-text-secondary">{linhas[0].nome}</p>
          </Card>
        </div>
      )}

      {!carregando && !erro && linhas.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              name="busca-historico"
              aria-label="Buscar no histórico"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar item, lote ou pessoa"
              autoComplete="off"
              className="pl-12"
            />
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
            {FILTROS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                role="tab"
                aria-selected={filtro === opcao.id}
                onClick={() => setFiltro(opcao.id)}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  filtro === opcao.id
                    ? 'border-primary-soft bg-primary/20 text-text'
                    : 'border-border bg-bg-card text-text-secondary hover:border-border-strong'
                }`}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {carregando && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
          <Skeleton className="h-36 rounded-[var(--radius-card)]" />
        </div>
      )}

      {erro && (
        <Card padding="md">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!carregando && !erro && linhas.length === 0 && (
        <Card padding="lg">
          <p className="font-semibold text-text">Nenhuma correção ainda</p>
          <p className="mt-1 text-sm text-text-secondary">
            Quando alguém conferir ou corrigir um material, aparece aqui sozinho, com dia e hora.
          </p>
        </Card>
      )}

      {!carregando && !erro && linhas.length > 0 && dias.length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">Nada encontrado com esse filtro.</p>
        </Card>
      )}

      <div className="flex flex-col gap-6">
        {dias.map((dia) => (
          <section key={dia.chave} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 className="text-sm font-bold text-text">{dia.titulo}</h3>
              <span className="text-xs text-text-muted">
                {dia.grupos.length} {dia.grupos.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {dia.grupos.map((grupo) => {
              const origem = origemVisual(grupo.origem)
              const Icone = origem.icone
              return (
                <Card key={grupo.chave} padding="md">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${origem.classe}`}
                      title={origem.rotulo}
                    >
                      <Icone className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-base font-bold text-text">{grupo.item}</p>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-muted px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          <Clock className="size-3" aria-hidden />
                          {hora(grupo.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {grupo.lote ? `Lote ${grupo.lote} · ` : ''}
                        {grupo.nome} · {origem.rotulo}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2.5">
                    {grupo.campos.map((campo) => (
                      <div
                        key={campo.campo}
                        className="rounded-xl bg-bg-elevated px-3 py-2.5"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {campo.campo}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-danger-soft px-2.5 py-1 text-sm font-medium text-danger line-through decoration-danger/60">
                            {valorLegivel(campo.campo, campo.anterior)}
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden />
                          <span className="rounded-lg bg-success-soft px-2.5 py-1 text-sm font-bold text-success">
                            {valorLegivel(campo.campo, campo.novo)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {grupo.observacao && (
                    <p className="mt-3 text-sm text-text-muted">{grupo.observacao}</p>
                  )}

                  {admin && (
                    <button
                      type="button"
                      onClick={() => {
                        setApagando(grupo)
                      }}
                      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Apagar esta modificação
                    </button>
                  )}
                </Card>
              )
            })}
          </section>
        ))}
      </div>

      {apagando && (
        <ConfirmDialog
          titulo="Apagar do histórico?"
          confirmar="Apagar modificação"
          perigo
          carregando={apagandoAgora}
          onConfirmar={() => void confirmarApagar()}
          onCancelar={() => setApagando(null)}
        >
          <p className="text-sm text-text-secondary">
            {apagando.item}
            {apagando.lote ? ` · Lote ${apagando.lote}` : ''} · {dataHoraDoGrupo(apagando.created_at)}
          </p>
          <ul className="grid gap-1 text-sm text-text">
            {apagando.campos.map((campo) => (
              <li key={campo.id}>
                <strong>{campo.campo}:</strong> {valorLegivel(campo.campo, campo.anterior)} →{' '}
                {valorLegivel(campo.campo, campo.novo)}
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-secondary">
            Cada campo volta ao valor que tinha antes desta modificação, também no estoque importado.
          </p>
          <p className="text-xs text-text-muted">Isso não pode ser desfeito.</p>
        </ConfirmDialog>
      )}

      {!carregando && podeVerMais && (
        <Button variant="secondary" size="lg" fullWidth onClick={() => setLimite((n) => n + PAGINA)}>
          Ver registros mais antigos
        </Button>
      )}
    </div>
  )
}
