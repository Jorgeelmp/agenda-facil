import { useCallback, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { useApiResource } from '../hooks/useApiResource'
import { categoriaApi, servicoApi } from '../services/api'
import { moeda, validarPreco } from '../components/servico/formatos'

function FiltrosServicos({ filtros, categories, onFilter, onClear }) {
  const [draft, setDraft] = useState(filtros)
  const [validation, setValidation] = useState('')
  const categoryId = useId()

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

  return (
    <>
      <form className="panel catalog-filters" onSubmit={filtrar} aria-label="Filtrar serviços">
        <Field label="Buscar serviço" maxLength={150} placeholder="Nome do serviço" value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
        <div className="field"><label className="field__label" htmlFor={categoryId}>Categoria</label><select id={categoryId} value={draft.categoriaId} disabled={categories.loading || Boolean(categories.error)} onChange={(e) => setDraft({ ...draft, categoriaId: e.target.value })}>
          <option value="">Todas as categorias</option>
          {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select></div>
        <Field label="Preço mínimo (R$)" type="number" min="0" max="99999999.99" step="0.01" value={draft.precoMin} onChange={(e) => setDraft({ ...draft, precoMin: e.target.value })} />
        <Field label="Preço máximo (R$)" type="number" min="0" max="99999999.99" step="0.01" value={draft.precoMax} onChange={(e) => setDraft({ ...draft, precoMax: e.target.value })} />
        <div className="form-actions"><button className="btn btn--primary" type="submit">Filtrar</button><button type="button" className="btn btn--ghost" onClick={() => { setDraft({ nome: '', categoriaId: '', precoMin: '', precoMax: '' }); setValidation(''); onClear() }}>Limpar filtros</button></div>
      </form>
      {validation && <Alert message={validation} />}
    </>
  )
}

export default function Servicos() {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const filtros = Object.fromEntries(['nome', 'categoriaId', 'precoMin', 'precoMax'].map((key) => [key, params.get(key) ?? '']))
  const load = useCallback((options) => servicoApi.listar(Object.fromEntries(new URLSearchParams(key)), options), [key])
  const services = useApiResource(load, key)
  const loadCategories = useCallback((options) => categoriaApi.listar(options), [])
  const categories = useApiResource(loadCategories, 'categorias')

  return (
    <>
      <div className="page-heading"><h1>Serviços</h1><p>Encontre o serviço que você precisa por categoria e faixa de preço.</p></div>
      <FiltrosServicos key={key} filtros={filtros} categories={categories} onClear={() => setParams({})} onFilter={(draft) => {
        setParams(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '')))
        services.retry()
      }} />
      {categories.error && <div><Alert message="Não foi possível carregar as categorias." /><button className="btn btn--ghost" onClick={categories.retry}>Recarregar categorias</button></div>}
      {services.loading ? <p className="loading-state" role="status">Carregando serviços…</p> : services.error ? (
        <div className="panel"><Alert message={services.error.message} errors={services.error.errors} /><button className="btn btn--ghost" onClick={services.retry}>Tentar novamente</button></div>
      ) : services.data?.length ? (
        <>
          <p className="catalog-count" role="status">{services.data.length} {services.data.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}</p>
          <div className="provider-grid">{services.data.map((s) => <article className="panel provider-card service-card" key={s.id}>
            <div><p className="provider-card__meta">{s.nomeNegocio}</p><h2>{s.nome}</h2></div>
            {s.descricao && <p className="provider-card__description">{s.descricao}</p>}
            <div className="service-tags">{s.categorias.map((c) => <span className="badge" key={c.id}>{c.nome}</span>)}</div>
            <p className="service-price"><strong>{moeda.format(s.preco)}</strong><span>{s.duracaoMinutos} min</span></p>
            <Link className="btn btn--ghost" to={`/dashboard/prestadores/${s.prestadorId}`}>Ver horários</Link>
          </article>)}</div>
        </>
      ) : <div className="panel empty-state"><h2>Nenhum serviço encontrado</h2><p>Altere os filtros ou volte quando houver novos serviços cadastrados.</p></div>}
    </>
  )
}
