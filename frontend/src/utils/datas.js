const DATA_HORA = /^([+-]?\d{4,})-(\d{2})-(\d{2})T(\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)$/

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
