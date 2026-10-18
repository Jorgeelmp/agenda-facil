import { useCallback, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../Alert'
import { EmptyState, ErrorState, Icon, Loading } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useApiResource } from '../../hooks/useApiResource'
import { agendamentoApi, horarioApi, prestadorApi } from '../../services/api'
import { moeda } from '../servico/formatos'
import { GradeHorarios, SeletorDia } from '../agendamento/Seletores'
import { agoraEmSaoPaulo, codigoDiaSemana, dataValida, formatarDataLonga, formatarHoraMinutos as formatarHora, hojeEmSaoPaulo, proximosDias as listarProximosDias } from '../../utils/datas'
const horaValida = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/

function mensagemErro(erro, consulta = false) {
  if (erro.status === 0) return 'Não foi possível conectar ao servidor. Tente novamente.'
  if (erro.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.'
  if (erro.status === 403) return 'Você não tem permissão para consultar estes dados.'
  if (erro.status === 404) return 'O prestador ou serviço não está mais disponível. Escolha outro negócio ou serviço.'
  if (erro.status === 400 && consulta) return 'Confira o serviço e a data selecionados e tente novamente.'
  return consulta
    ? 'Não foi possível consultar os horários. Tente novamente.'
    : 'Não foi possível carregar os serviços. Tente novamente.'
}

function somarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function Passo({ numero, titulo, resumo, estado, children }) {
  return (
    <li className={`step is-${estado}`}>
      <div className="step__rail">
        <span className="step__num">{estado === 'done' ? <Icon name="check" size="sm" /> : numero}</span>
        <span className="step__line" />
      </div>
      <div className="step__content">
        <div className="step__title"><h3>{titulo}</h3>{resumo && <span className="step__summary">{resumo}</span>}</div>
        {children}
      </div>
    </li>
  )
}

// Fluxo de agendamento (RF04, RF07 e RF08): serviço → dia → horário livre → confirmação.
// Quem não é cliente vê os mesmos passos, mas apenas consulta a disponibilidade.
export default function DisponibilidadePrestador({ prestadorId, ativo, revision = 0, servicoInicial }) {
  if (!prestadorId) return null
  return <AssistenteAgendamento key={prestadorId} prestadorId={prestadorId} ativo={ativo} revision={revision} servicoInicial={servicoInicial} />
}

function AssistenteAgendamento({ prestadorId, ativo, revision, servicoInicial }) {
  const tituloId = useId()
  const observacoesId = useId()
  const { payload } = useAuth()
  const notify = useToast()
  const podeAgendar = payload?.tipo === 'CLIENTE'
  const hoje = hojeEmSaoPaulo()

  const [servicoEscolhido, setServicoEscolhido] = useState(servicoInicial ?? '')
  const [dataEscolhida, setDataEscolhida] = useState('')
  const [hora, setHora] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [criado, setCriado] = useState(null)
  const [atualizacao, setAtualizacao] = useState(0)

  const contexto = `${prestadorId}:${ativo}:${revision}`
  const carregarBase = useCallback(async ({ signal }) => {
    const [resposta, horarios] = await Promise.all([
      prestadorApi.servicos(prestadorId, { signal }),
      horarioApi.listar(prestadorId, { signal }).catch(() => null),
    ])
    if (!Array.isArray(resposta)) throw new Error('Resposta inválida')
    const servicos = resposta.filter((item) => item.ativo === true)
    if (servicos.some((item) => typeof item.id !== 'string' || typeof item.nome !== 'string'
      || !Number.isInteger(item.duracaoMinutos) || item.duracaoMinutos <= 0
      || item.preco === null || item.preco === undefined || !Number.isFinite(Number(item.preco)))) {
      throw new Error('Resposta inválida')
    }
    return { servicos, horarios: Array.isArray(horarios) ? horarios : null }
  }, [prestadorId])
  const base = useApiResource(carregarBase, contexto, { enabled: Boolean(ativo) })
  const servicos = useMemo(() => base.data?.servicos ?? [], [base.data])
  const expedientes = base.data?.horarios
  const diasAbertos = useMemo(() => expedientes ? new Set(expedientes.map((item) => item.diaSemana)) : null, [expedientes])

  const servico = servicos.find((item) => item.id === servicoEscolhido)
  const proximosDias = useMemo(() => listarProximosDias(hoje), [hoje])
  const abre = useCallback((dia) => !diasAbertos || diasAbertos.has(codigoDiaSemana(dia)), [diasAbertos])
  // Sugere o primeiro dia de atendimento a partir de hoje (hoje só se o expediente ainda não acabou).
  const agora = agoraEmSaoPaulo().slice(11, 16)
  const sugerivel = (dia) => abre(dia) && (dia !== hoje || !expedientes
    || expedientes.some((item) => item.diaSemana === codigoDiaSemana(dia) && formatarHora(item.horaFim) > agora))
  const data = dataEscolhida || proximosDias.find(sugerivel) || hoje
  const dataOk = dataValida(data) && data >= hoje && data <= '9999-12-31'

  const chaveConsulta = `${contexto}:${servico?.id}:${data}:${atualizacao}`
  const servicoId = servico?.id
  const carregarHorarios = useCallback(async ({ signal }) => {
    const resposta = await prestadorApi.disponibilidade(prestadorId, servicoId, data, { signal })
    if (resposta?.data !== data || !Array.isArray(resposta?.horarios)
      || resposta.horarios.some((item) => typeof item !== 'string' || !horaValida.test(item))) {
      throw new Error('Resposta inválida')
    }
    return resposta.horarios
  }, [prestadorId, servicoId, data])
  const consulta = useApiResource(carregarHorarios, chaveConsulta, { enabled: Boolean(ativo && servico && dataOk) })
  const horarios = useMemo(() => consulta.data ?? [], [consulta.data])
  const horaAtual = horarios.includes(hora) ? hora : ''


  function escolherServico(id) {
    setServicoEscolhido(id)
    setHora('')
    setAviso(null)
    setErroEnvio(null)
  }

  function escolherData(valor) {
    setDataEscolhida(valor)
    setHora('')
    setAviso(null)
    setErroEnvio(null)
  }

  function recarregarHorarios() {
    setAtualizacao((valor) => valor + 1)
  }

  async function agendar(evento) {
    evento.preventDefault()
    if (!horaAtual || enviando) return
    setEnviando(true)
    setErroEnvio(null)
    setAviso(null)
    try {
      const agendamento = await agendamentoApi.criar({ servicoId: servico.id, dataHora: `${data}T${horaAtual}`, observacoes: observacoes.trim() || null })
      setCriado({ servico, data, hora: horaAtual, agendamento })
      notify(`Agendamento solicitado para ${formatarDataLonga(data)} às ${formatarHora(horaAtual)}. Aguarde a confirmação do prestador.`)
      setHora('')
      setObservacoes('')
      recarregarHorarios()
    } catch (erro) {
      if (erro.status === 409) {
        // Horário tomado por outro cliente ou que coincide com outro agendamento do próprio cliente:
        // mostra o motivo informado pela API e atualiza a lista para exibir só o que continua livre.
        setAviso(erro.message || 'Este horário não está mais disponível. Escolha outro horário livre.')
        setHora('')
        recarregarHorarios()
      } else {
        setErroEnvio(erro)
      }
    } finally {
      setEnviando(false)
    }
  }

  const titulo = podeAgendar ? 'Agendar horário' : 'Horários disponíveis'

  if (criado) {
    return (
      <section className="card" aria-labelledby={tituloId}>
        <div className="success-panel">
          <span className="success-panel__icon"><Icon name="check" size="lg" /></span>
          <h2 id={tituloId}>Agendamento solicitado!</h2>
          <p>
            {criado.servico.nome} em {formatarDataLonga(criado.data)} às {formatarHora(criado.hora)}.
            O prestador vai confirmar o horário. Você acompanha tudo em Meus agendamentos.
          </p>
          <div className="form-actions">
            <Link className="btn btn--primary" to="/dashboard/agendamentos">Ver meus agendamentos</Link>
            <button className="btn btn--secondary" type="button" onClick={() => setCriado(null)}>Agendar outro horário</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="card" aria-labelledby={tituloId} id="agendar">
      <div className="card__header">
        <div>
          <h2 id={tituloId}>{titulo}</h2>
          <p>{podeAgendar
            ? 'Escolha o serviço, o dia e um horário livre. Horários de Brasília.'
            : 'Consulte os horários livres por serviço e dia. Somente clientes podem agendar.'}</p>
        </div>
      </div>

      {!ativo ? (
        <EmptyState icon="alert" title="Agenda indisponível" compact>Este prestador está inativo e não oferece horários disponíveis.</EmptyState>
      ) : base.loading ? (
        <Loading>Carregando serviços…</Loading>
      ) : base.error ? (
        <ErrorState message={mensagemErro(base.error)} onRetry={base.retry} />
      ) : servicos.length === 0 ? (
        <EmptyState icon="sparkles" title="Nenhum serviço disponível" compact>Este prestador ainda não tem serviços ativos para agendamento.</EmptyState>
      ) : (
        <ol className="steps">
          <Passo numero={1} titulo="Serviço" estado={servico ? 'done' : 'current'}
            resumo={servico && `${servico.duracaoMinutos} min · ${moeda.format(Number(servico.preco))}`}>
            <div className="options" role="radiogroup" aria-label="Serviço">
              {servicos.map((item) => (
                <label className="option" key={item.id}>
                  <input type="radio" name={`servico-${prestadorId}`} value={item.id} checked={servico?.id === item.id} onChange={() => escolherServico(item.id)} />
                  <span className="option__radio" aria-hidden="true" />
                  <span className="option__body">
                    <strong>{item.nome}</strong>
                    <span>{item.descricao ? `${item.descricao} · ` : ''}{item.duracaoMinutos} min</span>
                  </span>
                  <span className="option__price">{moeda.format(Number(item.preco))}</span>
                </label>
              ))}
            </div>
          </Passo>

          <Passo numero={2} titulo="Dia" estado={!servico ? 'locked' : horaAtual ? 'done' : 'current'}
            resumo={dataOk ? formatarDataLonga(data) : null}>
            {diasAbertos && diasAbertos.size === 0 && (
              <p className="notice"><Icon name="info" />Este negócio ainda não cadastrou os dias de atendimento.</p>
            )}
            <SeletorDia data={data} hoje={hoje} abre={abre} onChange={escolherData} mostrarFaixa={!diasAbertos || diasAbertos.size > 0} />
          </Passo>

          <Passo numero={3} titulo="Horário" estado={!servico ? 'locked' : horaAtual ? 'done' : 'current'}
            resumo={horaAtual ? `${formatarHora(horaAtual)} às ${somarMinutos(horaAtual, servico.duracaoMinutos)}` : null}>
            <div aria-live="polite" aria-busy={consulta.loading} className="stack">
              {aviso && <Alert message={aviso} />}
              {!servico ? (
                <p className="subtle">Escolha um serviço para ver os horários livres.</p>
              ) : !dataOk ? (
                <Alert message="Escolha uma data válida a partir de hoje." />
              ) : consulta.loading ? (
                <Loading>Consultando horários disponíveis…</Loading>
              ) : consulta.error ? (
                <ErrorState message={mensagemErro(consulta.error, true)} onRetry={recarregarHorarios} />
              ) : horarios.length === 0 ? (
                <p className="notice" role="status"><Icon name="calendar" />Não há horários livres para este serviço neste dia. Escolha outra data.</p>
              ) : (
                <>
                  <GradeHorarios horarios={horarios} selecionado={horaAtual} interativo={podeAgendar} desabilitado={() => enviando}
                    onSelect={(item) => { setHora(item); setErroEnvio(null); setAviso(null) }} />
                  {!podeAgendar && <p className="subtle">Esta consulta não realiza um agendamento; a disponibilidade pode mudar.</p>}
                </>
              )}
            </div>
          </Passo>

          {podeAgendar && (
            <Passo numero={4} titulo="Confirmar" estado={horaAtual ? 'current' : 'locked'}>
              {!horaAtual ? (
                <p className="subtle">Selecione um horário para revisar e confirmar.</p>
              ) : (
                <form className="form" onSubmit={agendar} aria-label="Confirmar agendamento">
                  <dl className="summary">
                    <div><dt>Serviço</dt><dd>{servico.nome}</dd></div>
                    <div><dt>Data</dt><dd>{formatarDataLonga(data)}</dd></div>
                    <div><dt>Horário</dt><dd>{formatarHora(horaAtual)} às {somarMinutos(horaAtual, servico.duracaoMinutos)}</dd></div>
                    <div className="summary__total"><dt>Valor</dt><dd>{moeda.format(Number(servico.preco))}</dd></div>
                  </dl>
                  <div className="field">
                    <label className="field__label" htmlFor={observacoesId}>Observações<span className="field__hint">Opcional · {observacoes.length}/500</span></label>
                    <textarea id={observacoesId} name="observacoes" rows={2} maxLength={500} value={observacoes} disabled={enviando}
                      placeholder="Alguma informação para o prestador?" onChange={(evento) => setObservacoes(evento.target.value)} />
                  </div>
                  {erroEnvio && <Alert message={erroEnvio.message} errors={erroEnvio.errors} />}
                  <div className="form-actions">
                    <button type="submit" className="btn btn--primary btn--lg" disabled={enviando}>
                      {enviando ? 'Agendando…' : 'Confirmar agendamento'}
                    </button>
                    <button type="button" className="btn btn--ghost" disabled={enviando} onClick={() => setHora('')}>Escolher outro horário</button>
                  </div>
                  <p className="subtle">A disponibilidade é conferida novamente no momento da confirmação.</p>
                </form>
              )}
            </Passo>
          )}
        </ol>
      )}
    </section>
  )
}
