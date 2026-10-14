import { buscarNomes } from '@/services/alteracoes'
import { chaveDoItem } from '@/services/historico'
import { avisarMudancaNoHistorico } from '@/services/historicoEventos'
import { supabase } from '@/services/supabase'

export type StatusConferencia = 'ok' | 'ausente' | 'movido'

/** Item já conferido no inventário (vale para qualquer estoque importado). */
export interface Conferencia {
  chave: string
  item: string
  lote: string | null
  localizacao: string | null
  status: StatusConferencia
  userId: string
  nome: string
  conferidoEm: string
}

const TAMANHO_PAGINA = 1000

const MENSAGEM_MIGRACAO =
  'O banco ainda não guarda o inventário. Rode a migração 009_conferencias_inventario.sql no Supabase.'

function ehTabelaAusente(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes('inventario_conferencias'))
}

export async function carregarConferencias(): Promise<Conferencia[]> {
  const linhas: {
    chave: string
    item: string
    lote: string | null
    localizacao: string | null
    status: StatusConferencia
    user_id: string
    conferido_em: string
  }[] = []

  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await supabase
      .from('inventario_conferencias')
      .select('chave, item, lote, localizacao, status, user_id, conferido_em')
      .order('conferido_em', { ascending: false })
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error) throw new Error(ehTabelaAusente(error) ? MENSAGEM_MIGRACAO : 'Não foi possível carregar o inventário.')
    linhas.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
  }

  const nomes = await buscarNomes(linhas.map((linha) => linha.user_id))

  return linhas.map((linha) => ({
    chave: linha.chave,
    item: linha.item,
    lote: linha.lote,
    localizacao: linha.localizacao,
    status: linha.status,
    userId: linha.user_id,
    nome: nomes.get(linha.user_id) ?? 'Usuário',
    conferidoEm: linha.conferido_em,
  }))
}

interface RegistroConferencia {
  userId: string | undefined
  item: string
  lote: string | null
  localizacao: string | null
  status: StatusConferencia
}

/** Grava (ou atualiza) a conferência do item. Conferir de novo troca o responsável, o dia e a hora. */
export async function registrarConferencia({
  userId,
  item,
  lote,
  localizacao,
  status,
}: RegistroConferencia): Promise<void> {
  if (!userId) throw new Error('Sessão expirada. Entre novamente.')

  const { error } = await supabase.from('inventario_conferencias').upsert(
    {
      chave: chaveDoItem(item, lote),
      item,
      lote,
      localizacao,
      status,
      user_id: userId,
      conferido_em: new Date().toISOString(),
    },
    { onConflict: 'chave' },
  )

  if (error) throw new Error(ehTabelaAusente(error) ? MENSAGEM_MIGRACAO : 'Não foi possível salvar a conferência.')
  avisarMudancaNoHistorico()
}

export async function apagarConferencia(item: string, lote: string | null): Promise<void> {
  const { error } = await supabase
    .from('inventario_conferencias')
    .delete()
    .eq('chave', chaveDoItem(item, lote))

  if (error) throw new Error(ehTabelaAusente(error) ? MENSAGEM_MIGRACAO : 'Não foi possível desfazer a conferência.')
  avisarMudancaNoHistorico()
}
