import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import HorariosPrestador from '../components/prestador/HorariosPrestador'
import DisponibilidadePrestador from '../components/prestador/DisponibilidadePrestador'
import AvaliacoesPrestador from '../components/avaliacao/AvaliacoesPrestador'
import { NotaInline } from '../components/avaliacao/NotaInline'
import { Avatar, ErrorState, Icon, Loading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { prestadorApi } from '../services/api'
import { useApiResource } from '../hooks/useApiResource'

// Página pública do negócio: quem é, quando atende, como agendar e o que dizem os clientes.
export default function PrestadorDetalhes() {
  const { prestadorId } = useParams()
  const [params] = useSearchParams()
  const { payload } = useAuth()

  const load = useCallback((options) => prestadorApi.buscar(prestadorId, options), [prestadorId])
  const { data: perfil, loading, error, retry } = useApiResource(load, prestadorId)

  const dono = payload?.tipo === 'PRESTADOR' && perfil?.usuarioId === payload?.userId
  const canManage = payload?.tipo === 'ADMIN' || dono
  const voltar = <Link className="back-link" to="/dashboard/prestadores"><Icon name="arrow-left" size="sm" />Voltar aos prestadores</Link>

  if (loading) return <>{voltar}<Loading>Carregando negócio…</Loading></>
  if (error) return <>{voltar}<div className="card"><ErrorState message={error.status === 404 ? 'Este negócio não foi encontrado.' : error.message} error={error} onRetry={retry} /></div></>
  if (!perfil) return null

  return (
    <>
      {voltar}
      <section className="card">
        <div className="profile-head">
          <Avatar nome={perfil.nomeNegocio} size="lg" />
          <div>
            <div className="appt__title">
              <h1>{perfil.nomeNegocio}</h1>
              <span className={`badge ${perfil.ativo ? 'badge--active' : 'badge--inactive'}`}>{perfil.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="profile-meta">
              <NotaInline prestadorId={perfil.id} />
              <span><Icon name="pin" size="sm" />{perfil.endereco || 'Endereço não informado'}</span>
              <span><Icon name="phone" size="sm" />{perfil.telefoneComercial || 'Telefone não informado'}</span>
            </div>
          </div>
          {canManage && (
            <Link className="btn btn--secondary" to={dono ? '/dashboard/meu-negocio' : `/dashboard/prestadores/${perfil.id}/gerenciar`}>
              <Icon name="settings" size="sm" />Gerenciar negócio
            </Link>
          )}
        </div>
        {perfil.descricao && <p className="muted">{perfil.descricao}</p>}
      </section>

      <div className="layout-2">
        <DisponibilidadePrestador prestadorId={perfil.id} ativo={perfil.ativo} servicoInicial={params.get('servico') ?? ''} />
        <aside>
          <HorariosPrestador prestadorId={perfil.id} canManage={false} />
        </aside>
      </div>
      <AvaliacoesPrestador prestadorId={perfil.id} />
    </>
  )
}
