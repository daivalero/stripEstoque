import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, RotateCcw } from 'lucide-react'
import { AmostraLinhas } from '@/components/importar/AmostraLinhas'
import { ListaProblemas } from '@/components/importar/ListaProblemas'
import { ResumoValidacao } from '@/components/importar/ResumoValidacao'
import { SeletorArquivo } from '@/components/importar/SeletorArquivo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useImportacaoAtiva } from '@/hooks/useImportacaoAtiva'
import { lerPlanilha } from '@/services/excel/leitor'
import { ErroPlanilha, type ResultadoLeitura } from '@/services/excel/tipos'
import { importarEstoque } from '@/services/importacao'
import { formatarDataHora } from '@/utils/normalize'

type Etapa = 'selecionar' | 'lendo' | 'previa' | 'importando' | 'concluida'

export function Importar() {
  const { profile, isConfigured, isDemo } = useAuth()
  const { importacao: ativa } = useImportacaoAtiva()
  const toast = useToast()
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState<Etapa>('selecionar')
  const [resultado, setResultado] = useState<ResultadoLeitura | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aceitouIgnoradas, setAceitouIgnoradas] = useState(false)

  const ehAdmin = profile?.role === 'admin'
  const backendDisponivel = isConfigured && !isDemo

  const cabecalho = (
    <div>
      <Link
        to="/"
        className="inline-flex h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Link>
      <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text lg:text-3xl">
        Atualizar estoque
      </h2>
      <p className="mt-1 text-[15px] text-text-secondary">
        Importe a planilha do ERP. Nada é gravado antes da pré-visualização.
      </p>
    </div>
  )

  if (!ehAdmin) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {cabecalho}
        <EmptyState
          icon={Lock}
          title="Acesso restrito"
          description="Somente administradores podem importar a planilha do ERP."
        />
      </div>
    )
  }

  async function aoSelecionar(arquivo: File) {
    setEtapa('lendo')
    setErro(null)
    setResultado(null)
    setAceitouIgnoradas(false)

    try {
      setResultado(await lerPlanilha(arquivo))
      setEtapa('previa')
    } catch (e) {
      setErro(
        e instanceof ErroPlanilha ? e.message : 'Não foi possível ler a planilha selecionada.',
      )
      setEtapa('selecionar')
    }
  }

  function recomecar() {
    setEtapa('selecionar')
    setResultado(null)
    setErro(null)
    setAceitouIgnoradas(false)
  }

  async function confirmarImportacao() {
    if (!resultado) return
    setEtapa('importando')
    try {
      await importarEstoque(resultado)
      toast.success('✓ Estoque importado')
      setEtapa('concluida')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível importar o estoque.')
      setEtapa('previa')
    }
  }

  const bloqueada = (resultado?.colunasObrigatoriasAusentes.length ?? 0) > 0
  const semLinhas = resultado !== null && resultado.linhas.length === 0
  const precisaAceitar = (resultado?.linhasComErro ?? 0) > 0
  const podeImportar =
    resultado !== null &&
    !bloqueada &&
    !semLinhas &&
    backendDisponivel &&
    (!precisaAceitar || aceitouIgnoradas)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 animate-fade-in">
      {cabecalho}

      {(etapa === 'selecionar' || etapa === 'lendo') && (
        <>
          {erro && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-text"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
              {erro}
            </div>
          )}

          {etapa === 'lendo' ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-48 w-full rounded-[var(--radius-card)]" />
              <p className="text-center text-sm text-text-secondary">Lendo planilha…</p>
            </div>
          ) : (
            <SeletorArquivo onSelecionar={(arquivo) => void aoSelecionar(arquivo)} />
          )}

          {ativa && etapa === 'selecionar' && (
            <p className="text-sm leading-relaxed text-text-muted">
              Estoque atual: {ativa.arquivo_nome} · {formatarDataHora(ativa.created_at)} ·{' '}
              {ativa.total_itens.toLocaleString('pt-BR')} itens. Uma nova importação passa a ser
              a ativa e esta fica guardada como substituída — nenhum dado é apagado.
            </p>
          )}
        </>
      )}

      {(etapa === 'previa' || etapa === 'importando') && resultado && (
        <>
          <ResumoValidacao resultado={resultado} />

          {bloqueada && (
            <div
              role="alert"
              className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-text"
            >
              Faltam colunas obrigatórias:{' '}
              <strong>
                {resultado.colunasObrigatoriasAusentes.map((c) => c.rotulo).join(', ')}
              </strong>
              . Corrija a planilha e selecione novamente.
            </div>
          )}

          {!bloqueada && semLinhas && (
            <div
              role="alert"
              className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-[15px] text-text"
            >
              Nenhuma linha válida para importar.
            </div>
          )}

          {!bloqueada && resultado.linhas.length > 0 && (
            <AmostraLinhas linhas={resultado.linhas} />
          )}

          <ListaProblemas problemas={resultado.problemas} />

          {!backendDisponivel && (
            <div className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-[15px] text-warning">
              Modo pré-visualização: conecte o Supabase e entre com um administrador para importar.
            </div>
          )}

          {precisaAceitar && !bloqueada && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] text-text">
              <input
                type="checkbox"
                checked={aceitouIgnoradas}
                onChange={(evento) => setAceitouIgnoradas(evento.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary"
              />
              <span>
                Entendi que {resultado.linhasComErro.toLocaleString('pt-BR')}{' '}
                {resultado.linhasComErro === 1 ? 'linha com erro não será importada' : 'linhas com erro não serão importadas'}.
              </span>
            </label>
          )}

          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button
              size="lg"
              fullWidth
              disabled={!podeImportar}
              loading={etapa === 'importando'}
              onClick={() => void confirmarImportacao()}
            >
              Importar estoque
            </Button>
            <Button
              size="lg"
              variant="secondary"
              fullWidth
              disabled={etapa === 'importando'}
              onClick={recomecar}
            >
              <RotateCcw className="size-4" aria-hidden />
              Escolher outro arquivo
            </Button>
          </div>
        </>
      )}

      {etapa === 'concluida' && resultado && (
        <Card gradientTop padding="lg" className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <h3 className="mt-4 text-xl font-bold tracking-tight text-text">Estoque importado</h3>
          <p className="mt-2 text-[15px] text-text-secondary">
            {resultado.linhas.length.toLocaleString('pt-BR')} itens de {resultado.arquivoNome}.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" fullWidth onClick={() => navigate('/estoque')}>
              Ver estoque
            </Button>
            <Button size="lg" variant="secondary" fullWidth onClick={recomecar}>
              Importar outra planilha
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
