const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const TOKEN_KEY = 'agenda.token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = tokenStorage.get()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Tente novamente.')
  }

  const text = await response.text()
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // resposta em texto puro (ex.: /test)
  }

  if (!response.ok) {
    if (response.status === 401 && auth && token) onUnauthorized()
    const message = data?.message ?? defaultMessage(response.status)
    throw new ApiError(response.status, message, data?.errors ?? [])
  }

  return data
}

function defaultMessage(status) {
  if (status === 401) return 'Sessão expirada ou token inválido.'
  if (status === 403) return 'Acesso negado.'
  return `Erro inesperado (${status}).`
}

export const authApi = {
  login: (email, senha) => request('/auth/login', { method: 'POST', body: { email, senha }, auth: false }),
  register: (dados) => request('/auth/register', { method: 'POST', body: dados, auth: false }),
}

export const prestadorApi = {
  listar: (ativo, options) => request(`/prestadores${ativo === undefined ? '' : `?ativo=${ativo}`}`, options),
  buscar: (id, options) => request(`/prestadores/${id}`, options),
  meuPerfil: (options) => request('/prestadores/me', options),
  criar: (body) => request('/prestadores', { method: 'POST', body }),
  atualizar: (id, body) => request(`/prestadores/${id}`, { method: 'PUT', body }),
  alterarStatus: (id, ativo) => request(`/prestadores/${id}/status`, { method: 'PATCH', body: { ativo } }),
  excluir: (id) => request(`/prestadores/${id}`, { method: 'DELETE' }),
  servicos: (id, options) => request(`/prestadores/${id}/servicos`, options),
  disponibilidade: (id, servicoId, data, options) => {
    const query = new URLSearchParams({ servicoId, data })
    return request(`/prestadores/${id}/disponibilidade?${query}`, options)
  },
}

export const horarioApi = {
  listar: (prestadorId, options) => request(`/prestadores/${prestadorId}/horarios`, options),
  criar: (prestadorId, body) => request(`/prestadores/${prestadorId}/horarios`, { method: 'POST', body }),
  atualizar: (prestadorId, id, body) => request(`/prestadores/${prestadorId}/horarios/${id}`, { method: 'PUT', body }),
  excluir: (prestadorId, id) => request(`/prestadores/${prestadorId}/horarios/${id}`, { method: 'DELETE' }),
}

export function decodeToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}
