# Leandro — Serviços e Categorias

## Escopo e análise do documento

Fonte: `Documento_Analise_AgendaFacil (1).pdf`, páginas 2, 3, 5 e 6.

A responsabilidade de Leandro é implementar Serviço e Categoria: entidades, DTOs,
validações, repositórios, regras de negócio, CRUD REST, associação N:N e busca por
categoria/preço. Os requisitos diretamente atendidos são RF05 e RF06. RF11 orienta
a autorização da gestão de categorias; RF12 e RNF01/02/04/06/09 orientam validação,
arquitetura, persistência, tempo de consulta e respostas de erro.

O frontend foi incluído conforme solicitado: catálogo para usuários autenticados,
gestão de serviços pelo dono do negócio ou ADMIN e gestão de categorias por ADMIN.

### Diagnóstico inicial

| Área | Situação encontrada | Solução implementada |
| --- | --- | --- |
| Modelo | `Servico`, `Categoria` e a associação N:N já mapeados | Reutilização das entidades e da tabela `servico_categoria` |
| Banco | Migrações V4, V5 e V6 já criavam as tabelas | Migrações adicionais de integridade, sem recriação das tabelas |
| Serviços | Somente GET de serviços ativos por prestador | Criação, consulta detalhada, edição, exclusão e listagem de gestão |
| Categorias | Sem repositório, serviço ou endpoints | CRUD completo com DTOs e autorização de ADMIN |
| Associação | Sem forma de gravar vínculos pela API/interface | Seleção de uma ou mais categorias na criação/edição |
| Busca | Sem catálogo ou filtros de serviços | Filtros combináveis executados no banco |
| Interface | Sem telas dos dois módulos | Catálogo, gestão de serviços e gestão de categorias |

As integrações nas telas de negócio se limitam ao acesso à gestão de serviços.
O fluxo existente de disponibilidade continua consumindo o GET de serviços ativos
por prestador. Esse endpoint conserva seu contrato original; as novas consultas
detalhadas incluem categorias e identificação do negócio.

## Permissões

| Operação | CLIENTE | PRESTADOR | ADMIN |
| --- | --- | --- | --- |
| Consultar categorias | Sim | Sim | Sim |
| Criar, editar ou excluir categoria | Não | Não | Sim |
| Consultar catálogo de serviços ativos de negócios ativos | Sim | Sim | Sim |
| Consultar serviço ativo de negócio ativo | Sim | Sim | Sim |
| Consultar serviço inativo ou de negócio inativo | Não | Apenas do próprio negócio | Sim |
| Listar gestão, criar, editar ou excluir serviço | Não | Apenas do próprio negócio | Qualquer negócio |

Todas as rotas exigem JWT válido. O backend confere a propriedade do negócio,
além da autorização por papel; ocultar botões no frontend não é a autorização.
O prestador é determinado pela URL, sem aceitar troca de proprietário no JSON.
Um serviço de outro prestador não pode ser acessado usando o identificador do
negócio errado.

## Rotas REST

| Método | Rota | Comportamento |
| --- | --- | --- |
| GET | `/categorias` | Lista categorias ordenadas por nome |
| GET | `/categorias/{id}` | Consulta uma categoria |
| POST | `/categorias` | Cria categoria; retorna 201 e Location |
| PUT | `/categorias/{id}` | Atualiza nome e descrição |
| DELETE | `/categorias/{id}` | Exclui categoria sem vínculos; retorna 204 |
| GET | `/servicos` | Catálogo com filtros opcionais |
| GET | `/prestadores/{prestadorId}/servicos` | Contrato existente: serviços ativos do prestador |
| GET | `/prestadores/{prestadorId}/servicos/gestao` | Serviços ativos e inativos, com categorias, para gestão |
| GET | `/prestadores/{prestadorId}/servicos/{id}` | Consulta detalhada de serviço |
| POST | `/prestadores/{prestadorId}/servicos` | Cria serviço com categorias; retorna 201 e Location |
| PUT | `/prestadores/{prestadorId}/servicos/{id}` | Atualiza os campos e substitui o conjunto de categorias |
| DELETE | `/prestadores/{prestadorId}/servicos/{id}` | Exclui serviço sem agendamentos; retorna 204 |

Filtros de `/servicos`: `categoriaId`, `precoMin`, `precoMax` e `nome`.
Os limites de preço são inclusivos. Os filtros são cumulativos; o nome usa busca
parcial sem distinguir maiúsculas de minúsculas. `%`, `_` e barra invertida são
tratados como texto na busca, não como comandos ou curingas.

Exemplo: `/servicos?categoriaId=UUID&precoMin=20&precoMax=80&nome=corte`.

O catálogo omite serviços inativos e negócios inativos. A listagem de gestão
permite encontrar e reativar serviços inativos. As consultas do novo catálogo e
da gestão carregam prestador e categorias com EntityGraph para evitar uma
consulta adicional por serviço.

### Categoria

```json
{
  "nome": "Beleza",
  "descricao": "Cuidados pessoais"
}
```

### Serviço

Substitua os identificadores pelos UUIDs de categorias existentes.

```json
{
  "nome": "Corte completo",
  "descricao": "Corte e finalização",
  "duracaoMinutos": 30,
  "preco": 50.25,
  "ativo": true,
  "categoriaIds": ["33333333-3333-4333-8333-333333333333"]
}
```

O PUT recebe a representação completa. `ativo: false` inativa o serviço.
As respostas detalhadas retornam `categorias` com id, nome e descrição, além
de `prestadorId` e `nomeNegocio`; não serializam entidades de usuário nem senhas.

## Validações e integridade

| Campo/regra | Tratamento |
| --- | --- |
| Nome de categoria | Obrigatório, até 100 caracteres; espaços externos removidos |
| Descrição de categoria | Opcional, até 255 caracteres; vazia vira null |
| Nome duplicado de categoria | 409, ignorando caixa e espaços externos; índice único protege operações simultâneas |
| Nome de serviço | Obrigatório, até 150 caracteres; espaços externos removidos |
| Descrição de serviço | Opcional, até 500 caracteres; vazia vira null |
| Duração | Inteiro JSON obrigatório entre 1 e 1440 minutos |
| Preço | Número JSON obrigatório entre 0 e 99999999.99, até duas casas decimais |
| Ativo | Booleano JSON obrigatório; texto `"true"` não é aceito |
| Categorias do serviço | Entre 1 e 50 categorias existentes, sem itens nulos; conjunto sem vínculos duplicados |
| Filtros de preço | Não negativos, até duas casas decimais; mínimo não pode superar máximo |
| IDs inválidos e JSON incompatível | 400, usando o tratamento padronizado existente |
| Recurso inexistente | 404 |
| Tentativa sem autorização | 401 sem autenticação; 403 sem permissão |

O limite de duração de 24 horas é uma decisão de implementação compatível com
o cálculo existente, que trabalha com janelas de atendimento dentro de um dia.
O limite de 50 categorias evita associações excessivas em uma única requisição.
Preço zero é permitido, conforme a restrição já existente no banco.

A atualização valida todas as categorias antes de modificar o serviço. Se uma
categoria não existir, a operação retorna 404 e os campos/vínculos permanecem
preservados. A gravação do serviço e dos vínculos ocorre na mesma transação.

### Exclusões e histórico

- Serviço sem agendamentos pode ser excluído. Seus vínculos N:N são removidos,
  mas as categorias continuam existindo.
- Serviço com qualquer agendamento vinculado retorna 409 na exclusão. A interface
  orienta a inativação, preservando o histórico.
- A duração de um serviço com agendamentos não pode ser alterada. O cálculo
  existente utiliza a duração atual do serviço para interpretar os intervalos
  reservados; alterá-la poderia reinterpretar reservas já feitas. Para outra
  duração, deve ser criado um novo serviço.
- Categoria vinculada a serviço ativo ou inativo retorna 409 na exclusão. O vínculo
  deve ser substituído/removido na edição dos serviços antes da exclusão.
- A restrição de chave estrangeira no banco também impede excluir uma categoria
  vinculada, inclusive se uma associação surgir durante uma exclusão concorrente.

V11 adiciona a unicidade de categoria por `lower(btrim(nome))`. Foi conferida a
ausência de nomes duplicados no banco local antes de aplicar a migração.
Em outro banco com duplicatas legadas, elas precisam ser reconciliadas antes
de executar essa migração; não há exclusão automática de dados.

V12 troca a exclusão em cascata da referência a categoria por `ON DELETE RESTRICT`.
A cascata da referência a serviço permanece apropriada para limpar seus vínculos.

Serviços legados sem categorias continuam consultáveis. Na próxima edição,
precisam receber pelo menos uma categoria; não são atribuídas classificações
arbitrárias aos dados existentes.

## Uso da interface

1. Acesse `http://127.0.0.1:5173` e faça login.
2. A aba **Serviços** abre o catálogo. Combine categoria, preço e nome. Os filtros
   ficam na URL, permitindo compartilhar a busca e usar Voltar/Avançar.
3. Com uma conta ADMIN, abra **Categorias** para cadastrar as classificações.
4. Com a conta do prestador, abra **Meu negócio → Gerenciar serviços**.
   ADMIN também encontra esse acesso nos detalhes de qualquer negócio.
5. Preencha nome, duração e preço e selecione uma ou mais categorias.
6. Na edição, desmarque **Serviço ativo** para retirar o serviço do catálogo.

As telas exibem carregamento, listas vazias, falhas de consulta com nova tentativa,
erros de validação e confirmação de exclusão. Falhas de gravação preservam os
campos preenchidos. Durante gravações, os controles de operações concorrentes
na mesma tela são bloqueados. A disposição se adapta a telas pequenas.

O módulo utiliza as contas e os papéis fornecidos pela autenticação existente.
Na ampliação administrativa solicitada posteriormente, um CommandLineRunner
passou a criar o primeiro ADMIN quando não houver nenhum, conforme o README.
Essa conta permite cadastrar as primeiras categorias. O cadastro público de
usuários continua sem conceder o papel ADMIN.

## Verificações

Resultado das suítes completas após a ampliação administrativa: **289 testes Java e 56 testes de interface
aprovados, sem falhas**. Esses totais incluem os módulos existentes e os novos
cenários descritos abaixo.

- 52 testes de integração novos com MockMvc e PostgreSQL, usando rollback dos
  dados dos cenários: CRUD, papéis, propriedade, associação N:N, isolamento de
  prestadores, campos/tipos inválidos, precisão monetária, limites, pesquisa
  literal, filtros cumulativos, inativos, histórico e restrições diretas do banco.
- 14 cenários novos com Playwright/Chrome: catálogo, filtros, navegação histórica,
  CRUD de categorias e serviços, acesso por papel, conflitos, falhas de consulta
  e gravação, categoria obrigatória e gestão em celular sem overflow do documento.
- Capturas de catálogo, categorias e gestão conferidas para verificar o layout.
- Build de produção e lint do frontend. O lint mantém um aviso anterior em
  `AuthContext.jsx` referente a Fast Refresh.

No ensaio local de RNF06, com 100 serviços associados a duas categorias,
10 consultas medidas após aquecimento e limpeza do contexto de persistência a
cada medição, as médias foram 40,17 ms no catálogo filtrado, 9,39 ms na gestão
e 2,15 ms na listagem de categorias. São medições de desenvolvimento com MockMvc,
não um ensaio de carga de produção nem uma medição de latência de rede.

Comandos de verificação (Java configurado no ambiente):

```powershell
.\mvnw.cmd -B -ntp test
cd frontend
npm.cmd run lint
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run test:e2e -- --reporter=list
```

Os testes de interface interceptam a API e não gravam no banco da aplicação.
Os testes Java exercitam persistência real e fazem rollback dos dados de teste;
as migrações de schema permanecem aplicadas.

## Limites do escopo

A documentação global Swagger/OpenAPI pertence à parte de Matteus no documento;
este arquivo registra os contratos dos módulos de Leandro para integração.
Autenticação, cadastro de contas e regras de disponibilidade/agendamento continuam
a cargo dos respectivos módulos. Preço e descrição seguem sendo atributos atuais
do serviço: não foi introduzido snapshot financeiro de agendamentos.

O catálogo retorna uma lista completa, como os endpoints de listagem existentes.
Para catálogos grandes, paginação e ensaios de carga adicionais devem anteceder
uma implantação em produção.
