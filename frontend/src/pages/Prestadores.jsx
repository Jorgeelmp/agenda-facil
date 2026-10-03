import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

export default function Prestadores() {
  const { payload } = useAuth()
  const [filter, setFilter] = useState('ativos')
  const [search, setSearch] = useState('')
  const admin = payload?.tipo === 'ADMIN'

  const ativo = !admin || filter === 'ativos' ? true : filter === 'inativos' ? false : undefined
  const load = useCallback((options) => prestadorApi.listar(ativo, options), [ativo])
  const { data, loading, error, retry } = useApiResource(load, `prestadores:${ativo}`)
  const prestadores = data ?? []

  const encontrados = prestadores.filter((prestador) => prestador.nomeNegocio.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))

  return (
    <>
      <div className="page-heading page-heading--actions">
        <div><h1>Prestadores</h1><p>Conheça os negócios e consulte seus horários livres.</p></div>
        {payload?.tipo === 'PRESTADOR' && <Link className="btn btn--ghost" to="/dashboard/meu-negocio">Gerenciar meu negócio</Link>}
      </div>
      <div className="directory-filters">
        <div className="field">
          <label className="field__label" htmlFor="buscar-negocio">Buscar negócio</label>
          <input id="buscar-negocio" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome do negócio" />
        </div>
        {admin && <div className="field"><label className="field__label" htmlFor="filtro-situacao">Situação</label><select id="filtro-situacao" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></select></div>}
      </div>
      {loading ? <p className="loading-state" role="status">Carregando prestadores…</p> : error ? (
        <div className="panel"><Alert message={error.message} errors={error.errors} /><button className="btn btn--ghost" onClick={retry}>Tentar novamente</button></div>
      ) : encontrados.length === 0 ? (
        <div className="panel empty-state"><h2>{search.trim() ? 'Nenhum negócio encontrado' : 'Nenhum prestador disponível'}</h2><p>{search.trim() ? 'Tente buscar por outro nome.' : 'Os negócios cadastrados aparecerão aqui.'}</p></div>
      ) : (
        <div className="provider-grid">
          {encontrados.map((prestador) => (
            <article className="panel provider-card" key={prestador.id}>
              <div className="panel__header"><h2>{prestador.nomeNegocio}</h2><span className={`badge${prestador.ativo ? ' badge--active' : ''}`}>{prestador.ativo ? 'Ativo' : 'Inativo'}</span></div>
              {prestador.descricao && <p className="provider-card__description">{prestador.descricao}</p>}
              {prestador.endereco && <p className="provider-card__meta">{prestador.endereco}</p>}
              {prestador.telefoneComercial && <p className="provider-card__meta">{prestador.telefoneComercial}</p>}
              <Link className="btn btn--ghost" to={`/dashboard/prestadores/${prestador.id}`} aria-label={`Ver ${prestador.nomeNegocio}`}>Ver negócio e horários</Link>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
