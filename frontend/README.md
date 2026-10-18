# AgendaFácil — Front (React + Vite)

Interface do AgendaFácil para clientes, prestadores e administradores.

## Como rodar

1. Suba o backend na porta **8080** (`./mvnw spring-boot:run` na raiz do projeto).
2. Neste diretório:

```bash
npm install
npm run dev
```

3. Acesse http://localhost:5173

Para apontar para outra URL de API, crie um `.env` com `VITE_API_URL=http://host:porta` (veja `.env.example`).

## Telas por perfil

- **Cliente:** Início (próximos agendamentos e atendimentos para avaliar) → **Agendar serviço**
  (catálogo por categoria e preço) → página do prestador com o agendamento em 4 passos
  (serviço, dia, horário livre, confirmação) → **Meus agendamentos** (remarcar, cancelar, avaliar)
  → **Minhas avaliações**.
- **Prestador:** Início (checklist de configuração, agenda do dia e pedidos para confirmar) →
  **Meu negócio** (abas: dados, horários de funcionamento, serviços e prévia da agenda) →
  **Agenda** (confirmar, concluir, cancelar) → **Avaliações recebidas**.
- **Admin:** Visão geral, Usuários (com exclusão), Prestadores (gerenciar qualquer negócio),
  Serviços, Categorias, Agendamentos e Avaliações.
- Todos: **Meus dados** (nome, telefone e senha).

Se o backend responder 401 para uma requisição autenticada (token expirado/inválido), o usuário é deslogado automaticamente.
