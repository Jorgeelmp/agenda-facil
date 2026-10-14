import { separarDataHora } from '../../utils/datas'

const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
const formatoNota = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const ROTULOS_NOTA = { 1: 'Ruim', 2: 'Regular', 3: 'Bom', 4: 'Muito bom', 5: 'Excelente' }

// "2026-10-14T13:20:11.123" -> "14/10/2026"
export function formatarData(dataHora) {
  const partes = separarDataHora(dataHora)
  if (!partes) return dataHora ?? ''
  if (!/^\d{4}$/.test(partes.ano)) return `${partes.dia}/${partes.mes}/${partes.ano}`
  return formatoData.format(new Date(`${partes.data}T12:00:00Z`))
}

// 4.3 -> "4,3"
export function formatarNota(nota) {
  return formatoNota.format(Number(nota))
}

export function totalAvaliacoes(total) {
  return total === 1 ? '1 avaliação' : `${total} avaliações`
}
