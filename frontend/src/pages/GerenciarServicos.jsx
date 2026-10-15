import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import FormServico from '../components/servico/FormServico'
import { moeda } from '../components/servico/formatos'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { categoriaApi, prestadorApi, servicoApi } from '../services/api'

export default function GerenciarServicos() {
  const { prestadorId } = useParams()
  const { payload } = useAuth()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [formKey, setFormKey] = useState(0)
  const load = useCallback(async (options) => {
    const [perfil, servicos, categorias] = await Promise.all([
      prestadorApi.buscar(prestadorId, options), servicoApi.gerenciar(prestadorId, options), categoriaApi.listar(options),
    ])
    return { perfil, servicos, categorias }
  }, [prestadorId])
  const resource = useApiResource(load, prestadorId, { enabled: ['PRESTADOR', 'ADMIN'].includes(payload?.tipo) })

  function edit(value) {
    setEditing(value)
    setDeleting(null)
    setFormKey((v) => v + 1)
    setError(null)
    setSuccess('')
  }

  function saved(message) {
    setEditing(null)
    setFormKey((v) => v + 1)
    setSuccess(message)
    setError(null)
    resource.retry()
  }

  async function remove() {
    setBusy(true)
    setError(null)
    setSuccess('')
    try {
      await servicoApi.excluir(prestadorId, deleting.id)
      if (editing?.id === deleting.id) { setEditing(null); setFormKey((v) => v + 1) }
      setDeleting(null)
      setSuccess('Serviço excluído.')
      resource.retry()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }

  if (!['PRESTADOR', 'ADMIN'].includes(payload?.tipo)) return <div className="panel"><Alert message="Você não tem permissão para gerenciar serviços." /><Link to="/dashboard/servicos">Ver serviços</Link></div>

  return (
    <>
      <Link className="back-link" to={`/dashboard/prestadores/${prestadorId}`}>← Voltar ao negócio</Link>
      <div className="page-heading"><h1>Gerenciar serviços</h1><p>{resource.data?.perfil.nomeNegocio ?? 'Cadastre os serviços, preços, durações e categorias do negócio.'}</p></div>
      {error && <Alert message={error.message} errors={error.errors} />}
      {success && <Alert type="success" message={success} />}
      {resource.loading ? <p className="loading-state" role="status">Carregando serviços e categorias…</p> : resource.error ? <div className="panel"><Alert message={resource.error.message} errors={resource.error.errors} /><button className="btn btn--ghost" onClick={resource.retry}>Tentar novamente</button></div> : resource.data && (
        <>
          {!resource.data.perfil.ativo && <p className="panel__description">Este negócio está inativo. Seus serviços ficarão disponíveis aos clientes quando o perfil for reativado.</p>}
          <div className="business-grid">
            <section className="panel"><div className="panel__header"><h2>{editing ? 'Editar serviço' : 'Novo serviço'}</h2></div>
              {!resource.data.categorias.length ? <div className="empty-state"><p>Uma categoria precisa ser cadastrada por um administrador antes de criar serviços.</p>{payload.tipo === 'ADMIN' && <Link to="/dashboard/categorias">Gerenciar categorias</Link>}</div> : (
                <FormServico key={`${prestadorId}:${formKey}`} prestadorId={prestadorId} servico={editing} categorias={resource.data.categorias} onSaved={saved} onCancel={editing ? () => edit(null) : null} onBusy={setBusy} disabled={busy} />
              )}
            </section>
            <section className="panel"><div className="panel__header"><h2>Serviços cadastrados</h2><span className="badge">{resource.data.servicos.length}</span></div>
              {resource.data.servicos.length ? <ul className="catalog-list">{resource.data.servicos.map((s) => <li key={s.id}>
                <div className="service-heading"><h3>{s.nome}</h3><span className={`badge${s.ativo ? ' badge--active' : ''}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></div>
                {s.descricao && <p className="provider-card__description">{s.descricao}</p>}
                <p className="service-price"><strong>{moeda.format(s.preco)}</strong><span>{s.duracaoMinutos} min</span></p>
                <div className="service-tags">{s.categorias.map((c) => <span className="badge" key={c.id}>{c.nome}</span>)}</div>
                {!s.categorias.length && <p className="field__help">Serviço legado sem categoria. Selecione uma categoria ao editar.</p>}
                <div className="form-actions"><button className="btn btn--ghost" disabled={busy} aria-label={`Editar ${s.nome}`} onClick={() => edit(s)}>Editar</button><button className="btn btn--danger" disabled={busy} aria-label={`Excluir ${s.nome}`} onClick={() => { setDeleting(s); setError(null); setSuccess('') }}>Excluir</button></div>
              </li>)}</ul> : <p className="empty-state">Nenhum serviço cadastrado. Adicione seu primeiro serviço ao lado.</p>}
              {deleting && <div className="confirm-action" role="group" aria-label="Confirmar exclusão de serviço"><p>Excluir <strong>{deleting.nome}</strong>? Se houver agendamentos, edite o serviço e desmarque “Serviço ativo” para preservar o histórico.</p><div className="form-actions"><button className="btn btn--danger" disabled={busy} onClick={remove}>Confirmar exclusão</button><button className="btn btn--ghost" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button></div></div>}
            </section>
          </div>
        </>
      )}
    </>
  )
}
