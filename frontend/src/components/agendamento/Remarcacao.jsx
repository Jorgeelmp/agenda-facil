import { useCallback, useId, useState } from 'react'
import { Alert } from '../Alert'
import { ErrorState, Icon, Loading, Modal } from '../ui'
import { useApiResource } from '../../hooks/useApiResource'
import { agendamentoApi, horarioApi } from '../../services/api'
import { GradeHorarios, SeletorDia } from './Seletores'
import {
  codigoDiaSemana, dataDe, dataValida, formatarDataLonga, formatarHora, horaDe, hojeEmSaoPaulo,
} from '../../utils/datas'

// Remarcar = escolher um novo horário livre (o próprio agendamento não conta como ocupado)
// ou só ajustar as observações. Mudar o horário volta o status para pendente (regra do backend).
export function Remarcacao({ agendamento, onCancel, onSaved }) {
  const observacoesId = useId()
  const hoje = hojeEmSaoPaulo()
  const [data, setData] = useState(() => {
    const atual = dataDe(agendamento.dataHora)
    return dataValida(atual) && atual >= hoje ? atual : hoje
  })
  const [horarioNovo, setHorarioNovo] = useState('')
  const [observacoes, setObservacoes] = useState(agendamento.observacoes ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [revisao, setRevisao] = useState(0)

  const carregarDias = useCallback((options) => horarioApi.listar(agendamento.prestadorId, options)
    .then((lista) => Array.isArray(lista) ? new Set(lista.map((item) => item.diaSemana)) : null)
    .catch(() => null), [agendamento.prestadorId])
  const dias = useApiResource(carregarDias, `dias:${agendamento.prestadorId}`)
  const abre = (dia) => !dias.data || dias.data.size === 0 || dias.data.has(codigoDiaSemana(dia))

  const dataOk = dataValida(data) && data >= hoje
  const carregar = useCallback((options) => agendamentoApi.disponibilidade(agendamento.id, data, options), [agendamento.id, data])
  const disponibilidade = useApiResource(carregar, `${agendamento.id}:${data}:${revisao}`, { enabled: dataOk })
  const horarios = disponibilidade.data?.horarios ?? []

  async function salvar(event) {
    event?.preventDefault()
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const dataHora = horarioNovo ? `${data}T${horarioNovo}` : agendamento.dataHora
      onSaved(await agendamentoApi.atualizar(agendamento.id, {
        servicoId: agendamento.servicoId,
        dataHora,
        observacoes: observacoes.trim() || null,
      }))
    } catch (err) {
      setErro({ message: err.message, errors: err.errors ?? [] })
      if (err.status === 409) {
        setHorarioNovo('')
        setRevisao((valor) => valor + 1)
      }
      setEnviando(false)
    }
  }

  return (
    <Modal
      title={`Remarcar ${agendamento.servicoNome}`}
      description={`Atual: ${formatarDataLonga(dataDe(agendamento.dataHora))} às ${horaDe(agendamento.dataHora)}.`}
      onClose={onCancel}
      busy={enviando}
      footer={(
        <>
          <button className="btn btn--secondary" type="button" onClick={onCancel} disabled={enviando}>Cancelar</button>
          <button className="btn btn--primary" type="submit" form={`${observacoesId}-form`} disabled={enviando}>
            {enviando ? 'Salvando…' : horarioNovo ? `Remarcar para ${formatarHora(horarioNovo)}` : 'Salvar observações'}
          </button>
        </>
      )}
    >
      <form id={`${observacoesId}-form`} className="form" onSubmit={salvar} aria-label="Remarcar agendamento">
        <p className="notice"><Icon name="info" />Escolha um novo horário ou apenas altere as observações. Ao mudar o horário, o agendamento volta a aguardar a confirmação do prestador.</p>
        <SeletorDia data={data} hoje={hoje} abre={abre} disabled={enviando} onChange={(valor) => { setData(valor); setHorarioNovo('') }} />
        {!dataOk ? <p className="subtle">Escolha uma data a partir de hoje.</p>
          : disponibilidade.loading ? <Loading>Consultando horários livres…</Loading>
            : disponibilidade.error ? <ErrorState error={disponibilidade.error} onRetry={() => setRevisao((v) => v + 1)} />
              : horarios.length === 0 ? <p className="notice" role="status"><Icon name="calendar" />Não há horários livres neste dia.</p> : (
                <GradeHorarios horarios={horarios} selecionado={horarioNovo} rotulo="Novos horários livres" formatar={formatarHora}
                  desabilitado={(item) => enviando || `${data}T${item}` === agendamento.dataHora}
                  sufixo={(item) => `${data}T${item}` === agendamento.dataHora ? ' (atual)' : null}
                  onSelect={setHorarioNovo} />
              )}
        <div className="field">
          <label className="field__label" htmlFor={observacoesId}>Observações<span className="field__hint">Opcional</span></label>
          <textarea id={observacoesId} rows={3} maxLength={500} value={observacoes} disabled={enviando}
            onChange={(event) => setObservacoes(event.target.value)} />
        </div>
        {erro && <Alert message={erro.message} errors={erro.errors} />}
      </form>
    </Modal>
  )
}
