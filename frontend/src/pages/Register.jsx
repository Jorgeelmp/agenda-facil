import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'

const TIPOS = [
  { value: 'CLIENTE', label: 'Cliente', desc: 'Para agendar serviços.' },
  { value: 'PRESTADOR', label: 'Prestador', desc: 'Para oferecer serviços e gerenciar sua agenda.' },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '', confirmar: '', tipo: 'CLIENTE' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const tipoAtual = TIPOS.find((t) => t.value === form.tipo)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (form.senha !== form.confirmar) {
      setError({ message: 'As senhas não conferem.', errors: [] })
      return
    }

    setLoading(true)
    try {
      await register({
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim() || null,
        senha: form.senha,
        tipo: form.tipo,
      })
      navigate('/login', { replace: true, state: { registered: true, email: form.email.trim() } })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Preencha seus dados para começar."
      footer={<>Já tem uma conta? <Link to="/login">Entrar</Link></>}
    >
      {error && <Alert type="error" message={error.message} errors={error.errors} />}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field__label">Tipo de conta</span>
          <div className="segmented" role="radiogroup" aria-label="Tipo de conta">
            {TIPOS.map((t) => (
              <label key={t.value} className={`segmented__opt${form.tipo === t.value ? ' is-active' : ''}`}>
                <input type="radio" name="tipo" value={t.value} checked={form.tipo === t.value} onChange={update} />
                {t.label}
              </label>
            ))}
          </div>
          <span className="field__help">{tipoAtual.desc}</span>
        </div>

        <Field label="Nome" name="nome" autoComplete="name" value={form.nome} onChange={update} required autoFocus />
        <Field label="Email" name="email" type="email" placeholder="nome@email.com" autoComplete="email" value={form.email} onChange={update} required />
        <Field label="Telefone" hint="Opcional" name="telefone" type="tel" placeholder="(48) 99999-9999" autoComplete="tel" value={form.telefone} onChange={update} maxLength={20} />
        <Field label="Senha" hint="Mínimo de 6 caracteres" name="senha" type="password" autoComplete="new-password" value={form.senha} onChange={update} required />
        <Field label="Confirmar senha" name="confirmar" type="password" autoComplete="new-password" value={form.confirmar} onChange={update} required />

        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Criando conta" /> : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
