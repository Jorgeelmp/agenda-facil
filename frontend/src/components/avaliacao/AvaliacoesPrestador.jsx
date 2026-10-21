import { useCallback, useId, useState } from 'react'
import { Avatar, EmptyState, ErrorState, Loading } from '../ui'
import { useApiResource } from '../../hooks/useApiResource'
import { avaliacaoApi } from '../../services/api'
import { Estrelas } from './Estrelas'
import { formatarData, formatarNota, totalAvaliacoes } from './formatos'

const POR_PAGINA = 5

// Painel público (qualquer usuário logado) com a nota média e as avaliações do prestador (RF10).
export default function AvaliacoesPrestador({ prestadorId }) {
  const tituloId = useId()
  const [limite, setLimite] = useState(POR_PAGINA)
  const carregar = useCallback((options) => Promise.all([
    avaliacaoApi.media(prestadorId, options),
    avaliacaoApi.doPrestador(prestadorId, options),
  ]), [prestadorId])
  const { data, loading, error, retry } = useApiResource(carregar, `avaliacoes:${prestadorId}`)
  const [resumo, avaliacoes] = data ?? [null, []]
  const temNota = resumo?.notaMedia !== null && resumo?.notaMedia !== undefined
  const distribuicao = [5, 4, 3, 2, 1].map((nota) => [nota, avaliacoes.filter((item) => item.nota === nota).length])

  return (
    <section className="card" aria-labelledby={tituloId}>
      <div className="card__header">
        <div>
          <h2 id={tituloId}>Avaliações</h2>
          <p>O que os clientes acharam dos atendimentos concluídos.</p>
        </div>
      </div>

      {loading ? <Loading>Carregando avaliações…</Loading> : error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : avaliacoes.length === 0 ? (
        <EmptyState icon="star" compact>Este negócio ainda não recebeu avaliações.</EmptyState>
      ) : (
        <>
          {temNota && (
            <div className="grid-2" style={{ gap: 20, alignItems: 'center' }}>
              <div className="rating-summary" aria-label="Nota média">
                <strong className="rating-summary__value">{formatarNota(resumo.notaMedia)}</strong>
                <div>
                  <Estrelas nota={resumo.notaMedia} rotulo={`Nota média ${formatarNota(resumo.notaMedia)} de 5`} />
                  <span className="cell-sub">{totalAvaliacoes(resumo.totalAvaliacoes)}</span>
                </div>
              </div>
              <div className="rating-bars" aria-hidden="true">
                {distribuicao.map(([nota, total]) => (
                  <div className="rating-bar" key={nota}>
                    <span>{nota}</span>
                    <span className="rating-bar__track"><span className="rating-bar__fill" style={{ display: 'block', width: `${(total / avaliacoes.length) * 100}%` }} /></span>
                    <span>{total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ul className="reviews" aria-label="Avaliações do negócio">
            {avaliacoes.slice(0, limite).map((avaliacao) => (
              <li key={avaliacao.id} className="review">
                <div className="review__head">
                  <div className="review__author">
                    <Avatar nome={avaliacao.clienteNome} />
                    <div><strong>{avaliacao.clienteNome}</strong><span>{avaliacao.servicoNome} · {formatarData(avaliacao.dataAvaliacao)}</span></div>
                  </div>
                  <Estrelas nota={avaliacao.nota} />
                </div>
                {avaliacao.comentario && <p className="review__comment">{avaliacao.comentario}</p>}
              </li>
            ))}
          </ul>
          {avaliacoes.length > limite && (
            <div className="load-more"><button className="btn btn--secondary" type="button" onClick={() => setLimite((v) => v + 10)}>Ver mais avaliações ({avaliacoes.length - limite})</button></div>
          )}
        </>
      )}
    </section>
  )
}
