import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { formatarData } from '../components/avaliacao/formatos'
import { EmptyState, ErrorState, Icon, Loading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi, avaliacaoApi, categoriaApi } from '../services/api'
import { agoraEmSaoPaulo, dataDe, horaDe, partesDia, rotuloDia } from '../utils/datas'
import { estaAtivo } from '../utils/status'
import { StatusBadge } from '../components/StatusBadge'

export default function InicioCliente() {
  const { payload } = useAuth()
  const primeiroNome = payload?.nome?.split(' ')[0] ?? ''

  const carregar = useCallback(async (options) => {
    const [agendamentos, avaliacoes] = await Promise.all([agendamentoApi.listar('', options), avaliacaoApi.listar(options)])
    return { agendamentos, avaliacoes }
  }, [])
  const resumo = useApiResource(carregar, 'inicio-cliente')
  const carregarCategorias = useCallback((options) => categoriaApi.listar(options), [])
  const categorias = useApiResource(carregarCategorias, 'categorias')

  const agora = agoraEmSaoPaulo()
  const agendamentos = resumo.data?.agendamentos ?? []
  const avaliados = new Set((resumo.data?.avaliacoes ?? []).map((item) => item.agendamentoId))
  const proximos = agendamentos.filter((item) => estaAtivo(item) && item.dataHora >= agora).sort((a, b) => a.dataHora.localeCompare(b.dataHora))
  const paraAvaliar = agendamentos.filter((item) => item.status === 'CONCLUIDO' && !avaliados.has(item.id))

  return (
    <>
      <section className="hero">
        <div>
          <h1>Olá, {primeiroNome}!</h1>
          <p>O que você quer agendar hoje?</p>
        </div>
        <Link className="btn btn--secondary btn--lg" to="/dashboard/servicos"><Icon name="calendar-plus" />Agendar serviço</Link>
      </section>

      {categorias.data?.length > 0 && (
        <section className="stack" aria-label="Categorias">
          <h2>Explore por categoria</h2>
          <div className="chips">
            {categorias.data.map((c) => <Link key={c.id} className="chip" to={`/dashboard/servicos?categoriaId=${c.id}`}>{c.nome}</Link>)}
          </div>
        </section>
      )}

      {resumo.loading ? <Loading>Carregando seus agendamentos…</Loading> : resumo.error ? (
        <div className="card"><ErrorState error={resumo.error} onRetry={resumo.retry} /></div>
      ) : (
        <div className="grid-2">
          <section className="card">
            <div className="card__header">
              <div><h2>Próximos agendamentos</h2><p>{proximos.length ? `${proximos.length} ${proximos.length === 1 ? 'horário marcado' : 'horários marcados'}` : 'Nenhum horário marcado'}</p></div>
              <Link to="/dashboard/agendamentos">Ver todos</Link>
            </div>
            {proximos.length === 0 ? (
              <EmptyState icon="calendar" compact actions={<Link className="btn btn--primary" to="/dashboard/servicos">Agendar agora</Link>}>
                Você não tem horários marcados.
              </EmptyState>
            ) : (
              <ul className="compact-list">
                {proximos.slice(0, 4).map((item) => {
                  const dia = partesDia(dataDe(item.dataHora))
                  return (
                    <li key={item.id}>
                      <span className="compact-list__date"><strong>{dia.numero}</strong><span>{dia.mes}</span></span>
                      <div className="compact-list__body">
                        <strong>{item.servicoNome}</strong>
                        <span>{rotuloDia(dataDe(item.dataHora))} às {horaDe(item.dataHora)} · {item.prestadorNome}</span>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card__header">
              <div><h2>Avalie seus atendimentos</h2><p>Sua nota ajuda outros clientes a escolher.</p></div>
              <Link to="/dashboard/avaliacoes">Minhas avaliações</Link>
            </div>
            {paraAvaliar.length === 0 ? (
              <EmptyState icon="star" compact>Nenhum atendimento aguardando avaliação.</EmptyState>
            ) : (
              <ul className="compact-list">
                {paraAvaliar.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <span className="compact-list__date"><Icon name="star" /></span>
                    <div className="compact-list__body">
                      <strong>{item.servicoNome}</strong>
                      <span>{item.prestadorNome} · {formatarData(item.dataHora)}</span>
                    </div>
                    <Link className="btn btn--secondary btn--sm" to={`/dashboard/avaliacoes?agendamento=${item.id}`}>Avaliar</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  )
}
