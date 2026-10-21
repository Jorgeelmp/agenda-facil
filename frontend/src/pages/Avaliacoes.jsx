import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Estrelas } from '../components/avaliacao/Estrelas'
import { FormAvaliacao } from '../components/avaliacao/FormAvaliacao'
import { formatarData, formatarNota } from '../components/avaliacao/formatos'
import { Avatar, ConfirmDialog, EmptyState, ErrorState, Icon, Loading, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi, avaliacaoApi } from '../services/api'

const POR_PAGINA = 30

// Avaliações (RF09): o cliente avalia atendimentos concluídos; o prestador vê as que recebeu; o admin modera.
export default function Avaliacoes() {
  const { payload } = useAuth()
  const notify = useToast()
  const tipo = payload?.tipo
  const isCliente = tipo === 'CLIENTE'
  const isPrestador = tipo === 'PRESTADOR'
  const isAdmin = tipo === 'ADMIN'

  // ?agendamento=<id> abre direto o formulário daquele agendamento (link vindo de outra tela)
  const [params, setParams] = useSearchParams()
  const [avaliando, setAvaliando] = useState(() => params.get('agendamento'))
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [erroExclusao, setErroExclusao] = useState(null)
  const [busy, setBusy] = useState(false)
  const [limite, setLimite] = useState(POR_PAGINA)

  const carregarAvaliacoes = useCallback((options) => avaliacaoApi.listar(options), [])
  const avaliacoes = useApiResource(carregarAvaliacoes, 'avaliacoes')
  const lista = avaliacoes.data ?? []

  // Só o cliente avalia: busca os agendamentos concluídos dele que ainda não têm avaliação.
  const carregarConcluidos = useCallback((options) => agendamentoApi.listar('CONCLUIDO', options), [])
  const concluidos = useApiResource(carregarConcluidos, 'agendamentos:CONCLUIDO', { enabled: isCliente })
  const avaliados = new Set(lista.map((avaliacao) => avaliacao.agendamentoId))
  const pendentes = avaliacoes.data ? (concluidos.data ?? []).filter((agendamento) => !avaliados.has(agendamento.id)) : []
  const media = lista.length ? lista.reduce((soma, item) => soma + item.nota, 0) / lista.length : null

  function fecharAvaliacao() {
    setAvaliando(null)
    if (params.has('agendamento')) setParams({}, { replace: true })
  }

  async function avaliar(agendamento, dados) {
    try {
      const criada = await avaliacaoApi.criar({ agendamentoId: agendamento.id, ...dados })
      avaliacoes.update([criada, ...lista])
      fecharAvaliacao()
      notify(`Obrigado! Sua avaliação de ${agendamento.servicoNome} foi registrada.`)
    } catch (err) {
      // 409 = já avaliado ou não está mais concluído: recarrega para mostrar o estado real
      if (err.status === 409 || err.status === 404) { avaliacoes.retry(); concluidos.retry() }
      throw err
    }
  }

  async function salvarEdicao(avaliacao, dados) {
    try {
      const atualizada = await avaliacaoApi.atualizar(avaliacao.id, dados)
      avaliacoes.update(lista.map((item) => item.id === atualizada.id ? atualizada : item))
      setEditando(null)
      notify('Avaliação atualizada.')
    } catch (err) {
      if (err.status === 404) avaliacoes.retry()
      throw err
    }
  }

  async function excluir(avaliacao) {
    if (busy) return
    setBusy(true)
    setErroExclusao(null)
    try {
      await avaliacaoApi.excluir(avaliacao.id)
      avaliacoes.update(lista.filter((item) => item.id !== avaliacao.id))
      setExcluindo(null)
      notify('Avaliação excluída.')
    } catch (err) {
      setErroExclusao({ message: err.message || 'Não foi possível excluir a avaliação.', errors: err.errors ?? [] })
      if (err.status === 404) avaliacoes.retry()
    } finally {
      setBusy(false)
    }
  }

  const titulo = isCliente ? 'Minhas avaliações' : isPrestador ? 'Avaliações recebidas' : 'Avaliações'
  const descricao = isCliente
    ? 'Avalie os atendimentos concluídos e gerencie as avaliações que você já fez.'
    : isPrestador
      ? 'Veja o que os clientes acharam dos seus atendimentos.'
      : 'Todas as avaliações da plataforma.'

  const agendamentoAvaliando = pendentes.find((agendamento) => agendamento.id === avaliando)

  return (
    <>
      <PageHeader title={titulo} description={descricao} />

      {isCliente && !concluidos.loading && !concluidos.error && pendentes.length > 0 && (
        <section className="card" aria-labelledby="pendentes-titulo">
          <div className="card__header">
            <div>
              <h2 id="pendentes-titulo">Aguardando sua avaliação</h2>
              <p>Atendimentos concluídos que você ainda não avaliou.</p>
            </div>
            <span className="badge badge--primary badge--plain">{pendentes.length}</span>
          </div>
          <ul className="compact-list" aria-label="Atendimentos para avaliar">
            {pendentes.map((agendamento) => (
              <li key={agendamento.id}>
                <Avatar nome={agendamento.prestadorNome} />
                <div className="compact-list__body">
                  <strong>{agendamento.servicoNome}</strong>
                  <span>{agendamento.prestadorNome} · {formatarData(agendamento.dataHora)}</span>
                </div>
                <button className="btn btn--primary btn--sm" type="button" aria-label={`Avaliar ${agendamento.servicoNome} em ${formatarData(agendamento.dataHora)}`}
                  onClick={() => { setEditando(null); setAvaliando(agendamento.id) }}><Icon name="star" size="sm" />Avaliar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isCliente && concluidos.error && <ErrorState error={concluidos.error} onRetry={concluidos.retry} />}

      {avaliacoes.loading ? <Loading>Carregando avaliações…</Loading> : avaliacoes.error ? (
        <div className="card"><ErrorState error={avaliacoes.error} onRetry={avaliacoes.retry} /></div>
      ) : lista.length === 0 ? (
        <div className="card">
          <EmptyState icon="star" title={`Nenhuma avaliação ${isPrestador ? 'recebida' : isCliente ? 'feita' : 'registrada'}`}
            actions={isCliente && pendentes.length === 0 && <Link className="btn btn--secondary" to="/dashboard/agendamentos">Ver meus agendamentos</Link>}>
            {isCliente
              ? pendentes.length > 0 ? 'Avalie um dos atendimentos acima.' : 'Quando um atendimento seu for concluído, você poderá avaliá-lo aqui.'
              : 'As avaliações dos clientes aparecerão aqui.'}
          </EmptyState>
        </div>
      ) : (
        <section className="card" aria-label={titulo}>
          <div className="card__header">
            <div>
              <h2>{isCliente ? 'Avaliações que você fez' : isPrestador ? 'O que os clientes disseram' : 'Todas as avaliações'}</h2>
              <p>{lista.length} {lista.length === 1 ? 'avaliação' : 'avaliações'}{!isCliente && media !== null ? ` · média ${formatarNota(media)}` : ''}</p>
            </div>
          </div>
          <ul className="reviews" aria-label="Lista de avaliações">
            {lista.slice(0, limite).map((avaliacao) => {
              const descricaoItem = `avaliação de ${avaliacao.servicoNome} em ${formatarData(avaliacao.dataHoraAgendamento)}`
              return (
                <li key={avaliacao.id} className="review">
                  <div className="review__head">
                    <div className="review__author">
                      <Avatar nome={isCliente ? avaliacao.prestadorNome : avaliacao.clienteNome} />
                      <div>
                        <strong>{avaliacao.servicoNome}</strong>
                        <span>
                          {!isCliente && `${avaliacao.clienteNome} · `}
                          {!isPrestador && <Link to={`/dashboard/prestadores/${avaliacao.prestadorId}`}>{avaliacao.prestadorNome}</Link>}
                          {!isPrestador && ' · '}atendimento em {formatarData(avaliacao.dataHoraAgendamento)} · avaliado em {formatarData(avaliacao.dataAvaliacao)}
                        </span>
                      </div>
                    </div>
                    <Estrelas nota={avaliacao.nota} />
                  </div>
                  <p className={avaliacao.comentario ? 'review__comment' : 'subtle'}>{avaliacao.comentario || 'Sem comentário.'}</p>
                  {(isCliente || isAdmin) && (
                    <div className="review__actions">
                      {isCliente && <button className="btn btn--ghost btn--sm" type="button" disabled={busy} aria-label={`Editar ${descricaoItem}`}
                        onClick={() => { setExcluindo(null); setAvaliando(null); setEditando(avaliacao) }}><Icon name="edit" size="sm" />Editar</button>}
                      <button className="btn btn--ghost btn--sm" type="button" disabled={busy} aria-label={`Excluir ${descricaoItem}`}
                        onClick={() => { setEditando(null); setErroExclusao(null); setExcluindo(avaliacao) }}><Icon name="trash" size="sm" />Excluir</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {lista.length > limite && (
            <div className="load-more"><button className="btn btn--secondary" type="button" onClick={() => setLimite((v) => v + POR_PAGINA)}>Mostrar mais ({lista.length - limite} restantes)</button></div>
          )}
        </section>
      )}

      {agendamentoAvaliando && (
        <FormAvaliacao
          key={agendamentoAvaliando.id}
          titulo={`Avaliar ${agendamentoAvaliando.servicoNome}`}
          descricao={`Atendimento em ${agendamentoAvaliando.prestadorNome} no dia ${formatarData(agendamentoAvaliando.dataHora)}.`}
          rotuloEnviar="Enviar avaliação"
          onSubmit={(dados) => avaliar(agendamentoAvaliando, dados)}
          onCancel={fecharAvaliacao}
        />
      )}

      {editando && (
        <FormAvaliacao
          key={editando.id}
          titulo={`Editar avaliação de ${editando.servicoNome}`}
          descricao={`Atendimento em ${editando.prestadorNome} no dia ${formatarData(editando.dataHoraAgendamento)}.`}
          inicial={editando}
          rotuloEnviar="Salvar alterações"
          onSubmit={(dados) => salvarEdicao(editando, dados)}
          onCancel={() => setEditando(null)}
        />
      )}

      {excluindo && (
        <ConfirmDialog title="Excluir avaliação?" confirmLabel="Confirmar exclusão" busy={busy} error={erroExclusao}
          onConfirm={() => excluir(excluindo)} onClose={() => setExcluindo(null)}>
          Excluir a avaliação de {excluindo.servicoNome}{isAdmin ? ` feita por ${excluindo.clienteNome}` : ''}? Esta ação não pode ser desfeita.
        </ConfirmDialog>
      )}
    </>
  )
}
