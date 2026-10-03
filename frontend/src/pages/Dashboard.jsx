import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { payload, logout } = useAuth()

  return (
    <div className="dash">
      <header className="dash__top">
        <Logo />
        <div className="dash__user">
          <div className="dash__user-info">
            <strong>{payload?.nome}</strong>
            <span>{payload?.sub}</span>
          </div>
          <button className="btn btn--ghost" onClick={logout}>Sair</button>
        </div>
      </header>

      <main className="dash__main">
        <h1>Dashboard</h1>
      </main>
    </div>
  )
}
