import { useEffect, useRef, useState } from 'react'
import { Alert } from '../Alert'
import { Field } from '../Field'
import { prestadorApi } from '../../services/api'

const EMPTY = { nomeNegocio: '', descricao: '', endereco: '', telefoneComercial: '' }

function toForm(perfil) {
  return Object.fromEntries(Object.keys(EMPTY).map((campo) => [campo, perfil?.[campo] ?? '']))
}

export default function PerfilPrestador({ perfil, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => toForm(perfil))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  const descriptionId = 'perfil-descricao'

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setSuccess('')
  }

  async function run(action, message, { onSuccess, resetForm = false } = {}) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    setSuccess('')
    try {
      const saved = await action()
      if (!mounted.current) return
      if (resetForm && saved) setForm(toForm(saved))
      setSuccess(message)
      if (onSuccess) onSuccess()
      else if (saved) onSaved(saved)
    } catch (err) {
      if (mounted.current) setError(err)
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  function save(event) {
    event.preventDefault()
    const nomeNegocio = form.nomeNegocio.trim()
    if (!nomeNegocio) {
      setError({ message: 'Informe o nome do negócio.', errors: [] })
      return
    }
    if (Object.values(form).some((value) => value.includes('\0'))) {
      setError({ message: 'Remova os caracteres inválidos dos dados do negócio.', errors: [] })
      return
    }
    const body = {
      nomeNegocio,
      descricao: form.descricao.trim() || null,
      endereco: form.endereco.trim() || null,
      telefoneComercial: form.telefoneComercial.trim() || null,
    }
    run(() => perfil ? prestadorApi.atualizar(perfil.id, body) : prestadorApi.criar(body),
      perfil ? 'Dados do negócio atualizados.' : 'Perfil do negócio criado.', { resetForm: true })
  }

  async function remove() {
    await run(() => prestadorApi.excluir(perfil.id), '', { onSuccess: onDeleted })
    if (mounted.current) setConfirmDelete(false)
  }

  return (
    <section className="panel" aria-labelledby="perfil-title">
      <div className="panel__header">
        <div>
          <h2 id="perfil-title">{perfil ? 'Dados do negócio' : 'Cadastre seu negócio'}</h2>
          <p className="panel__description">Nome, endereço e contato para os seus clientes.</p>
        </div>
        {perfil && <span className={`badge${perfil.ativo ? ' badge--active' : ''}`}>{perfil.ativo ? 'Ativo' : 'Inativo'}</span>}
      </div>

      {error && <Alert message={error.message} errors={error.errors} />}
      {success && <Alert type="success" message={success} />}

      <form className="form" onSubmit={save}>
        <fieldset className="form-fields" disabled={busy}>
          <Field label="Nome do negócio" name="nomeNegocio" maxLength={150} value={form.nomeNegocio} onChange={update} required autoComplete="organization" />
          <div className="field">
            <label className="field__label" htmlFor={descriptionId}>Descrição <span className="field__hint">Opcional</span></label>
            <textarea id={descriptionId} name="descricao" maxLength={500} rows={4} value={form.descricao} onChange={update} />
          </div>
          <Field label="Endereço" hint="Opcional" name="endereco" maxLength={255} value={form.endereco} onChange={update} autoComplete="street-address" />
          <Field label="Telefone comercial" hint="Opcional" name="telefoneComercial" type="tel" maxLength={20} value={form.telefoneComercial} onChange={update} autoComplete="tel" />
        </fieldset>
        <div className="form-actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}{perfil ? 'Salvar dados' : 'Criar perfil'}
          </button>
        </div>
      </form>

      {perfil && (
        <div className="profile-actions">
          <p className="field__help">{perfil.ativo
            ? 'Ao inativar o negócio, novos horários deixam de ser oferecidos. Seus dados são preservados.'
            : 'Reative o negócio para voltar a oferecer horários disponíveis.'}</p>
          <div className="form-actions">
            <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => run(
              () => prestadorApi.alterarStatus(perfil.id, !perfil.ativo), perfil.ativo ? 'Negócio inativado.' : 'Negócio reativado.')}>{perfil.ativo ? 'Inativar negócio' : 'Reativar negócio'}</button>
            <button className="btn btn--danger" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Excluir perfil</button>
          </div>
          {confirmDelete && (
            <div className="confirm-action" role="group" aria-label="Confirmar exclusão do perfil">
              <p>Excluir o perfil e seus horários? Sua conta será mantida. Negócios com serviços vinculados podem ser inativados.</p>
              <div className="form-actions">
                <button className="btn btn--danger" type="button" disabled={busy} onClick={remove}>Confirmar exclusão</button>
                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
