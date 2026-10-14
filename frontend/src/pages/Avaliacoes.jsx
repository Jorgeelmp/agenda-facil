import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Estrelas } from '../components/avaliacao/Estrelas'
import { FormAvaliacao } from '../components/avaliacao/FormAvaliacao'
import { formatarData } from '../components/avaliacao/formatos'
import { useAuth } from '../context/AuthContext'
import { useApiResource } from '../hooks/useApiResource'
import { agendamentoApi, avaliacaoApi } from '../services/api'

export default function Avaliacoes() {
  const { payload } = useAuth()
  const tipo = payload?.tipo
  const isCliente = tipo === 'CLIENTE'
  const isPrestador = tipo === 'PRESTADOR'
  const isAdmin = tipo === 'ADMIN'

  // ?agendamento=<id> abre direto o formulário daquele agendamento (link vindo de outra tela)
  const [params, setParams] = useSearchParams()
  const [avaliando, setAvaliando] = useState(() => params.get('agendamento'))
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState('')

  const carregarAvaliacoes = useCallback((options) => avaliacaoApi.listar(options), [])
  const avaliacoes = useApiResource(carregarAvaliacoes, 'avaliacoes')
  const lista = avaliacoes.data ?? []

  // Só o cliente avalia: busca os agendamentos concluídos dele que ainda não têm avaliação.
  const carregarConcluidos = useCallback((options) => agendamentoApi.listar('CONCLUIDO', options), [])
  const concluidos = useApiResource(carregarConcluidos, 'agendamentos:CONCLUIDO', { enabled: isCliente })
  const avaliados = new Set(lista.map((avaliacao) => avaliacao.agendamentoId))
  const pendentes = avaliacoes.data ? (concluidos.data ?? []).filter((agendamento) => !avaliados.has(agendamento.id)) : []

  function limparMensagens() {
    setErro(null)
    setSucesso('')
  }

  function fecharAvaliacao() {
    setAvaliando(null)
    if (params.has('agendamento')) setParams({}, { replace: true })
  }

  async function avaliar(agendamento, dados) {
    try {
      const criada = await avaliacaoApi.criar({ agendamentoId: agendamento.id, ...dados })
      avaliacoes.update([criada, ...lista])
      fecharAvaliacao()
      setSucesso(`Obrigado! Sua avaliação de ${agendamento.servicoNome} foi registrada.`)
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
      setSucesso('Avaliação atualizada.')
    } catch (err) {
      if (err.status === 404) avaliacoes.retry()
      throw err
    }
  }

  async function excluir(avaliacao) {
    if (busy) return
    setBusy(true)
    limparMensagens()
    try {
      await avaliacaoApi.excluir(avaliacao.id)
      avaliacoes.update(lista.filter((item) => item.id !== avaliacao.id))
      setExcluindo(null)
      setSucesso('Avaliação excluída.')
    } catch (err) {
      setErro({ message: err.message || 'Não foi possível excluir a avaliação.', errors: err.errors ?? [] })
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
      <div className="page-heading"><h1>{titulo}</h1><p>{descricao}</p></div>

      {erro && <Alert message={erro.message} errors={erro.errors} />}
      {sucesso && <Alert type="success" message={sucesso} />}

      {isCliente && !concluidos.loading && !concluidos.error && pendentes.length > 0 && (
        <section className="panel reviews-pending" aria-labelledby="pendentes-titulo">
          <header className="panel__header">
            <div>
              <h2 id="pendentes-titulo">Aguardando sua avaliação</h2>
              <p className="panel__description">Atendimentos concluídos que você ainda não avaliou.</p>
            </div>
          </header>
          <ul className="review-list" aria-label="Atendimentos para avaliar">
            {pendentes.map((agendamento) => (
              <li key={agendamento.id} className="review review--pending">
                <div className="review__head">
                  <div>
                    <strong>{agendamento.servicoNome}</strong>
                    <span className="cell-sub">{agendamento.prestadorNome} · {formatarData(agendamento.dataHora)}</span>
                  </div>
                  {avaliando !== agendamento.id && (
                    <button className="btn btn--ghost" type="button" aria-label={`Avaliar ${agendamento.servicoNome} em ${formatarData(agendamento.dataHora)}`}
                      onClick={() => { limparMensagens(); setEditando(null); setAvaliando(agendamento.id) }}>Avaliar</button>
                  )}
                </div>
                {agendamentoAvaliando?.id === agendamento.id && (
                  <FormAvaliacao
                    titulo={`Avaliar ${agendamento.servicoNome}`}
                    descricao={`Atendimento em ${agendamento.prestadorNome} no dia ${formatarData(agendamento.dataHora)}.`}
                    rotuloEnviar="Enviar avaliação"
                    onSubmit={(dados) => avaliar(agendamento, dados)}
                    onCancel={fecharAvaliacao}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {isCliente && concluidos.error && <Alert message={concluidos.error.message} errors={concluidos.error.errors} />}

      {avaliacoes.loading ? <p className="loading-state" role="status">Carregando avaliações…</p> : avaliacoes.error ? (
        <div className="panel"><Alert message={avaliacoes.error.message} errors={avaliacoes.error.errors} /><button className="btn btn--ghost" onClick={avaliacoes.retry}>Tentar novamente</button></div>
      ) : lista.length === 0 ? (
        <div className="panel empty-state">
          <h2>Nenhuma avaliação {isPrestador ? 'recebida' : isCliente ? 'feita' : 'registrada'}</h2>
          <p>{isCliente
            ? pendentes.length > 0 ? 'Avalie um dos atendimentos acima.' : 'Quando um atendimento seu for concluído, você poderá avaliá-lo aqui.'
            : 'As avaliações dos clientes aparecerão aqui.'}</p>
          {isCliente && pendentes.length === 0 && <div className="form-actions"><Link className="btn btn--ghost" to="/dashboard/agendamentos">Ver meus agendamentos</Link></div>}
        </div>
      ) : (
        <section className="panel" aria-label={titulo}>
          <div className="table-wrap">
            <table className="data-table" aria-label="Lista de avaliações">
              <thead>
                <tr>
                  <th scope="col">Atendimento</th>
                  {!isCliente && <th scope="col">Cliente</th>}
                  {!isPrestador && <th scope="col">Prestador</th>}
                  <th scope="col">Nota</th>
                  <th scope="col">Comentário</th>
                  <th scope="col">Avaliado em</th>
                  {(isCliente || isAdmin) && <th scope="col">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {lista.map((avaliacao) => {
                  const descricaoItem = `avaliação de ${avaliacao.servicoNome} em ${formatarData(avaliacao.dataHoraAgendamento)}`
                  return (
                    <tr key={avaliacao.id}>
                      <th scope="row">
                        {avaliacao.servicoNome}
                        <span className="cell-sub">{formatarData(avaliacao.dataHoraAgendamento)}</span>
                      </th>
                      {!isCliente && <td>{avaliacao.clienteNome}</td>}
                      {!isPrestador && <td><Link to={`/dashboard/prestadores/${avaliacao.prestadorId}`}>{avaliacao.prestadorNome}</Link></td>}
                      <td><Estrelas nota={avaliacao.nota} /></td>
                      <td className="cell-wrap">{avaliacao.comentario || '—'}</td>
                      <td>{formatarData(avaliacao.dataAvaliacao)}</td>
                      {(isCliente || isAdmin) && (
                        <td>
                          <div className="form-actions">
                            {isCliente && <button className="btn btn--ghost" type="button" disabled={busy} aria-label={`Editar ${descricaoItem}`}
                              onClick={() => { limparMensagens(); setExcluindo(null); setAvaliando(null); setEditando(avaliacao) }}>Editar</button>}
                            <button className="btn btn--danger" type="button" disabled={busy} aria-label={`Excluir ${descricaoItem}`}
                              onClick={() => { limparMensagens(); setEditando(null); setExcluindo(avaliacao) }}>Excluir</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {excluindo && (
            <div className="confirm-action" role="alert">
              <p>Excluir a avaliação de {excluindo.servicoNome}{isAdmin ? ` feita por ${excluindo.clienteNome}` : ''}? Esta ação não pode ser desfeita.</p>
              <div className="form-actions">
                <button className="btn btn--danger" type="button" disabled={busy} onClick={() => excluir(excluindo)}>
                  {busy ? 'Processando…' : 'Confirmar exclusão'}
                </button>
                <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => setExcluindo(null)}>Voltar</button>
              </div>
            </div>
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
        </section>
      )}
    </>
  )
}
