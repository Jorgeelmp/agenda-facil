import { useId, useMemo } from 'react'
import { formatarDataLonga, formatarHoraMinutos as formatarHora, partesDia, periodoDoDia, proximosDias } from '../../utils/datas'


// Faixa com os próximos dias + campo para escolher qualquer outra data.
export function SeletorDia({ data, hoje, abre = () => true, onChange, disabled = false, mostrarFaixa = true }) {
  const campoId = useId()
  const dias = useMemo(() => proximosDias(hoje), [hoje])
  return (
    <>
      {mostrarFaixa && (
        <div className="day-strip" role="group" aria-label="Próximos dias">
          {dias.map((dia) => {
            const partes = partesDia(dia)
            const aberto = abre(dia)
            return (
              <button key={dia} type="button" className={`day${dia === data ? ' is-selected' : ''}`} disabled={disabled || !aberto}
                aria-pressed={dia === data} aria-label={`${formatarDataLonga(dia)}${aberto ? '' : ' (fechado)'}`} onClick={() => onChange(dia)}>
                <span className="day__dow">{dia === hoje ? 'Hoje' : partes.semana}</span>
                <span className="day__num">{partes.numero}</span>
                <span className="day__month">{partes.mes}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="field" style={{ maxWidth: 260 }}>
        <label className="field__label" htmlFor={campoId}>Data<span className="field__hint">{mostrarFaixa ? 'ou escolha outra data' : 'Horário de Brasília'}</span></label>
        <input id={campoId} name="data" type="date" value={data} min={hoje} max="9999-12-31" required disabled={disabled} onChange={(evento) => onChange(evento.target.value)} />
      </div>
    </>
  )
}

// Horários livres agrupados em manhã/tarde/noite.
export function GradeHorarios({ horarios, selecionado, onSelect, interativo = true, desabilitado = () => false, rotulo = 'Horários livres', sufixo, formatar = formatarHora }) {
  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const item of horarios) {
      const periodo = periodoDoDia(item)
      if (!mapa.has(periodo)) mapa.set(periodo, [])
      mapa.get(periodo).push(item)
    }
    return [...mapa.entries()]
  }, [horarios])

  return (
    <div className="slot-groups">
      {grupos.map(([periodo, itens]) => (
        <div className="slot-group" key={periodo}>
          <span className="slot-group__title">{periodo}</span>
          <ul className="slots" aria-label={`${rotulo} (${periodo.toLowerCase()})`}>
            {itens.map((item) => (
              <li key={item}>
                {interativo ? (
                  <button type="button" className={`slot${selecionado === item ? ' is-selected' : ''}`} aria-pressed={selecionado === item}
                    disabled={desabilitado(item)} onClick={() => onSelect(selecionado === item ? '' : item)}>
                    <time dateTime={item}>{formatar(item)}</time>{sufixo?.(item)}
                  </button>
                ) : (
                  <span className="slot slot--static"><time dateTime={item}>{formatar(item)}</time></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
