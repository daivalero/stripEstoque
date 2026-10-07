import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Link>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-text">
          {title}
        </h2>
        <p className="mt-1 text-[15px] text-text-secondary">{description}</p>
      </div>

      <Card gradientTop padding="lg">
        <p className="text-sm font-medium text-text">Em breve nesta fase</p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Esta área será implementada nas próximas etapas. A estrutura visual e
          a navegação já estão prontas para crescimento.
        </p>
      </Card>
    </div>
  )
}
