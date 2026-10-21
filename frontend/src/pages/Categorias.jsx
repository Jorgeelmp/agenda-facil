import { useCallback, useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { ConfirmDialog, EmptyState, ErrorState, Icon, Loading, Modal, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { categoriaApi } from '../services/api'

const vazio = { nome: '', descricao: '' }

// Categorias (RF06, RF11): gestão exclusiva do administrador.
export default function Categorias() {
  const { payload } = useAuth()
  const notify = useToast()
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(vazio)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const descriptionId = useId()
  const formId = useId()
  const load = useCallback((options) => categoriaApi.listar(options), [])
  const resource = useApiResource(load, 'categorias', { enabled: payload?.tipo === 'ADMIN' })

  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard/servicos" replace />

  function edit(value) {
    setEditing(value)
    setForm(value && value !== 'nova' ? { nome: value.nome, descricao: value.descricao ?? '' } : vazio)
    setError(null)
  }

  async function save(event) {
    event.preventDefault()
    setError(null)
    if (!form.nome.trim()) { setError({ message: 'Nome da categoria é obrigatório.' }); return }
    setBusy(true)
    try {
      const body = { nome: form.nome.trim(), descricao: form.descricao.trim() || null }
      if (editing !== 'nova') await categoriaApi.atualizar(editing.id, body)
      else await categoriaApi.criar(body)
      notify(editing !== 'nova' ? 'Categoria atualizada.' : 'Categoria criada.')
      setEditing(null)
      resource.retry()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await categoriaApi.excluir(deleting.id)
      setDeleting(null)
      notify('Categoria excluída.')
      resource.retry()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Categorias" description="Organize as classificações usadas pelos prestadores. Gestão exclusiva de administradores."
        actions={<button className="btn btn--primary" type="button" onClick={() => edit('nova')}><Icon name="plus" size="sm" />Nova categoria</button>} />

      <section className="card card--flush" aria-label="Categorias cadastradas">
        <div className="card__header"><div><h2>Categorias cadastradas</h2>{resource.data && <p>{resource.data.length} {resource.data.length === 1 ? 'categoria' : 'categorias'}</p>}</div></div>
        {resource.loading ? <Loading>Carregando categorias…</Loading> : resource.error ? <div style={{ padding: 20 }}><ErrorState error={resource.error} onRetry={resource.retry} /></div> : resource.data?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Nome</th><th scope="col">Descrição</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {resource.data.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.nome}</th>
                    <td className="cell-wrap muted">{c.descricao || '—'}</td>
                    <td>
                      <div className="form-actions" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <Link className="btn btn--ghost btn--sm" to={`/dashboard/servicos?categoriaId=${c.id}`}>Ver serviços</Link>
                        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => edit(c)} aria-label={`Editar ${c.nome}`}><Icon name="edit" size="sm" />Editar</button>
                        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => { setError(null); setDeleting(c) }} aria-label={`Excluir ${c.nome}`}><Icon name="trash" size="sm" />Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="tag" title="Nenhuma categoria cadastrada"
            actions={<button className="btn btn--primary" type="button" onClick={() => edit('nova')}>Criar primeira categoria</button>}>
            Crie a primeira categoria para os prestadores classificarem seus serviços.
          </EmptyState>
        )}
      </section>

      {editing && (
        <Modal title={editing === 'nova' ? 'Nova categoria' : 'Editar categoria'} onClose={() => setEditing(null)} busy={busy} footer={(
          <>
            <button className="btn btn--secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancelar</button>
            <button className="btn btn--primary" type="submit" form={formId} disabled={busy}>{busy ? 'Salvando…' : editing !== 'nova' ? 'Salvar categoria' : 'Criar categoria'}</button>
          </>
        )}>
          <form id={formId} className="form" onSubmit={save} aria-label={editing !== 'nova' ? 'Editar categoria' : 'Nova categoria'}>
            {error && <Alert message={error.message} errors={error.errors} />}
            <fieldset className="form-fields" disabled={busy}>
              <Field label="Nome da categoria" required maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <div className="field"><label className="field__label" htmlFor={descriptionId}>Descrição<span className="field__hint">Opcional</span></label><textarea id={descriptionId} maxLength={255} rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            </fieldset>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title={`Excluir a categoria ${deleting.nome}?`} confirmLabel="Confirmar exclusão" busyLabel="Excluindo…" busy={busy} error={error}
          onConfirm={remove} onClose={() => { setDeleting(null); setError(null) }}>
          Categorias vinculadas a serviços não podem ser excluídas.
        </ConfirmDialog>
      )}
    </>
  )
}
