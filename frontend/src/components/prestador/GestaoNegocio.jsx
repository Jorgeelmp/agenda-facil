import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PerfilPrestador from './PerfilPrestador'
import HorariosPrestador from './HorariosPrestador'
import DisponibilidadePrestador from './DisponibilidadePrestador'
import ServicosNegocio from '../servico/ServicosNegocio'
import { Icon } from '../ui'

const ABAS = [
  { id: 'dados', label: 'Dados do negócio', icon: 'store' },
  { id: 'horarios', label: 'Horários', icon: 'clock' },
  { id: 'servicos', label: 'Serviços', icon: 'sparkles' },
  { id: 'agenda', label: 'Prévia da agenda', icon: 'calendar' },
]

// Tudo que o prestador (ou o admin) configura em um só lugar, separado por abas.
export default function GestaoNegocio({ perfil, onSaved, onDeleted }) {
  const [params, setParams] = useSearchParams()
  const aba = ABAS.some((item) => item.id === params.get('aba')) ? params.get('aba') : 'dados'
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  return (
    <>
      {!perfil.ativo && (
        <p className="alert alert--warning" role="status"><Icon name="alert" />Este negócio está inativo: os clientes não conseguem agendar. Reative em “Dados do negócio”.</p>
      )}
      <nav className="tabs" aria-label="Seções do negócio">
        {ABAS.map((item) => (
          <button key={item.id} type="button" className={`tab${aba === item.id ? ' is-active' : ''}`} aria-current={aba === item.id ? 'page' : undefined}
            onClick={() => setParams(item.id === 'dados' ? {} : { aba: item.id }, { replace: true })}>
            <Icon name={item.icon} size="sm" />{item.label}
          </button>
        ))}
        <Link className="tab" to={`/dashboard/prestadores/${perfil.id}`} style={{ marginLeft: 'auto' }}>Ver página pública<Icon name="arrow-right" size="sm" /></Link>
      </nav>

      {aba === 'dados' && <PerfilPrestador key={perfil.id} perfil={perfil} onSaved={(value) => { onSaved(value); refresh() }} onDeleted={onDeleted} />}
      {aba === 'horarios' && <HorariosPrestador prestadorId={perfil.id} canManage onChange={refresh} />}
      {aba === 'servicos' && <ServicosNegocio prestadorId={perfil.id} ativo={perfil.ativo} onChange={refresh} />}
      {aba === 'agenda' && (
        <div className="stack">
          <p className="notice"><Icon name="info" />É assim que os clientes veem seus horários livres. Os horários vêm do expediente cadastrado, menos as pausas e os agendamentos existentes.</p>
          <DisponibilidadePrestador prestadorId={perfil.id} ativo={perfil.ativo} revision={revision} />
        </div>
      )}
    </>
  )
}
