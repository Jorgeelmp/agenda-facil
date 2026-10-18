const DATA_HORA = /^([+-]?\d{4,})-(\d{2})-(\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

export const DIAS_SEMANA = [
  { value: 'SEG', label: 'Segunda-feira', curto: 'Seg' },
  { value: 'TER', label: 'Terça-feira', curto: 'Ter' },
  { value: 'QUA', label: 'Quarta-feira', curto: 'Qua' },
  { value: 'QUI', label: 'Quinta-feira', curto: 'Qui' },
  { value: 'SEX', label: 'Sexta-feira', curto: 'Sex' },
  { value: 'SAB', label: 'Sábado', curto: 'Sáb' },
  { value: 'DOM', label: 'Domingo', curto: 'Dom' },
]
// Date.getUTCDay(): 0 = domingo
const CODIGO_POR_DIA_JS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']

const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' })
const fmtMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' })
const fmtCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' })
const fmtLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtSemDiaSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
const fmtNumerica = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatarHora(hora) {
  if (typeof hora !== 'string') return ''
  if (/^\d{2}:\d{2}(?::00(?:\.0+)?)?$/.test(hora)) return hora.slice(0, 5)
  return hora.includes('.') ? hora.replace(/0+$/, '').replace(/\.$/, '') : hora
}

export function formatarHoraMinutos(hora) {
  return typeof hora === 'string' && /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(hora) ? hora.slice(0, 5) : ''
}

export function separarDataHora(dataHora) {
  const partes = DATA_HORA.exec(dataHora ?? '')
  if (!partes) return null
  const [, ano, mes, dia, hora] = partes
  return { ano, mes, dia, data: `${ano}-${mes}-${dia}`, hora }
}

export function agoraEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const parte = (tipo) => partes.find((item) => item.type === tipo).value
  return `${parte('year')}-${parte('month')}-${parte('day')}T${parte('hour')}:${parte('minute')}:${parte('second')}`
}

export function hojeEmSaoPaulo() {
  return agoraEmSaoPaulo().slice(0, 10)
}

// Datas "YYYY-MM-DD" são tratadas ao meio-dia UTC para não sofrer com fuso/horário de verão.
function comoDate(data) {
  return DATA.test(data ?? '') ? new Date(`${data}T12:00:00Z`) : null
}

export function dataValida(data) {
  const dia = comoDate(data)
  return Boolean(dia) && !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === data
}

export function somarDias(data, dias) {
  const dia = comoDate(data)
  dia.setUTCDate(dia.getUTCDate() + dias)
  return dia.toISOString().slice(0, 10)
}

export function codigoDiaSemana(data) {
  const dia = comoDate(data)
  return dia ? CODIGO_POR_DIA_JS[dia.getUTCDay()] : null
}

export function nomeDiaSemana(codigo) {
  return DIAS_SEMANA.find((dia) => dia.value === codigo)?.label ?? codigo
}

export function partesDia(data) {
  const dia = comoDate(data)
  return {
    semana: fmtDiaSemana.format(dia).replace('.', ''),
    numero: String(dia.getUTCDate()),
    mes: fmtMes.format(dia).replace('.', ''),
  }
}

function anoComum(data) {
  return /^\d{4}-/.test(data ?? '') && dataValida(data)
}

// "Hoje", "Amanhã", "Ontem" ou "qua., 17 de out."
export function rotuloDia(data, hoje = hojeEmSaoPaulo()) {
  if (!anoComum(data)) return formatarDataNumerica(data)
  if (data === hoje) return 'Hoje'
  if (data === somarDias(hoje, 1)) return 'Amanhã'
  if (data === somarDias(hoje, -1)) return 'Ontem'
  return fmtCurta.format(comoDate(data))
}

// "sexta-feira, 17 de outubro de 2026"
export function formatarDataLonga(data) {
  return anoComum(data) ? fmtLonga.format(comoDate(data)) : data ?? ''
}

// "17 de outubro de 2026"
export function formatarDataExtenso(data) {
  return anoComum(data) ? fmtSemDiaSemana.format(comoDate(data)) : data ?? ''
}

// "17/10/2026" (aceita data ou data/hora; anos fora de 4 dígitos são exibidos como vieram)
export function formatarDataNumerica(valor) {
  const soData = /^([+-]?\d{4,})-(\d{2})-(\d{2})$/.exec(valor ?? '')
  const partes = separarDataHora(valor) ?? (soData ? { data: valor, ano: soData[1], mes: soData[2], dia: soData[3] } : null)
  if (!partes) return valor ?? ''
  if (!/^\d{4}$/.test(partes.ano)) return `${partes.dia}/${partes.mes}/${partes.ano}`
  return fmtNumerica.format(comoDate(partes.data))
}

export function horaDe(dataHora) {
  const partes = separarDataHora(dataHora)
  return partes ? formatarHora(partes.hora) : dataHora ?? ''
}

export function dataDe(dataHora) {
  return separarDataHora(dataHora)?.data ?? ''
}

export function periodoDoDia(hora) {
  const h = Number(String(hora).slice(0, 2))
  if (h < 12) return 'Manhã'
  if (h < 18) return 'Tarde'
  return 'Noite'
}

export function proximosDias(hoje, quantidade = 14) {
  return Array.from({ length: quantidade }, (_, i) => somarDias(hoje, i))
}
