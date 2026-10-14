import { useId, useState } from 'react'
import { Alert } from '../Alert'
import { SeletorNota } from './Estrelas'

const LIMITE_COMENTARIO = 1000

// Usado tanto para avaliar um agendamento quanto para editar uma avaliação.
// onSubmit recebe { nota, comentario } e deve lançar o erro da API em caso de falha.
export function FormAvaliacao({ titulo, descricao, inicial, rotuloEnviar, onSubmit, onCancel }) {
  const comentarioId = useId()
  const [nota, setNota] = useState(inicial?.nota ?? 0)
  const [comentario, setComentario] = useState(inicial?.comentario ?? '')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  async function enviar(event) {
    event.preventDefault()
    if (enviando) return
    if (nota < 1 || nota > 5) {
      setErro({ message: 'Escolha uma nota de 1 a 5.', errors: [] })
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await onSubmit({ nota, comentario: comentario.trim() || null })
    } catch (err) {
      setErro({ message: err.message || 'Não foi possível salvar a avaliação.', errors: err.errors ?? [] })
      setEnviando(false)
    }
  }

  return (
    <form className="form review-form" onSubmit={enviar} aria-label={titulo} noValidate>
      <div>
        <h3>{titulo}</h3>
        {descricao && <p className="panel__description">{descricao}</p>}
      </div>
      <SeletorNota value={nota} onChange={(valor) => { setNota(valor); setErro(null) }} disabled={enviando} />
      <div className="field">
        <label className="field__label" htmlFor={comentarioId}>
          Comentário
          <span className="field__hint">Opcional · {comentario.length}/{LIMITE_COMENTARIO}</span>
        </label>
        <div className="field__control">
          <textarea id={comentarioId} rows={3} maxLength={LIMITE_COMENTARIO} value={comentario} disabled={enviando}
            placeholder="Conte como foi o atendimento" onChange={(event) => setComentario(event.target.value)} />
        </div>
      </div>
      {erro && <Alert message={erro.message} errors={erro.errors} />}
      <div className="form-actions">
        <button className="btn btn--primary" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : rotuloEnviar}</button>
        <button className="btn btn--ghost" type="button" onClick={onCancel} disabled={enviando}>Cancelar</button>
      </div>
    </form>
  )
}
