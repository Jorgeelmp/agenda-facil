import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext({ notify: () => {} })

// Mensagens de confirmação ("Agendamento confirmado.") que somem sozinhas.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const proximoId = useRef(0)

  const remover = useCallback((id) => setToasts((atuais) => atuais.filter((toast) => toast.id !== id)), [])

  const notify = useCallback((message, type = 'success') => {
    const id = ++proximoId.current
    setToasts((atuais) => [...atuais.slice(-2), { id, message, type }])
    setTimeout(() => remover(id), 5000)
  }, [remover])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <p>{toast.message}</p>
            <button type="button" aria-label="Fechar aviso" onClick={() => remover(toast.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext).notify
}
