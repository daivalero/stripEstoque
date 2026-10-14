/** Aviso interno: o histórico mudou (alguém salvou ou apagou uma modificação). */
export const EVENTO_HISTORICO = 'estoque:historico-mudou'

export function avisarMudancaNoHistorico(): void {
  window.dispatchEvent(new Event(EVENTO_HISTORICO))
}
