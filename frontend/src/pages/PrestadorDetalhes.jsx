import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import PerfilPrestador from '../components/prestador/PerfilPrestador'
import HorariosPrestador from '../components/prestador/HorariosPrestador'
import DisponibilidadePrestador from '../components/prestador/DisponibilidadePrestador'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

export default function PrestadorDetalhes() {
  const { prestadorId } = useParams()
  const navigate = useNavigate()
  const { payload } = useAuth()
  const [revision, setRevision] = useState(0)
  const refreshAvailability = useCallback(() => setRevision((value) => value + 1), [])

  const load = useCallback((options) => prestadorApi.buscar(prestadorId, options), [prestadorId])
  const { data: perfil, loading, error, retry, update } = useApiResource(load, prestadorId)

  const canManage = payload?.tipo === 'ADMIN' || (payload?.tipo === 'PRESTADOR' && perfil?.usuarioId === payload?.userId)

  return (
    <>
      <Link className="back-link" to="/dashboard">← Voltar aos prestadores</Link>
      {loading ? <p className="loading-state" role="status">Carregando negócio…</p> : error ? (
        <div className="panel"><Alert message={error.status === 404 ? 'Este negócio não foi encontrado.' : error.message} errors={error.errors} /><button className="btn btn--ghost" onClick={retry}>Tentar novamente</button></div>
      ) : perfil && (
        <>
          <div className="page-heading"><h1>{perfil.nomeNegocio}</h1><p>{canManage ? 'Gerencie o negócio e confira a disponibilidade.' : 'Conheça o negócio e os horários de atendimento.'}</p></div>
          <div className="business-grid">
            {canManage ? <PerfilPrestador key={perfil.id} perfil={perfil} onSaved={(value) => { update(value); refreshAvailability() }} onDeleted={() => navigate('/dashboard', { replace: true })} /> : (
              <section className="panel" aria-labelledby="negocio-title">
                <div className="panel__header"><h2 id="negocio-title">Sobre o negócio</h2><span className={`badge${perfil.ativo ? ' badge--active' : ''}`}>{perfil.ativo ? 'Ativo' : 'Inativo'}</span></div>
                <dl className="business-details">
                  {perfil.descricao && <div><dt>Descrição</dt><dd>{perfil.descricao}</dd></div>}
                  <div><dt>Endereço</dt><dd>{perfil.endereco || 'Não informado'}</dd></div>
                  <div><dt>Telefone comercial</dt><dd>{perfil.telefoneComercial || 'Não informado'}</dd></div>
                </dl>
              </section>
            )}
            <HorariosPrestador prestadorId={perfil.id} canManage={canManage} onChange={refreshAvailability} />
          </div>
          <DisponibilidadePrestador prestadorId={perfil.id} ativo={perfil.ativo} revision={revision} />
        </>
      )}
    </>
  )
}
