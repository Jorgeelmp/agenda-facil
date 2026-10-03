import { expect, test } from '@playwright/test'

const API = 'http://localhost:8080'
const PRESTADOR_ID = '11111111-1111-4111-8111-111111111111'
const USUARIO_ID = '22222222-2222-4222-8222-222222222222'
const OUTRO_USUARIO_ID = '33333333-3333-4333-8333-333333333333'
const SERVICO_ID = '44444444-4444-4444-8444-444444444444'
const OUTRO_SERVICO_ID = '55555555-5555-4555-8555-555555555555'
const HORARIO_ID = '66666666-6666-4666-8666-666666666666'
const PERFIL_PATH = `/prestadores/${PRESTADOR_ID}`
const DETALHES_PATH = `/dashboard/prestadores/${PRESTADOR_ID}`
const estadosApi = new WeakMap()

const PERFIL = {
  id: PRESTADOR_ID,
  usuarioId: USUARIO_ID,
  nomeNegocio: 'Barbearia Jorge',
  descricao: 'Cortes e barba com hora marcada.',
  endereco: 'Rua Central, 123',
  telefoneComercial: '11999999999',
  ativo: true,
}
const SERVICOS = [
  { id: SERVICO_ID, nome: 'Barba', descricao: 'Barba completa', duracaoMinutos: 30, preco: 35.5, ativo: true },
  { id: OUTRO_SERVICO_ID, nome: 'Corte', descricao: null, duracaoMinutos: 60, preco: 50, ativo: true },
]
const HORARIO = {
  id: HORARIO_ID,
  prestadorId: PRESTADOR_ID,
  diaSemana: 'SEG',
  horaInicio: '09:00:00',
  horaFim: '18:00:00',
  intervaloInicio: '12:00:00',
  intervaloFim: '13:00:00',
}

function dataFutura(dias = 3) {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

function token(tipo) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    userId: USUARIO_ID,
    tipo,
    nome: 'Usuario de teste',
    sub: 'usuario@teste.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.assinatura-de-teste`
}

// Every API call is fulfilled here; these scenarios never write to the application database.
async function preparar(page, options = {}) {
  const tipo = options.tipo ?? 'PRESTADOR'
  const jwt = token(tipo)
  const state = {
    perfil: options.perfil === null ? null : { ...PERFIL, ...options.perfil },
    horarios: (options.horarios ?? []).map((item) => ({ ...item })),
    servicos: (options.servicos ?? SERVICOS).map((item) => ({ ...item })),
    horariosLivres: options.horariosLivres ?? ['09:00:00', '09:30:00', '14:00:00'],
    requests: [],
    inesperadas: [],
  }
  estadosApi.set(page, state)
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

    expect(request.headers().authorization).toBe(`Bearer ${jwt}`)
    const body = request.postData() ? request.postDataJSON() : undefined
    state.requests.push({ method, path, body, query: Object.fromEntries(url.searchParams) })
    if (options.unauthorized) return reply(401, { status: 401, message: 'Sessao expirada' })

    if (method === 'GET' && path === '/prestadores/me') {
      return state.perfil ? reply(200, state.perfil) : reply(404, { status: 404, message: 'Perfil nao encontrado' })
    }
    if (method === 'GET' && path === '/prestadores') {
      const ativo = url.searchParams.get('ativo')
      const perfis = state.perfil ? [state.perfil] : []
      return reply(200, perfis.filter((perfil) => ativo === null || perfil.ativo === (ativo === 'true')))
    }
    if (method === 'POST' && path === '/prestadores') {
      state.perfil = { ...PERFIL, ...body }
      return reply(201, state.perfil)
    }
    if (method === 'GET' && path === PERFIL_PATH) {
      return state.perfil ? reply(200, state.perfil) : reply(404, { status: 404, message: 'Prestador nao encontrado' })
    }
    if (method === 'PUT' && path === PERFIL_PATH) {
      state.perfil = { ...state.perfil, ...body }
      return reply(200, state.perfil)
    }
    if (method === 'PATCH' && path === `${PERFIL_PATH}/status`) {
      state.perfil = { ...state.perfil, ativo: body.ativo }
      return reply(200, state.perfil)
    }
    if (method === 'DELETE' && path === PERFIL_PATH) {
      if (options.erroExcluir) return reply(409, {
        status: 409,
        message: 'Prestador possui serviços vinculados. Inative o perfil para preservar o histórico',
      })
      state.perfil = null
      state.horarios = []
      return reply(204)
    }
    if (method === 'GET' && path === `${PERFIL_PATH}/horarios`) return reply(200, state.horarios)
    if (method === 'POST' && path === `${PERFIL_PATH}/horarios`) {
      const horario = { id: HORARIO_ID, prestadorId: PRESTADOR_ID, ...body }
      state.horarios.push(horario)
      return reply(201, horario)
    }
    if (method === 'PUT' && path === `${PERFIL_PATH}/horarios/${HORARIO_ID}`) {
      const horario = { id: HORARIO_ID, prestadorId: PRESTADOR_ID, ...body }
      state.horarios = state.horarios.map((item) => item.id === HORARIO_ID ? horario : item)
      return reply(200, horario)
    }
    if (method === 'DELETE' && path === `${PERFIL_PATH}/horarios/${HORARIO_ID}`) {
      state.horarios = state.horarios.filter((item) => item.id !== HORARIO_ID)
      return reply(204)
    }
    if (method === 'GET' && path === `${PERFIL_PATH}/servicos`) return reply(200, state.servicos)
    if (method === 'GET' && path === `${PERFIL_PATH}/disponibilidade`) {
      const servico = state.servicos.find((item) => item.id === url.searchParams.get('servicoId'))
      return reply(200, {
        prestadorId: PRESTADOR_ID,
        servicoId: servico?.id,
        data: url.searchParams.get('data'),
        duracaoMinutos: servico?.duracaoMinutos,
        horarios: state.horariosLivres,
      })
    }
    state.inesperadas.push(`${method} ${path}`)
    return reply(500, { status: 500, message: `Requisicao inesperada: ${method} ${path}` })
  })
  return state
}

function esperarRequisicao(page, method, path) {
  return page.waitForRequest((request) => request.method() === method && new URL(request.url()).pathname === path)
}

async function abrirMeuNegocio(page) {
  await page.goto('/dashboard/meu-negocio')
  await expect(page.getByRole('heading', { name: 'Dados do negócio', exact: true })).toBeVisible()
}

async function preencherExpediente(page, inicio = '09:00', fim = '18:00') {
  await page.getByLabel('Início do expediente', { exact: true }).fill(inicio)
  await page.getByLabel('Fim do expediente', { exact: true }).fill(fim)
}

async function consultar(page, servicoId = SERVICO_ID, data = dataFutura()) {
  await page.getByLabel('Serviço', { exact: true }).selectOption(servicoId)
  await page.getByLabel(/^Data/).fill(data)
  await page.getByRole('button', { name: 'Consultar horários', exact: true }).click()
}

test.afterEach(async ({ page }) => {
  expect(estadosApi.get(page)?.inesperadas ?? []).toEqual([])
})

test('cliente busca prestadores e consulta detalhes sem controles de edição', async ({ page }) => {
  const state = await preparar(page, { tipo: 'CLIENTE', horarios: [HORARIO] })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: PERFIL.nomeNegocio })).toBeVisible()
  await page.getByLabel('Buscar negócio').fill('sem resultado')
  await expect(page.getByRole('heading', { name: 'Nenhum negócio encontrado' })).toBeVisible()
  await page.getByLabel('Buscar negócio').fill('jorge')
  await page.getByRole('link', { name: `Ver ${PERFIL.nomeNegocio}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sobre o negócio' })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Segunda-feira' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar dados' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar dia' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Excluir perfil|Editar horário|Remover horário/ })).toHaveCount(0)
  expect(state.requests.every((request) => request.method === 'GET')).toBe(true)
  expect(state.requests.find((request) => request.path === '/prestadores').query).toEqual({ ativo: 'true' })
  expect(state.inesperadas).toEqual([])
})

test('cliente não acessa a página de gerenciamento do próprio negócio', async ({ page }) => {
  await preparar(page, { tipo: 'CLIENTE' })
  await page.goto('/dashboard/meu-negocio')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { name: 'Prestadores', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Meu negócio', exact: true })).toHaveCount(0)
})

test('prestador sem perfil cadastra negócio e envia opcionais vazios como null', async ({ page }) => {
  const state = await preparar(page, { perfil: null })
  await page.goto('/dashboard/meu-negocio')
  await expect(page.getByRole('heading', { name: 'Cadastre seu negócio' })).toBeVisible()
  await page.getByLabel('Nome do negócio', { exact: true }).fill('  Novo negócio  ')
  const sent = esperarRequisicao(page, 'POST', '/prestadores')
  await page.getByRole('button', { name: 'Criar perfil', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({
    nomeNegocio: 'Novo negócio', descricao: null, endereco: null, telefoneComercial: null,
  })
  await expect(page.getByRole('heading', { name: 'Dados do negócio', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Perfil do negócio criado.' })).toBeVisible()
  await expect(page.getByLabel('Nome do negócio', { exact: true })).toHaveValue('Novo negócio')
  await expect(page.getByRole('button', { name: 'Adicionar dia' })).toBeEnabled()
  expect(state.perfil.usuarioId).toBe(USUARIO_ID)
})

test('edição aceita os limites dos campos e preserva dados ao salvar', async ({ page }) => {
  await preparar(page)
  await abrirMeuNegocio(page)
  const campos = [
    ['Nome do negócio', 'á'.repeat(150), 150],
    [/^Descrição/, 'ç'.repeat(500), 500],
    [/^Endereço/, 'é'.repeat(255), 255],
    [/^Telefone comercial/, '1'.repeat(20), 20],
  ]
  for (const [label, value, limit] of campos) {
    const input = page.getByLabel(label, { exact: typeof label === 'string' })
    await expect(input).toHaveAttribute('maxlength', String(limit))
    await input.fill(value)
    await input.press('End')
    await input.press('x')
    await expect(input).toHaveValue(value)
  }
  const sent = esperarRequisicao(page, 'PUT', PERFIL_PATH)
  await page.getByRole('button', { name: 'Salvar dados', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({
    nomeNegocio: campos[0][1], descricao: campos[1][1], endereco: campos[2][1], telefoneComercial: campos[3][1],
  })
  await expect(page.getByRole('status').filter({ hasText: 'Dados do negócio atualizados.' })).toBeVisible()
  await expect(page.getByLabel('Nome do negócio', { exact: true })).toHaveValue(campos[0][1])
})

test('inativação preserva perfil e reativação libera a consulta novamente', async ({ page }) => {
  const state = await preparar(page)
  await abrirMeuNegocio(page)
  await page.getByLabel('Nome do negócio', { exact: true }).fill('Rascunho não salvo')
  await page.getByLabel(/^Descrição/).fill('Descrição ainda em edição')
  let sent = esperarRequisicao(page, 'PATCH', `${PERFIL_PATH}/status`)
  await page.getByRole('button', { name: 'Inativar negócio', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({ ativo: false })
  await expect(page.getByText('Este prestador está inativo e não oferece horários disponíveis.')).toBeVisible()
  await expect(page.getByLabel('Nome do negócio', { exact: true })).toHaveValue('Rascunho não salvo')
  await expect(page.getByLabel(/^Descrição/)).toHaveValue('Descrição ainda em edição')
  expect(state.perfil.nomeNegocio).toBe(PERFIL.nomeNegocio)
  sent = esperarRequisicao(page, 'PATCH', `${PERFIL_PATH}/status`)
  await page.getByRole('button', { name: 'Reativar negócio', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({ ativo: true })
  await expect(page.getByLabel('Serviço', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nome do negócio', { exact: true })).toHaveValue('Rascunho não salvo')
  await expect(page.getByLabel(/^Descrição/)).toHaveValue('Descrição ainda em edição')
  expect(state.perfil.ativo).toBe(true)
  expect(state.requests.filter((request) => request.method === 'PUT')).toEqual([])
})

test('exclusão exige confirmação, permite cancelar e volta ao cadastro após sucesso', async ({ page }) => {
  const state = await preparar(page)
  await abrirMeuNegocio(page)
  await page.getByRole('button', { name: 'Excluir perfil', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Confirmar exclusão do perfil' })).toBeVisible()
  expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0)
  await page.getByRole('group', { name: 'Confirmar exclusão do perfil' }).getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Confirmar exclusão do perfil' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Excluir perfil', exact: true }).click()
  const sent = esperarRequisicao(page, 'DELETE', PERFIL_PATH)
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await sent
  await expect(page.getByRole('heading', { name: 'Cadastre seu negócio' })).toBeVisible()
  expect(state.perfil).toBeNull()
})

test('conflito ao excluir apresenta orientação e preserva o perfil', async ({ page }) => {
  const state = await preparar(page, { erroExcluir: true })
  await abrirMeuNegocio(page)
  await page.getByRole('button', { name: 'Excluir perfil', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Inative o perfil para preservar o histórico')
  await expect(page.getByLabel('Nome do negócio', { exact: true })).toHaveValue(PERFIL.nomeNegocio)
  await expect(page.getByRole('button', { name: 'Inativar negócio' })).toBeEnabled()
  expect(state.perfil).toEqual(PERFIL)
})

test('horários permitem cadastrar, editar removendo intervalo e excluir com confirmação', async ({ page }) => {
  const state = await preparar(page)
  await abrirMeuNegocio(page)
  await page.getByRole('button', { name: 'Adicionar dia', exact: true }).click()
  await page.getByLabel('Dia da semana', { exact: true }).selectOption('SEG')
  await preencherExpediente(page)
  await page.getByRole('checkbox', { name: 'Incluir intervalo de almoço ou pausa' }).check()
  await page.getByLabel('Início do intervalo', { exact: true }).fill('12:00')
  await page.getByLabel('Fim do intervalo', { exact: true }).fill('13:00')
  let sent = esperarRequisicao(page, 'POST', `${PERFIL_PATH}/horarios`)
  await page.getByRole('button', { name: 'Salvar horário', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({
    diaSemana: 'SEG', horaInicio: '09:00', horaFim: '18:00', intervaloInicio: '12:00', intervaloFim: '13:00',
  })
  await expect(page.getByRole('rowheader', { name: 'Segunda-feira' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar horário de Segunda-feira', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Incluir intervalo de almoço ou pausa' }).uncheck()
  await page.getByLabel('Fim do expediente', { exact: true }).fill('17:00')
  sent = esperarRequisicao(page, 'PUT', `${PERFIL_PATH}/horarios/${HORARIO_ID}`)
  await page.getByRole('button', { name: 'Salvar horário', exact: true }).click()
  expect((await sent).postDataJSON()).toEqual({
    diaSemana: 'SEG', horaInicio: '09:00', horaFim: '17:00', intervaloInicio: null, intervaloFim: null,
  })
  await expect(page.getByRole('cell', { name: 'Sem intervalo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remover horário de Segunda-feira', exact: true }).click()
  expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0)
  sent = esperarRequisicao(page, 'DELETE', `${PERFIL_PATH}/horarios/${HORARIO_ID}`)
  await page.getByRole('button', { name: 'Confirmar remoção', exact: true }).click()
  await sent
  await expect(page.getByText('Nenhum horário de funcionamento cadastrado.')).toBeVisible()
  expect(state.horarios).toEqual([])
})

test('validação impede expediente invertido e intervalo fora do expediente antes da API', async ({ page }) => {
  const state = await preparar(page)
  await abrirMeuNegocio(page)
  await page.getByRole('button', { name: 'Adicionar dia', exact: true }).click()
  await preencherExpediente(page, '18:00', '09:00')
  await page.getByRole('button', { name: 'Salvar horário', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('O início do expediente deve ser anterior ao fim')
  await preencherExpediente(page)
  await page.getByRole('checkbox', { name: 'Incluir intervalo de almoço ou pausa' }).check()
  await page.getByLabel('Início do intervalo', { exact: true }).fill('08:00')
  await page.getByLabel('Fim do intervalo', { exact: true }).fill('10:00')
  await page.getByRole('button', { name: 'Salvar horário', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('O intervalo deve ficar dentro do expediente.')
  expect(state.requests.filter((request) => request.method !== 'GET')).toEqual([])
})

test('disponibilidade usa nomes de serviços e envia serviço e data escolhidos', async ({ page }) => {
  const state = await preparar(page, { tipo: 'CLIENTE' })
  await page.goto(DETALHES_PATH)
  const select = page.getByLabel('Serviço', { exact: true })
  await expect(select.getByRole('option', { name: /Barba.*30 min.*35,50/ })).toHaveCount(1)
  await expect(select.getByRole('option', { name: /Corte.*60 min.*50,00/ })).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: /UUID|ID do serviço/i })).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(SERVICO_ID)
  await expect(page.getByRole('button', { name: 'Consultar horários' })).toBeDisabled()
  const data = dataFutura()
  const sent = esperarRequisicao(page, 'GET', `${PERFIL_PATH}/disponibilidade`)
  await consultar(page, SERVICO_ID, data)
  expect(Object.fromEntries(new URL((await sent).url()).searchParams)).toEqual({ servicoId: SERVICO_ID, data })
  await expect(page.getByRole('list', { name: 'Horários livres' }).getByRole('listitem')).toHaveText(['09:00', '09:30', '14:00'])
  expect(state.inesperadas).toEqual([])
})

test('resultado vazio orienta o cliente e desaparece ao mudar data ou serviço', async ({ page }) => {
  const state = await preparar(page, { tipo: 'CLIENTE', horariosLivres: [] })
  await page.goto(DETALHES_PATH)
  await consultar(page)
  const vazio = page.getByText('Não há horários livres para este serviço neste dia. Escolha outra data.')
  await expect(vazio).toBeVisible()
  await page.getByLabel(/^Data/).fill(dataFutura(4))
  await expect(vazio).toHaveCount(0)
  state.horariosLivres = ['10:00:00']
  await page.getByRole('button', { name: 'Consultar horários', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Horários livres' })).toContainText('10:00')
  await page.getByLabel('Serviço', { exact: true }).selectOption(OUTRO_SERVICO_ID)
  await expect(page.getByRole('list', { name: 'Horários livres' })).toHaveCount(0)
})

test('horário inválido retornado pela API apresenta erro e permite tentar novamente', async ({ page }) => {
  const state = await preparar(page, { tipo: 'CLIENTE', horariosLivres: ['25:61:00'] })
  await page.goto(DETALHES_PATH)
  await consultar(page)
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar os horários. Tente novamente.')
  await expect(page.getByRole('list', { name: 'Horários livres' })).toHaveCount(0)
  state.horariosLivres = ['11:00:00']
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Horários livres' })).toContainText('11:00')
})

test('administrador filtra inativos e gerencia o perfil de outro usuário', async ({ page }) => {
  const state = await preparar(page, { tipo: 'ADMIN', perfil: { usuarioId: OUTRO_USUARIO_ID, ativo: false } })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Nenhum prestador disponível' })).toBeVisible()
  await page.getByLabel('Situação', { exact: true }).selectOption('inativos')
  await page.getByRole('link', { name: `Ver ${PERFIL.nomeNegocio}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dados do negócio', exact: true })).toBeVisible()
  await page.getByLabel('Nome do negócio', { exact: true }).fill('Negócio administrado')
  const sent = esperarRequisicao(page, 'PUT', PERFIL_PATH)
  await page.getByRole('button', { name: 'Salvar dados', exact: true }).click()
  expect((await sent).postDataJSON().nomeNegocio).toBe('Negócio administrado')
  await expect(page.getByRole('heading', { name: 'Negócio administrado', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reativar negócio' })).toBeEnabled()
  expect(state.perfil.usuarioId).toBe(OUTRO_USUARIO_ID)
  expect(state.requests.some((request) => request.path === '/prestadores' && request.query.ativo === 'false')).toBe(true)
})

test('resposta 401 encerra a sessão e remove o token', async ({ page }) => {
  await preparar(page, { unauthorized: true })
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('agenda.token'))).toBeNull()
})

test('gerenciamento permanece utilizável em telas pequenas sem overflow do documento', async ({ page }, testInfo) => {
  await preparar(page, { horarios: [HORARIO], perfil: { nomeNegocio: 'N'.repeat(150), descricao: 'D'.repeat(500) } })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(DETALHES_PATH)
  await expect(page.getByRole('heading', { name: 'N'.repeat(150), exact: true })).toBeVisible()
  await expect(page.getByLabel('Serviço', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('prestador-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Adicionar dia', exact: true }).click()
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 })
    await expect(page.getByLabel('Nome do negócio', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Dia da semana', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar horário', exact: true })).toBeVisible()
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }))
    expect(metrics.body).toBeLessThanOrEqual(metrics.viewport)
    expect(metrics.document).toBeLessThanOrEqual(metrics.viewport)
  }
  await page.screenshot({ path: testInfo.outputPath('prestador-mobile.png'), fullPage: true })
})
