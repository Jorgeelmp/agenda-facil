import { useCallback, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import PerfilPrestador from '../components/prestador/PerfilPrestador'
import HorariosPrestador from '../components/prestador/HorariosPrestador'
import DisponibilidadePrestador from '../components/prestador/DisponibilidadePrestador'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

export default function MeuNegocio() {
  const { payload } = useAuth()
  const [notification, setNotification] = useState('')
  const [revision, setRevision] = useState(0)
  const refreshAvailability = useCallback(() => setRevision((value) => value + 1), [])

  const load = useCallback((options) => prestadorApi.meuPerfil(options).catch((err) => {
    if (err.status === 404) return null
    throw err
  }), [])
  const { data: perfil, loading, error, retry, update } = useApiResource(load, payload?.userId, { enabled: payload?.tipo === 'PRESTADOR' })

  if (payload?.tipo !== 'PRESTADOR') return <Navigate to="/dashboard" replace />

  function saved(value) {
    setNotification(perfil ? '' : 'Perfil do negócio criado.')
    update(value)
    refreshAvailability()
  }

  return (
    <>
      <div className="page-heading">
        <h1>Meu negócio</h1>
        <p>Gerencie seu perfil e os dias em que você atende.</p>
      </div>
      {notification && <Alert type="success" message={notification} />}
      {loading ? <p className="loading-state" role="status">Carregando seu negócio…</p> : error ? (
        <div className="panel"><Alert message={error.message} errors={error.errors} /><button className="btn btn--ghost" onClick={retry}>Tentar novamente</button></div>
      ) : (
        <>
          <div className="business-grid">
            <PerfilPrestador key={perfil?.id ?? 'novo'} perfil={perfil} onSaved={saved} onDeleted={() => { update(null); setNotification('Perfil excluído. Sua conta foi mantida.'); refreshAvailability() }} />
            {perfil ? <HorariosPrestador prestadorId={perfil.id} canManage onChange={refreshAvailability} /> : (
              <section className="panel empty-state"><h2>Seus horários de atendimento</h2><p>Crie o perfil do negócio para cadastrar seus horários.</p></section>
            )}
          </div>
          {perfil && <DisponibilidadePrestador prestadorId={perfil.id} ativo={perfil.ativo} revision={revision} />}
        </>
      )}
    </>
  )
}
