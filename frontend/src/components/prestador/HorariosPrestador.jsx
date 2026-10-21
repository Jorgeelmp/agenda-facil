import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Field } from '../Field'
import { Alert } from '../Alert'
import { ConfirmDialog, ErrorState, Icon, Loading } from '../ui'
import { useToast } from '../../context/ToastContext'
import { horarioApi } from '../../services/api'
import { useApiResource } from '../../hooks/useApiResource'
import { codigoDiaSemana, DIAS_SEMANA as DIAS, formatarHoraMinutos, hojeEmSaoPaulo, nomeDiaSemana as nomeDia } from '../../utils/datas'

function novoFormulario(diaSemana = '') {
  return { diaSemana, horaInicio: '', horaFim: '', comIntervalo: false, intervaloInicio: '', intervaloFim: '' }
}

function horaEmMinutos(value) {
  const partes = /^(\d{2}):(\d{2})$/.exec(value)
  if (!partes) return null
  const [, horas, minutos] = partes
  if (Number(horas) > 23 || Number(minutos) > 59) return null
  return Number(horas) * 60 + Number(minutos)
}

function validarFormulario(form, horarios, editandoId) {
  const errors = []
  if (!DIAS.some((dia) => dia.value === form.diaSemana)) errors.push('Selecione um dia da semana.')
  if (horarios.some((horario) => horario.diaSemana === form.diaSemana && horario.id !== editandoId)) {
    errors.push('Este dia já possui um horário de funcionamento. Edite o horário existente.')
  }
  const inicio = horaEmMinutos(form.horaInicio)
  const fim = horaEmMinutos(form.horaFim)
  if (inicio === null || fim === null) errors.push('Informe os horários de início e fim do expediente.')
  else if (inicio >= fim) errors.push('O início do expediente deve ser anterior ao fim, no mesmo dia.')

  if (form.comIntervalo) {
    const intervaloInicio = horaEmMinutos(form.intervaloInicio)
    const intervaloFim = horaEmMinutos(form.intervaloFim)
    if (intervaloInicio === null || intervaloFim === null) errors.push('Informe o início e o fim do intervalo.')
    else if (intervaloInicio >= intervaloFim) errors.push('O início do intervalo deve ser anterior ao fim.')
    else if ((inicio !== null && intervaloInicio < inicio) || (fim !== null && intervaloFim > fim)) {
      errors.push('O intervalo deve ficar dentro do expediente.')
    }
  }
  return errors
}

function exibirHora(hora) {
  return formatarHoraMinutos(hora) || '—'
}

function erroDaApi(error, message) {
  return { message: error?.message || message, errors: Array.isArray(error?.errors) ? error.errors : [] }
}

export default function HorariosPrestador({ prestadorId, canManage, onChange }) {
  if (!prestadorId) return null
  return <HorariosDoPrestador key={prestadorId} prestadorId={prestadorId} canManage={canManage} onChange={onChange} />
}

// Semana completa (SEG a DOM): cada dia mostra o expediente ou "Fechado".
// Quem gerencia edita o dia na própria linha (RF03).
function HorariosDoPrestador({ prestadorId, canManage, onChange }) {
  const intervaloId = useId()
  const notify = useToast()
  const carregarHorarios = useCallback((options) => horarioApi.listar(prestadorId, options), [prestadorId])
  const { data, loading, error: loadError, retry, update: atualizarHorarios } = useApiResource(carregarHorarios, prestadorId)
  const horarios = data ?? []
  const listReady = Array.isArray(data)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(novoFormulario)
  const [editandoDia, setEditandoDia] = useState(null)
  const [removendo, setRemovendo] = useState(null)
  const [erroRemocao, setErroRemocao] = useState(null)
  const busyRef = useRef(false)
  const mounted = useRef(false)
  const hoje = codigoDiaSemana(hojeEmSaoPaulo())

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const porDia = new Map(horarios.map((horario) => [horario.diaSemana, horario]))
  const editando = editandoDia ? porDia.get(editandoDia) : null

  function atualizarCampo(event) {
    const { name, value } = event.target
    setForm((atual) => ({ ...atual, [name]: value }))
  }

  function abrirFormulario(diaSemana) {
    if (!canManage || busyRef.current || loading || !listReady) return
    const horario = porDia.get(diaSemana)
    // Dia novo: sugere o expediente de outro dia já cadastrado.
    const modelo = horario ?? horarios[0]
    setError(null)
    setEditandoDia(diaSemana)
    setForm(modelo ? {
      diaSemana,
      horaInicio: formatarHoraMinutos(modelo.horaInicio),
      horaFim: formatarHoraMinutos(modelo.horaFim),
      comIntervalo: Boolean(modelo.intervaloInicio || modelo.intervaloFim),
      intervaloInicio: formatarHoraMinutos(modelo.intervaloInicio),
      intervaloFim: formatarHoraMinutos(modelo.intervaloFim),
    } : novoFormulario(diaSemana))
  }

  function fecharFormulario() {
    setEditandoDia(null)
    setError(null)
  }

  async function salvar(event) {
    event.preventDefault()
    if (!canManage || busyRef.current || loading || !listReady) return
    setError(null)
    const errors = validarFormulario(form, horarios, editando?.id ?? null)
    if (errors.length > 0) {
      setError({ message: 'Revise os horários informados.', errors })
      return
    }
    const horarioId = editando?.id
    const body = {
      diaSemana: form.diaSemana,
      horaInicio: form.horaInicio,
      horaFim: form.horaFim,
      intervaloInicio: form.comIntervalo ? form.intervaloInicio : null,
      intervaloFim: form.comIntervalo ? form.intervaloFim : null,
    }
    busyRef.current = true
    setBusy(true)
    try {
      const salvo = horarioId ? await horarioApi.atualizar(prestadorId, horarioId, body) : await horarioApi.criar(prestadorId, body)
      if (!mounted.current) return
      atualizarHorarios(horarioId ? horarios.map((item) => item.id === horarioId ? salvo : item) : [...horarios, salvo])
      setEditandoDia(null)
      notify(horarioId ? 'Horário de funcionamento atualizado.' : 'Horário de funcionamento cadastrado.')
      onChange?.()
    } catch (err) {
      if (mounted.current) setError(erroDaApi(err, 'Não foi possível salvar o horário.'))
    } finally {
      if (mounted.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  async function excluir() {
    if (!canManage || !removendo || busyRef.current || !listReady) return
    const horarioId = removendo.id
    busyRef.current = true
    setBusy(true)
    setErroRemocao(null)
    try {
      await horarioApi.excluir(prestadorId, horarioId)
      if (!mounted.current) return
      atualizarHorarios(horarios.filter((item) => item.id !== horarioId))
      setRemovendo(null)
      notify('Horário de funcionamento removido.')
      onChange?.()
    } catch (err) {
      if (mounted.current) setErroRemocao(erroDaApi(err, 'Não foi possível remover o horário.'))
    } finally {
      if (mounted.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  return (
    <section className="card" aria-label="Horários de funcionamento">
      <div className="card__header">
        <div>
          <h2>Horários de funcionamento</h2>
          <p>{canManage
            ? 'Defina o expediente e a pausa de cada dia. Os horários livres para os clientes são calculados a partir daqui.'
            : 'Dias e horários de atendimento.'}</p>
        </div>
      </div>

      {loading ? <Loading>Carregando horários de funcionamento…</Loading> : loadError ? (
        <ErrorState error={loadError} onRetry={retry} />
      ) : (
        <ul className="week" aria-label="Expediente por dia da semana">
          {DIAS.map((dia) => {
            const horario = porDia.get(dia.value)
            const aberto = editandoDia === dia.value
            return (
              <li key={dia.value} className={`week__row${dia.value === hoje ? ' is-today' : ''}`}>
                <span className="week__day">{dia.label}</span>
                <span className="week__hours">
                  {horario ? (
                    <>
                      <strong>{exibirHora(horario.horaInicio)} às {exibirHora(horario.horaFim)}</strong>
                      {horario.intervaloInicio
                        ? <span className="week__break">Pausa {exibirHora(horario.intervaloInicio)} às {exibirHora(horario.intervaloFim)}</span>
                        : <span className="week__break">Sem intervalo</span>}
                    </>
                  ) : <span className="week__closed">Fechado</span>}
                </span>
                {canManage && !aberto && (
                  <span className="form-actions">
                    {horario ? (
                      <>
                        <button className="btn btn--ghost btn--sm" type="button" aria-label={`Editar horário de ${dia.label}`} onClick={() => abrirFormulario(dia.value)} disabled={busy || Boolean(editandoDia)}><Icon name="edit" size="sm" />Editar</button>
                        <button className="btn btn--ghost btn--sm" type="button" aria-label={`Remover horário de ${dia.label}`} onClick={() => { setRemovendo(horario); setErroRemocao(null) }} disabled={busy || Boolean(editandoDia)}><Icon name="trash" size="sm" />Remover</button>
                      </>
                    ) : (
                      <button className="btn btn--secondary btn--sm" type="button" aria-label={`Definir horário de ${dia.label}`} onClick={() => abrirFormulario(dia.value)} disabled={busy || Boolean(editandoDia)}><Icon name="plus" size="sm" />Definir horário</button>
                    )}
                  </span>
                )}
                {canManage && aberto && (
                  <form className="form week__editor" onSubmit={salvar} noValidate aria-label={editando ? 'Editar horário de funcionamento' : 'Adicionar horário de funcionamento'}>
                    <h3>{editando ? `Editar expediente de ${dia.label.toLowerCase()}` : `Abrir ${dia.label.toLowerCase()}`}</h3>
                    {error && <Alert type="error" message={error.message} errors={error.errors} />}
                    <div className="form-grid">
                      <Field label="Início do expediente" name="horaInicio" type="time" step="60" value={form.horaInicio} onChange={atualizarCampo} disabled={busy} required />
                      <Field label="Fim do expediente" name="horaFim" type="time" step="60" value={form.horaFim} onChange={atualizarCampo} disabled={busy} required />
                    </div>
                    <label className="field__checkbox" htmlFor={intervaloId}>
                      <input id={intervaloId} type="checkbox" checked={form.comIntervalo} onChange={(event) => setForm((atual) => ({ ...atual, comIntervalo: event.target.checked }))} disabled={busy} />
                      <span>Incluir intervalo de almoço ou pausa</span>
                    </label>
                    {form.comIntervalo && (
                      <div className="form-grid">
                        <Field label="Início do intervalo" name="intervaloInicio" type="time" step="60" value={form.intervaloInicio} onChange={atualizarCampo} disabled={busy} required />
                        <Field label="Fim do intervalo" name="intervaloFim" type="time" step="60" value={form.intervaloFim} onChange={atualizarCampo} disabled={busy} required />
                      </div>
                    )}
                    <div className="form-actions">
                      <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar horário'}</button>
                      <button className="btn btn--ghost" type="button" onClick={fecharFormulario} disabled={busy}>Cancelar</button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && removendo && (
        <ConfirmDialog title={`Remover horário de ${nomeDia(removendo.diaSemana).toLowerCase()}?`} confirmLabel="Confirmar remoção" busyLabel="Removendo…"
          busy={busy} error={erroRemocao} onConfirm={excluir} onClose={() => { setRemovendo(null); setErroRemocao(null) }}>
          Esse dia passa a aparecer como fechado e deixa de oferecer horários disponíveis.
        </ConfirmDialog>
      )}
    </section>
  )
}
