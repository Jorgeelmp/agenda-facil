import { useId, useState } from 'react'

export function Field({ label, hint, help, type = 'text', ...props }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      <div className="field__control">
        <input id={id} type={isPassword && visible ? 'text' : type} className={isPassword ? 'has-toggle' : undefined} {...props} />
        {isPassword && (
          <button type="button" className="field__toggle" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {help && <span className="field__help">{help}</span>}
    </div>
  )
}
