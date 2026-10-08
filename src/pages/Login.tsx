import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ScanLine, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'

const benefits = [
  {
    icon: ScanLine,
    title: 'Scanner no chão',
    description: 'Conferir bobinas direto no estoque pelo iPhone.',
  },
  {
    icon: Smartphone,
    title: 'Feito para mobile',
    description: 'Interface limpa, rápida e instalável como PWA.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem alterar o ERP',
    description: 'Trabalhe em cópia temporária e exporte correções.',
  },
]

export function Login() {
  const { session, loading, signIn, isConfigured, enterDemo } = useAuth()
  const { error: toastError, success } = useToast()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (!email.trim() || !password) {
      setFormError('Preencha email e senha.')
      return
    }

    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)

    if (error) {
      setFormError(error)
      toastError(error)
    }
  }

  function handleDemo() {
    enterDemo()
    success('Modo pré-visualização ativado')
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div
        className="pointer-events-none absolute -left-24 top-0 size-80 rounded-full bg-primary/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 size-72 rounded-full bg-danger/10 blur-[90px]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center px-4 py-8 lg:px-8">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Lado esquerdo — desktop */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="hidden lg:block"
          >
            <Logo variant="full" />
            <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight text-text xl:text-5xl">
              Controle de
              <br />
              estoque inteligente
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-text-secondary">
              Concilie o estoque físico com o digital. Escaneie, confira e
              exporte correções sem tocar no ERP.
            </p>

            <ul className="mt-10 space-y-4">
              {benefits.map((item) => {
                const Icon = item.icon
                return (
                  <li
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-bg-card/60 p-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-soft">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {item.description}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </motion.div>

          {/* Formulário */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-auto w-full max-w-md"
          >
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-5 flex justify-center">
                <Logo variant="full" />
              </div>
              <h1 className="text-[1.75rem] font-extrabold tracking-tight text-text">
                Controle de Estoque
              </h1>
              <p className="mt-2 text-[15px] text-text-secondary">
                Entre para conferir o estoque físico
              </p>
            </div>

            <Card gradientTop padding="lg" className="bg-bg-card">
              <div className="mb-6 hidden lg:block">
                <h2 className="text-2xl font-bold tracking-tight text-text">
                  Login
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Acesse com suas credenciais
                </p>
              </div>

              {!isConfigured && (
                <div className="mb-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
                  Configure o arquivo <strong>.env</strong> com as chaves do
                  Supabase para autenticar.
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
                <Input
                  label="Senha"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  error={formError ?? undefined}
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  className="mt-2"
                >
                  Entrar
                  <ArrowRight className="size-5" aria-hidden />
                </Button>
              </form>

              {!isConfigured && (
                <div className="mt-4 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={handleDemo}
                  >
                    Pré-visualizar interface
                  </Button>
                </div>
              )}
            </Card>

            <p className="mt-6 text-center text-xs text-text-muted">
              Sistema interno · Acesso restrito
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
