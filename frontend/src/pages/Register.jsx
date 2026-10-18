import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { mascaraTelefone, telefoneValido } from '../utils/telefone'

const TIPOS = [
  { value: 'CLIENTE', label: 'Quero agendar', desc: 'Conta de cliente' },
  { value: 'PRESTADOR', label: 'Quero atender', desc: 'Conta de prestador' },
]

export default function Register() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', senha: '', confirmar: '', tipo: 'CLIENTE' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.name === 'telefone' ? mascaraTelefone(e.target.value) : e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!telefoneValido(form.telefone)) {
      setError({ message: 'Telefone incompleto. Informe o DDD e o número, ex.: (48) 99999-9999.', errors: [] })
      return
    }

    if (form.senha !== form.confirmar) {
      setError({ message: 'As senhas não conferem.', errors: [] })
      return
    }

    setLoading(true)
    const email = form.email.trim()
    try {
      await register({
        nome: form.nome.trim(),
        email,
        telefone: form.telefone.trim() || null,
        senha: form.senha,
        tipo: form.tipo,
      })
    } catch (err) {
      setError(err)
      setLoading(false)
      return
    }
    // Conta criada: entra direto, sem pedir os mesmos dados de novo.
    try {
      await login(email, form.senha)
      navigate('/dashboard', { replace: true })
    } catch {
      navigate('/login', { replace: true, state: { registered: true, email } })
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={<>Já tem uma conta? <Link to="/login">Entrar</Link></>}
    >
      {error && <Alert type="error" message={error.message} errors={error.errors} />}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <span className="field__label">Como você vai usar o AgendaFácil?</span>
          <div className="segmented" role="radiogroup" aria-label="Tipo de conta">
            {TIPOS.map((t) => (
              <label key={t.value} className={`segmented__opt${form.tipo === t.value ? ' is-active' : ''}`}>
                <input type="radio" name="tipo" value={t.value} checked={form.tipo === t.value} onChange={update} />
                <strong>{t.label}</strong>
                <span>{t.desc}</span>
              </label>
            ))}
          </div>
          {form.tipo === 'PRESTADOR' && <span className="field__help">Depois de entrar, você cadastra seu negócio, os horários e os serviços.</span>}
        </div>

        <Field label="Nome" name="nome" autoComplete="name" value={form.nome} onChange={update} required autoFocus />
        <Field label="Email" name="email" type="email" placeholder="nome@email.com" autoComplete="email" value={form.email} onChange={update} required />
        <Field label="Telefone" hint="Opcional" name="telefone" type="tel" placeholder="(48) 99999-9999" autoComplete="tel" value={form.telefone} onChange={update} maxLength={15} inputMode="numeric" />
        <div className="form-grid">
          <Field label="Senha" hint="Mín. 6" name="senha" type="password" autoComplete="new-password" value={form.senha} onChange={update} required />
          <Field label="Confirmar senha" name="confirmar" type="password" autoComplete="new-password" value={form.confirmar} onChange={update} required />
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {loading ? <span className="spinner" aria-label="Criando conta" /> : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
