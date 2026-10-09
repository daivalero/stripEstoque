import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Trash2, Upload } from 'lucide-react'
import { ExportarCorrecoes } from '@/components/estoque/ExportarCorrecoes'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { apagarMarcasLocais } from '@/hooks/useInventarioMarcas'
import { useAuth } from '@/hooks/useAuth'
import { apagarEstoqueTemporario, listarImportacoes } from '@/services/estoque'
import type { EstoqueImportacao } from '@/types'
import { formatarNumero, isAdmin } from '@/utils/estoque'

const PALAVRA_CONFIRMACAO = 'APAGAR'

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const NOMES_PERFIL: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  operador: 'Operador',
}

export function Configuracoes() {
  const { displayName, profile, user, signOut } = useAuth()
  const { success, error: toastErro } = useToast()
  const admin = isAdmin(profile?.role)

  const [importacoes, setImportacoes] = useState<EstoqueImportacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [palavra, setPalavra] = useState('')
  const [apagando, setApagando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setImportacoes(await listarImportacoes())
    } catch {
      setImportacoes([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!admin) {
      setCarregando(false)
      return
    }
    void carregar()
  }, [admin, carregar])

  const ativa = importacoes.find((importacao) => importacao.status === 'ativa') ?? null
  const totalItens = importacoes.reduce((soma, importacao) => soma + importacao.total_itens, 0)

  function fecharConfirmacao() {
    if (apagando) return
    setConfirmando(false)
    setPalavra('')
  }

  async function apagar() {
    setApagando(true)
    try {
      await apagarEstoqueTemporario()
      apagarMarcasLocais()
      success('Estoque temporário apagado. O histórico foi mantido.')
      setConfirmando(false)
      setPalavra('')
      await carregar()
    } catch (error) {
      toastErro(error instanceof Error ? error.message : 'Não foi possível apagar o estoque.')
    } finally {
      setApagando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">Configurações</h2>
        <p className="mt-1 text-[15px] text-text-secondary">Conta e dados do sistema</p>
      </div>

      <Card padding="lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">Conta</p>
        <p className="mt-4 text-lg font-bold text-text">{displayName}</p>
        <p className="text-sm text-text-secondary">{profile?.email ?? user?.email ?? ''}</p>
        <p className="mt-2 text-sm text-text-secondary">
          Perfil:{' '}
          <span className="font-semibold text-text">
            {NOMES_PERFIL[profile?.role ?? ''] ?? profile?.role ?? 'Usuário'}
          </span>
        </p>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mt-5"
          onClick={() => void signOut()}
        >
          <LogOut className="size-5" aria-hidden />
          Sair
        </Button>
      </Card>

      {!admin && (
        <Card padding="lg">
          <p className="text-sm text-text-secondary">
            Exportação de correções e limpeza de dados são feitas por um administrador.
          </p>
        </Card>
      )}

      {admin && (
        <>
          <Card padding="lg">
            <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Planilha de correções
            </p>
            <p className="mb-4 mt-2 text-sm text-text-secondary">
              Gera um arquivo novo com o que foi corrigido na conferência e no inventário, para você
              ajustar no ERP. A planilha original nunca é alterada.
            </p>
            <ExportarCorrecoes />
          </Card>

          <Card padding="lg">
            <p className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Estoque importado
            </p>

            {carregando && <Skeleton className="mt-4 h-16 rounded-xl" />}

            {!carregando && importacoes.length === 0 && (
              <p className="mt-3 text-sm text-text-secondary">
                Nenhum estoque importado no momento.
              </p>
            )}

            {!carregando && ativa && (
              <div className="mt-3">
                <p className="text-base font-semibold text-text">{ativa.arquivo}</p>
                <p className="text-sm text-text-secondary">
                  {formatarNumero(ativa.total_itens)} itens · importado em {dataHora(ativa.created_at)}
                </p>
                {importacoes.length > 1 && (
                  <p className="mt-1 text-sm text-text-muted">
                    + {importacoes.length - 1} importação(ões) antiga(s) guardada(s)
                  </p>
                )}
              </div>
            )}

            <Link to="/importar" className="mt-4 block">
              <Button variant="secondary" size="lg" fullWidth>
                <Upload className="size-5" aria-hidden />
                Importar nova planilha
              </Button>
            </Link>
          </Card>

          <Card padding="lg">
            <p className="text-sm font-semibold uppercase tracking-wider text-danger">
              Apagar dados temporários
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Remove a cópia do estoque importada para este sistema. O histórico de alterações é
              mantido, e o ERP e a planilha original não são tocados. Exporte as correções antes.
            </p>
            <Button
              variant="danger"
              size="lg"
              fullWidth
              className="mt-4"
              disabled={carregando || importacoes.length === 0}
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="size-5" aria-hidden />
              Apagar estoque importado
            </Button>
          </Card>
        </>
      )}

      {confirmando && (
        <ConfirmDialog
          titulo="Apagar estoque importado?"
          confirmar="Apagar definitivamente"
          perigo
          carregando={apagando}
          desabilitarConfirmar={palavra.trim().toUpperCase() !== PALAVRA_CONFIRMACAO}
          onConfirmar={() => void apagar()}
          onCancelar={fecharConfirmacao}
        >
          <p className="text-sm text-text-secondary">
            {formatarNumero(totalItens)} itens serão removidos
            {importacoes.length > 1 ? ` em ${importacoes.length} importações` : ''}. Isso não pode
            ser desfeito. As conferências marcadas neste aparelho também serão limpas.
          </p>
          <Input
            name="confirmacao-apagar"
            label={`Digite ${PALAVRA_CONFIRMACAO} para confirmar`}
            value={palavra}
            onChange={(event) => setPalavra(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </ConfirmDialog>
      )}
    </div>
  )
}
