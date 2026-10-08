import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeScanner, lerCodigoDeArquivo } from '@/components/scanner/BarcodeScanner'
import { ItemCard } from '@/components/estoque/ItemCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { buscarPorCodigo } from '@/services/estoque'
import { loteDaEtiqueta } from '@/utils/estoque'
import type { EstoqueItem } from '@/types'

export function Scanner() {
  const navigate = useNavigate()
  const [cameraAtiva, setCameraAtiva] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [opcoes, setOpcoes] = useState<EstoqueItem[]>([])
  const [codigoLido, setCodigoLido] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const arquivoRef = useRef<HTMLInputElement>(null)

  async function procurar(valor: string) {
    const termo = valor.trim()
    if (!termo) return

    const lote = loteDaEtiqueta(termo)
    setCodigoLido(lote ?? termo)
    setBuscando(true)
    setErro(null)
    setOpcoes([])
    setCameraAtiva(false)

    try {
      const itens = await buscarPorCodigo(termo)
      if (itens.length === 1) {
        navigate(`/produto/${itens[0].id}`)
        return
      }
      if (itens.length === 0) {
        setErro(
          lote
            ? `Lote ${lote} não encontrado no estoque importado.`
            : `Código ${termo} não encontrado no estoque importado.`,
        )
        return
      }
      setOpcoes(itens)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível buscar o código.')
    } finally {
      setBuscando(false)
    }
  }

  function tentarDeNovo() {
    setErro(null)
    setOpcoes([])
    setCodigo('')
    setCodigoLido('')
    setTentativa((n) => n + 1)
    setCameraAtiva(true)
  }

  async function lerFoto(arquivo: File) {
    setErro(null)
    setBuscando(true)
    setCameraAtiva(false)
    try {
      const lido = await lerCodigoDeArquivo(arquivo)
      if (!lido) {
        setErro('Não consegui ler o código nessa foto.')
        setBuscando(false)
        setCameraAtiva(true)
        return
      }
      await procurar(lido)
    } catch {
      setErro('Não consegui ler o código nessa foto. Chegue mais perto e tente de novo.')
      setBuscando(false)
      setCameraAtiva(true)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-[1.65rem] font-extrabold tracking-tight text-text">
          Escanear material
        </h2>
        <p className="mt-1 text-[15px] text-text-secondary">Aponte para a barra da etiqueta</p>
      </div>

      {cameraAtiva && (
        <BarcodeScanner
          key={tentativa}
          ativo={cameraAtiva}
          onDetect={(lido) => void procurar(lido)}
          onErro={setErro}
        />
      )}

      {buscando && (
        <Card padding="md">
          <p className="text-sm text-text-secondary">
            Buscando {codigoLido || 'código'}...
          </p>
        </Card>
      )}

      {erro && (
        <Card padding="lg">
          <p className="text-sm text-text">{erro}</p>
          <Button variant="secondary" fullWidth className="mt-4" onClick={tentarDeNovo}>
            Tentar de novo
          </Button>
        </Card>
      )}

      {opcoes.length > 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">Vários itens encontrados. Escolha um.</p>
          {opcoes.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
          <Button variant="secondary" size="lg" fullWidth onClick={tentarDeNovo}>
            Escanear outro
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void procurar(codigo)
        }}
      >
        <Input
          label="Digitar código manualmente"
          name="codigo"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          placeholder="Item, lote ou 017;lote;peso"
          autoComplete="off"
        />
        <Button type="submit" size="lg" fullWidth loading={buscando}>
          Buscar código
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={buscando}
          onClick={() => arquivoRef.current?.click()}
        >
          Ler foto do código
        </Button>
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const arquivo = event.target.files?.[0]
            event.target.value = ''
            if (arquivo) void lerFoto(arquivo)
          }}
        />
      </form>
    </div>
  )
}
