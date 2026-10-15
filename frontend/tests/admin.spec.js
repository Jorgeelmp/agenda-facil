import { expect, test } from '@playwright/test'

const API = 'http://localhost:8080'
const usuarios = [
  { id: '1', nome: 'Administrador', email: 'admin@agendafacil.com', telefone: null, tipo: 'ADMIN', criadoEm: '2026-10-15T10:30:00.123456' },
  { id: '2', nome: 'Ana Cliente', email: 'ana@teste.com', telefone: '48999999999', tipo: 'CLIENTE', criadoEm: '2026-10-14T10:30:00' },
  { id: '3', nome: 'Bruno Prestador', email: 'bruno@teste.com', telefone: null, tipo: 'PRESTADOR', criadoEm: '2026-10-13T10:30:00' },
]
const states = new WeakMap()

async function setup(page, tipo = 'ADMIN') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256' })}.${encode({ userId: '1', tipo, nome: 'Administrador', sub: 'admin@agendafacil.com', exp: Math.floor(Date.now() / 1000) + 3600 })}.teste`
  const state = { fail: false, requests: [], unexpected: [] }
  states.set(page, state)
  await page.addInitScript((jwt) => localStorage.setItem('agenda.token', jwt), token)
  await page.route(`${API}/**`, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const reply = (status, data) => route.fulfill({ status, headers: { 'access-control-allow-origin': 'http://127.0.0.1:5174', 'access-control-allow-headers': 'Authorization, Content-Type' }, ...(data === undefined ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
    if (req.method() === 'OPTIONS') return reply(204)
    state.requests.push(path)
    if (req.method() === 'GET' && path === '/usuarios/resumo') return reply(200, { total: 3, clientes: 1, prestadores: 1, administradores: 1 })
    if (req.method() === 'GET' && path === '/usuarios') return state.fail ? reply(503, { status: 503, message: 'Usuários temporariamente indisponíveis.' }) : reply(200, usuarios)
    if (req.method() === 'GET' && path === '/prestadores') return reply(200, [])
    state.unexpected.push(`${req.method()} ${path}`)
    return reply(500, { message: 'Rota inesperada no teste' })
  })
  return state
}

test.afterEach(async ({ page }) => { expect(states.get(page)?.unexpected ?? []).toEqual([]) })

test('admin entra no painel e acessa todos os usuários pela aba', async ({ page }, info) => {
  await setup(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible()
  await expect(page.getByRole('definition')).toHaveText(['3', '1', '1', '1'])
  await page.screenshot({ path: info.outputPath('painel-admin.png'), fullPage: true })
  await page.getByRole('navigation').getByRole('link', { name: 'Usuários', exact: true }).click()
  const table = page.getByRole('table', { name: 'Lista de usuários' })
  await expect(table.getByRole('row')).toHaveCount(4)
  await expect(table).toContainText('ana@teste.com')
  await expect(table).toContainText('bruno@teste.com')
  await expect(table).not.toContainText('.123456')
  await page.screenshot({ path: info.outputPath('usuarios-admin.png'), fullPage: true })
})

test('admin busca usuário por nome e email e filtra por perfil', async ({ page }) => {
  await setup(page)
  await page.goto('/dashboard/usuarios')
  const table = page.getByRole('table', { name: 'Lista de usuários' })
  await expect(table.getByRole('row')).toHaveCount(4)
  await page.getByLabel('Buscar usuário').fill('ana@teste.com')
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(table.getByRole('rowheader', { name: 'Ana Cliente' })).toBeVisible()
  await page.getByLabel('Buscar usuário').fill('')
  await page.getByLabel('Perfil de acesso').selectOption('PRESTADOR')
  await expect(table.getByRole('rowheader', { name: 'Bruno Prestador' })).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(2)
  await page.getByLabel('Buscar usuário').fill('inexistente')
  await expect(page.getByRole('heading', { name: 'Nenhum usuário encontrado' })).toBeVisible()
})

test('cliente e prestador não acessam aba de usuários', async ({ page }) => {
  for (const tipo of ['CLIENTE', 'PRESTADOR']) {
    const state = await setup(page, tipo)
    await page.goto('/dashboard/usuarios')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Usuários', exact: true })).toHaveCount(0)
    expect(state.requests).not.toContain('/usuarios')
    expect(state.requests).not.toContain('/usuarios/resumo')
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('falha na listagem permite tentar novamente', async ({ page }) => {
  const state = await setup(page)
  state.fail = true
  await page.goto('/dashboard/usuarios')
  await expect(page.getByRole('alert')).toContainText('Usuários temporariamente indisponíveis')
  state.fail = false
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('table', { name: 'Lista de usuários' })).toBeVisible()
})

test('lista de usuários fica contida na tela do celular', async ({ page }, info) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard/usuarios')
  await expect(page.getByRole('table', { name: 'Lista de usuários' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('usuarios-mobile.png'), fullPage: true })
})
