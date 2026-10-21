import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CHAVE = 'agenda.tema'
const ThemeContext = createContext({ tema: 'light', alternarTema: () => {} })

function temaSalvo() {
  try {
    const valor = localStorage.getItem(CHAVE)
    if (valor === 'light' || valor === 'dark') return valor
  } catch {
    // armazenamento indisponível (aba anônima, bloqueio de cookies)
  }
  return null
}

function temaDoSistema() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Tema claro/escuro: segue o sistema até a pessoa escolher; a escolha fica salva neste navegador.
export function ThemeProvider({ children }) {
  const [escolhido, setEscolhido] = useState(temaSalvo)
  const [sistema, setSistema] = useState(temaDoSistema)
  const tema = escolhido ?? sistema

  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!consulta) return undefined
    const mudar = (evento) => setSistema(evento.matches ? 'dark' : 'light')
    consulta.addEventListener('change', mudar)
    return () => consulta.removeEventListener('change', mudar)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = tema
  }, [tema])

  const alternarTema = useCallback(() => {
    const proximo = tema === 'dark' ? 'light' : 'dark'
    setEscolhido(proximo)
    try {
      localStorage.setItem(CHAVE, proximo)
    } catch {
      // sem armazenamento: vale só para esta sessão
    }
  }, [tema])

  const value = useMemo(() => ({ tema, alternarTema }), [tema, alternarTema])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
