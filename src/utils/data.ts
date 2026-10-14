const DIA_MES_ANO: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
const HORA_MINUTO: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

/** "14/10/2026" */
export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', DIA_MES_ANO)
}

/** "09:32" */
export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', HORA_MINUTO)
}

/** "14/10/2026 às 09:32" */
export function formatarDataHora(iso: string): string {
  return `${formatarData(iso)} às ${formatarHora(iso)}`
}
