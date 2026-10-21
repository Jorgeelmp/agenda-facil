import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotaInline } from '../components/avaliacao/NotaInline'
import { Avatar, EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

const SITUACOES = [['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']]

export default function Prestadores() {
  const { payload } = useAuth()
  const [filter, setFilter] = useState('ativos')
  const [search, setSearch] = useState('')
  const admin = payload?.tipo === 'ADMIN'

  const ativo = !admin || filter === 'ativos' ? true : filter === 'inativos' ? false : undefined
  const load = useCallback((options) => prestadorApi.listar(ativo, options), [ativo])
  const { data, loading, error, retry } = useApiResource(load, `prestadores:${ativo}`)
  const prestadores = data ?? []

  const termo = search.trim().toLocaleLowerCase('pt-BR')
  const encontrados = prestadores.filter((prestador) => prestador.nomeNegocio.toLocaleLowerCase('pt-BR').includes(termo))

  return (
    <>
      <PageHeader title="Prestadores" description={admin ? 'Negócios cadastrados na plataforma.' : 'Conheça os negócios, veja as avaliações e agende um horário.'}
        actions={payload?.tipo === 'PRESTADOR' && <Link className="btn btn--secondary" to="/dashboard/meu-negocio">Gerenciar meu negócio</Link>} />

      <div className="toolbar">
        <div className="field" style={{ flex: '2 1 260px' }}>
          <label className="field__label" htmlFor="buscar-negocio">Buscar negócio</label>
          <div className="field__control search">
            <Icon name="search" size="sm" />
            <input id="buscar-negocio" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do negócio" />
          </div>
        </div>
        {admin && (
          <div className="field" style={{ flex: '0 1 180px' }}>
            <label className="field__label" htmlFor="filtro-situacao">Situação</label>
            <select id="filtro-situacao" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {SITUACOES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? <Loading>Carregando prestadores…</Loading> : error ? (
        <div className="card"><ErrorState error={error} onRetry={retry} /></div>
      ) : encontrados.length === 0 ? (
        <div className="card">
          <EmptyState icon="store" title={termo ? 'Nenhum negócio encontrado' : 'Nenhum prestador disponível'}>
            {termo ? 'Tente buscar por outro nome.' : 'Os negócios cadastrados aparecerão aqui.'}
          </EmptyState>
        </div>
      ) : (
        <>
          <p className="result-count" role="status">{encontrados.length} {encontrados.length === 1 ? 'negócio' : 'negócios'}</p>
          <div className="grid-cards">
            {encontrados.map((prestador) => (
              <article className="entity-card" key={prestador.id}>
                <div className="entity-card__top">
                  <Avatar nome={prestador.nomeNegocio} />
                  <div>
                    <h2>{prestador.nomeNegocio}</h2>
                    <NotaInline prestadorId={prestador.id} />
                  </div>
                  {(admin || !prestador.ativo) && <span className={`badge ${prestador.ativo ? 'badge--active' : 'badge--inactive'}`}>{prestador.ativo ? 'Ativo' : 'Inativo'}</span>}
                </div>
                {prestador.descricao && <p className="entity-card__desc">{prestador.descricao}</p>}
                <div className="entity-card__meta">
                  {prestador.endereco && <span><Icon name="pin" size="sm" />{prestador.endereco}</span>}
                  {prestador.telefoneComercial && <span><Icon name="phone" size="sm" />{prestador.telefoneComercial}</span>}
                </div>
                <div className="entity-card__footer">
                  <Link className="btn btn--secondary btn--block" to={`/dashboard/prestadores/${prestador.id}`} aria-label={`Ver ${prestador.nomeNegocio}`}>
                    {payload?.tipo === 'CLIENTE' ? 'Ver horários e agendar' : 'Ver negócio e horários'}
                  </Link>
                  {admin && (
                    <Link className="btn btn--ghost" to={`/dashboard/prestadores/${prestador.id}/gerenciar`} aria-label={`Gerenciar ${prestador.nomeNegocio}`}><Icon name="settings" size="sm" /></Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
