import { useTheme } from '../context/ThemeContext'
import { Icon } from './ui'

export function ThemeToggle() {
  const { tema, alternarTema } = useTheme()
  const rotulo = tema === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'
  return (
    <button className="icon-btn" type="button" onClick={alternarTema} aria-label={rotulo} title={rotulo}>
      <Icon name={tema === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
