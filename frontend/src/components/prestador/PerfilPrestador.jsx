import { useEffect, useId, useRef, useState } from 'react'
import { Alert } from '../Alert'
import { Field } from '../Field'
import { ConfirmDialog } from '../ui'
import { useToast } from '../../context/ToastContext'
import { prestadorApi } from '../../services/api'

const EMPTY = { nomeNegocio: '', descricao: '', endereco: '', telefoneComercial: '' }

function toForm(perfil) {
  return Object.fromEntries(Object.keys(EMPTY).map((campo) => [campo, perfil?.[campo] ?? '']))
}

// Dados do negócio (RF02) + ativação/inativação e exclusão do perfil.
export default function PerfilPrestador({ perfil, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => toForm(perfil))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const descriptionId = useId()
  const notify = useToast()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function run(action, message, { onSuccess, resetForm = false, onError = setError } = {}) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      const saved = await action()
      if (!mounted.current) return true
      if (resetForm && saved) setForm(toForm(saved))
      if (message) notify(message)
      if (onSuccess) onSuccess()
      else if (saved) onSaved(saved)
      return true
    } catch (err) {
      if (mounted.current) onError(err)
      return false
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
    setDeleteError(null)
    const ok = await run(() => prestadorApi.excluir(perfil.id), 'Perfil excluído. Sua conta foi mantida.', { onSuccess: onDeleted, onError: setDeleteError })
    if (ok && mounted.current) setConfirmDelete(false)
  }

  return (
    <div className="grid-2">
      <section className="card" aria-labelledby="perfil-title">
        <div className="card__header">
          <div>
            <h2 id="perfil-title">{perfil ? 'Dados do negócio' : 'Cadastre seu negócio'}</h2>
            <p>Como os clientes vão encontrar e contatar você.</p>
          </div>
        </div>

        {error && <Alert message={error.message} errors={error.errors} />}

        <form className="form" onSubmit={save}>
          <fieldset className="form-fields" disabled={busy}>
            <Field label="Nome do negócio" name="nomeNegocio" maxLength={150} value={form.nomeNegocio} onChange={update} required autoComplete="organization" placeholder="Ex.: Barbearia do Centro" />
            <div className="field">
              <label className="field__label" htmlFor={descriptionId}>Descrição <span className="field__hint">Opcional</span></label>
              <textarea id={descriptionId} name="descricao" maxLength={500} rows={4} value={form.descricao} onChange={update} placeholder="Conte o que você faz e o que diferencia seu atendimento." />
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
      </section>

      {perfil && (
        <aside className="stack" style={{ gap: 24 }}>
          <section className="card">
            <div className="card__header">
              <div>
                <h2>Situação do negócio</h2>
                <p>{perfil.ativo
                  ? 'Ao inativar o negócio, novos horários deixam de ser oferecidos. Seus dados são preservados.'
                  : 'Reative o negócio para voltar a oferecer horários disponíveis.'}</p>
              </div>
              <span className={`badge ${perfil.ativo ? 'badge--active' : 'badge--inactive'}`}>{perfil.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="form-actions">
              <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => run(
                () => prestadorApi.alterarStatus(perfil.id, !perfil.ativo), perfil.ativo ? 'Negócio inativado.' : 'Negócio reativado.')}>{perfil.ativo ? 'Inativar negócio' : 'Reativar negócio'}</button>
            </div>
          </section>
          <section className="danger-zone">
            <h3>Excluir perfil</h3>
            <p>Remove o perfil e os horários. Sua conta de usuário é mantida. Negócios com serviços vinculados não podem ser excluídos, mas podem ser inativados.</p>
            <div><button className="btn btn--danger" type="button" disabled={busy} onClick={() => { setDeleteError(null); setConfirmDelete(true) }}>Excluir perfil</button></div>
          </section>
        </aside>
      )}

      {confirmDelete && (
        <ConfirmDialog title="Excluir o perfil do negócio?" confirmLabel="Confirmar exclusão" busyLabel="Excluindo…" busy={busy}
          error={deleteError} onConfirm={remove} onClose={() => setConfirmDelete(false)}>
          Excluir o perfil e seus horários? Sua conta será mantida. Negócios com serviços vinculados podem ser inativados.
        </ConfirmDialog>
      )}
    </div>
  )
}
