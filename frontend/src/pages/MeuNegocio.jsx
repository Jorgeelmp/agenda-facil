import { useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import PerfilPrestador from '../components/prestador/PerfilPrestador'
import GestaoNegocio from '../components/prestador/GestaoNegocio'
import { ErrorState, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

export default function MeuNegocio() {
  const { payload } = useAuth()

  const load = useCallback((options) => prestadorApi.meuPerfil(options).catch((err) => {
    if (err.status === 404) return null
    throw err
  }), [])
  const { data: perfil, loading, error, retry, update } = useApiResource(load, payload?.userId, { enabled: payload?.tipo === 'PRESTADOR' })

  if (payload?.tipo !== 'PRESTADOR') return <Navigate to="/dashboard" replace />

  return (
    <>
      <PageHeader title="Meu negócio" description={perfil
        ? 'Dados, horários de atendimento e serviços que os clientes veem.'
        : 'Primeiro passo: cadastre seu negócio. Depois você define os horários e os serviços.'} />
      {loading ? <Loading>Carregando seu negócio…</Loading> : error ? (
        <div className="card"><ErrorState error={error} onRetry={retry} /></div>
      ) : perfil ? (
        <GestaoNegocio perfil={perfil} onSaved={update} onDeleted={() => update(null)} />
      ) : (
        <PerfilPrestador key="novo" perfil={null} onSaved={update} />
      )}
    </>
  )
}
