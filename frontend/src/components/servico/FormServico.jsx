import { useId, useState } from 'react'
import { Alert } from '../Alert'
import { Field } from '../Field'
import { servicoApi } from '../../services/api'
import { validarPreco } from './formatos'

export default function FormServico({ prestadorId, servico, categorias, onSaved, onCancel, onBusy, disabled = false }) {
  const [form, setForm] = useState(() => ({
    nome: servico?.nome ?? '', descricao: servico?.descricao ?? '',
    duracaoMinutos: servico?.duracaoMinutos ?? '', preco: servico?.preco ?? '',
    ativo: servico?.ativo ?? true, categoriaIds: servico?.categorias.map((c) => c.id) ?? [],
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const descriptionId = useId()
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function save(event) {
    event.preventDefault()
    if (busy || disabled) return
    setError(null)
    if (!form.nome.trim()) { setError({ message: 'Nome do serviço é obrigatório.' }); return }
    if (!/^\d+$/.test(String(form.duracaoMinutos)) || Number(form.duracaoMinutos) < 1 || Number(form.duracaoMinutos) > 1440) {
      setError({ message: 'Duração deve ser um número inteiro entre 1 e 1440 minutos.' }); return
    }
    if (!validarPreco(form.preco)) { setError({ message: 'Informe um preço de 0 a 99999999,99 com até duas casas decimais.' }); return }
    if (!form.categoriaIds.length) { setError({ message: 'Selecione pelo menos uma categoria.' }); return }
    if (form.categoriaIds.length > 50) { setError({ message: 'Selecione no máximo 50 categorias.' }); return }
    setBusy(true)
    onBusy(true)
    try {
      const body = { ...form, nome: form.nome.trim(), descricao: form.descricao.trim() || null,
        preco: Number(form.preco), duracaoMinutos: Number(form.duracaoMinutos) }
      if (servico) await servicoApi.atualizar(prestadorId, servico.id, body)
      else await servicoApi.criar(prestadorId, body)
      onSaved(servico ? 'Serviço atualizado.' : 'Serviço criado.')
    } catch (err) { setError(err) } finally { setBusy(false); onBusy(false) }
  }

  return (
    <form className="form" onSubmit={save} aria-label={servico ? 'Editar serviço' : 'Novo serviço'}>
      {error && <Alert message={error.message} errors={error.errors} />}
      <fieldset className="form-fields" disabled={busy || disabled}>
        <Field label="Nome do serviço" required maxLength={150} value={form.nome} onChange={(e) => change('nome', e.target.value)} />
        <div className="field"><label className="field__label" htmlFor={descriptionId}>Descrição<span className="field__hint">Opcional</span></label><textarea id={descriptionId} maxLength={500} rows={3} value={form.descricao} onChange={(e) => change('descricao', e.target.value)} /></div>
        <div className="form-grid">
          <Field label="Duração (minutos)" type="number" min="1" max="1440" step="1" required value={form.duracaoMinutos} onChange={(e) => change('duracaoMinutos', e.target.value)} />
          <Field label="Preço (R$)" type="number" min="0" max="99999999.99" step="0.01" required value={form.preco} onChange={(e) => change('preco', e.target.value)} />
        </div>
        {servico && <p className="field__help">Se houver agendamentos vinculados, mantenha a duração. Para oferecer outra duração, crie um novo serviço.</p>}
        <fieldset className="category-choices"><legend>Categorias <span className="field__hint">Selecione uma ou mais</span></legend>
          {categorias.map((c) => <label className="field__checkbox" key={c.id}><input type="checkbox" checked={form.categoriaIds.includes(c.id)} onChange={(e) => change('categoriaIds', e.target.checked ? [...form.categoriaIds, c.id] : form.categoriaIds.filter((id) => id !== c.id))} /><span>{c.nome}</span></label>)}
        </fieldset>
        <label className="field__checkbox"><input type="checkbox" checked={form.ativo} onChange={(e) => change('ativo', e.target.checked)} />Serviço ativo</label>
        <p className="field__help">Serviços inativos ficam fora da busca e não aceitam novos agendamentos.</p>
        <div className="form-actions"><button type="submit" className="btn btn--primary" disabled={!categorias.length}>{busy ? 'Salvando…' : servico ? 'Salvar serviço' : 'Criar serviço'}</button>{onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar edição</button>}</div>
      </fieldset>
    </form>
  )
}
