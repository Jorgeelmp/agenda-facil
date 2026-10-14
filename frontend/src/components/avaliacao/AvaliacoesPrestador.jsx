import { useCallback, useId } from 'react'
import { Alert } from '../Alert'
import { useApiResource } from '../../hooks/useApiResource'
import { avaliacaoApi } from '../../services/api'
import { Estrelas } from './Estrelas'
import { formatarData, formatarNota, totalAvaliacoes } from './formatos'

// Painel público (qualquer usuário logado) com a nota média e as avaliações do prestador (RF10).
export default function AvaliacoesPrestador({ prestadorId }) {
  const tituloId = useId()
  const carregar = useCallback((options) => Promise.all([
    avaliacaoApi.media(prestadorId, options),
    avaliacaoApi.doPrestador(prestadorId, options),
  ]), [prestadorId])
  const { data, loading, error, retry } = useApiResource(carregar, `avaliacoes:${prestadorId}`)
  const [resumo, avaliacoes] = data ?? [null, []]
  const temNota = resumo?.notaMedia !== null && resumo?.notaMedia !== undefined

  return (
    <section className="panel reviews-panel" aria-labelledby={tituloId}>
      <header className="panel__header">
        <div>
          <h2 id={tituloId}>Avaliações</h2>
          <p className="panel__description">O que os clientes acharam dos atendimentos concluídos.</p>
        </div>
        {temNota && (
          <div className="rating-summary" aria-label="Nota média">
            <strong className="rating-summary__value">{formatarNota(resumo.notaMedia)}</strong>
            <div>
              <Estrelas nota={resumo.notaMedia} rotulo={`Nota média ${formatarNota(resumo.notaMedia)} de 5`} />
              <span className="cell-sub">{totalAvaliacoes(resumo.totalAvaliacoes)}</span>
            </div>
          </div>
        )}
      </header>

      {loading ? <p className="loading-state" role="status">Carregando avaliações…</p> : error ? (
        <><Alert message={error.message} errors={error.errors} /><button className="btn btn--ghost" onClick={retry}>Tentar novamente</button></>
      ) : avaliacoes.length === 0 ? (
        <p className="empty-state">Este negócio ainda não recebeu avaliações.</p>
      ) : (
        <ul className="review-list" aria-label="Avaliações do negócio">
          {avaliacoes.map((avaliacao) => (
            <li key={avaliacao.id} className="review">
              <div className="review__head">
                <Estrelas nota={avaliacao.nota} />
                <span className="cell-sub">{formatarData(avaliacao.dataAvaliacao)}</span>
              </div>
              {avaliacao.comentario && <p className="review__comment">{avaliacao.comentario}</p>}
              <p className="cell-sub">{avaliacao.clienteNome} · {avaliacao.servicoNome}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
