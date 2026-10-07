import type { ResultadoLeitura } from '@/services/excel/tipos'
import { supabase } from '@/services/supabase'

/**
 * Grava a importação inteira numa única transação no banco (função
 * importar_estoque). Se algo falhar, nada é gravado. A importação anterior é
 * marcada como "substituida", mas seus dados não são apagados.
 */
export async function importarEstoque(resultado: ResultadoLeitura): Promise<string> {
  const itens = resultado.linhas.map((linha) => ({
    linha: linha.linha,
    descricao: linha.descricao || null,
    dep: linha.dep || null,
    familia: linha.familia || null,
    item: linha.item,
    espessura: linha.espessura,
    estab: linha.estab || null,
    largura: linha.largura,
    lote: linha.lote || null,
    localizacao: linha.localizacao,
    superficie: linha.superficie || null,
    quantidade: linha.quantidade,
    material: linha.material,
  }))

  const { data, error } = await supabase.rpc('importar_estoque', {
    p_arquivo: resultado.arquivoNome,
    p_itens: itens,
    p_linhas_ignoradas: resultado.linhasComErro,
  })

  if (error) {
    if (error.code === '42501') {
      throw new Error('Apenas administradores podem importar estoque.')
    }
    throw new Error('Não foi possível importar o estoque. Nenhum dado foi gravado.')
  }

  return data as string
}
