import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Field } from '../Field'
import { Alert } from '../Alert'
import { horarioApi } from '../../services/api'
import { useApiResource } from '../../hooks/useApiResource'

const DIAS = [
  { value: 'SEG', label: 'Segunda-feira' },
  { value: 'TER', label: 'Terça-feira' },
  { value: 'QUA', label: 'Quarta-feira' },
  { value: 'QUI', label: 'Quinta-feira' },
  { value: 'SEX', label: 'Sexta-feira' },
  { value: 'SAB', label: 'Sábado' },
  { value: 'DOM', label: 'Domingo' },
]

function novoFormulario(diaSemana = '') {
  return { diaSemana, horaInicio: '', horaFim: '', comIntervalo: false, intervaloInicio: '', intervaloFim: '' }
}

function horaEmMilissegundos(value) {
  const partes = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)
  if (!partes) return null
  const [, horas, minutos, segundos = '0', fracao = ''] = partes
  if (Number(horas) > 23 || Number(minutos) > 59 || Number(segundos) > 59) return null
  return ((Number(horas) * 60 + Number(minutos)) * 60 + Number(segundos)) * 1000 + Number(fracao.padEnd(3, '0'))
}

function validarFormulario(form, horarios, editandoId) {
  const errors = []
  if (!DIAS.some((dia) => dia.value === form.diaSemana)) errors.push('Selecione um dia da semana.')
  if (horarios.some((horario) => horario.diaSemana === form.diaSemana && horario.id !== editandoId)) {
    errors.push('Este dia já possui um horário de funcionamento. Edite o horário existente.')
  }
  const inicio = horaEmMilissegundos(form.horaInicio)
  const fim = horaEmMilissegundos(form.horaFim)
  if (inicio === null || fim === null) errors.push('Informe os horários de início e fim do expediente.')
  else if (inicio >= fim) errors.push('O início do expediente deve ser anterior ao fim, no mesmo dia.')

  if (form.comIntervalo) {
    const intervaloInicio = horaEmMilissegundos(form.intervaloInicio)
    const intervaloFim = horaEmMilissegundos(form.intervaloFim)
    if (intervaloInicio === null || intervaloFim === null) errors.push('Informe o início e o fim do intervalo.')
    else if (intervaloInicio >= intervaloFim) errors.push('O início do intervalo deve ser anterior ao fim.')
    else if ((inicio !== null && intervaloInicio < inicio) || (fim !== null && intervaloFim > fim)) {
      errors.push('O intervalo deve ficar dentro do expediente.')
    }
  }
  return errors
}

function nomeDia(diaSemana) {
  return DIAS.find((dia) => dia.value === diaSemana)?.label ?? diaSemana
}

function exibirHora(hora) {
  if (!hora) return '—'
  return /^\d{2}:\d{2}:00(?:\.0+)?$/.test(hora) ? hora.slice(0, 5) : hora
}

function erroDaApi(error, message) {
  return { message: error?.message || message, errors: Array.isArray(error?.errors) ? error.errors : [] }
}

export default function HorariosPrestador({ prestadorId, canManage, onChange }) {
  if (!prestadorId) return null
  return <HorariosDoPrestador key={prestadorId} prestadorId={prestadorId} canManage={canManage} onChange={onChange} />
}

function HorariosDoPrestador({ prestadorId, canManage, onChange }) {
  const diaId = useId()
  const intervaloId = useId()
  const carregarHorarios = useCallback((options) => horarioApi.listar(prestadorId, options), [prestadorId])
  const { data, loading, error: loadError, retry, update: atualizarHorarios } = useApiResource(carregarHorarios, prestadorId)
  const horarios = data ?? []
  const listReady = Array.isArray(data)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(novoFormulario)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [removendo, setRemovendo] = useState(null)
  const busyRef = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const carregando = loading
  const horariosAtuais = horarios
  const displayedError = error ?? loadError
  const ordenados = [...horariosAtuais].sort((a, b) => DIAS.findIndex((dia) => dia.value === a.diaSemana) - DIAS.findIndex((dia) => dia.value === b.diaSemana))
  const diasLivres = DIAS.filter((dia) => !horariosAtuais.some((horario) => horario.diaSemana === dia.value && horario.id !== editandoId))

  function atualizarCampo(event) {
    const { name, value } = event.target
    setForm((atual) => ({ ...atual, [name]: value }))
  }

  function abrirFormulario(horario) {
    if (!canManage || busyRef.current || carregando || !listReady) return
    setError(null)
    setSuccess('')
    setRemovendo(null)
    setEditandoId(horario?.id ?? null)
    setForm(horario ? {
      diaSemana: horario.diaSemana,
      horaInicio: horario.horaInicio,
      horaFim: horario.horaFim,
      comIntervalo: Boolean(horario.intervaloInicio || horario.intervaloFim),
      intervaloInicio: horario.intervaloInicio ?? '',
      intervaloFim: horario.intervaloFim ?? '',
    } : novoFormulario(DIAS.find((dia) => !horariosAtuais.some((item) => item.diaSemana === dia.value))?.value))
    setFormAberto(true)
  }

  async function salvar(event) {
    event.preventDefault()
    if (!canManage || busyRef.current || carregando || !listReady || !prestadorId) return
    setError(null)
    setSuccess('')
    const errors = validarFormulario(form, horariosAtuais, editandoId)
    if (errors.length > 0) {
      setError({ message: 'Revise os horários informados.', errors })
      return
    }
    const id = prestadorId
    const horarioId = editandoId
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
      const salvo = horarioId ? await horarioApi.atualizar(id, horarioId, body) : await horarioApi.criar(id, body)
      if (!mounted.current) return
      atualizarHorarios(horarioId ? horariosAtuais.map((item) => item.id === horarioId ? salvo : item) : [...horariosAtuais, salvo])
      setFormAberto(false)
      setEditandoId(null)
      setSuccess(horarioId ? 'Horário de funcionamento atualizado.' : 'Horário de funcionamento cadastrado.')
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
    if (!canManage || !removendo || busyRef.current || !listReady || !prestadorId) return
    const id = prestadorId
    const horarioId = removendo.id
    busyRef.current = true
    setBusy(true)
    setError(null)
    setSuccess('')
    try {
      await horarioApi.excluir(id, horarioId)
      if (!mounted.current) return
      atualizarHorarios(horariosAtuais.filter((item) => item.id !== horarioId))
      setRemovendo(null)
      setSuccess('Horário de funcionamento removido.')
      onChange?.()
    } catch (err) {
      if (mounted.current) setError(erroDaApi(err, 'Não foi possível remover o horário.'))
    } finally {
      if (mounted.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  return (
    <section className="panel" aria-label="Horários de funcionamento">
      <div className="panel__header">
        <div>
          <h2>Horários de funcionamento</h2>
          <p className="panel__description">{canManage
            ? 'Defina o expediente e o intervalo de cada dia para calcular os horários disponíveis.'
            : 'Confira os dias e os horários de atendimento deste negócio.'}</p>
        </div>
        {canManage && !formAberto && horariosAtuais.length < DIAS.length && (
          <button className="btn btn--primary" type="button" onClick={() => abrirFormulario()} disabled={carregando || busy || !listReady}>Adicionar dia</button>
        )}
      </div>

      {displayedError && <Alert type="error" message={displayedError.message} errors={displayedError.errors} />}
      {success && <Alert type="success" message={success} />}

      {carregando ? (
        <p className="empty-state" role="status">Carregando horários de funcionamento…</p>
      ) : (
        <>
          {displayedError && !formAberto && !removendo && (
            <div className="form-actions">
              <button className="btn btn--ghost" type="button" onClick={() => { setError(null); retry() }} disabled={busy}>Tentar novamente</button>
            </div>
          )}
          {ordenados.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table" aria-label="Expediente por dia da semana">
                <thead>
                  <tr>
                    <th scope="col">Dia</th>
                    <th scope="col">Expediente</th>
                    <th scope="col">Intervalo</th>
                    {canManage && <th scope="col">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((horario) => (
                    <tr key={horario.id}>
                      <th scope="row">{nomeDia(horario.diaSemana)}</th>
                      <td>{exibirHora(horario.horaInicio)} às {exibirHora(horario.horaFim)}</td>
                      <td>{horario.intervaloInicio ? `${exibirHora(horario.intervaloInicio)} às ${exibirHora(horario.intervaloFim)}` : <span className="badge">Sem intervalo</span>}</td>
                      {canManage && (
                        <td>
                          <div className="form-actions">
                            <button className="btn btn--ghost" type="button" aria-label={`Editar horário de ${nomeDia(horario.diaSemana)}`} onClick={() => abrirFormulario(horario)} disabled={busy || formAberto || !listReady}>Editar</button>
                            <button className="btn btn--danger" type="button" aria-label={`Remover horário de ${nomeDia(horario.diaSemana)}`} onClick={() => { setRemovendo(horario); setError(null); setSuccess('') }} disabled={busy || formAberto || !listReady}>Remover</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !displayedError && <p className="empty-state">Nenhum horário de funcionamento cadastrado.</p>}

          {canManage && removendo && (
            <div className="empty-state" role="alert">
              <p>Remover o horário de {nomeDia(removendo.diaSemana)}? Esse dia deixará de oferecer horários disponíveis.</p>
              <div className="form-actions">
                <button className="btn btn--danger" type="button" onClick={excluir} disabled={busy}>{busy ? 'Removendo…' : 'Confirmar remoção'}</button>
                <button className="btn btn--ghost" type="button" onClick={() => { setRemovendo(null); setError(null) }} disabled={busy}>Cancelar</button>
              </div>
            </div>
          )}

          {canManage && formAberto && (
            <form className="form" onSubmit={salvar} noValidate aria-label={editandoId ? 'Editar horário de funcionamento' : 'Adicionar horário de funcionamento'}>
              <h3>{editandoId ? 'Editar expediente' : 'Novo expediente'}</h3>
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor={diaId}>Dia da semana</label>
                  <div className="field__control">
                    <select id={diaId} name="diaSemana" value={form.diaSemana} onChange={atualizarCampo} required disabled={busy}>
                      <option value="">Selecione o dia</option>
                      {DIAS.map((dia) => <option key={dia.value} value={dia.value} disabled={!diasLivres.some((livre) => livre.value === dia.value)}>{dia.label}</option>)}
                    </select>
                  </div>
                  <span className="field__help">Cada dia pode ter um expediente. Dias cadastrados ficam indisponíveis nesta lista.</span>
                </div>
                <Field label="Início do expediente" name="horaInicio" type="time" step="0.001" value={form.horaInicio} onChange={atualizarCampo} disabled={busy} required />
                <Field label="Fim do expediente" name="horaFim" type="time" step="0.001" value={form.horaFim} onChange={atualizarCampo} disabled={busy} required />
              </div>
              <div className="field">
                <label className="field__checkbox" htmlFor={intervaloId}>
                  <input id={intervaloId} type="checkbox" checked={form.comIntervalo} onChange={(event) => setForm((atual) => ({ ...atual, comIntervalo: event.target.checked }))} disabled={busy} />
                  <span>Incluir intervalo de almoço ou pausa</span>
                </label>
              </div>
              {form.comIntervalo && (
                <div className="form-grid">
                  <Field label="Início do intervalo" name="intervaloInicio" type="time" step="0.001" value={form.intervaloInicio} onChange={atualizarCampo} disabled={busy} required />
                  <Field label="Fim do intervalo" name="intervaloFim" type="time" step="0.001" value={form.intervaloFim} onChange={atualizarCampo} disabled={busy} required />
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar horário'}</button>
                <button className="btn btn--ghost" type="button" onClick={() => { setFormAberto(false); setEditandoId(null); setError(null) }} disabled={busy}>Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
