import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { categoriaApi, servicoApi } from '../services/api'
import { moeda, validarPreco } from '../components/servico/formatos'

const VAZIO = { nome: '', categoriaId: '', precoMin: '', precoMax: '' }

function FiltrosServicos({ filtros, onFilter, onClear }) {
  const [draft, setDraft] = useState(filtros)
  const [validation, setValidation] = useState('')

  function filtrar(event) {
    event.preventDefault()
    if ([draft.precoMin, draft.precoMax].some((value) => value !== '' && !validarPreco(value))) {
      setValidation('Informe preços de 0 a 99999999,99, com até duas casas decimais.')
      return
    }
    if (draft.precoMin !== '' && draft.precoMax !== '' && Number(draft.precoMin) > Number(draft.precoMax)) {
      setValidation('Preço mínimo não pode superar o preço máximo.')
      return
    }
    setValidation('')
    onFilter(draft)
  }

  const temFiltro = Object.values(filtros).some((value) => value !== '')

  return (
    <>
      <form className="toolbar" onSubmit={filtrar} aria-label="Filtrar serviços">
        <div className="field" style={{ flex: '2 1 260px' }}>
          <label className="field__label" htmlFor="busca-servico">Buscar serviço</label>
          <div className="field__control search">
            <Icon name="search" size="sm" />
            <input id="busca-servico" maxLength={150} placeholder="Ex.: corte, manicure, massagem" value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
          </div>
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <Field label="Preço mínimo (R$)" type="number" min="0" max="99999999.99" step="0.01" value={draft.precoMin} onChange={(e) => setDraft({ ...draft, precoMin: e.target.value })} />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <Field label="Preço máximo (R$)" type="number" min="0" max="99999999.99" step="0.01" value={draft.precoMax} onChange={(e) => setDraft({ ...draft, precoMax: e.target.value })} />
        </div>
        <div className="form-actions">
          <button className="btn btn--primary" type="submit">Filtrar</button>
          {temFiltro && <button type="button" className="btn btn--ghost" onClick={() => { setDraft(VAZIO); setValidation(''); onClear() }}>Limpar filtros</button>}
        </div>
      </form>
      {validation && <Alert message={validation} />}
    </>
  )
}

// Catálogo (RF06): busca por nome, categoria e faixa de preço. Para o cliente, é o ponto de partida do agendamento.
export default function Servicos() {
  const { payload } = useAuth()
  const isCliente = payload?.tipo === 'CLIENTE'
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const filtros = Object.fromEntries(Object.keys(VAZIO).map((campo) => [campo, params.get(campo) ?? '']))
  const load = useCallback((options) => servicoApi.listar(Object.fromEntries(new URLSearchParams(key)), options), [key])
  const services = useApiResource(load, key)
  const loadCategories = useCallback((options) => categoriaApi.listar(options), [])
  const categories = useApiResource(loadCategories, 'categorias')

  function aplicar(novos) {
    setParams(Object.fromEntries(Object.entries(novos).filter(([, value]) => value !== '')))
  }

  return (
    <>
      <PageHeader
        title={isCliente ? 'Agendar um serviço' : 'Serviços'}
        description={isCliente
          ? 'Escolha o serviço que você precisa. Na próxima tela você vê os horários livres e agenda.'
          : 'Catálogo de serviços por categoria e faixa de preço.'}
      />

      <div className="chips" role="group" aria-label="Categorias">
        <button type="button" className={`chip${!filtros.categoriaId ? ' is-active' : ''}`} aria-pressed={!filtros.categoriaId} onClick={() => aplicar({ ...filtros, categoriaId: '' })}>Todas</button>
        {(categories.data ?? []).map((c) => (
          <button key={c.id} type="button" className={`chip${filtros.categoriaId === c.id ? ' is-active' : ''}`} aria-pressed={filtros.categoriaId === c.id}
            onClick={() => aplicar({ ...filtros, categoriaId: filtros.categoriaId === c.id ? '' : c.id })}>{c.nome}</button>
        ))}
      </div>
      {categories.error && <div className="form-actions"><Alert message="Não foi possível carregar as categorias." /><button className="btn btn--secondary" onClick={categories.retry}>Recarregar categorias</button></div>}

      <FiltrosServicos key={key} filtros={filtros} onClear={() => setParams({})} onFilter={(draft) => { aplicar({ ...draft, categoriaId: filtros.categoriaId }); services.retry() }} />

      {services.loading ? <Loading>Carregando serviços…</Loading> : services.error ? (
        <div className="card"><ErrorState error={services.error} onRetry={services.retry} /></div>
      ) : services.data?.length ? (
        <>
          <p className="result-count" role="status">{services.data.length} {services.data.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}</p>
          <div className="grid-cards">
            {services.data.map((s) => (
              <article className="entity-card" key={s.id}>
                <div className="entity-card__top">
                  <div>
                    <Link className="entity-card__eyebrow" to={`/dashboard/prestadores/${s.prestadorId}`}>{s.nomeNegocio}</Link>
                    <h2>{s.nome}</h2>
                  </div>
                </div>
                {s.descricao && <p className="entity-card__desc">{s.descricao}</p>}
                <div className="tags">{s.categorias.map((c) => <span className="tag" key={c.id}>{c.nome}</span>)}</div>
                <div className="entity-card__footer">
                  <div>
                    <div className="price">{moeda.format(s.preco)}</div>
                    <span className="duration"><Icon name="clock" size="sm" />{s.duracaoMinutos} min</span>
                  </div>
                  <Link className={`btn ${isCliente ? 'btn--primary' : 'btn--secondary'}`} to={`/dashboard/prestadores/${s.prestadorId}?servico=${s.id}`}
                    aria-label={`${isCliente ? 'Agendar' : 'Ver horários de'} ${s.nome} em ${s.nomeNegocio}`}>
                    {isCliente ? 'Agendar' : 'Ver horários'}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="card"><EmptyState icon="search" title="Nenhum serviço encontrado">Altere os filtros ou volte quando houver novos serviços cadastrados.</EmptyState></div>
      )}
    </>
  )
}
