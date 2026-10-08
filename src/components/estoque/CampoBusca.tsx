import { Search, X } from 'lucide-react'

interface CampoBuscaProps {
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
}

export function CampoBusca({
  valor,
  onChange,
  placeholder = 'Item, lote ou localização',
}: CampoBuscaProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        aria-label="Pesquisar no estoque"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="h-12 w-full rounded-[var(--radius-input)] border border-border bg-bg-elevated pl-12 pr-12 text-base text-text transition-colors duration-200 placeholder:text-text-muted hover:border-border-strong focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-soft/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar pesquisa"
          className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-text-secondary transition-colors hover:text-text"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}
