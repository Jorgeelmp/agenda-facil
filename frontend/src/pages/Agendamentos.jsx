import { useCallback, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi } from '../services/api'

const STATUS = {
  PENDENTE: { label: 'Pendente', badge: 'badge' },
  CONFIRMADO: { label: 'Confirmado', badge: 'badge badge--active' },
  CONCLUIDO: { label: 'Concluído', badge: 'badge' },
  CANCELADO: { label: 'Cancelado', badge: 'badge badge--danger' },
}
const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
const formatoDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'long' })
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function agoraEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const parte = (tipo) => partes.find((item) => item.type === tipo).value
  return `${parte('year')}-${parte('month')}-${parte('day')}T${parte('hour')}:${parte('minute')}:${parte('second')}`
}

function hora(dataHora) {
  return dataHora.slice(11, 16)
}

function dia(dataHora) {
  return dataHora.slice(0, 10)
}

function formatarData(dataHora) {
  return formatoData.format(new Date(`${dia(dataHora)}T12:00:00Z`))
}

function ativo(agendamento) {
  return agendamento.status === 'PENDENTE' || agendamento.status === 'CONFIRMADO'
}

export default function Agendamentos() {
  const { payload } = useAuth()
  const tipo = payload?.tipo
  const [filtro, setFiltro] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState('')
  const [confirmando, setConfirmando] = useState(null)
  const [remarcando, setRemarcando] = useState(null)

  const carregar = useCallback((options) => agendamentoApi.listar(filtro, options), [filtro])
  const { data, loading, error, retry, update } = useApiResource(carregar, `agendamentos:${filtro}`)
  const agendamentos = data ?? []
  const agora = agoraEmSaoPaulo()

  const isCliente = tipo === 'CLIENTE'
  const isPrestador = tipo === 'PRESTADOR'
  const isAdmin = tipo === 'ADMIN'

  function substituir(atualizado) {
    update(agendamentos
      .map((item) => item.id === atualizado.id ? atualizado : item)
      .filter((item) => !filtro || item.status === filtro))
  }

  async function executar(acao, mensagem) {
    if (busy) return
    setBusy(true)
    setErro(null)
    setSucesso('')
    try {
      await acao()
      setConfirmando(null)
      setSucesso(mensagem)
    } catch (err) {
      setErro({ message: err.message || 'Não foi possível concluir a operação.', errors: err.errors ?? [] })
      if (err.status === 404 || err.status === 409) retry()
    } finally {
      setBusy(false)
    }
  }

  function alterarStatus(agendamento, status, mensagem) {
    return executar(async () => substituir(await agendamentoApi.alterarStatus(agendamento.id, status)), mensagem)
  }

  function excluir(agendamento) {
    return executar(async () => {
      await agendamentoApi.excluir(agendamento.id)
      update(agendamentos.filter((item) => item.id !== agendamento.id))
    }, 'Agendamento excluído.')
  }

  function abrirRemarcacao(agendamento) {
    setErro(null)
    setSucesso('')
    setConfirmando(null)
    setRemarcando(agendamento)
  }

  const titulo = isCliente ? 'Meus agendamentos' : isPrestador ? 'Agenda do negócio' : 'Agendamentos'
  const descricao = isCliente
    ? 'Acompanhe, remarque ou cancele seus horários.'
    : isPrestador
      ? 'Confirme, conclua ou cancele os horários reservados pelos seus clientes.'
      : 'Todos os agendamentos da plataforma.'

  return (
    <>
      <div className="page-heading page-heading--actions">
        <div><h1>{titulo}</h1><p>{descricao}</p></div>
        {isCliente && <Link className="btn btn--ghost" to="/dashboard">Agendar novo horário</Link>}
      </div>

      <div className="directory-filters">
        <div className="field">
          <label className="field__label" htmlFor="filtro-status">Status</label>
          <select id="filtro-status" value={filtro} onChange={(event) => { setFiltro(event.target.value); setConfirmando(null); setRemarcando(null) }}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([valor, { label }]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </div>
      </div>

      {erro && <Alert message={erro.message} errors={erro.errors} />}
      {sucesso && <Alert type="success" message={sucesso} />}

      {loading ? <p className="loading-state" role="status">Carregando agendamentos…</p> : error ? (
        <div className="panel"><Alert message={error.message} errors={error.errors} /><button className="btn btn--ghost" onClick={retry}>Tentar novamente</button></div>
      ) : agendamentos.length === 0 ? (
        <div className="panel empty-state">
          <h2>Nenhum agendamento {filtro ? `com status ${STATUS[filtro].label.toLowerCase()}` : 'encontrado'}</h2>
          <p>{isCliente ? 'Escolha um prestador e um horário livre para fazer seu primeiro agendamento.' : 'Os horários reservados aparecerão aqui.'}</p>
        </div>
      ) : (
        <section className="panel" aria-label={titulo}>
          <div className="table-wrap">
            <table className="data-table" aria-label="Lista de agendamentos">
              <thead>
                <tr>
                  <th scope="col">Data e hora</th>
                  <th scope="col">Serviço</th>
                  {!isCliente && <th scope="col">Cliente</th>}
                  {!isPrestador && <th scope="col">Prestador</th>}
                  <th scope="col">Status</th>
                  <th scope="col">Observações</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {agendamentos.map((agendamento) => {
                  const podeConfirmar = (isPrestador || isAdmin) && agendamento.status === 'PENDENTE'
                  const podeConcluir = (isPrestador || isAdmin) && agendamento.status === 'CONFIRMADO' && agendamento.dataHora <= agora
                  const podeRemarcar = (isCliente || isAdmin) && ativo(agendamento)
                  const descricaoItem = `${agendamento.servicoNome} em ${formatarData(agendamento.dataHora)} às ${hora(agendamento.dataHora)}`
                  return (
                    <tr key={agendamento.id}>
                      <th scope="row">
                        {formatarData(agendamento.dataHora)}
                        <span className="cell-sub">{hora(agendamento.dataHora)} às {hora(agendamento.dataHoraFim)}</span>
                      </th>
                      <td>
                        {agendamento.servicoNome}
                        <span className="cell-sub">{agendamento.duracaoMinutos} min · {moeda.format(Number(agendamento.preco))}</span>
                      </td>
                      {!isCliente && <td>{agendamento.clienteNome}</td>}
                      {!isPrestador && <td><Link to={`/dashboard/prestadores/${agendamento.prestadorId}`}>{agendamento.prestadorNome}</Link></td>}
                      <td><span className={STATUS[agendamento.status]?.badge ?? 'badge'}>{STATUS[agendamento.status]?.label ?? agendamento.status}</span></td>
                      <td className="cell-wrap">{agendamento.observacoes || '—'}</td>
                      <td>
                        <div className="form-actions">
                          {podeConfirmar && <button className="btn btn--ghost" type="button" disabled={busy} aria-label={`Confirmar ${descricaoItem}`} onClick={() => alterarStatus(agendamento, 'CONFIRMADO', 'Agendamento confirmado.')}>Confirmar</button>}
                          {podeConcluir && <button className="btn btn--ghost" type="button" disabled={busy} aria-label={`Concluir ${descricaoItem}`} onClick={() => alterarStatus(agendamento, 'CONCLUIDO', 'Agendamento concluído.')}>Concluir</button>}
                          {podeRemarcar && <button className="btn btn--ghost" type="button" disabled={busy} aria-label={`Remarcar ${descricaoItem}`} onClick={() => abrirRemarcacao(agendamento)}>Remarcar</button>}
                          {ativo(agendamento) && <button className="btn btn--danger" type="button" disabled={busy} aria-label={`Cancelar ${descricaoItem}`} onClick={() => { setRemarcando(null); setConfirmando({ acao: 'cancelar', agendamento }) }}>Cancelar</button>}
                          {isAdmin && <button className="btn btn--danger" type="button" disabled={busy} aria-label={`Excluir ${descricaoItem}`} onClick={() => { setRemarcando(null); setConfirmando({ acao: 'excluir', agendamento }) }}>Excluir</button>}
                          {!podeConfirmar && !podeConcluir && !podeRemarcar && !ativo(agendamento) && !isAdmin && <span className="cell-sub">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {confirmando && (
            <div className="confirm-action" role="alert">
              <p>{confirmando.acao === 'cancelar'
                ? `Cancelar ${confirmando.agendamento.servicoNome} em ${formatarData(confirmando.agendamento.dataHora)} às ${hora(confirmando.agendamento.dataHora)}? O horário volta a ficar livre.`
                : `Excluir definitivamente o agendamento de ${confirmando.agendamento.clienteNome}? Esta ação não pode ser desfeita.`}</p>
              <div className="form-actions">
                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => confirmando.acao === 'cancelar'
                  ? alterarStatus(confirmando.agendamento, 'CANCELADO', 'Agendamento cancelado.')
                  : excluir(confirmando.agendamento)}>
                  {busy ? 'Processando…' : confirmando.acao === 'cancelar' ? 'Confirmar cancelamento' : 'Confirmar exclusão'}
                </button>
                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => setConfirmando(null)}>Voltar</button>
              </div>
            </div>
          )}

          {remarcando && (
            <Remarcacao
              key={remarcando.id}
              agendamento={remarcando}
              onCancel={() => setRemarcando(null)}
              onSaved={(atualizado) => {
                substituir(atualizado)
                setRemarcando(null)
                setSucesso(atualizado.dataHora === remarcando.dataHora && atualizado.servicoId === remarcando.servicoId
                  ? 'Agendamento atualizado.'
                  : 'Agendamento remarcado. Aguarde a nova confirmação do prestador.')
              }}
            />
          )}
        </section>
      )}
    </>
  )
}

function Remarcacao({ agendamento, onCancel, onSaved }) {
  const observacoesId = useId()
  const [data, setData] = useState(dia(agendamento.dataHora))
  const [horarioNovo, setHorarioNovo] = useState('')
  const [observacoes, setObservacoes] = useState(agendamento.observacoes ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const hoje = agoraEmSaoPaulo().slice(0, 10)

  const carregar = useCallback((options) => agendamentoApi.disponibilidade(agendamento.id, data, options), [agendamento.id, data])
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data) && data >= hoje
  const disponibilidade = useApiResource(carregar, `${agendamento.id}:${data}`, { enabled: dataValida })
  const horarios = disponibilidade.data?.horarios ?? []

  async function salvar(event) {
    event.preventDefault()
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
        disponibilidade.retry()
      }
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={salvar} aria-label="Remarcar agendamento">
      <h3>Remarcar {agendamento.servicoNome}</h3>
      <p className="panel__description">
        Atual: {formatoDia.format(new Date(`${dia(agendamento.dataHora)}T12:00:00Z`))} às {hora(agendamento.dataHora)}.
        Escolha um novo horário ou apenas altere as observações.
      </p>
      <div className="form-grid">
        <Field label="Nova data" hint="Horário de Brasília" type="date" value={data} min={hoje} max="9999-12-31"
          onChange={(event) => { setData(event.target.value); setHorarioNovo('') }} disabled={enviando} />
      </div>
      {!dataValida ? <p className="empty-state">Escolha uma data a partir de hoje.</p>
        : disponibilidade.loading ? <p className="empty-state" role="status">Consultando horários livres…</p>
          : disponibilidade.error ? <Alert message={disponibilidade.error.message} />
            : horarios.length === 0 ? <p className="empty-state" role="status">Não há horários livres neste dia.</p> : (
              <ul className="availability-slots" aria-label="Novos horários livres">
                {horarios.map((item) => {
                  const atual = `${data}T${item}` === agendamento.dataHora
                  return (
                    <li key={item}>
                      <button type="button" className={`availability-slot availability-slot--button${horarioNovo === item ? ' is-selected' : ''}`}
                        aria-pressed={horarioNovo === item} disabled={enviando || atual}
                        onClick={() => setHorarioNovo(horarioNovo === item ? '' : item)}>
                        <time dateTime={item}>{item.slice(0, 5)}</time>{atual && ' (atual)'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
      <div className="field">
        <label className="field__label" htmlFor={observacoesId}>Observações<span className="field__hint">Opcional</span></label>
        <div className="field__control">
          <textarea id={observacoesId} rows={3} maxLength={500} value={observacoes} disabled={enviando}
            onChange={(event) => setObservacoes(event.target.value)} />
        </div>
      </div>
      {erro && <Alert message={erro.message} errors={erro.errors} />}
      <div className="form-actions">
        <button className="btn btn--primary" type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : horarioNovo ? `Remarcar para ${horarioNovo.slice(0, 5)}` : 'Salvar observações'}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onCancel} disabled={enviando}>Cancelar</button>
      </div>
    </form>
  )
}
