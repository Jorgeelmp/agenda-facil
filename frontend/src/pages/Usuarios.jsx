import { useCallback, useId, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Field } from '../components/Field'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { usuarioApi } from '../services/api'

const perfis = { CLIENTE: 'Cliente', PRESTADOR: 'Prestador', ADMIN: 'Administrador' }
const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

export default function Usuarios() {
  const { payload } = useAuth()
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('todos')
  const tipoId = useId()
  const load = useCallback((options) => usuarioApi.listar(options), [])
  const resource = useApiResource(load, 'usuarios', { enabled: payload?.tipo === 'ADMIN' })
  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard" replace />
  const usuarios = resource.data ?? []
  const termo = search.trim().toLocaleLowerCase('pt-BR')
  const encontrados = usuarios.filter((u) => (tipo === 'todos' || u.tipo === tipo)
    && (!termo || `${u.nome} ${u.email}`.toLocaleLowerCase('pt-BR').includes(termo)))

  return (
    <>
      <div className="page-heading"><h1>Usuários</h1><p>Consulte todas as contas cadastradas no sistema.</p></div>
      <div className="directory-filters">
        <Field label="Buscar usuário" type="search" placeholder="Nome ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="field"><label className="field__label" htmlFor={tipoId}>Perfil de acesso</label><select id={tipoId} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="todos">Todos os perfis</option>{Object.entries(perfis).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      </div>
      {resource.loading ? <p className="loading-state" role="status">Carregando usuários…</p> : resource.error ? <div className="panel"><Alert message={resource.error.message} errors={resource.error.errors} /><button className="btn btn--ghost" onClick={resource.retry}>Tentar novamente</button></div> : (
        <section className="panel" aria-label="Usuários cadastrados">
          <div className="panel__header"><h2>Contas cadastradas</h2><span className="badge" role="status">{encontrados.length} de {usuarios.length} usuários</span></div>
          {encontrados.length ? <div className="table-wrap"><table className="data-table" aria-label="Lista de usuários"><thead><tr><th scope="col">Nome</th><th scope="col">Email</th><th scope="col">Perfil</th><th scope="col">Telefone</th><th scope="col">Cadastro</th></tr></thead><tbody>{encontrados.map((u) => <tr key={u.id}><th scope="row" className="cell-wrap">{u.nome}</th><td className="cell-wrap">{u.email}</td><td><span className={`badge${u.tipo === 'ADMIN' ? ' badge--active' : ''}`}>{perfis[u.tipo] ?? u.tipo}</span></td><td>{u.telefone || 'Não informado'}</td><td>{u.criadoEm ? formatoData.format(new Date(u.criadoEm)) : 'Não informado'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>Nenhum usuário encontrado</h2><p>{usuarios.length ? 'Altere a busca ou o perfil selecionado.' : 'As contas cadastradas aparecerão aqui.'}</p></div>}
        </section>
      )}
    </>
  )
}
