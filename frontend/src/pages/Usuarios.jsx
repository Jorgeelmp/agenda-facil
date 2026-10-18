import { useCallback, useId, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar, ConfirmDialog, EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { usuarioApi } from '../services/api'
import { PERFIS as perfis } from '../utils/status'

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
const POR_PAGINA = 50

export default function Usuarios() {
  const { payload } = useAuth()
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('todos')
  const [limite, setLimite] = useState(POR_PAGINA)
  const tipoId = useId()
  const notify = useToast()
  const [excluindo, setExcluindo] = useState(null)
  const [erroExclusao, setErroExclusao] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback((options) => usuarioApi.listar(options), [])
  const resource = useApiResource(load, 'usuarios', { enabled: payload?.tipo === 'ADMIN' })
  if (payload?.tipo !== 'ADMIN') return <Navigate to="/dashboard" replace />
  const usuarios = resource.data ?? []
  const termo = search.trim().toLocaleLowerCase('pt-BR')
  async function excluir() {
    setBusy(true)
    setErroExclusao(null)
    try {
      await usuarioApi.excluir(excluindo.id)
      resource.update(usuarios.filter((u) => u.id !== excluindo.id))
      notify(`Conta de ${excluindo.nome} excluída.`)
      setExcluindo(null)
    } catch (err) {
      setErroExclusao(err)
      if (err.status === 404) resource.retry()
    } finally {
      setBusy(false)
    }
  }

  const encontrados = usuarios.filter((u) => (tipo === 'todos' || u.tipo === tipo)
    && (!termo || `${u.nome} ${u.email}`.toLocaleLowerCase('pt-BR').includes(termo)))

  return (
    <>
      <PageHeader title="Usuários" description="Consulte todas as contas cadastradas no sistema." />
      <div className="toolbar">
        <div className="field" style={{ flex: '2 1 260px' }}>
          <label className="field__label" htmlFor="buscar-usuario">Buscar usuário</label>
          <div className="field__control search">
            <Icon name="search" size="sm" />
            <input id="buscar-usuario" type="search" placeholder="Nome ou email" value={search} onChange={(e) => { setSearch(e.target.value); setLimite(POR_PAGINA) }} />
          </div>
        </div>
        <div className="field" style={{ flex: '0 1 200px' }}>
          <label className="field__label" htmlFor={tipoId}>Perfil de acesso</label>
          <select id={tipoId} value={tipo} onChange={(e) => { setTipo(e.target.value); setLimite(POR_PAGINA) }}>
            <option value="todos">Todos os perfis</option>
            {Object.entries(perfis).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>
      {resource.loading ? <Loading>Carregando usuários…</Loading> : resource.error ? <div className="card"><ErrorState error={resource.error} onRetry={resource.retry} /></div> : (
        <section className="card card--flush" aria-label="Usuários cadastrados">
          <div className="card__header"><div><h2>Contas cadastradas</h2></div><span className="badge badge--plain" role="status">{encontrados.length} de {usuarios.length} usuários</span></div>
          {encontrados.length ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Lista de usuários">
                <thead><tr><th scope="col">Nome</th><th scope="col">Email</th><th scope="col">Perfil</th><th scope="col">Telefone</th><th scope="col">Cadastro</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {encontrados.slice(0, limite).map((u) => (
                    <tr key={u.id}>
                      <th scope="row" className="cell-wrap"><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar nome={u.nome} />{u.nome}</span></th>
                      <td className="cell-wrap">{u.email}</td>
                      <td><span className={`badge badge--plain${u.tipo === 'ADMIN' ? ' badge--primary' : ''}`}>{perfis[u.tipo] ?? u.tipo}</span></td>
                      <td className="nowrap">{u.telefone || 'Não informado'}</td>
                      <td className="nowrap">{u.criadoEm ? formatoData.format(new Date(u.criadoEm)) : 'Não informado'}</td>
                      <td>
                        {u.id === payload.userId ? <span className="subtle">Você</span> : (
                          <button className="btn btn--ghost btn--sm" type="button" disabled={busy} aria-label={`Excluir ${u.nome}`}
                            onClick={() => { setErroExclusao(null); setExcluindo(u) }}><Icon name="trash" size="sm" />Excluir</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="users" title="Nenhum usuário encontrado">{usuarios.length ? 'Altere a busca ou o perfil selecionado.' : 'As contas cadastradas aparecerão aqui.'}</EmptyState>
          )}
          {encontrados.length > limite && <div className="load-more" style={{ padding: 16 }}><button className="btn btn--secondary" type="button" onClick={() => setLimite((v) => v + POR_PAGINA)}>Mostrar mais ({encontrados.length - limite} restantes)</button></div>}
        </section>
      )}

      {excluindo && (
        <ConfirmDialog title={`Excluir a conta de ${excluindo.nome}?`} confirmLabel="Confirmar exclusão" busyLabel="Excluindo…"
          busy={busy} error={erroExclusao} onConfirm={excluir} onClose={() => setExcluindo(null)}>
          A conta {excluindo.email} será removida e não poderá mais entrar. Contas com agendamentos ou com negócio cadastrado não podem ser excluídas, para preservar o histórico.
        </ConfirmDialog>
      )}
    </>
  )
}
