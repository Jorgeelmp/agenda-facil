import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarNota } from '../components/avaliacao/formatos'
import { EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi, avaliacaoApi, horarioApi, prestadorApi, servicoApi } from '../services/api'
import { agoraEmSaoPaulo, dataDe, formatarDataLonga, hojeEmSaoPaulo, horaDe, rotuloDia, somarDias } from '../utils/datas'
import { estaAtivo } from '../utils/status'
import { StatusBadge } from '../components/StatusBadge'

function Checklist({ perfil, horarios, servicos }) {
  const passos = [
    { feito: Boolean(perfil), titulo: 'Cadastre seu negócio', texto: 'Nome, descrição, endereço e telefone.', to: '/dashboard/meu-negocio' },
    { feito: horarios > 0, titulo: 'Defina seus horários de atendimento', texto: 'Os dias e o expediente em que você atende.', to: '/dashboard/meu-negocio?aba=horarios' },
    { feito: servicos > 0, titulo: 'Cadastre seus serviços', texto: 'Com preço e duração. A duração define cada horário oferecido.', to: '/dashboard/meu-negocio?aba=servicos' },
  ]
  const feitos = passos.filter((passo) => passo.feito).length
  if (feitos === passos.length) return null
  return (
    <section className="card">
      <div className="card__header">
        <div><h2>Deixe seu negócio pronto para receber agendamentos</h2><p>{feitos} de {passos.length} passos concluídos</p></div>
      </div>
      <div className="progress"><span style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
      <ol className="checklist">
        {passos.map((passo, indice) => (
          <li key={passo.titulo} className={`checklist__item${passo.feito ? ' is-done' : ''}`}>
            <span className="checklist__mark">{passo.feito ? <Icon name="check" size="sm" /> : indice + 1}</span>
            <div><h3>{passo.titulo}</h3><p>{passo.texto}</p></div>
            {!passo.feito && (indice === 0 || passos[indice - 1].feito) && <Link className="btn btn--primary btn--sm" to={passo.to}>Fazer agora</Link>}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function InicioPrestador() {
  const { payload } = useAuth()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const primeiroNome = payload?.nome?.split(' ')[0] ?? ''

  const carregar = useCallback(async (options) => {
    const perfil = await prestadorApi.meuPerfil(options).catch((err) => {
      if (err.status === 404) return null
      throw err
    })
    if (!perfil) return { perfil: null }
    const [horarios, servicos, agendamentos, media] = await Promise.all([
      horarioApi.listar(perfil.id, options),
      servicoApi.gerenciar(perfil.id, options),
      agendamentoApi.listar('', options),
      avaliacaoApi.media(perfil.id, options),
    ])
    return { perfil, horarios, servicos, agendamentos, media }
  }, [])
  const resumo = useApiResource(carregar, `inicio-prestador:${payload?.userId}`)

  async function confirmar(agendamento) {
    setBusy(true)
    try {
      const atualizado = await agendamentoApi.alterarStatus(agendamento.id, 'CONFIRMADO')
      resumo.update({ ...resumo.data, agendamentos: resumo.data.agendamentos.map((item) => item.id === atualizado.id ? atualizado : item) })
      notify('Agendamento confirmado.')
    } catch (err) {
      notify(err.message || 'Não foi possível confirmar.', 'error')
      resumo.retry()
    } finally {
      setBusy(false)
    }
  }

  const header = <PageHeader title={`Olá, ${primeiroNome}!`} description={formatarDataLonga(hojeEmSaoPaulo())} />
  if (resumo.loading) return <>{header}<Loading>Carregando seu painel…</Loading></>
  if (resumo.error) return <>{header}<div className="card"><ErrorState error={resumo.error} onRetry={resumo.retry} /></div></>
  const { perfil, horarios = [], servicos = [], agendamentos = [], media } = resumo.data ?? {}
  if (!perfil) return <>{header}<Checklist perfil={null} horarios={0} servicos={0} /></>

  const agora = agoraEmSaoPaulo()
  const hoje = hojeEmSaoPaulo()
  const daqui7 = somarDias(hoje, 7)
  const ativos = agendamentos.filter(estaAtivo)
  const deHoje = ativos.filter((item) => dataDe(item.dataHora) === hoje).sort((a, b) => a.dataHora.localeCompare(b.dataHora))
  const pendentes = ativos.filter((item) => item.status === 'PENDENTE' && item.dataHora >= agora).sort((a, b) => a.dataHora.localeCompare(b.dataHora))
  const semana = ativos.filter((item) => item.dataHora >= agora && dataDe(item.dataHora) < daqui7).length
  const temNota = media?.notaMedia !== null && media?.notaMedia !== undefined

  return (
    <>
      <PageHeader title={`Olá, ${primeiroNome}!`} description={`${perfil.nomeNegocio} · ${formatarDataLonga(hoje)}`}
        actions={<Link className="btn btn--secondary" to={`/dashboard/prestadores/${perfil.id}`}>Ver minha página</Link>} />

      {!perfil.ativo && <p className="alert alert--warning"><Icon name="alert" />Seu negócio está inativo e não recebe novos agendamentos. <Link to="/dashboard/meu-negocio">Reativar</Link></p>}
      <Checklist perfil={perfil} horarios={horarios.length} servicos={servicos.filter((item) => item.ativo).length} />

      <div className="stats">
        <Link className="stat" to="/dashboard/agendamentos"><span className="stat__label">Hoje</span><span className="stat__value">{deHoje.length}</span><span className="stat__hint">{deHoje.length === 1 ? 'atendimento' : 'atendimentos'}</span></Link>
        <Link className={`stat${pendentes.length ? ' stat--highlight' : ''}`} to="/dashboard/agendamentos?status=PENDENTE"><span className="stat__label">Aguardando confirmação</span><span className="stat__value">{pendentes.length}</span><span className="stat__hint">Confirme para garantir o horário</span></Link>
        <Link className="stat" to="/dashboard/agendamentos"><span className="stat__label">Próximos 7 dias</span><span className="stat__value">{semana}</span><span className="stat__hint">agendamentos ativos</span></Link>
        <Link className="stat" to="/dashboard/avaliacoes"><span className="stat__label">Nota média</span><span className="stat__value">{temNota ? formatarNota(media.notaMedia) : '—'}</span><span className="stat__hint">{temNota ? `${media.totalAvaliacoes} avaliações` : 'Sem avaliações ainda'}</span></Link>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card__header">
            <div><h2>Agenda de hoje</h2><p>{formatarDataLonga(hoje)}</p></div>
            <Link to="/dashboard/agendamentos">Abrir agenda</Link>
          </div>
          {deHoje.length === 0 ? <EmptyState icon="calendar" compact>Nenhum atendimento marcado para hoje.</EmptyState> : (
            <ul className="compact-list">
              {deHoje.map((item) => (
                <li key={item.id}>
                  <span className="compact-list__date"><strong style={{ fontSize: 14 }}>{horaDe(item.dataHora)}</strong></span>
                  <div className="compact-list__body"><strong>{item.servicoNome}</strong><span>{item.clienteNome} · até {horaDe(item.dataHoraFim)}</span></div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <div><h2>Precisam da sua confirmação</h2><p>Pedidos de clientes ainda pendentes.</p></div>
            {pendentes.length > 5 && <Link to="/dashboard/agendamentos?status=PENDENTE">Ver todos ({pendentes.length})</Link>}
          </div>
          {pendentes.length === 0 ? <EmptyState icon="check-circle" compact>Tudo em dia! Nenhum pedido pendente.</EmptyState> : (
            <ul className="compact-list">
              {pendentes.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <div className="compact-list__body">
                    <strong>{item.servicoNome} · {item.clienteNome}</strong>
                    <span>{rotuloDia(dataDe(item.dataHora), hoje)} às {horaDe(item.dataHora)}</span>
                  </div>
                  <button className="btn btn--success btn--sm" type="button" disabled={busy} onClick={() => confirmar(item)}
                    aria-label={`Confirmar ${item.servicoNome} de ${item.clienteNome}`}><Icon name="check" size="sm" />Confirmar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
