// Máscara de telefone brasileiro enquanto digita:
// celular (48) 99999-9999 e fixo (48) 3333-4444.
export function mascaraTelefone(valor) {
  const d = String(valor ?? '').replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const numero = d.slice(2)
  if (numero.length <= 4) return `(${ddd}) ${numero}`
  const meio = d.length === 11 ? 5 : 4
  return `(${ddd}) ${numero.slice(0, meio)}-${numero.slice(meio)}`
}

// Vazio é aceito (telefone é opcional); preenchido precisa ter DDD + 8 ou 9 dígitos.
export function telefoneValido(valor) {
  const total = String(valor ?? '').replace(/\D/g, '').length
  return total === 0 || total === 10 || total === 11
}
