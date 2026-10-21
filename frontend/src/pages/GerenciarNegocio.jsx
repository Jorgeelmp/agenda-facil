import { useCallback } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import GestaoNegocio from '../components/prestador/GestaoNegocio'
import { EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

// Gestão de um negócio pelo id: usada pelo administrador (o prestador usa "Meu negócio").
export default function GerenciarNegocio() {
  const { prestadorId } = useParams()
  const navigate = useNavigate()
  const { payload } = useAuth()
  const podeTentar = ['PRESTADOR', 'ADMIN'].includes(payload?.tipo)
  const load = useCallback((options) => prestadorApi.buscar(prestadorId, options), [prestadorId])
  const { data: perfil, loading, error, retry, update } = useApiResource(load, prestadorId, { enabled: podeTentar })

  const voltar = <Link className="back-link" to={`/dashboard/prestadores/${prestadorId}`}><Icon name="arrow-left" size="sm" />Voltar ao negócio</Link>
  const dono = payload?.tipo === 'PRESTADOR' && perfil?.usuarioId === payload?.userId
  if (dono) return <Navigate to="/dashboard/meu-negocio" replace />

  if (!podeTentar || (perfil && payload?.tipo !== 'ADMIN')) {
    return (
      <>
        {voltar}
        <div className="card">
          <EmptyState icon="shield" title="Acesso restrito" actions={<Link className="btn btn--secondary" to="/dashboard/servicos">Ver serviços</Link>}>
            Você não tem permissão para gerenciar este negócio.
          </EmptyState>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader back={voltar} title={perfil ? `Gerenciar ${perfil.nomeNegocio}` : 'Gerenciar negócio'} description="Dados, horários e serviços do negócio." />
      {loading ? <Loading>Carregando negócio…</Loading> : error ? (
        <div className="card"><ErrorState message={error.status === 404 ? 'Este negócio não foi encontrado.' : error.message} error={error} onRetry={retry} /></div>
      ) : perfil && (
        <GestaoNegocio perfil={perfil} onSaved={update} onDeleted={() => navigate('/dashboard/prestadores', { replace: true })} />
      )}
    </>
  )
}
