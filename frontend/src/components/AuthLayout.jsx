import { Logo } from './Logo'

const ANO = new Date().getFullYear()

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <header className="auth__top">
        <Logo />
      </header>

      <main className="auth__main">
        <div className="auth__card">
          <header className="auth__header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
          {footer && <p className="auth__switch">{footer}</p>}
        </div>
      </main>

      <footer className="auth__foot">© {ANO} AgendaFácil</footer>
    </div>
  )
}
