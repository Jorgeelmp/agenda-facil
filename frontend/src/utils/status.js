export const STATUS = {
  PENDENTE: { label: 'Pendente', className: 'badge badge--pending', descricao: 'Aguardando confirmação do prestador' },
  CONFIRMADO: { label: 'Confirmado', className: 'badge badge--confirmed', descricao: 'Horário garantido' },
  CONCLUIDO: { label: 'Concluído', className: 'badge badge--done', descricao: 'Atendimento realizado' },
  CANCELADO: { label: 'Cancelado', className: 'badge badge--cancelled', descricao: 'Horário liberado' },
}


export function estaAtivo(agendamento) {
  return agendamento.status === 'PENDENTE' || agendamento.status === 'CONFIRMADO'
}

export const PERFIS = { CLIENTE: 'Cliente', PRESTADOR: 'Prestador', ADMIN: 'Administrador' }
