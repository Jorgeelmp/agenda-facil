import { useCallback } from 'react'
import { Icon } from '../ui'
import { useApiResource } from '../../hooks/useApiResource'
import { avaliacaoApi } from '../../services/api'
import { formatarNota } from './formatos'

// "★ 4,6 (32)" ao lado do nome do negócio; "Sem avaliações" quando ainda não há notas.
export function NotaInline({ prestadorId }) {
  const carregar = useCallback((options) => avaliacaoApi.media(prestadorId, options), [prestadorId])
  const { data } = useApiResource(carregar, `media:${prestadorId}`)
  if (!data) return null
  if (data.notaMedia === null || data.notaMedia === undefined) return <span className="rating-inline">Sem avaliações</span>
  return (
    <span className="rating-inline" aria-label={`Nota média ${formatarNota(data.notaMedia)} de 5, ${data.totalAvaliacoes} avaliações`}>
      <Icon name="star" /><strong>{formatarNota(data.notaMedia)}</strong>({data.totalAvaliacoes})
    </span>
  )
}
