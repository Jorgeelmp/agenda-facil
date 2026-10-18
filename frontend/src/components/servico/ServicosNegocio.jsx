import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import FormServico from './FormServico'
import { moeda } from './formatos'
import { ConfirmDialog, EmptyState, ErrorState, Icon, Loading, Modal } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useApiResource } from '../../hooks/useApiResource'
import { categoriaApi, servicoApi } from '../../services/api'

// Serviços do negócio (RF05) com categorias (RF06). Criar e editar abrem em um diálogo.
export default function ServicosNegocio({ prestadorId, ativo = true, onChange }) {
  const { payload } = useAuth()
  const notify = useToast()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async (options) => {
    const [servicos, categorias] = await Promise.all([servicoApi.gerenciar(prestadorId, options), categoriaApi.listar(options)])
    return { servicos, categorias }
  }, [prestadorId])
  const resource = useApiResource(load, prestadorId)

  function saved(message) {
    setEditing(null)
    notify(message)
    resource.retry()
    onChange?.()
  }

  async function remove() {
    setBusy(true)
    setDeleteError(null)
    try {
      await servicoApi.excluir(prestadorId, deleting.id)
      setDeleting(null)
      notify('Serviço excluído.')
      resource.retry()
      onChange?.()
    } catch (err) { setDeleteError(err) } finally { setBusy(false) }
  }

  if (resource.loading) return <section className="card"><Loading>Carregando serviços e categorias…</Loading></section>
  if (resource.error) return <section className="card"><ErrorState error={resource.error} onRetry={resource.retry} /></section>

  const { servicos, categorias } = resource.data
  const semCategorias = !categorias.length

  return (
    <section className="card card--flush" aria-label="Serviços cadastrados">
      <div className="card__header">
        <div>
          <h2>Serviços</h2>
          <p>{servicos.length} {servicos.length === 1 ? 'serviço cadastrado' : 'serviços cadastrados'}. A duração define o tamanho de cada horário oferecido.</p>
        </div>
        {!semCategorias && <button className="btn btn--primary" type="button" onClick={() => setEditing('novo')}><Icon name="plus" size="sm" />Novo serviço</button>}
      </div>

      {!ativo && <div style={{ padding: '16px 20px 0' }}><p className="notice"><Icon name="info" />Este negócio está inativo. Seus serviços ficarão disponíveis aos clientes quando o perfil for reativado.</p></div>}

      {semCategorias ? (
        <EmptyState icon="tag" title="Nenhuma categoria cadastrada"
          actions={payload?.tipo === 'ADMIN' && <Link className="btn btn--secondary" to="/dashboard/categorias">Gerenciar categorias</Link>}>
          Uma categoria precisa ser cadastrada por um administrador antes de criar serviços.
        </EmptyState>
      ) : servicos.length === 0 ? (
        <EmptyState icon="sparkles" title="Nenhum serviço cadastrado"
          actions={<button className="btn btn--primary" type="button" onClick={() => setEditing('novo')}><Icon name="plus" size="sm" />Cadastrar primeiro serviço</button>}>
          Cadastre o que você oferece, com preço e duração, para os clientes poderem agendar.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table" aria-label="Serviços do negócio">
            <thead><tr><th scope="col">Serviço</th><th scope="col">Categorias</th><th scope="col">Duração</th><th scope="col">Preço</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {servicos.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="cell-wrap">{s.nome}{s.descricao && <span className="cell-sub">{s.descricao}</span>}</th>
                  <td>
                    {s.categorias.length
                      ? <span className="tags">{s.categorias.map((c) => <span className="tag" key={c.id}>{c.nome}</span>)}</span>
                      : <span className="field__help">Serviço legado sem categoria. Selecione uma categoria ao editar.</span>}
                  </td>
                  <td className="nowrap">{s.duracaoMinutos} min</td>
                  <td className="nowrap">{moeda.format(s.preco)}</td>
                  <td><span className={`badge ${s.ativo ? 'badge--active' : 'badge--inactive'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td>
                    <div className="form-actions" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn--ghost btn--sm" disabled={busy} aria-label={`Editar ${s.nome}`} onClick={() => setEditing(s)}><Icon name="edit" size="sm" />Editar</button>
                      <button className="btn btn--ghost btn--sm" disabled={busy} aria-label={`Excluir ${s.nome}`} onClick={() => { setDeleteError(null); setDeleting(s) }}><Icon name="trash" size="sm" />Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === 'novo' ? 'Novo serviço' : 'Editar serviço'} description={editing === 'novo' ? 'Preencha os dados do serviço oferecido.' : editing.nome}
          onClose={() => setEditing(null)} busy={busy}>
          <FormServico prestadorId={prestadorId} servico={editing === 'novo' ? null : editing} categorias={categorias}
            onSaved={saved} onCancel={() => setEditing(null)} onBusy={setBusy} disabled={false} />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title={`Excluir ${deleting.nome}?`} confirmLabel="Confirmar exclusão" busyLabel="Excluindo…" busy={busy}
          error={deleteError} onConfirm={remove} onClose={() => setDeleting(null)}>
          Excluir <strong>{deleting.nome}</strong>? Se houver agendamentos, edite o serviço e desmarque “Serviço ativo” para preservar o histórico.
        </ConfirmDialog>
      )}
    </section>
  )
}
