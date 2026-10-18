import { useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { usuarioApi } from '../services/api'

const acessos = [
  { title: 'Usuários', text: 'Consulte todas as contas, seus contatos e perfis de acesso.', to: '/dashboard/usuarios', icon: 'users' },
  { title: 'Categorias', text: 'Organize as categorias utilizadas no catálogo de serviços.', to: '/dashboard/categorias', icon: 'tag' },
  { title: 'Prestadores', text: 'Acompanhe os negócios e gerencie seus perfis e serviços.', to: '/dashboard/prestadores', icon: 'store' },
  { title: 'Serviços', text: 'Explore o catálogo por nome, categoria e faixa de preço.', to: '/dashboard/servicos', icon: 'sparkles' },
  { title: 'Agendamentos', text: 'Veja, remarque, cancele ou exclua agendamentos.', to: '/dashboard/agendamentos', icon: 'calendar' },
  { title: 'Avaliações', text: 'Modere as avaliações feitas pelos clientes.', to: '/dashboard/avaliacoes', icon: 'star' },
]

export default function AdminHome() {
  const { payload } = useAuth()
  const load = useCallback((options) => usuarioApi.resumo(options), [])
  const resource = useApiResource(load, 'resumo-admin', { enabled: payload?.tipo === 'ADMIN' })
  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard" replace />

  return (
    <>
      <PageHeader title="Painel administrativo" description="Acompanhe as contas e acesse a gestão do AgendaFácil." />
      {resource.loading ? <Loading>Carregando resumo…</Loading> : resource.error ? <div className="card"><ErrorState error={resource.error} onRetry={resource.retry} /></div> : resource.data && (
        <dl className="stats">
          {[['Total de usuários', resource.data.total, 'users'], ['Clientes', resource.data.clientes, 'user'], ['Prestadores', resource.data.prestadores, 'store'], ['Administradores', resource.data.administradores, 'shield']].map(([label, value, icon]) => (
            <div className="stat" key={label}><dt><Icon name={icon} size="sm" />{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      )}
      <section className="stack" aria-labelledby="admin-acessos">
        <h2 id="admin-acessos">Gerenciar o sistema</h2>
        <div className="grid-cards">
          {acessos.map((item) => (
            <Link className="shortcut" key={item.to} to={item.to}>
              <span className="shortcut__icon"><Icon name={item.icon} /></span>
              <div><h3>{item.title}</h3><p>{item.text}</p></div>
              <Icon name="chevron-right" />
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
