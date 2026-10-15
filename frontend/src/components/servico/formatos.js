export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function validarPreco(valor) {
  return /^\d{1,8}(\.\d{1,2})?$/.test(String(valor)) && Number(valor) <= 99999999.99
}
