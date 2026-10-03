# AgendaFácil

## Como rodar

### 1. Banco de dados

Crie um banco vazio chamado `agendaFacil` no PostgreSQL:

```sql
CREATE DATABASE "agendaFacil";
```

### 2. Backend

Ajuste o usuário e a senha do seu PostgreSQL em `src/main/resources/application.properties`, depois rode na raiz do projeto:

```bash
./mvnw spring-boot:run
```

A API sobe em `http://localhost:8080`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`.
