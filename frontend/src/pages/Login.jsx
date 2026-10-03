import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: location.state?.email ?? '', senha: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(form.email.trim(), form.senha)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua conta para gerenciar seus agendamentos."
      footer={<>Não tem uma conta? <Link to="/cadastro">Criar conta</Link></>}
    >
      {location.state?.registered && !error && (
        <Alert type="success" message="Conta criada. Entre com seu email e senha." />
      )}
      {error && <Alert type="error" message={error.message} errors={error.errors} />}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="nome@email.com"
          autoComplete="email"
          value={form.email}
          onChange={update}
          required
          autoFocus
        />
        <Field
          label="Senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          value={form.senha}
          onChange={update}
          required
        />

        <button className="btn btn--primary" type="submit" disabled={loading || !form.email || !form.senha}>
          {loading ? <span className="spinner" aria-label="Entrando" /> : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}
