import { useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { usuarioApi } from '../services/api'

const acessos = [
  { title: 'Usuários', text: 'Consulte todas as contas, seus contatos e perfis de acesso.', to: '/dashboard/usuarios' },
  { title: 'Categorias', text: 'Organize as categorias utilizadas no catálogo de serviços.', to: '/dashboard/categorias' },
  { title: 'Prestadores', text: 'Acompanhe os negócios e gerencie seus perfis e serviços.', to: '/dashboard/prestadores' },
  { title: 'Serviços', text: 'Explore o catálogo por nome, categoria e faixa de preço.', to: '/dashboard/servicos' },
]

export default function AdminHome() {
  const { payload } = useAuth()
  const load = useCallback((options) => usuarioApi.resumo(options), [])
  const resource = useApiResource(load, 'resumo-admin', { enabled: payload?.tipo === 'ADMIN' })
  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard" replace />

  return (
    <>
      <div className="page-heading"><h1>Painel administrativo</h1><p>Acompanhe as contas e acesse a gestão do AgendaFácil.</p></div>
      {resource.loading ? <p className="loading-state" role="status">Carregando resumo…</p> : resource.error ? <div className="panel"><Alert message={resource.error.message} /><button className="btn btn--ghost" onClick={resource.retry}>Tentar novamente</button></div> : resource.data && (
        <dl className="admin-stats">
          {[['Total de usuários', resource.data.total], ['Clientes', resource.data.clientes], ['Prestadores', resource.data.prestadores], ['Administradores', resource.data.administradores]].map(([label, value]) => <div className="panel" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      <section aria-labelledby="admin-acessos"><h2 className="admin-section-title" id="admin-acessos">Gerenciar o sistema</h2><div className="admin-links">{acessos.map((item) => <Link className="panel admin-link" key={item.to} to={item.to}><h3>{item.title}<span aria-hidden="true">→</span></h3><p>{item.text}</p></Link>)}</div></section>
    </>
  )
}
