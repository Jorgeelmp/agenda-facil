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

## Administrador inicial

Na inicialização, `AdminInitializer` implementa `CommandLineRunner` e cria uma
conta ADMIN somente quando ainda não existe nenhum administrador no banco.

- Email padrão: `admin@agendafacil.com`
- Senha padrão: `Admin@123`

A senha é armazenada com BCrypt. Reiniciar a aplicação não duplica a conta nem
redefine a senha de um administrador existente. Para definir outras credenciais
antes da primeira inicialização, use `ADMIN_EMAIL` e `ADMIN_PASSWORD`:

```powershell
$env:ADMIN_EMAIL = 'gestao@empresa.com'
$env:ADMIN_PASSWORD = 'SuaSenhaEscolhida'
.\mvnw.cmd spring-boot:run
```

Se o email configurado já pertencer a uma conta sem perfil ADMIN, a inicialização
informa o conflito para que outro `ADMIN_EMAIL` seja configurado; a conta existente
não é promovida automaticamente.

Depois de entrar como ADMIN, `/dashboard` abre o painel administrativo com as
contagens de contas e os acessos à gestão. A aba **Usuários** lista todas as contas
com busca por nome/email e filtro de perfil. `GET /usuarios` e
`GET /usuarios/resumo` são exclusivos de ADMIN e retornam DTOs sem senhas.

Os horários de expediente, intervalo e disponibilidade da tela de prestador são
exibidos em `HH:mm`. O formulário grava horários com precisão de minutos.


## Documentação da API (Swagger)

Com o backend rodando, acesse `http://localhost:8080/swagger-ui.html`. Para testar
rotas protegidas, faça `POST /auth/login`, copie o `token` e clique em **Authorize**.

## Dados de demonstração

Na primeira inicialização, `DataSeeder` popula o banco com categorias, prestadores,
horários, serviços, clientes, agendamentos e avaliações. Ele roda uma única vez e
pode ser desligado com `SEED_ENABLED=false`. Todas as contas usam a senha `Senha@123`:

- Clientes: `cliente1@seed.agendafacil.com` até `cliente80@seed.agendafacil.com`
- Prestadores: `prestador1@seed.agendafacil.com` até `prestador22@seed.agendafacil.com`

## Contas de usuário

- `GET /usuarios/me` e `PUT /usuarios/me`: qualquer usuário consulta e edita o próprio
  nome, telefone e senha (a troca de senha exige a senha atual). A tela é **Meus dados**.
- `DELETE /usuarios/{id}`: exclusivo de ADMIN. Não é possível excluir a própria conta,
  nem contas com negócio cadastrado ou com agendamentos (o histórico é preservado).
