import { expect, test } from '@playwright/test'

const API = 'http://localhost:8080'
const P = '11111111-1111-4111-8111-111111111111'
const U = '22222222-2222-4222-8222-222222222222'
const C1 = '33333333-3333-4333-8333-333333333333'
const C2 = '44444444-4444-4444-8444-444444444444'
const S = '55555555-5555-4555-8555-555555555555'
const BASE = `/prestadores/${P}/servicos`
const MANAGE = `/dashboard/prestadores/${P}/servicos`
const categories = [{ id: C1, nome: 'Beleza', descricao: 'Cuidados pessoais' }, { id: C2, nome: 'Bem-estar', descricao: null }]
const initial = { id: S, prestadorId: P, nomeNegocio: 'Espaço Leandro', nome: 'Corte completo', descricao: 'Corte e finalização.', preco: 50.25, duracaoMinutos: 30, ativo: true, categorias: categories }
const states = new WeakMap()

async function setup(page, options = {}) {
  const tipo = options.tipo ?? 'PRESTADOR'
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const jwt = `${encode({ alg: 'HS256' })}.${encode({ userId: U, tipo, nome: 'Leandro', sub: 'teste@teste.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.teste`
  const state = { categories: structuredClone(options.categories ?? categories), services: structuredClone(options.services ?? [initial]), requests: [], unexpected: [], failList: options.failList ?? 0, failCategories: options.failCategories ?? 0, failSave: options.failSave ?? 0 }
  states.set(page, state)
  await page.addInitScript((token) => localStorage.setItem('agenda.token', token), jwt)
  await page.route(`${API}/**`, async (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const path = url.pathname
    const reply = (status, data) => route.fulfill({ status, headers: { 'access-control-allow-origin': 'http://127.0.0.1:5174', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type' }, ...(data === undefined ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
    if (method === 'OPTIONS') return reply(204)
    expect(req.headers().authorization).toBe(`Bearer ${jwt}`)
    const body = req.postData() ? req.postDataJSON() : null
    state.requests.push({ path, method, body, query: Object.fromEntries(url.searchParams) })
    if (method === 'GET' && path === `/prestadores/${P}`) return reply(200, { id: P, usuarioId: U, nomeNegocio: 'Espaço Leandro', ativo: true })
    if (method === 'GET' && path === '/categorias') {
      if (state.failCategories > 0) return reply(503, { status: 503, message: 'Categorias temporariamente indisponíveis.' })
      return reply(200, state.categories)
    }
    if (method === 'POST' && path === '/categorias') {
      const category = { id: '66666666-6666-4666-8666-666666666666', ...body }
      state.categories.push(category)
      return reply(201, category)
    }
    if (path.startsWith('/categorias/')) {
      const id = path.split('/').at(-1)
      if (method === 'PUT') {
        const item = state.categories.find((c) => c.id === id)
        Object.assign(item, body)
        return reply(200, item)
      }
      if (method === 'DELETE') {
        if (state.services.some((s) => s.categorias.some((c) => c.id === id))) return reply(409, { status: 409, message: 'Categoria vinculada a serviços. Remova os vínculos antes de excluí-la' })
        state.categories = state.categories.filter((c) => c.id !== id)
        return reply(204)
      }
    }
    if (method === 'GET' && path === '/servicos') {
      if (state.failList > 0) return reply(503, { status: 503, message: 'Serviços temporariamente indisponíveis.' })
      const q = Object.fromEntries(url.searchParams)
      return reply(200, state.services.filter((s) => s.ativo && (!q.nome || s.nome.toLowerCase().includes(q.nome.toLowerCase())) && (!q.categoriaId || s.categorias.some((c) => c.id === q.categoriaId)) && (!q.precoMin || s.preco >= Number(q.precoMin)) && (!q.precoMax || s.preco <= Number(q.precoMax))))
    }
    if (method === 'GET' && path === `${BASE}/gestao`) return options.forbidden ? reply(403, { status: 403, message: 'Sem permissão para gerenciar este prestador' }) : reply(200, state.services)
    if ((method === 'POST' && path === BASE) || (method === 'PUT' && path.startsWith(`${BASE}/`))) {
      if (state.failSave-- > 0) return reply(400, { status: 400, message: 'Dados inválidos', errors: ['Confira o preço do serviço.'] })
      const id = method === 'POST' ? '77777777-7777-4777-8777-777777777777' : path.split('/').at(-1)
      const service = { ...initial, ...body, id, categorias: state.categories.filter((c) => body.categoriaIds.includes(c.id)) }
      state.services = [...state.services.filter((s) => s.id !== id), service]
      return reply(method === 'POST' ? 201 : 200, service)
    }
    if (method === 'DELETE' && path.startsWith(`${BASE}/`)) {
      if (options.history) return reply(409, { status: 409, message: 'Serviço possui agendamentos. Inative-o para preservar o histórico' })
      state.services = state.services.filter((s) => s.id !== path.split('/').at(-1))
      return reply(204)
    }
    state.unexpected.push(`${method} ${path}`)
    return reply(500, { message: 'Rota inesperada no teste' })
  })
  return state
}

test.afterEach(async ({ page }) => { expect(states.get(page)?.unexpected ?? []).toEqual([]) })

test('cliente combina filtros e limpa a busca', async ({ page }, info) => {
  const state = await setup(page, { tipo: 'CLIENTE', services: [initial, { ...initial, id: 'outro', nome: 'Massagem', preco: 100, categorias: [categories[1]] }] })
  await page.goto('/dashboard/servicos')
  await expect(page.getByRole('heading', { name: 'Corte completo', exact: true })).toBeVisible()
  await page.getByLabel('Buscar serviço', { exact: true }).fill('Corte')
  await page.getByLabel('Categoria', { exact: true }).selectOption(C1)
  await page.getByLabel('Preço mínimo (R$)', { exact: true }).fill('50')
  await page.getByLabel('Preço máximo (R$)', { exact: true }).fill('50.25')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 serviço encontrado' })).toBeVisible()
  expect(state.requests.filter((r) => r.path === '/servicos').at(-1).query).toEqual({ nome: 'Corte', categoriaId: C1, precoMin: '50', precoMax: '50.25' })
  await expect(page.getByRole('heading', { name: 'Massagem' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver horários' })).toHaveAttribute('href', `/dashboard/prestadores/${P}`)
  await page.screenshot({ path: info.outputPath('catalogo-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await expect(page.getByRole('heading', { name: 'Massagem' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Categorias', exact: true })).toHaveCount(0)
})

test('filtro de preço invertido é barrado antes da consulta', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/dashboard/servicos')
  await expect(page.getByRole('heading', { name: 'Corte completo' })).toBeVisible()
  const before = state.requests.filter((r) => r.path === '/servicos').length
  await page.getByLabel('Preço mínimo (R$)').fill('100')
  await page.getByLabel('Preço máximo (R$)').fill('50')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Preço mínimo não pode superar')
  expect(state.requests.filter((r) => r.path === '/servicos')).toHaveLength(before)
})

test('histórico de navegação restaura os filtros visíveis e os resultados', async ({ page }) => {
  await setup(page, { tipo: 'CLIENTE' })
  await page.goto('/dashboard/servicos?nome=Corte&precoMax=70')
  await expect(page.getByLabel('Buscar serviço', { exact: true })).toHaveValue('Corte')
  await page.getByLabel('Buscar serviço', { exact: true }).fill('inexistente')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nenhum serviço encontrado' })).toBeVisible()
  await page.goBack()
  await expect(page.getByLabel('Buscar serviço', { exact: true })).toHaveValue('Corte')
  await expect(page.getByLabel('Preço máximo (R$)', { exact: true })).toHaveValue('70')
  await expect(page.getByRole('heading', { name: 'Corte completo', exact: true })).toBeVisible()
})

test('busca sem resultado e falha de rede permitem recuperação', async ({ page }) => {
  const state = await setup(page, { failList: 1 })
  await page.goto('/dashboard/servicos')
  await expect(page.getByRole('alert')).toContainText('Serviços temporariamente indisponíveis')
  state.failList = 0
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Corte completo' })).toBeVisible()
  await page.getByLabel('Buscar serviço', { exact: true }).fill('inexistente')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Nenhum serviço encontrado' })).toBeVisible()
})

test('falha de categorias permite recarregar sem perder os serviços', async ({ page }) => {
  const state = await setup(page, { failCategories: 1 })
  await page.goto('/dashboard/servicos')
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar as categorias')
  await expect(page.getByRole('heading', { name: 'Corte completo' })).toBeVisible()
  state.failCategories = 0
  await page.getByRole('button', { name: 'Recarregar categorias' }).click()
  await expect(page.getByLabel('Categoria', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('Categoria', { exact: true }).getByRole('option')).toHaveCount(3)
})

test('admin cria edita e exclui categoria', async ({ page }, info) => {
  const state = await setup(page, { tipo: 'ADMIN' })
  await page.goto('/dashboard/categorias')
  await page.getByLabel('Nome da categoria').fill('  Manutenção  ')
  await page.getByLabel(/^Descrição/).fill('  Reparos  ')
  await page.getByRole('button', { name: 'Criar categoria', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Categoria criada' })).toBeVisible()
  expect(state.requests.find((r) => r.method === 'POST').body).toEqual({ nome: 'Manutenção', descricao: 'Reparos' })
  await page.getByRole('button', { name: 'Editar Manutenção', exact: true }).click()
  await page.getByLabel('Nome da categoria').fill('Reparos domésticos')
  await page.getByRole('button', { name: 'Salvar categoria' }).click()
  await expect(page.getByRole('heading', { name: 'Reparos domésticos' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('categorias-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Excluir Reparos domésticos', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Categoria excluída' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reparos domésticos' })).toHaveCount(0)
})

test('categoria vinculada mostra conflito e continua na lista', async ({ page }) => {
  await setup(page, { tipo: 'ADMIN' })
  await page.goto('/dashboard/categorias')
  await page.getByRole('button', { name: 'Excluir Beleza', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Categoria vinculada a serviços')
  await expect(page.getByRole('heading', { name: 'Beleza', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Confirmar exclusão de categoria' })).toHaveCount(0)
})

test('cliente não acessa gestão nem categorias administrativas', async ({ page }) => {
  const state = await setup(page, { tipo: 'CLIENTE' })
  await page.goto('/dashboard/categorias')
  await expect(page).toHaveURL('/dashboard/servicos')
  await page.goto(MANAGE)
  await expect(page.getByRole('alert')).toContainText('Você não tem permissão para gerenciar serviços')
  expect(state.requests.filter((r) => r.method !== 'GET')).toEqual([])
  expect(state.requests.some((r) => r.path === `${BASE}/gestao`)).toBe(false)
})

async function fillService(page, nome = 'Barba completa') {
  await page.getByLabel('Nome do serviço', { exact: true }).fill(nome)
  await page.getByLabel('Duração (minutos)', { exact: true }).fill('45')
  await page.getByLabel('Preço (R$)', { exact: true }).fill('35.50')
}

test('prestador cria edita associa inativa e exclui serviço', async ({ page }, info) => {
  const state = await setup(page)
  await page.goto(MANAGE)
  await fillService(page)
  await page.getByLabel('Beleza', { exact: true }).check()
  await page.getByLabel('Bem-estar', { exact: true }).check()
  await page.getByRole('button', { name: 'Criar serviço', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Serviço criado' })).toBeVisible()
  expect(state.requests.find((r) => r.method === 'POST').body).toEqual({ nome: 'Barba completa', descricao: null, duracaoMinutos: 45, preco: 35.5, ativo: true, categoriaIds: [C1, C2] })
  await page.getByRole('button', { name: 'Editar Barba completa', exact: true }).click()
  await page.getByLabel('Bem-estar', { exact: true }).uncheck()
  await page.getByLabel('Serviço ativo', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Salvar serviço', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Serviço atualizado' })).toBeVisible()
  expect(state.requests.find((r) => r.method === 'PUT').body.categoriaIds).toEqual([C1])
  expect(state.services.find((s) => s.nome === 'Barba completa').ativo).toBe(false)
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('gestao-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Excluir Barba completa', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Serviço excluído' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Barba completa', exact: true })).toHaveCount(0)
})

test('serviço exige ao menos uma categoria e mantém campos após erro do servidor', async ({ page }) => {
  const state = await setup(page, { failSave: 1 })
  await page.goto(MANAGE)
  await fillService(page)
  await page.getByRole('button', { name: 'Criar serviço', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Selecione pelo menos uma categoria')
  expect(state.requests.filter((r) => r.method === 'POST')).toHaveLength(0)
  await page.getByLabel('Beleza', { exact: true }).check()
  await page.getByRole('button', { name: 'Criar serviço', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Confira o preço do serviço')
  await expect(page.getByLabel('Nome do serviço', { exact: true })).toHaveValue('Barba completa')
  await page.getByRole('button', { name: 'Criar serviço', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Serviço criado' })).toBeVisible()
})

test('serviço com histórico orienta inativação e preserva o registro', async ({ page }) => {
  const state = await setup(page, { history: true })
  await page.goto(MANAGE)
  await page.getByRole('button', { name: 'Excluir Corte completo', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Inative-o para preservar o histórico')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Editar Corte completo', exact: true }).click()
  await page.getByLabel('Serviço ativo', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Salvar serviço', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Serviço atualizado' })).toBeVisible()
  expect(state.services).toHaveLength(1)
  expect(state.services[0].ativo).toBe(false)
})

test('outro prestador recebe mensagem de acesso negado sem formulário', async ({ page }) => {
  await setup(page, { forbidden: true })
  await page.goto(MANAGE)
  await expect(page.getByRole('alert')).toContainText('Sem permissão para gerenciar este prestador')
  await expect(page.getByRole('button', { name: 'Criar serviço', exact: true })).toHaveCount(0)
})

test('negócio sem categorias orienta procurar administrador', async ({ page }) => {
  await setup(page, { categories: [], services: [] })
  await page.goto(MANAGE)
  await expect(page.getByText('Uma categoria precisa ser cadastrada por um administrador antes de criar serviços.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar serviço', exact: true })).toHaveCount(0)
})

test('gestão funciona em celular sem transbordamento horizontal', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto(MANAGE)
  await expect(page.getByRole('heading', { name: 'Serviços cadastrados' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('gestao-mobile.png'), fullPage: true })
})
