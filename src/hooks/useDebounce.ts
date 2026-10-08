import { useEffect, useState } from 'react'

export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [debounced, setDebounced] = useState(valor)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(valor), atrasoMs)
    return () => window.clearTimeout(id)
  }, [valor, atrasoMs])

  return debounced
}
