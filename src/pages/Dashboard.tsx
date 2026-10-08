import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ClipboardList,
  History,
  ScanLine,
  Search,
  Upload,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { MaterialBadge } from '@/components/estoque/MaterialBadge'
import { useAuth } from '@/hooks/useAuth'
import { buscarImportacaoAtiva, contarPorMaterial } from '@/services/estoque'
import type { MaterialTipo } from '@/types'
import { isAdmin } from '@/utils/estoque'

const quickActions = [
  {
    to: '/inventario',
    label: 'Inventário',
    description: 'Conferir por localização',
    icon: ClipboardList,
  },
  {
    to: '/estoque',
    label: 'Pesquisar',
    description: 'Buscar item ou lote',
    icon: Search,
  },
  {
    to: '/historico',
    label: 'Alterações',
    description: 'Ver histórico',
    icon: History,
  },
  {
    to: '/importar',
    label: 'Importar',
    description: 'Atualizar do Excel',
    icon: Upload,
  },
] as const

const materiaisResumo: MaterialTipo[] = [
  '1070_temperado',
  '1070_sem_temperado',
  'inox',
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
}

export function Dashboard() {
  const { displayName, isDemo, profile } = useAuth()
  const [contagens, setContagens] = useState<Partial<Record<MaterialTipo, number>>>({})
  const [totalItens, setTotalItens] = useState<number | null>(null)
  const acoes = quickActions.filter(
    (acao) => acao.to !== '/importar' || isAdmin(profile?.role),
  )

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const importacao = await buscarImportacaoAtiva()
        if (!ativo || !importacao) return
        setTotalItens(importacao.total_itens)
        const materiais = await contarPorMaterial(importacao.id)
        if (ativo) setContagens(materiais)
      } catch {
        if (ativo) setTotalItens(null)
      }
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-7 lg:gap-8"
    >
      {isDemo && (
        <motion.div
          variants={item}
          className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          Modo pré-visualização — configure o Supabase no .env para autenticar de verdade.
        </motion.div>
      )}

      <motion.div variants={item}>
        <p className="text-sm text-text-secondary">Olá,</p>
        <h2 className="mt-1 text-[1.65rem] font-extrabold tracking-tight text-text lg:text-3xl">
          {displayName}
        </h2>
      </motion.div>

      <motion.div variants={item}>
        <Link to="/scanner" className="block">
          <Card
            interactive
            gradientTop
            padding="lg"
            className="group relative min-h-[9.5rem]"
          >
            <div className="flex h-full items-start justify-between gap-4">
              <div className="flex flex-col gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft transition-colors duration-200 group-hover:bg-primary/25">
                  <ScanLine className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text">
                    Escanear material
                  </h3>
                  <p className="mt-1 text-[15px] text-text-secondary">
                    Leia o código da bobina
                  </p>
                </div>
              </div>
              <ArrowRight
                className="mt-1 size-5 shrink-0 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text"
                aria-hidden
              />
            </div>
          </Card>
        </Link>
      </motion.div>

      <motion.section variants={item} aria-labelledby="acoes-rapidas">
        <h3
          id="acoes-rapidas"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted"
        >
          Ações rápidas
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {acoes.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.to} to={action.to}>
                <Card interactive padding="md" className="h-full min-h-[6.5rem]">
                  <Icon
                    className="size-5 text-primary-soft"
                    aria-hidden
                  />
                  <p className="mt-3 text-[15px] font-semibold text-text">
                    {action.label}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {action.description}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      </motion.section>

      <motion.section variants={item} aria-labelledby="materiais">
        <h3
          id="materiais"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted"
        >
          Materiais
        </h3>
        <Card padding="md">
          <ul className="divide-y divide-border">
            {materiaisResumo.map((tipo) => (
              <li
                key={tipo}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <MaterialBadge tipo={tipo} />
                <span className="text-sm font-semibold text-text">
                  {contagens[tipo] ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">
            {totalItens == null
              ? 'Contagens disponíveis após importar o estoque'
              : `${totalItens} itens na importação atual`}
          </p>
        </Card>
      </motion.section>

      {/* Extra desktop context */}
      <motion.section
        variants={item}
        className="hidden lg:grid lg:grid-cols-3 lg:gap-4"
        aria-label="Resumo operacional"
      >
        {[
          { label: 'Itens importados', value: totalItens == null ? '—' : String(totalItens) },
          { label: 'Conferências hoje', value: '—' },
          { label: 'Divergências', value: '—' },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="text-sm text-text-secondary">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text">
              {stat.value}
            </p>
          </Card>
        ))}
      </motion.section>
    </motion.div>
  )
}
