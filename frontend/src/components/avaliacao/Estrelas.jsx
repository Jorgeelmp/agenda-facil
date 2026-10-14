import { useId, useState } from 'react'
import { ROTULOS_NOTA } from './formatos'

const NOTAS = [1, 2, 3, 4, 5]

// Exibição somente leitura. Médias fracionadas (ex.: 4.3) acendem a quantidade arredondada.
export function Estrelas({ nota, rotulo }) {
  const acesas = Math.round(Number(nota) || 0)
  return (
    <span className="rating" role="img" aria-label={rotulo ?? `Nota ${nota} de 5`}>
      {NOTAS.map((valor) => (
        <span key={valor} aria-hidden="true" className={`rating__star${valor <= acesas ? ' is-on' : ''}`}>★</span>
      ))}
    </span>
  )
}

// Escolha da nota com radios reais: funciona com teclado (setas) e leitores de tela.
export function SeletorNota({ value, onChange, disabled }) {
  const nome = useId()
  const [destaque, setDestaque] = useState(0)
  const visivel = destaque || value

  return (
    <fieldset className="rating-input" disabled={disabled}>
      <legend className="field__label">Nota</legend>
      <div className="rating-input__row" onMouseLeave={() => setDestaque(0)}>
        {NOTAS.map((valor) => (
          <label key={valor} className={`rating-input__star${valor <= visivel ? ' is-on' : ''}`}
            onMouseEnter={() => setDestaque(valor)}>
            <input type="radio" name={nome} value={valor} checked={value === valor}
              onChange={() => onChange(valor)} aria-label={`${valor} de 5 (${ROTULOS_NOTA[valor]})`} />
            <span aria-hidden="true">★</span>
          </label>
        ))}
        <span className="rating-input__label" aria-hidden="true">{visivel ? ROTULOS_NOTA[visivel] : 'Escolha de 1 a 5'}</span>
      </div>
    </fieldset>
  )
}
