import { useCallback, useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { categoriaApi } from '../services/api'

const vazio = { nome: '', descricao: '' }

export default function Categorias() {
  const { payload } = useAuth()
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(vazio)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const descriptionId = useId()
  const load = useCallback((options) => categoriaApi.listar(options), [])
  const resource = useApiResource(load, 'categorias', { enabled: payload?.tipo === 'ADMIN' })

  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard/servicos" replace />

  function edit(value) {
    setEditing(value)
    setForm(value ? { nome: value.nome, descricao: value.descricao ?? '' } : vazio)
    setDeleting(null)
    setError(null)
    setSuccess('')
  }

  async function save(event) {
    event.preventDefault()
    setError(null)
    setSuccess('')
    if (!form.nome.trim()) { setError({ message: 'Nome da categoria é obrigatório.' }); return }
    setBusy(true)
    try {
      const body = { nome: form.nome.trim(), descricao: form.descricao.trim() || null }
      if (editing) await categoriaApi.atualizar(editing.id, body)
      else await categoriaApi.criar(body)
      setSuccess(editing ? 'Categoria atualizada.' : 'Categoria criada.')
      setEditing(null)
      setForm(vazio)
      resource.retry()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    setSuccess('')
    try {
      await categoriaApi.excluir(deleting.id)
      if (editing?.id === deleting.id) { setEditing(null); setForm(vazio) }
      setDeleting(null)
      setSuccess('Categoria excluída.')
      resource.retry()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-heading"><h1>Categorias</h1><p>Organize as classificações usadas pelos prestadores. Gestão exclusiva de administradores.</p></div>
      {error && <Alert message={error.message} errors={error.errors} />}
      {success && <Alert type="success" message={success} />}
      <div className="business-grid">
        <section className="panel"><div className="panel__header"><h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2></div>
          <form className="form" onSubmit={save} aria-label={editing ? 'Editar categoria' : 'Nova categoria'}>
            <fieldset className="form-fields" disabled={busy}>
              <Field label="Nome da categoria" required maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <div className="field"><label className="field__label" htmlFor={descriptionId}>Descrição<span className="field__hint">Opcional</span></label><textarea id={descriptionId} maxLength={255} rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="form-actions"><button className="btn btn--primary" type="submit">{busy ? 'Salvando…' : editing ? 'Salvar categoria' : 'Criar categoria'}</button>{editing && <button className="btn btn--ghost" type="button" onClick={() => edit(null)}>Cancelar edição</button>}</div>
            </fieldset>
          </form>
        </section>
        <section className="panel"><div className="panel__header"><h2>Categorias cadastradas</h2></div>
          {resource.loading ? <p role="status">Carregando categorias…</p> : resource.error ? <><Alert message={resource.error.message} /><button className="btn btn--ghost" onClick={resource.retry}>Tentar novamente</button></> : resource.data?.length ? (
            <ul className="catalog-list">{resource.data.map((c) => <li key={c.id}>
              <h3>{c.nome}</h3>{c.descricao && <p className="provider-card__description">{c.descricao}</p>}
              <div className="form-actions"><Link to={`/dashboard/servicos?categoriaId=${c.id}`}>Ver serviços</Link><button className="btn btn--ghost" disabled={busy} onClick={() => edit(c)} aria-label={`Editar ${c.nome}`}>Editar</button><button className="btn btn--danger" disabled={busy} onClick={() => { setDeleting(c); setError(null); setSuccess('') }} aria-label={`Excluir ${c.nome}`}>Excluir</button></div>
            </li>)}</ul>
          ) : <p className="empty-state">Nenhuma categoria cadastrada. Crie a primeira categoria para os prestadores classificarem seus serviços.</p>}
          {deleting && <div className="confirm-action" role="group" aria-label="Confirmar exclusão de categoria"><p>Excluir a categoria <strong>{deleting.nome}</strong>? Categorias vinculadas a serviços não podem ser excluídas.</p><div className="form-actions"><button className="btn btn--danger" disabled={busy} onClick={remove}>Confirmar exclusão</button><button className="btn btn--ghost" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></div>}
        </section>
      </div>
    </>
  )
}
