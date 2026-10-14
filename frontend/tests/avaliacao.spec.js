import { expect, test } from '@playwright/test'

const API = 'http://localhost:8080'
const PRESTADOR_ID = '11111111-1111-4111-8111-111111111111'
const USUARIO_ID = '22222222-2222-4222-8222-222222222222'
const SERVICO_ID = '44444444-4444-4444-8444-444444444444'
const AGENDAMENTO_ID = '77777777-7777-4777-8777-777777777777'
const OUTRO_AGENDAMENTO_ID = '78787878-7878-4787-8787-787878787878'
const AVALIACAO_ID = '88888888-8888-4888-8888-888888888888'
const PERFIL_PATH = `/prestadores/${PRESTADOR_ID}`

const PERFIL = {
  id: PRESTADOR_ID,
  usuarioId: '99999999-9999-4999-8999-999999999999',
  nomeNegocio: 'Barbearia Jorge',
  descricao: null,
  endereco: null,
  telefoneComercial: null,
  ativo: true,
}

function agendamentoConcluido(campos = {}) {
  return {
    id: AGENDAMENTO_ID,
    clienteId: USUARIO_ID,
    clienteNome: 'Ana Cliente',
    prestadorId: PRESTADOR_ID,
    prestadorNome: PERFIL.nomeNegocio,
    servicoId: SERVICO_ID,
    servicoNome: 'Corte',
    duracaoMinutos: 60,
    preco: 45,
    dataHora: '2026-10-05T09:00:00',
    dataHoraFim: '2026-10-05T10:00:00',
    status: 'CONCLUIDO',
    observacoes: null,
    criadoEm: '2026-10-01T10:00:00',
    ...campos,
  }
}

function avaliacao(campos = {}) {
  return {
    id: AVALIACAO_ID,
    agendamentoId: AGENDAMENTO_ID,
    clienteId: USUARIO_ID,
    clienteNome: 'Ana Cliente',
    prestadorId: PRESTADOR_ID,
    prestadorNome: PERFIL.nomeNegocio,
    servicoId: SERVICO_ID,
    servicoNome: 'Corte',
    dataHoraAgendamento: '2026-10-05T09:00:00',
    nota: 5,
    comentario: 'Atendimento excelente',
    dataAvaliacao: '2026-10-06T14:30:00.123456',
    ...campos,
  }
}

function token(tipo) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    userId: USUARIO_ID, tipo, nome: 'Usuario de teste', sub: 'usuario@teste.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.assinatura-de-teste`
}

// Todas as chamadas à API são respondidas aqui; nenhum cenário grava no banco da aplicação.
async function preparar(page, options = {}) {
  const jwt = token(options.tipo ?? 'CLIENTE')
  const state = {
    agendamentos: (options.agendamentos ?? []).map((item) => ({ ...item })),
    avaliacoes: (options.avaliacoes ?? []).map((item) => ({ ...item })),
    conflitoAoAvaliar: options.conflitoAoAvaliar ?? false,
    requests: [],
    inesperadas: [],
  }
  const cors = {
    'access-control-allow-origin': 'http://127.0.0.1:5174',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    vary: 'Origin',
  }
  await page.addInitScript((value) => localStorage.setItem('agenda.token', value), jwt)
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const path = url.pathname
    const reply = (status, body) => route.fulfill({
      status,
      headers: cors,
      ...(body === undefined ? {} : { contentType: 'application/json', body: JSON.stringify(body) }),
    })
    if (method === 'OPTIONS') return reply(204)
    const body = request.postData() ? request.postDataJSON() : undefined
    state.requests.push({ method, path, body, query: Object.fromEntries(url.searchParams) })

    if (method === 'GET' && path === '/agendamentos') {
      const status = url.searchParams.get('status')
      return reply(200, state.agendamentos.filter((item) => !status || item.status === status))
    }
    if (method === 'GET' && path === '/avaliacoes') return reply(200, state.avaliacoes)
    if (method === 'POST' && path === '/avaliacoes') {
      if (state.conflitoAoAvaliar) {
        state.conflitoAoAvaliar = false
        state.avaliacoes.push(avaliacao({ agendamentoId: body.agendamentoId, nota: 3, comentario: 'Feita em outra aba' }))
        return reply(409, { status: 409, message: 'Este agendamento já foi avaliado', errors: [] })
      }
      const criada = avaliacao({ agendamentoId: body.agendamentoId, nota: body.nota, comentario: body.comentario })
      state.avaliacoes.unshift(criada)
      return reply(201, criada)
    }
    const item = state.avaliacoes.find((atual) => path === `/avaliacoes/${atual.id}`)
    if (item && method === 'PUT') {
      Object.assign(item, { nota: body.nota, comentario: body.comentario })
      return reply(200, item)
    }
    if (item && method === 'DELETE') {
      state.avaliacoes = state.avaliacoes.filter((atual) => atual !== item)
      return reply(204)
    }

    if (method === 'GET' && path === '/prestadores') return reply(200, [PERFIL])
    // Página do prestador
    if (method === 'GET' && path === PERFIL_PATH) return reply(200, PERFIL)
    if (method === 'GET' && path === `${PERFIL_PATH}/horarios`) return reply(200, [])
    if (method === 'GET' && path === `${PERFIL_PATH}/servicos`) return reply(200, [])
    if (method === 'GET' && path === `${PERFIL_PATH}/avaliacoes`) return reply(200, state.avaliacoes)
    if (method === 'GET' && path === `${PERFIL_PATH}/avaliacoes/media`) {
      const notas = state.avaliacoes.map((atual) => atual.nota)
      const media = notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null
      return reply(200, { prestadorId: PRESTADOR_ID, notaMedia: media, totalAvaliacoes: notas.length })
    }

    state.inesperadas.push(`${method} ${path}`)
    return reply(500, { status: 500, message: `Requisicao inesperada: ${method} ${path}` })
  })
  return state
}

test('cliente avalia um atendimento concluído com nota e comentário', async ({ page }) => {
  const state = await preparar(page, { agendamentos: [agendamentoConcluido()] })
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Minhas avaliações' }).click()
  await expect(page.getByRole('heading', { name: 'Minhas avaliações' })).toBeVisible()

  const pendentes = page.getByRole('list', { name: 'Atendimentos para avaliar' })
  await expect(pendentes).toContainText('Corte')
  await expect(pendentes).toContainText('Barbearia Jorge · 05/10/2026')
  await pendentes.getByRole('button', { name: /^Avaliar Corte/ }).click()

  const form = page.getByRole('form', { name: 'Avaliar Corte' })
  await form.getByRole('radio', { name: '4 de 5 (Muito bom)' }).check()
  await form.getByLabel(/^Comentário/).fill('  Gostei bastante  ')
  await page.screenshot({ path: 'test-results/avaliacao-formulario.png', fullPage: true })
  await form.getByRole('button', { name: 'Enviar avaliação' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Obrigado!' })).toContainText('Corte')
  await expect(page.getByRole('list', { name: 'Atendimentos para avaliar' })).toHaveCount(0)
  const tabela = page.getByRole('table', { name: 'Lista de avaliações' })
  await expect(tabela).toContainText('Gostei bastante')
  await expect(tabela.getByRole('img', { name: 'Nota 4 de 5' })).toBeVisible()
  expect(state.requests.find((request) => request.method === 'POST').body).toEqual({
    agendamentoId: AGENDAMENTO_ID, nota: 4, comentario: 'Gostei bastante',
  })
  expect(state.inesperadas).toEqual([])
})

test('não envia avaliação sem nota', async ({ page }) => {
  const state = await preparar(page, { agendamentos: [agendamentoConcluido()] })
  await page.goto('/dashboard/avaliacoes')
  await page.getByRole('button', { name: /^Avaliar Corte/ }).click()
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()

  await expect(page.getByRole('alert')).toContainText('Escolha uma nota de 1 a 5.')
  expect(state.requests.some((request) => request.method === 'POST')).toBe(false)
})

test('comentário vazio é enviado como nulo', async ({ page }) => {
  const state = await preparar(page, { agendamentos: [agendamentoConcluido()] })
  await page.goto('/dashboard/avaliacoes')
  await page.getByRole('button', { name: /^Avaliar Corte/ }).click()
  await page.getByRole('radio', { name: '5 de 5 (Excelente)' }).check()
  await page.getByLabel(/^Comentário/).fill('   ')
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()

  await expect(page.getByRole('table', { name: 'Lista de avaliações' })).toBeVisible()
  expect(state.requests.find((request) => request.method === 'POST').body)
    .toEqual({ agendamentoId: AGENDAMENTO_ID, nota: 5, comentario: null })
})

test('avaliação já feita em outra aba mostra o erro e atualiza a tela', async ({ page }) => {
  await preparar(page, { agendamentos: [agendamentoConcluido()], conflitoAoAvaliar: true })
  await page.goto('/dashboard/avaliacoes')
  await page.getByRole('button', { name: /^Avaliar Corte/ }).click()
  await page.getByRole('radio', { name: '5 de 5 (Excelente)' }).check()
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()

  await expect(page.getByRole('table', { name: 'Lista de avaliações' })).toContainText('Feita em outra aba')
  await expect(page.getByRole('list', { name: 'Atendimentos para avaliar' })).toHaveCount(0)
})

test('link com ?agendamento abre o formulário direto', async ({ page }) => {
  await preparar(page, { agendamentos: [agendamentoConcluido()] })
  await page.goto(`/dashboard/avaliacoes?agendamento=${AGENDAMENTO_ID}`)
  await expect(page.getByRole('form', { name: 'Avaliar Corte' })).toBeVisible()
})

test('cliente edita e exclui a própria avaliação', async ({ page }) => {
  const state = await preparar(page, {
    agendamentos: [agendamentoConcluido()],
    avaliacoes: [avaliacao({ nota: 2, comentario: 'Demorou' })],
  })
  await page.goto('/dashboard/avaliacoes')
  const tabela = page.getByRole('table', { name: 'Lista de avaliações' })
  await expect(tabela).toContainText('Demorou')
  await expect(tabela).toContainText('06/10/2026')
  // Agendamento já avaliado não aparece como pendente
  await expect(page.getByRole('list', { name: 'Atendimentos para avaliar' })).toHaveCount(0)

  await tabela.getByRole('button', { name: /^Editar/ }).click()
  const form = page.getByRole('form', { name: 'Editar avaliação de Corte' })
  await expect(form.getByRole('radio', { name: '2 de 5 (Regular)' })).toBeChecked()
  await expect(form.getByLabel(/^Comentário/)).toHaveValue('Demorou')
  await form.getByRole('radio', { name: '4 de 5 (Muito bom)' }).check()
  await form.getByLabel(/^Comentário/).fill('Demorou, mas o corte ficou ótimo')
  await form.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Avaliação atualizada.' })).toBeVisible()
  await expect(tabela).toContainText('Demorou, mas o corte ficou ótimo')
  expect(state.requests.find((request) => request.method === 'PUT')).toMatchObject({
    path: `/avaliacoes/${AVALIACAO_ID}`, body: { nota: 4, comentario: 'Demorou, mas o corte ficou ótimo' },
  })

  await tabela.getByRole('button', { name: /^Excluir/ }).click()
  await page.getByRole('button', { name: 'Voltar' }).click()
  expect(state.avaliacoes).toHaveLength(1)
  await tabela.getByRole('button', { name: /^Excluir/ }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Avaliação excluída.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nenhuma avaliação feita' })).toBeVisible()
  // Depois de excluir, o atendimento volta a poder ser avaliado
  await expect(page.getByRole('list', { name: 'Atendimentos para avaliar' })).toContainText('Corte')
  expect(state.avaliacoes).toHaveLength(0)
})

test('prestador vê as avaliações recebidas sem ações e sem pendências', async ({ page }) => {
  const state = await preparar(page, { tipo: 'PRESTADOR', avaliacoes: [avaliacao()] })
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Avaliações recebidas' }).click()

  const tabela = page.getByRole('table', { name: 'Lista de avaliações' })
  await expect(tabela).toContainText('Ana Cliente')
  await expect(tabela).toContainText('Atendimento excelente')
  await expect(tabela.getByRole('columnheader', { name: 'Prestador' })).toHaveCount(0)
  await expect(tabela.getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Atendimentos para avaliar' })).toHaveCount(0)
  expect(state.requests.some((request) => request.path === '/agendamentos')).toBe(false)
  expect(state.inesperadas).toEqual([])
})

test('admin exclui qualquer avaliação, mas não edita', async ({ page }) => {
  const state = await preparar(page, { tipo: 'ADMIN', avaliacoes: [avaliacao()] })
  await page.goto('/dashboard/avaliacoes')
  await expect(page.getByRole('heading', { name: 'Avaliações', exact: true })).toBeVisible()
  const tabela = page.getByRole('table', { name: 'Lista de avaliações' })
  await expect(tabela.getByRole('button', { name: /^Editar/ })).toHaveCount(0)

  await tabela.getByRole('button', { name: /^Excluir/ }).click()
  await expect(page.getByRole('alert')).toContainText('feita por Ana Cliente')
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await expect(page.getByRole('heading', { name: 'Nenhuma avaliação registrada' })).toBeVisible()
  expect(state.requests.at(-1)).toMatchObject({ method: 'DELETE', path: `/avaliacoes/${AVALIACAO_ID}` })
})

test('página do prestador mostra a nota média e as avaliações', async ({ page }) => {
  const state = await preparar(page, {
    avaliacoes: [
      avaliacao(),
      avaliacao({ id: '89898989-8989-4898-8989-898989898989', agendamentoId: OUTRO_AGENDAMENTO_ID, nota: 4, comentario: 'Bom' }),
      avaliacao({ id: '8a8a8a8a-8a8a-48a8-8a8a-8a8a8a8a8a8a', agendamentoId: OUTRO_AGENDAMENTO_ID, nota: 4, comentario: null }),
    ],
  })
  await page.goto(`/dashboard/prestadores/${PRESTADOR_ID}`)

  const painel = page.getByRole('region', { name: 'Avaliações' })
  await expect(painel.getByLabel('Nota média', { exact: true })).toContainText('4,3')
  await expect(painel.getByRole('img', { name: 'Nota média 4,3 de 5' })).toBeVisible()
  await expect(painel).toContainText('3 avaliações')
  const lista = painel.getByRole('list', { name: 'Avaliações do negócio' })
  await expect(lista.getByRole('listitem')).toHaveCount(3)
  await expect(lista).toContainText('Atendimento excelente')
  await expect(lista).toContainText('Ana Cliente · Corte')
  await page.screenshot({ path: 'test-results/avaliacao-prestador.png', fullPage: true })
  expect(state.inesperadas).toEqual([])
})

test('prestador sem avaliações mostra estado vazio', async ({ page }) => {
  await preparar(page)
  await page.goto(`/dashboard/prestadores/${PRESTADOR_ID}`)
  const painel = page.getByRole('region', { name: 'Avaliações' })
  await expect(painel).toContainText('Este negócio ainda não recebeu avaliações.')
  await expect(painel.getByLabel('Nota média', { exact: true })).toHaveCount(0)
})
