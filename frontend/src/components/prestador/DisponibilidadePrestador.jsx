import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../Alert'
import { Field } from '../Field'
import { useAuth } from '../../context/AuthContext'
import { useApiResource } from '../../hooks/useApiResource'
import { agendamentoApi, prestadorApi } from '../../services/api'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatoDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' })
const horaValida = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/

function hojeEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const parte = (tipo) => partes.find((item) => item.type === tipo).value
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

function dataValida(data, hoje) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < hoje || data > '9999-12-31') return false
  const dia = new Date(`${data}T12:00:00Z`)
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === data
}

function formatarHora(hora) {
  if (/^\d{2}:\d{2}:00(?:\.0+)?$/.test(hora)) return hora.slice(0, 5)
  return hora.includes('.') ? hora.replace(/0+$/, '').replace(/\.$/, '') : hora
}

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

export default function DisponibilidadePrestador({ prestadorId, ativo, revision = 0 }) {
  const tituloId = useId()
  const servicoCampoId = useId()
  const observacoesId = useId()
  const consultaId = useRef(0)
  const { payload } = useAuth()
  const podeAgendar = payload?.tipo === 'CLIENTE'
  const [selecao, setSelecao] = useState(null)
  const [data, setData] = useState(hojeEmSaoPaulo)
  const [consulta, setConsulta] = useState(null)
  const [reserva, setReserva] = useState(null)
  const [aviso, setAviso] = useState(null)

  const contexto = `${prestadorId}:${ativo}:${revision}`
  const hoje = hojeEmSaoPaulo()
  const carregarServicos = useCallback(async ({ signal }) => {
    const resposta = await prestadorApi.servicos(prestadorId, { signal })
    if (!Array.isArray(resposta)) throw new Error('Resposta inválida')
    const disponiveis = resposta.filter((item) => item.ativo === true)
    if (disponiveis.some((item) => typeof item.id !== 'string' || typeof item.nome !== 'string'
      || !Number.isInteger(item.duracaoMinutos) || item.duracaoMinutos <= 0
      || item.preco === null || item.preco === undefined || !Number.isFinite(Number(item.preco)))) {
      throw new Error('Resposta inválida')
    }
    return disponiveis
  }, [prestadorId])
  const servicosRecurso = useApiResource(carregarServicos, contexto, { enabled: Boolean(prestadorId && ativo) })
  const servicos = servicosRecurso.data ?? []
  const servicoId = selecao?.contexto === contexto && selecao.servicos === servicos ? selecao.id : ''
  const servico = servicos.find((item) => item.id === servicoId)
  const chaveConsulta = `${contexto}:${servicoId}:${data}`
  const consultaAtual = consulta?.chave === chaveConsulta ? consulta : null
  const carregandoServicos = servicosRecurso.loading
  const consultando = consultaAtual?.status === 'loading'
  const avisoAtual = aviso?.chave === chaveConsulta ? aviso : null
  const reservaAtual = podeAgendar && consultaAtual?.status === 'ready' && reserva?.chave === chaveConsulta ? reserva : null

  useEffect(() => {
    consultaId.current += 1
    return () => {
      consultaId.current += 1
    }
  }, [contexto])

  function limparConsulta() {
    consultaId.current += 1
    setConsulta(null)
  }

  function recarregarServicos() {
    limparConsulta()
    setSelecao(null)
    servicosRecurso.retry()
  }

  async function consultar(evento) {
    evento.preventDefault()
    if (consultando || !ativo || !servico || carregandoServicos) return
    setAviso(null)
    await executarConsulta()
  }

  async function executarConsulta() {
    const numeroConsulta = ++consultaId.current
    setReserva(null)

    if (!dataValida(data, hojeEmSaoPaulo())) {
      setConsulta({ chave: chaveConsulta, status: 'error', erro: 'Escolha uma data válida a partir de hoje.' })
      return
    }

    setConsulta({ chave: chaveConsulta, status: 'loading' })
    try {
      const resposta = await prestadorApi.disponibilidade(prestadorId, servicoId, data)
      if (numeroConsulta !== consultaId.current) return
      if (resposta?.data !== data || !Array.isArray(resposta?.horarios)
        || resposta.horarios.some((hora) => typeof hora !== 'string' || !horaValida.test(hora))) {
        throw new Error('Resposta inválida')
      }
      setConsulta({ chave: chaveConsulta, status: 'ready', resposta })
    } catch (erro) {
      if (numeroConsulta === consultaId.current) {
        setConsulta({ chave: chaveConsulta, status: 'error', erro: mensagemErro(erro, true) })
      }
    }
  }

  async function agendar(evento) {
    evento.preventDefault()
    if (!reservaAtual || reservaAtual.enviando) return
    const { chave, hora, observacoes } = reservaAtual
    setReserva({ ...reservaAtual, enviando: true, erro: null })
    try {
      await agendamentoApi.criar({ servicoId, dataHora: `${data}T${hora}`, observacoes: observacoes.trim() || null })
      setAviso({
        chave,
        type: 'success',
        mensagem: `Agendamento solicitado para ${formatoDia.format(new Date(`${data}T12:00:00Z`))} às ${formatarHora(hora)}. Aguarde a confirmação do prestador.`,
      })
      await executarConsulta()
    } catch (erro) {
      if (erro.status === 409) {
        // Horário tomado por outro cliente ou que coincide com outro agendamento do próprio cliente:
        // mostra o motivo informado pela API e atualiza a lista para exibir só o que continua livre.
        setAviso({ chave, type: 'error', mensagem: erro.message || 'Este horário não está mais disponível. Escolha outro horário livre.' })
        await executarConsulta()
      } else {
        setReserva((atual) => atual?.chave === chave ? { ...atual, enviando: false, erro } : atual)
      }
    }
  }

  return (
    <section className="panel" aria-labelledby={tituloId}>
      <header className="panel__header">
        <h2 id={tituloId}>Horários disponíveis</h2>
        <p className="panel__description">{podeAgendar
          ? 'Escolha um serviço e um dia, depois selecione um horário livre para agendar.'
          : 'Escolha um serviço e um dia para consultar os horários livres.'}</p>
      </header>

      {!prestadorId ? (
        <p className="empty-state">Selecione um prestador para consultar seus horários.</p>
      ) : !ativo ? (
        <p className="empty-state" role="status">Este prestador está inativo e não oferece horários disponíveis.</p>
      ) : carregandoServicos ? (
        <p className="empty-state" role="status">Carregando serviços…</p>
      ) : servicosRecurso.error ? (
        <>
          <Alert message={mensagemErro(servicosRecurso.error)} />
          <button type="button" className="btn btn--ghost" onClick={recarregarServicos}>Tentar novamente</button>
        </>
      ) : servicos.length === 0 ? (
        <p className="empty-state" role="status">Este prestador ainda não tem serviços ativos para consulta.</p>
      ) : (
        <>
          <form className="form" onSubmit={consultar}>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor={servicoCampoId}>Serviço</label>
                <div className="field__control">
                  <select
                    id={servicoCampoId}
                    name="servicoId"
                    value={servicoId}
                    required
                    onChange={(evento) => {
                      limparConsulta()
                      setSelecao({ contexto, servicos, id: evento.target.value })
                    }}
                  >
                    <option value="" disabled>Selecione um serviço</option>
                    {servicos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome} · {item.duracaoMinutos} min · {moeda.format(Number(item.preco))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Field
                label="Data"
                hint="Horário de Brasília"
                name="data"
                type="date"
                value={data}
                min={hoje}
                max="9999-12-31"
                required
                onChange={(evento) => { limparConsulta(); setData(evento.target.value) }}
              />
            </div>
            {servico?.descricao && <p className="panel__description">{servico.descricao}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={!servico || !data || consultando}>
                {consultando ? 'Consultando…' : consultaAtual?.status === 'error' ? 'Tentar novamente' : 'Consultar horários'}
              </button>
            </div>
          </form>

          <div aria-live="polite" aria-busy={Boolean(consultando)}>
            {consultando && <p className="empty-state" role="status">Consultando horários disponíveis…</p>}
            {avisoAtual && !consultando && <Alert type={avisoAtual.type} message={avisoAtual.mensagem} />}
            {avisoAtual?.type === 'success' && !consultando && (
              <p className="panel__description"><Link to="/dashboard/agendamentos">Ver meus agendamentos</Link></p>
            )}
            {consultaAtual?.status === 'error' && <Alert message={consultaAtual.erro} />}
            {consultaAtual?.status === 'ready' && (
              <>
                <p className="panel__description">
                  {servico.nome} em {formatoDia.format(new Date(`${data}T12:00:00Z`))}.
                </p>
                {consultaAtual.resposta.horarios.length === 0 ? (
                  <p className="empty-state" role="status">Não há horários livres para este serviço neste dia. Escolha outra data.</p>
                ) : (
                  <>
                    <ul className="availability-slots" aria-label="Horários livres">
                      {consultaAtual.resposta.horarios.map((hora) => podeAgendar ? (
                        <li key={hora}>
                          <button
                            type="button"
                            className={`availability-slot availability-slot--button${reservaAtual?.hora === hora ? ' is-selected' : ''}`}
                            aria-pressed={reservaAtual?.hora === hora}
                            disabled={reservaAtual?.enviando}
                            onClick={() => setReserva({ chave: chaveConsulta, hora, observacoes: reservaAtual?.observacoes ?? '', enviando: false, erro: null })}
                          >
                            <time dateTime={hora}>{formatarHora(hora)}</time>
                          </button>
                        </li>
                      ) : (
                        <li className="availability-slot" key={hora}><time dateTime={hora}>{formatarHora(hora)}</time></li>
                      ))}
                    </ul>
                    <p className="panel__description">{podeAgendar
                      ? 'Horários de Brasília. A disponibilidade é confirmada novamente no momento do agendamento.'
                      : 'Horários de Brasília. Esta consulta não realiza um agendamento; a disponibilidade pode mudar.'}</p>
                    {reservaAtual && (
                      <form className="form" onSubmit={agendar} aria-label="Confirmar agendamento">
                        <h3>{servico.nome} às {formatarHora(reservaAtual.hora)}</h3>
                        <div className="field">
                          <label className="field__label" htmlFor={observacoesId}>
                            Observações
                            <span className="field__hint">Opcional</span>
                          </label>
                          <div className="field__control">
                            <textarea
                              id={observacoesId}
                              name="observacoes"
                              rows={3}
                              maxLength={500}
                              value={reservaAtual.observacoes}
                              disabled={reservaAtual.enviando}
                              onChange={(evento) => setReserva({ ...reservaAtual, observacoes: evento.target.value })}
                            />
                          </div>
                        </div>
                        {reservaAtual.erro && <Alert message={reservaAtual.erro.message} errors={reservaAtual.erro.errors} />}
                        <div className="form-actions">
                          <button type="submit" className="btn btn--primary" disabled={reservaAtual.enviando}>
                            {reservaAtual.enviando ? 'Agendando…' : 'Confirmar agendamento'}
                          </button>
                          <button type="button" className="btn btn--ghost" disabled={reservaAtual.enviando} onClick={() => setReserva(null)}>Cancelar</button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
