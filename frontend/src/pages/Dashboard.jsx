import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Avatar, Icon } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { PERFIS } from '../utils/status'

// Menu de cada perfil: o que a pessoa faz primeiro aparece primeiro.
const MENUS = {
  CLIENTE: [
    { itens: [
      { to: '/dashboard', end: true, icon: 'home', label: 'Início' },
      { to: '/dashboard/servicos', icon: 'calendar-plus', label: 'Agendar serviço' },
      { to: '/dashboard/prestadores', icon: 'store', label: 'Prestadores' },
    ] },
    { titulo: 'Minha conta', itens: [
      { to: '/dashboard/agendamentos', icon: 'calendar', label: 'Meus agendamentos' },
      { to: '/dashboard/avaliacoes', icon: 'star', label: 'Minhas avaliações' },
      { to: '/dashboard/conta', icon: 'user', label: 'Meus dados' },
    ] },
  ],
  PRESTADOR: [
    { itens: [
      { to: '/dashboard', end: true, icon: 'home', label: 'Início' },
      { to: '/dashboard/agendamentos', icon: 'calendar', label: 'Agenda' },
      { to: '/dashboard/meu-negocio', icon: 'settings', label: 'Meu negócio' },
      { to: '/dashboard/avaliacoes', icon: 'star', label: 'Avaliações recebidas' },
    ] },
    { titulo: 'Explorar', itens: [
      { to: '/dashboard/servicos', icon: 'sparkles', label: 'Serviços' },
      { to: '/dashboard/prestadores', icon: 'store', label: 'Prestadores' },
    ] },
    { titulo: 'Minha conta', itens: [
      { to: '/dashboard/conta', icon: 'user', label: 'Meus dados' },
    ] },
  ],
  ADMIN: [
    { itens: [
      { to: '/dashboard', end: true, icon: 'grid', label: 'Visão geral' },
      { to: '/dashboard/agendamentos', icon: 'calendar', label: 'Agendamentos' },
      { to: '/dashboard/avaliacoes', icon: 'star', label: 'Avaliações' },
    ] },
    { titulo: 'Gestão', itens: [
      { to: '/dashboard/usuarios', icon: 'users', label: 'Usuários' },
      { to: '/dashboard/prestadores', icon: 'store', label: 'Prestadores' },
      { to: '/dashboard/servicos', icon: 'sparkles', label: 'Serviços' },
      { to: '/dashboard/categorias', icon: 'tag', label: 'Categorias' },
    ] },
    { titulo: 'Minha conta', itens: [
      { to: '/dashboard/conta', icon: 'user', label: 'Meus dados' },
    ] },
  ],
}

export default function Dashboard() {
  const { payload, logout } = useAuth()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(null)
  // Fecha o menu do celular ao trocar de página.
  const aberto = menuAberto === location.pathname
  const menu = MENUS[payload?.tipo] ?? MENUS.CLIENTE

  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        <span className="form-actions" style={{ gap: 4 }}>
        <ThemeToggle />
        <button className="icon-btn" type="button" aria-label="Abrir menu" aria-expanded={aberto} onClick={() => setMenuAberto(location.pathname)}>
          <Icon name="menu" />
        </button>
        </span>
      </header>
      {aberto && <div className="sidebar-backdrop" onClick={() => setMenuAberto(null)} />}

      <aside className={`sidebar${aberto ? ' is-open' : ''}`}>
        <div className="sidebar__brand"><Logo /></div>
        <nav className="nav" aria-label="Navegação principal">
          {menu.map((secao, indice) => (
            <div className="nav" key={indice}>
              {secao.titulo && <p className="nav__section">{secao.titulo}</p>}
              {secao.itens.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
                  <Icon name={item.icon} />{item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__user">
          <Avatar nome={payload?.nome} />
          <div className="sidebar__user-info">
            <strong>{payload?.nome}</strong>
            <span>{payload?.sub}</span>
            <span className="role-tag">{PERFIS[payload?.tipo] ?? payload?.tipo}</span>
          </div>
          <ThemeToggle />
          <button className="icon-btn" type="button" onClick={logout} aria-label="Sair" title="Sair"><Icon name="logout" /></button>
        </div>
      </aside>

      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
