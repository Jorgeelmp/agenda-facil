import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Remarcacao } from '../components/agendamento/Remarcacao'
import { moeda } from '../components/servico/formatos'
import { ConfirmDialog, EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi, avaliacaoApi } from '../services/api'
import { agoraEmSaoPaulo, dataDe, formatarDataLonga, horaDe, hojeEmSaoPaulo, rotuloDia } from '../utils/datas'
import { estaAtivo, STATUS } from '../utils/status'
import { StatusBadge } from '../components/StatusBadge'

const POR_PAGINA = 40

function useAgoraEmSaoPaulo(atualizar) {
  const [agora, setAgora] = useState(agoraEmSaoPaulo)
  useEffect(() => {
    if (!atualizar) return undefined
    const relogio = setInterval(() => setAgora(agoraEmSaoPaulo()), 1000)
    return () => clearInterval(relogio)
  }, [atualizar])
  return atualizar ? agora : agoraEmSaoPaulo()
}

function agrupar(lista) {
  const grupos = []
  for (const item of lista) {
    const dia = dataDe(item.dataHora) || item.dataHora
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.dia === dia) ultimo.itens.push(item)
    else grupos.push({ dia, itens: [item] })
  }
  return grupos
}

// Agenda (RF07, RF08): próximos horários e histórico, com as ações que cada perfil pode fazer.
export default function Agendamentos() {
  const { payload } = useAuth()
  const notify = useToast()
  const tipo = payload?.tipo
  const isCliente = tipo === 'CLIENTE'
  const isPrestador = tipo === 'PRESTADOR'
  const isAdmin = tipo === 'ADMIN'
  const gerencia = isPrestador || isAdmin

  const [params, setParams] = useSearchParams()
  const aba = ['abertos', 'historico', 'todos'].includes(params.get('aba')) ? params.get('aba') : 'abertos'
  const filtro = STATUS[params.get('status')] ? params.get('status') : ''
  const [busca, setBusca] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [busy, setBusy] = useState(false)
  const [confirmando, setConfirmando] = useState(null)
  const [erroConfirmacao, setErroConfirmacao] = useState(null)
  const [remarcando, setRemarcando] = useState(null)

  const carregar = useCallback((options) => agendamentoApi.listar('', options), [])
  const { data, loading, error, retry, update } = useApiResource(carregar, 'agendamentos')
  const agendamentos = useMemo(() => data ?? [], [data])

  // Cliente: descobre quais atendimentos concluídos ainda não foram avaliados.
  const carregarAvaliacoes = useCallback((options) => avaliacaoApi.listar(options), [])
  const avaliacoes = useApiResource(carregarAvaliacoes, 'avaliacoes', { enabled: isCliente })
  const avaliados = useMemo(() => new Set((avaliacoes.data ?? []).map((item) => item.agendamentoId)), [avaliacoes.data])

  const aguardandoHorario = gerencia && agendamentos.some((item) => item.status === 'CONFIRMADO' && item.dataHora > agoraEmSaoPaulo())
  const agora = useAgoraEmSaoPaulo(aguardandoHorario)
  const hoje = hojeEmSaoPaulo()

  // Em aberto = pendentes e confirmados (inclusive os que já passaram e ainda precisam ser concluídos).
  const daAba = agendamentos.filter((item) => aba === 'todos' || (aba === 'abertos' ? estaAtivo(item) : !estaAtivo(item)))
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const buscados = termo
    ? daAba.filter((item) => `${item.servicoNome} ${item.clienteNome} ${item.prestadorNome}`.toLocaleLowerCase('pt-BR').includes(termo))
    : daAba
  const contagem = Object.fromEntries(Object.keys(STATUS).map((status) => [status, buscados.filter((item) => item.status === status).length]))
  const filtrados = buscados
    .filter((item) => !filtro || item.status === filtro)
    .sort((a, b) => aba === 'abertos' ? a.dataHora.localeCompare(b.dataHora) : b.dataHora.localeCompare(a.dataHora))
  const visiveis = filtrados.slice(0, limite)

  const pendentes = agendamentos.filter((item) => item.status === 'PENDENTE' && item.dataHora >= agora).length
  const paraConcluir = agendamentos.filter((item) => item.status === 'CONFIRMADO' && item.dataHora <= agora).length

  function navegar(novos) {
    const proximos = { aba, status: filtro, ...novos }
    setParams(Object.fromEntries(Object.entries(proximos).filter(([chave, valor]) => valor && !(chave === 'aba' && valor === 'abertos'))), { replace: true })
    setLimite(POR_PAGINA)
  }

  function substituir(atualizado) {
    update(agendamentos.map((item) => item.id === atualizado.id ? atualizado : item))
  }

  async function executar(acao, mensagem, { emDialogo = false } = {}) {
    if (busy) return
    setBusy(true)
    setErroConfirmacao(null)
    try {
      await acao()
      setConfirmando(null)
      notify(mensagem)
    } catch (err) {
      const erro = { message: err.message || 'Não foi possível concluir a operação.', errors: err.errors ?? [] }
      if (emDialogo) setErroConfirmacao(erro)
      else notify(erro.message, 'error')
      if (err.status === 404 || err.status === 409) retry()
    } finally {
      setBusy(false)
    }
  }

  function alterarStatus(agendamento, status, mensagem, opcoes) {
    return executar(async () => substituir(await agendamentoApi.alterarStatus(agendamento.id, status)), mensagem, opcoes)
  }

  function excluir(agendamento) {
    return executar(async () => {
      await agendamentoApi.excluir(agendamento.id)
      update(agendamentos.filter((item) => item.id !== agendamento.id))
    }, 'Agendamento excluído.', { emDialogo: true })
  }

  const titulo = isCliente ? 'Meus agendamentos' : isPrestador ? 'Agenda' : 'Agendamentos'
  const descricao = isCliente
    ? 'Acompanhe, remarque ou cancele seus horários.'
    : isPrestador
      ? 'Confirme, conclua ou cancele os horários reservados pelos seus clientes.'
      : 'Todos os agendamentos da plataforma.'

  const abas = [['abertos', 'Em aberto'], ['historico', 'Histórico'], ['todos', 'Todos']]

  return (
    <>
      <PageHeader title={titulo} description={descricao}
        actions={isCliente && <Link className="btn btn--primary" to="/dashboard/servicos"><Icon name="calendar-plus" size="sm" />Agendar novo horário</Link>} />

      {gerencia && !loading && !error && (pendentes > 0 || paraConcluir > 0) && (
        <div className="stats">
          {pendentes > 0 && (
            <button type="button" className="stat stat--highlight" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navegar({ aba: 'abertos', status: 'PENDENTE' })}>
              <span className="stat__label"><Icon name="clock" size="sm" />Aguardando sua confirmação</span>
              <span className="stat__value">{pendentes}</span>
              <span className="stat__hint">Ver pendentes →</span>
            </button>
          )}
          {paraConcluir > 0 && (
            <button type="button" className="stat" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navegar({ aba: 'abertos', status: 'CONFIRMADO' })}>
              <span className="stat__label"><Icon name="check-circle" size="sm" />Atendimentos para concluir</span>
              <span className="stat__value">{paraConcluir}</span>
              <span className="stat__hint">Horário já passou →</span>
            </button>
          )}
        </div>
      )}

      <div className="stack">
        <nav className="tabs" aria-label="Situação dos agendamentos">
          {abas.map(([valor, rotulo]) => (
            <button key={valor} type="button" className={`tab${aba === valor ? ' is-active' : ''}`} aria-pressed={aba === valor} onClick={() => navegar({ aba: valor })}>{rotulo}</button>
          ))}
        </nav>
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Filtrar por status" style={{ flex: '1 1 auto' }}>
            <button type="button" className={`chip${!filtro ? ' is-active' : ''}`} aria-pressed={!filtro} onClick={() => navegar({ status: '' })}>Todos os status</button>
            {Object.entries(STATUS).map(([valor, { label }]) => (
              <button key={valor} type="button" className={`chip${filtro === valor ? ' is-active' : ''}`} aria-pressed={filtro === valor} onClick={() => navegar({ status: filtro === valor ? '' : valor })}>
                {label}<span className="chip__count">{contagem[valor]}</span>
              </button>
            ))}
          </div>
          {!isCliente && (
            <div className="field" style={{ flex: '0 1 260px' }}>
              <label className="sr-only" htmlFor="busca-agendamento">Buscar agendamento</label>
              <div className="field__control search">
                <Icon name="search" size="sm" />
                <input id="busca-agendamento" type="search" placeholder={isAdmin ? 'Cliente, serviço ou prestador' : 'Cliente ou serviço'} value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA) }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? <Loading>Carregando agendamentos…</Loading> : error ? (
        <div className="card"><ErrorState error={error} onRetry={retry} /></div>
      ) : filtrados.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title={`Nenhum agendamento ${filtro ? `com status ${STATUS[filtro].label.toLowerCase()}` : aba === 'abertos' ? 'em aberto' : 'encontrado'}`}
            actions={isCliente && aba === 'abertos' && <Link className="btn btn--primary" to="/dashboard/servicos">Agendar um serviço</Link>}>
            {isCliente ? 'Escolha um serviço e um horário livre para fazer seu agendamento.' : 'Os horários reservados aparecerão aqui.'}
          </EmptyState>
        </div>
      ) : (
        <section className="appt-groups" aria-label="Lista de agendamentos">
          {agrupar(visiveis).map((grupo) => (
            <div className="appt-group" key={grupo.dia}>
              <h2 className="appt-group__title">{rotuloDia(grupo.dia, hoje)}{['Hoje', 'Amanhã', 'Ontem'].includes(rotuloDia(grupo.dia, hoje)) && <span>{formatarDataLonga(grupo.dia)}</span>}</h2>
              <ul className="appt-list">
                {grupo.itens.map((agendamento) => (
                  <ItemAgendamento key={agendamento.id} agendamento={agendamento} agora={agora} busy={busy}
                    isCliente={isCliente} isPrestador={isPrestador} isAdmin={isAdmin} avaliado={avaliados.has(agendamento.id)} avaliacoesProntas={Boolean(avaliacoes.data)}
                    onStatus={alterarStatus}
                    onRemarcar={(item) => setRemarcando(item)}
                    onConfirmar={(acao, item) => { setErroConfirmacao(null); setConfirmando({ acao, agendamento: item }) }} />
                ))}
              </ul>
            </div>
          ))}
          {filtrados.length > limite && (
            <div className="load-more"><button className="btn btn--secondary" type="button" onClick={() => setLimite((v) => v + POR_PAGINA)}>Mostrar mais ({filtrados.length - limite} restantes)</button></div>
          )}
        </section>
      )}

      {confirmando && (
        <ConfirmDialog
          title={confirmando.acao === 'cancelar' ? 'Cancelar agendamento?' : 'Excluir agendamento?'}
          confirmLabel={confirmando.acao === 'cancelar' ? 'Confirmar cancelamento' : 'Confirmar exclusão'}
          busy={busy} error={erroConfirmacao}
          onClose={() => setConfirmando(null)}
          onConfirm={() => confirmando.acao === 'cancelar'
            ? alterarStatus(confirmando.agendamento, 'CANCELADO', 'Agendamento cancelado.', { emDialogo: true })
            : excluir(confirmando.agendamento)}>
          {confirmando.acao === 'cancelar'
            ? `Cancelar ${confirmando.agendamento.servicoNome} em ${formatarDataLonga(dataDe(confirmando.agendamento.dataHora))} às ${horaDe(confirmando.agendamento.dataHora)}? O horário volta a ficar livre.`
            : `Excluir definitivamente o agendamento de ${confirmando.agendamento.clienteNome}? Esta ação não pode ser desfeita.`}
        </ConfirmDialog>
      )}

      {remarcando && (
        <Remarcacao
          key={remarcando.id}
          agendamento={remarcando}
          onCancel={() => setRemarcando(null)}
          onSaved={(atualizado) => {
            substituir(atualizado)
            setRemarcando(null)
            notify(atualizado.dataHora === remarcando.dataHora && atualizado.servicoId === remarcando.servicoId
              ? 'Agendamento atualizado.'
              : 'Agendamento remarcado. Aguarde a nova confirmação do prestador.')
          }}
        />
      )}
    </>
  )
}

function ItemAgendamento({ agendamento, agora, busy, isCliente, isPrestador, isAdmin, avaliado, avaliacoesProntas, onStatus, onRemarcar, onConfirmar }) {
  const gerencia = isPrestador || isAdmin
  const ativo = estaAtivo(agendamento)
  const passou = agendamento.dataHora <= agora
  const podeConfirmar = gerencia && agendamento.status === 'PENDENTE'
  const podeConcluir = gerencia && agendamento.status === 'CONFIRMADO' && passou
  const podeRemarcar = (isCliente || isAdmin) && ativo
  const podeAvaliar = isCliente && agendamento.status === 'CONCLUIDO' && avaliacoesProntas && !avaliado
  const descricaoItem = `${agendamento.servicoNome} em ${formatarDataLonga(dataDe(agendamento.dataHora))} às ${horaDe(agendamento.dataHora)}`

  return (
    <li className={`appt${!ativo ? ' appt--past' : ''}`}>
      <div className="appt__time">
        <strong>{horaDe(agendamento.dataHora)}</strong>
        <span>até {horaDe(agendamento.dataHoraFim)}</span>
      </div>
      <div className="appt__body">
        <div className="appt__title">
          <strong>{agendamento.servicoNome}</strong>
          <StatusBadge status={agendamento.status} />
          {isCliente && agendamento.status === 'CONCLUIDO' && avaliado && <span className="badge badge--plain"><Icon name="star" size="sm" />Avaliado</span>}
        </div>
        <div className="appt__meta">
          {!isCliente && <span><Icon name="user" size="sm" />{agendamento.clienteNome}</span>}
          {!isPrestador && <span><Icon name="store" size="sm" /><Link to={`/dashboard/prestadores/${agendamento.prestadorId}`}>{agendamento.prestadorNome}</Link></span>}
          <span><Icon name="clock" size="sm" />{agendamento.duracaoMinutos} min</span>
          <span><Icon name="wallet" size="sm" />{moeda.format(Number(agendamento.preco))}</span>
        </div>
        {agendamento.observacoes && <p className="appt__note">“{agendamento.observacoes}”</p>}
        {gerencia && agendamento.status === 'CONFIRMADO' && !passou && <p className="subtle">Concluir fica disponível a partir do horário marcado.</p>}
      </div>
      <div className="appt__actions">
        {podeConfirmar && <button className="btn btn--success btn--sm" type="button" disabled={busy} aria-label={`Confirmar ${descricaoItem}`} onClick={() => onStatus(agendamento, 'CONFIRMADO', 'Agendamento confirmado.')}><Icon name="check" size="sm" />Confirmar</button>}
        {podeConcluir && <button className="btn btn--success btn--sm" type="button" disabled={busy} aria-label={`Concluir ${descricaoItem}`} onClick={() => onStatus(agendamento, 'CONCLUIDO', 'Agendamento concluído.')}><Icon name="check-circle" size="sm" />Concluir</button>}
        {podeAvaliar && <Link className="btn btn--primary btn--sm" to={`/dashboard/avaliacoes?agendamento=${agendamento.id}`} aria-label={`Avaliar ${descricaoItem}`}><Icon name="star" size="sm" />Avaliar</Link>}
        {podeRemarcar && <button className="btn btn--secondary btn--sm" type="button" disabled={busy} aria-label={`Remarcar ${descricaoItem}`} onClick={() => onRemarcar(agendamento)}>Remarcar</button>}
        {ativo && <button className="btn btn--danger btn--sm" type="button" disabled={busy} aria-label={`Cancelar ${descricaoItem}`} onClick={() => onConfirmar('cancelar', agendamento)}>Cancelar</button>}
        {isAdmin && <button className="btn btn--ghost btn--sm" type="button" disabled={busy} aria-label={`Excluir ${descricaoItem}`} onClick={() => onConfirmar('excluir', agendamento)}><Icon name="trash" size="sm" /></button>}
      </div>
    </li>
  )
}
