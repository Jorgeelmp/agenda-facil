import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { NavLink, Outlet } from 'react-router-dom'

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

      <nav className="dash__nav" aria-label="Navegação principal">
        <NavLink to="/dashboard" end>Prestadores</NavLink>
        <NavLink to="/dashboard/agendamentos">{payload?.tipo === 'CLIENTE' ? 'Meus agendamentos' : 'Agendamentos'}</NavLink>
        {payload?.tipo === 'PRESTADOR' && <NavLink to="/dashboard/meu-negocio">Meu negócio</NavLink>}
      </nav>

      <main className="dash__main">
        <Outlet />
      </main>
    </div>
  )
}
