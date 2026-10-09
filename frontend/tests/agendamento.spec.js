import { expect, test } from '@playwright/test'

const API = 'http://localhost:8080'
const PRESTADOR_ID = '11111111-1111-4111-8111-111111111111'
const USUARIO_ID = '22222222-2222-4222-8222-222222222222'
const SERVICO_ID = '44444444-4444-4444-8444-444444444444'
const AGENDAMENTO_ID = '77777777-7777-4777-8777-777777777777'
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
const SERVICO = { id: SERVICO_ID, nome: 'Corte', descricao: null, duracaoMinutos: 60, preco: 45, ativo: true }

function dataFutura(dias = 3) {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

function agendamento(campos = {}) {
  const dia = campos.dia ?? dataFutura()
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
    dataHora: `${dia}T09:00:00`,
    dataHoraFim: `${dia}T10:00:00`,
    status: 'PENDENTE',
    observacoes: null,
    criadoEm: '2026-01-01T10:00:00',
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
    horariosLivres: options.horariosLivres ?? ['09:00:00', '10:00:00', '11:00:00'],
    conflitoAoAgendar: options.conflitoAoAgendar ?? false,
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

    if (method === 'GET' && path === PERFIL_PATH) return reply(200, PERFIL)
    if (method === 'GET' && path === `${PERFIL_PATH}/horarios`) return reply(200, [])
    if (method === 'GET' && path === `${PERFIL_PATH}/servicos`) return reply(200, [SERVICO])
    if (method === 'GET' && path === `${PERFIL_PATH}/disponibilidade`) {
      return reply(200, {
        prestadorId: PRESTADOR_ID, servicoId: SERVICO_ID, data: url.searchParams.get('data'),
        duracaoMinutos: 60, horarios: state.horariosLivres,
      })
    }
    if (method === 'GET' && path === '/agendamentos') {
      const status = url.searchParams.get('status')
      return reply(200, state.agendamentos.filter((item) => !status || item.status === status))
    }
    if (method === 'POST' && path === '/agendamentos') {
      if (state.conflitoAoAgendar) {
        state.conflitoAoAgendar = false
        state.horariosLivres = state.horariosLivres.filter((hora) => `${body.dataHora.slice(0, 11)}${hora}` !== body.dataHora)
        return reply(409, { status: 409, message: 'Horário indisponível. Consulte os horários livres e escolha outro', errors: [] })
      }
      const criado = agendamento({ dataHora: body.dataHora, observacoes: body.observacoes })
      state.agendamentos.push(criado)
      state.horariosLivres = state.horariosLivres.filter((hora) => `${body.dataHora.slice(0, 11)}${hora}` !== body.dataHora)
      return reply(201, criado)
    }
    const remarcando = state.agendamentos.find((atual) => path === `/agendamentos/${atual.id}/disponibilidade`)
    if (remarcando && method === 'GET') {
      return reply(200, {
        prestadorId: PRESTADOR_ID, servicoId: remarcando.servicoId, data: url.searchParams.get('data'),
        duracaoMinutos: 60, horarios: state.horariosLivres,
      })
    }
    const item = state.agendamentos.find((atual) => path === `/agendamentos/${atual.id}`
      || path === `/agendamentos/${atual.id}/status`)
    if (item && method === 'PATCH') {
      Object.assign(item, { status: body.status })
      return reply(200, item)
    }
    if (item && method === 'PUT') {
      const dia = body.dataHora.slice(0, 10)
      const remarcado = body.dataHora !== item.dataHora
      Object.assign(item, {
        dataHora: body.dataHora,
        dataHoraFim: `${dia}T${String(Number(body.dataHora.slice(11, 13)) + 1).padStart(2, '0')}:00:00`,
        observacoes: body.observacoes,
        status: remarcado ? 'PENDENTE' : item.status,
      })
      return reply(200, item)
    }
    if (item && method === 'DELETE') {
      state.agendamentos = state.agendamentos.filter((atual) => atual !== item)
      return reply(204)
    }
    state.inesperadas.push(`${method} ${path}`)
    return reply(500, { status: 500, message: `Requisicao inesperada: ${method} ${path}` })
  })
  return state
}

async function consultarHorarios(page, data = dataFutura()) {
  await page.goto(`/dashboard/prestadores/${PRESTADOR_ID}`)
  await page.getByLabel('Serviço', { exact: true }).selectOption(SERVICO_ID)
  await page.getByLabel(/^Data/).fill(data)
  await page.getByRole('button', { name: 'Consultar horários', exact: true }).click()
}

test('cliente escolhe um horário livre e agenda com observações', async ({ page }) => {
  const state = await preparar(page)
  const data = dataFutura()
  await consultarHorarios(page, data)

  const horarios = page.getByRole('list', { name: 'Horários livres' })
  await expect(horarios.getByRole('listitem')).toHaveText(['09:00', '10:00', '11:00'])
  await horarios.getByRole('button', { name: '10:00' }).click()
  await expect(horarios.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel(/^Observações/).fill('  Primeira vez  ')
  await page.screenshot({ path: 'test-results/agendamento-escolha.png', fullPage: true })
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Agendamento solicitado' })).toContainText('às 10:00')
  await expect(horarios.getByRole('listitem')).toHaveText(['09:00', '11:00'])
  await expect(page.getByRole('form', { name: 'Confirmar agendamento' })).toHaveCount(0)
  expect(state.requests.find((request) => request.method === 'POST').body).toEqual({
    servicoId: SERVICO_ID, dataHora: `${data}T10:00:00`, observacoes: 'Primeira vez',
  })

  await page.getByRole('link', { name: 'Ver meus agendamentos' }).click()
  await expect(page.getByRole('heading', { name: 'Meus agendamentos' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Lista de agendamentos' })).toContainText('Primeira vez')
  expect(state.inesperadas).toEqual([])
})

test('conflito ao agendar avisa o cliente e atualiza os horários livres', async ({ page }) => {
  const state = await preparar(page, { conflitoAoAgendar: true })
  await consultarHorarios(page)
  const horarios = page.getByRole('list', { name: 'Horários livres' })
  await horarios.getByRole('button', { name: '09:00' }).click()
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

  await expect(page.getByRole('alert')).toContainText('Horário indisponível. Consulte os horários livres')
  await expect(horarios.getByRole('listitem')).toHaveText(['10:00', '11:00'])
  expect(state.agendamentos).toHaveLength(0)
})

test('prestador apenas consulta horários, sem botão de agendar', async ({ page }) => {
  await preparar(page, { tipo: 'PRESTADOR' })
  await consultarHorarios(page)
  await expect(page.getByRole('list', { name: 'Horários livres' }).getByRole('button')).toHaveCount(0)
})

test('prestador confirma agendamento pendente e cancela com confirmação', async ({ page }) => {
  const state = await preparar(page, { tipo: 'PRESTADOR', agendamentos: [agendamento()] })
  await page.goto('/dashboard/agendamentos')
  await expect(page.getByRole('heading', { name: 'Agenda do negócio' })).toBeVisible()
  const tabela = page.getByRole('table', { name: 'Lista de agendamentos' })
  await expect(tabela).toContainText('Ana Cliente')
  await expect(tabela.getByRole('button', { name: /^Remarcar/ })).toHaveCount(0)
  await expect(tabela.getByRole('button', { name: /^Concluir/ })).toHaveCount(0)

  await tabela.getByRole('button', { name: /^Confirmar/ }).click()
  await expect(tabela).toContainText('Confirmado')
  expect(state.requests.at(-1)).toMatchObject({ method: 'PATCH', body: { status: 'CONFIRMADO' } })
  await page.screenshot({ path: 'test-results/agendamento-prestador.png', fullPage: true })

  await tabela.getByRole('button', { name: /^Cancelar/ }).click()
  await page.getByRole('button', { name: 'Voltar' }).click()
  expect(state.agendamentos[0].status).toBe('CONFIRMADO')
  await tabela.getByRole('button', { name: /^Cancelar/ }).click()
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
  await expect(tabela).toContainText('Cancelado')
  await expect(tabela.getByRole('button')).toHaveCount(0)
})

test('prestador só vê Concluir depois do horário marcado', async ({ page }) => {
  await preparar(page, {
    tipo: 'PRESTADOR',
    agendamentos: [agendamento({ status: 'CONFIRMADO', dia: dataFutura(-1) })],
  })
  await page.goto('/dashboard/agendamentos')
  await page.getByRole('button', { name: /^Concluir/ }).click()
  await expect(page.getByRole('table', { name: 'Lista de agendamentos' })).toContainText('Concluído')
})

test('cliente remarca para outro horário livre e o agendamento volta para pendente', async ({ page }) => {
  const original = agendamento({ status: 'CONFIRMADO' })
  const state = await preparar(page, { agendamentos: [original] })
  await page.goto('/dashboard/agendamentos')
  await expect(page.getByRole('heading', { name: 'Meus agendamentos' })).toBeVisible()
  await page.getByRole('button', { name: /^Remarcar/ }).click()

  const novos = page.getByRole('list', { name: 'Novos horários livres' })
  await expect(novos.getByRole('button', { name: '09:00 (atual)' })).toBeDisabled()
  await novos.getByRole('button', { name: '11:00' }).click()
  await page.screenshot({ path: 'test-results/agendamento-remarcar.png', fullPage: true })
  await page.getByRole('button', { name: 'Remarcar para 11:00' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Agendamento remarcado' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Lista de agendamentos' })).toContainText('Pendente')
  expect(state.requests.some((request) => request.path === `/agendamentos/${AGENDAMENTO_ID}/disponibilidade`)).toBe(true)
  expect(state.requests.find((request) => request.method === 'PUT').body).toEqual({
    servicoId: SERVICO_ID, dataHora: `${original.dataHora.slice(0, 10)}T11:00:00`, observacoes: null,
  })
})

test('filtro de status consulta a API com o status escolhido', async ({ page }) => {
  const state = await preparar(page, {
    agendamentos: [agendamento(), agendamento({ id: '88888888-8888-4888-8888-888888888888', status: 'CANCELADO' })],
  })
  await page.goto('/dashboard/agendamentos')
  await expect(page.getByRole('table', { name: 'Lista de agendamentos' }).getByRole('row')).toHaveCount(3)
  await page.getByLabel('Status').selectOption('CANCELADO')
  await expect(page.getByRole('table', { name: 'Lista de agendamentos' }).getByRole('row')).toHaveCount(2)
  expect(state.requests.at(-1).query).toEqual({ status: 'CANCELADO' })
  await page.getByLabel('Status').selectOption('CONCLUIDO')
  await expect(page.getByRole('heading', { name: 'Nenhum agendamento com status concluído' })).toBeVisible()
})
