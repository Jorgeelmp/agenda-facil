# AgendaFácil — Front (React + Vite)

Front de login/cadastro para testar a autenticação JWT do backend `agenda`.

## Como rodar

1. Suba o backend (`agenda`) na porta **8080** (`./mvnw spring-boot:run`).
2. Neste diretório:

```bash
npm install
npm run dev
```

3. Acesse http://localhost:5173

Para apontar para outra URL de API, crie um `.env` com `VITE_API_URL=http://host:porta` (veja `.env.example`).

## Telas

- **/login** — `POST /auth/login`, salva o token no `localStorage`.
- **/cadastro** — `POST /auth/register` (Cliente ou Prestador).
- **/dashboard** (protegida) — página inicial após o login (placeholder).

Se o backend responder 401 para uma requisição autenticada (token expirado/inválido), o usuário é deslogado automaticamente.
