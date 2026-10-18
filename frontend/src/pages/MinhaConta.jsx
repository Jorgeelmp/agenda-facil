import { useCallback, useState } from 'react'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { Avatar, ErrorState, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { usuarioApi } from '../services/api'
import { PERFIS } from '../utils/status'

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

// Minha conta: o próprio usuário edita nome, telefone e senha (CRUD de usuários).
export default function MinhaConta() {
  const { payload } = useAuth()
  const load = useCallback((options) => usuarioApi.minhaConta(options), [])
  const conta = useApiResource(load, `conta:${payload?.userId}`)

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso e contato." />
      {conta.loading ? <Loading>Carregando sua conta…</Loading> : conta.error ? (
        <div className="card"><ErrorState error={conta.error} onRetry={conta.retry} /></div>
      ) : conta.data && <FormConta key={conta.data.id} usuario={conta.data} onSaved={conta.update} />}
    </>
  )
}

function FormConta({ usuario, onSaved }) {
  const { atualizarSessao } = useAuth()
  const notify = useToast()
  const [form, setForm] = useState({ nome: usuario.nome, telefone: usuario.telefone ?? '', senhaAtual: '', novaSenha: '', confirmar: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const update = (event) => setForm((atual) => ({ ...atual, [event.target.name]: event.target.value }))
  const trocandoSenha = Boolean(form.novaSenha || form.senhaAtual || form.confirmar)

  async function salvar(event) {
    event.preventDefault()
    setError(null)
    if (!form.nome.trim()) { setError({ message: 'Informe seu nome.' }); return }
    if (trocandoSenha) {
      if (!form.senhaAtual) { setError({ message: 'Informe a senha atual para trocar a senha.' }); return }
      if (form.novaSenha.length < 6) { setError({ message: 'A nova senha deve ter no mínimo 6 caracteres.' }); return }
      if (form.novaSenha !== form.confirmar) { setError({ message: 'As novas senhas não conferem.' }); return }
    }
    setBusy(true)
    try {
      const resposta = await usuarioApi.atualizarMinhaConta({
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        senhaAtual: trocandoSenha ? form.senhaAtual : null,
        novaSenha: trocandoSenha ? form.novaSenha : null,
      })
      atualizarSessao(resposta.token)
      onSaved(resposta.usuario)
      setForm((atual) => ({ ...atual, senhaAtual: '', novaSenha: '', confirmar: '' }))
      notify(trocandoSenha ? 'Dados e senha atualizados.' : 'Dados atualizados.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid-2">
      <form className="card" onSubmit={salvar} aria-label="Editar minha conta" noValidate>
        <div className="card__header"><div><h2>Dados pessoais</h2><p>O email é usado para entrar e não pode ser alterado.</p></div></div>
        {error && <Alert message={error.message} errors={error.errors} />}
        <fieldset className="form-fields" disabled={busy}>
          <Field label="Nome" name="nome" maxLength={150} autoComplete="name" value={form.nome} onChange={update} required />
          <Field label="Email" value={usuario.email} disabled readOnly />
          <Field label="Telefone" hint="Opcional" name="telefone" type="tel" maxLength={20} autoComplete="tel" placeholder="(48) 99999-9999" value={form.telefone} onChange={update} />
        </fieldset>
        <hr className="divider" />
        <div className="card__header"><div><h2>Trocar senha</h2><p>Deixe em branco para manter a senha atual.</p></div></div>
        <fieldset className="form-fields" disabled={busy}>
          <Field label="Senha atual" name="senhaAtual" type="password" autoComplete="current-password" value={form.senhaAtual} onChange={update} />
          <div className="form-grid">
            <Field label="Nova senha" hint="Mín. 6" name="novaSenha" type="password" autoComplete="new-password" value={form.novaSenha} onChange={update} />
            <Field label="Confirmar nova senha" name="confirmar" type="password" autoComplete="new-password" value={form.confirmar} onChange={update} />
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </form>

      <aside className="card">
        <div className="profile-head">
          <Avatar nome={usuario.nome} size="lg" />
          <div><h2>{usuario.nome}</h2><span className="muted">{usuario.email}</span></div>
        </div>
        <dl className="info-list">
          <div><dt>Tipo de conta</dt><dd>{PERFIS[usuario.tipo] ?? usuario.tipo}</dd></div>
          <div><dt>Telefone</dt><dd>{usuario.telefone || 'Não informado'}</dd></div>
          <div><dt>Membro desde</dt><dd>{usuario.criadoEm ? formatoData.format(new Date(usuario.criadoEm)) : '—'}</dd></div>
        </dl>
      </aside>
    </div>
  )
}
